#!/usr/bin/env python3
"""
SovereignMsg - Script de génération des comptes de démonstration et de test
==========================================================================
Crée les comptes de base dans PostgreSQL et provisionne leurs comptes Matrix dans Synapse :
- Admin : admin@gouv.bf
- Agent A : agent.a@gouv.bf
- Agent B : agent.b@gouv.bf
- Agent C (Témoin BLOC 1) : agent.c@gouv.bf
"""

import sys
import uuid
from datetime import datetime, timezone

from app.core.database import SessionLocal
from app.core.security import hash_password, encrypt_secret
from app.core.synapse_client import synapse_client
from app.models.models import Agent

DEMO_ACCOUNTS = [
    {
        "nom": "Administrateur National",
        "email": "admin@gouv.bf",
        "role": "admin",
        "mot_de_passe": "AdminDemo2026!#",
        "totp_secret": "JBSWY3DPEHPK3PXP",  # Secret standard pour test
        "matrix_localpart": "agent_admin_01",
    },
    {
        "nom": "Agent A (Sécurité)",
        "email": "agent.a@gouv.bf",
        "role": "agent",
        "mot_de_passe": "AgentADemo2026!#",
        "totp_secret": "JBSWY3DPEHPK3PXP",
        "matrix_localpart": "agent_a_01",
    },
    {
        "nom": "Agent B (Défense)",
        "email": "agent.b@gouv.bf",
        "role": "agent",
        "mot_de_passe": "AgentBDemo2026!#",
        "totp_secret": "JBSWY3DPEHPK3PXP",
        "matrix_localpart": "agent_b_01",
    },
    {
        "nom": "Agent C (Témoin)",
        "email": "agent.c@gouv.bf",
        "role": "agent",
        "mot_de_passe": "AgentCDemo2026!#",
        "totp_secret": "JBSWY3DPEHPK3PXP",
        "matrix_localpart": "agent_c_01",
    },
]


def seed():
    db = SessionLocal()
    print("[*] Initialisation des comptes de démonstration...")

    for acc in DEMO_ACCOUNTS:
        matrix_user_id = f"@{acc['matrix_localpart']}:sovereign.local"
        matrix_pass = f"MatrixSecure_{acc['mot_de_passe']}"

        # 1. Création ou mise à jour de l'utilisateur Matrix dans Synapse
        try:
            print(f"[*] Provisionnement Matrix pour {matrix_user_id}...")
            synapse_client.create_or_update_user(
                matrix_user_id=matrix_user_id,
                displayname=acc["nom"],
                password=matrix_pass
            )
            print(f"[+] Utilisateur Matrix créé avec succès : {matrix_user_id}")
        except Exception as e:
            print(f"[!] Erreur provisionnement Matrix pour {matrix_user_id}: {e}")

        # 2. Création ou mise à jour dans PostgreSQL
        existing = db.query(Agent).filter(Agent.email == acc["email"]).first()
        if existing:
            existing.nom = acc["nom"]
            existing.statut = "actif"
            existing.mot_de_passe_hash = hash_password(acc["mot_de_passe"])
            existing.totp_secret_chiffre = encrypt_secret(acc["totp_secret"])
            existing.totp_dernier_pas = None
            existing.matrix_password_chiffre = encrypt_secret(matrix_pass)
            existing.echecs_connexion = 0
            existing.verrouille_jusqua = None
            print(f"[i] Compte mis à jour en base : {acc['email']}")
        else:
            agent = Agent(
                id=uuid.uuid4(),
                matrix_user_id=matrix_user_id,
                nom=acc["nom"],
                email=acc["email"],
                role=acc["role"],
                statut="actif",
                mot_de_passe_hash=hash_password(acc["mot_de_passe"]),
                totp_secret_chiffre=encrypt_secret(acc["totp_secret"]),
                totp_dernier_pas=None,
                matrix_password_chiffre=encrypt_secret(matrix_pass),
                echecs_connexion=0,
                date_creation=datetime.now(timezone.utc),
            )
            db.add(agent)
            print(f"[+] Agent créé en base : {acc['email']} | Rôle: {acc['role']}")

    db.commit()
    db.close()
    print("[+] Amorçage terminé avec succès.")


if __name__ == "__main__":
    seed()
