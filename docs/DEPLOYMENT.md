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

## Render Free Backend

1. Push this repo to GitHub.
2. In Render, create a new Web Service from the repo.
3. Render can use `render.yaml`, or set:
   - Root Directory: `backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Copy the backend URL.

## GitHub Pages Frontend

GitHub Pages is free for public repos.

1. Set repository secrets or environment variable at build time:
   - `VITE_API_BASE=https://YOUR_RENDER_BACKEND`
   - `VITE_WS_BASE=wss://YOUR_RENDER_BACKEND_HOST`
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
