#!/usr/bin/env bash
# Deploy on the server. Usage: bash deploy.sh            (keep workpaper history)
#                              bash deploy.sh --reset    (backup, then reload the packet and demo seed)
set -euo pipefail
cd "$(dirname "$0")"
C="docker compose -f docker-compose.prod.yml"
git pull --ff-only
$C build app tools
$C up -d db
$C run --rm tools drizzle-kit push --force
if [ "${1:-}" = "--reset" ]; then
  mkdir -p backups
  $C exec -T db pg_dump -U wp workpaper > "backups/workpaper-$(date +%F-%H%M).sql" || echo "no existing database to back up"
  $C run --rm tools tsx scripts/import.ts --reset
  $C run --rm tools tsx scripts/demo-seed.ts
fi
$C up -d app
$C ps
sleep 4
# The served app must answer with the packet identity before we call this deployed.
curl -fsS http://127.0.0.1:3000/api/health && echo
