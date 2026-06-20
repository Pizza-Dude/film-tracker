#!/bin/sh
set -e

PORT="${PORT:-4519}"
export PORT

echo "Starte Filme-App auf 0.0.0.0:${PORT} ..."
exec python server.py
