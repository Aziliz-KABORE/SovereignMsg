"""
SovereignMsg Gateway - Tests Négatifs d'Authentification & Anti-Énumération
==========================================================================
Valide la résistance contre les attaques par force brute, le rejeu et l'énumération :
- Mêmes réponses 401 et messages identiques sur tous les motifs d'échec
- Protection anti-rejeu TOTP (totp_dernier_pas)
- Verrouillage automatique de compte après 5 échecs
- Rejet immédiat de jetons altérés ou expirés
"""

import time
import uuid
from datetime import datetime, timezone, timedelta
import pytest
import pyotp
import jwt
from app.core.config import settings
from app.core.security import hash_token, generate_gateway_jwt
from app.models.models import Agent, ActivationToken
from app.core.synapse_client import SynapseRateLimited, synapse_client

GENERIC_LOGIN_ERROR = "Identifiants invalides ou compte inaccessible."
GENERIC_ACTIVATION_ERROR = "Jeton d'activation invalide ou expiré."


def test_login_wrong_password(client, active_agent, test_totp_secret):
    """Vérifie qu'un mot de passe erroné renvoie un 401 avec le message standard."""
    totp = pyotp.TOTP(test_totp_secret)
    valid_code = totp.now()

    response = client.post(
        "/api/auth/login",
        json={
            "email": active_agent.email,
            "mot_de_passe": "MauvaisMotDePasse123!",
            "code_totp": valid_code
        }
    )
    assert response.status_code == 401
    assert response.json()["detail"] == GENERIC_LOGIN_ERROR


def test_login_wrong_totp(client, active_agent):
    """Vérifie qu'un mauvais code TOTP renvoie le même 401 et message générique."""
    response = client.post(
        "/api/auth/login",
        json={
            "email": active_agent.email,
            "mot_de_passe": "PasswordSecurise123!",
            "code_totp": "000000"
        }
    )
    assert response.status_code == 401
    assert response.json()["detail"] == GENERIC_LOGIN_ERROR


def test_login_totp_secret_is_not_accepted_as_code(client, active_agent, test_totp_secret):
    """The TOTP seed itself must never bypass one-time-code validation."""
    response = client.post(
        "/api/auth/login",
        json={
            "email": active_agent.email,
            "mot_de_passe": "PasswordSecurise123!",
            "code_totp": test_totp_secret
        }
    )
    assert response.status_code == 422


def test_login_totp_replay_rejected(client, active_agent, test_totp_secret):
    """Vérifie qu'un code TOTP déjà utilisé dans la même fenêtre temporelle est rejeté (anti-rejeu)."""
    totp = pyotp.TOTP(test_totp_secret)
    code = totp.now()

    # Première connexion réussie
    res1 = client.post(
        "/api/auth/login",
        json={
            "email": active_agent.email,
            "mot_de_passe": "PasswordSecurise123!",
            "code_totp": code
        }
    )
    assert res1.status_code == 200

    # Deuxième tentative immédiate avec le même code TOTP
    res2 = client.post(
        "/api/auth/login",
        json={
            "email": active_agent.email,
            "mot_de_passe": "PasswordSecurise123!",
            "code_totp": code
        }
    )
    assert res2.status_code == 401
    assert res2.json()["detail"] == GENERIC_LOGIN_ERROR


def test_login_synapse_rate_limit_is_reported_without_reprovisioning(
    client, active_agent, test_totp_secret, monkeypatch
):
    def rate_limited(**_kwargs):
        raise SynapseRateLimited("60")

    reprovision_calls = []
    monkeypatch.setattr(synapse_client, "login_user", rate_limited)
    monkeypatch.setattr(synapse_client, "create_or_update_user", lambda **_kwargs: reprovision_calls.append(True))

    response = client.post(
        "/api/auth/login",
        json={
            "email": active_agent.email,
            "mot_de_passe": "PasswordSecurise123!",
            "code_totp": pyotp.TOTP(test_totp_secret).now(),
        },
    )

    assert response.status_code == 503
    assert response.headers["retry-after"] == "60"
    assert reprovision_calls == []


def test_login_unknown_account_same_response(client, test_totp_secret):
    """Vérifie qu'un compte inexistant renvoie exactement le même 401 et message (anti-énumération)."""
    totp = pyotp.TOTP(test_totp_secret)
    code = totp.now()

    response = client.post(
        "/api/auth/login",
        json={
            "email": "agent.inconnu.fantome@gouv.bf",
            "mot_de_passe": "NimporteQuelMotDePasse123!",
            "code_totp": code
        }
    )
    assert response.status_code == 401
    assert response.json()["detail"] == GENERIC_LOGIN_ERROR


def test_login_revoked_account_same_response(client, db, active_agent, test_totp_secret):
    """Vérifie qu'un compte révoqué renvoie la même erreur 401 qu'un mauvais mot de passe."""
    active_agent.statut = "revoque"
    db.commit()

    totp = pyotp.TOTP(test_totp_secret)
    code = totp.now()

    response = client.post(
        "/api/auth/login",
        json={
            "email": active_agent.email,
            "mot_de_passe": "PasswordSecurise123!",
            "code_totp": code
        }
    )
    assert response.status_code == 401
    assert response.json()["detail"] == GENERIC_LOGIN_ERROR


