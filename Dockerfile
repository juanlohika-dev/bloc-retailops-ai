# Multi-stage Dockerfile optimized for Google Cloud Run (asia-southeast1)
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./
RUN npm ci

# Copy source code and configuration
COPY . .

# Production runner stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy dependencies and source
COPY package*.json ./
RUN npm ci --omit=dev && npm install -g tsx

COPY --from=builder /app/src ./src
COPY --from=builder /app/docs ./docs
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/local.db ./local.db

EXPOSE 8080

CMD ["tsx", "src/api/server.ts"]
