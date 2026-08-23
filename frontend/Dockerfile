# frontend/Dockerfile
FROM oven/bun:1-slim AS builder

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install

COPY . .

# Build Next.js production bundle
RUN bun run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

CMD ["npm", "start"]