def test_login_pending_account_same_response(client, db, active_agent, test_totp_secret):
    """Vérifie qu'un compte en attente renvoie la même réponse 401."""
    active_agent.statut = "en_attente"
    db.commit()

    totp = pyotp.TOTP(test_totp_secret)
    code = totp.now()

    response = client.post(
        "/api/auth/login",
        json={
            "email": active_agent.email,
            "mot_de_passe": "PasswordSecurise123!",
            "code_totp": code
        }
    )
    assert response.status_code == 401
    assert response.json()["detail"] == GENERIC_LOGIN_ERROR


def test_login_account_lockout_after_five_failures(client, db, active_agent, test_totp_secret):
    """Vérifie le verrouillage du compte après 5 échecs consécutifs."""
    for i in range(5):
        res = client.post(
            "/api/auth/login",
            json={
                "email": active_agent.email,
                "mot_de_passe": f"MauvaisMotDePasse_{i}!",
                "code_totp": "123456"
            }
        )
        assert res.status_code == 401
        assert res.json()["detail"] == GENERIC_LOGIN_ERROR

    db.refresh(active_agent)
    assert active_agent.echecs_connexion == 5
    assert active_agent.verrouille_jusqua is not None

    # 6ème tentative avec les BONS identifiants : doit rester bloquée car verrouillé
    totp = pyotp.TOTP(test_totp_secret)
    res_locked = client.post(
        "/api/auth/login",
        json={
            "email": active_agent.email,
            "mot_de_passe": "PasswordSecurise123!",
            "code_totp": totp.now()
        }
    )
    assert res_locked.status_code == 401
    assert res_locked.json()["detail"] == GENERIC_LOGIN_ERROR


def test_activation_invalid_token(client):
    """Vérifie le rejet d'un faux jeton d'activation."""
    response = client.post(
        "/api/auth/activation",
        json={
            "jeton": "jeton_completement_invalide_qui_n_existe_pas",
            "mot_de_passe": "NouveauPasswordFort123!"
        }
    )
    assert response.status_code == 401
    assert response.json()["detail"] == GENERIC_ACTIVATION_ERROR


def test_activation_password_too_short(client):
    """Vérifie le rejet d'un mot de passe de moins de 12 caractères."""
    response = client.post(
        "/api/auth/activation",
        json={
            "jeton": "un_jeton_quelconque",
            "mot_de_passe": "Court123!"  # < 12 caractères
        }
    )
    assert response.status_code == 422


def test_activation_expired_token(client, db):
    """Vérifie le rejet d'un jeton d'activation expiré."""
    agent_id = uuid.uuid4()
    agent = Agent(
        id=agent_id,
        matrix_user_id=f"@agent_{agent_id.hex[:16]}:sovereign.local",
        nom="Agent Expire",
        email="agent.expire@gouv.bf",
        statut="en_attente"
    )
    db.add(agent)

    raw_token = "jeton_expire_test_123456789"
    expired_time = datetime.now(timezone.utc) - timedelta(hours=1)
    act_token = ActivationToken(
        agent_id=agent_id,
        empreinte_jeton=hash_token(raw_token),
        expiration=expired_time,
        utilise=False
    )
    db.add(act_token)
    db.commit()

    response = client.post(
        "/api/auth/activation",
        json={
            "jeton": raw_token,
            "mot_de_passe": "NouveauPasswordFort123!"
        }
    )
    assert response.status_code == 401
    assert response.json()["detail"] == GENERIC_ACTIVATION_ERROR


def test_activation_replayed_token_rejected(client, db):
    """Vérifie qu'un jeton déjà utilisé (utilise=True) est immédiatement refusé."""
    agent_id = uuid.uuid4()
    agent = Agent(
        id=agent_id,
        matrix_user_id=f"@agent_{agent_id.hex[:16]}:sovereign.local",
        nom="Agent Deja Actif",
        email="agent.used@gouv.bf",
        statut="actif"
    )
    db.add(agent)

    raw_token = "jeton_deja_consomme_12345"
    future_time = datetime.now(timezone.utc) + timedelta(hours=24)
    act_token = ActivationToken(
        agent_id=agent_id,
        empreinte_jeton=hash_token(raw_token),
        expiration=future_time,
        utilise=True  # Déjà utilisé !
    )
    db.add(act_token)
    db.commit()

    response = client.post(
        "/api/auth/activation",
        json={
            "jeton": raw_token,
            "mot_de_passe": "NouveauPasswordFort123!"
        }
    )
    assert response.status_code == 401
    assert response.json()["detail"] == GENERIC_ACTIVATION_ERROR


def test_tampered_jwt_rejected(client):
    """Vérifie le rejet d'un JWT dont la signature a été altérée."""
    tampered_jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtMTIzNC01Njc4MTIzNDU2NzgiLCJleHAiOjk5OTk5OTk5OTl9.FAKESIGNATURE"
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {tampered_jwt}"}
    )
    assert response.status_code == 401


def test_expired_jwt_rejected(client, active_agent):
    """Vérifie le rejet d'un JWT expiré."""
    now = datetime.now(timezone.utc)
    expired_time = now - timedelta(minutes=10)
    expired_payload = {
        "sub": str(active_agent.id),
        "email": active_agent.email,
        "role": active_agent.role,
        "iat": int((now - timedelta(minutes=25)).timestamp()),
        "exp": int(expired_time.timestamp()),
        "jti": "expired_jti"
    }
    expired_jwt = jwt.encode(expired_payload, settings.JWT_SECRET, algorithm="HS256")

    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {expired_jwt}"}
    )
    assert response.status_code == 401
