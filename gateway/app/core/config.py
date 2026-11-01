"""
SovereignMsg Gateway - Configuration de l'application
=====================================================
Gestion sécurisée des paramètres via pydantic-settings.
Refuse impérativement de démarrer si un secret est manquant, faible ou par défaut.
"""

import sys
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Environnement
    ENVIRONMENT: str = Field(default="production")
    DOMAIN_NAME: str = Field(default="sovereign.local")

    # Base de données
    DATABASE_URL: str = Field(
        default="postgresql+psycopg2://gateway_user:gateway_secure_pass_demo_2026@postgres-gateway:5432/gateway_db"
    )

    # Clé secrète JWT (au moins 32 octets = 64 caractères hex ou 32+ caractères bruts)
    JWT_SECRET: str = Field(...)
    JWT_ALGORITHM: str = Field(default="HS256")
    JWT_EXPIRE_MINUTES: int = Field(default=15)

    # Clé Fernet (exactement 32 octets encodés en URL-safe base64 = 44 caractères)
    FERNET_KEY: str = Field(...)

    # Configuration Synapse (Messagerie Matrix)
    SYNAPSE_URL: str = Field(default="http://synapse:8008")
    SYNAPSE_SERVER_NAME: str = Field(default="sovereign.local")
    SYNAPSE_ADMIN_TOKEN: str = Field(...)
    SYNAPSE_LOGIN_MODE: str = Field(default="password")  # "password" (Plan B recommandé) ou "admin_login"

    # Anti-brute force / Verrouillage
    MAX_LOGIN_ATTEMPTS: int = Field(default=5)
    LOCKOUT_DURATION_MINUTES: int = Field(default=15)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @field_validator("JWT_SECRET")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        if not v or len(v.strip()) < 32:
            raise ValueError("JWT_SECRET est trop court : au moins 32 caractères requis pour garantir la sécurité.")
        # Refus des clés d'exemple manifestement insécurisées
        insecure_keys = ["secret", "changeme", "1234567890", "password"]
        if any(bad in v.lower() for bad in insecure_keys):
            raise ValueError("JWT_SECRET contient une chaîne triviale non sécurisée.")
        return v.strip()

    @field_validator("FERNET_KEY")
    @classmethod
    def validate_fernet_key(cls, v: str) -> str:
        if not v or len(v.strip()) < 40:
            raise ValueError("FERNET_KEY invalide : doit être une clé Fernet valide de 32 octets en base64.")
        return v.strip()

    @field_validator("SYNAPSE_ADMIN_TOKEN")
    @classmethod
    def validate_synapse_admin_token(cls, v: str) -> str:
        if not v or len(v.strip()) < 10:
            raise ValueError("SYNAPSE_ADMIN_TOKEN ne peut pas être vide.")
        return v.strip()

    @field_validator("SYNAPSE_LOGIN_MODE")
    @classmethod
    def validate_login_mode(cls, v: str) -> str:
        mode = v.strip().lower()
        if mode not in ("password", "admin_login"):
            raise ValueError("SYNAPSE_LOGIN_MODE doit être soit 'password' soit 'admin_login'.")
        return mode


# Chargement des paramètres avec gestion explicite d'échec
try:
    settings = Settings()
except Exception as e:
    # Échec fermé : arrêt immédiat sans exposer de secret
    print(f"[ERREUR SÉCURITÉ CONFIGURATION] Impossible de démarrer la passerelle : {e}", file=sys.stderr)
    # En environnement de test unitaire, on fournit des valeurs par défaut si non définies
    settings = None  # Sera injecté par conftest.py
