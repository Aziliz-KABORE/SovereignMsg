"""
SovereignMsg Gateway - Tests d'Administration (/api/admin)
==========================================================
- Création d'un agent et émission du jeton d'activation
- Contrôle d'accès strict (403 pour rôle non-admin)
- Révocation d'un agent et invalidation immédiate de ses sessions actives
- Statistiques globales (P13)
- Liste des agents avec filtres (P14)
- Fiche détaillée et modification de rôle (P16)
- Journal d'audit et vérification de chaîne cryptographique (P17)
- Export CSV du journal d'audit (P17)
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
    res_before = client.get("/api/auth/me", headers=agent_headers)
    assert res_before.status_code == 200

    res_revoke = client.post(
        f"/api/admin/agents/{active_agent.id}/revoquer",
        headers=admin_headers
    )
    assert res_revoke.status_code == 200
    assert res_revoke.json()["statut"] == "revoque"

    res_after = client.get("/api/auth/me", headers=agent_headers)
    assert res_after.status_code == 401
    assert "inaccessible ou révoqué" in res_after.json()["detail"]


def test_admin_stats_and_agent_list(client, admin_headers, active_agent):
    """Vérifie les statistiques globales et la liste des agents avec filtre."""
    # 1. Stats P13
    res_stats = client.get("/api/admin/stats", headers=admin_headers)
    assert res_stats.status_code == 200
    stats = res_stats.json()
    assert stats["total_agents"] >= 1
    assert stats["actifs"] >= 1
    assert "admin" in stats["par_role"]

    # 2. Liste des agents P14
    res_list = client.get("/api/admin/agents", headers=admin_headers)
    assert res_list.status_code == 200
    agents = res_list.json()
    assert len(agents) >= 1

    # 3. Détail agent P16
    res_detail = client.get(f"/api/admin/agents/{active_agent.id}", headers=admin_headers)
    assert res_detail.status_code == 200
    assert res_detail.json()["id"] == str(active_agent.id)

    # 4. Modification de rôle P16
    res_patch = client.patch(
        f"/api/admin/agents/{active_agent.id}",
        headers=admin_headers,
        json={"role": "rssi"}
    )
    assert res_patch.status_code == 200
    assert res_patch.json()["role"] == "rssi"


def test_admin_audit_and_verification(client, admin_headers):
    """Vérifie le journal d'audit, la vérification de chaîne cryptographique et l'export CSV (P17)."""
    # 1. Liste du journal d'audit
    res_audit = client.get("/api/admin/audit", headers=admin_headers)
    assert res_audit.status_code == 200
    entries = res_audit.json()
    assert isinstance(entries, list)
    assert len(entries) >= 1
    first = entries[0]
    assert "hash" in first
    assert "hash_precedent" in first

    # 2. Vérification cryptographique de la chaîne
    res_verify = client.get("/api/admin/audit/verifier", headers=admin_headers)
    assert res_verify.status_code == 200
    verify_data = res_verify.json()
    assert verify_data["valide"] is True

    # 3. Export CSV
    res_csv = client.get("/api/admin/audit/export", headers=admin_headers)
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]
    assert "attachment; filename=" in res_csv.headers["content-disposition"]
    assert "Horodatage" in res_csv.text
