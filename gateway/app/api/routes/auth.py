"""
SovereignMsg Gateway - Routes d'Authentification (/api/auth)
===========================================================
- POST /api/auth/activation : enregistre mot de passe, génère secret TOTP, renvoie QR code
- POST /api/auth/activation/confirm : valide TOTP, consomme jeton, active agent, crée compte Matrix
- POST /api/auth/login : authentification multi-facteurs (Argon2id + TOTP anti-rejeu) et connexion Matrix
- GET  /api/auth/me : vérification de l'agent authentifié avec relecture dynamique du statut

Règles de sécurité :
- Anti-énumération absolue : même réponse 401 et même délai (calcul Argon2 factice) pour tout échec
- Verrouillage automatique après MAX_LOGIN_ATTEMPTS échecs consécutifs
- Aucun mot de passe, secret TOTP ni jeton journalisé
"""

import io
import base64
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import segno

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    hash_password,
    verify_password,
    verify_dummy_password,
    encrypt_secret,
    decrypt_secret,
    generate_totp_secret,
    get_totp_uri,
    verify_totp_code,
    generate_gateway_jwt,
    hash_token,
    generate_matrix_password,
)
from app.core.audit import record_audit
from app.core.synapse_client import synapse_client
from app.models.models import Agent, ActivationToken
from app.schemas.schemas import (
    ActivationRequest,
    ActivationResponse,
    ActivationConfirmRequest,
    ActivationConfirmResponse,
    LoginRequest,
    LoginResponse,
    MeResponse,
)
from app.api.deps import get_current_agent

router = APIRouter(prefix="/api/auth", tags=["Authentification"])

# Message unique d'erreur pour prévenir toute énumération de compte ou fuite d'information
GENERIC_LOGIN_ERROR = "Identifiants invalides ou compte inaccessible."
GENERIC_ACTIVATION_ERROR = "Jeton d'activation invalide ou expiré."


