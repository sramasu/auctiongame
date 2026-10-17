# Deployment Guide — Auction Arena

## Quick local run

```bash
git clone https://github.com/sramasu/auctiongame.git
cd auctiongame
cp .env.example .env          # fill in optional API keys
npm install
npm run build                  # build the React client into client/dist
npm start                      # http://localhost:3000
```

For hot-reload development:
```bash
npm run dev    # node --watch server + vite dev server in parallel
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP + WebSocket port |
| `HOST` | `0.0.0.0` | Bind address |
| `SPORTSDB_KEY` | `123` (public) | TheSportsDB key — leave blank to use public key |
| `APIFOOTBALL_KEY` | — | API-Football key (100 free req/day) |
| `CRICAPI_KEY` | — | CricAPI key (free tier) |
| `TEST_URL` | `http://127.0.0.1:3000` | Target URL for test suites |

All stats API keys are optional. When omitted, the server uses a mock fallback that generates plausible stats from player ratings — the game is fully playable offline.

---

## Verifying stats providers

```bash
# Shows which providers are live and cache status
curl http://localhost:3000/api/stats/status

# Diagnoses a single player lookup (bypasses cache)
curl "http://localhost:3000/api/stats/diagnose?name=Kylian+Mbappe&sport=football"
curl "http://localhost:3000/api/stats/diagnose?name=Virat+Kohli&sport=cricket"
```

---

## Deploying to a VPS / PaaS

### Railway / Render / Fly.io

1. Connect the GitHub repo.
2. Set the environment variables in the dashboard.
3. Use the start command: `npm start`
4. Set `PORT` if the platform requires a specific value.

### Manual VPS (Ubuntu/Debian)

```bash
# Install Node 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Clone and install
git clone https://github.com/sramasu/auctiongame.git /opt/auctiongame
cd /opt/auctiongame && npm install && npm run build

# Run with PM2
npm install -g pm2
pm2 start server/src/index.js --name auction-arena --interpreter node
pm2 save && pm2 startup
```

### Nginx reverse proxy (WebSocket)

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        # WebSocket upgrade — REQUIRED for Socket.IO
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

> **Pitfall**: Socket.IO uses long-polling and WebSocket transport. The `Upgrade` and `Connection` headers are **required**. Without them, clients will fall back to polling and performance will degrade.

---

## Docker (optional)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "server/src/index.js"]
```

```bash
docker build -t auction-arena .
docker run -p 3000:3000 \
  -e APIFOOTBALL_KEY=your_key \
  -e CRICAPI_KEY=your_key \
  auction-arena
```

---

## Post-deploy checklist

- [ ] `GET /api/health` returns `{ ok: true }`
- [ ] `GET /api/stats/status` shows at least Mock as healthy
- [ ] Open two browser windows and create a room, start bidding
- [ ] Verify WebSocket connects (no fallback to polling in browser devtools)
- [ ] (Optional) Verify `GET /api/stats/diagnose?name=Virat+Kohli&sport=cricket` returns non-mock data if CricAPI key is set

---

## Pitfalls & known gotchas

1. **Route order**: In Express, `app.get("*", ...)` must come AFTER all `/api/` routes or it swallows API calls.
2. **Socket.IO proxy**: Missing Upgrade header breaks WebSocket — always configure nginx as shown above.
3. **CricAPI paging**: Only 5 results per page, use `?offset=N` not `?page=N`.
4. **TheSportsDB dead key**: The old free key `3` is retired. Always use `123` (built-in default).
5. **API-Football header**: Use `x-rapidapi-key`, not `Authorization`.
6. **TDZ hangs**: Circular imports can cause `ReferenceError: Cannot access 'X' before initialization` — keep stats/ isolated from game/.
7. **Cache schema**: If you change the stats object shape, `cacheClear()` on restart (or just restart the server — cache is in-memory).
