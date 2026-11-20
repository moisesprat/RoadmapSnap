# API image, built from packages/api (own package-lock.json; Phase 2 may move the lockfile to the root).
# The Node version is provisional: Phase 2 owns the pin.
FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

USER node
EXPOSE 4000

CMD ["node", "src/server.js"]
