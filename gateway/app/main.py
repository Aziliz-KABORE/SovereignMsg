"""Point d'entrée principal de l'API FastAPI de la passerelle SovereignMsg."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="SovereignMsg Identity Gateway",
    description="Passerelle d'authentification forte, gestion des agents et médiation Matrix pour l'État",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Configuration CORS stricte (origine même domaine ou proxy Nginx)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://localhost", "https://127.0.0.1"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["Santé"])
def health_check() -> dict[str, str]:
    """Endpoint de santé pour Docker Compose et Nginx."""
    return {
        "status": "healthy",
        "service": "sovereignmsg-gateway",
        "stage": "step1-infrastructure",
    }
