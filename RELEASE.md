# Release v0.2.1 🚀

**SynoBridge** — Improved Authentication & Decoupled Configuration.

## What's New

### ✨ Generic Docker Image (Runtime Config)
Starting from `v0.2.0`, the SynoBridge Docker image is now **entirely generic**. Authentication settings (Auth0) are no longer baked into the frontend at build-time. Instead, the frontend fetches its configuration from the backend at runtime.

This means you can pull the same image and configure it for any domain or Auth0 tenant just by changing environment variables.

### 🛡️ Robust Authentication
- **Secure Origin Validation:** Clear UI feedback when attempting to use Auth0 over insecure (non-HTTPS) connections.
- **Configuration Safety:** Automatic detection of missing credentials (like `AUTH0_CLIENT_ID`) with helpful on-screen instructions.
- **No-Auth Mode:** Seamlessly falls back to unauthenticated mode if no Auth0 variables are provided, allowing for quick internal deployments.

### 📦 Docker Image
```bash
docker pull boytur/synobridge:v0.2.1
```

---

## 🚀 Quick Start

```yaml
services:
  synobridge:
    image: boytur/synobridge:v0.2.1
    container_name: synobridge
    network_mode: host
    environment:
      - GIN_MODE=release
      - PORT=4455
      - DB_PATH=/data/synobridge.db
      - ENCRYPTION_KEY=your-32-character-secret-key
      # Optional: Auth0 settings
      - AUTH0_DOMAIN=your-tenant.auth0.com
      - AUTH0_CLIENT_ID=your-client-id
      - AUTH0_AUDIENCE=your-api-identifier
      - ALLOWED_EMAILS=user@example.com
    volumes:
      - ./data:/data
    restart: unless-stopped
```

---

## ⚙️ Updated Environment Variables

| Variable | Description |
|----------|-------------|
| `AUTH0_DOMAIN` | Your Auth0 tenant domain (e.g., `tenant.auth0.com`) |
| `AUTH0_CLIENT_ID` | **(New)** Your Auth0 Application Client ID |
| `AUTH0_AUDIENCE` | Your Auth0 API Identifier (Audience) |
| `ALLOWED_EMAILS` | Comma-separated list of allowed user emails |

---

**Full Changelog**: https://github.com/boytur/SynoBridge/commits/v0.2.1
