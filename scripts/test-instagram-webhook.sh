#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/test-instagram-webhook.sh \
    --app-url https://museinbox.vercel.app \
    --app-secret YOUR_INSTAGRAM_APP_SECRET \
    --account-id YOUR_CONNECTED_INSTAGRAM_USER_ID \
    --media-id 18000000000000000 \
    --comment-id 17890000000000000 \
    --text "PROMPT"

Notes:
  - Sends a signed POST to /api/instagram/webhook.
  - This simulates Meta's webhook delivery. It does not create a real Instagram comment.
EOF
}

APP_URL=""
APP_SECRET=""
ACCOUNT_ID=""
MEDIA_ID=""
COMMENT_ID=""
TEXT=""
FIELD="comments"
TIMESTAMP=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-url) APP_URL="${2:-}"; shift 2 ;;
    --app-secret) APP_SECRET="${2:-}"; shift 2 ;;
    --account-id) ACCOUNT_ID="${2:-}"; shift 2 ;;
    --media-id) MEDIA_ID="${2:-}"; shift 2 ;;
    --comment-id) COMMENT_ID="${2:-}"; shift 2 ;;
    --text) TEXT="${2:-}"; shift 2 ;;
    --field) FIELD="${2:-}"; shift 2 ;;
    --timestamp) TIMESTAMP="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -z "$APP_URL" || -z "$APP_SECRET" || -z "$ACCOUNT_ID" || -z "$MEDIA_ID" || -z "$COMMENT_ID" || -z "$TEXT" ]]; then
  usage
  exit 1
fi

if [[ -z "$TIMESTAMP" ]]; then
  TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%S+0000")"
fi

BODY=$(cat <<EOF
{"object":"instagram","entry":[{"id":"$ACCOUNT_ID","changes":[{"field":"$FIELD","value":{"id":"$COMMENT_ID","media_id":"$MEDIA_ID","text":"$TEXT","timestamp":"$TIMESTAMP"}}]}]}
EOF
)

SIGNATURE=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$APP_SECRET" | awk '{print $NF}')

curl -sS -X POST "${APP_URL%/}/api/instagram/webhook" \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=$SIGNATURE" \
  --data "$BODY"
echo
