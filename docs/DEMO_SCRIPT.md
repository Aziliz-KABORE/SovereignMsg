# Guide et Script de Démonstration Vidéo (3 Minutes) - SovereignMsg

Ce document détaille le déroulé pas-à-pas pour enregistrer la vidéo de démonstration de 3 minutes de **SovereignMsg**, mettant en valeur les fonctionnalités clés de souveraineté, le chiffrement de bout en bout et la révocation effective.

---

## ⏱️ Chronogramme Synthétique

| Séquence | Durée | Écran / URL | Action Principale | Message Clé |
| :--- | :--- | :--- | :--- | :--- |
| **1. Introduction & Connexion Admin** | 0:00 - 0:40 | `https://localhost/connexion` | Connexion MFA (Argon2id + TOTP) | Souveraineté, sécurité multi-facteurs, anti-énumération. |
| **2. Gestion des Agents & Création de Groupe** | 0:40 - 1:20 | `https://localhost/admin` | Présentation back-office, création groupe P07 | Chiffrement dès l'état initial, contrôle strict des membres actifs. |
| **3. Échange de Messages Chiffrés** | 1:20 - 2:00 | `https://localhost/` | Discussion instantanée dans le groupe | Chiffrement E2EE Megolm, zéro texte en clair sur le serveur. |
| **4. Révocation Immédiate d'un Agent** | 2:00 - 2:35 | `https://localhost/admin/agents` | Révocation de l'Agent B, audit SHA-256 | Coupure synchrone, désactivation Matrix, éviction des salons. |
| **5. Preuve du Blocage & Conclusion** | 2:35 - 3:00 | `https://localhost/connexion` | Tentative de reconnexion de l'Agent B (401) | Révocation effective démontrée, rotation Megolm, conclusion. |

---

## 🎬 Déroulé Détaillé & Script Parlé

### Séquence 1 : Introduction & Connexion Sécurisée (0:00 - 0:40)
- **Ce qui est affiché à l'écran** :
  - Navigateur sur `https://localhost/connexion` (mode plein écran 1080p ou 1280px).
  - Carte sobre aux couleurs nationales, champs `Email`, `Mot de passe`, `Code TOTP`.
- **Actions du présentateur** :
  - Saisir les identifiants du compte administrateur de demonstration.
  - Saisir le code TOTP courant fourni par l'application d'authentification de l'utilisateur enrôlé.
  - Cliquer sur **Se connecter**.
- **Script Voix-Off (Suggestion)** :
  > *"Bonjour. Nous vous présentons SovereignMsg, la messagerie instantanée souveraine pour l'administration publique burkinabè. L'accès est strictement conditionné à un enrôlement préalable par la passerelle d'identité. La connexion exige une authentification multi-facteurs combinant hachage mémoire-dur Argon2id et code dynamique TOTP. Le serveur Synapse Matrix n'est jamais exposé directement : toutes les requêtes sont filtrées par notre passerelle sécurisée."*

---

### Séquence 2 : Back-Office & Création d'un Salon Chiffré (0:40 - 1:20)
- **Ce qui est affiché à l'écran** :
  - Redirection vers l'interface d'administration `/admin`.
  - Vue sur le **Tableau de Bord (P13)** : compteurs d'agents actifs, en attente et révoqués.
  - Clic sur l'onglet **Agents (P14)** montrant la liste des fonctionnaires enrôlés.
- **Actions du présentateur** :
  - Afficher les agents inscrits sans exposer leurs identifiants.
  - Naviguer vers la création d'un groupe ou montrer l'appel de création du salon opérationnel :
    - Nom : `Cellule de Crise Sécuritaire`
    - Membres: selectionner les trois agents inscrits dans l interface.
- **Script Voix-Off (Suggestion)** :
  > *"Depuis le back-office d'administration, les responsables de sécurité supervisent les agents actifs et les autorisations. Créons un nouveau salon opérationnel. Point capital d'architecture : le chiffrement de groupe Megolm est activé dès l'état initial du salon, de manière irrévocable. Seuls les agents actifs et dûment enrôlés peuvent être invités ; tout compte inconnu ou révoqué est systématiquement rejeté par la passerelle."*

