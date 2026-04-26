# SynoBridge 🚀

SynoBridge is a modern, high-fidelity web application designed to seamlessly bridge legacy SMB NAS units and file servers into a sleek, fast, and secure web experience. It features a cross-platform Bridge Agent and a beautiful React-based frontend.

## 📸 UI Overview
*(Screenshot placeholder - you can replace this with a screenshot of your beautiful dashboard!)*

---

## 📦 Production Setup Guide

Deploying SynoBridge to production is straightforward using Docker and Docker Compose. This ensures your Backend, Frontend, and Database are neatly containerized and easily manageable.

### 1. Prerequisites
- [Docker](https://docs.docker.com/get-docker/) installed on your host machine.
- [Docker Compose](https://docs.docker.com/compose/install/) installed.
- Git.

### 2. Clone the Repository
```bash
git clone https://github.com/boytur/SynoBridge.git
cd SynoBridge
```

### 3. Configure Environment Variables
You need to set up your environment variables, specifically for your database credentials and optional Auth0 configuration.

```bash
cp .env.example .env
```
Open `.env` and fill in your details (e.g., `DB_PASSWORD`, `AUTH0_DOMAIN`).

### 4. Deploy with Docker Compose
To build and spin up the entire production stack (Frontend Nginx, Go Backend, PostgreSQL Database), simply use the production compose file.

```bash
# Build and run in detached mode
docker compose -f docker-compose.prod.yml up -d --build
```

### 5. Verify Deployment
Check the status of your containers to ensure they are running smoothly:
```bash
docker compose -f docker-compose.prod.yml ps
```

Your SynoBridge instance should now be accessible on port `80` (or whichever port you configured in your Nginx reverse proxy).

---

## 📡 Deploying the Bridge Agent (Legacy NAS Connect)

To connect a legacy network share, you need to run the **Bridge Agent** on a machine within the same local network as the file server.

1. Navigate to the `bridge/` directory.
2. Build the agent for your target OS:
   ```bash
   # For Linux
   cd bridge
   GOOS=linux GOARCH=amd64 go build -o synobridge-agent main.go
   
   # For Windows
   cd bridge
   GOOS=windows GOARCH=amd64 go build -o synobridge-agent.exe main.go
   ```
3. Run the executable. It will broadcast its presence via mDNS and host a local setup UI on port `8888`.
4. Open the agent's local IP (e.g., `http://localhost:8888`) to configure the target credentials and link it to your SynoBridge workspace!

Enjoy your modern file management experience! 🎉
