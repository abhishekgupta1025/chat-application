# backend/Dockerfile
FROM oven/bun:1-slim

WORKDIR /app

# Copy dependency manifests for reproducible builds
COPY package.json bun.lock ./

# Install exact locked production dependencies
RUN bun install --production --frozen-lockfile

# Copy source code
COPY . .

EXPOSE 5000

CMD ["bun", "run", "src/server.ts"]
