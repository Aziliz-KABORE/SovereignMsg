"""
SovereignMsg Gateway - Piste d'Audit à Chaînage Cryptographique
==============================================================
Journalisation infalsifiable conforme aux exigences du référentiel sécurité :
- Chaque entrée est liée à l'empreinte SHA-256 de l'entrée précédente.
- Le hash est calculé sur le hash précédent et la sérialisation JSON canonique des champs.
- L'insertion est sérialisée sous transaction avec verrouillage pour prévenir les fourches.
- Fonction verify_chain() pour auditer l'intégrité de la piste.
- Aucun mot de passe, code TOTP ni secret n'est jamais consigné.
"""

import json
import hashlib
from datetime import datetime, timezone
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from app.models.models import AuditEntry

GENESIS_PREV_HASH = "0" * 64


def compute_canonical_json(data: dict) -> str:
    """
    Produit une représentation JSON canonique déterministe (clés triées, séparateurs stricts).
    """
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def format_deterministic_time(dt: datetime) -> str:
    """Formate une date en chaîne ISO standardisée déterministe."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def compute_audit_hash(
    prev_hash: str,
    horodatage_iso: str,
    acteur: str,
    action: str,
    cible: str,
    detail: str
) -> str:
    """
    Calcule le hash SHA-256 d'une entrée d'audit :
    hash = SHA-256(prev_hash + JSON_canonique(horodatage, acteur, action, cible, detail))
    """
    payload_data = {
        "acteur": acteur,
        "action": action,
        "cible": cible,
        "detail": detail,
        "horodatage": horodatage_iso,
    }
    canonical_json = compute_canonical_json(payload_data)
    combined = (prev_hash + canonical_json).encode("utf-8")
    return hashlib.sha256(combined).hexdigest()


def record_audit(
    db: Session,
    acteur: str,
    action: str,
    cible: str,
    detail: str
) -> AuditEntry:
    """
    Enregistre une nouvelle entrée dans la piste d'audit de manière sérialisée.
    Acquiert un verrou exclusif sur la dernière entrée connue pour éviter tout embranchement concurrent.
    """
    # Verrouillage de la dernière entrée pour sérialisation stricte
    last_entry = (
        db.query(AuditEntry)
        .order_by(AuditEntry.horodatage.desc(), AuditEntry.id.desc())
        .with_for_update()
        .first()
    )

    prev_hash = last_entry.hash if last_entry else GENESIS_PREV_HASH

    now = datetime.now(timezone.utc)
    horodatage_iso = format_deterministic_time(now)

    current_hash = compute_audit_hash(
        prev_hash=prev_hash,
        horodatage_iso=horodatage_iso,
        acteur=acteur,
        action=action,
        cible=cible,
        detail=detail
    )

    entry = AuditEntry(
        horodatage=now,
        acteur=acteur,
        action=action,
        cible=cible,
        detail=detail,
        hash_precedent=prev_hash,
        hash=current_hash
    )

    db.add(entry)
    db.flush()  # Assure l'écriture dans la transaction courante sans commiter prématurément
    return entry


def verify_chain(db: Session) -> Tuple[bool, Optional[str]]:
    """
    Vérifie l'intégrité cryptographique complète de la chaîne d'audit.
    Retourne (True, None) si valide, ou (False, message_erreur) en cas de corruption ou altération.
    """
    entries = (
        db.query(AuditEntry)
        .order_by(AuditEntry.horodatage.asc(), AuditEntry.id.asc())
        .all()
    )

    expected_prev_hash = GENESIS_PREV_HASH

    for i, entry in enumerate(entries):
        # 1. Vérification de la continuité du lien
        if entry.hash_precedent != expected_prev_hash:
            return (
                False,
                f"Rupture de chaîne au maillon index {i} (id: {entry.id}) : "
                f"hash_precedent attendu {expected_prev_hash}, trouvé {entry.hash_precedent}"
            )

        # 2. Vérification du calcul du hash de l'entrée
        horodatage_iso = format_deterministic_time(entry.horodatage)
        recomputed_hash = compute_audit_hash(
            prev_hash=entry.hash_precedent,
            horodatage_iso=horodatage_iso,
            acteur=entry.acteur,
            action=entry.action,
            cible=entry.cible,
            detail=entry.detail
        )

        if recomputed_hash != entry.hash:
            return (
                False,
                f"Altération de données détectée au maillon index {i} (id: {entry.id}) : "
                f"hash recalculé {recomputed_hash} != hash enregistré {entry.hash}"
            )

        expected_prev_hash = entry.hash

    return True, None
