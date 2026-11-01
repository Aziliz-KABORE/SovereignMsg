#!/usr/bin/env python3
"""Amorçage du compte Administrateur Synapse pour la Passerelle SovereignMsg.

Fonctionne sur tous les systèmes d'exploitation (Windows, Linux, macOS).
Exécute les appels vers le conteneur Docker Synapse ou via HTTP interne.
"""

import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import time

# Compatibilité encodage console Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_DIR = Path(__file__).resolve().parent.parent


def load_env() -> dict[str, str]:
    """Charge les variables d'environnement depuis .env s'il existe."""
    env_file = BASE_DIR / ".env"
    env_vars = dict(os.environ)
    if env_file.exists():
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    env_vars[key.strip()] = val.strip().strip('"').strip("'")
    return env_vars


def ensure_synapse_secrets() -> None:
    """Génère dynamiquement les secrets Synapse dans homeserver.yaml si CHANGEME est présent."""
    yaml_path = BASE_DIR / "deploy" / "synapse" / "homeserver.yaml"
    if not yaml_path.exists():
        return
    with open(yaml_path, "r", encoding="utf-8") as f:
        content = f.read()

    changed = False
    if "CHANGEME_SYNAPSE_REGISTRATION_SHARED_SECRET" in content:
        content = content.replace(
            "CHANGEME_SYNAPSE_REGISTRATION_SHARED_SECRET_64HEX",
            secrets.token_hex(32)
        )
        changed = True
    if "CHANGEME_SYNAPSE_MACAROON_SECRET_MIN32CHARS" in content:
        content = content.replace(
            "CHANGEME_SYNAPSE_MACAROON_SECRET_MIN32CHARS",
            secrets.token_hex(32)
        )
        changed = True
    if "CHANGEME_SYNAPSE_FORM_SECRET_MIN32CHARS" in content:
        content = content.replace(
            "CHANGEME_SYNAPSE_FORM_SECRET_MIN32CHARS",
            secrets.token_hex(32)
        )
        changed = True

    if changed:
        with open(yaml_path, "w", encoding="utf-8") as f:
            f.write(content)
        print("[*] [SovereignMsg] Secrets Synapse generes automatiquement dans deploy/synapse/homeserver.yaml")


def run_docker_command(cmd: list[str]) -> tuple[int, str]:
    """Exécute une commande docker compose et renvoie le code et la sortie."""
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(BASE_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            check=False,
        )
        return proc.returncode, proc.stdout
    except Exception as exc:
        return -1, str(exc)


def main() -> None:
    """Procédure principale d'amorçage de l'administrateur Synapse."""
    ensure_synapse_secrets()
    env = load_env()
    admin_user = env.get("SYNAPSE_ADMIN_USERNAME", "sovereign_gateway_admin")
    admin_pass = env.get("SYNAPSE_ADMIN_PASSWORD")
    if not admin_pass or "CHANGEME" in admin_pass:
        print("[!] [ERREUR SÉCURITÉ] SYNAPSE_ADMIN_PASSWORD n'est pas défini ou contient CHANGEME dans .env.", file=sys.stderr)
        sys.exit(1)
    server_name = env.get("SYNAPSE_SERVER_NAME", "sovereign.local")

    print("[*] [SovereignMsg] Demarrage du bootstrap de l'administrateur Synapse...")

    # Attente que Synapse réponde
    print("[*] Verification de la disponibilite de Synapse...")
    ready = False
    for attempt in range(1, 31):
        code, out = run_docker_command([
            "docker", "compose", "exec", "-T", "synapse",
            "curl", "-s", "-f", "http://localhost:8008/_matrix/client/versions"
        ])
        if code == 0 and "versions" in out:
            ready = True
            print("[+] Synapse est operationnel.")
            break
        print(f"    En attente de Synapse... ({attempt}/30)")
        time.sleep(2)

    if not ready:
        print("[-] Erreur : Synapse n'a pas repondu a temps. Verifiez docker compose logs synapse.")
        sys.exit(1)

    # Création du compte administrateur Matrix
    print(f"[*] Creation du compte administrateur @{admin_user}:{server_name}...")
    code, out = run_docker_command([
        "docker", "compose", "exec", "-T", "synapse",
        "register_new_matrix_user",
        "-u", admin_user,
        "-p", admin_pass,
        "-a",
        "-c", "/etc/synapse/homeserver.yaml",
        "http://localhost:8008"
    ])

    if code == 0:
        print("[+] Compte administrateur cree avec succes.")
    elif "already taken" in out.lower() or "already exists" in out.lower():
        print("[i] Le compte administrateur existe deja.")
    else:
        print(f"[!] Info enregistrement : {out.strip()}")

    # Connexion interne pour obtenir l'access_token
    print("[*] Recuperation de l'access_token via connexion interne...")
    login_payload = json.dumps({
        "type": "m.login.password",
        "identifier": {"type": "m.id.user", "user": admin_user},
        "password": admin_pass,
        "initial_device_display_name": "SovereignMsg-Gateway-Daemon"
    })

    code, out = run_docker_command([
        "docker", "compose", "exec", "-T", "synapse",
        "curl", "-s", "-X", "POST",
        "-H", "Content-Type: application/json",
        "-d", login_payload,
        "http://localhost:8008/_matrix/client/v3/login"
    ])

    try:
        data = json.loads(out)
        access_token = data.get("access_token")
    except Exception:
        access_token = None

    if not access_token:
        print(f"[-] Echec de la recuperation du token. Reponse : {out}")
        sys.exit(1)

    print(f"[+] Jeton d'administration Matrix obtenu (longueur: {len(access_token)} car.)")

    # Écriture dans .synapse_admin_token (hors Git)
    token_file = BASE_DIR / ".synapse_admin_token"
    with open(token_file, "w", encoding="utf-8") as f:
        f.write(access_token.strip() + "\n")

    # Mise à jour du .env si existant
    env_file = BASE_DIR / ".env"
    if env_file.exists():
        with open(env_file, "r", encoding="utf-8") as f:
            lines = f.readlines()
        has_token = False
        new_lines = []
        for line in lines:
            if line.startswith("SYNAPSE_ADMIN_TOKEN="):
                new_lines.append(f"SYNAPSE_ADMIN_TOKEN={access_token.strip()}\n")
                has_token = True
            else:
                new_lines.append(line)
        if not has_token:
            new_lines.append(f"\nSYNAPSE_ADMIN_TOKEN={access_token.strip()}\n")
        with open(env_file, "w", encoding="utf-8") as f:
            f.writelines(new_lines)
        print("[+] Fichier .env mis a jour avec SYNAPSE_ADMIN_TOKEN.")

    # Redémarrage du conteneur gateway pour prise en compte du token
    print("[*] Redemarrage du service passerelle...")
    run_docker_command(["docker", "compose", "restart", "gateway"])
    print("[+] Bootstrap termine avec succes !")


if __name__ == "__main__":
    main()

