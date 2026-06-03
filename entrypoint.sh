#!/bin/bash
set -e

# Start Next.js frontend in the background
echo "Starting Next.js dashboard..."
cd /app/frontend
pnpm start &

# Start Go backend in the foreground
echo "Starting Go control plane..."
cd /app
exec ./server
