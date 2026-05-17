# Browser and Android Compatibility

## Works in Browser

- Network latency via `/api/ping`
- Jitter via round-trip timing changes
- Connectivity interruption detection
- Network Information API where the browser supports it
- Manual room-position sampling
- Custom multi-floor house mapping in browser local storage
- Door/window likely-state inference when enough nearby samples exist
- Real-time WebSocket updates
- Heatmap visualization
- Pseudo-3D signal cloud

## Usually Restricted

- SSID in browser JavaScript
- BSSID in browser JavaScript
- RSSI in browser JavaScript
- Channel utilization
- CSI
- Raw packets
- Guaranteed door/window state

These restrictions are intentional browser privacy protections.

## Android

Recommended:

- Chrome or Firefox on Android
- Same Wi-Fi as the backend during local development
- Keep the screen awake while walking samples

Optional RSSI:

- Requires native Android collector
- Requires location permission
- Must be clearly labeled as RSSI, not CSI

## Desktop

Windows, Linux, and macOS can run the backend and frontend. The optional PC collector may work only if OS Wi-Fi commands expose signal strength.
