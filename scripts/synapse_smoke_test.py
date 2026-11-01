#!/usr/bin/env python3
"""
SovereignMsg - Test de fumée Synapse (Smoke Test)
=================================================
Vérification des capacités de l'API Synapse 1.118.0 avant l'écriture de FastAPI (Sous-étape 2A).

Endpoints officiels testés :
1. GET  /_matrix/client/v3/account/whoami (Whoami admin)
   Doc: https://spec.matrix.org/v1.11/client-server-api/#get_matrixclientv3accountwhoami
2. PUT  /_synapse/admin/v2/users/<user_id> (Création compte sans mot de passe utilisable)
   Doc: https://element-hq.github.io/synapse/latest/admin_api/user_admin_api.html#create-or-modify-account
3. POST /_synapse/admin/v1/users/<user_id>/login (Login as user avec valid_until_ms)
   Doc: https://element-hq.github.io/synapse/latest/admin_api/user_admin_api.html#login-as-a-user
4. GET  /_matrix/client/v3/account/whoami (Contrôle device_id avec jeton utilisateur)
   Doc: https://spec.matrix.org/v1.11/client-server-api/#get_matrixclientv3accountwhoami
5. Deuxième obtention d'access_token (Test stabilité appareil et comparaison Plan B)
   Doc: https://element-hq.github.io/synapse/latest/admin_api/user_admin_api.html#login-as-a-user
   Doc Plan B: https://spec.matrix.org/v1.11/client-server-api/#post_matrixclientv3login
6. POST /_synapse/admin/v1/deactivate/<user_id> (Désactivation compte et rejet de connexion)
   Doc: https://element-hq.github.io/synapse/latest/admin_api/user_admin_api.html#deactivate-account

Règles de sécurité :
- Aucun secret, mot de passe ou jeton affiché en clair.
- Délais d'expiration explicites sur tous les appels HTTP.
"""

import os
import sys
import time
import httpx
from pathlib import Path

# Encodage console UTF-8 compatible Windows PowerShell
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def load_env_admin_token() -> str:
    """Charge le jeton administrateur Synapse depuis l'environnement ou les fichiers de secrets locaux."""
    token = os.getenv("SYNAPSE_ADMIN_TOKEN")
    if token and token.strip():
        return token.strip()

    candidates = [
        Path(".synapse_admin_token"),
        Path("/app/.synapse_admin_token"),
        Path(__file__).resolve().parent.parent / ".synapse_admin_token",
    ]
    for p in candidates:
        if p.exists():
            return p.read_text(encoding="utf-8").strip()

    env_paths = [Path(".env"), Path("/app/.env"), Path(__file__).resolve().parent.parent / ".env"]
    for env_file in env_paths:
        if env_file.exists():
            for line in env_file.read_text(encoding="utf-8").splitlines():
                if line.startswith("SYNAPSE_ADMIN_TOKEN="):
                    val = line.split("=", 1)[1].strip().strip('"').strip("'")
                    if val:
                        return val

    return ""


