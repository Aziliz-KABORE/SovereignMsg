"""
SovereignMsg Gateway - Tests BLOC 1 : Groupes P07 + Révocation effective
=========================================================================
Tests couvrant :
- Création de salon de groupe chiffré (P07)
- Refus d'inviter des agents non actifs / inconnus
- Révocation avec succès Synapse (statut 'revoque', retourne synapse_ok=True)
- Révocation avec échec simulé Synapse (statut 'revocation_incomplete', 502)
- Idempotence de la révocation (2e appel réessayable)
- Traçabilité dans le journal d'audit (AGENT_REVOCATION / AGENT_REVOCATION_INCOMPLETE)
"""

import uuid
import pytest
import pyotp
import httpx
from unittest.mock import patch
from app.models.models import Agent, ActivationToken
from app.core.security import hash_password, encrypt_secret
from app.core.synapse_client import DeactivateResult
from datetime import datetime, timezone


# ---------------------------------------------------------------------------
# Fixtures supplémentaires pour BLOC 1
# ---------------------------------------------------------------------------

@pytest.fixture
def agent_en_attente(db):
    """Agent avec statut 'en_attente' (non activé)."""
    agent_id = uuid.uuid4()
    agent = Agent(
        id=agent_id,
        matrix_user_id=f"@agent_{agent_id.hex[:16]}:sovereign.local",
        nom="Agent En Attente",
        email="agent.attente@gouv.bf",
        role="agent",
        statut="en_attente",
        mot_de_passe_hash=None,
        totp_secret_chiffre=None,
        echecs_connexion=0,
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


@pytest.fixture
def agent_revoque(db, test_totp_secret):
    """Agent avec statut 'revoque'."""
    agent_id = uuid.uuid4()
    agent = Agent(
        id=agent_id,
        matrix_user_id=f"@agent_{agent_id.hex[:16]}:sovereign.local",
        nom="Agent Révoqué",
        email="agent.revoque@gouv.bf",
        role="agent",
        statut="revoque",
        mot_de_passe_hash=hash_password("PasswordSecurise123!"),
        totp_secret_chiffre=encrypt_secret(test_totp_secret),
        echecs_connexion=0,
        date_revocation=datetime.now(timezone.utc),
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


# ---------------------------------------------------------------------------
# TESTS P07 : Création de salon de groupe chiffré
# ---------------------------------------------------------------------------

class TestGroupeCreation:
    """Tests de création de salon de groupe (P07)."""

    def test_create_groupe_success_all_active(self, client, admin_headers, active_agent, db):
        """Un salon de groupe est créé avec chiffrement activé si tous les membres sont actifs."""
        with patch("app.api.routes.admin.synapse_client.create_encrypted_room") as mock_create:
            mock_create.return_value = "!abc123:sovereign.local"

            response = client.post(
                "/api/admin/groupes",
                headers=admin_headers,
                json={
                    "nom": "Groupe Opérationnel Alpha",
                    "membres_emails": [active_agent.email]
                }
            )

        assert response.status_code == 201, response.text
        data = response.json()
        assert data["room_id"] == "!abc123:sovereign.local"
        assert data["nom"] == "Groupe Opérationnel Alpha"
        assert data["chiffrement_actif"] is True
        assert len(data["membres_invites"]) == 1
        assert data["membres_invites"][0]["email"] == active_agent.email
        assert data["membres_invites"][0]["statut"] == "actif"
        assert len(data["membres_refus"]) == 0
        # Vérifie que create_encrypted_room a bien été appelé
        mock_create.assert_called_once()

    def test_create_groupe_refuses_unknown_email(self, client, admin_headers, db):
        """Un email inconnu dans la liste doit figurer dans membres_refus."""
        with patch("app.api.routes.admin.synapse_client.create_encrypted_room") as mock_create:
            mock_create.return_value = "!xyz999:sovereign.local"

            response = client.post(
                "/api/admin/groupes",
                headers=admin_headers,
                json={
                    "nom": "Groupe Test Refus",
                    "membres_emails": ["inconnu@nowhere.bf"]
                }
            )

        assert response.status_code == 201
        data = response.json()
        assert len(data["membres_refus"]) == 1
        assert data["membres_refus"][0]["email"] == "inconnu@nowhere.bf"
        assert data["membres_refus"][0]["statut"] == "inconnu"
        assert len(data["membres_invites"]) == 0

    def test_create_groupe_refuses_pending_agent(self, client, admin_headers, agent_en_attente, db):
        """Un agent en_attente (non activé) doit figurer dans membres_refus."""
        with patch("app.api.routes.admin.synapse_client.create_encrypted_room") as mock_create:
            mock_create.return_value = "!pending123:sovereign.local"

            response = client.post(
                "/api/admin/groupes",
                headers=admin_headers,
                json={
                    "nom": "Groupe Test En Attente",
                    "membres_emails": [agent_en_attente.email]
                }
            )

        assert response.status_code == 201
        data = response.json()
        assert len(data["membres_refus"]) == 1
        assert data["membres_refus"][0]["statut"] == "en_attente"

    def test_create_groupe_refuses_revoked_agent(self, client, admin_headers, agent_revoque, db):
        """Un agent révoqué doit figurer dans membres_refus."""
        with patch("app.api.routes.admin.synapse_client.create_encrypted_room") as mock_create:
            mock_create.return_value = "!revoked123:sovereign.local"

            response = client.post(
                "/api/admin/groupes",
                headers=admin_headers,
                json={
                    "nom": "Groupe Test Révoqué",
                    "membres_emails": [agent_revoque.email]
                }
            )

        assert response.status_code == 201
        data = response.json()
        assert len(data["membres_refus"]) == 1
        assert data["membres_refus"][0]["statut"] == "revoque"

    def test_create_groupe_synapse_failure_returns_502(self, client, admin_headers, active_agent, db):
        """Si Synapse échoue lors de la création, la route retourne 502 et non 201."""
        with patch("app.api.routes.admin.synapse_client.create_encrypted_room") as mock_create:
            mock_create.return_value = None  # Synapse en échec

            response = client.post(
                "/api/admin/groupes",
                headers=admin_headers,
                json={
                    "nom": "Groupe Synapse Failure",
                    "membres_emails": [active_agent.email]
                }
            )

        assert response.status_code == 502

    def test_create_groupe_forbidden_for_regular_agent(self, client, agent_headers, active_agent):
        """Un agent standard ne peut pas créer de groupe."""
        response = client.post(
            "/api/admin/groupes",
            headers=agent_headers,
            json={
                "nom": "Groupe Interdit",
                "membres_emails": [active_agent.email]
            }
        )
        assert response.status_code == 403

    def test_create_groupe_mixed_valid_and_invalid(self, client, admin_headers, active_agent, agent_revoque, agent_en_attente, db):
        """Mélange : actifs invités, révoqués/en_attente refusés, groupe quand même créé."""
        with patch("app.api.routes.admin.synapse_client.create_encrypted_room") as mock_create:
            mock_create.return_value = "!mixed123:sovereign.local"

            response = client.post(
                "/api/admin/groupes",
                headers=admin_headers,
                json={
                    "nom": "Groupe Mixte",
                    "membres_emails": [
                        active_agent.email,
                        agent_revoque.email,
                        agent_en_attente.email,
                        "fantome@nowhere.bf"
                    ]
                }
            )

        assert response.status_code == 201
        data = response.json()
        assert len(data["membres_invites"]) == 1
        assert data["membres_invites"][0]["email"] == active_agent.email
        assert len(data["membres_refus"]) == 3


# ---------------------------------------------------------------------------
# TESTS RÉVOCATION : ordre des appels, échec Synapse, idempotence, audit
# ---------------------------------------------------------------------------

class TestRevocationEffective:
    """Tests de révocation effective (BLOC 1)."""

    def test_revoke_success_synapse_ok(self, client, admin_headers, active_agent, db):
        """
        Révocation réussie : Synapse répond 200.
        - statut final = 'revoque'
        - synapse_ok = True
        - Journal contient AGENT_REVOCATION
        """
        with patch("app.api.routes.admin.synapse_client.deactivate_user") as mock_deactivate:
            mock_deactivate.return_value = DeactivateResult(
                success=True, status_code=200, message="Compte désactivé."
            )

            response = client.post(
                f"/api/admin/agents/{active_agent.id}/revoquer",
                headers=admin_headers
            )

        assert response.status_code == 200, response.text
        data = response.json()
        assert data["statut"] == "revoque"
        assert data["synapse_ok"] is True

        # Vérification en base
        db.refresh(active_agent)
        assert active_agent.statut == "revoque"
        assert active_agent.date_revocation is not None

        # Vérification de l'ordre d'appel : deactivate_user appelé avec le bon user_id
        mock_deactivate.assert_called_once_with(active_agent.matrix_user_id)

    def test_revoke_synapse_failure_returns_502_and_blocks_login(self, client, admin_headers, active_agent, agent_headers, db):
        """
        Échec simulé Synapse :
        - Route retourne 502 (NOT succès)
        - statut = 'revocation_incomplete' en base
        - Le login est quand même refusé (statut != actif)
        - Journal contient AGENT_REVOCATION_INCOMPLETE
        """
        with patch("app.api.routes.admin.synapse_client.deactivate_user") as mock_deactivate:
            mock_deactivate.return_value = DeactivateResult(
                success=False,
                status_code=503,
                message="Synapse unavailable"
            )

            response = client.post(
                f"/api/admin/agents/{active_agent.id}/revoquer",
                headers=admin_headers
            )

        assert response.status_code == 502
        assert "incomplète" in response.json()["detail"] or "Synapse" in response.json()["detail"]

        # statut en base = revocation_incomplete
        db.refresh(active_agent)
        assert active_agent.statut == "revocation_incomplete"

        # Le login doit être refusé même avec token valide (get_current_agent rejette != 'actif')
        res_me = client.get("/api/auth/me", headers=agent_headers)
        assert res_me.status_code == 401

    def test_revoke_idempotent_retryable(self, client, admin_headers, active_agent, db):
        """
        Idempotence : premier appel réussi, deuxième appel réussit aussi.
        Après une révocation incomplète, une 2e tentative qui réussit passe à 'revoque'.
        """
        # 1er appel : Synapse échoue
        with patch("app.api.routes.admin.synapse_client.deactivate_user") as mock_deactivate:
            mock_deactivate.return_value = DeactivateResult(
                success=False, status_code=503, message="Timeout"
            )
            res1 = client.post(
                f"/api/admin/agents/{active_agent.id}/revoquer",
                headers=admin_headers
            )
        assert res1.status_code == 502
        db.refresh(active_agent)
        assert active_agent.statut == "revocation_incomplete"

        # 2e appel : Synapse répond
        with patch("app.api.routes.admin.synapse_client.deactivate_user") as mock_deactivate:
            mock_deactivate.return_value = DeactivateResult(
                success=True, status_code=200, message="OK"
            )
            res2 = client.post(
                f"/api/admin/agents/{active_agent.id}/revoquer",
                headers=admin_headers
            )
        assert res2.status_code == 200
        db.refresh(active_agent)
        assert active_agent.statut == "revoque"

    def test_revoke_audit_logged_on_success(self, client, admin_headers, active_agent, db):
        """Le journal d'audit doit contenir une entrée AGENT_REVOCATION après révocation réussie."""
        from app.models.models import AuditEntry

        with patch("app.api.routes.admin.synapse_client.deactivate_user") as mock_deactivate:
            mock_deactivate.return_value = DeactivateResult(
                success=True, status_code=200, message="OK"
            )
            client.post(
                f"/api/admin/agents/{active_agent.id}/revoquer",
                headers=admin_headers
            )

        audit_entry = db.query(AuditEntry).filter(
            AuditEntry.action == "AGENT_REVOCATION",
            AuditEntry.cible == str(active_agent.id)
        ).first()
        assert audit_entry is not None
        assert "Synapse" in audit_entry.detail or active_agent.nom in audit_entry.detail

    def test_revoke_audit_logged_on_synapse_failure(self, client, admin_headers, active_agent, db):
        """Le journal d'audit doit contenir AGENT_REVOCATION_INCOMPLETE si Synapse échoue."""
        from app.models.models import AuditEntry

        with patch("app.api.routes.admin.synapse_client.deactivate_user") as mock_deactivate:
            mock_deactivate.return_value = DeactivateResult(
                success=False, status_code=503, message="Service Unavailable"
            )
            client.post(
                f"/api/admin/agents/{active_agent.id}/revoquer",
                headers=admin_headers
            )

        audit_entry = db.query(AuditEntry).filter(
            AuditEntry.action == "AGENT_REVOCATION_INCOMPLETE",
            AuditEntry.cible == str(active_agent.id)
        ).first()
        assert audit_entry is not None
        assert "INCOMPLET" in audit_entry.detail.upper() or "incomplète" in audit_entry.detail.lower()

    def test_revoke_login_refused_after_revocation(self, client, admin_headers, active_agent, agent_headers, db):
        """La session JWT existante est invalidée immédiatement après révocation."""
        # Avant révocation : /api/auth/me retourne 200
        res_before = client.get("/api/auth/me", headers=agent_headers)
        assert res_before.status_code == 200

        with patch("app.api.routes.admin.synapse_client.deactivate_user") as mock_deactivate:
            mock_deactivate.return_value = DeactivateResult(
                success=True, status_code=200, message="OK"
            )
            client.post(
                f"/api/admin/agents/{active_agent.id}/revoquer",
                headers=admin_headers
            )

        # Après révocation : /api/auth/me retourne 401
        res_after = client.get("/api/auth/me", headers=agent_headers)
        assert res_after.status_code == 401
