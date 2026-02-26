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

## Methodology

- Client sends binary chunk with 8-byte big-endian client timestamp prefix; server echoes unchanged.
- RTT = time at client when message received minus timestamp in message.
- Iterations: 100, 5 ms spacing between sends.
- P50/P95/P99 computed over collected RTTs; P99 must be ≤ 500 ms for test to pass.
