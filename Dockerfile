# Image de production de Valyo (Next.js + PostgreSQL externe).
# Les migrations s'appliquent automatiquement au premier accès à la base, sous verrou :
# aucune étape de migration séparée. Le worker éditorial utilise la même image :
#   docker run … valyo npm run worker
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=build /app ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/sante').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Next.js lancé directement (pas via npm) : il reçoit lui-même le SIGTERM envoyé quand une
# nouvelle version le remplace, et s'arrête proprement (code 0) ; via npm, l'arrêt était
# signalé en erreur et Railway envoyait une alerte « Deploy Crashed » à chaque mise en ligne.
CMD ["node", "node_modules/next/dist/bin/next", "start"]
