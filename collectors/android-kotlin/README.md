# Android RSSI Collector Skeleton

This is an optional open-source native collector for users who want RSSI samples. It is not required for the browser app.

Why native Android? Browsers do not expose Wi-Fi RSSI/SSID to JavaScript. Android native APIs can expose RSSI only after the user grants the required location permission.

Minimal implementation outline:

1. Create a new empty Android project in Android Studio Community Edition.
2. Add `android.permission.ACCESS_FINE_LOCATION`, `android.permission.ACCESS_WIFI_STATE`, and `android.permission.INTERNET`.
3. Use `WifiManager.connectionInfo` for `ssid`, `bssid`, and `rssi`.
4. POST JSON to `https://YOUR_BACKEND/api/samples`.
5. Keep visible copy honest: this is RSSI sampling, not CSI or wall imaging.

See `MainActivity.kt` for the core logic.
