# ==============================================================================
# SovereignMsg - Dockerfile Client PWA (Node.js 20 Alpine)
# ==============================================================================
FROM node:20-alpine AS build

WORKDIR /app

# Copie des manifestes de dépendances
COPY package.json ./

# Installation des dépendances avec versions exactes
RUN npm install --legacy-peer-deps

# Copie du code source complet
COPY . .

# Construction du bundle de production PWA
RUN npm run build

# Image de distribution statique autonome pour test ou export
FROM nginx:1.27-alpine
COPY --from=build /app/dist /var/www/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

