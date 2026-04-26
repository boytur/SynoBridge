# Release v0.1.0 🚀

**SynoBridge** — Your bridge to seamless SMB storage management.

## What's New

### ✨ Unified Docker Image
SynoBridge is now packaged as a **single, all-in-one Docker image**. Pull once, run everywhere — no multi-container setup needed.

```bash
docker pull boytur/synobridge:0.1.0
```

### 🏗️ Architecture
- **Go Backend** serves both the REST API and the compiled React frontend from a single process
- **SQLite** for lightweight, zero-config persistent storage
- **mDNS** auto-discovery of Bridge Agents on your local network
- **Auth0** optional authentication with email whitelist support

### 🎨 Frontend
- Beautiful glassmorphic dark/light theme UI built with React + Tailwind
- File Explorer with auto-sliding breadcrumb navigation
- Inline file preview (images, videos, text, code)
- Drag-and-drop file upload
- Quick Setup page with network scanner

### 📡 Bridge Agent
- Standalone binary for Windows and Linux
- Auto-discovers on the network via mDNS
- Secure one-click handshake to link NAS shares

---

## 📦 Downloads

### Docker Image
```bash
# Pull and run
docker run -d --name synobridge --network host \
  -v $(pwd)/data:/data \
  -e PORT=4455 \
  -e GIN_MODE=release \
  boytur/synobridge:0.1.0
```

Or use the included `docker-compose.deploy.yml`:
```bash
docker compose -f docker-compose.deploy.yml up -d
```

### Bridge Agent Binaries
| Platform | File |
|----------|------|
| Linux (amd64) | `synobridge-agent-linux-amd64` |
| Windows (amd64) | `synobridge-agent-windows-amd64.exe` |

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `80` | Port the server listens on |
| `DB_PATH` | `/data/synobridge.db` | SQLite database path |
| `GIN_MODE` | `debug` | Set to `release` for production |
| `ENCRYPTION_KEY` | `changeme...` | 32-byte key for encrypting credentials |
| `AUTH0_DOMAIN` | *(optional)* | Your Auth0 tenant domain |
| `AUTH0_AUDIENCE` | *(optional)* | Your Auth0 API audience |
| `ALLOWED_EMAILS` | *(optional)* | Comma-separated whitelist |

---

**Full Changelog**: https://github.com/boytur/SynoBridge/commits/v0.1.0
