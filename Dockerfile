# Build do backend a partir da raiz do monorepo (npm workspaces).
# O frontend NÃO entra nesta imagem — ele é publicado separadamente na Vercel.

FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --omit=peer --workspace backend

COPY backend backend
RUN npm run build --workspace backend

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json .npmrc ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --omit=dev --omit=peer --workspace backend

COPY --from=build /app/backend/dist backend/dist

EXPOSE 3000
CMD ["node", "backend/dist/server.js"]
