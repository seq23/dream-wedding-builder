#!/usr/bin/env bash
# Commit step for the shared search engine (search-loop.yml, default branch only).
# Re-derives the lastmod ledger (the /questions hub moves with its newest page)
# and the committed per-host sitemaps from the engine's ledger on every run - a
# publish adds URLs, a 90-day merge removes one so the sitemaps
# stay current without waiting for another lane. Then commits the engine ledger,
# the pages, the sitemaps and any redirect, and pushes with a bounded rebase
# retry. IndexNow is submitted by the engine itself.
set -euo pipefail
# The engine inlines a thin Organization (name + url only) as each Article's
# author and publisher, ahead of the header's complete entity graph, so the
# first Organization an engine reads on the page has no logo and no sameAs
# (Search Readiness c1, flagged 2026-11-03). It also builds related-questions
# links from the repository path, so public/questions/<slug>.html was linked as
# /public/questions/<slug> - public/ is the web root, so all 53 answered 404.
# Point the Article at the one brand record and the links at the served route
# before anything else reads the pages, and gate the links.
node scripts/seo/normalize_question_entity.mjs
node scripts/seo/normalize_question_routes.mjs
node scripts/seo/build_lastmod_ledger.mjs > /dev/null
node scripts/authority/build-sitemaps.mjs
node scripts/validators/validate_question_links.mjs
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -A data/search-loop public/questions artifacts/sitemaps data/seo/lastmod_ledger.json
[ -f public/_redirects ] && git add public/_redirects
if git diff --cached --quiet; then echo "search-loop: nothing to commit"; exit 0; fi
git commit -q -m "${COMMIT_MESSAGE:-search loop: daily pages, checks and ledger}"
for i in 1 2 3 4 5; do
  git push origin HEAD:main && exit 0
  git pull --rebase origin main || { echo "NAMED STOP [PUSH_CONFLICT] rebase onto main failed; the next run redoes today's work" >&2; exit 9; }
done
echo "NAMED STOP [PUSH_FAILED] five push attempts failed" >&2
exit 9
