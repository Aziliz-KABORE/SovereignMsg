# ==============================================================================
# SovereignMsg - Dockerfile Nginx Reverse Proxy & Client PWA
# ==============================================================================
# Étape 1 : Construction du client React PWA avec Node.js 20
FROM node:20-alpine AS client-builder
WORKDIR /app
COPY client/package.json ./
RUN npm install --legacy-peer-deps
COPY client/ ./
RUN npm run build

# Étape 2 : Reverse Proxy Nginx sécurisé
FROM nginx:1.27-alpine
# Copie des fichiers statiques compilés de la PWA
COPY --from=client-builder /app/dist /var/www/html
# Copie de la configuration Nginx durcie
COPY deploy/nginx/nginx.conf /etc/nginx/nginx.conf

# Création du dossier pour les certificats TLS
RUN mkdir -p /etc/nginx/certs

EXPOSE 443
CMD ["nginx", "-g", "daemon off;"]

