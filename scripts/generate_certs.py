#!/usr/bin/env python3
"""Génération multiplateforme de certificats TLS X.509 pour la démonstration SovereignMsg.

Utilise la bibliothèque cryptography standard (pas besoin d'openssl dans le PATH).
Génère une clé RSA 4096 bits et un certificat X.509 v3 avec Subject Alternative Names (SAN).
"""

from datetime import datetime, timedelta, timezone
import ipaddress
from pathlib import Path
import sys

# Compatibilité encodage console Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from cryptography import x509
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID


def generate_self_signed_cert() -> None:
    """Génère la clé privée et le certificat auto-signé dans deploy/nginx/certs/."""
    base_dir = Path(__file__).resolve().parent.parent
    certs_dir = base_dir / "deploy" / "nginx" / "certs"
    certs_dir.mkdir(parents=True, exist_ok=True)

    key_path = certs_dir / "server.key"
    crt_path = certs_dir / "server.crt"

    print("[*] [SovereignMsg] Generation de la paire de cles RSA 4096 bits...")
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=4096,
        backend=default_backend(),
    )

    print("[*] [SovereignMsg] Creation du certificat X.509 v3...")
    subject = issuer = x509.Name(
        [
            x509.NameAttribute(NameOID.COUNTRY_NAME, "BF"),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "Kadiogo"),
            x509.NameAttribute(NameOID.LOCALITY_NAME, "Ouagadougou"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "MTDPCE-DGTD"),
            x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, "Securite-Souveraine"),
            x509.NameAttribute(NameOID.COMMON_NAME, "sovereign.local"),
        ]
    )

    now = datetime.now(timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(private_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now)
        .not_valid_after(now + timedelta(days=365))
        .add_extension(
            x509.SubjectAlternativeName(
                [
                    x509.DNSName("localhost"),
                    x509.DNSName("sovereign.local"),
                    x509.DNSName("sovereignmsg.local"),
                    x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
                ]
            ),
            critical=False,
        )
        .add_extension(
            x509.BasicConstraints(ca=False, path_length=None),
            critical=True,
        )
        .sign(private_key, hashes.SHA256(), default_backend())
    )

    # Écriture de la clé privée sans mot de passe pour Nginx
    with open(key_path, "wb") as f:
        f.write(
            private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption(),
            )
        )

    # Écriture du certificat public
    with open(crt_path, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))

    print("[+] Certificats generes avec succes :")
    print(f"   - Cle privee : {key_path}")
    print(f"   - Certificat : {crt_path}")


if __name__ == "__main__":
    generate_self_signed_cert()
