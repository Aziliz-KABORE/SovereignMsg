"""Configuration centrale de la passerelle SovereignMsg.

Lecture stricte des variables d'environnement via Pydantic Settings.
Aucun secret n'est codé en dur.
"""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Paramètres applicatifs validés à l'exécution."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Environnement
    environment: str = Field(default="demonstration", alias="ENVIRONMENT")
    domain_name: str = Field(default="localhost", alias="DOMAIN_NAME")

    # Base de données PostgreSQL de la passerelle
    gateway_database_url: str = Field(
        default="postgresql+psycopg2://gateway_user:CHANGEME@postgres-gateway:5432/gateway_db",
        alias="GATEWAY_DATABASE_URL",
    )

    # Sécurité JWT Passerelle
    gateway_jwt_secret_key: str = Field(..., alias="GATEWAY_JWT_SECRET_KEY")
    gateway_jwt_algorithm: str = Field(default="HS256", alias="GATEWAY_JWT_ALGORITHM")
    gateway_jwt_expire_minutes: int = Field(default=15, alias="GATEWAY_JWT_EXPIRE_MINUTES")

    # Clé Fernet (chiffrement symétrique au repos des secrets TOTP)
    gateway_fernet_key: str = Field(..., alias="GATEWAY_FERNET_KEY")

    # Synapse (réseau Docker interne uniquement)
    synapse_internal_url: str = Field(default="http://synapse:8008", alias="SYNAPSE_INTERNAL_URL")
    synapse_server_name: str = Field(default="sovereign.local", alias="SYNAPSE_SERVER_NAME")
    synapse_admin_username: str = Field(default="sovereign_gateway_admin", alias="SYNAPSE_ADMIN_USERNAME")
    synapse_admin_password: str = Field(default="", alias="SYNAPSE_ADMIN_PASSWORD")
    synapse_admin_token: str = Field(default="", alias="SYNAPSE_ADMIN_TOKEN")
    synapse_registration_shared_secret: str = Field(default="", alias="SYNAPSE_REGISTRATION_SHARED_SECRET")

    # Durcissement
    rate_limit_login_max: int = Field(default=5, alias="RATE_LIMIT_LOGIN_MAX")
    account_lock_failed_attempts: int = Field(default=5, alias="ACCOUNT_LOCK_FAILED_ATTEMPTS")


settings = Settings()

