"""
SovereignMsg Gateway - Client Synapse Matrix (HTTPX)
====================================================
Interaction avec l'API d'administration et l'API client interne de Synapse :
- Création d'utilisateur : PUT /_synapse/admin/v2/users/<user_id>
  (N'envoie jamais l'email ni le ministère à Synapse pour préserver la confidentialité)
- Connexion Plan B (SYNAPSE_LOGIN_MODE=password) : POST /_matrix/client/v3/login
  (Accepte et transmet device_id pour assurer la persistance des clés cryptographiques)
- Désactivation d'utilisateur : POST /_synapse/admin/v1/deactivate/<user_id>
  Doc officielle : https://element-hq.github.io/synapse/latest/admin_api/user_admin_api.html#deactivate-account
  CONFIRMÉ Synapse v1.118.0 : la désactivation retire automatiquement l'utilisateur de
  tous ses salons (événements leave) et supprime tous les tokens/clés E2EE.
  Cela déclenche automatiquement la rotation Megolm dans les salons chiffrés.
- Sécurité : Délais d'attente stricts, aucun mot de passe ni jeton dans les journaux.
"""

from typing import Optional, Dict, Any, NamedTuple
import httpx
from app.core.config import settings


class SynapseRateLimited(Exception):
    """Synapse rejected a login because its own rate limit is active."""

    def __init__(self, retry_after: Optional[str] = None):
        self.retry_after = retry_after
        super().__init__("Synapse login rate limit active")


class DeactivateResult(NamedTuple):
    """Résultat structuré de la désactivation Synapse."""
    success: bool
    status_code: int
    message: str


