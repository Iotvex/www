#!/usr/bin/env bash
# Ship www: commit → GitHub → Vercel production
set -euo pipefail
ROOT="/"
cd ""

MSG="# Extract vercel token and set up home ship workflow
VERCEL_TOKEN=$(python3 -c "import json; print(json.load(open('/home/ubuntu/.local/share/com.vercel.cli/auth.json'))['token'])")
ORG_ID=team_graBUCm6rBWtKYk7lf9sTX7R
PROJECT_ID=prj_xRuSQDUK39eCrbvH90T9prDCGrAk

sshpass -p '9851' ssh -o StrictHostKeyChecking=no xlebpushek@95.31.206.51 "bash -s" << REMOTE
set -euo pipefail

# Install vercel CLI
if ! command -v vercel >/dev/null 2>&1; then
  sudo npm install -g vercel@latest 2>&1 | tail -8
fi
vercel --version | head -1

# Auth vercel via token file (same account)
mkdir -p /home/xlebpushek/.local/share/com.vercel.cli
python3 - << 'PY'
import json, os
auth = {
  "token": """$VERCEL_TOKEN""",
}
# Actually pass via env
PY
# write auth properly
mkdir -p /home/xlebpushek/.local/share/com.vercel.cli
printf '%s\n' "{\"token\":\"$VERCEL_TOKEN\"}" > /home/xlebpushek/.local/share/com.vercel.cli/auth.json
chmod 600 /home/xlebpushek/.local/share/com.vercel.cli/auth.json
vercel whoami 2>&1 | head -5

cd /home/xlebpushek/iotvex/www
mkdir -p .vercel
printf '%s\n' "{\"projectId\":\"$PROJECT_ID\",\"orgId\":\"$ORG_ID\",\"projectName\":\"iotvex\"}" > .vercel/project.json

# Ship script: commit + push + vercel prod (until Git integration works)
cat > scripts/ship.sh << 'EOF'
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
  # never commit secrets
  git reset HEAD -- .env .env.local .env.cron config/runtime.secrets.json config/cloud-client.env config/publish-state.json config/publish-run 2>/dev/null || true
  git commit -m "$MSG" || true
fi

git push origin HEAD:main

# Until Vercel GitHub App is installed on Iotvex org, deploy from tree:
if command -v vercel >/dev/null 2>&1; then
  vercel deploy --prod --yes --scope xlebp-rjanois-projects
  # keep both aliases warm
  URL="$(vercel ls iotvex --scope xlebp-rjanois-projects 2>/dev/null | awk '/https:\/\/iotvex-.*vercel.app/ {print \$2; exit}')"
  if [[ -n "\${URL:-}" ]]; then
    vercel alias set "\$URL" iotvex.vercel.app --scope xlebp-rjanois-projects || true
    vercel alias set "\$URL" iotvex-www.vercel.app --scope xlebp-rjanois-projects || true
  fi
else
  echo "vercel CLI missing — pushed to GitHub only"
fi

echo "Shipped. Repo: https://github.com/Iotvex/www"
echo "Prod:  https://iotvex.vercel.app"
