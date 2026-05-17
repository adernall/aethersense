# Troubleshooting

## Frontend says WebSocket closed

Check that the backend is running:

```bash
curl http://127.0.0.1:8000/api/health
```

If deployed, verify `VITE_WS_BASE` starts with `wss://`.

## Android phone cannot open local app

Use the PC's LAN IP, not `localhost`.

```bash
ipconfig
```

Look for the Wi-Fi IPv4 address and open `http://IP_ADDRESS:5173` on the phone.

## RSSI is unavailable

That is expected in normal browsers. Use browser-safe timing mode or the optional Android/PC collector.

## Heatmap looks sparse

Walk the room and tap your approximate position before each sample burst. Interpolation confidence increases with coverage.

## Breathing mode stays disabled

That is expected. It requires stable high-rate RSSI samples and still has very low reliability. It is not medical and not a vital-sign detector.

## Free backend sleeps

Some free hosts sleep after inactivity. Open the app once and wait for the backend to wake up.
