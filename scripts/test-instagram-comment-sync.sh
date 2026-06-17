#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/test-instagram-comment-sync.sh \
    --app-url https://museinbox.vercel.app \
    --media-id 18000000000000000

Notes:
  - Calls /api/instagram/comments/sync for one reel or post.
  - This asks the app to fetch current comments from Instagram and process them.
EOF
}

APP_URL=""
MEDIA_ID=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-url) APP_URL="${2:-}"; shift 2 ;;
    --media-id) MEDIA_ID="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -z "$APP_URL" || -z "$MEDIA_ID" ]]; then
  usage
  exit 1
fi

curl -sS -X POST "${APP_URL%/}/api/instagram/comments/sync" \
  -H "Content-Type: application/json" \
  --data "{\"mediaId\":\"$MEDIA_ID\"}"
echo
