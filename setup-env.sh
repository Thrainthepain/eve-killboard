#!/usr/bin/env bash
set -e

#───────────────────────────────────────────────────────────
# 1. Verify prerequisites (Docker workflow)
#───────────────────────────────────────────────────────────
REQUIRED_CMDS=(docker docker-compose git)
MISSING=false

echo "Checking prerequisites..."
for cmd in "${REQUIRED_CMDS[@]}"; do
  if ! command -v "$cmd" &> /dev/null; then
    echo "Error: $cmd is not installed." >&2
    MISSING=true
  fi
done

if [ "$MISSING" = true ]; then
  echo -e "\nInstall the missing tools and re‑run."
  exit 1
fi

#───────────────────────────────────────────────────────────
# 2. Helper – prompt with default
#───────────────────────────────────────────────────────────
prompt () {
  local name="$1"
  local default="$2"
  read -p "$name [$default]: " input
  echo "${input:-$default}"
}

#───────────────────────────────────────────────────────────
# 3. Auto‑generate secrets / URIs
#───────────────────────────────────────────────────────────
RANDOM_HEX() { openssl rand -hex 24; }

SESSION_SECRET=$(RANDOM_HEX)
DB_NAME="eve_reports_$(date +%s)"
MONGO_URI="mongodb://mongo:27017/${DB_NAME}"
REDIS_PASS=$(openssl rand -hex 12)
REDIS_URL="redis://:${REDIS_PASS}@redis:6379"
SENTRY_DSN=""

echo
echo "Generated values:"
echo "  SESSION_SECRET = $SESSION_SECRET"
echo "  MONGO_URI      = $MONGO_URI"
echo "  REDIS_URL      = $REDIS_URL"
echo

#───────────────────────────────────────────────────────────
# 4. Collect the rest from user (with sensible defaults)
#───────────────────────────────────────────────────────────
PORT=$(prompt "PORT" "5000")
FRONTEND_URL=$(prompt "FRONTEND_URL" "http://localhost")
EVE_CLIENT_ID=$(prompt "EVE_CLIENT_ID" "your_eve_client_id")
EVE_SECRET_KEY=$(prompt "EVE_SECRET_KEY" "your_eve_secret_key")
EVE_CALLBACK_URL=$(prompt "EVE_CALLBACK_URL" "http://localhost:${PORT}/auth/eve/callback")

# CI/CD secrets — leave blank if not using
HEROKU_API_KEY=$(prompt "HEROKU_API_KEY" "")
HEROKU_APP_NAME_STAGING=$(prompt "HEROKU_APP_NAME_STAGING" "eve-report-staging-$(RANDOM_HEX | head -c 6)")
HEROKU_APP_NAME_PROD=$(prompt "HEROKU_APP_NAME_PROD" "eve-report-prod-$(RANDOM_HEX | head -c 6)")
NETLIFY_AUTH_TOKEN=$(prompt "NETLIFY_AUTH_TOKEN" "")
NETLIFY_SITE_ID=$(prompt "NETLIFY_SITE_ID" "")

SENTRY_DSN=$(prompt "SENTRY_DSN" "$SENTRY_DSN")

#───────────────────────────────────────────────────────────
# 5. Write the .env file
#───────────────────────────────────────────────────────────
cat > .env <<EOF
# ─── Backend ───────────────────────────────────────────────
PORT=$PORT
SESSION_SECRET=$SESSION_SECRET
FRONTEND_URL=$FRONTEND_URL
EVE_CLIENT_ID=$EVE_CLIENT_ID
EVE_SECRET_KEY=$EVE_SECRET_KEY
EVE_CALLBACK_URL=$EVE_CALLBACK_URL
MONGO_URI=$MONGO_URI
REDIS_URL=$REDIS_URL

# ─── Monitoring ────────────────────────────────────────────
SENTRY_DSN=$SENTRY_DSN

# ─── CI/CD Secrets (optional) ──────────────────────────────
HEROKU_API_KEY=$HEROKU_API_KEY
HEROKU_APP_NAME_STAGING=$HEROKU_APP_NAME_STAGING
HEROKU_APP_NAME_PROD=$HEROKU_APP_NAME_PROD
NETLIFY_AUTH_TOKEN=$NETLIFY_AUTH_TOKEN
NETLIFY_SITE_ID=$NETLIFY_SITE_ID
EOF

echo -e "\n✅  .env generated successfully!"
echo "• SESSION_SECRET is a random 48‑character hex string."
echo "• MONGO_URI uses unique DB name: ${DB_NAME}"
echo "• REDIS_URL includes a random password."
echo "Edit the file if you need to change anything."
