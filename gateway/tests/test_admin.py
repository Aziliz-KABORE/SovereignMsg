"""
SovereignMsg Gateway - Tests d'Administration (/api/admin)
==========================================================
- Création d'un agent et émission du jeton d'activation
- Contrôle d'accès strict (403 pour rôle non-admin)
- Révocation d'un agent et invalidation immédiate de ses sessions actives
"""

import uuid
from app.models.models import Agent


def test_admin_create_agent_success(client, admin_headers, db):
    """Vérifie la création d'un agent par un administrateur."""
    response = client.post(
        "/api/admin/agents",
        headers=admin_headers,
        json={
            "nom": "Ouedraogo Salif",
            "email": "salif.ouedraogo@ministere.bf",
            "role": "agent"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["nom"] == "Ouedraogo Salif"
    assert data["email"] == "salif.ouedraogo@ministere.bf"
    assert data["statut"] == "en_attente"
    assert data["jeton_activation"] is not None
    # L'identifiant Matrix est bien dérivé de l'UUID et ne contient pas l'email
    assert "salif" not in data["matrix_user_id"]
    assert "@agent_" in data["matrix_user_id"]


def test_admin_create_agent_forbidden_for_regular_agent(client, agent_headers):
    """Vérifie qu'un agent standard se voit refuser l'accès aux routes d'administration."""
    response = client.post(
        "/api/admin/agents",
        headers=agent_headers,
        json={
            "nom": "Agent Tenteur",
            "email": "tentative@ministere.bf",
            "role": "agent"
        }
    )
    assert response.status_code == 403
    assert "Action réservée aux administrateurs" in response.json()["detail"]


def test_admin_revoke_agent_immediate_session_termination(client, admin_headers, active_agent, agent_headers, db):
    """Vérifie que la révocation d'un agent invalide immédiatement sa session courante."""
    # 1. L'agent accède normalement à /api/auth/me avec son JWT valide
    res_before = client.get("/api/auth/me", headers=agent_headers)
    assert res_before.status_code == 200

    # 2. L'administrateur révoque l'agent
    res_revoke = client.post(
        f"/api/admin/agents/{active_agent.id}/revoquer",
        headers=admin_headers
    )
    assert res_revoke.status_code == 200
    assert res_revoke.json()["statut"] == "revoque"

    # 3. L'agent tente immédiatement d'utiliser son JWT : refusé immédiatement (401)
    res_after = client.get("/api/auth/me", headers=agent_headers)
    assert res_after.status_code == 401
    assert "inaccessible ou révoqué" in res_after.json()["detail"]
