FROM node:24-bookworm-slim AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/prisma ./apps/api/prisma
RUN npm ci
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate --schema apps/api/prisma/schema.prisma
COPY apps/api ./apps/api
RUN npm run build --workspace @skillbridge/api
RUN npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=4000 LOCAL_STORAGE_DIR=/data/private
WORKDIR /app
COPY --from=build --chown=node:node /workspace/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /workspace/apps/api/dist ./apps/api/dist
RUN mkdir -p /data/private && chown -R node:node /data
VOLUME ["/data"]
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=4s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:4000/api/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/src/server.js"]
