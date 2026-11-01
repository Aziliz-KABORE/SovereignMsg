"""
SovereignMsg Gateway - Schémas Pydantic v2
=========================================
Validation stricte des requêtes et sérialisation des réponses de l'API.
"""

from typing import Optional
from pydantic import BaseModel, Field

EMAIL_PATTERN = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"


# -----------------------------------------------------------------------------
# Authentification & Activation
# -----------------------------------------------------------------------------
class ActivationRequest(BaseModel):
    jeton: str = Field(..., description="Jeton d'activation à usage unique remis à l'agent")
    mot_de_passe: str = Field(..., min_length=12, description="Mot de passe robuste (12 caractères minimum)")


class ActivationResponse(BaseModel):
    otpauth_uri: str = Field(..., description="URI standard otpauth pour enregistrement TOTP")
    qr_code_base64: str = Field(..., description="Image QR Code encodée en PNG Data URI")
    message: str = Field(..., description="Instructions pour l'agent")


class ActivationConfirmRequest(BaseModel):
    jeton: str = Field(..., description="Jeton d'activation initial")
    code: str = Field(..., min_length=6, max_length=6, description="Code TOTP à 6 chiffres affiché par l'application")


class ActivationConfirmResponse(BaseModel):
    message: str
    statut: str


class LoginRequest(BaseModel):
    email: str = Field(..., pattern=EMAIL_PATTERN, description="Adresse e-mail professionnelle de l'agent")
    mot_de_passe: str = Field(..., description="Mot de passe de l'agent")
    code_totp: str = Field(..., min_length=6, max_length=6, description="Code TOTP à 6 chiffres")
    device_id: Optional[str] = Field(None, description="Identifiant unique de l'appareil (optionnel, persistant)")


class LoginResponse(BaseModel):
    access_token: str = Field(..., description="Jeton JWT de session de la passerelle")
    token_type: str = Field(default="bearer")
    matrix_access_token: str = Field(..., description="Jeton d'accès client Matrix")
    device_id: str = Field(..., description="Identifiant de l'appareil Matrix")
    matrix_user_id: str = Field(..., description="Identifiant Matrix complet de l'agent")
    homeserver_url: str = Field(..., description="URL de base du serveur Synapse pour le client")


class MeResponse(BaseModel):
    id: str
    nom: str
    email: str
    role: str
    statut: str
    matrix_user_id: str


# -----------------------------------------------------------------------------
# Administration minimale (Back-office)
# -----------------------------------------------------------------------------
class AgentCreateRequest(BaseModel):
    nom: str = Field(..., min_length=2, max_length=255, description="Nom et prénom de l'agent")
    email: str = Field(..., pattern=EMAIL_PATTERN, description="Adresse e-mail professionnelle unique")
    role: str = Field(default="agent", description="Rôle attribué : admin, agent, invite, rssi")


class AgentCreateResponse(BaseModel):
    id: str
    nom: str
    email: str
    role: str
    statut: str
    matrix_user_id: str
    jeton_activation: str = Field(..., description="Jeton d'activation brut remis une seule fois par l'administrateur")


class AgentRevokeResponse(BaseModel):
    id: str
    message: str
    statut: str
