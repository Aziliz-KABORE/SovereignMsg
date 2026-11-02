# Dossier de Sécurité - SovereignMsg
**Messagerie Instantanée Souveraine Interministérielle (Burkina Faso)**  
*Sprint Technique Pré-Hackathon 2026 – DGTD / MTDPCE*  
*Conforme aux exigences ANSSI et standards cryptographiques Matrix/Olm/Megolm*

---

## 1. Actifs à Protéger

Dans le cadre du déploiement de SovereignMsg au sein des institutions publiques burkinabè, les actifs critiques suivants ont été identifiés et hiérarchisés :

| Actif Critique | Description & Sensibilité | Objectif de Sécurité |
| :--- | :--- | :--- |
| **Contenu des échanges (Messages & Fichiers)** | Échanges opérationnels, notes de service, décisions gouvernementales. | **Confidentialité absolue** : Chiffrement de bout en bout (E2EE) obligatoire. Aucun texte en clair sur les serveurs ou proxies. |
| **Clés cryptographiques (Olm / Megolm)** | Clés privées d'identité (Curve25519, Ed25519) et clés de session de groupe Megolm. | **Intégrité et Confidentialité** : Stockées uniquement sur les terminaux des agents (IndexedDB chiffré/navigateur). Jamais exportées vers le serveur. |
| **Secrets d'authentification (Argon2id, TOTP)** | Empreintes de mots de passe, clés secrètes TOTP au repos. | **Confidentialité et Non-rejouabilité** : Chiffrement AES-256 (Fernet) au repos pour les secrets TOTP ; hachage mémoire-dur Argon2id. |
| **Annuaire et Identité des Agents** | Correspondance entre l'identité civile/ministérielle et l'identifiant Matrix. | **Cloisonnement & Vie Privée** : Pseudonymisation par UUID aléatoire (`@agent_<hex16>:sovereign.local`). Les emails ministériels ne sont jamais transmis à Synapse. |
| **Piste d'Audit** | Journalisation des actions administratives (enrôlement, révocation, modification de rôles). | **Intégrité et Non-répudiation** : Chaînage cryptographique SHA-256 infalsifiable avec horodatage strict UTC. |

---

## 2. Modèle de Menaces Pris en Compte

Le modèle de menaces couvre tant les attaquants distants que les scénarios de compromission interne :

1. **Serveur compromis ou administrateur système indiscret (Honest-but-curious ou Malicious Server)** :
   - *Scénario* : Un attaquant ayant un accès root sur l'infrastructure d'hébergement ou la base de données inspecte le trafic ou les tables SQL.
   - *Impact prévenu* : Grâce au protocole Olm/Megolm (`m.megolm.v1.aes-sha2`), le serveur Synapse ne stocke que du ciphertext illisible. Les métadonnées d'identité réelles sont ségréguées dans la passerelle PostgreSQL distincte.
2. **Attaques par énumération de comptes et force brute** :
   - *Scénario* : Un acteur hostile sonde l'API de connexion pour identifier les agents existants ou tester des dictionnaires de mots de passe.
   - *Impact prévenu* : Anti-énumération absolue (réponse 401 identique `GENERIC_LOGIN_ERROR`), délai d'attente constant par calcul factice Argon2id en cas de compte inexistant, verrouillage automatique après 5 échecs consécutifs.
3. **Appareil égaré, volé ou agent révoqué (Départ/Suspension de fonction)** :
   - *Scénario* : Un agent révoqué tente de continuer à lire les futurs messages ou de réutiliser ses jetons de session actifs.
   - *Impact prévenu* : Désactivation administrative immédiate dans Synapse (`POST /_synapse/admin/v1/deactivate/{user_id}`), invalidation temps réel du JWT par la passerelle, révocation automatique de tous les tokens et éviction des salons, provoquant le renouvellement immédiat de la clé de groupe Megolm (Forward Secrecy post-éviction).
4. **Intrus sur le réseau ou tentative de contournement d'enrôlement** :
   - *Scénario* : Un individu tente de créer un compte directement sur le serveur Matrix ou d'inviter des tiers externes.
   - *Impact prévenu* : Enregistrement public Matrix désactivé (`enable_registration: false`), routes d'enregistrement et d'administration bloquées au niveau Nginx (`/_matrix/client/*/register`, `/_synapse/admin`). Seule la passerelle interne d'identité détient le droit de provisionner des comptes.
5. **Altération malveillante du journal d'audit** :
   - *Scénario* : Un attaquant tente d'effacer les traces d'une action illégitime dans les logs.
   - *Impact prévenu* : Chaque entrée d'audit scelle le hachage SHA-256 de l'entrée précédente (blockchain légère). Toute altération, suppression ou réordonnancement est détecté par l'algorithme de vérification `/api/admin/audit/verifier`.

---

## 3. Architecture et Protections Mises en Place

L'architecture applique rigoureusement le principe de défense en profondeur et le moindre privilège :

```
[ INTERNET / INTRANET ]
         │
         │ TLS 1.3 / Port 443 uniquement (HSTS, CSP stricte sans 'unsafe-inline')
         ▼
┌────────────────────────────────────────────────────────┐
│                      Proxy Nginx                       │
│  - Terminaison TLS / Certificats souverains            │
│  - Distribution PWA (Assets statiques / SW)            │
│  - Blocage strict de /_synapse/admin et /login public  │
└──────────────────────────┬─────────────────────────────┘
                           │
       ┌───────────────────┴───────────────────┐
       │ (Réseau Docker Interne Isolé)         │
       ▼                                       ▼
┌─────────────────────────────┐   ┌─────────────────────────────┐
│    Passerelle d'Identité    │   │       Matrix Synapse        │
│          (FastAPI)          │   │          (v1.118.0)         │
│ - Enrôlement 2 temps (P15)  │──▶│ - Chiffrement initial E2EE  │
│ - Argon2id + TOTP RFC 6238  │   │ - Fédération désactivée     │
│ - Audit SHA-256 chaîné      │   │ - Zéro texte clair          │
└──────────────┬──────────────┘   └──────────────┬──────────────┘
               │                                 │
               ▼                                 ▼
┌─────────────────────────────┐   ┌─────────────────────────────┐
│ Postgres Gateway (Isolée 1) │   │ Postgres Synapse (Isolée 2) │
│  Table agents, tokens, audit│   │  Événements chiffrés Megolm │
└─────────────────────────────┘   └─────────────────────────────┘
```

