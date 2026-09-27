#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
[[ -f target/quarkus-app/quarkus-run.jar && -f frontend/dist/index.html ]] || {
  echo 'Build frontend and run mvn clean package before packaging.' >&2; exit 1;
}
mkdir -p dist
# Explicit allowlist: never include local state, credentials, logs, or tool caches.
tar -czf dist/p-dash-linux.tar.gz run.sh README.md docs target/quarkus-app
(cd dist && sha256sum p-dash-linux.tar.gz > p-dash-linux.tar.gz.sha256)
