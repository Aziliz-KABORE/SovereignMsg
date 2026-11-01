#!/usr/bin/env bash
# ==============================================================================
# SovereignMsg - Génération des certificats TLS de démonstration
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CERTS_DIR="${ROOT_DIR}/deploy/nginx/certs"

echo "🔐 [SovereignMsg] Génération du certificat TLS auto-signé pour la démonstration..."

mkdir -p "${CERTS_DIR}"

KEY_FILE="${CERTS_DIR}/server.key"
CRT_FILE="${CERTS_DIR}/server.crt"
CSR_FILE="${CERTS_DIR}/server.csr"
EXT_FILE="${CERTS_DIR}/server.ext"

# Configuration des extensions SAN (Subject Alternative Name)
cat > "${EXT_FILE}" <<EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = sovereign.local
DNS.3 = sovereignmsg.local
IP.1 = 127.0.0.1
EOF

# Génération de la clé privée RSA 4096 bits
openssl genrsa -out "${KEY_FILE}" 4096

# Génération de la CSR
openssl req -new -key "${KEY_FILE}" -out "${CSR_FILE}" \
    -subj "/C=BF/ST=Kadiogo/L=Ouagadougou/O=MTDPCE-DGTD/OU=Securite-Souveraine/CN=sovereign.local"

# Signature du certificat X.509 v3 valide 365 jours
openssl x509 -req -in "${CSR_FILE}" -signkey "${KEY_FILE}" -out "${CRT_FILE}" \
    -days 365 -sha256 -extfile "${EXT_FILE}"

# Nettoyage des fichiers temporaires
rm -f "${CSR_FILE}" "${EXT_FILE}"

# Permissions restrictives sur la clé privée
chmod 600 "${KEY_FILE}"
chmod 644 "${CRT_FILE}"

echo "✅ Certificat TLS généré avec succès :"
echo "   - Clé privée :  ${KEY_FILE}"
echo "   - Certificat :  ${CRT_FILE}"
echo "   - Noms (SAN) :  localhost, sovereign.local, 127.0.0.1"

