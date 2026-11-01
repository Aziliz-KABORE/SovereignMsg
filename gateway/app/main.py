"""
SovereignMsg Gateway - Point d'entrée principal FastAPI
======================================================
Passerelle d'identité souveraine pour l'administration burkinabè (Hackathon 226).
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db
from app.api.routes.auth import router as auth_router
from app.api.routes.admin import router as admin_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialisation de la base de données au démarrage
    init_db()
    yield


app = FastAPI(
    title="SovereignMsg Gateway",
    description="Passerelle d'identité et de médiation sécurisée pour la messagerie instantanée souveraine",
    version="1.0.0",
    docs_url="/api/docs" if settings and settings.ENVIRONMENT != "production" else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if settings and settings.ENVIRONMENT != "production" else None,
    lifespan=lifespan
)

# Configuration CORS stricte
allowed_origins = [
    "https://localhost",
    "https://127.0.0.1",
    f"https://{settings.DOMAIN_NAME if settings else 'sovereign.local'}"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Device-Id"],
)

# Enregistrement des routeurs d'API
app.include_router(auth_router)
app.include_router(admin_router)


@app.get("/api/health", status_code=status.HTTP_200_OK, tags=["Santé"])
def health_check():
    """Point de contrôle de santé pour Docker et Nginx."""
    return {
        "status": "healthy",
        "service": "sovereignmsg-gateway",
        "login_mode": settings.SYNAPSE_LOGIN_MODE if settings else "password"
    }
