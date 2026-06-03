# Stage 1: Build the Go Backend
FROM golang:1.25-bookworm AS backend-builder
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -ldflags "-X main.version=docker" -o better-paas-backend .

# Stage 2: Build the Next.js Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /src/frontend
RUN npm install -g pnpm
COPY frontend/package.json frontend/pnpm-lock.yaml* ./
RUN pnpm install --no-frozen-lockfile
COPY frontend/ ./
RUN pnpm build

# Stage 3: Final Runner Image
FROM debian:bookworm-slim
WORKDIR /app

# Install system dependencies and apply security updates
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    git \
    lsb-release \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Install Docker CLI (so the backend can manage containers on the host)
RUN mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null && \
    apt-get update && apt-get install -y --no-install-recommends docker-ce-cli docker-buildx-plugin && \
    rm -rf /var/lib/apt/lists/*

# Install Caddy (reverse proxy managed by the backend)
RUN curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg && \
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list && \
    apt-get update && apt-get install -y --no-install-recommends caddy && \
    rm -rf /var/lib/apt/lists/*

# Install Nixpacks (build environment)
RUN curl -sSL https://nixpacks.com/install.sh | bash

# Install Node.js and pnpm (required to run the frontend server)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    npm install -g pnpm && \
    rm -rf /var/lib/apt/lists/*

# Copy backend binary
COPY --from=backend-builder /src/better-paas-backend /app/server

# Copy frontend build and source files
COPY --from=frontend-builder /src/frontend /app/frontend

# Copy entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Expose required ports:
# 80: HTTP (Caddy proxy)
# 443: HTTPS (Caddy proxy)
# 3000: Next.js Frontend (direct)
# 8080: Go Backend API (direct)
EXPOSE 80 443 3000 8080

# Environment variables
ENV LISTEN_ADDR=":8080"
ENV FRONTEND_PORT="3000"
ENV NEXT_PUBLIC_API_URL=""
ENV RUNNING_IN_DOCKER="true"

ENTRYPOINT ["/app/entrypoint.sh"]