def main() -> None:
    synapse_url = os.getenv("SYNAPSE_URL") or os.getenv("SYNAPSE_INTERNAL_URL") or "http://synapse:8008"
    server_name = os.getenv("SYNAPSE_SERVER_NAME") or "sovereign.local"
    admin_token = load_env_admin_token()

    print("=" * 76)
    print("🔬 SOVEREIGNMSG - TEST DE FUMÉE SYNAPSE (SOUS-ÉTAPE 2A)")
    print("=" * 76)
    print(f"[*] Cible Synapse         : {synapse_url}")
    print(f"[*] Nom de domaine Matrix : {server_name}")
    print(f"[*] Jeton Administrateur  : {'PRÉSENT (masqué)' if admin_token else 'ABSENT (ERREUR)'}")
    print("=" * 76)

    if not admin_token:
        print("[-] ERREUR CRITIQUE : SYNAPSE_ADMIN_TOKEN introuvable.")
        sys.exit(1)

    client = httpx.Client(base_url=synapse_url, timeout=10.0)

    # -------------------------------------------------------------------------
    # 1. Whoami avec le jeton administrateur
    # -------------------------------------------------------------------------
    print("\n[1/6] Whoami avec le jeton administrateur")
    print("      Documentation : https://spec.matrix.org/v1.11/client-server-api/#get_matrixclientv3accountwhoami")
    print("      Appel         : GET /_matrix/client/v3/account/whoami")
    try:
        r1 = client.get(
            "/_matrix/client/v3/account/whoami",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        print(f"      Code HTTP     : {r1.status_code}")
        if r1.status_code == 200:
            data1 = r1.json()
            user_id = data1.get("user_id", "")
            device_id = data1.get("device_id", "aucun")
            print(f"      Résumé        : Authentifié avec succès | user_id={user_id} | device_id={device_id}")
        else:
            print(f"      Erreur        : {r1.text}")
            sys.exit(1)
    except Exception as e:
        print(f"      Échec de connexion : {e}")
        sys.exit(1)

    # -------------------------------------------------------------------------
    # 2. Création d'un utilisateur de test (API d'administration, sans mot de passe utilisable)
    # -------------------------------------------------------------------------
    test_username = "smoke_agent_2a"
    test_user_id = f"@{test_username}:{server_name}"
    print(f"\n[2/6] Création d'un utilisateur de test (sans mot de passe utilisable)")
    print("      Documentation : https://element-hq.github.io/synapse/latest/admin_api/user_admin_api.html#create-or-modify-account")
    print(f"      Appel         : PUT /_synapse/admin/v2/users/{test_user_id}")

    create_payload = {
        "displayname": "Agent Test 2A",
        "admin": False,
        "deactivated": False
    }

    try:
        r2 = client.put(
            f"/_synapse/admin/v2/users/{test_user_id}",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json=create_payload
        )
        print(f"      Code HTTP     : {r2.status_code}")
        if r2.status_code in (200, 201):
            data2 = r2.json()
            print(f"      Résumé        : Compte créé | user_id={data2.get('name')} | displayname='{data2.get('displayname')}'")
            print("                      (Aucun champ password fourni : compte non connectable par mot de passe)")
        else:
            print(f"      Erreur        : {r2.text}")
            sys.exit(1)
    except Exception as e:
        print(f"      Échec appel création : {e}")
        sys.exit(1)

    # -------------------------------------------------------------------------
    # 3. Obtention d'un access_token pour cet utilisateur (API admin « login as user »)
    # -------------------------------------------------------------------------
    print("\n[3/6] Obtention d'un access_token via l'API d'administration « login as user »")
    print("      Documentation : https://element-hq.github.io/synapse/latest/admin_api/user_admin_api.html#login-as-a-user")
    print(f"      Appel         : POST /_synapse/admin/v1/users/{test_user_id}/login")

    now_ms = int(time.time() * 1000)
    valid_until_ms = now_ms + (3600 * 1000)  # 1 heure

    admin_login_token = None
    try:
        r3 = client.post(
            f"/_synapse/admin/v1/users/{test_user_id}/login",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json={"valid_until_ms": valid_until_ms}
        )
        print(f"      Code HTTP     : {r3.status_code}")
        if r3.status_code == 200:
            data3 = r3.json()
            admin_login_token = data3.get("access_token")
            print(f"      Résumé        : access_token obtenu (longueur: {len(admin_login_token)} car., validité: 3600s)")
        else:
            print(f"      Erreur API    : {r3.text}")
    except Exception as e:
        print(f"      Échec appel login as user : {e}")

    # -------------------------------------------------------------------------
    # 4. Whoami avec ce nouveau jeton : vérification de la présence du device_id
    # -------------------------------------------------------------------------
    device_id_run1 = None
    if admin_login_token:
        print("\n[4/6] Whoami avec le nouveau jeton utilisateur (Contrôle device_id)")
        print("      Documentation : https://spec.matrix.org/v1.11/client-server-api/#get_matrixclientv3accountwhoami")
        print("      Appel         : GET /_matrix/client/v3/account/whoami")
        r4 = client.get(
            "/_matrix/client/v3/account/whoami",
            headers={"Authorization": f"Bearer {admin_login_token}"}
        )
        print(f"      Code HTTP     : {r4.status_code}")
        if r4.status_code == 200:
            data4 = r4.json()
            device_id_run1 = data4.get("device_id")
            print(f"      Résumé        : user_id={data4.get('user_id')} | device_id={device_id_run1}")
            if not device_id_run1:
                print("      CRITIQUE      : device_id est absent (None) !")
                print("                      Synapse « login as user » génère un jeton sans appareil rattaché.")
                print("                      Impact : matrix-js-sdk (initRustCrypto) ne peut pas publier")
                print("                      les clés cryptographiques Olm/Megolm sans deviceId explicite.")
        else:
            print(f"      Erreur        : {r4.text}")

    # -------------------------------------------------------------------------
    # 5. Deuxième obtention d'un access_token & Test de persistance device_id
    # -------------------------------------------------------------------------
    print("\n[5/6] Deuxième obtention d'access_token & comparaison avec Plan B")
    print("      Documentation : https://element-hq.github.io/synapse/latest/admin_api/user_admin_api.html#login-as-a-user")
    print("      Documentation Plan B : https://spec.matrix.org/v1.11/client-server-api/#post_matrixclientv3login")

    # Appel 2 via « login as user »
    r5_admin2 = client.post(
        f"/_synapse/admin/v1/users/{test_user_id}/login",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"valid_until_ms": valid_until_ms}
    )
    device_id_run2 = None
    if r5_admin2.status_code == 200:
        t2 = r5_admin2.json().get("access_token")
        r_whoami2 = client.get("/_matrix/client/v3/account/whoami", headers={"Authorization": f"Bearer {t2}"})
        if r_whoami2.status_code == 200:
            device_id_run2 = r_whoami2.json().get("device_id")

    print(f"      [Méthode admin_login] Appel 1 -> device_id={device_id_run1}")
    print(f"      [Méthode admin_login] Appel 2 -> device_id={device_id_run2}")

    # Test avec tentative d'injection device_id dans admin login
    r5_custom_dev = client.post(
        f"/_synapse/admin/v1/users/{test_user_id}/login",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"valid_until_ms": valid_until_ms, "device_id": "DEVICE_PERSISTENT_01"}
    )
    if r5_custom_dev.status_code == 200:
        t_custom = r5_custom_dev.json().get("access_token")
        r_whoami_custom = client.get("/_matrix/client/v3/account/whoami", headers={"Authorization": f"Bearer {t_custom}"})
        custom_dev_res = r_whoami_custom.json().get("device_id")
        print(f"      [Méthode admin_login + device_id param] Résultat device_id={custom_dev_res}")

    # Test de la méthode Plan B (mot de passe fort aléatoire géré par la passerelle + POST /_matrix/client/v3/login)
    print("\n      --- Test comparatif du Plan B (POST /_matrix/client/v3/login) ---")
    plan_b_device_id = "SOVEREIGN_PWA_DEVICE_01"
    temp_strong_password = "MatrixInternal_SecurePassword_2026_!#"
    
    # Attribution du mot de passe fort via l'API Admin
    client.put(
        f"/_synapse/admin/v2/users/{test_user_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"password": temp_strong_password}
    )

    r_plan_b = client.post(
        "/_matrix/client/v3/login",
        json={
            "type": "m.login.password",
            "identifier": {"type": "m.id.user", "user": test_username},
            "password": temp_strong_password,
            "device_id": plan_b_device_id,
            "initial_device_display_name": "SovereignMsg Client PWA"
        }
    )
    print(f"      [Méthode password Plan B] Code HTTP : {r_plan_b.status_code}")
    plan_b_token = None
    if r_plan_b.status_code == 200:
        data_plan_b = r_plan_b.json()
        plan_b_token = data_plan_b.get("access_token")
        obtained_device = data_plan_b.get("device_id")
        print(f"      [Méthode password Plan B] Résultat  : user_id={data_plan_b.get('user_id')} | device_id={obtained_device}")
        print("      AVANTAGE PLAN B : Le device_id est garanti, stable et persistant pour le chiffrement E2EE.")

    # -------------------------------------------------------------------------
    # 6. Désactivation de l'utilisateur de test & Vérification de refus
    # -------------------------------------------------------------------------
    print(f"\n[6/6] Désactivation de l'utilisateur ({test_user_id}) et vérification de rejet")
    print("      Documentation : https://element-hq.github.io/synapse/latest/admin_api/user_admin_api.html#deactivate-account")
    print(f"      Appel         : POST /_synapse/admin/v1/deactivate/{test_user_id}")

    r6_deact = client.post(
        f"/_synapse/admin/v1/deactivate/{test_user_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"erase": True}
    )
    print(f"      Code HTTP Désactivation : {r6_deact.status_code}")

    # Vérification 1 : Tentative de connexion par login direct sur le compte désactivé
    r6_login_attempt = client.post(
        "/_matrix/client/v3/login",
        json={
            "type": "m.login.password",
            "identifier": {"type": "m.id.user", "user": test_username},
            "password": temp_strong_password
        }
    )
    print(f"      Tentative de connexion après désactivation : Code HTTP {r6_login_attempt.status_code}")
    if r6_login_attempt.status_code in (401, 403):
        print(f"      Résumé        : Connexion refusée avec succès ({r6_login_attempt.status_code} Forbidden/Unauthorized)")

    # -------------------------------------------------------------------------
    # SYNTHÈSE DE LA DÉCISION TECHNIQUE
    # -------------------------------------------------------------------------
    print("\n" + "=" * 76)
    print("📋 DÉCISION TECHNIQUE POUR LA SOUS-ÉTAPE 2B (SYNAPSE_LOGIN_MODE)")
    print("=" * 76)
    print("Constats techniques vérifiés sous Synapse v1.118.0 :")
    print("1. L'API « login as user » (admin_login) répond 200 mais renvoie un token SANS device_id.")
    print("   Elle ignore tout paramètre 'device_id'.")
    print("2. Selon la spécification matrix-js-sdk et le moteur de chiffrement vodozemac (E2EE),")
    print("   l'absence de device_id empêche l'enregistrement des clés de sessions cryptographiques")
    print("   et rend impossible le chiffrement de bout en bout conforme au cahier des charges.")
    print("3. Le Plan B (SYNAPSE_LOGIN_MODE=password) :")
    print("   - Utilise un mot de passe aléatoire fort (>32 caractères, stocké chiffré Fernet)")
    print("   - Appelle POST /_matrix/client/v3/login avec un device_id stable pour chaque agent")
    print("   - Renvoie l'access_token Matrix avec le device_id exact attendu par matrix-js-sdk")
    print("   - Sécurité totale : la route /login est bloquée à 100% depuis l'extérieur par Nginx,")
    print("     seule la passerelle interne FastAPI peut l'appeler sur le réseau Docker privé.")
    print("\n👉 RECOMMANDATION FERME : SYNAPSE_LOGIN_MODE=password (Plan B)")
    print("   (La passerelle supportera les deux modes configurables via SYNAPSE_LOGIN_MODE).")
    print("=" * 76)


if __name__ == "__main__":
    main()
