# Vani 2 Benchmarks

Phase 1 echo RTT. Results are appended by the latency integration test when you run:

```bash
# Start the dev server first (in another terminal):
npx wrangler dev --port 8787

# Then run integration tests:
VANI2_INTEGRATION_BASE_URL=http://localhost:8787 npm run test:vani2:integration
```

Or run without the env var to let the integration config try to start `wrangler dev` via globalSetup.

## Environment

- **Runtime**: Node (see Results for version)
- **Server**: `wrangler dev` (local), or production Workers + DO
- **Phase 1**: Single session, no load test

## Phase 1 – Echo Methodology

- Client sends binary chunk with 8-byte big-endian client timestamp prefix; server echoes unchanged.
- RTT = time at client when message received minus timestamp in message.
- Iterations: 100, 5 ms spacing between sends.
- P50/P95/P99 computed over collected RTTs; P99 must be ≤ 500 ms for test to pass.

## Phase 2 – Live Transcription (Flux)

- **Input**: Client sends linear16 PCM, 16 kHz, **256 ms chunks** (4096 samples, 8192 bytes ≈ 8.2 KB) to `/v2/flux/:sessionId`, matching Deepgram official client for best accuracy. Keep-alive: 20 ms silence when idle. Backpressure: drop when `ws.bufferedAmount` > 128 KB.
- **Output**: Flux events (Update, StartOfTurn, EagerEndOfTurn, TurnResumed, EndOfTurn) exposed to app; no custom VAD; transcript client-only.
- **Partial latency**: Time from first non-silent PCM frame sent to first Flux `Update` event. Target <300 ms where possible.
- **Turn boundaries**: Verify EndOfTurn and optionally EagerEndOfTurn fire as expected; no cross-session transcript bleed.
- **Stability**: Run for a few minutes; confirm Flux `ws.bufferedAmount` stays bounded (frame drops when high).
