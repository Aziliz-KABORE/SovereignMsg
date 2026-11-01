"""
SovereignMsg Gateway - Routes d'Administration (/api/admin)
==========================================================
Périmètre minimal strict :
- POST /api/admin/agents : Création d'un agent et génération du jeton d'activation
- POST /api/admin/agents/{id}/revoquer : Révocation immédiate d'un agent et désactivation Synapse

Contrôle d'accès : Réservé exclusivement au rôle 'admin'.
"""

import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import generate_secure_token, hash_token
from app.core.audit import record_audit
from app.core.synapse_client import synapse_client
from app.models.models import Agent, ActivationToken
from app.schemas.schemas import (
    AgentCreateRequest,
    AgentCreateResponse,
    AgentRevokeResponse
)
from app.api.deps import require_admin

router = APIRouter(prefix="/api/admin", tags=["Administration"])


@router.post(
    "/agents",
    response_model=AgentCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Enrôlement d'un nouvel agent et émission du jeton d'activation"
)
def create_agent(
    req: AgentCreateRequest,
    admin: Agent = Depends(require_admin),
    db: Session = Depends(get_db)
):
    # Vérification d'unicité de l'adresse e-mail
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


@router.post(
    "/agents/{agent_id}/revoquer",
    response_model=AgentRevokeResponse,
    summary="Révocation immédiate d'un agent et désactivation du compte Matrix"
)
def revoke_agent(
    agent_id: uuid.UUID,
    admin: Agent = Depends(require_admin),
    db: Session = Depends(get_db)
):
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
