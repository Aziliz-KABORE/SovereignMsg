# SovereignMsg - Politique de Sécurité et Défense en Profondeur

## 1. Principes Fondamentaux Non Négociables
1. **Aucune cryptographie maison** :
   - Chiffrement des messages : `matrix-js-sdk` avec le moteur Rust `vodozemac` via WebAssembly côté client uniquement (`initRustCrypto`).
   - Hachage des mots de passe : `argon2-cffi` (Argon2id avec sel cryptographique).
   - Chiffrement au repos des secrets TOTP : `cryptography.fernet` (AES-128 en mode CBC avec HMAC-SHA256).
2. **Le serveur ne voit jamais les données en clair** :
   - Les clés privées de chiffrement restent dans l'IndexedDB du navigateur de l'agent.
   - Les pièces jointes sont chiffrées côté client avant envoi et téléversement.
3. **Surface d'attaque minimale** :
   - Seul le port TCP 443 est exposé vers l'extérieur.
   - Inscription publique désactivée (`enable_registration: false`).
   - Fédération désactivée (`federation_domain_whitelist: []`).
   - Présence désactivée (`use_presence: false`).
4. **Échec fermé (Fail-Closed)** :
   - Tout refus renvoie un message générique pour interdire l'énumération d'utilisateurs.
   - Vérification du statut de l'agent à chaque requête.

---

## 2. Défense en Profondeur Nginx

Nginx agit comme une barrière étanche devant Synapse et la passerelle.

### Routes Matrix strictement bloquées depuis l'extérieur (403 Forbidden) :
- `^/_synapse/admin` : Aucune API d'administration Matrix n'est accessible depuis l'extérieur.
- `^/_matrix/client/[^/]+/login` : Connexion directe Matrix interdite (versions r0, v3, unstable, etc.).
- `^/_matrix/client/[^/]+/register` : Inscription Matrix interdite.

Seule la passerelle d'identité FastAPI, opérant sur le réseau Docker interne isolé, est autorisée à appeler ces routes avec les privilèges d'administration.

### En-têtes HTTP de durcissement :
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none';`
  *(Note : `wasm-unsafe-eval` est indispensable pour le runtime WebAssembly de vodozemac / Rust Crypto).*

---

## 3. Gestion des Secrets
- Aucun secret, certificat TLS ou fichier `.env` réel n'est versionné dans Git.
- Un `.gitignore` exhaustif et un fichier modèle `.env.example` sont fournis.
- Les logs ne consignent jamais de mots de passe, tokens, secrets TOTP ou données privées.

