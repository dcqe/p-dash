#!/usr/bin/env bash
# Linux source and packaged launcher. Java remains the sole process owner.
set -euo pipefail
umask 077
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
build=true
no_browser=false
for arg in "$@"; do
  case "$arg" in
    --no-build) build=false ;;
    --no-browser) no_browser=true ;;
    --help) echo 'Usage: bash run.sh [--no-build] [--no-browser]'; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done
for tool in java jq; do
  command -v "$tool" >/dev/null || { echo "Required tool missing: $tool" >&2; exit 1; }
done
export PDASH_DATA="${PDASH_DATA:-$PWD/.pdash}"
config="$PDASH_DATA/config.json"
port=4310
browser=true
if [[ -f "$config" ]]; then
  jq -e 'type == "object" and .version == 1 and
    ((has("settings") | not) or (.settings | type == "object" and
      (.port | type == "number" and . == floor and . >= 1 and . <= 65535) and
      (.openBrowser | type == "boolean") and (.demoEnabled | type == "boolean")))' "$config" >/dev/null || {
    echo 'Invalid config.json: expected version 1 and valid port/openBrowser/demoEnabled settings.' >&2
    exit 1
  }
  port=$(jq -r '.settings.port // 4310' "$config")
  browser=$(jq -r 'if .settings then .settings.openBrowser else true end' "$config")
fi
port="${PDASH_PORT:-$port}"
if [[ ! "$port" =~ ^[0-9]{1,5}$ ]] || (( 10#$port < 1 || 10#$port > 65535 )); then
  echo 'PDASH_PORT must be an integer from 1 to 65535.' >&2
  exit 1
fi
export PDASH_PORT="$((10#$port))"
if $no_browser || [[ -z "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]]; then browser=false; fi
export PDASH_OPEN_BROWSER="$browser"
if $build; then
  for tool in npm mvn; do
    command -v "$tool" >/dev/null || { echo "Required build tool missing: $tool" >&2; exit 1; }
  done
  (cd frontend && npm ci --no-audit --no-fund && npm test && npm run build)
  mvn -B clean package
fi
jar=target/quarkus-app/quarkus-run.jar
[[ -f "$jar" ]] || { echo 'Application package missing; build from source first.' >&2; exit 1; }
# exec delivers terminal and service signals directly to Java, without a supervisor.
exec java "-Djava.awt.headless=$([[ "$browser" == true ]] && echo false || echo true)" -jar "$jar"
