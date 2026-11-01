"""
SovereignMsg Gateway - Tests d'Intégrité de la Piste d'Audit
===========================================================
Valide le chaînage cryptographique SHA-256 infalsifiable :
- Chaîne valide vérifiée avec succès
- Détection immédiate de toute altération de données ou de lien
"""

from app.core.audit import record_audit, verify_chain
from app.models.models import AuditEntry


def test_audit_chain_validity(db):
    """Vérifie qu'une succession d'entrées d'audit produit une chaîne cryptographiquement intègre."""
    record_audit(db, acteur="admin@gouv.bf", action="CREATION", cible="agent-1", detail="Agent créé")
    record_audit(db, acteur="agent-1@gouv.bf", action="LOGIN", cible="agent-1", detail="Connexion OK")
    record_audit(db, acteur="admin@gouv.bf", action="REVOCATION", cible="agent-1", detail="Agent révoqué")
    db.commit()

    is_valid, error_msg = verify_chain(db)
    assert is_valid is True
    assert error_msg is None


def test_audit_chain_tamper_detection(db):
    """Vérifie que la falsification rétroactive d'une entrée est immédiatement détectée."""
    record_audit(db, acteur="agent-1@gouv.bf", action="LOGIN", cible="agent-1", detail="Détail normal")
    entry2 = record_audit(db, acteur="agent-2@gouv.bf", action="LOGIN", cible="agent-2", detail="Détail normal 2")
    record_audit(db, acteur="agent-3@gouv.bf", action="LOGIN", cible="agent-3", detail="Détail normal 3")
    db.commit()

    # Altération malveillante de l'entrée 2 (tentative d'usurpation d'acteur)
    entry2.acteur = "hacker@malicieux.org"
    db.commit()

    is_valid, error_msg = verify_chain(db)
    assert is_valid is False
    assert "Altération de données détectée" in error_msg
