# SovereignMsg - Guide de Déploiement et d'Amorçage (Étape 1)

Ce guide détaille la mise en service de la pile d'infrastructure et l'exécution des tests de vérification.

---

## 1. Prérequis
- Docker Desktop ou Docker Engine version 24+ avec le plugin Docker Compose.
- Python 3.12+ (ou accès aux scripts bash sous Linux/WSL).
- Git.

---

## 2. Procédure Pas-à-Pas

### Étape 2.1 : Configuration des variables d'environnement
Copiez le modèle `.env.example` vers `.env` et personnalisez les mots de passe et clés secrètes :
```bash
cp .env.example .env
```

### Étape 2.2 : Génération des certificats TLS de démonstration
Générez la paire clé/certificat pour Nginx :
- Sous Linux / macOS :
  ```bash
  chmod +x scripts/*.sh
  ./scripts/generate_certs.sh
  ```
- Sous Windows (PowerShell ou Python) :
  ```powershell
  python scripts/generate_certs.py
  ```

Les fichiers `server.key` et `server.crt` sont créés dans `deploy/nginx/certs/`.

### Étape 2.3 : Démarrage de la pile Docker Compose
Lancez l'ensemble des conteneurs en tâche de fond :
```bash
docker compose up -d --build
```
Vérifiez que tous les services sont opérationnels :
```bash
docker compose ps
```

### Étape 2.4 : Amorçage de l'administrateur Synapse
Exécutez le script d'amorçage pour créer l'utilisateur administrateur technique Matrix et récupérer son jeton :
- Sous Linux :
  ```bash
  ./scripts/bootstrap_admin.sh
  ```
- Sous Windows / multiplateforme :
  ```powershell
  python scripts/bootstrap_admin.py
  ```

### Étape 2.5 : Exécution des tests de vérification des critères d'acceptation
Validez automatiquement que l'ensemble des critères d'acceptation de l'Étape 1 sont satisfaits :
- Sous Linux :
  ```bash
  ./scripts/verify_step1.sh
  ```
- Sous Windows / multiplateforme :
  ```powershell
  python scripts/verify_step1.py
  ```

---

## 3. Accès aux Interfaces et Services

- **Application Web (Client PWA) :** `https://localhost/`
- **Passerelle d'Identité (Health) :** `https://localhost/api/health`
- **Documentation API (Swagger) :** `https://localhost/api/docs`
- **Matrix Versions publiques :** `https://localhost/_matrix/client/versions`

