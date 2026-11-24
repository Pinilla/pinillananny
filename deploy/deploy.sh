#!/usr/bin/env bash
# Deploys the main branch of pinillananny on server1. Run as pinilla:  ~/pinillananny/deploy/deploy.sh
# Pulls main into /opt/pinillananny, runs the tests and
# restarts the service. Stops at the first failure.
set -euo pipefail

APP=/opt/pinillananny
REPO=${PINILLANANNY_REPO:-https://github.com/Pinilla/pinillananny.git}
export PATH=/opt/node/bin:$PATH

if [ ! -d "$APP/.git" ]; then
  sudo mkdir -p "$APP"
  sudo chown "$USER:$USER" "$APP"
  git clone "$REPO" "$APP"
fi

cd "$APP"
git fetch origin main
git checkout --detach origin/main
echo "Deploying $(git log -1 --format='%h %s')"

# No dependencies to install.
npm test

sudo systemctl restart pinillananny
sleep 2
code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3300/healthz)
if [ "$code" != "200" ]; then
  echo "The app didn't answer after the restart (HTTP $code). Check: journalctl -u pinillananny -n 50" >&2
  exit 1
fi
echo "Deployed. https://nanny.pinillaweb.org"
