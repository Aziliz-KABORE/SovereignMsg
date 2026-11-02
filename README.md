# SovereignMsg

Messagerie instantanée souveraine pour l'administration publique burkinabè.
Projet du Sprint technique pré-hackathon 2026 (Hackathon 226, MTDPCE – DGTD).
Licence : Apache 2.0 (voir `LICENSE`). Les dépendances du client (matrix-js-sdk, vodozemac) sont sous Apache 2.0 ; Synapse (AGPL-3.0) tourne comme service distinct, non modifié.

## Concept

SovereignMsg permet aux agents de l'administration d'échanger messages, groupes et fichiers avec un chiffrement de bout en bout, sur un serveur maîtrisé par l'État. Seuls les agents enrôlés par un administrateur peuvent se connecter (mot de passe + code TOTP). Un agent révoqué perd l'accès sur tous ses appareils.

## Note sur Synapse

Le serveur de messagerie utilisé est **Matrix Synapse**, logiciel libre (AGPL-3.0) installé et exploité par l'administration elle-même. Ce n'est **pas un service commercial ou hébergé**. Le chiffrement de bout en bout (Olm / Megolm, bibliothèque vodozemac) est activé par défaut pour tous les salons ; le serveur ne stocke que du texte chiffré. La fédération avec d'autres serveurs est désactivée et aucun service tiers n'est nécessaire.

## Architecture

```
Navigateur (React) --HTTPS/WSS, texte chiffré--> Nginx (TLS)
                                                  ├── /api      -> Passerelle d'identité (FastAPI)
                                                  └── /_matrix  -> Synapse
Passerelle --API d'administration (interne)--> Synapse
Passerelle, Synapse --> PostgreSQL (deux bases)
```

- **Client** : application web progressive (PWA), un seul code pour les ordinateurs et les téléphones, installable sans magasin d'applications (aucune dépendance à Google ou Apple) ; elle chiffre et déchiffre dans le navigateur, clés privées stockées localement.
- **Passerelle d'identité** : enrôlement, Argon2id, TOTP, rôles, journal d'audit, révocation.
- **Synapse** : achemine et stocke uniquement des événements chiffrés.
- **Accès à Synapse** : la passerelle est la seule porte d'entrée. Nginx bloque depuis l'extérieur `/_synapse/admin`, `/_matrix/client/*/login` et `/_matrix/client/*/register` ; seule la passerelle, sur le réseau Docker interne, appelle l'API d'administration de Synapse. Un appel direct depuis l'extérieur reçoit un refus (403 ou 404).

## Technologies et licences

| Composant | Rôle | Licence | Lien |
|---|---|---|---|
| React + TypeScript (Vite) | Interface | MIT | https://react.dev |
| matrix-js-sdk | Protocole Matrix (client) | Apache 2.0 | https://github.com/matrix-org/matrix-js-sdk |
| vodozemac | Chiffrement Olm / Megolm | Apache 2.0 | https://github.com/matrix-org/vodozemac |
| FastAPI (Python) | Passerelle d'identité | MIT | https://fastapi.tiangolo.com |
| argon2-cffi | Hachage des mots de passe | MIT | https://github.com/hynek/argon2-cffi |
| pyotp | Codes TOTP | MIT | https://github.com/pyauth/pyotp |
| Synapse | Serveur Matrix | AGPL-3.0 | https://github.com/element-hq/synapse |
| PostgreSQL | Bases de données | Licence PostgreSQL | https://www.postgresql.org |
| Nginx | Proxy inverse, TLS | BSD-2-Clause | https://nginx.org |
| Docker / Compose | Déploiement | Apache 2.0 | https://www.docker.com |

*Licences de matrix-js-sdk et vodozemac vérifiées le 1er novembre 2026 dans les dépôts d'origine ; versions figées par les fichiers de verrouillage.*

## Niveau d'engagement open source

**Créer** : application nouvelle (client et passerelle) reposant sur des bibliothèques éprouvées. Aucune cryptographie n'est développée par l'équipe.

---

## Installation et Démarrage

### Prérequis

- **Docker Desktop** (Windows/macOS) ou **Docker Engine + Docker Compose** (Linux)
- Git
- 4 Go de RAM disponibles (Synapse + 2× PostgreSQL + Gateway + Nginx)

### 1. Cloner le dépôt

```bash
git clone https://github.com/votre-organisation/SovereignMsg.git
cd SovereignMsg
```

### 2. Configurer les variables d'environnement

