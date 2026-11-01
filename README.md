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

## Installation

```bash
docker compose up -d
```

Accès : `https://localhost` (certificat de démonstration). Les comptes de démonstration ci-dessous sont créés au premier démarrage.

Comptes fictifs de démonstration (données fictives uniquement) :

| Rôle | Identifiant | Mot de passe | TOTP |
|---|---|---|---|
| Administrateur | `admin@demo.local` | `AdminDemo2026!` | `TTTOLSBGBWSADT2QOBAM6FHIV6OI36WW` |
| Agent A | `agent.a@demo.local` | `AgentADemo2026!` | `22YEXADY2UVY3USLBBQKCFDVVLU7P4I7` |
| Agent B | `agent.b@demo.local` | `AgentBDemo2026!` | `ZYJR464FNXZ6G6MFYDGDVR7QM2TFVFC5` |
| Compte non enrôlé (test « Intrus ») | `intrus@demo.local` | — | — |

Les secrets TOTP sont à saisir dans une application d'authentification (codes à 6 chiffres, 30 s). Ces comptes et secrets sont fictifs et n'existent que dans l'environnement de démonstration.

## Limites connues

- Le serveur voit des métadonnées : comptes, appartenance aux groupes, dates, tailles, noms de groupes.
- Les messages déjà déchiffrés sur un appareil avant révocation y restent lisibles.
- Un navigateur ne peut pas empêcher une capture d'écran : le niveau « Confidentiel » est dissuasif (filigrane, flou, expiration).

## Équipe

Équipe Hackathon 226 – DGTD / MTDPCE
