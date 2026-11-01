#!/usr/bin/env bash
# ==============================================================================
# SovereignMsg - Amorçage du compte Administrateur Synapse dédié à la Passerelle
# ==============================================================================
# RÔLE :
# 1. Attend que Synapse soit prêt.
# 2. Crée l'administrateur Synapse dédié via register_new_matrix_user avec le secret
#    d'enregistrement lu dans l'environnement.
# 3. Obtient un access_token par connexion interne (POST /_matrix/client/v3/login).
# 4. Enregistre le token dans .synapse_admin_token et met à jour SYNAPSE_ADMIN_TOKEN.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Chargement des variables d'environnement depuis .env si présent
if [[ -f "${ROOT_DIR}/.env" ]]; then
    set -a
    source "${ROOT_DIR}/.env"
    set +a
fi

ADMIN_USER="${SYNAPSE_ADMIN_USERNAME:-sovereign_gateway_admin}"
ADMIN_PASS="${SYNAPSE_ADMIN_PASSWORD:-AdminDemoMatrix2026!}"
REG_SECRET="${SYNAPSE_REGISTRATION_SHARED_SECRET:-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef}"
SERVER_NAME="${SYNAPSE_SERVER_NAME:-sovereign.local}"

echo "🚀 [SovereignMsg] Démarrage du bootstrap de l'administrateur Synapse..."

# Vérification de l'état de santé du conteneur Synapse
echo "[*] Attente du serveur Synapse interne..."
MAX_RETRIES=30
RETRY_COUNT=0
until docker compose -f "${ROOT_DIR}/docker-compose.yml" exec -T synapse curl -s -f http://localhost:8008/_matrix/client/versions > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [[ ${RETRY_COUNT} -ge ${MAX_RETRIES} ]]; then
        echo "❌ Erreur : Synapse ne répond pas sur http://localhost:8008 après 30 tentatives."
        exit 1
    fi
    echo "    Synapse en cours d'initialisation... (${RETRY_COUNT}/${MAX_RETRIES})"
    sleep 2
done
echo "✅ Synapse est opérationnel."

# Création du compte administrateur Matrix dédié à la passerelle
echo "[*] Création du compte d'administration Matrix : @${ADMIN_USER}:${SERVER_NAME}..."
set +e
REGISTER_OUTPUT=$(docker compose -f "${ROOT_DIR}/docker-compose.yml" exec -T synapse \
    register_new_matrix_user \
    -u "${ADMIN_USER}" \
    -p "${ADMIN_PASS}" \
    -a \
    -c /etc/synapse/homeserver.yaml \
    http://localhost:8008 2>&1)
REGISTER_STATUS=$?
set -e

if [[ ${REGISTER_STATUS} -eq 0 ]]; then
    echo "✅ Utilisateur d'administration Matrix créé avec succès."
else
    if echo "${REGISTER_OUTPUT}" | grep -iq "User ID already taken"; then
        echo "ℹ️ Le compte administrateur Matrix existe déjà (opération idempotente)."
    else
        echo "⚠️ Sortie lors de l'enregistrement : ${REGISTER_OUTPUT}"
    fi
fi

# Connexion interne pour obtenir l'access_token (via le réseau interne Synapse)
echo "[*] Obtention de l'access_token par authentification interne..."
LOGIN_PAYLOAD=$(cat <<EOF
{
    "type": "m.login.password",
    "identifier": {
        "type": "m.id.user",
        "user": "${ADMIN_USER}"
    },
    "password": "${ADMIN_PASS}",
    "initial_device_display_name": "SovereignMsg-Gateway-Daemon"
}
EOF
)

LOGIN_RESPONSE=$(docker compose -f "${ROOT_DIR}/docker-compose.yml" exec -T synapse \
    curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "${LOGIN_PAYLOAD}" \
    http://localhost:8008/_matrix/client/v3/login)

ACCESS_TOKEN=$(echo "${LOGIN_RESPONSE}" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4 || true)

if [[ -z "${ACCESS_TOKEN}" ]]; then
    echo "❌ Échec de la récupération de l'access_token Matrix. Réponse du serveur :"
    echo "${LOGIN_RESPONSE}"
    exit 1
fi

echo "✅ Jeton d'administration Matrix obtenu avec succès (longueur: ${#ACCESS_TOKEN} caractères)."

# Stockage sécurisé hors Git
TOKEN_FILE="${ROOT_DIR}/.synapse_admin_token"
echo "${ACCESS_TOKEN}" > "${TOKEN_FILE}"
chmod 600 "${TOKEN_FILE}"

# Mise à jour du fichier .env si présent
if [[ -f "${ROOT_DIR}/.env" ]]; then
    if grep -q "^SYNAPSE_ADMIN_TOKEN=" "${ROOT_DIR}/.env"; then
        sed -i "s|^SYNAPSE_ADMIN_TOKEN=.*|SYNAPSE_ADMIN_TOKEN=${ACCESS_TOKEN}|" "${ROOT_DIR}/.env"
    else
        echo "SYNAPSE_ADMIN_TOKEN=${ACCESS_TOKEN}" >> "${ROOT_DIR}/.env"
    fi
    echo "✅ Variable SYNAPSE_ADMIN_TOKEN mise à jour dans .env."
fi

echo "🔄 Redémarrage du conteneur de la passerelle avec le nouveau jeton..."
docker compose -f "${ROOT_DIR}/docker-compose.yml" restart gateway > /dev/null 2>&1 || true

echo "🎉 Bootstrap de l'administrateur Synapse achevé avec succès !"