```bash
cp .env.example .env
# Éditer .env : remplacer tous les CHANGEME par des valeurs réelles.
# Pour une démonstration rapide, les valeurs par défaut de docker-compose.yml fonctionnent.
```

### 3. Générer les certificats TLS de développement

```bash
python scripts/generate_certs.py
# ou, sous PowerShell :
powershell -ExecutionPolicy Bypass -File scripts/generate_certs.ps1
```

### 4. Lancer la pile complète

```bash
docker compose up -d
```

Vérifier que les 5 conteneurs sont sains :

```bash
docker ps
# sovereign-nginx         → Up (443/tcp)
# sovereign-gateway       → Up (healthy)
# sovereign-synapse       → Up (healthy)
# sovereign-postgres-synapse   → Up (healthy)
# sovereign-postgres-gateway   → Up (healthy)
```

### 5. Amorcer l'administrateur Synapse et les comptes de démonstration

```bash
# Créer le compte admin Synapse et obtenir le token d'administration
python scripts/bootstrap_admin.py

# Créer les comptes de démonstration (Admin, Agent A, B, C)
docker exec -w /app -e PYTHONPATH=/app sovereign-gateway python scripts/seed_demo_agents.py
```

### 6. Accéder à l'application

Ouvrir **https://localhost/connexion** dans le navigateur.

> ⚠️ **Certificat auto-signé** : le navigateur affichera un avertissement TLS.
> Cliquer sur « Paramètres avancés » → « Continuer vers localhost ».

> 💡 **Service Worker PWA** : pour activer la PWA sur localhost avec un certificat auto-signé, aller dans `chrome://flags/#allow-insecure-localhost` et passer à « Enabled », puis relancer le navigateur.

---

## Connexion et code TOTP

Les identifiants sont remis individuellement lors de l'enrôlement. Configurez le code TOTP en scannant le QR code fourni à l'activation. Les secrets TOTP ne sont pas publiés dans la documentation.

---

## Fonctionnalités implémentées

### ✅ Authentification et sécurité (Étape 2 + Préalables)

- **Enrôlement (P15)** : l'administrateur crée un agent, reçoit un jeton d'activation à usage unique (48h).
- **Activation (P03)** : l'agent choisit son mot de passe (≥ 12 caractères), scanne un QR Code TOTP, confirme avec un code à 6 chiffres. Le compte Matrix est provisionné automatiquement.
- **Connexion (P01)** : authentification multi-facteurs (Argon2id + TOTP anti-rejeu). Message d'erreur unique anti-énumération. Calcul cryptographique factice pour les comptes inexistants (même délai de réponse).
- **Verrouillage automatique** : après 5 échecs consécutifs, le compte est verrouillé 15 minutes.
- **Session sécurisée** : JWT signé (HS256, 15 min), relecture du statut en base à chaque requête. Un agent révoqué est immédiatement bloqué même avec un JWT valide.

### ✅ Administration (Étape 3)

- **Tableau de bord (P13)** : statistiques globales (total, actifs, en attente, révoqués, par rôle).
- **Liste des agents (P14)** : tableau avec recherche, filtres par statut, rôle.
- **Fiche agent (P16)** : détail, modification de rôle, révocation avec confirmation modale.
- **Journal d'audit (P17)** : piste d'audit infalsifiable (chaînage SHA-256), export CSV, vérification cryptographique de la chaîne.

### ✅ Groupes et révocation (BLOC 1)

