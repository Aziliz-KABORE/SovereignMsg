"""
SovereignMsg Gateway - Modèles de données SQLAlchemy 2.x
========================================================
Modèles Agent, ActivationToken et AuditEntry avec chaînage cryptographique SHA-256.
Types compatibles PostgreSQL et SQLite (sqlalchemy.Uuid, sqlalchemy.DateTime).
"""

import uuid
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Boolean,
    Integer,
    DateTime,
    Text,
    ForeignKey,
    Uuid,
    func
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class Agent(Base):
    """
    Modèle représentant un agent de l'administration.
    Tous les secrets au repos sont chiffrés (Fernet) ou hachés (Argon2id).
    """
    __tablename__ = "agents"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # L'identifiant Matrix est dérivé de l'UUID pour ne jamais divulguer l'e-mail dans Matrix
    matrix_user_id = Column(String(255), unique=True, nullable=False, index=True)
    nom = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)

    # Rôles autorisés : 'admin', 'agent', 'invite', 'rssi'
    role = Column(String(50), nullable=False, default="agent")

    # Statuts autorisés : 'en_attente', 'actif', 'revoque'
    statut = Column(String(50), nullable=False, default="en_attente")

    # Empreinte du mot de passe agent haché par Argon2id (jamais en clair)
    mot_de_passe_hash = Column(String(255), nullable=True)

    # Secret TOTP chiffré par Fernet au repos
    totp_secret_chiffre = Column(Text, nullable=True)

    # Dernier pas temporel TOTP validé pour prévenir le rejeu de code
    totp_dernier_pas = Column(Integer, nullable=True)

    # Mot de passe Matrix aléatoire fort (>32 car.) chiffré par Fernet au repos (Plan B)
    matrix_password_chiffre = Column(Text, nullable=True)

    # Compteur d'échecs consécutifs pour verrouillage anti-brute force
    echecs_connexion = Column(Integer, nullable=False, default=0)
    verrouille_jusqua = Column(DateTime(timezone=True), nullable=True)

    # Traçabilité
    date_creation = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    date_revocation = Column(DateTime(timezone=True), nullable=True)

    # Relations
    activation_tokens = relationship("ActivationToken", back_populates="agent", cascade="all, delete-orphan")


class ActivationToken(Base):
    """
    Jeton d'enrôlement et d'activation à usage unique.
    Seule l'empreinte SHA-256 du jeton est stockée en base (jamais le jeton en clair).
    """
    __tablename__ = "activation_tokens"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(Uuid(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)

    # Empreinte SHA-256 hexadécimale (64 caractères)
    empreinte_jeton = Column(String(64), unique=True, nullable=False, index=True)
    expiration = Column(DateTime(timezone=True), nullable=False)
    utilise = Column(Boolean, nullable=False, default=False)
    date_creation = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    agent = relationship("Agent", back_populates="activation_tokens")


class AuditEntry(Base):
    """
    Piste d'audit à chaînage cryptographique SHA-256 infalsifiable.
    Chaque maillon intègre l'empreinte du maillon précédent et ses propres données canoniques.
    """
    __tablename__ = "audit_entries"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    horodatage = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    acteur = Column(String(255), nullable=False)       # Identifiant ou 'system'
    action = Column(String(100), nullable=False)       # Ex: 'LOGIN_SUCCESS', 'ACTIVATION_INIT'
    cible = Column(String(255), nullable=False)        # Identifiant de la ressource ou email masqué
    detail = Column(Text, nullable=False)              # JSON ou description sans secret
    hash_precedent = Column(String(64), nullable=False) # Hash de l'entrée n-1
    hash = Column(String(64), nullable=False)          # Hash SHA-256 du maillon courant
