#!/usr/bin/env bash
# ==============================================================================
# SovereignMsg - Tests de vérification des critères d'acceptation (Étape 1)
# ==============================================================================
# Critères testés :
# 1. docker compose up -d démarre tous les conteneurs (nginx, gateway, synapse, postgres)
# 2. Seul le port 443 répond depuis l'extérieur (les ports 8008, 5432, 8000 sont fermés)
# 3. Tentatives bloquées depuis l'extérieur via Nginx (code 403 ou 404 attendu) :
#    - POST /_matrix/client/v3/login
#    - POST /_matrix/client/r0/login
#    - POST /_matrix/client/unstable/login
#    - POST /_matrix/client/v3/register
#    - GET /_synapse/admin/v1/users
# 4. L'accès public à l'inscription est refusé
# 5. Depuis l'intérieur du conteneur passerelle, l'API d'administration fonctionne.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

FAILED_TESTS=0
TOTAL_TESTS=0

report_test() {
    local name="$1"
    local status="$2"
    local detail="$3"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [[ "${status}" == "PASS" ]]; then
        echo -e "  ✅ [PASS] ${name} : ${detail}"
    else
        echo -e "  ❌ [FAIL] ${name} : ${detail}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

echo "======================================================================"
echo "🛡️  VÉRIFICATION DES CRITÈRES D'ACCEPTATION - ÉTAPE 1 (SovereignMsg)"
echo "======================================================================"

# ------------------------------------------------------------------------------
# Test 1 : Vérification de l'état des conteneurs Docker
# ------------------------------------------------------------------------------
echo -e "\n--- Test 1 : État des conteneurs de la pile Docker ---"
RUNNING_SERVICES=$(docker compose -f "${ROOT_DIR}/docker-compose.yml" ps --status running -q | wc -l || true)
if [[ ${RUNNING_SERVICES} -ge 4 ]]; then
    report_test "Conteneurs en cours d'exécution" "PASS" "${RUNNING_SERVICES} conteneurs actifs"
else
    report_test "Conteneurs en cours d'exécution" "FAIL" "Seulement ${RUNNING_SERVICES} conteneur(s) actif(s)"
fi

# ------------------------------------------------------------------------------
# Test 2 : Port 443 ouvert et TLS opérationnel
# ------------------------------------------------------------------------------
echo -e "\n--- Test 2 : Seul le port 443 répond vers l'extérieur ---"
HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" https://127.0.0.1:443/ || echo "ERR")
if [[ "${HTTP_CODE}" == "200" || "${HTTP_CODE}" == "304" ]]; then
    report_test "Port 443 HTTPS" "PASS" "Répond avec code HTTP ${HTTP_CODE}"
else
    report_test "Port 443 HTTPS" "FAIL" "Code HTTP inattendu : ${HTTP_CODE}"
fi

# Ports internes qui NE DOIVENT PAS répondre depuis l'extérieur
for PORT in 8008 8000 5432 8448; do
    PORT_CHECK=$(curl -s --connect-timeout 2 http://127.0.0.1:${PORT}/ || true)
    if [[ -z "${PORT_CHECK}" ]]; then
        report_test "Port interne ${PORT} fermé à l'extérieur" "PASS" "Aucune réponse externe"
    else
        report_test "Port interne ${PORT} fermé à l'extérieur" "FAIL" "Le port ${PORT} a répondu depuis l'hôte !"
    fi
done

# ------------------------------------------------------------------------------
# Test 3 : Blocage strict par Nginx des routes Matrix sensibles depuis l'extérieur
# ------------------------------------------------------------------------------
echo -e "\n--- Test 3 : Blocage Nginx des routes Matrix sensibles depuis l'extérieur ---"

# 3.1 : POST /_matrix/client/v3/login
CODE_V3_LOGIN=$(curl -k -s -o /dev/null -w "%{http_code}" -X POST https://127.0.0.1:443/_matrix/client/v3/login -H "Content-Type: application/json" -d '{"user":"test"}')
if [[ "${CODE_V3_LOGIN}" == "403" || "${CODE_V3_LOGIN}" == "404" ]]; then
    report_test "Blocage POST /_matrix/client/v3/login" "PASS" "Code HTTP ${CODE_V3_LOGIN} (Accès bloqué)"
else
    report_test "Blocage POST /_matrix/client/v3/login" "FAIL" "Reçu HTTP ${CODE_V3_LOGIN} au lieu de 403/404"
fi

# 3.2 : POST /_matrix/client/r0/login
CODE_R0_LOGIN=$(curl -k -s -o /dev/null -w "%{http_code}" -X POST https://127.0.0.1:443/_matrix/client/r0/login -H "Content-Type: application/json" -d '{"user":"test"}')
if [[ "${CODE_R0_LOGIN}" == "403" || "${CODE_R0_LOGIN}" == "404" ]]; then
    report_test "Blocage POST /_matrix/client/r0/login" "PASS" "Code HTTP ${CODE_R0_LOGIN} (Accès bloqué)"
else
    report_test "Blocage POST /_matrix/client/r0/login" "FAIL" "Reçu HTTP ${CODE_R0_LOGIN} au lieu de 403/404"
fi

# 3.3 : POST /_matrix/client/unstable/login
CODE_UNSTABLE_LOGIN=$(curl -k -s -o /dev/null -w "%{http_code}" -X POST https://127.0.0.1:443/_matrix/client/unstable/login -H "Content-Type: application/json" -d '{"user":"test"}')
if [[ "${CODE_UNSTABLE_LOGIN}" == "403" || "${CODE_UNSTABLE_LOGIN}" == "404" ]]; then
    report_test "Blocage POST /_matrix/client/unstable/login" "PASS" "Code HTTP ${CODE_UNSTABLE_LOGIN} (Accès bloqué)"
else
    report_test "Blocage POST /_matrix/client/unstable/login" "FAIL" "Reçu HTTP ${CODE_UNSTABLE_LOGIN} au lieu de 403/404"
fi

# 3.4 : POST /_matrix/client/v3/register
CODE_V3_REG=$(curl -k -s -o /dev/null -w "%{http_code}" -X POST https://127.0.0.1:443/_matrix/client/v3/register -H "Content-Type: application/json" -d '{"username":"hacker"}')
if [[ "${CODE_V3_REG}" == "403" || "${CODE_V3_REG}" == "404" ]]; then
    report_test "Blocage POST /_matrix/client/v3/register" "PASS" "Code HTTP ${CODE_V3_REG} (Accès bloqué)"
else
    report_test "Blocage POST /_matrix/client/v3/register" "FAIL" "Reçu HTTP ${CODE_V3_REG} au lieu de 403/404"
fi

# 3.5 : GET /_synapse/admin/v1/users
CODE_ADMIN_USERS=$(curl -k -s -o /dev/null -w "%{http_code}" https://127.0.0.1:443/_synapse/admin/v1/users)
if [[ "${CODE_ADMIN_USERS}" == "403" || "${CODE_ADMIN_USERS}" == "404" ]]; then
    report_test "Blocage GET /_synapse/admin/v1/users" "PASS" "Code HTTP ${CODE_ADMIN_USERS} (Accès bloqué)"
else
    report_test "Blocage GET /_synapse/admin/v1/users" "FAIL" "Reçu HTTP ${CODE_ADMIN_USERS} au lieu de 403/404"
fi

# ------------------------------------------------------------------------------
# Test 4 : Les routes Matrix autorisées passent bien (ex: /_matrix/client/versions)
# ------------------------------------------------------------------------------
echo -e "\n--- Test 4 : Vérification des routes publiques Matrix autorisées ---"
CODE_VERSIONS=$(curl -k -s -o /dev/null -w "%{http_code}" https://127.0.0.1:443/_matrix/client/versions)
if [[ "${CODE_VERSIONS}" == "200" ]]; then
    report_test "Pass-through /_matrix/client/versions" "PASS" "Code HTTP 200 (Synapse répond à travers Nginx)"
else
    report_test "Pass-through /_matrix/client/versions" "FAIL" "Code HTTP inattendu : ${CODE_VERSIONS}"
fi

# ------------------------------------------------------------------------------
# Test 5 : Accès d'administration interne depuis le conteneur passerelle
# ------------------------------------------------------------------------------
echo -e "\n--- Test 5 : Appel d'administration interne depuis la passerelle ---"
TOKEN_FILE="${ROOT_DIR}/.synapse_admin_token"
if [[ -f "${TOKEN_FILE}" ]]; then
    ADMIN_TOKEN=$(cat "${TOKEN_FILE}" | tr -d '\r\n')
    INTERNAL_CALL_STATUS=$(docker compose -f "${ROOT_DIR}/docker-compose.yml" exec -T gateway \
        curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer ${ADMIN_TOKEN}" \
        http://synapse:8008/_synapse/admin/v1/users || echo "ERR")

    if [[ "${INTERNAL_CALL_STATUS}" == "200" ]]; then
        report_test "Appel Synapse Admin depuis le conteneur gateway" "PASS" "Code HTTP 200 (Succès interne)"
    else
        report_test "Appel Synapse Admin depuis le conteneur gateway" "FAIL" "Code HTTP ${INTERNAL_CALL_STATUS}"
    fi
else
    echo "  ⚠️ Fichier .synapse_admin_token absent. Lancez d'abord scripts/bootstrap_admin.sh."
fi

# ------------------------------------------------------------------------------
# Bilan
# ------------------------------------------------------------------------------
echo -e "\n======================================================================"
if [[ ${FAILED_TESTS} -eq 0 ]]; then
    echo "🎉 TOUS LES TESTS DE L'ÉTAPE 1 ONT RÉUSSI (${TOTAL_TESTS}/${TOTAL_TESTS}) !"
    echo "======================================================================"
    exit 0
else
    echo "⚠️ CERTAINS TESTS ONT ÉCHOUÉ : ${FAILED_TESTS} échec(s) sur ${TOTAL_TESTS} tests."
    echo "======================================================================"
    exit 1
fi
