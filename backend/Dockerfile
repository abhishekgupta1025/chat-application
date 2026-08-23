# backend/Dockerfile
FROM oven/bun:1-slim

WORKDIR /app

# Copy dependency manifest
COPY package.json ./

# Install production dependencies cleanly without lockfile freeze
RUN bun install --production --no-save

# Copy source code
COPY . .

EXPOSE 5000

CMD ["bun", "run", "src/server.ts"]
