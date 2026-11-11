#!/usr/bin/env bash
set -euo pipefail
stop() {
  echo 'NAMED STOP [PREVIEW_HOST_FAILED]'
  echo 'NAMED STOP [PREVIEW_HOST_FAILED]' >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
  exit 1
}
trap stop ERR
[[ -n "${CLOUDFLARE_API_TOKEN:-}" && -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]] || stop
[[ -n "${PREVIEW_PROJECT:-}" && -n "${PREVIEW_BRANCH:-}" ]] || stop
# Exported assets only; never run this from the website's Wrangler directory.
printf '/*\n  X-Robots-Tag: noindex, nofollow\n' > dist/_headers
printf 'User-agent: *\nDisallow: /\n' > dist/robots.txt
log=$(mktemp)
trap 'rm -f "$log"' EXIT
# Create on first use. An existing project refuses creation; deploy below still proves access.
npx --yes wrangler@4 pages project create "$PREVIEW_PROJECT" --production-branch main > "$log" 2>&1 || true
npx --yes wrangler@4 pages deploy dist --project-name "$PREVIEW_PROJECT" --branch "$PREVIEW_BRANCH" > "$log" 2>&1 || stop
# Only accept Wrangler's deployment URL, never another link in diagnostic output.
url=$(sed -nE 's/.*(https:\/\/[a-zA-Z0-9-]+\.'"$PREVIEW_PROJECT"'\.pages\.dev).*/\1/p' "$log" | head -n 1)
[[ -n "$url" ]] || stop
printf '%s\n' "$url" >> "$GITHUB_STEP_SUMMARY"
printf 'url=%s\n' "$url" >> "$GITHUB_OUTPUT"
printf '%s\n' "$url"
