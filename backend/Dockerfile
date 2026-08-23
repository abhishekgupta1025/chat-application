# backend/Dockerfile
FROM oven/bun:1-slim

WORKDIR /app

# Copy dependency manifests
COPY package.json bun.lock* ./

# Install production dependencies
RUN bun install --production

# Copy source code
COPY . .

EXPOSE 5000

CMD ["bun", "run", "src/server.ts"]
