# NOTE DE SÉCURITÉ – SovereignMsg

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

## 1. Actifs à Protéger et Hypothèses de Confiance

- **Actifs critiques** :
  - Contenu des messages et des fichiers (secret professionnel et sécurité d'État).
  - Identité réelle des agents (nom, prénom, ministère d'appartenance, fonction).
  - Métadonnées de communication (qui échange avec qui, quand, volume et taille des données échangées).
- **Hypothèses de confiance** :
  - Le serveur est modélisé comme **« honnête mais curieux »** (*honest-but-curious*) : il route fidèlement les paquets mais ne doit en aucun cas pouvoir lire le contenu des échanges ; il a accès à certaines métadonnées incompressibles de transport.
  - L'administrateur système est réputé de bonne foi.
  - Les clés cryptographiques privées restent confinées sur l'appareil de l'agent et ne sont jamais transmises au serveur.
  - Le client web servi est intègre (voir limites en section 5).

---

## 2. Menaces Prises en Compte

| Menace et scénario d'attaque | Protection mise en place | Limite résiduelle |
| :--- | :--- | :--- |
| **Écoute réseau : interception du trafic** | TLS 1.2/1.3 + chiffrement de bout en bout (Olm / Megolm). | Métadonnées de trafic (tailles de paquets, horaires). |
| **Serveur compromis : lecture de la base ou des fichiers** | Le serveur ne détient que du texte chiffré ; clés privées stockées localement sur les terminaux. | Métadonnées ; ajout éventuel d'un appareil malveillant (contré par vérification manuelle d'empreinte). |
| **Vol de compte : mot de passe deviné ou volé** | Argon2id + TOTP + anti-rejeu du code à 6 chiffres + verrouillage automatique 15 min après 5 échecs consécutifs. | Vol simultané du terminal physique hébergeant l'application TOTP. |
| **Appareil perdu ou volé** | Révocation administrative immédiate (compte Synapse désactivé, éviction automatique des salons, rotation Megolm des clés de groupe) ; effacement des clés locales à la détection. | Messages déjà déchiffrés avant la révocation lisibles sur l'appareil s'il demeure strictement hors ligne. |
| **Intrus non enrôlé : inscription ou connexion clandestine** | Inscription publique désactivée ; Nginx bloque les routes Matrix directes ; seule la passerelle d'identité est accessible. | Une erreur de syntaxe ou de directive proxy rouvrirait la route (prévenu par tests et validation automatique). |
| **Contournement de la passerelle : appel direct à /login ou /_synapse/admin** | Routes formellement bloquées pour toutes les déclinaisons de chemins d'accès au niveau Nginx ; test automatisé avant mise en service. | Dépendance stricte à la configuration du reverse proxy (défense en profondeur). |
| **Fuite par un destinataire : capture d'écran, copie non autorisée** | Classification *« Confidentiel »* : bannière d'alerte, filigrane dynamique avec nom de l'agent, blocage de la copie, expiration automatique des messages. | Photographie physique de l'écran par un tiers non évitable techniquement. |
| **Injection de code dans le client : script dans un message (XSS)** | Politique de sécurité de contenu (CSP stricte sans `'unsafe-inline'`), échappement systématique, aucun HTML brut injecté dans le DOM. | Faille « zéro-day » non identifiée dans une dépendance cliente. |
| **Falsification de l'audit : effacement ou altération de traces** | Journal scellé et chaîné par empreintes SHA-256 successives : toute suppression ou altération est mathématiquement détectable. | Accès physique direct à la base de données (permet la détection de l'altération mais non sa prévention a priori). |

---

## 3. Protections Mises en Place

- **Chiffrement** :
  - *En transit* : TLS 1.2 / TLS 1.3 et WSS obligatoire.
  - *En bout en bout* : Protocole Matrix standard (Olm pour les échanges 1-à-1, Megolm pour les groupes, implémentés via `vodozemac` en Rust/WASM). **Aucune cryptographie maison**.
  - *Au repos* : Mots de passe hachés avec Argon2id (paramètres durcis 64 Mo, 2 itérations), secrets TOTP et mots de passe Matrix internes chiffrés symétriquement en AES-256 via Fernet.
- **Authentification** :
  - Inscription publique désactivée (`enable_registration: false`). Enrôlement exclusif par un administrateur accrédité.
  - Mot de passe fort de 12 caractères minimum + code dynamique TOTP (RFC 6238).
  - Anti-énumération absolue : tous les échecs renvoient le code HTTP 401 avec un message générique unifié, accompagné d'un calcul factice Argon2id pour aligner le temps de réponse en cas de compte inconnu.
- **Révocation** :
  - Statut basculé en *« révoqué »* avec traçabilité au journal d'audit.
  - Désactivation synchrone du compte dans Synapse (`POST /_synapse/admin/v1/deactivate/{user_id}`) : jetons invalidés, retrait automatique de tous les salons, déclenchant la rotation immédiate des clés Megolm par les autres membres du groupe.
  - En cas d'indisponibilité ou d'erreur de Synapse, la révocation est inscrite en statut *« révocation incomplète »*, reste réessayable et le login est fermement refusé.
