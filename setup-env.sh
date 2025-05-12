#!/usr/bin/env bash
set -e

#───────────────────────────────────────────────────────────
# 1. Verify prerequisites (Docker workflow)
#───────────────────────────────────────────────────────────
REQUIRED_CMDS=(docker docker-compose git openssl)
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
REDIS_PASSWORD=$(openssl rand -hex 12)
REDIS_URL="redis://:${REDIS_PASSWORD}@redis:6379"
SENTRY_DSN=""

echo
echo "Generated values:"
echo "  SESSION_SECRET = $SESSION_SECRET"
echo "  MONGO_URI      = $MONGO_URI"
echo "  REDIS_URL      = $REDIS_URL"
echo "  REDIS_PASSWORD = $REDIS_PASSWORD"
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
REDIS_PASSWORD=$REDIS_PASSWORD

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

#───────────────────────────────────────────────────────────
# 6. Create Docker Compose file with proper configuration
#───────────────────────────────────────────────────────────
cat > docker-compose.yml <<EOF
version: '3.8'

services:
  backend:
    build: .
    container_name: eve-backend
    ports:
      - "${PORT}:${PORT}"
    environment:
      NODE_ENV: production
      PORT: ${PORT}
      SESSION_SECRET: \${SESSION_SECRET}
      EVE_CLIENT_ID: \${EVE_CLIENT_ID}
      EVE_SECRET_KEY: \${EVE_SECRET_KEY}
      EVE_CALLBACK_URL: \${EVE_CALLBACK_URL}
      FRONTEND_URL: \${FRONTEND_URL}
      MONGO_URI: \${MONGO_URI}
      REDIS_URL: \${REDIS_URL}
      SENTRY_DSN: \${SENTRY_DSN}
    depends_on:
      - mongo
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${PORT}/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  worker:
    build: .
    container_name: eve-worker
    command: node workers/zkbWorker.js
    environment:
      NODE_ENV: production
      MONGO_URI: \${MONGO_URI}
      REDIS_URL: \${REDIS_URL}
      SENTRY_DSN: \${SENTRY_DSN}
    depends_on:
      - mongo
      - redis

  frontend:
    build:
      context: ./frontend
    container_name: eve-frontend
    ports:
      - "80:80"
    environment:
      REACT_APP_API_BASE: http://backend:${PORT}
    depends_on:
      - backend

  mongo:
    image: mongo:6.0
    container_name: eve-mongo
    volumes:
      - mongo-data:/data/db
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongo localhost:27017/${DB_NAME} --quiet
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    container_name: eve-redis
    command: ["redis-server", "--requirepass", "\${REDIS_PASSWORD}"]
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "\${REDIS_PASSWORD}", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  mongo-data:
  redis-data:
EOF

echo -e "\n✅  docker-compose.yml generated successfully!"

#───────────────────────────────────────────────────────────
# 7. Create Docker start script
#───────────────────────────────────────────────────────────
cat > start-docker.sh <<EOF
#!/usr/bin/env bash
set -e

# Check if .env file exists
if [ ! -f .env ]; then
  echo "⚠️  .env file not found. Please run ./setup.sh first."
  exit 1
fi

# Source the .env file to get variables
source .env

# Run docker-compose with the environment variables
echo "🚀 Starting Docker containers..."
docker-compose up \$@
EOF

chmod +x start-docker.sh

echo -e "\n✅  start-docker.sh script generated successfully!"
echo -e "\n🎉 Setup complete! Now you can run:"
echo -e "   ./start-docker.sh        # Run in foreground"
echo -e "   ./start-docker.sh -d     # Run in detached mode"
