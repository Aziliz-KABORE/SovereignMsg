#!/usr/bin/env python3
"""Vérification automatisée des critères d'acceptation de l'Étape 1 SovereignMsg.

Fonctionne sous Windows, Linux et macOS.
Teste les règles de sécurité Nginx, le refus d'inscription et l'isolation réseau.
"""

from pathlib import Path
import ssl
import subprocess
import sys
import urllib.error
import urllib.request

# Compatibilité console Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_DIR = Path(__file__).resolve().parent.parent

# Ignorer la vérification SSL pour les tests locaux avec certificat auto-signé
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE


def http_request(url: str, method: str = "GET", data: bytes | None = None) -> tuple[int, str]:
    """Exécute une requête HTTP(S) et retourne le code HTTP et le corps."""
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("User-Agent", "SovereignMsg-Verifier/1.0")
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=5) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as err:
        return err.code, err.read().decode("utf-8", errors="replace")
    except Exception as exc:
        return -1, str(exc)


def run_cmd(cmd: list[str]) -> tuple[int, str]:
    """Exécute une commande système."""
    try:
        res = subprocess.run(
            cmd,
            cwd=str(BASE_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            check=False,
        )
        return res.returncode, res.stdout
    except Exception as exc:
        return -1, str(exc)


def main() -> None:
    """Exécution des tests de l'étape 1."""
    print("=" * 70)
    print("   VÉRIFICATION DES CRITÈRES D'ACCEPTATION - ÉTAPE 1 (SovereignMsg)")
    print("=" * 70)

    total = 0
    passed = 0

    def check(name: str, condition: bool, detail: str) -> None:
        nonlocal total, passed
        total += 1
        if condition:
            passed += 1
            print(f"  [+] [PASS] {name} : {detail}")
        else:
            print(f"  [-] [FAIL] {name} : {detail}")

    # 1. Vérification Nginx HTTPS répond
    print("\n--- 1. Port 443 HTTPS actif ---")
    status, _ = http_request("https://127.0.0.1:443/")
    check("Port 443 HTTPS", status in (200, 304), f"Code HTTP {status}")

    # 2. Vérification des routes de connexion bloquées
    print("\n--- 2. Blocage Nginx des routes Matrix directes depuis l'extérieur ---")

    endpoints_to_block = [
        ("POST", "https://127.0.0.1:443/_matrix/client/v3/login", b'{"user":"test"}'),
        ("POST", "https://127.0.0.1:443/_matrix/client/r0/login", b'{"user":"test"}'),
        ("POST", "https://127.0.0.1:443/_matrix/client/unstable/login", b'{"user":"test"}'),
        ("POST", "https://127.0.0.1:443/_matrix/client/v3/register", b'{"user":"test"}'),
        ("GET", "https://127.0.0.1:443/_synapse/admin/v1/users", None),
    ]

    for method, url, body in endpoints_to_block:
        path = url.split("443")[-1]
        code, _ = http_request(url, method=method, data=body)
        check(f"Blocage {method} {path}", code in (403, 404), f"Code HTTP {code} (Attendu 403 ou 404)")

    # 3. Vérification des routes légitimes autorisées via Nginx
    print("\n--- 3. Routes Matrix légitimes autorisées ---")
    code, _ = http_request("https://127.0.0.1:443/_matrix/client/versions")
    check("Accès /_matrix/client/versions", code == 200, f"Code HTTP {code}")

    # 4. Vérification appel administration interne depuis le conteneur passerelle
    print("\n--- 4. Appel d'administration interne depuis le conteneur passerelle ---")
    token_file = BASE_DIR / ".synapse_admin_token"
    if token_file.exists():
        admin_token = token_file.read_text(encoding="utf-8").strip()
        cmd = [
            "docker", "compose", "exec", "-T", "gateway",
            "curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
            "-H", f"Authorization: Bearer {admin_token}",
            "http://synapse:8008/_synapse/admin/v1/users"
        ]
        rc, out = run_cmd(cmd)
        status_code = out.strip()
        check(
            "Appel Synapse Admin interne depuis gateway",
            status_code == "200",
            f"Code HTTP {status_code}"
        )
    else:
        print("  [!] Fichier .synapse_admin_token absent. Lancez scripts/bootstrap_admin.py d'abord.")

    print("\n" + "=" * 70)
    print(f"Résultat : {passed}/{total} tests validés.")
    print("=" * 70)
    if passed < total:
        sys.exit(1)


if __name__ == "__main__":
    main()

