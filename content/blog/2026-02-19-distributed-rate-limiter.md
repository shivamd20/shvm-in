---
title: "Building a Distributed Rate Limiter"
date: "2026-02-19"
tags: ["system-design", "distributed-systems"]
published: true
---

Rate limiting is a reliability feature, not a billing feature. Done well, it prevents cascading failure and keeps latency predictable under load.

## The problem

You need a global budget (e.g. 2,000 req/s) enforced across many instances and regions, with burst tolerance and low coordination overhead.

## A practical model

Start with a token bucket per key. Tokens refill at a steady rate. Each request consumes 1 token.

```ts
type Bucket = { tokens: number; lastRefillMs: number }
```

## A distributed approach

For correctness, you eventually need some shared state. For speed, you want to avoid synchronous round trips on every request.

Two common strategies:

1. **Centralized**: Redis + Lua script (simple, consistent, single dependency)
2. **Hierarchical**: Local buckets + periodic reconciliation (faster, more complex)

## Redis + Lua (baseline)

If you can tolerate a single shared data plane, Redis is a great baseline. Atomically:

1. Refill tokens based on elapsed time
2. Check tokens
3. Decrement on success

```lua
-- pseudocode
-- refill, then consume if possible
```

## Where it gets interesting

The difficult part isn’t the algorithm — it’s defining:

- what “fair” means across keys
- what “consistent” means across regions
- what failure modes you accept

