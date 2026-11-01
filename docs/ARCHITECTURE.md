# SovereignMsg - Architecture Technique

## 1. Contexte et Objectifs
**SovereignMsg** est une solution de messagerie instantanée souveraine conçue pour l'administration publique burkinabè (Hackathon 226, MTDPCE/DGTD).
Elle garantit :
- L'hébergement étatique exclusif (sur infrastructure nationale ou locale contrôlée).
- Le chiffrement de bout en bout (E2EE) côté client : le serveur ne voit jamais le contenu des messages ou fichiers.
- Une authentification forte des agents (Argon2id + TOTP au repos chiffré Fernet).
- Une défense en profondeur avec segmentation réseau stricte.

---

## 2. Diagramme d'Architecture Globale

```text
               EXTÉRIEUR (Internet / Réseau Inter-ministériel)
                                     │
                                     │ HTTPS (Port 443 UNIQUEMENT)
                                     ▼
                    ┌─────────────────────────────────┐
                    │       Reverse Proxy Nginx       │
                    │  (TLS durci, CSP, HSTS, Wasm)   │
                    │   Blocage direct Matrix Auth    │
                    └───────┬─────────────────┬───────┘
                            │                 │
     /_matrix/client/sync   │                 │ /api/auth/login
     /_matrix/client/keys   │                 │ /api/auth/activation
                            ▼                 ▼
             ┌─────────────────────┐   ┌────────────────────────┐
             │   Matrix Synapse    │   │  Passerelle d'Identité │
             │  (v1.118.0 Docker)  │◄──┤    FastAPI (gateway)   │
             │   Port 8008 interne │   │   Port 8000 interne    │
             └──────────┬──────────┘   └───────────┬────────────┘
                        │                          │
                        ▼                          ▼
             ┌─────────────────────┐   ┌────────────────────────┐
             │  PostgreSQL Synapse │   │   PostgreSQL Gateway   │
             │  (UTF-8 / Collat. C)│   │  (Base agents & audit) │
             └─────────────────────┘   └────────────────────────┘
```

---

## 3. Matrice des Rôles et des Flux Réseau

| Service | Port Interne | Port Externe | Exposition | Dépendance |
| :--- | :---: | :---: | :---: | :--- |
| **Nginx** | 443 | **443** | **Publique** (seul port autorisé) | `gateway`, `synapse` |
| **Gateway** | 8000 | Aucun | Interne (`sovereign_internal`) | `postgres-gateway`, `synapse` |
| **Synapse** | 8008 | Aucun | Interne (`sovereign_internal`) | `postgres-synapse` |
| **Postgres Synapse** | 5432 | Aucun | Interne (`sovereign_internal`) | Aucune |
| **Postgres Gateway** | 5432 | Aucun | Interne (`sovereign_internal`) | Aucune |

---

## 4. Spécificités des Bases de Données
Conformément aux préconisations d'architecture :
1. **Deux instances PostgreSQL distinctes et isolées** :
   - L'instance Synapse héberge les événements signés et chiffrés Matrix.
   - L'instance Gateway héberge les fiches agents, les métadonnées de sessions, les secrets TOTP chiffrés et la piste d'audit inviolable.
2. **PostgreSQL Synapse** est initialisé avec `--encoding=UTF-8 --lc-collate=C --lc-ctype=C` comme exigé par Synapse pour garantir l'intégrité du tri et des index d'événements.



---

## 5. Documents de Référence Associés
- [Note de Pré-projet (Hackathon 226)](NOTE_PRE_PROJET.md) : Vision, protocole Matrix, tableau comparatif des licences open source, répartition des rôles (Équipe Kadem).
- [Note de Sécurité (Hackathon 226)](NOTE_SECURITE.md) : Matrice formelle des menaces, hypothèses de confiance et métadonnées visibles.
- [Dossier d'Analyse de Sécurité Approfondi](SECURITY.md) : Modélisation des attaques, protocole B.2 et preuves de validation.
- [Script de Démonstration Vidéo](DEMO_SCRIPT.md) : Déroulé chronométré en 3 minutes.
- [Guide de Déploiement](DEPLOYMENT.md) : Amorçage et démarrage de la pile conteneurisée.
