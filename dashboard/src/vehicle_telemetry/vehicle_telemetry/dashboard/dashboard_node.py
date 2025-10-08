# Copyright (c) 2025 Abtin Doostan
#
# This software is released under the MIT License.
# https://opensource.org/licenses/MIT

from __future__ import annotations

import threading
from typing import Any, Dict, Optional

import rclpy
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, Response
from rclpy.executors import MultiThreadedExecutor
from rclpy.node import Node
from rclpy.qos import DurabilityPolicy, HistoryPolicy, QoSProfile, ReliabilityPolicy
from rosidl_runtime_py import message_to_ordereddict
from sensor_msgs.msg import Image
from uvicorn import Config, Server

from vehicle_telemetry.utils.config_loader import QoSConfig, TopicConfig, load_topics_config


class TelemetryDashboardNode(Node):
    """Node that exposes a FastAPI dashboard with the latest telemetry samples."""

    def __init__(self) -> None:
        super().__init__("telemetry_dashboard")
        self.declare_parameter("topics_config_path", "")
        self.declare_parameter("host", "0.0.0.0")
        self.declare_parameter("port", 8080)

        self._topics = self._load_topics()
        self._latest_messages: Dict[str, Dict] = {}
        self._lock = threading.Lock()
        self._server: Optional[Server] = None
        self._server_thread: Optional[threading.Thread] = None
        self._latest_camera_frame: Optional[Dict[str, Any]] = None
        self._camera_topic_name: Optional[str] = None
        self._camera_frame_count: int = 0

        for key, topic in self._topics.items():
            msg_type = self._import_msg_type(topic.type)
            qos_profile = self._make_qos_profile(topic.qos)
            if key == "camera_front" and topic.type == "sensor_msgs/msg/Image":
                self._camera_topic_name = topic.name
                self._create_camera_subscription(topic, qos_profile)
            else:
                self.create_subscription(
                    msg_type,
                    topic.name,
                    lambda msg, key=key: self._on_message(key, msg),
                    qos_profile,
                )
                self.get_logger().info(
                    f"Dashboard listening to {topic.name} ({topic.type}) as '{key}' "
                    f"with QoS reliability={topic.qos.reliability}, durability={topic.qos.durability}, "
                    f"history={topic.qos.history}, depth={topic.qos.depth}"
                )

        if not self._camera_topic_name:
            default_topic = "/vehicle/camera/front/image_raw"
            qos = QoSProfile(
                reliability=ReliabilityPolicy.BEST_EFFORT,
                durability=DurabilityPolicy.VOLATILE,
                history=HistoryPolicy.KEEP_LAST,
                depth=5,
            )
            self._camera_topic_name = default_topic
            camera_qos_config = QoSConfig(
                reliability="best_effort",
                durability="volatile",
                history="keep_last",
                depth=5,
            )
            self.get_logger().info(
                "Camera topic configuration missing; subscribing directly to %s with default QoS.",
                default_topic,
            )
            self._create_camera_subscription(
                TopicConfig(default_topic, "sensor_msgs/msg/Image", camera_qos_config),
                qos,
            )

        self._app = self._create_app()
        self._start_server()

    def _import_msg_type(self, type_name: str):
        from rosidl_runtime_py.utilities import get_message

        return get_message(type_name)

    def _load_topics(self):
        path = self.get_parameter("topics_config_path").value
        if path:
            return load_topics_config(path)
        topics_param = self.get_parameter("topics").value
        if isinstance(topics_param, dict):
            topics: Dict[str, TopicConfig] = {}
            for key, value in topics_param.items():
                qos = value.get("qos", {})
                topics[key] = TopicConfig(
                    name=value.get("topic"),
                    type=value.get("type"),
                    qos=QoSConfig(
                        reliability=qos.get("reliability", "reliable"),
                        durability=qos.get("durability", "volatile"),
                        history=qos.get("history", "keep_last"),
                        depth=int(qos.get("depth", 10) or 10),
                    ),
                )
            return topics
        raise RuntimeError("Dashboard requires telemetry topics configuration.")

    @staticmethod
    def _make_qos_profile(config: QoSConfig) -> QoSProfile:
        reliability = (
            ReliabilityPolicy.RELIABLE if config.reliability == "reliable" else ReliabilityPolicy.BEST_EFFORT
        )
        durability = (
            DurabilityPolicy.TRANSIENT_LOCAL
            if config.durability == "transient_local"
            else DurabilityPolicy.VOLATILE
        )
        history_policy = HistoryPolicy.KEEP_ALL if config.history == "keep_all" else HistoryPolicy.KEEP_LAST
        depth = max(1, int(config.depth)) if history_policy == HistoryPolicy.KEEP_LAST else 10
        return QoSProfile(
            reliability=reliability,
            durability=durability,
            history=history_policy,
            depth=depth,
        )

    def _create_camera_subscription(self, topic: TopicConfig, qos_profile: QoSProfile) -> None:
        self.create_subscription(
            Image,
            topic.name,
            self._on_camera_message,
            qos_profile,
        )
        self.get_logger().info(
            f"Dashboard listening to camera stream at {topic.name} "
            f"with QoS reliability={topic.qos.reliability}, durability={topic.qos.durability}, "
            f"history={topic.qos.history}, depth={topic.qos.depth}"
        )

    def _on_message(self, key: str, msg) -> None:
        stamp_ns = self._extract_stamp_ns(msg)
        payload = message_to_ordereddict(msg)
        if key == "camera_front" and isinstance(payload, dict):
            data_field = payload.get("data")
            if isinstance(data_field, list):
                payload["data_length"] = len(data_field)
            elif isinstance(data_field, (bytes, bytearray)):
                payload["data_length"] = len(data_field)
            else:
                payload["data_length"] = 0
            payload["data"] = {
                "width": payload.get("width"),
                "height": payload.get("height"),
                "encoding": payload.get("encoding"),
                "step": payload.get("step"),
                "data_length": payload["data_length"],
            }
        with self._lock:
            self._latest_messages[key] = {
                "stamp": stamp_ns if stamp_ns is not None else self.get_clock().now().nanoseconds,
                "data": payload,
            }
            if key == "camera_front":
                self._latest_camera_frame = self._snapshot_camera(msg)

    def _on_camera_message(self, msg: Image) -> None:
        stamp_ns = self._extract_stamp_ns(msg)
        frame_info = {
            "width": int(getattr(msg, "width", 0)),
            "height": int(getattr(msg, "height", 0)),
            "encoding": getattr(msg, "encoding", "bgr8"),
            "step": int(getattr(msg, "step", 0)),
            "data_length": len(getattr(msg, "data", b"")),
        }
        snapshot = self._snapshot_camera(msg)
        with self._lock:
            self._latest_messages["camera_front"] = {
                "stamp": stamp_ns if stamp_ns is not None else self.get_clock().now().nanoseconds,
                "data": frame_info,
            }
            self._latest_camera_frame = snapshot
            self._camera_frame_count += 1
            if self._camera_frame_count == 1:
                self.get_logger().info("First camera frame received by dashboard.")

    @staticmethod
    def _extract_stamp_ns(msg) -> Optional[int]:
        header = getattr(msg, "header", None)
        if header and getattr(header, "stamp", None):
            try:
                return int(header.stamp.sec) * 10**9 + int(header.stamp.nanosec)
            except AttributeError:
                return None
        return None

    def _snapshot_camera(self, msg) -> Dict[str, Any]:
        stamp_ns = self._extract_stamp_ns(msg)
        return {
            "width": int(getattr(msg, "width", 0)),
            "height": int(getattr(msg, "height", 0)),
            "encoding": getattr(msg, "encoding", "bgr8") or "bgr8",
            "step": int(getattr(msg, "step", 0)),
            "data": bytes(getattr(msg, "data", b"")),
            "stamp": stamp_ns,
        }

    def _encode_camera_frame(self) -> Optional[bytes]:
        with self._lock:
            frame = dict(self._latest_camera_frame) if self._latest_camera_frame else None
        if not frame:
            return None
        try:
            import numpy as np  # type: ignore
            import cv2  # type: ignore
        except ModuleNotFoundError:
            self.get_logger().warning("Camera preview requested but OpenCV/numpy unavailable.")
            return None

        width = frame.get("width", 0)
        height = frame.get("height", 0)
        step = frame.get("step", 0)
        data_bytes = frame.get("data", b"")
        if not width or not height or not step or not data_bytes:
            return None

        channels = max(1, int(step // max(1, width)))
        try:
            array = np.frombuffer(data_bytes, dtype=np.uint8)
            if channels == 1:
                image = array.reshape((height, width))
            else:
                image = array.reshape((height, width, channels))
        except ValueError:
            self.get_logger().warning("Failed to reshape camera frame for preview.")
            return None

        encoding = (frame.get("encoding") or "bgr8").lower()
        if encoding == "rgb8":
            image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
        elif encoding == "mono8" and image.ndim == 2:
            pass  # already single channel
        elif encoding != "bgr8" and image.ndim == 3:
            # Attempt to handle other encodings best-effort by converting to BGR if possible.
            conversion_map = {
                "bgra8": cv2.COLOR_BGRA2BGR,
                "rgba8": cv2.COLOR_RGBA2BGR,
            }
            conversion = conversion_map.get(encoding)
            if conversion is not None:
                image = cv2.cvtColor(image, conversion)
        success, buffer = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        if not success:
            self.get_logger().warning("Failed to encode camera preview frame.")
            return None
        return buffer.tobytes()

    def _create_app(self) -> FastAPI:
        app = FastAPI(title="Telemetry Dashboard", version="0.1.0")

        @app.get("/", response_class=HTMLResponse)
        def index():
            return """
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Vehicle Telemetry</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #f7f7f9;
      --fg: #1f1f24;
      --muted: #5f6368;
      --card-bg: #fff;
      --card-border: rgba(0,0,0,0.08);
      --accent: #0b8aee;
      --warn: #c24040;
      --ok: #2a9d4b;
      --paused: #f4a62a;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #11161c;
        --fg: #f5f6f8;
        --muted: #9197a1;
        --card-bg: #171d24;
        --card-border: rgba(255,255,255,0.06);
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font: 15px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--fg);
      padding: 24px;
      max-width: 1100px;
      margin-inline: auto;
    }
    header.bar {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
      margin-bottom: 24px;
    }
    header.bar h1 {
      margin: 0;
      font-size: clamp(1.6rem, 2vw, 2.2rem);
    }
    header.bar p { margin: 4px 0 0; }
    .status {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 200px;
      align-items: flex-end;
      text-align: right;
    }
    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-end;
      justify-content: flex-end;
    }
    .dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 999px;
      margin-right: 6px;
    }
    .dot.online { background: var(--ok); }
    .dot.offline { background: var(--warn); }
    .dot.paused { background: var(--paused); }
    .muted { color: var(--muted); }
    .pill {
      border: none;
      border-radius: 999px;
      padding: 8px 16px;
      font: inherit;
      font-weight: 600;
      background: var(--accent);
      color: #fff;
      cursor: pointer;
      transition: filter 0.15s ease, transform 0.15s ease;
    }
    .pill:hover { filter: brightness(1.08); transform: translateY(-1px); }
    .pill.resume {
      background: transparent;
      color: var(--accent);
      border: 1px solid var(--accent);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 18px;
      margin-bottom: 24px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 18px;
      box-shadow: 0 8px 20px rgba(15,20,30,0.04);
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-height: 180px;
    }
    .card header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
    }
    .card header h3 {
      margin: 0;
      font-size: 1.1rem;
    }
    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: flex-end;
    }
    .badge {
      font-size: 0.72rem;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      padding: 2px 8px;
      border-radius: 999px;
      font-weight: 600;
      background: rgba(0,0,0,0.08);
      color: var(--muted);
      white-space: nowrap;
    }
    .badge.ok { color: var(--ok); background: rgba(42,157,75,0.12); }
    .badge.warn { color: var(--warn); background: rgba(194,64,64,0.14); }
    .badge.neutral { background: rgba(0,0,0,0.08); color: var(--muted); }
    .card-body div + div { margin-top: 6px; }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      font-size: 0.86rem;
    }
    .preview {
      position: relative;
      border-radius: 12px;
      overflow: hidden;
      background: #000;
      aspect-ratio: 16 / 9;
    }
    .preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    details.raw {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 16px;
    }
    details.raw summary {
      cursor: pointer;
      font-weight: 600;
    }
    details.raw pre {
      margin: 12px 0 0;
      max-height: 380px;
      overflow: auto;
      background: rgba(0,0,0,0.05);
      padding: 12px;
      border-radius: 8px;
    }
    @media (prefers-color-scheme: dark) {
      details.raw pre {
        background: rgba(255,255,255,0.05);
      }
    }
  </style>
</head>
<body>
  <header class="bar">
    <div>
      <h1>Vehicle Telemetry</h1>
      <p class="muted">Live ROS 2 topics from the telemetry stack</p>
    </div>
    <div class="controls">
      <div class="status">
        <div>
          <span id="status-dot" class="dot offline"></span>
          <span id="status-text">Connecting…</span>
        </div>
        <div id="status-time" class="muted">—</div>
      </div>
      <button id="pause-btn" class="pill" type="button">Pause</button>
    </div>
  </header>
  <main>
    <section id="cards" class="grid"></section>
    <details class="raw">
      <summary>Raw JSON payload</summary>
      <pre id="raw" class="mono">{}</pre>
    </details>
  </main>
  <script>
    const state = { paused: false, lastStamp: {}, fps: {} };
    const cardsEl = document.getElementById("cards");
    const rawEl = document.getElementById("raw");
    const statusDot = document.getElementById("status-dot");
    const statusText = document.getElementById("status-text");
    const statusTimeEl = document.getElementById("status-time");
    const pauseBtn = document.getElementById("pause-btn");
    let pollTimer = null;

    function setStatus(mode) {
      statusDot.classList.remove("online", "offline", "paused");
      if (mode === "live") {
        statusDot.classList.add("online");
        statusText.textContent = "Live";
      } else if (mode === "paused") {
        statusDot.classList.add("paused");
        statusText.textContent = "Paused";
      } else {
        statusDot.classList.add("offline");
        statusText.textContent = "Disconnected";
      }
    }

    function fmtNumber(value, digits = 3) {
      if (value === null || value === undefined || Number.isNaN(value)) return "—";
      return Number(value).toFixed(digits);
    }

    function formatArray(arr, digits = 3) {
      if (!Array.isArray(arr) || arr.length === 0) return "—";
      return arr.map((v) => fmtNumber(v, digits)).join(", ");
    }

    function escapeHtml(input) {
      return String(input)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function formatAge(stamp) {
      if (stamp === null || stamp === undefined) {
        return { label: "no data", cls: "warn" };
      }
      const ageMs = Math.max(0, Date.now() - stamp / 1e6);
      const label = ageMs < 1000 ? `${ageMs.toFixed(0)} ms ago` : `${(ageMs / 1000).toFixed(1)} s ago`;
      const cls = ageMs < 3000 ? "ok" : "warn";
      return { label, cls };
    }

    function updateFps(key, stamp) {
      if (typeof stamp !== "number" || Number.isNaN(stamp)) {
        return state.fps[key];
      }
      const previous = state.lastStamp[key];
      if (previous && stamp > previous) {
        const delta = (stamp - previous) / 1e9;
        if (delta > 0.0001) {
          state.fps[key] = 1 / delta;
        }
      }
      state.lastStamp[key] = stamp;
      return state.fps[key];
    }

    const CARDS = {
      imu: {
        title: "IMU",
        builder: (data) => data ? `
          <div>ω (rad/s): [${formatArray([data.angular_velocity?.x, data.angular_velocity?.y, data.angular_velocity?.z])}]</div>
          <div>a (m/s²): [${formatArray([data.linear_acceleration?.x, data.linear_acceleration?.y, data.linear_acceleration?.z])}]</div>
        ` : "<div class='muted'>No samples</div>"
      },
      gps: {
        title: "GPS",
        builder: (data) => data ? `
          <div>Lat/Lon: ${fmtNumber(data.latitude)}, ${fmtNumber(data.longitude)}</div>
          <div>Altitude: ${fmtNumber(data.altitude)} m</div>
          <div class="muted mono">Status: ${escapeHtml(data.status?.status ?? "n/a")}</div>
        ` : "<div class='muted'>No samples</div>"
      },
      wheel_speed: {
        title: "Wheel Speed",
        builder: (data) => (data?.data?.length) ? `
          <div>Wheels [FL, FR, RL, RR] (m/s):</div>
          <div class="mono">${formatArray(data.data)}</div>
        ` : "<div class='muted'>No samples</div>"
      },
      can: {
        title: "CAN",
        builder: (data) => data ? `
          <div>ID: <span class="mono">${escapeHtml(data.id)}</span> &nbsp; DLC: ${escapeHtml(data.dlc)}</div>
          <div class="mono">${Array.isArray(data.data) ? data.data.map((b) => Number(b).toString(16).padStart(2, "0")).join(" ") : "—"}</div>
          <div class="muted">Flags: ${["is_extended", "is_rtr", "is_error"].filter((k) => data[k]).join(", ") || "none"}</div>
        ` : "<div class='muted'>No samples</div>"
      },
      camera_front: {
        title: "Camera (Front)",
        builder: (data, entry) => {
          if (!data) return "<div class='muted'>No frame</div>";
          const bust = entry?.stamp ? `?t=${entry.stamp}` : `?t=${Date.now()}`;
          const size = typeof data.data_length === "number"
            ? data.data_length
            : Array.isArray(data.data)
              ? data.data.length
              : 0;
          return `
            <div class="preview">
              <img src="/camera.jpg${bust}" alt="Camera preview" loading="lazy" />
            </div>
            <div>Resolution: ${escapeHtml(data.width ?? "—")} × ${escapeHtml(data.height ?? "—")}</div>
            <div class="muted">Encoding: ${escapeHtml(data.encoding ?? "unknown")} · Size: ${size} B</div>
          `;
        }
      }
    };

    function genericBuilder(data) {
      if (!data) return "<div class='muted'>No samples</div>";
      return `<pre class="mono" style="white-space:pre-wrap; margin:0;">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
    }

    function makeCard(title, builder, entry, key) {
      const data = entry?.data;
      const { label, cls } = formatAge(entry?.stamp);
      const fpsValue = updateFps(key, entry?.stamp);
      let fpsLabel = "—";
      if (typeof fpsValue === "number" && Number.isFinite(fpsValue)) {
        const digits = fpsValue >= 100 ? 0 : 1;
        fpsLabel = `${fpsValue.toFixed(digits)} fps`;
      }
      const fpsClass = (typeof fpsValue === "number" && fpsValue < 1) ? "warn" : (typeof fpsValue === "number" ? "ok" : "neutral");
      return `
        <article class="card" data-topic="${escapeHtml(key)}">
          <header>
            <h3>${escapeHtml(title)}</h3>
            <div class="badges">
              <span class="badge ${cls}">${escapeHtml(label)}</span>
              <span class="badge ${fpsClass}" title="Estimated sample rate">${escapeHtml(fpsLabel)}</span>
            </div>
          </header>
          <div class="card-body">
            ${builder(data, entry)}
          </div>
        </article>
      `;
    }

    function updateUI(payload) {
      rawEl.textContent = JSON.stringify(payload, null, 2);
      statusTimeEl.textContent = "Last update: " + new Date().toLocaleTimeString();

      const fragment = [];
      for (const [key, meta] of Object.entries(CARDS)) {
        const entry = payload[key];
        fragment.push(makeCard(meta.title, meta.builder, entry, key));
      }
      for (const key of Object.keys(payload)) {
        if (CARDS[key]) continue;
        const entry = payload[key];
        fragment.push(makeCard(key, genericBuilder, entry, key));
      }
      cardsEl.innerHTML = fragment.join("");
    }

    async function poll() {
      if (state.paused) {
        setStatus("paused");
        scheduleNext(500);
        return;
      }
      try {
        const response = await fetch("/latest", { cache: "no-store" });
        if (!response.ok) throw new Error("Bad status");
        const payload = await response.json();
        setStatus("live");
        updateUI(payload);
        scheduleNext(500);
      } catch (err) {
        if (!state.paused) {
          setStatus("offline");
          statusTimeEl.textContent = "Connection lost at " + new Date().toLocaleTimeString();
        }
        scheduleNext(1500);
      }
    }

    function scheduleNext(delay) {
      clearTimeout(pollTimer);
      pollTimer = setTimeout(poll, delay);
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        clearTimeout(pollTimer);
      } else if (!state.paused) {
        poll();
      }
    });

    pauseBtn.addEventListener("click", () => {
      state.paused = !state.paused;
      if (state.paused) {
        pauseBtn.textContent = "Resume";
        pauseBtn.classList.add("resume");
        setStatus("paused");
        statusTimeEl.textContent = "Polling paused";
      } else {
        pauseBtn.textContent = "Pause";
        pauseBtn.classList.remove("resume");
        poll();
      }
    });

    poll();
  </script>
</body>
</html>
"""

        @app.get("/camera.jpg")
        def camera_jpeg():
            payload = self._encode_camera_frame()
            if payload is None:
                return Response(status_code=204)
            return Response(
                content=payload,
                media_type="image/jpeg",
                headers={"Cache-Control": "no-store, max-age=0"},
            )

        @app.head("/camera.jpg")
        def camera_head():
            with self._lock:
                has_frame = self._latest_camera_frame is not None
            return Response(status_code=200 if has_frame else 204)

        @app.get("/health")
        def health():
            return {"status": "ok", "sources": list(self._topics.keys())}

        @app.get("/healthz")
        def healthz():
            return {"ok": True}

        @app.get("/latest")
        def latest():
            with self._lock:
                return self._latest_messages

        @app.get("/latest/{key}")
        def latest_key(key: str):
            with self._lock:
                data = self._latest_messages.get(key)
            if data is None:
                return {"error": f"No data for key '{key}'"}
            return data

        return app

    def _start_server(self) -> None:
        host = self.get_parameter("host").value
        port = int(self.get_parameter("port").value)
        config = Config(app=self._app, host=host, port=port, log_level="info")
        self._server = Server(config)
        self._server_thread = threading.Thread(target=self._server.run, daemon=True)
        self._server_thread.start()
        self.get_logger().info(f"Telemetry dashboard serving at http://{host}:{port}")

    def destroy_node(self) -> bool:
        if self._server:
            self._server.should_exit = True
        if self._server_thread:
            self._server_thread.join(timeout=2)
        return super().destroy_node()


def main(args=None) -> None:
    rclpy.init(args=args)
    node = TelemetryDashboardNode()
    executor = MultiThreadedExecutor()
    executor.add_node(node)
    try:
        executor.spin()
    except KeyboardInterrupt:
        node.get_logger().info("Telemetry dashboard interrupted.")
    finally:
        executor.remove_node(node)
        node.destroy_node()
        rclpy.shutdown()
