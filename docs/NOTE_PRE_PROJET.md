# NOTE DE PRÉ-PROJET – SovereignMsg

**Ministère de la Transition Digitale, des Postes et des Communications Électroniques (MTDPCE)**  
**Direction Générale de la Transition Digitale (DGTD)**  
**HACKATHON 226 – ÉDITION 2026 · SPRINT TECHNIQUE PRÉ-HACKATHON**  
*« Solutions open source endogènes » – Challenge : La messagerie souveraine de l'administration*  
*Projet : SovereignMsg – Messagerie instantanée souveraine de l'administration publique burkinabè*

---

## Informations Équipe

| Équipe | Kadem |
| :--- | :--- |
| **Université** | [Université] |

| Membre | Nom et prénom | Filière et niveau | Contact (e-mail, téléphone) |
| :--- | :--- | :--- | :--- |
| **Membre 1** | [Nom Prénom] | [Filière – Niveau] | [e-mail – téléphone] |
| **Membre 2** | [Nom Prénom] | [Filière – Niveau] | [e-mail – téléphone] |

---

## 1. Concept et Vision

**SovereignMsg** est une messagerie instantanée pour les agents de l'administration publique burkinabè. Elle remplace les applications grand public (WhatsApp, Telegram) dont les serveurs et les règles échappent à l'État.

Trois piliers fondamentaux :
1. **Confidentialité** : Chiffrement de bout en bout (le serveur ne lit jamais les messages).
2. **Souveraineté** : Hébergement exclusif sur l'infrastructure de l'État, déployable en une seule commande Docker Compose, aucun service tiers externe ni dépendance aux GAFAM.
3. **Contrôle administratif** : Enrôlement strict par un administrateur, second facteur TOTP obligatoire, gestion granulaire des rôles, et révocation immédiate avec révocation des sessions.

C'est une **application web progressive (PWA)** : un socle de code unique pour ordinateur et téléphone, installable sans dépendance à une boutique d'applications (Google Play Store ou Apple App Store).

---

## 2. Architecture Technique

Architecture **« zéro confiance envers le serveur »** :
- Le serveur n'achemine et ne stocke que du texte chiffré ; le chiffrement et le déchiffrement s'opèrent exclusivement dans le navigateur où résident les clés privées.
- **Seul le port 443 est exposé** vers l'extérieur.
- Le proxy inverse Nginx bloque depuis l'extérieur les routes d'administration de Synapse (`/_synapse/admin`) ainsi que les routes Matrix directes de connexion et d'inscription (`/_matrix/client/*/login`, `/_matrix/client/*/register`).
- Seule la passerelle FastAPI (enrôlement, TOTP, rôles, audit, révocation), hébergée sur le réseau interne isolé Docker, peut les invoquer.
- La fédération Matrix est formellement désactivée.

```text
 ┌────────────────────────────────────────────────────────┐
 │            POSTE DE L'AGENT (navigateur web)           │
 │                                                        │
 │   ┌───────────────────────┐  ┌───────────────────────┐ │
 │   │     Interface React   │  │ Module de chiffrement │ │
 │   │ (TypeScript, français,│  │   bibliothèque Matrix │ │
 │   │    mooré / dioula)    │  │     (Olm / Megolm,    │ │
 │   └───────────┬───────────┘  │   vodozemac en WASM)  │ │
 │               │              └───────────┬───────────┘ │
 │               │                          │             │
 │               ▼                          ▼             │
 │   ┌──────────────────────────────────────────────────┐ │
 │   │ Stockage local des clés PRIVÉES (IndexedDB PWA)  │ │
 │   └──────────────────────────────────────────────────┘ │
 └───────────────────────────┬────────────────────────────┘
                             │ HTTPS / WSS
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │ SERVEUR SOUVERAIN – Infrastructure de l'État           │
 │ (Déploiement : docker compose up -d)                   │
 │                                                        │
 │ ┌────────────────────────────────────────────────────┐ │
 │ │  Proxy inverse Nginx (TLS + sert le client web)    │ │
 │ └───────────────────┬────────────────────┬───────────┘ │
 │                     │ /api               │ /_matrix    │
 │                     ▼                    ▼             │
 │ ┌───────────────────────────┐  ┌─────────────────────┐ │
 │ │ Passerelle d'identité     │  │ Serveur Matrix      │ │
 │ │ (FastAPI)                 │  │ (Synapse v1.118.0)  │ │
 │ │ - Enrôlement, Argon2id,   │─▶│ - Texte CHIFFRÉ     │ │
 │ │   TOTP, rôles, audit,     │  │   uniquement        │ │
 │ │   révocation              │  │ - Clés publiques    │ │
 │ └─────────────┬─────────────┘  │ - Appartenance      │ │
 │               │                │   aux salons        │ │
 │               ▼                └──────────┬──────────┘ │
 │ ┌───────────────────────────┐  ┌──────────▼──────────┐ │
 │ │ PostgreSQL (Passerelle)   │  │ PostgreSQL (Synapse)│ │
 │ │ Base agents & audit       │  │ Événements chiffrés │ │
 │ └───────────────────────────┘  └─────────────────────┘ │
 └────────────────────────────────────────────────────────┘
```
*Frontière de confiance : le serveur ne voit JAMAIS les messages ni les fichiers en clair.*

