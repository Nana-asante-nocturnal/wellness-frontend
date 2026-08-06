/**
 * WebSocket client for streaming landmark data to the wellness monitor backend.
 * Sends landmark arrays per frame, receives processed results in real time.
 * Includes heartbeat to prevent browser-side timeout.
 */

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/session";

let ws = null;
let listeners = new Map();
let reconnectTimer = null;
let heartbeatTimer = null;
let intentionalClose = false;

export function connect() {
  if (ws) {
    if (ws.readyState === WebSocket.OPEN) return;
    if (ws.readyState === WebSocket.CONNECTING) return;
    ws.close();
    ws = null;
  }

  intentionalClose = false;
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    emit("connected", null);
    startHeartbeat();
  };

  ws.onmessage = (event) => {
    clearHeartbeatTimer();
    startHeartbeat();
    if (event.data === "heartbeat") return;
    try {
      const msg = JSON.parse(event.data);
      emit(msg.type, msg);
    } catch {
      // ignore malformed messages
    }
  };

  ws.onclose = () => {
    clearHeartbeatTimer();
    emit("disconnected", null);
    if (!intentionalClose) {
      reconnectTimer = setTimeout(connect, 3000);
    }
  };

  ws.onerror = () => {
    ws?.close();
  };
}

function startHeartbeat() {
  clearHeartbeatTimer();
  heartbeatTimer = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "heartbeat" }));
    }
  }, 25000);
}

function clearHeartbeatTimer() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

export function disconnect() {
  intentionalClose = true;
  clearHeartbeatTimer();
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  if (ws) {
    ws.close();
    ws = null;
  }
}

export function send(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

export function on(type, callback) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(callback);
  return () => listeners.get(type)?.delete(callback);
}

function emit(type, data) {
  listeners.get(type)?.forEach((cb) => cb(data));
}
