"""
SovereignMsg Gateway - Dépendances d'Authentification & Contrôle d'Accès
=======================================================================
Vérification des jetons JWT et re-lecture systématique du statut de l'agent en base.
Échec fermé : un compte révoqué est immédiatement bloqué, même avec un jeton JWT non expiré.
"""

import uuid
from typing import Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_gateway_jwt
from app.models.models import Agent

security_bearer = HTTPBearer(auto_error=False)


def get_current_agent(
    credentials: HTTPAuthorizationCredentials = Depends(security_bearer),
    db: Session = Depends(get_db)
) -> Agent:
    """
    Extrait l'identité de l'agent depuis le JWT et vérifie son statut en temps réel dans la base.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Jeton d'authentification manquant.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = credentials.credentials
    try:
        payload = decode_gateway_jwt(token)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Jeton invalide ou expiré : {e}",
            headers={"WWW-Authenticate": "Bearer"}
        )

    agent_id_str = payload.get("sub")
    if not agent_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Jeton invalide (identifiant absent).",
            headers={"WWW-Authenticate": "Bearer"}
        )

    try:
        agent_uuid = uuid.UUID(agent_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiant de jeton malformé.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    agent = db.query(Agent).filter(Agent.id == agent_uuid).first()

    # Règle non négociable : Échec fermé et contrôle systématique de l'état du compte
    if not agent or agent.statut != "actif":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Compte inaccessible ou révoqué.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    return agent


def require_admin(agent: Agent = Depends(get_current_agent)) -> Agent:
    """
    Restreint l'accès aux seuls agents disposant du rôle 'admin'.
    """
    if agent.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Action réservée aux administrateurs."
        )
    return agent


def require_admin_or_rssi(agent: Agent = Depends(get_current_agent)) -> Agent:
    """
    Restreint l'accès aux agents disposant du rôle 'admin' ou 'rssi'.
    """
    if agent.role not in ("admin", "rssi"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Action réservée aux administrateurs ou RSSI."
        )
    return agent

