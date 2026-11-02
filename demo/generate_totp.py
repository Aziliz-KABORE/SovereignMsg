"""Print the current admin TOTP without exposing its stored seed."""

import os
import re
import subprocess
import sys


CONTAINER = os.environ.get("GATEWAY_CONTAINER", "sovereign-gateway")
ADMIN_EMAIL = os.environ.get("DEMO_ADMIN_EMAIL", "admin@gouv.bf")

PYTHON_CODE = r"""
import pyotp
from app.core.database import SessionLocal
from app.core.security import decrypt_secret
from app.models.models import Agent

db = SessionLocal()
try:
    agent = db.query(Agent).filter(Agent.email == %r).first()
    if not agent or agent.statut != "actif" or not agent.totp_secret_chiffre:
        raise SystemExit("No active TOTP seed found")
    print(pyotp.TOTP(decrypt_secret(agent.totp_secret_chiffre)).now())
finally:
    db.close()
""" % ADMIN_EMAIL


def main() -> int:
    try:
        result = subprocess.run(
            ["docker", "exec", CONTAINER, "python", "-c", PYTHON_CODE],
            check=True,
            capture_output=True,
            text=True,
        )
    except (OSError, subprocess.CalledProcessError):
        print("Could not generate the demo TOTP. Check Docker and the gateway account.", file=sys.stderr)
        return 1

    code = result.stdout.strip()
    if not re.fullmatch(r"\d{6}", code):
        print("The gateway did not return a six digit TOTP.", file=sys.stderr)
        return 1

    print(code)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
