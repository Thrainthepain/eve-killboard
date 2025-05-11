#!/usr/bin/env bash

# Required commands
REQUIRED_CMDS=(node npm docker docker-compose mongosh redis-cli git)
MISSING=false

echo "Checking prerequisites..."
for cmd in "${REQUIRED_CMDS[@]}"; do
  if ! command -v "$cmd" &> /dev/null; then
    echo "Error: $cmd is not installed." >&2
    MISSING=true
  fi
done

if [ "$MISSING" = true ]; then
  echo
  echo "Please install missing dependencies and re-run."
  exit 1
fi

echo "All prerequisites found. Generating .env..."

# Prompt helper (with defaults)
prompt() {
  local name="$1"
  local default="$2"
  read -p "$name [$default]: " input
  echo "${input:-$default}"
}

# Collect values
PORT=$(prompt "PORT" "5000")
SESSION_SECRET=$(prompt "SESSION_SECRET" "your_session_secret")
FRONTEND_URL=$(prompt "FRONTEND_URL" "http://localhost")
EVE_CLIENT_ID=$(prompt "EVE_CLIENT_ID" "your_eve_client_id")
EVE_SECRET_KEY=$(prompt "EVE_SECRET_KEY" "your_eve_secret_key")
EVE_CALLBACK_URL=$(prompt "EVE_CALLBACK_URL" "http://localhost:5000/auth/eve/callback")
MONGO_URI=$(prompt "MONGO_URI" "mongodb://localhost:27017/eve_reports")
REDIS_URL=$(prompt "REDIS_URL" "redis://localhost:6379")
SENTRY_DSN=$(prompt "SENTRY_DSN" "")
HEROKU_API_KEY=$(prompt "HEROKU_API_KEY" "")
HEROKU_APP_NAME_STAGING=$(prompt "HEROKU_APP_NAME_STAGING" "")
HEROKU_APP_NAME_PROD=$(prompt "HEROKU_APP_NAME_PROD" "")
NETLIFY_AUTH_TOKEN=$(prompt "NETLIFY_AUTH_TOKEN" "")
NETLIFY_SITE_ID=$(prompt "NETLIFY_SITE_ID" "")

# Write to .env
cat <<EOF > .env
PORT=$PORT
SESSION_SECRET=$SESSION_SECRET
FRONTEND_URL=$FRONTEND_URL
EVE_CLIENT_ID=$EVE_CLIENT_ID
EVE_SECRET_KEY=$EVE_SECRET_KEY
EVE_CALLBACK_URL=$EVE_CALLBACK_URL
MONGO_URI=$MONGO_URI
REDIS_URL=$REDIS_URL
SENTRY_DSN=$SENTRY_DSN
HEROKU_API_KEY=$HEROKU_API_KEY
HEROKU_APP_NAME_STAGING=$HEROKU_APP_NAME_STAGING
HEROKU_APP_NAME_PROD=$HEROKU_APP_NAME_PROD
NETLIFY_AUTH_TOKEN=$NETLIFY_AUTH_TOKEN
NETLIFY_SITE_ID=$NETLIFY_SITE_ID
EOF

echo ".env file generated successfully."