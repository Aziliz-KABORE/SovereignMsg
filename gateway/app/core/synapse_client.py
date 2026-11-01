"""
SovereignMsg Gateway - Client Synapse Matrix (HTTPX)
====================================================
Interaction avec l'API d'administration et l'API client interne de Synapse :
- Création d'utilisateur : PUT /_synapse/admin/v2/users/<user_id>
  (N'envoie jamais l'email ni le ministère à Synapse pour préserver la confidentialité)
- Connexion Plan B (SYNAPSE_LOGIN_MODE=password) : POST /_matrix/client/v3/login
  (Accepte et transmet device_id pour assurer la persistance des clés cryptographiques)
- Désactivation d'utilisateur : POST /_synapse/admin/v1/deactivate/<user_id>
- Sécurité : Délais d'attente stricts, aucun mot de passe ni jeton dans les journaux.
"""

from typing import Optional, Dict, Any
import httpx
from app.core.config import settings


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
                return None
            except httpx.HTTPError:
                return None

    def deactivate_user(self, matrix_user_id: str) -> bool:
        """
        Désactive un compte utilisateur dans Synapse.
        Doc: https://element-hq.github.io/synapse/latest/admin_api/user_admin_api.html#deactivate-account
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
                return response.status_code == 200
            except httpx.HTTPError:
                return False


# Instance par défaut du client Synapse
synapse_client = SynapseClient()