### A. Chiffrement de Bout en Bout dès l'Origine
- **Salons de Groupe (P07)** : Tous les salons sont initialisés avec l'état `m.room.encryption` configuré sur l'algorithme `m.megolm.v1.aes-sha2` dès le premier événement (via `initial_state`). Le niveau de pouvoir requis pour modifier le chiffrement est verrouillé à 100.
- **Bibliothèques Éprouvées** : Utilisation exclusive du SDK officiel Matrix et des primitives `vodozemac` (Rust/WASM). Aucune cryptographie n'a été réinventée ou codée sur mesure.

### B. Contrôle d'Accès et Révocation Fiable
- **Validation Systématique à chaque Requête** : La dépendance `get_current_agent` interroge la base de données en direct sur le statut de l'agent. Si le statut n'est pas strictement `actif`, l'accès est refusé avec un code HTTP 401 immédiat (fermeture de session à chaud).
- **Révocation Synchrone et Idempotente** :
  1. La passerelle appelle l'API d'administration de Synapse (`POST /_synapse/admin/v1/deactivate/{user_id}`).
  2. Synapse révoque tous les jetons d'accès, efface les appareils et supprime l'agent de tous ses salons (génération d'événements `leave` effectifs).
  3. L'événement `leave` force les clients restants dans les salons de groupe à renouveler la session Megolm (rotation de clé), interdisant à l'ancien membre de lire tout message futur.
  4. En cas de défaillance réseau entre la passerelle et Synapse, la passerelle bascule le compte en `revocation_incomplete` (le login reste bloqué) et retourne une erreur explicite HTTP 502, interdisant tout faux sentiment de sécurité et autorisant les réessais.

### C. Validation Expérimentale sur Pile Réelle (Protocole B.2)
Le protocole de test B.2 a été exécuté et validé avec succès sur les conteneurs réels (`scripts/test_protocole_b2.py`) :
- Création d'un groupe opérationnel chiffré entre 3 agents (three enrolled agents).
- Vérification de l'état `m.room.encryption` dans Synapse : `m.megolm.v1.aes-sha2`.
- Révocation administrative de l'Agent B :
  - Login refusé immédiatement (HTTP 401).
  - Suppression de l'appartenance aux salons validée dans Synapse (`joined_rooms = []`).
  - L'Agent C (témoin) continue d'échanger normalement dans le salon avec session active.

---

## 4. Analyse des Métadonnées Visibles

Le chiffrement de bout en bout garantit la confidentialité du texte et des pièces jointes. Cependant, par conception du protocole Matrix et des protocoles réseau, certaines métadonnées demeurent accessibles au niveau de l'infrastructure :

| Métadonnée Visible | Niveau d'Exposition | Mesures d'Atténuation Appliquées |
| :--- | :--- | :--- |
| **Graphe social (Qui communique avec qui)** | Visible par le serveur Synapse (membres d'un même salon). | Fédération désactivée ; serveur hébergé sur le territoire national sous autorité souveraine burkinabè. |
| **Identifiants des participants** | Visible dans les événements Matrix (`@agent_<hex>:sovereign.local`). | **Pseudonymisation totale** : Dérivée d'un UUID aléatoire non corrélé au nom ni à l'adresse e-mail. |
| **Volume et Fréquence des échanges** | Visible par l'administrateur réseau et la base de données Synapse (taille des trames chiffrées, horodatage d'envoi). | Canal TLS 1.3 avec en-têtes durcis pour masquer le détail aux intermédiaires réseau. |
| **Noms des Salons** | Visible dans l'événement `m.room.name`. | Recommandation opérationnelle : Utiliser des noms de groupes neutres ou conventionnés sans classification explicite. |

---

## 5. Limites Connues et Travaux Futurs

1. **Rétention des messages déchiffrés localement** :
   - *Limite* : La révocation d'un agent bloque immédiatement toute nouvelle connexion et tout futur message. Cependant, les messages déjà déchiffrés et stockés dans la mémoire ou le cache local du terminal avant la révocation y demeurent physiquement accessibles jusqu'à la purge du cache ou la désinstallation de la PWA.
   - *Recommandation* : Intégration d'un signal de destruction locale de la base IndexedDB lors de la réception d'un événement d'invalidation.
2. **Protection contre la capture d'écran** :
   - *Limite* : Dans un environnement navigateur standard (PWA Web), il est techniquement impossible d'empêcher de manière infaillible une capture d'écran OS ou une prise de vue photographique externe de l'écran.
   - *Mesure compensatoire* : Mesures dissuasives (filigrane dynamique affichant l'identité de l'agent consultant et horodatage, flou automatique lors de la perte de focus de l'onglet).
3. **Périmètre des fonctionnalités reportées (BLOC 2 & BLOC 3)** :
   - Le transfert de pièces jointes volumineuses chiffrées (`matrix-encrypt-attachment`) et le mode ultra-restreint avec durée de vie éphémère stricte feront l'objet de la tranche de développement ultérieure.
