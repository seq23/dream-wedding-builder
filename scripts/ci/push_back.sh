#!/usr/bin/env bash
# Push the current HEAD back to a remote ref without turning a green run red.
#
#   scripts/ci/push_back.sh <ref>          e.g. scripts/ci/push_back.sh "$GITHUB_REF_NAME"
#
# WHAT WENT WRONG
# ---------------
# Full Safe Autonomy run 34957914196 (main, 2026-09-15) passed every gate, then
# its last step ran `git pull --rebase` + `git push` and got:
#
#   ! [remote rejected] HEAD -> main (cannot lock ref 'refs/heads/main':
#       is at 7f8bbfd7... but expected fd94a6fb...)
#
# 7f8bbfd7 IS the commit the step had just made - `[main 7f8bbfd] authority:
# record distribution receipts` is three lines above the rejection in the same
# log. The server had applied the update and then reported the ref-lock as a
# failure. The receipts were on main; the run went red anyway, because a bare
# `git push` treats "the ref is not where I expected" as final without asking
# where the ref actually is.
#
# The same bare push is equally blind to the ordinary race: something else
# lands on the ref between `git pull --rebase` and `git push`, which is a
# rejection a fetch-rebase-retry clears in seconds.
#
# WHAT THIS DOES
# --------------
# Bounded loop. Each attempt:
#   1. fetches the ref;
#   2. if the ref already contains HEAD there is nothing left to do -
#      PUSH_ALREADY_LANDED on a retry (the 34957914196 case), NOTHING_TO_PUSH on
#      the first attempt (no commit was made);
#   3. otherwise rebases HEAD onto the ref, and a real conflict is a NAMED
#      failure (PUSH_REBASE_CONFLICT) - never resolved by force;
#   4. pushes. Success is PUSHED. A rejection loops.
# After the attempts are spent it fails as PUSH_EXHAUSTED and names the ref
# the remote is at. Every exit path prints one of these codes on its own line
# as `push_back: <CODE>` so the log can never show a silent outcome.
#
# Never --force, never --force-with-lease: a lane that runs unreviewed on a
# schedule must not be able to move main backwards.
set -euo pipefail

REF="${1:?usage: push_back.sh <ref>}"
REMOTE="${PUSH_BACK_REMOTE:-origin}"
ATTEMPTS="${PUSH_BACK_ATTEMPTS:-5}"
BACKOFF="${PUSH_BACK_BACKOFF_SECONDS:-2}"

say() { echo "push_back: $*"; }

for attempt in $(seq 1 "$ATTEMPTS"); do
  git fetch --quiet "$REMOTE" "refs/heads/$REF"
  remote_sha="$(git rev-parse FETCH_HEAD)"
  head_sha="$(git rev-parse HEAD)"

  if git merge-base --is-ancestor "$head_sha" "$remote_sha"; then
    if [ "$attempt" -eq 1 ]; then
      say "NOTHING_TO_PUSH - $REMOTE/$REF ($remote_sha) already contains HEAD ($head_sha); no commit was made by this step"
    else
      say "PUSH_ALREADY_LANDED - $REMOTE/$REF ($remote_sha) already contains HEAD ($head_sha); the previous push was applied even though the remote reported a rejection"
    fi
    exit 0
  fi

  if [ "$(git merge-base "$head_sha" "$remote_sha")" != "$remote_sha" ]; then
    say "attempt $attempt: $REMOTE/$REF moved to $remote_sha; rebasing $head_sha onto it"
    if ! git rebase --autostash "$remote_sha"; then
      if ! git rebase --abort; then
        say "rebase --abort itself failed; the worktree may still be mid-rebase - inspect before re-running"
      fi
      say "PUSH_REBASE_CONFLICT - HEAD ($head_sha) does not rebase cleanly onto $REMOTE/$REF ($remote_sha). Nothing was pushed. Resolve by hand; this lane will not force."
      exit 1
    fi
  fi

  if git push "$REMOTE" "HEAD:refs/heads/$REF"; then
    say "PUSHED - $(git rev-parse HEAD) -> $REMOTE/$REF (attempt $attempt of $ATTEMPTS)"
    exit 0
  fi
  say "attempt $attempt of $ATTEMPTS: push to $REMOTE/$REF rejected; refetching"
  sleep "$((attempt * BACKOFF))"
done

remote_now="unknown (final refetch failed)"
if git fetch --quiet "$REMOTE" "refs/heads/$REF"; then
  remote_now="$(git rev-parse FETCH_HEAD)"
fi
say "PUSH_EXHAUSTED - $ATTEMPTS attempts to push $(git rev-parse HEAD) to $REMOTE/$REF were rejected; remote is at $remote_now. Nothing was forced."
exit 1
