"""
SovereignMsg Gateway - Routes d'Administration (/api/admin)
==========================================================
Périmètre complet pour le back-office souverain :
- GET /api/admin/stats : Statistiques globales (P13, admin/rssi)
- GET /api/admin/agents : Liste des agents avec recherche et filtres (P14, admin/rssi)
- GET /api/admin/agents/{agent_id} : Fiche détaillée d'un agent (P16, admin/rssi)
- PATCH /api/admin/agents/{agent_id} : Modification du rôle d'un agent (P16, admin)
- POST /api/admin/agents : Enrôlement d'un nouvel agent (P15, admin)
- POST /api/admin/agents/{agent_id}/revoquer : Révocation immédiate et désactivation Matrix (P16, admin)
- GET /api/admin/audit : Journal d'audit infalsifiable (P17, admin/rssi)
- GET /api/admin/audit/verifier : Vérification cryptographique de la chaîne (P17, admin/rssi)
- GET /api/admin/audit/export : Export CSV du journal d'audit (P17, admin/rssi)

Contrôle d'accès strict : rôles 'admin' ou 'rssi' vérifiés à chaque requête.
"""

import csv
import io
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import generate_secure_token, hash_token
from app.core.audit import record_audit, verify_chain, format_deterministic_time
from app.core.synapse_client import synapse_client
from app.models.models import Agent, ActivationToken, AuditEntry
from app.schemas.schemas import (
    AdminStatsResponse,
    AgentCreateRequest,
    AgentCreateResponse,
    AgentListItem,
    AgentRevokeResponse,
    AgentUpdateRequest,
    AuditEntryResponse,
    AuditVerifyResponse
)
from app.api.deps import require_admin, require_admin_or_rssi

router = APIRouter(prefix="/api/admin", tags=["Administration"])


# -----------------------------------------------------------------------------
# P13 - Tableau de bord et statistiques
# -----------------------------------------------------------------------------
@router.get(
    "/stats",
    response_model=AdminStatsResponse,
    summary="Statistiques globales des agents pour le tableau de bord (P13)"
)
def get_admin_stats(
    current_user: Agent = Depends(require_admin_or_rssi),
    db: Session = Depends(get_db)
):
    """
    Retourne le nombre d'agents actifs, en attente et révoqués, ainsi que la répartition par rôle.
    Accessible aux administrateurs et au RSSI.
    """
    total = db.query(func.count(Agent.id)).scalar() or 0
    actifs = db.query(func.count(Agent.id)).filter(Agent.statut == "actif").scalar() or 0
    en_attente = db.query(func.count(Agent.id)).filter(Agent.statut == "en_attente").scalar() or 0
    revoques = db.query(func.count(Agent.id)).filter(Agent.statut == "revoque").scalar() or 0

    roles_count = db.query(Agent.role, func.count(Agent.id)).group_by(Agent.role).all()
    par_role = {role: count for role, count in roles_count}

    return AdminStatsResponse(
        total_agents=total,
        actifs=actifs,
        en_attente=en_attente,
        revoques=revoques,
        par_role=par_role
    )


# -----------------------------------------------------------------------------
# P14 - Liste des agents avec recherche et filtres
# -----------------------------------------------------------------------------
@router.get(
    "/agents",
    response_model=List[AgentListItem],
    summary="Liste des agents avec filtres de statut, rôle et recherche (P14)"
)
def list_agents(
    statut: Optional[str] = Query(None, description="Filtrer par statut: actif, en_attente, revoque"),
    role: Optional[str] = Query(None, description="Filtrer par rôle: admin, agent, invite, rssi"),
    search: Optional[str] = Query(None, description="Recherche par nom ou adresse e-mail"),
    current_user: Agent = Depends(require_admin_or_rssi),
    db: Session = Depends(get_db)
):
    """
    Liste les agents enregistrés selon les filtres choisis.
    Accessible aux administrateurs et au RSSI.
    """
    query = db.query(Agent)

    if statut:
        query = query.filter(Agent.statut == statut)
    if role:
        query = query.filter(Agent.role == role)
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Agent.nom.ilike(search_pattern)) | (Agent.email.ilike(search_pattern))
        )

    agents = query.order_by(Agent.nom.asc()).all()

    return [
        AgentListItem(
            id=str(a.id),
            nom=a.nom,
            email=a.email,
            role=a.role,
            statut=a.statut,
            matrix_user_id=a.matrix_user_id,
            date_creation=a.date_creation.isoformat() if a.date_creation else "",
            date_revocation=a.date_revocation.isoformat() if a.date_revocation else None
        )
        for a in agents
    ]


