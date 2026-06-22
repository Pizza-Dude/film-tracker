#!/bin/sh
set -e
cd "$(dirname "$0")"

echo "Stoppe alte Container..."
docker compose down --remove-orphans 2>/dev/null || true
docker rm -f film-tracker 2>/dev/null || true

echo "Baue und starte neu auf Port 4519..."
docker compose up --build -d

echo ""
echo "Status:"
docker compose ps
echo ""
echo "Port-Bindung:"
docker port film-tracker 2>/dev/null || true
echo ""
echo "Erreichbar unter:"
echo "  http://localhost:4519"
echo "  http://$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo 'DEINE-IP'):4519"
