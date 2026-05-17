# Optional Local Collectors

AetherSense works in a normal browser without any collector, but browsers usually hide Wi-Fi RSSI and SSID for privacy. These optional collectors are open source, zero-cost ways to add better local data when the operating system allows it.

## Android

The web app is Android-friendly in Chrome/Firefox and can collect latency, jitter, connection changes, and rough downlink information.

For RSSI, Android requires a native app permission (`ACCESS_FINE_LOCATION`) because nearby Wi-Fi identifiers can reveal location. This repository includes a Kotlin collector skeleton in `android-kotlin/` that can POST RSSI samples to the FastAPI backend. Build it with Android Studio Community Edition or Gradle. It is optional.

## Low-End PC

The Python PC collector can read Wi-Fi info from the local OS where available and POST samples into the same session. It has no paid dependencies.

```bash
python collectors/pc_wifi_collector.py --api http://127.0.0.1:8000 --session YOUR_SESSION_ID
```

Windows support uses `netsh wlan show interfaces`. Linux support tries `iw dev`/`iwconfig`. macOS support tries `airport`.

If the OS refuses RSSI access, the collector exits clearly instead of inventing values.
