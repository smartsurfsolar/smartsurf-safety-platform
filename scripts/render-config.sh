#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Missing .env. Run scripts/init-env.sh first." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
. ./.env
set +a

if [ -z "${TRACCAR_DB_PASSWORD:-}" ]; then
  echo "TRACCAR_DB_PASSWORD is empty" >&2
  exit 1
fi

python3 - <<'PY'
import os
from pathlib import Path

template = Path("traccar.xml.template").read_text()
rendered = template.replace("${TRACCAR_DB_PASSWORD}", os.environ["TRACCAR_DB_PASSWORD"])
Path("traccar.xml").write_text(rendered)
PY

chmod 600 traccar.xml
echo "Rendered /opt/smartsurf-traccar/traccar.xml"