---

### Séquence 3 : Échange de Messages Chiffrés de Bout en Bout (1:20 - 2:00)
- **Ce qui est affiché à l'écran** :
  - Vue de la messagerie web PWA (`/`) avec la liste des salons à gauche et le fil de discussion à droite.
  - Sélection du groupe `Cellule de Crise Sécuritaire`.
- **Actions du présentateur** :
  - Envoyer un message depuis l'interface : `"Situation sous contrôle dans le secteur Centre. Validation des directives en cours."`
  - *(Optionnel / Rapide)* : Montrer brièvement un deuxième onglet ou une fenêtre privée avec la session de l'Agent B recevant le message déchiffré.
- **Script Voix-Off (Suggestion)** :
  > *"Dans la messagerie, les échanges sont fluides et instantanés. Grâce à la bibliothèque WASM vodozemac intégrée dans la PWA, les messages sont chiffrés directement sur le terminal de l'agent avant leur émission. Le serveur Synapse et la base de données ne voient et ne stockent que du texte chiffré illisible, garantissant une confidentialité totale vis-à-vis de tout tiers ou hébergeur."*

---

### Séquence 4 : Révocation Immédiate d'un Agent (2:00 - 2:35)
- **Ce qui est affiché à l'écran** :
  - Retour sur le panneau d'administration : `https://localhost/admin/agents`.
- **Actions du présentateur** :
  - Cliquer sur le bouton rouge **Révoquer l'agent**.
  - Confirmer dans la boîte de dialogue modale.
  - Observer le badge de statut passer instantanément à **Révoqué**.
  - Naviguer sur l'onglet **Journal d'Audit (P17)** pour montrer la ligne `AGENT_REVOCATION` scellée avec son hachage SHA-256 chaîné.
- **Script Voix-Off (Suggestion)** :
  > *"Simulons maintenant le départ ou la suspension immédiate de l'Agent B. En un clic, l'administrateur révoque l'accès. La passerelle déclenche une double action synchrone : le compte est verrouillé en base et l'API Synapse désactive immédiatement l'utilisateur. Tous ses jetons de session sont invalidés et il est expulsé de l'ensemble de ses salons de discussion. Cet événement est inscrit dans notre journal d'audit infalsifiable chaîné en SHA-256."*

---

### Séquence 5 : Preuve du Blocage & Rotation Megolm (2:35 - 3:00)
- **Ce qui est affiché à l'écran** :
  - Fenêtre de navigation privée ou déconnexion vers `https://localhost/connexion`.
  - Tentative de connexion de l'Agent B :
    - Code TOTP : saisir le code courant de son application.
  - Clic sur **Se connecter**.
  - Message d'erreur immédiat : `Identifiants invalides ou compte inaccessible.`
- **Actions du présentateur** :
  - Montrer le rejet net de la connexion.
  - Souligner que dans le salon de groupe, l'expulsion de B a déclenché une rotation des clés Megolm : B ne pourra plus jamais déchiffrer les futurs messages.
- **Script Voix-Off (Suggestion)** :
  > *"Voici la preuve de sécurité : l'Agent B tente de se reconnecter avec ses anciens identifiants valides. La connexion est immédiatement refusée avec un statut 401. Mieux encore : son expulsion du salon a provoqué le renouvellement automatique des clés de session de groupe. Les membres restants continuent d'échanger en toute souveraineté, avec l'assurance mathématique qu'aucun ancien membre ne peut lire leurs messages. SovereignMsg est prêt, robuste et souverain."*

---

## 🛠️ Aide-Mémoire Pratique pour le Tournage

1. **Terminal prêt à afficher les logs ou codes TOTP** :
   ```powershell
   # Générer un code uniquement à partir d'un secret provisionné de manière sécurisée.
   python demo/generate_totp.py
   ```
2. **Réinitialiser l'état de démonstration avant la vidéo** (si besoin) :
   ```powershell
   docker exec -w /app -e PYTHONPATH=/app sovereign-gateway python scripts/seed_demo_agents.py
   ```
3. **Résolution recommandée** : 1920×1080 (16:9), zoom navigateur à 100% ou 110% pour une lisibilité parfaite des badges et textes.

