# Dockerfile
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get upgrade -y --no-install-recommends && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ENV NITRO_PRESET=node-server
RUN npm run build

# --- 実行用ステージ ---
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get upgrade -y --no-install-recommends && rm -rf /var/lib/apt/lists/*

COPY --from=build --chown=node:node /app/.output ./.output
# xlsx内部のcpexcel.js動的requireがビルド時の絶対パスを埋め込むため、
# 同じパス(/app/node_modules/xlsx)に配置しておく必要がある
COPY --from=build --chown=node:node /app/node_modules/xlsx ./node_modules/xlsx

USER node

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