- **Piste d'Audit** :
  - Entrées chaînées par hachage SHA-256, écriture sérialisée sous transaction PostgreSQL atomique.
  - Aucun mot de passe, secret TOTP ni jeton de session n'est consigné dans les journaux.
- **Infrastructure** :
  - Seul le port **443** est exposé vers l'extérieur.
  - Fédération inter-serveurs et indicateurs de présence désactivés.
  - Deux bases PostgreSQL rigoureusement séparées (Passerelle et Synapse).
  - Conteneurs exécutés sous utilisateurs non-root (`appuser:1001`).
  - Dépendances auditées et figées ; zéro secret par défaut dans le dépôt Git.

> **Innovation et sécurité :** Le mode *« Confidentiel »* dépasse la simple étiquette visuelle. Il applique des contraintes de sécurité actives côté client (bannière contrastée, filigrane nominatif de traçabilité, blocage du presse-papiers, auto-destruction après expiration). L'étiquette de classification elle-même est encapsulée à l'intérieur du payload chiffré : le serveur Matrix ignore totalement quels messages sont classifiés.

---

## 4. Métadonnées Visibles par le Serveur et Mesures de Réduction

| Information visible | Pourquoi elle est visible | Mesure de réduction appliquée | Statut d'exposition |
| :--- | :--- | :--- | :--- |
| **Identité des comptes** | Nécessaire pour l'annuaire et le contrôle d'accès. | Identifiants Matrix entièrement pseudonymisés (`@agent_<uuid>:sovereign.local`) ; correspondance civile conservée dans la passerelle seule. | Oui, accessible par l'administrateur accrédité. |
| **Appartenance aux conversations** | Nécessaire pour le routage des messages vers les membres. | Aucune réduction possible sans changer le modèle de routage Matrix. | Oui (limite intrinsèque au protocole). |
| **Date et heure des messages** | Nécessaire pour l'ordonnancement et l'acheminement des événements. | Horodatage standard de transmission. | Oui (limite connue). |
| **Taille des messages et fichiers** | Nécessaire pour l'allocation du stockage et des quotas. | Limite de taille imposée (10 Mo) ; remplissage d'espace fixe non implémenté. | Oui (limite connue). |
| **Adresses IP des terminaux** | Connexion réseau TCP/IP sous-jacente. | Journaux Nginx configurés sans consignation des adresses IP directes ; conservation réduite dans Synapse. | **Fortement réduit**. |
| **Indicateur de présence et frappe en cours** | Confort d'usage dans les messageries grand public. | **Formellement désactivés** dans la configuration de Synapse. | **Non exposé**. |
| **Contenu, noms de fichiers, classification** | Données applicatives. | Chiffrés de bout en bout avant expédition. | **Non exposé (zéro clair)**. |
| **Noms et descriptions des salons** | Gestion de l'état du salon dans Synapse. | Utilisation recommandée de noms de groupes neutres, aucune donnée confidentielle dans les métadonnées de salon. | Oui (métadonnée de routage). |
| **Clés publiques des appareils** | Nécessaires pour établir les sessions chiffrées Olm/Megolm. | Vérification croisée des empreintes cryptographiques entre correspondants. | Oui (publiques par nature). |

---

## 5. Limites Connues

- **Capture d'écran** : Un navigateur web ne peut pas techniquement empêcher de façon infaillible une capture d'écran imposée par le système d'exploitation. Les mesures du mode *« Confidentiel »* (filigrane nominatif, blocage de la sélection, expiration) sont dissuasives et traçantes.
- **Messages déjà déchiffrés** : Avant une révocation administrative, les messages reçus et déchiffrés restent présents dans le stockage local de l'appareil tant que la base locale n'est pas purgée ; l'effacement distant nécessite la reconnexion de l'appareil au réseau.
- **Métadonnées incompressibles** : L'appartenance aux conversations, les dates et les tailles restent visibles par le serveur Synapse (voir section 4).
- **Client servi altéré** : Un attaquant ayant une compromission root du serveur web Nginx pourrait tenter de servir un bundle JavaScript altéré ; mesure future recommandée : publication d'une empreinte binaire vérifiable de la PWA.
- **Stockage local et historique** : Les clés de session sont stockées dans IndexedDB. La passerelle conserve un mot de passe Matrix chiffré par agent pour orchestrer les sessions ; sa compromission permettrait d'ouvrir une session au nom de l'agent mais **sans pouvoir lire l'historique antérieur des messages chiffrés**, d'où l'importance de la vérification d'appareil.
- **Dépendances et déni de service** : Une vulnérabilité inconnue dans une bibliothèque tierce reste possible ; la mitigation des attaques volumétriques par déni de service distribué (DDoS) relève du pare-feu d'infrastructure étatique.

---

**Conclusion :** Le serveur de messagerie ne lit jamais les messages ni les fichiers en clair. Toute tentative d'altération de l'audit est mathématiquement détectable. Aucune cryptographie non éprouvée n'a été développée par l'équipe.

