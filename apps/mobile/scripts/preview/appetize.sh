#!/usr/bin/env bash
# Uploads the simulator build to Appetize so the owner can tap through the Dream Wedding app in a browser
# (docs/APP_PLAN.md). One stable app: APPETIZE_PUBLIC_KEY (repo variable APPETIZE_DREAM_WEDDING_PUBLIC_KEY) if set, else the app
# whose note is "dream-wedding-preview", else a new one, so the public link never changes.
#   APPETIZE_API_TOKEN=… [APPETIZE_PUBLIC_KEY=…] scripts/preview/appetize.sh <app.zip|app.apk> [ios|android]
# The iOS app keeps the note "dream-wedding-preview" (its link never changes); Android uses
# "dream-wedding-preview-android".
# No token: NAMED STOP [APPETIZE_TOKEN_MISSING] in the job summary, exit 0 (only the owner's
# Appetize account can provide it; the next run retries). A failed upload exits 1.
set -euo pipefail
zip="$1"; platform="${2:-ios}"; api=https://api.appetize.io/v1/apps
note=dream-wedding-preview; [ "$platform" = ios ] || note="dream-wedding-preview-$platform"
summary() { echo "$1"; [ -n "${GITHUB_STEP_SUMMARY:-}" ] && echo "$1" >> "$GITHUB_STEP_SUMMARY"; return 0; }
if [ -z "${APPETIZE_API_TOKEN:-}" ]; then
  summary "**Appetize:** NAMED STOP [APPETIZE_TOKEN_MISSING] repo secret APPETIZE_API_TOKEN is not set, so the build was not put online. Add it (free Appetize account → API token) and rerun; the simulator build is still attached to this run."
  exit 0
fi
[ -s "$zip" ] || { echo "NAMED STOP [APPETIZE_NO_BUILD] $zip is missing or empty" >&2; exit 1; }
key="${APPETIZE_PUBLIC_KEY:-}"
if [ -z "$key" ]; then
  key=$(curl -fsS "$api" -H "X-API-KEY: $APPETIZE_API_TOKEN" | jq -r --arg n "$note" --arg p "$platform" '[.data[]? | select(.note == $n and .platform == $p)][0].publicKey // empty') \
    || { echo "NAMED STOP [APPETIZE_LIST_FAILED] could not list Appetize apps" >&2; exit 1; }
fi
url="$api${key:+/$key}"
out=$(curl -fsS -X POST "$url" -H "X-API-KEY: $APPETIZE_API_TOKEN" -F "file=@$zip" -F "platform=$platform" -F "note=$note") \
  || { echo "NAMED STOP [APPETIZE_UPLOAD_FAILED] POST $url failed" >&2; exit 1; }
key=$(jq -r '.publicKey // empty' <<<"$out")
[ -n "$key" ] || { echo "NAMED STOP [APPETIZE_UPLOAD_FAILED] no publicKey in the reply" >&2; exit 1; }
summary "**Appetize ($platform):** uploaded. Open the app in a browser: https://appetize.io/app/$key (this link stays the same on every run)."
var=APPETIZE_DREAM_WEDDING_PUBLIC_KEY; [ "$platform" = ios ] || var=APPETIZE_DREAM_WEDDING_ANDROID_KEY
[ -n "${APPETIZE_PUBLIC_KEY:-}" ] || summary "To pin it, set repo variable $var=$key."