- **Création de groupe (P07)** : salon multi-membres chiffré (m.megolm.v1.aes-sha2 dans l'état initial). Seuls les agents actifs peuvent être invités ; les comptes inconnus, en attente ou révoqués sont refusés.
- **Révocation effective** : désactivation Synapse via `POST /_synapse/admin/v1/deactivate/{user_id}` (comportement confirmé Synapse v1.118.0 : retrait automatique de tous les salons, suppression des tokens et clés E2EE, rotation Megolm automatique).
- **Gestion d'échec** : si Synapse ne répond pas, statut `revocation_incomplete` enregistré (pas de faux succès), opération réessayable et idempotente.
- **Protocole B.2 validé** : test de bout en bout sur pile Docker réelle avec 3 comptes (A, B, C).

### ✅ Interface web (Design CSS pur)

- Design institutionnel sobre (bleu foncé, vert discret, blanc/gris clair).
- CSS pur dans un fichier unique (`index.css`) avec variables CSS, compatible CSP stricte (aucun style en ligne).
- Responsive : 2 colonnes sur ordinateur, 1 colonne sur téléphone (≥ 360 px).
- Contrastes AA, boutons ≥ 44 px, texte ≥ 16 px.
- PWA avec Service Worker (mode hors-ligne pour les assets statiques).

### ✅ Infrastructure

- Nginx (TLS 1.2+, HSTS, en-têtes de sécurité), proxy inverse unique sur le port 443.
- Deux instances PostgreSQL isolées (Synapse et Gateway).
- Synapse v1.118.0 (fédération désactivée, enregistrement public désactivé).
- Docker Compose : 5 conteneurs avec health checks, redémarrage automatique.

---

## Fonctionnalités NON implémentées (sacrifiées par manque de temps)

| Fonctionnalité | Priorité | Raison |
|---|---|---|
| **Fichiers chiffrés (BLOC 2)** | Haute | Nécessite matrix-encrypt-attachment + tests E2E |
| **Message Confidentiel (BLOC 3)** | Moyenne | Étiquette, expiration, transfert bloqué, filigrane |
| **i18n Mooré** | Basse | Traduction des chaînes de l'interface |
| **Service Worker avancé** | Basse | Push notifications, sync en arrière-plan |
| **Tests de bout en bout Playwright** | Moyenne | Automatisation des scénarios navigateur |

---

## Tests

### Backend (Gateway) — 33 tests pytest

```bash
cd gateway
python -m pytest tests/ -q
```

### Frontend (Client) — 29 tests Vitest

```bash
cd client
npm run test
```

### Vérification TypeScript

```bash
cd client
npx tsc --noEmit
```

### Test sur pile Docker réelle (Protocole B.2)

```bash
docker exec -w /app -e PYTHONPATH=/app sovereign-gateway python scripts/test_protocole_b2.py
```

---

## Structure du projet

```
SovereignMsg/
├── client/                    # Application React PWA (TypeScript, Vite)
│   ├── src/
│   │   ├── components/        # Composants réutilisables (InputField, Button, AdminLayout)
│   │   ├── pages/             # Pages (P01 Login, P03 Activation, P04/P05 Chat, P13-P17 Admin)
│   │   ├── services/          # api.ts (HTTP), matrixService.ts (Matrix SDK)
│   │   ├── store/             # authStore (Zustand)
│   │   ├── test/              # Tests Vitest (29 tests)
│   │   └── index.css          # Design CSS pur avec variables
│   └── vite.config.ts
├── gateway/                   # Passerelle d'identité FastAPI (Python)
│   ├── app/
│   │   ├── api/routes/        # auth.py, admin.py (groupes P07 inclus)
│   │   ├── core/              # config, security, audit, synapse_client, database
│   │   ├── models/            # SQLAlchemy (Agent, ActivationToken, AuditEntry)
│   │   └── schemas/           # Pydantic v2 (validation stricte)
│   └── tests/                 # Tests pytest (33 tests)
├── deploy/
│   ├── nginx/                 # nginx.conf (TLS, proxy, CSP, assets)
│   └── synapse/               # homeserver.yaml (Synapse v1.118.0)
├── scripts/
│   ├── bootstrap_admin.py     # Amorçage du compte admin Synapse
│   ├── seed_demo_agents.py    # Création des comptes de démonstration
│   ├── test_protocole_b2.py   # Test E2E sur pile Docker
│   └── generate_certs.py      # Certificats TLS de développement
├── docs/
│   ├── NOTE_PRE_PROJET.md     # Note de pré-projet officielle (Hackathon 226)
│   ├── NOTE_SECURITE.md       # Note de sécurité officielle (Hackathon 226)
│   ├── SECURITY.md            # Dossier détaillé d'analyse de sécurité
│   ├── ARCHITECTURE.md        # Architecture globale et flux réseau
│   ├── DEPLOYMENT.md          # Guide de déploiement et d'amorçage
│   ├── DEMO_SCRIPT.md         # Script de démonstration vidéo (3 min)
│   ├── Note_de_pre-projet_SovereignMsg.pdf
│   └── Note_de_securite_SovereignMsg.pdf
├── docker-compose.yml
├── .env.example
└── README.md
```

## Limites connues

- Le serveur voit des métadonnées : comptes, appartenance aux groupes, dates, tailles, noms de groupes.
- Les messages déjà déchiffrés sur un appareil avant révocation y restent lisibles.
- Un navigateur ne peut pas empêcher une capture d'écran : le niveau « Confidentiel » est dissuasif (filigrane, flou, expiration).
- Le transfert de fichiers chiffrés n'est pas implémenté dans cette version.
- L'interface est en français uniquement (pas de traduction Mooré).

## Équipe

Équipe Kadem – Hackathon 226 – DGTD / MTDPCE
