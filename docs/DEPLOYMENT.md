# Free Deployment Guide

## Local Development

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend:

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. On Android, open `http://YOUR_PC_LAN_IP:5173` while the phone is on the same Wi-Fi.

## Render Without Blueprint

Do not use **New > Blueprint**. Render can ask for payment details there.

Use two normal manual services instead:

1. Create the backend as a **Web Service**.
2. Copy the backend URL.
3. Create the frontend as a **Static Site**.
4. Paste the backend URL into the frontend environment variables.

### Backend Web Service

Render Dashboard -> **New > Web Service**

- Name: `aethersense-api`
- Runtime: `Python 3`
- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health Check Path: `/api/health`
- Instance Type: `Free`
- Environment Variables:
  - `PYTHON_VERSION=3.12.0`

After deploy, open:

```text
https://YOUR-AETHERSENSE-API.onrender.com/api/health
```

You should see:

```json
{"status":"ok","stack":"fastapi-free-open-source"}
```

### Frontend Static Site

Render Dashboard -> **New > Static Site**

- Name: `aethersense`
- Runtime: `Static Site`
- Root Directory: leave blank
- Build Command: `npm ci && npm run build`
- Publish Directory: `dist`
- Instance Type: `Free`
- Rewrite Rule:
  - Source: `/*`
  - Destination: `/index.html`
- Environment Variables:
  - `VITE_API_BASE=https://YOUR-AETHERSENSE-API.onrender.com`
  - `VITE_WS_BASE=https://YOUR-AETHERSENSE-API.onrender.com`

The frontend accepts `https://` for `VITE_WS_BASE` and converts it to `wss://` in the browser.

## Render Backend Only

If you want to host the frontend somewhere else, create only the backend service:

1. Push this repo to GitHub.
2. In Render, create a new Web Service from the repo.
3. Set:
   - Root Directory: `backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Health Check Path: `/api/health`
4. Copy the backend URL and use it as the frontend's `VITE_API_BASE` and `VITE_WS_BASE`.

## GitHub Pages Frontend

GitHub Pages is free for public repos.

1. Set repository secrets or environment variable at build time:
   - `VITE_API_BASE=https://YOUR_RENDER_BACKEND`
   - `VITE_WS_BASE=https://YOUR_RENDER_BACKEND`
2. Run `npm run build`.
3. Publish `dist/` using Pages or a GitHub Actions workflow.

Cloudflare Pages, Netlify free, and Vercel hobby can also deploy the frontend from the repo. Set the same environment variables.

## Potato-PC Mode

Use the frontend sampling profile called `Potato PC`. It reduces visual density and sample frequency expectations. Backend analysis is already lightweight and bounded to recent samples.

## Important Limits

- Free hosting sleeps or throttles on some platforms.
- Browser RSSI is unavailable on most Android browsers.
- WebSocket support depends on the free host.
- HTTPS is required for some browser APIs.
