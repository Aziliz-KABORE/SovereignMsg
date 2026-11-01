"""
SovereignMsg Gateway - Fixtures Pytest
======================================
Configuration isolée pour tests automatisés sans Docker :
- SQLite en mémoire (StaticPool)
- Clés de sécurité éphémères de test
- Simulation de Synapse via httpx.MockTransport
"""

import os
import uuid
from datetime import datetime, timezone, timedelta
import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import httpx
import pyotp

# Configuration des variables d'environnement de test avant tout import
TEST_JWT_SECRET = "8f3b9c2a1e4d7f0b6e5a8c9d2e1f4b7a0d3c6e9f2a5b8d1e4c7a0b3d6f9e2c5b"
TEST_FERNET_KEY = Fernet.generate_key().decode("utf-8")
TEST_SYNAPSE_TOKEN = "syt_test_mock_token_admin_12345"

os.environ["ENVIRONMENT"] = "testing"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET"] = TEST_JWT_SECRET
os.environ["FERNET_KEY"] = TEST_FERNET_KEY
os.environ["SYNAPSE_ADMIN_TOKEN"] = TEST_SYNAPSE_TOKEN
os.environ["SYNAPSE_LOGIN_MODE"] = "password"

from app.core.config import Settings
import app.core.config as config_mod
config_mod.settings = Settings(
    JWT_SECRET=TEST_JWT_SECRET,
    FERNET_KEY=TEST_FERNET_KEY,
    SYNAPSE_ADMIN_TOKEN=TEST_SYNAPSE_TOKEN,
    DATABASE_URL="sqlite:///:memory:",
    SYNAPSE_LOGIN_MODE="password"
)

from app.core.database import Base, get_db
from app.core.security import hash_password, encrypt_secret, generate_gateway_jwt, hash_token
from app.core.synapse_client import synapse_client
from app.models.models import Agent, ActivationToken
from app.main import app
from app.core.audit import record_audit

# Moteur SQLite en mémoire avec StaticPool pour partager la mémoire entre les sessions
engine_test = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine_test)
    yield
    Base.metadata.drop_all(bind=engine_test)


@pytest.fixture
def db():
    connection = engine_test.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def mock_synapse_transport():
    """Mock HTTPX simulant Synapse Matrix sans aucun conteneur Docker."""
    def handler(request: httpx.Request) -> httpx.Response:
        url_path = request.url.path

        # 1. Login Matrix POST /_matrix/client/v3/login
        if url_path == "/_matrix/client/v3/login" and request.method == "POST":
            return httpx.Response(
                200,
                json={
                    "user_id": "@agent_test:sovereign.local",
                    "access_token": "syt_mock_client_access_token_9999",
                    "home_server": "sovereign.local",
                    "device_id": "TEST_DEVICE_PWA_01"
                }
            )

        # 2. Création utilisateur PUT /_synapse/admin/v2/users/
        if "/_synapse/admin/v2/users/" in url_path and request.method == "PUT":
            return httpx.Response(200, json={"name": "@mock:sovereign.local"})

        # 3. Désactivation utilisateur POST /_synapse/admin/v1/deactivate/
        if "/_synapse/admin/v1/deactivate/" in url_path and request.method == "POST":
            return httpx.Response(200, json={"id_server_unbind_result": "success"})

        # 4. Whoami
        if url_path == "/_matrix/client/v3/account/whoami":
            return httpx.Response(
                200,
                json={"user_id": "@agent_test:sovereign.local", "device_id": "TEST_DEVICE_PWA_01"}
            )

        return httpx.Response(404, json={"error": "Not Found"})

    return httpx.MockTransport(handler)


@pytest.fixture
def client(db, mock_synapse_transport):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    synapse_client.transport = mock_synapse_transport

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    synapse_client.transport = None


@pytest.fixture
def test_totp_secret():
    return pyotp.random_base32()


@pytest.fixture
def active_agent(db, test_totp_secret):
    agent_id = uuid.uuid4()
    agent = Agent(
        id=agent_id,
        matrix_user_id=f"@agent_{agent_id.hex[:16]}:sovereign.local",
        nom="Agent Testeur",
        email="agent.test@gouv.bf",
        role="agent",
        statut="actif",
        mot_de_passe_hash=hash_password("PasswordSecurise123!"),
        totp_secret_chiffre=encrypt_secret(test_totp_secret),
        totp_dernier_pas=None,
        matrix_password_chiffre=encrypt_secret("MatrixPassStrong123!#"),
        echecs_connexion=0,
        verrouille_jusqua=None
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


@pytest.fixture
def admin_agent(db):
    admin_id = uuid.uuid4()
    admin = Agent(
        id=admin_id,
        matrix_user_id=f"@agent_{admin_id.hex[:16]}:sovereign.local",
        nom="Admin Securite",
        email="admin.secu@gouv.bf",
        role="admin",
        statut="actif",
        mot_de_passe_hash=hash_password("AdminStrongPassword123!"),
        totp_secret_chiffre=encrypt_secret(pyotp.random_base32()),
        matrix_password_chiffre=encrypt_secret("MatrixAdminPass123!#"),
        echecs_connexion=0
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    # Crée une entrée d'audit initiale pour que test_admin_audit_and_verification ait du contenu
    record_audit(
        db,
        acteur="system",
        action="ADMIN_ACCOUNT_CREATED",
        cible=str(admin.id),
        detail=f"Compte administrateur de test initialisé : {admin.email}"
    )
    db.commit()
    return admin


@pytest.fixture
def admin_headers(admin_agent):
    token = generate_gateway_jwt(str(admin_agent.id), admin_agent.email, admin_agent.role)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def agent_headers(active_agent):
    token = generate_gateway_jwt(str(active_agent.id), active_agent.email, active_agent.role)
    return {"Authorization": f"Bearer {token}"}
