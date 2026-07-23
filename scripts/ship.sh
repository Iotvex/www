#!/usr/bin/env bash
# Ship www: commit → GitHub → Vercel production
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MSG="${1:-}"
if [[ -z "$MSG" ]]; then
  MSG="chore(www): ship $(date -u +%Y-%m-%dT%H:%MZ)"
fi

git status -sb
if [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  git reset HEAD -- .env .env.local .env.cron \
    config/runtime.secrets.json config/cloud-client.env \
    config/publish-state.json config/publish-run 2>/dev/null || true
  git commit -m "$MSG" || true
fi

git push origin HEAD:main

if ! command -v vercel >/dev/null 2>&1; then
  echo "vercel CLI missing — pushed to GitHub only"
  echo "Repo: https://github.com/Iotvex/www"
  exit 0
fi

# Until Vercel GitHub App is installed on the Iotvex org, deploy from the tree.
DEPLOY_URL="$(vercel deploy --prod --yes --scope xlebp-rjanois-projects | tee /dev/stderr | grep -Eo 'https://iotvex-[a-z0-9]+-xlebp-rjanois-projects\.vercel\.app' | tail -1 || true)"
if [[ -n "${DEPLOY_URL:-}" ]]; then
  vercel alias set "$DEPLOY_URL" iotvex.vercel.app --scope xlebp-rjanois-projects || true
  vercel alias set "$DEPLOY_URL" iotvex-www.vercel.app --scope xlebp-rjanois-projects || true
fi

echo "Shipped."
echo "Repo: https://github.com/Iotvex/www"
echo "Prod: https://iotvex.vercel.app"
