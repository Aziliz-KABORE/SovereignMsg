# ==============================================================================
# SovereignMsg - Dockerfile Passerelle d'Identité (Python 3.12 FastAPI)
# ==============================================================================
FROM python:3.12-slim-bookworm

# Bonnes pratiques de sécurité et exécution non tamponnée
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dépendances système minimales pour compilation C si nécessaire et curl pour healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Création d'un utilisateur non-root dédié pour le principe de moindre privilège
RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -s /bin/bash -m appuser

# Installation des dépendances Python avec versions figées
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copie du code applicatif
COPY app/ ./app/

# Attribution des droits à l'utilisateur non-root
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

# Vérification d'état de santé du service passerelle
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

