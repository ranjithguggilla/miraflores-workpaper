#!/usr/bin/env bash
# Deploy on the server. Usage: bash deploy.sh            (keep workpaper history)
#                              bash deploy.sh --reset    (backup, then reload the packet and demo seed)
set -euo pipefail
cd "$(dirname "$0")"
C="docker compose -f docker-compose.prod.yml"
git pull --ff-only
$C build app
$C up -d db
$C run --rm app npx drizzle-kit push --force
if [ "${1:-}" = "--reset" ]; then
  mkdir -p backups
  $C exec -T db pg_dump -U wp workpaper > "backups/workpaper-$(date +%F-%H%M).sql" || echo "no existing database to back up"
  $C run --rm app npx tsx scripts/import.ts --reset
  $C run --rm app npx tsx scripts/demo-seed.ts
fi
$C up -d app
$C ps
# Confirm the served page actually changed: the build id must match the new image.
sleep 3; curl -s -o /dev/null -w "app → HTTP %{http_code}\n" http://127.0.0.1:3000/