# -----------------------------------------------------------------------------
# P16 - Fiche détaillée d'un agent
# -----------------------------------------------------------------------------
@router.get(
    "/agents/{agent_id}",
    response_model=AgentListItem,
    summary="Fiche détaillée d'un agent (P16)"
)
def get_agent_detail(
    agent_id: uuid.UUID,
    current_user: Agent = Depends(require_admin_or_rssi),
    db: Session = Depends(get_db)
):
    """
    Consulte la fiche d'un agent. Accessible aux administrateurs et au RSSI.
    """
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent introuvable."
        )

    return AgentListItem(
        id=str(agent.id),
        nom=agent.nom,
        email=agent.email,
        role=agent.role,
        statut=agent.statut,
        matrix_user_id=agent.matrix_user_id,
        date_creation=agent.date_creation.isoformat() if agent.date_creation else "",
        date_revocation=agent.date_revocation.isoformat() if agent.date_revocation else None
    )


# -----------------------------------------------------------------------------
# P16 - Modification d'un agent (changement de rôle)
# -----------------------------------------------------------------------------
@router.patch(
    "/agents/{agent_id}",
    response_model=AgentListItem,
    summary="Mise à jour du rôle ou nom d'un agent (P16)"
)
def update_agent(
    agent_id: uuid.UUID,
    req: AgentUpdateRequest,
    admin: Agent = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Modifie le rôle ou le nom d'un agent. Réservé à l'administrateur.
    L'action est inscrite au journal d'audit infalsifiable.
    """
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent introuvable."
        )

    ancien_role = agent.role
    if req.role and req.role in ("admin", "agent", "invite", "rssi"):
        agent.role = req.role
    if req.nom:
        agent.nom = req.nom

    record_audit(
        db,
        acteur=admin.email,
        action="AGENT_ROLE_UPDATE" if req.role else "AGENT_UPDATE",
        cible=str(agent.id),
        detail=f"Mise à jour de l'agent {agent.nom} (rôle: {ancien_role} -> {agent.role})"
    )
    db.commit()

    return AgentListItem(
        id=str(agent.id),
        nom=agent.nom,
        email=agent.email,
        role=agent.role,
        statut=agent.statut,
        matrix_user_id=agent.matrix_user_id,
        date_creation=agent.date_creation.isoformat() if agent.date_creation else "",
        date_revocation=agent.date_revocation.isoformat() if agent.date_revocation else None
    )


# -----------------------------------------------------------------------------
# P15 - Enrôlement d'un nouvel agent
# -----------------------------------------------------------------------------
@router.post(
    "/agents",
    response_model=AgentCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Enrôlement d'un nouvel agent et émission du jeton d'activation (P15)"
)
def create_agent(
    req: AgentCreateRequest,
    admin: Agent = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Enrôle un agent dans le système souverain.
    Génère un jeton d'activation sécurisé valable 48h, affiché UNE SEULE FOIS.
    Réservé exclusivement aux administrateurs.
    """
    existing = db.query(Agent).filter(Agent.email == req.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un agent avec cette adresse e-mail existe déjà."
        )

    # Identifiant Matrix dérivé de l'UUID (jamais de l'e-mail pour la vie privée)
    new_id = uuid.uuid4()
    server_name = settings.SYNAPSE_SERVER_NAME if settings else "sovereign.local"
    matrix_user_id = f"@agent_{new_id.hex[:16]}:{server_name}"

    agent = Agent(
        id=new_id,
        matrix_user_id=matrix_user_id,
        nom=req.nom,
        email=req.email,
        role=req.role,
        statut="en_attente"
    )
    db.add(agent)
    db.flush()

    # Génération du jeton d'activation sécurisé (32 octets aléatoires)
    raw_token = generate_secure_token()
    token_hash = hash_token(raw_token)
    now = datetime.now(timezone.utc)
    expiration = now + timedelta(hours=48)  # Jeton valable 48h

    act_token = ActivationToken(
        agent_id=agent.id,
        empreinte_jeton=token_hash,
        expiration=expiration,
        utilise=False
    )
    db.add(act_token)

    record_audit(
        db,
        acteur=admin.email,
        action="AGENT_CREATION",
        cible=str(agent.id),
        detail=f"Création de l'agent {agent.nom} (rôle: {agent.role})"
    )

    db.commit()

    return AgentCreateResponse(
        id=str(agent.id),
        nom=agent.nom,
        email=agent.email,
        role=agent.role,
        statut=agent.statut,
        matrix_user_id=agent.matrix_user_id,
        jeton_activation=raw_token
    )


# -----------------------------------------------------------------------------
# P16 - Révocation immédiate d'un agent
# -----------------------------------------------------------------------------
@router.post(
    "/agents/{agent_id}/revoquer",
    response_model=AgentRevokeResponse,
    summary="Révocation immédiate d'un agent et désactivation du compte Matrix (P16)"
)
def revoke_agent(
    agent_id: uuid.UUID,
    admin: Agent = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Révoque un agent immédiatement :
    - Statut passé à 'revoque' (échec fermé : accès bloqué sur toutes les requêtes)
    - Compte Synapse désactivé côté Matrix via l'API interne
    - Inscription au journal d'audit infalsifiable
    Réservé exclusivement aux administrateurs.
    """
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent introuvable."
        )

    now = datetime.now(timezone.utc)
    agent.statut = "revoque"
    agent.date_revocation = now

    # Désactivation immédiate dans Synapse Matrix
    synapse_client.deactivate_user(agent.matrix_user_id)

    record_audit(
        db,
        acteur=admin.email,
        action="AGENT_REVOCATION",
        cible=str(agent.id),
        detail=f"Révocation du compte de {agent.nom}"
    )

    db.commit()

    return AgentRevokeResponse(
        id=str(agent.id),
        message=f"L'agent {agent.nom} a été révoqué avec succès.",
        statut="revoque"
    )


# -----------------------------------------------------------------------------
# P17 - Journal d'audit et vérification de chaîne cryptographique
# -----------------------------------------------------------------------------
@router.get(
    "/audit",
    response_model=List[AuditEntryResponse],
    summary="Consultation du journal d'audit infalsifiable (P17)"
)
def get_audit_entries(
    limit: int = Query(100, ge=1, le=1000, description="Nombre maximum d'entrées"),
    action: Optional[str] = Query(None, description="Filtrer par type d'action"),
    current_user: Agent = Depends(require_admin_or_rssi),
    db: Session = Depends(get_db)
):
    """
    Retourne la liste chronologique inverse des entrées du journal d'audit.
    Accessible aux administrateurs et au RSSI.
    """
    query = db.query(AuditEntry)
    if action:
        query = query.filter(AuditEntry.action == action)

    entries = query.order_by(AuditEntry.horodatage.desc(), AuditEntry.id.desc()).limit(limit).all()

    return [
        AuditEntryResponse(
            id=str(e.id),
            horodatage=format_deterministic_time(e.horodatage),
            acteur=e.acteur,
            action=e.action,
            cible=e.cible,
            detail=e.detail,
            hash_precedent=e.hash_precedent,
            hash=e.hash
        )
        for e in entries
    ]


@router.get(
    "/audit/verifier",
    response_model=AuditVerifyResponse,
    summary="Vérification cryptographique de l'intégrité de la chaîne d'audit (P17)"
)
def verify_audit_chain_endpoint(
    current_user: Agent = Depends(require_admin_or_rssi),
    db: Session = Depends(get_db)
):
    """
    Vérifie l'intégrité cryptographique complète du chaînage SHA-256 de la piste d'audit.
    Garantit l'absence d'altération ou de falsification.
    Accessible aux administrateurs et au RSSI.
    """
    is_valid, error_msg = verify_chain(db)
    total = db.query(func.count(AuditEntry.id)).scalar() or 0

    return AuditVerifyResponse(
        valide=is_valid,
        total_entrees=total,
        message=error_msg or "Chaîne cryptographique d'audit intègre et infalsifiable."
    )


@router.get(
    "/audit/export",
    summary="Export CSV du journal d'audit (P17)"
)
def export_audit_csv(
    current_user: Agent = Depends(require_admin_or_rssi),
    db: Session = Depends(get_db)
):
    """
    Exporte l'intégralité du journal d'audit au format CSV.
    Accessible aux administrateurs et au RSSI.
    """
    entries = db.query(AuditEntry).order_by(AuditEntry.horodatage.asc(), AuditEntry.id.asc()).all()

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    writer.writerow([
        "ID",
        "Horodatage (UTC)",
        "Acteur",
        "Action",
        "Cible",
        "Détail",
        "Hash Précédent",
        "Hash SHA-256"
    ])

    for e in entries:
        writer.writerow([
            str(e.id),
            format_deterministic_time(e.horodatage),
            e.acteur,
            e.action,
            e.cible,
            e.detail,
            e.hash_precedent,
            e.hash
        ])

    csv_data = output.getvalue()
    filename = f"journal_audit_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename=\"{filename}\"",
            "Cache-Control": "no-cache, no-store, must-revalidate"
        }
    )