---

## 3. Protocole de Chiffrement Retenu : Matrix (Olm / Megolm)

- **Olm** établit une session chiffrée directe entre deux appareils (conversations directes de pair-à-pair, dérivé du protocole Double Ratchet de Signal).
- **Megolm** utilise une clé de session par expéditeur, transmise de manière sécurisée aux membres autorisés via des canaux Olm chiffrés (gestion optimale des groupes).
- Le chiffrement est exécuté par `matrix-js-sdk` et `vodozemac` (implémentation cryptographique écrite en Rust et compilée en WebAssembly).
- **Aucune cryptographie n'est écrite par l'équipe** et aucune primitive n'est composée maison : messages et fichiers transitent exclusivement par les bibliothèques officielles auditées.
- Matrix est également le socle technologique éprouvé de **Tchap**, la messagerie souveraine de l'administration française.

---

## 4. Composants Open Source et Licences

| Composant | Rôle | Licence |
| :--- | :--- | :--- |
| **Notre code (client + passerelle)** | Interface et passerelle souveraine | **Apache 2.0** |
| **Matrix Synapse (non modifié)** | Serveur de messagerie | **AGPL-3.0** |
| **matrix-js-sdk** | Client Matrix | **Apache 2.0** |
| **vodozemac (Olm / Megolm)** | Moteur cryptographique WASM | **Apache 2.0** |
| **React + TypeScript (Vite)** | Framework frontend PWA | **MIT** |
| **FastAPI (Python)** | Framework backend passerelle | **MIT** |
| **cryptography (Fernet)** | Chiffrement symétrique au repos | **Apache 2.0 ou BSD** |
| **PostgreSQL** | Bases de données relationnelles | **Licence PostgreSQL** |
| **Nginx** | Proxy inverse, terminaison TLS | **BSD-2-Clause** |
| **Docker / Docker Compose** | Conteneurisation & orchestration | **Apache 2.0** |
| **argon2-cffi (Argon2id)** | Hachage dur des mots de passe | **MIT** |
| **pyotp (TOTP RFC 6238)** | Authentification multi-facteurs | **MIT** |
| **PyJWT** | Gestion des jetons de session JWT | **MIT** |

*Toutes ces licences sont formellement reconnues par l'OSI (Open Source Initiative) ; licences vérifiées à la version figée des dépendances avec liens vers chaque projet dans le README.*

---

## 5. Niveau d'Engagement Open Source : « Créer »

Application nouvelle (client React PWA et passerelle d'identité FastAPI) reposant sur des bibliothèques open source éprouvées (Matrix, vodozemac) ; Synapse est intégré sans altération de code. Code source placé sous licence **Apache 2.0**, fichier `LICENSE` à la racine, documentation et README intégralement rédigés en français.

---

## 6. Fonctionnalités Innovantes

Au-delà du socle de sécurité obligatoire, **SovereignMsg** se distingue par deux innovations majeures pensées pour le contexte administratif burkinabè, complétées par une piste d'évolution linguistique :

| Innovation | Contenu et Valeur pour l'Administration | Démonstration |
| :--- | :--- | :--- |
| **Classification des messages** | Étiquette (*Ordinaire*, *Diffusion restreinte*, *Confidentiel*) placée **dans le payload chiffré** : le serveur ignore quels messages sont classifiés. Le niveau *« Confidentiel »* applique côté client : une bannière rouge vive, un filigrane au nom de l'agent consultant, le blocage de la copie et l'expiration automatique. | Démontrable en direct : un chef de service envoie un message « Confidentiel », l'interface affiche une bannière rouge et le filigrane dynamique. |
| **Mode faible connexion** | File d'envoi différé, compression adaptative des images avant chiffrement, indicateur d'état de connectivité réseau : adapté aux zones rurales et aux réseaux à bande passante instable. | Démontrable en direct : interruption du réseau, saisie d'un message en file d'attente locale, rétablissement de la connectivité : le message part automatiquement. |
| **Interface en langue nationale (Piste d'évolution)** | L'architecture `i18next` est pré-configurée pour accueillir le mooré et le dioula. Priorité donnée au socle de sécurité pour le prototype, intégration complète des traductions planifiée pour la mise en production. | Prévu pour les versions ultérieures afin de garantir l'inclusion numérique de tous les agents. |

---

## 7. Répartition des Rôles

| Membre | Rôle | Responsabilités Principales |
| :--- | :--- | :--- |
| **Membre 1** | **Infrastructure, passerelle, sécurité** | Docker Compose, Synapse, PostgreSQL, Nginx, passerelle FastAPI, TOTP, révocation, journal d'audit chaîné SHA-256, tests de sécurité automatisés, note de sécurité. |
| **Membre 2** | **Application web (PWA), chiffrement, administration** | Client React installable, intégration du SDK Matrix / vodozemac, chiffrement E2EE, salons et groupes, interfaces d'accès et d'administration, README, vidéo de démonstration. |

*Les deux membres relisent mutuellement chaque fonction d'authentification et de chiffrement ; une fiche d'explication par mécanisme est préparée pour l'entretien technique.*
