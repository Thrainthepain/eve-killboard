# EVE Online Smart Report Generator

**Full‑stack application for generating and sharing EVE Online battle reports.**

---

## Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Quick Start (Docker)](#quick-start-docker)
4. [Local Development](#local-development)
5. [Environment Variables](#environment-variables)
6. [CI/CD & Deployment](#cicd--deployment)
7. [Project Structure](#project-structure)
8. [Scripts](#scripts)
9. [Contributing](#contributing)

---

## Features

* 🚀 **EVE SSO** authentication with automatic token refresh
* 📊 **Report generation** from ESI, zKillboard, or manual input
* 💾 **MongoDB** persistence for generated reports
* 🏗️ **Background worker** (Bull + Redis) for async report processing
* 🔐 **Security**: Helmet, rate‑limiting, Redis‑backed sessions
* 🐳 **Docker‑first** deploy (backend, frontend, worker, Mongo, Redis)
* 📈 **Sentry** error monitoring & health endpoint
* 🧪 **Jest** unit tests & GitHub Actions CI
* 🧹 **ESLint + Prettier** code quality for backend & frontend

---

## Architecture

```
┌────────────┐   HTTP   ┌────────────┐
│  Frontend  │────────►│  Backend   │
└────────────┘         └────────────┘
     ▲   ▲                  ▲   ▲
React │   │ REST API        │   │ Bull Queue
     │   │                  │   │
┌────┴───┴────┐           ┌─┴────┴───┐
│   Nginx     │           │  Worker  │
└─────────────┘           └──────────┘
       │                       │
       │Mongo Queries          │Mongo Writes
       ▼                       ▼
   ┌────────┐             ┌────────┐
   │ Mongo  │◄─── Redis ─►│ Redis  │
   └────────┘             └────────┘
```

---

## Quick Start (Docker)

```bash
# 1. Clone repo
git clone https://github.com/Thrainthepain/eve-report-generator.git
cd eve-report-generator

# 2. Generate .env interactively
chmod +x setup-env.sh
./setup-env.sh

# 3. Build & start containers
docker-compose up -d

# 4. Open your browser
# Frontend:  http://localhost
# Backend:   http://localhost:5000
# Swagger UI: http://localhost:5000/api/docs
```

> **Need to rebuild?** `docker-compose build --no-cache && docker-compose up -d`

---

## Local Development

### Backend

```bash
npm install    # root directory
npm run dev    # nodemon (add if desired)
```

### Frontend

```bash
cd frontend
npm install
npm start      # React dev server at http://localhost:3000
```

### Worker

```bash
npm run start:worker
```

MongoDB & Redis must be running locally or via Docker (see `docker-compose.yml`).

---

## Environment Variables

See **.env.example** for every key. Generate a real `.env` via `setup-env.sh`.

Key vars:

| Variable                           | Description                     |
| ---------------------------------- | ------------------------------- |
| `PORT`                             | Backend port (default 5000)     |
| `SESSION_SECRET`                   | Cookie/session secret           |
| `EVE_CLIENT_ID` / `EVE_SECRET_KEY` | Credentials from EVE Dev Portal |
| `MONGO_URI`                        | MongoDB connection string       |
| `REDIS_URL`                        | Redis connection string         |
| `SENTRY_DSN`                       | Sentry project DSN              |

---

## CI/CD & Deployment

* **GitHub Actions** pipeline: tests, lint, staging + production deploys.
* **Heroku** for backend (Procfile) – configure `HEROKU_API_KEY`, `HEROKU_APP_NAME_*` secrets.
* **Netlify** for static frontend – configure `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`.
* Images built via **Dockerfile** (Node 18‑alpine) and multi‑stage Nginx for React.

---

## Project Structure

```
backend
├─ server.js
├─ routes/         REST endpoints
├─ services/       ESI, zKB, processing
├─ models/         Mongoose schemas
├─ middleware/     Auth, logging
├─ workers/        Bull queue workers
├─ tests/          Jest specs
└─ config/         Convict configs
frontend           React app (Tailwind)
├─ public/
└─ src/
Dockerfile         Backend image
frontend/Dockerfile Frontend image
```

---

## Scripts

```bash
npm start           # start backend
npm run start:worker# start zKB worker
npm test            # run Jest tests
npm run lint        # ESLint + Prettier check
setup-env.sh        # create .env interactively
start-containers.sh # helper to build + run docker-compose
```

---

## Contributing

1. Fork & clone.
2. Create a feature branch.
3. Commit with Conventional Commits.
4. Push & open PR – the CI pipeline will run tests + lint.
5. Ensure PR passes before requesting review.

All contributions welcome – fly safe o7!
