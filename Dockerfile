FROM node:20-alpine

WORKDIR /app

# Dépendances d'abord pour profiter du cache Docker sur les rebuilds
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# Le dossier data/ doit exister avant le premier démarrage (le bot le crée
# aussi lui-même via services/dataStore.js, ceci évite juste un premier
# accès en tant que root avant le changement d'utilisateur ci-dessous).
RUN mkdir -p /app/data && chown -R node:node /app

# L'image officielle node fournit déjà un utilisateur non-root "node".
USER node

ENV NODE_ENV=production
ENV TZ=Europe/Paris

CMD ["node", "index.js"]
