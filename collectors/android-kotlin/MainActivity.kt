package org.aethersense.collector

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.wifi.WifiManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : ComponentActivity() {
    private val handler = Handler(Looper.getMainLooper())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val permissionLauncher = registerForActivityResult(
            ActivityResultContracts.RequestPermission()
        ) {}

        setContent {
            val status = remember { mutableStateOf("Idle") }
            val api = remember { mutableStateOf("http://YOUR_BACKEND_URL") }
            val session = remember { mutableStateOf("PASTE_SESSION_ID") }

            Column(modifier = Modifier.padding(20.dp)) {
                Text("AetherSense RSSI Collector")
                Text("Native Android RSSI only. No CSI, no imaging, no medical sensing.")
                Text(status.value)
                Button(onClick = {
                    if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                        permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
                    } else {
                        status.value = "Collecting RSSI"
                        schedulePost(api.value, session.value, status)
                    }
                }) {
                    Text("Start")
                }
            }
        }
    }

    private fun schedulePost(api: String, session: String, status: androidx.compose.runtime.MutableState<String>) {
        handler.postDelayed({
            Thread {
                try {
                    val wifi = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
                    val info = wifi.connectionInfo
                    val payload = JSONObject()
                    payload.put("session_id", session)
                    payload.put("source", "android")
                    payload.put("x", 50)
                    payload.put("y", 50)
                    payload.put("ts", System.currentTimeMillis() / 1000.0)
                    payload.put("ssid", info.ssid?.trim('"'))
                    payload.put("bssid", info.bssid)
                    payload.put("rssi", info.rssi)
                    payload.put("notes", "Optional native Android RSSI collector.")
                    val conn = URL("${api.trimEnd('/')}/api/samples").openConnection() as HttpURLConnection
                    conn.requestMethod = "POST"
                    conn.setRequestProperty("Content-Type", "application/json")
                    conn.doOutput = true
                    OutputStreamWriter(conn.outputStream).use { it.write(payload.toString()) }
                    conn.inputStream.close()
                    runOnUiThread { status.value = "Posted ${info.rssi} dBm" }
                } catch (error: Exception) {
                    runOnUiThread { status.value = "Failed: ${error.message}" }
                }
            }.start()
            schedulePost(api, session, status)
        }, 2000)
    }
}
