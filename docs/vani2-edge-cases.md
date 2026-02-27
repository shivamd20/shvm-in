# Vani2: Edge cases and conversational flow

This document describes how the session DO handles edge cases: interruption, speculative runs, duplicate turns, and related behavior. The goal is to **discard old streams on interrupt** and **only consider new streams** so the conversation stays consistent.

---

## 1. Interruption (`control.interrupt`)

### When the user interrupts

- **Processor:** On `control.interrupt` we set `aborted = true` and send `benchmark.turn_interrupted` if a turn or speculative run is active (`llmStreaming || speculativeActive`).
- **Effect:** Any in-flight LLM or TTS work is **discarded** from the client’s perspective:
  - We stop reading from the current LLM stream and stop sending `llm_partial` / `llm_complete` / audio.
  - We do not cancel the underlying Workers AI stream (we just stop consuming it).
  - No further tokens or audio from that turn are sent; the next turn is driven only by the next `transcript_final`.

### During a normal turn (`runNormalTurn`)

- The stream loop checks `this.aborted` each iteration and breaks.
- In `finally` we record a partial assistant message (with `[Interrupted by user.]`) in conversation history if we have enough partial text (≥ `MIN_PARTIAL_LENGTH`), so the next turn’s LLM sees that the previous reply was cut off.
- We set `llmStreaming = false`. The next message processed from the queue will be the next `transcript_final` (or another control message), which starts a **new** turn with a **new** LLM stream.

### During a speculative run (`runSpeculative`)

- The race loop checks for `control.interrupt`; when received we set `aborted = true` and break.
- We do **not** commit the speculative buffer; we either already have a `transcript_final` from the race or we wait for it.
- When we later handle that `transcript_final`, we do **not** commit (because `aborted` is true). We call `runNormalTurn(pendingFinal)`, which starts a **new** stream for the final transcript. The speculative run is fully discarded; no tokens or audio from it are sent.

### Summary

- **Old stream:** Stopped from the client’s perspective (no more output).
- **New stream:** Only started when the next `transcript_final` is processed; no stale content from the previous run is sent.

---

## 2. Speculative run (commit vs discard)

### When we commit

- We receive `transcript_speculative` (e.g. on EagerEndOfTurn), start an LLM stream with that text, and buffer tokens.
- When `transcript_final` arrives and:
  - `finalText === speculativeText` or `finalText.startsWith(speculativeText)`, and
  - We have at least one buffered token, and
  - We are **not** aborted,
- we **commit:** we flush the buffer as `llm_partial` / `llm_complete` and run TTS. The user sees low TTFT because we started LLM early.

### When we discard

- **Transcript mismatch:** `transcript_final` does not match or extend the speculative text → we discard the buffer and run a **normal** turn with `transcript_final` (new LLM stream with final text).
- **Interrupt:** User sent `control.interrupt` during speculative → we set `aborted` and do not commit; we run a normal turn with the same `transcript_final` (new stream).
- **Empty buffer:** Speculative stream had not produced any tokens before `transcript_final` → we run a normal turn.

After a discard we never send any tokens or audio from the speculative run; only the new turn (from `runNormalTurn`) is sent.

---

## 3. Duplicate turnId

- If the client sends `transcript_final` with a `turnId` that equals `lastProcessedTurnId`, we respond with an error and do **not** start a new turn.
- This avoids applying the same turn twice (e.g. after reconnection or duplicate events).

---

## 4. Turn already in progress

- If the client sends `transcript_final` while `llmStreaming === true`, we respond with an error: *"Turn already in progress; send control.interrupt first"*.
- The client must send `control.interrupt` if the user wants to interrupt; the next `transcript_final` will then start a new turn (see Interruption above).

---

## 5. Speculative while busy

- If we receive `transcript_speculative` while `llmStreaming` or `speculativeActive` is true, we ignore it (no new speculative run).
- This avoids overlapping speculative and normal turns.

---

## 6. Waiting for `transcript_final` after speculative

- If the speculative stream ends (or we break on interrupt) before we have seen a `transcript_final`, we block on the message queue until we receive a `transcript_final`.
- Other messages (e.g. `control.interrupt`, `transcript_speculative`, `control.mute`) are consumed in that loop; only `transcript_final` is used to decide commit vs run normal turn. Interrupt is still recorded (`aborted = true`) so we do not commit.

---

## 7. Partial assistant message on interrupt

- When we exit a turn or a speculative commit path due to `aborted` and we have accumulated at least `MIN_PARTIAL_LENGTH` characters of assistant text, we append an assistant message with that partial text and the marker `[Interrupted by user.]` to conversation history.
- The next turn’s LLM call therefore sees that the previous reply was interrupted and can respond naturally (e.g. acknowledge and continue).

---

## 8. Cleanup and session close

- When the session is closed (`sessionState` closed, WebSocket closed, or cleanup), we set `messageQueue = null` so the processor loop exits.
- No new turns are started after cleanup.
