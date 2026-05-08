#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ]; then
  echo ".env already exists"
  exit 0
fi

umask 077
{
  echo "TRACCAR_DB_PASSWORD=$(openssl rand -hex 24)"
  echo "TRACCAR_DB_ROOT_PASSWORD=$(openssl rand -hex 24)"
  echo "SMARTSURF_PUBLIC_HOST=smartsurf.global"
} > .env

echo "Created .env"
