# ---------- 1️⃣ Dependencies Stage ----------
FROM node:lts-alpine3.23 AS deps

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# ---------- 2️⃣ Build Stage ----------
FROM node:lts-alpine3.23 AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build frontend/backend if using Vite/TS
RUN npm run build

# ---------- 3️⃣ Production Runtime ----------
FROM node:lts-alpine3.23 AS runtime

WORKDIR /app

ENV NODE_ENV=production

# Copy only necessary files
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# If using Prisma (uncomment if needed)
# COPY --from=build /app/prisma ./prisma
# RUN npx prisma generate

EXPOSE 3000

CMD ["node", "dist/index.js"]