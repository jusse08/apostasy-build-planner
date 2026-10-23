# Apostasy character planner: SvelteKit (adapter-node) + SQLite (node:sqlite).
# Game data from data/ is baked into the image; saved builds live on a volume.

FROM node:24-slim AS build
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build && npm prune --omit=dev

FROM node:24-slim
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data \
    DB_PATH=/var/lib/planner/builds.sqlite \
    NODE_NO_WARNINGS=1
WORKDIR /app/web
COPY --from=build /app/web/build ./build
COPY --from=build /app/web/node_modules ./node_modules
COPY --from=build /app/web/package.json ./
COPY data /app/data
RUN mkdir -p /var/lib/planner && chown node:node /var/lib/planner
USER node
VOLUME /var/lib/planner
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/builds').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "build"]
