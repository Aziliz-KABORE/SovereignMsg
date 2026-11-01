"""
SovereignMsg Gateway - Fonctions Cryptographiques & Sécurité
============================================================
Strictement conforme aux règles non négociables :
- Aucune cryptographie maison.
- Argon2id pour les mots de passe (argon2-cffi).
- Fernet (AES-128-CBC + HMAC-SHA256) pour le secret TOTP et mot de passe Matrix au repos (cryptography).
- PyOTP pour la génération et validation TOTP RFC 6238.
- PyJWT avec algorithme HS256 strict et validation de délai d'expiration.
- Hash SHA-256 pour les empreintes de jetons d'activation.
"""

import hmac
import hashlib
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError
from argon2.low_level import Type
from cryptography.fernet import Fernet
import pyotp
from app.core.config import settings

# -----------------------------------------------------------------------------
# 1. Hachage des mots de passe (Argon2id conforme OWASP / ANSSI)
# -----------------------------------------------------------------------------
# Configuration Argon2id : Type.ID, mémoire 64 Mo, 2 itérations, parallélisme 1
password_hasher = PasswordHasher(
    time_cost=2,
    memory_cost=65536,
    parallelism=1,
    hash_len=32,
    type=Type.ID
)

# Hash factice pré-calculé pour égaliser le temps de réponse (anti-énumération temporelle)
DUMMY_ARGON2_HASH = password_hasher.hash("DummyPasswordForConstantTimeCheck123!")


def hash_password(password: str) -> str:
    """Hache un mot de passe en utilisant Argon2id."""
    return password_hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Vérifie un mot de passe contre son empreinte Argon2id."""
    try:
        return password_hasher.verify(hashed_password, plain_password)
    except (VerifyMismatchError, VerificationError):
        return False
    except Exception:
        return False


def verify_dummy_password() -> None:
    """
    Exécute un calcul Argon2id factice pour égaliser le temps de réponse
    lorsqu'un utilisateur n'existe pas en base (protection anti-énumération temporelle).
    """
    try:
        password_hasher.verify(DUMMY_ARGON2_HASH, "WrongDummyPasswordAttempt123!")
    except Exception:
        pass


# -----------------------------------------------------------------------------
# 2. Chiffrement symétrique au repos (Fernet - AES-128-CBC + HMAC-SHA256)
# -----------------------------------------------------------------------------
def get_fernet() -> Fernet:
    """Initialise le chiffreur Fernet avec la clé maître configurée."""
    key = settings.FERNET_KEY.encode("utf-8")
    return Fernet(key)


def encrypt_secret(plaintext: str) -> str:
    """Chiffre une chaîne sensible au repos (secret TOTP, mot de passe Matrix)."""
    f = get_fernet()
    return f.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_secret(ciphertext: str) -> str:
    """Déchiffre une chaîne sensible au repos."""
    f = get_fernet()
    return f.decrypt(ciphertext.encode("utf-8")).decode("utf-8")


# -----------------------------------------------------------------------------
# 3. Authentification multi-facteurs TOTP (RFC 6238)
# -----------------------------------------------------------------------------
def generate_totp_secret() -> str:
    """Génère un secret TOTP aléatoire encodé en Base32 (160 bits)."""
    return pyotp.random_base32()


def get_totp_uri(secret: str, email: str, issuer: str = "SovereignMsg") -> str:
    """Génère l'URI otpauth standard pour enregistrement dans l'application d'authentification."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name=issuer)


def verify_totp_code(
    secret: str,
    code: str,
    last_step: Optional[int] = None
) -> Tuple[bool, Optional[int]]:
    """
    Vérifie un code TOTP à 6 chiffres avec tolérance d'une fenêtre de ±1 pas (±30s).
    Rejette formellement tout code appartenant à un pas temporel déjà consommé (anti-rejeu).
    
    Retourne : (succès: bool, pas_consommé: Optional[int])
    """
    if not code or len(code.strip()) != 6 or not code.strip().isdigit():
        return False, None

    code_clean = code.strip()
    totp = pyotp.TOTP(secret)
    now = datetime.now(timezone.utc)
    current_timestamp = int(now.timestamp())
    time_step = 30
    current_step = current_timestamp // time_step

    # Vérification sur la fenêtre [-1, 0, +1]
    for step_offset in (-1, 0, 1):
        target_step = current_step + step_offset
        # Protection anti-rejeu : le pas doit être strictement supérieur au dernier validé
        if last_step is not None and target_step <= last_step:
            continue

        target_time = target_step * time_step
        expected_code = totp.at(target_time)
        if hmac.compare_digest(expected_code, code_clean):
            return True, target_step

    return False, None


# -----------------------------------------------------------------------------
# 4. Jetons de session JWT Passerelle (HS256 strict)
# -----------------------------------------------------------------------------
def generate_gateway_jwt(agent_id: str, email: str, role: str) -> str:
    """
    Génère un jeton JWT court pour la passerelle.
    Algorithme fixé à HS256, clé secrète ≥ 32 octets.
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    jti = secrets.token_hex(16)

    payload = {
        "sub": str(agent_id),
        "email": email,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "jti": jti
    }

    return jwt.encode(
        payload,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM
    )


def decode_gateway_jwt(token: str) -> dict:
    """
    Décode et valide un jeton JWT de la passerelle.
    Rejette explicitement l'algorithme 'none' et vérifie l'expiration.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            options={"require": ["exp", "iat", "sub"]}
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError("Le jeton de session est expiré.")
    except jwt.InvalidTokenError as e:
        raise ValueError(f"Jeton invalide : {e}")


# -----------------------------------------------------------------------------
# 5. Empreinte SHA-256 pour jetons d'activation
# -----------------------------------------------------------------------------
def hash_token(token: str) -> str:
    """Calcule l'empreinte SHA-256 d'un jeton d'activation en hexadécimal."""
    return hashlib.sha256(token.strip().encode("utf-8")).hexdigest()


def generate_secure_token() -> str:
    """Génère un jeton aléatoire sécurisé de 32 octets URL-safe (43 caractères)."""
    return secrets.token_urlsafe(32)


def generate_matrix_password() -> str:
    """Génère un mot de passe aléatoire fort indépendant pour Synapse Matrix (≥ 32 octets)."""
    return secrets.token_urlsafe(36)
