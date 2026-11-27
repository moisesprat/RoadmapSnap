# API image, built from the repo root (context ".", see compose.yaml and the root .dockerignore):
#   docker build -f packages/api/Dockerfile -t roadmapsnap-api .
# One root package-lock.json drives the install. Node 24 is pinned for the whole repo (D-16).

# Stage 1: keep only every workspace's package.json, so npm ci sees the full workspace
# graph without copying sources. New workspaces are picked up without editing this file.
FROM node:24-alpine AS manifests
COPY packages /packages
RUN find /packages -mindepth 2 -maxdepth 2 ! -name package.json -exec rm -rf {} +

FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY --from=manifests /packages ./packages
RUN npm ci -w @roadmapsnap/api --omit=dev && npm cache clean --force

COPY packages/api/src ./packages/api/src

WORKDIR /app/packages/api

USER node
EXPOSE 4000

CMD ["node", "src/server.js"]
