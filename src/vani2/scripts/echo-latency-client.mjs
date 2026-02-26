#!/usr/bin/env node
/**
 * Optional manual client: connect to Vani 2 echo server, send chunks with timestamps, print RTT stats.
 * Usage: Start wrangler dev, then:
 *   node src/vani2/scripts/echo-latency-client.mjs [baseUrl]
 * Example: node src/vani2/scripts/echo-latency-client.mjs http://localhost:8787
 */
import WebSocket from "ws";

const BASE = process.argv[2] || "http://localhost:8787";
const WS_URL = BASE.replace(/^http/, "ws") + "/v2/ws/";
const ITERATIONS = 100;
const TIMESTAMP_BYTES = 8;

function encodeChunkWithTimestamp(payload, clientTimeMs) {
  const buf = Buffer.alloc(TIMESTAMP_BYTES + payload.length);
  buf.writeBigUInt64BE(BigInt(Math.round(clientTimeMs)), 0);
  payload.copy(buf, TIMESTAMP_BYTES);
  return buf;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const i = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, i)];
}

const sessionId = "manual-" + Date.now();
const ws = new WebSocket(WS_URL + sessionId);
const rtts = [];
const payload = Buffer.alloc(32);

ws.on("open", () => {
  let received = 0;
  ws.on("message", (data) => {
    if (typeof data === "string") return;
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (buf.length >= TIMESTAMP_BYTES) {
      const clientTs = Number(buf.readBigUint64BE(0));
      rtts.push(Date.now() - clientTs);
      received++;
    }
  });

  for (let i = 0; i < ITERATIONS; i++) {
    ws.send(encodeChunkWithTimestamp(payload, Date.now()));
  }

  setTimeout(() => {
    ws.close();
    const sorted = [...rtts].sort((a, b) => a - b);
    console.log("Echo RTT (ms):", {
      samples: rtts.length,
      p50: percentile(sorted, 50).toFixed(2),
      p95: percentile(sorted, 95).toFixed(2),
      p99: percentile(sorted, 99).toFixed(2),
    });
  }, 3000);
});

ws.on("error", (err) => {
  console.error("WebSocket error:", err.message);
  process.exit(1);
});