class SynapseClient:
    def __init__(
        self,
        base_url: Optional[str] = None,
        admin_token: Optional[str] = None,
        server_name: Optional[str] = None,
        transport: Optional[httpx.BaseTransport] = None,
        timeout: float = 10.0
    ):
        self.base_url = (base_url or (settings.SYNAPSE_URL if settings else "http://synapse:8008")).rstrip("/")
        self.admin_token = admin_token or (settings.SYNAPSE_ADMIN_TOKEN if settings else "")
        self.server_name = server_name or (settings.SYNAPSE_SERVER_NAME if settings else "sovereign.local")
        self.timeout = timeout
        self.transport = transport

    def _get_client(self) -> httpx.Client:
        return httpx.Client(
            base_url=self.base_url,
            timeout=self.timeout,
            transport=self.transport
        )

    def create_or_update_user(
        self,
        matrix_user_id: str,
        displayname: str,
        password: Optional[str] = None
    ) -> bool:
        """
        Crée ou met à jour un utilisateur dans Synapse via l'API Admin v2.
        Doc: https://element-hq.github.io/synapse/latest/admin_api/user_admin_api.html#create-or-modify-account
        """
        url = f"/_synapse/admin/v2/users/{matrix_user_id}"
        headers = {
            "Authorization": f"Bearer {self.admin_token}",
            "Content-Type": "application/json"
        }
        payload: Dict[str, Any] = {
            "displayname": displayname,
            "admin": False,
            "deactivated": False
        }
        if password:
            payload["password"] = password

        with self._get_client() as client:
            try:
                response = client.put(url, headers=headers, json=payload)
                return response.status_code in (200, 201)
            except httpx.HTTPError:
                return False

    def login_user(
        self,
        username: str,
        password: str,
        device_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Connecte un utilisateur Matrix via POST /_matrix/client/v3/login (Plan B).
        Doc: https://spec.matrix.org/v1.11/client-server-api/#post_matrixclientv3login
        Retourne le dictionnaire contenant access_token, device_id, user_id, home_server.
        """
        url = "/_matrix/client/v3/login"
        payload: Dict[str, Any] = {
            "type": "m.login.password",
            "identifier": {
                "type": "m.id.user",
                "user": username
            },
            "password": password,
            "initial_device_display_name": "SovereignMsg Client PWA"
        }
        if device_id:
            payload["device_id"] = device_id

        with self._get_client() as client:
            try:
                response = client.post(url, json=payload)
                if response.status_code == 200:
                    return response.json()
                if response.status_code == 429:
                    raise SynapseRateLimited(response.headers.get("Retry-After"))
                return None
            except SynapseRateLimited:
                raise
            except httpx.HTTPError:
                return None

    def deactivate_user(self, matrix_user_id: str) -> DeactivateResult:
        """
        Désactive un compte utilisateur dans Synapse via POST /_synapse/admin/v1/deactivate/{user_id}.

        Comportement confirmé pour Synapse v1.118.0
        (doc: https://element-hq.github.io/synapse/latest/admin_api/user_admin_api.html#deactivate-account) :
        - Retire automatiquement l'utilisateur de TOUS ses salons (événements leave).
        - Déclenche la rotation des clés Megolm dans les salons E2EE concernés.
        - Supprime tous les access_tokens actifs (login immédiatement refusé).
        - Supprime tous les appareils et clés E2EE enregistrés.
        - Avec {"erase": true} : efface le display_name et l'avatar (RGPD).

        Retourne un DeactivateResult structuré pour permettre la gestion d'échec.
        """
        url = f"/_synapse/admin/v1/deactivate/{matrix_user_id}"
        headers = {
            "Authorization": f"Bearer {self.admin_token}",
            "Content-Type": "application/json"
        }
        payload = {"erase": True}

        with self._get_client() as client:
            try:
                response = client.post(url, headers=headers, json=payload)
                if response.status_code == 200:
                    return DeactivateResult(
                        success=True,
                        status_code=200,
                        message="Compte désactivé, retiré de tous les salons."
                    )
                return DeactivateResult(
                    success=False,
                    status_code=response.status_code,
                    message=f"Synapse a retourné HTTP {response.status_code}: {response.text[:200]}"
                )
            except httpx.TimeoutException:
                return DeactivateResult(
                    success=False,
                    status_code=0,
                    message="Délai d'attente dépassé lors de la communication avec Synapse."
                )
            except httpx.HTTPError as exc:
                return DeactivateResult(
                    success=False,
                    status_code=0,
                    message=f"Erreur réseau Synapse : {str(exc)[:200]}"
                )

    def get_user_rooms(self, matrix_user_id: str) -> Optional[list]:
        """
        Retourne la liste des salons d'un utilisateur via l'API Admin.
        Doc: https://element-hq.github.io/synapse/latest/admin_api/user_admin_api.html#list-room-memberships-of-a-user
        Utilisé uniquement comme fallback de vérification après désactivation.
        """
        url = f"/_synapse/admin/v1/users/{matrix_user_id}/joined_rooms"
        headers = {"Authorization": f"Bearer {self.admin_token}"}

        with self._get_client() as client:
            try:
                response = client.get(url, headers=headers)
                if response.status_code == 200:
                    return response.json().get("joined_rooms", [])
                return None
            except httpx.HTTPError:
                return None

    def create_encrypted_room(
        self,
        creator_matrix_user_id: str,
        room_name: str,
        invite_user_ids: Optional[list] = None
    ) -> Optional[str]:
        """
        Crée un salon de groupe Matrix avec chiffrement E2EE activé dans l'état initial.

        Utilise POST /_synapse/admin/v1/join/<room_id>... non — utilise l'API de création
        de salon via le compte admin Synapse comme créateur pour garantir le chiffrement
        dès l'état initial (initial_state m.room.encryption).

        Doc création de salon :
        https://spec.matrix.org/v1.11/client-server-api/#post_matrixclientv3createroom
        Doc admin login :
        https://element-hq.github.io/synapse/latest/admin_api/user_admin_api.html#login-as-a-user

        Le chiffrement est configuré dans initial_state avec event_type m.room.encryption
        (algorithme m.megolm.v1.aes-sha2), ce qui empêche sa désactivation ultérieure.

        Retourne le room_id du salon créé, ou None en cas d'erreur.
        """
        # 1. Obtenir un token d'accès pour le créateur via l'API admin "login as user"
        # Doc: https://element-hq.github.io/synapse/latest/admin_api/user_admin_api.html#login-as-a-user
        login_url = f"/_synapse/admin/v1/users/{creator_matrix_user_id}/login"
        headers = {
            "Authorization": f"Bearer {self.admin_token}",
            "Content-Type": "application/json"
        }

        with self._get_client() as client:
            try:
                login_resp = client.post(login_url, headers=headers, json={})
                if login_resp.status_code != 200:
                    return None
                creator_token = login_resp.json().get("access_token")
                if not creator_token:
                    return None
            except httpx.HTTPError:
                return None

            # 2. Créer le salon avec m.room.encryption dans initial_state
            create_url = "/_matrix/client/v3/createRoom"
            creator_headers = {
                "Authorization": f"Bearer {creator_token}",
                "Content-Type": "application/json"
            }
            payload: Dict[str, Any] = {
                "name": room_name,
                "preset": "private_chat",
                "visibility": "private",
                "initial_state": [
                    {
                        "type": "m.room.encryption",
                        "state_key": "",
                        "content": {
                            "algorithm": "m.megolm.v1.aes-sha2"
                        }
                    }
                ],
                "power_level_content_override": {
                    "events_default": 0,
                    "state_default": 50,
                    # Empêcher la désactivation du chiffrement
                    "events": {
                        "m.room.encryption": 100
                    }
                }
            }
            if invite_user_ids:
                payload["invite"] = invite_user_ids

            try:
                create_resp = client.post(create_url, headers=creator_headers, json=payload)
                if create_resp.status_code == 200:
                    return create_resp.json().get("room_id")
                return None
            except httpx.HTTPError:
                return None


# Instance par défaut du client Synapse
synapse_client = SynapseClient()
