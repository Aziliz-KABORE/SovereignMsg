"""
SovereignMsg Gateway - Configuration de la base de données
==========================================================
Session SQLAlchemy 2.x, gestion du pool de connexions et initialisation des tables.
"""

from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.pool import StaticPool
from app.core.config import settings

# Sélection du type de pool selon le moteur de base de données
database_url = settings.DATABASE_URL if settings else "sqlite:///:memory:"

if database_url.startswith("sqlite"):
    engine = create_engine(
        database_url,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
else:
    engine = create_engine(
        database_url,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Dépendance FastAPI pour obtenir une session de base de données par requête."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Crée toutes les tables si elles n'existent pas encore."""
    import app.models.models  # Import des modèles pour enregistrement auprès de Base
    Base.metadata.create_all(bind=engine)
