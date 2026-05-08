#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

stamp="$(date +%Y%m%d-%H%M%S)"
mkdir -p backups

docker exec smartsurf-traccar-db sh -c \
  'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" traccar' \
  > "backups/traccar-${stamp}.sql"

tar -czf "backups/smartsurf-traccar-config-${stamp}.tar.gz" \
  docker-compose.yml Dockerfile traccar.xml.template README.md docs mysql-init

echo "Created backups/traccar-${stamp}.sql"
echo "Created backups/smartsurf-traccar-config-${stamp}.tar.gz"