def ensure_utc(dt: datetime) -> datetime:
    """Garantit qu'un datetime est conscient du fuseau UTC (compatible SQLite et PostgreSQL)."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


@router.post(
    "/activation",
    response_model=ActivationResponse,
    summary="Première étape d'activation : mot de passe et génération TOTP"
)
def activate_account(
    req: ActivationRequest,
    db: Session = Depends(get_db)
):
    token_hash = hash_token(req.jeton)
    now = datetime.now(timezone.utc)

    token_record = (
        db.query(ActivationToken)
        .filter(ActivationToken.empreinte_jeton == token_hash)
        .first()
    )

    # Vérification : jeton existant, non utilisé, non expiré
    if not token_record or token_record.utilise or ensure_utc(token_record.expiration) < now:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=GENERIC_ACTIVATION_ERROR
        )

    agent = db.query(Agent).filter(Agent.id == token_record.agent_id).first()
    if not agent or agent.statut == "revoque":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=GENERIC_ACTIVATION_ERROR
        )

    # Hachage Argon2id du mot de passe de l'agent
    agent.mot_de_passe_hash = hash_password(req.mot_de_passe)

    # Génération et chiffrement du secret TOTP au repos avec Fernet
    raw_totp_secret = generate_totp_secret()
    agent.totp_secret_chiffre = encrypt_secret(raw_totp_secret)
    agent.totp_dernier_pas = None

    # L'agent reste en attente et le jeton N'EST PAS consommé à cette étape
    agent.statut = "en_attente"

    # Génération de l'URI standard otpauth et du QR Code (segno)
    otpauth_uri = get_totp_uri(raw_totp_secret, agent.email, issuer="SovereignMsg")
    qr = segno.make(otpauth_uri, error="m")
    buff = io.BytesIO()
    qr.save(buff, kind="png", scale=5)
    qr_base64 = "data:image/png;base64," + base64.b64encode(buff.getvalue()).decode("utf-8")

    # Audit traçable sans fuite de secret
    record_audit(
        db,
        acteur=agent.email,
        action="ACTIVATION_INIT",
        cible=str(agent.id),
        detail="Initialisation mot de passe et génération secret TOTP"
    )

    db.commit()

    return ActivationResponse(
        otpauth_uri=otpauth_uri,
        qr_code_base64=qr_base64,
        message="Scannez ce QR Code avec votre application d'authentification puis confirmez avec le premier code."
    )


@router.post(
    "/activation/confirm",
    response_model=ActivationConfirmResponse,
    summary="Deuxième étape d'activation : validation premier TOTP et finalisation"
)
def confirm_activation(
    req: ActivationConfirmRequest,
    db: Session = Depends(get_db)
):
    token_hash = hash_token(req.jeton)
    now = datetime.now(timezone.utc)

    token_record = (
        db.query(ActivationToken)
        .filter(ActivationToken.empreinte_jeton == token_hash)
        .first()
    )

    if not token_record or token_record.utilise or ensure_utc(token_record.expiration) < now:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=GENERIC_ACTIVATION_ERROR
        )

    agent = db.query(Agent).filter(Agent.id == token_record.agent_id).first()
    if not agent or not agent.totp_secret_chiffre or agent.statut == "revoque":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=GENERIC_ACTIVATION_ERROR
        )

    # Déchiffrement du secret TOTP et validation du code
    totp_secret = decrypt_secret(agent.totp_secret_chiffre)
    is_valid, step = verify_totp_code(totp_secret, req.code)

    if not is_valid or step is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Code TOTP invalide."
        )

    # Consommation atomique du jeton d'activation
    token_record.utilise = True
    agent.totp_dernier_pas = step
    agent.statut = "actif"

    # Génération d'un mot de passe Matrix aléatoire fort (>32 car.) chiffré au repos
    matrix_password = generate_matrix_password()
    agent.matrix_password_chiffre = encrypt_secret(matrix_password)

    # Création du compte utilisateur dans Synapse via l'API Admin
    synapse_client.create_or_update_user(
        matrix_user_id=agent.matrix_user_id,
        displayname=agent.nom,
        password=matrix_password
    )

    record_audit(
        db,
        acteur=agent.email,
        action="ACTIVATION_CONFIRM",
        cible=str(agent.id),
        detail="Validation TOTP réussie, compte activé et utilisateur Matrix initialisé"
    )

    db.commit()

    return ActivationConfirmResponse(
        message="Compte activé avec succès. Vous pouvez désormais vous connecter.",
        statut="actif"
    )


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Connexion sécurisée : Argon2id + TOTP anti-rejeu et obtention des jetons"
)
def login(
    req: LoginRequest,
    db: Session = Depends(get_db)
):
    now = datetime.now(timezone.utc)
    agent = db.query(Agent).filter(Agent.email == req.email).first()

    # 1. Anti-énumération temporelle : si l'utilisateur n'existe pas
    if not agent:
        verify_dummy_password()
        record_audit(
            db,
            acteur="anonyme",
            action="LOGIN_ECHEC_INCONNU",
            cible=req.email,
            detail="Tentative de connexion sur un compte inexistant"
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=GENERIC_LOGIN_ERROR)

    # 2. Vérification du verrouillage de compte (Anti-brute force)
    if agent.verrouille_jusqua and ensure_utc(agent.verrouille_jusqua) > now:
        verify_dummy_password()
        record_audit(
            db,
            acteur=agent.email,
            action="LOGIN_ECHEC_VERROUILLE",
            cible=str(agent.id),
            detail="Tentative sur un compte temporairement verrouillé"
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=GENERIC_LOGIN_ERROR)

    # 3. Vérification du statut du compte (actif requis)
    if agent.statut != "actif":
        verify_dummy_password()
        record_audit(
            db,
            acteur=agent.email,
            action=f"LOGIN_ECHEC_STATUT_{agent.statut.upper()}",
            cible=str(agent.id),
            detail="Tentative sur un compte inactif ou révoqué"
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=GENERIC_LOGIN_ERROR)

    # 4. Vérification du mot de passe Argon2id
    is_password_valid = verify_password(req.mot_de_passe, agent.mot_de_passe_hash or "")
    if not is_password_valid:
        agent.echecs_connexion += 1
        if agent.echecs_connexion >= (settings.MAX_LOGIN_ATTEMPTS if settings else 5):
            lockout_min = settings.LOCKOUT_DURATION_MINUTES if settings else 15
            agent.verrouille_jusqua = now + timedelta(minutes=lockout_min)

        record_audit(
            db,
            acteur=agent.email,
            action="LOGIN_ECHEC_MOT_DE_PASSE",
            cible=str(agent.id),
            detail=f"Mot de passe erroné (échec {agent.echecs_connexion})"
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=GENERIC_LOGIN_ERROR)

    # 5. Vérification du code TOTP avec protection anti-rejeu (totp_dernier_pas)
    if not agent.totp_secret_chiffre:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=GENERIC_LOGIN_ERROR)

    totp_secret = decrypt_secret(agent.totp_secret_chiffre)
    is_totp_valid, step = verify_totp_code(
        secret=totp_secret,
        code=req.code_totp,
        last_step=agent.totp_dernier_pas
    )

    if not is_totp_valid or step is None:
        agent.echecs_connexion += 1
        if agent.echecs_connexion >= (settings.MAX_LOGIN_ATTEMPTS if settings else 5):
            lockout_min = settings.LOCKOUT_DURATION_MINUTES if settings else 15
            agent.verrouille_jusqua = now + timedelta(minutes=lockout_min)

        record_audit(
            db,
            acteur=agent.email,
            action="LOGIN_ECHEC_TOTP",
            cible=str(agent.id),
            detail="Code TOTP invalide ou rejoué"
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=GENERIC_LOGIN_ERROR)

    # Réinitialisation des compteurs d'échec et enregistrement du pas anti-rejeu
    agent.echecs_connexion = 0
    agent.verrouille_jusqua = None
    agent.totp_dernier_pas = step

    # 6. Connexion à Synapse Matrix (Plan B : POST /_matrix/client/v3/login)
    if not agent.matrix_password_chiffre:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Configuration Matrix incomplète pour cet agent."
        )

    matrix_password = decrypt_secret(agent.matrix_password_chiffre)
    # Extraction du localpart Matrix (@agent_uuid:domain -> agent_uuid)
    localpart = agent.matrix_user_id.split(":")[0].lstrip("@")

    synapse_res = synapse_client.login_user(
        username=localpart,
        password=matrix_password,
        device_id=req.device_id
    )

    # Si le compte Synapse doit être recréé ou synchronisé
    if not synapse_res:
        synapse_client.create_or_update_user(
            matrix_user_id=agent.matrix_user_id,
            displayname=agent.nom,
            password=matrix_password
        )
        synapse_res = synapse_client.login_user(
            username=localpart,
            password=matrix_password,
            device_id=req.device_id
        )

    if not synapse_res:
        record_audit(
            db,
            acteur=agent.email,
            action="LOGIN_ECHEC_SYNAPSE",
            cible=str(agent.id),
            detail="Échec de connexion interne au serveur Synapse"
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Le service de messagerie Matrix est momentanément indisponible."
        )

    matrix_access_token = synapse_res["access_token"]
    resolved_device_id = synapse_res.get("device_id") or (req.device_id or "UNKNOWN_DEVICE")

    # 7. Génération du jeton JWT de la passerelle
    gateway_jwt = generate_gateway_jwt(
        agent_id=str(agent.id),
        email=agent.email,
        role=agent.role
    )

    record_audit(
        db,
        acteur=agent.email,
        action="LOGIN_SUCCES",
        cible=str(agent.id),
        detail=f"Connexion réussie (appareil: {resolved_device_id})"
    )
    db.commit()

    return LoginResponse(
        access_token=gateway_jwt,
        token_type="bearer",
        matrix_access_token=matrix_access_token,
        device_id=resolved_device_id,
        matrix_user_id=agent.matrix_user_id,
        homeserver_url=synapse_client.base_url
    )


@router.get(
    "/me",
    response_model=MeResponse,
    summary="Identité de l'agent connecté avec re-vérification du statut"
)
def get_me(agent: Agent = Depends(get_current_agent)):
    return MeResponse(
        id=str(agent.id),
        nom=agent.nom,
        email=agent.email,
        role=agent.role,
        statut=agent.statut,
        matrix_user_id=agent.matrix_user_id
    )
