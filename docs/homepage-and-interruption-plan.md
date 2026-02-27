# Homepage improvements plan

Plan for: centering the Talk/Stop button, clearer status (connecting, error, etc.), transcripts hidden by default, and better spacing—without changing Vani’s core pipeline.

---

## 1. Homepage UI changes (concise)

- **Center the start/stop button**: In voice view, make the primary CTA (Talk/Stop) the visual center: e.g. flex layout with viz above and button centered below, or reorder so the button is in the middle and viz above it.
- **Show more states**: Surface “Connecting…”, “Thinking…”, “Listening…”, “Shivam speaking”, “Error” as short status text (below the button or near the viz), not as overlay on the viz. Use existing `vizStatus`; map to a single status line.
- **Transcripts hidden by default**: Replace the always-visible transcript strip with a “Show transcript” toggle (or link). When off, show nothing (or a single line “Transcript available”); when on, show the fixed-height scrollable transcript area. Layout stays fixed in both cases (reserve space or keep a fixed-height area so nothing shifts).
- **Spacing**: Increase margin/padding between the Stop/Talk button and the “Press Space to start or stop” line (e.g. `mt-3` or `gap-3` between button and hint) so the two don’t feel cramped.

---

## 2. 10–15 homepage improvement ideas

1. **Center the Talk/Stop button** in the voice view and keep it the main focus (e.g. viz above, button centered, then status line, then Space hint).
2. **Explicit status line** under the button: “Connecting…”, “Thinking…”, “Listening…”, “Shivam speaking”, “Ready”, “Error: …” so the user always knows the state.
3. **Transcript hidden by default** with a “Show transcript” control; fixed-height transcript panel when open so layout doesn’t shift.
4. **Better spacing** between button and “Space to start or stop” (e.g. `mt-3` / `gap-3`).
5. **Error state visibility**: When status is error, show a compact error message and Retry in a dedicated slot (fixed height when visible) so it doesn’t push the button around.
6. **Connecting state**: While connecting, show “Connecting…” and optionally disable the button or show a spinner so it’s clear something is in progress.
7. **Idle/Ready**: When connected but not thinking/listening/speaking, show “Ready” or “Say something” so it’s clear the system is listening.
8. **Mobile tap target**: Keep Talk/Stop at least 44px height; ensure status and transcript toggle are also tappable where needed.
9. **Keyboard shortcut clarity**: Keep “Press Space to start or stop” only in voice view; consider moving it slightly away from the button (e.g. below status) to improve spacing.
10. **Transcript toggle persistence**: Optional: remember “Show transcript” in sessionStorage so it persists across refreshes in the same session.
11. **Accessibility**: Ensure status line has `aria-live="polite"` so screen readers announce state changes; transcript panel when open should be focusable and readable.
12. **Viz reflects state**: Keep the current concentric rings; ensure “connecting” and “error” are clearly distinct (color/motion) so the viz reinforces the status line.
13. **No layout shift**: Reserve a fixed slot for the transcript panel (height 0 when closed, or a fixed height when open) so opening/closing transcript doesn’t move the button or viz.
14. **Retry on error**: Keep a single clear “Retry” action in the error slot; avoid multiple CTAs that could confuse.
15. **Landing vs voice**: Keep the two-phase flow (landing → Talk → voice view); ensure status line and transcript toggle only appear in voice view so the landing stays simple.

---

## 3. Risks and “do not break Vani”

**Homepage**
- **Risk**: Transcript toggle or status line causing layout shift.  
  **Mitigation**: Fixed-height area for transcript panel; status line is one line of text so height is stable.
- **Risk**: Too much UI (status + transcript toggle + error + button + hint) feeling crowded on mobile.  
  **Mitigation**: Stack vertically with consistent spacing; keep status and hint short; transcript is one toggle + panel.

**Vani pipeline**
- **Do not change**: Protocol, DO (Vani2SessionDO), session machine, Flux/STT, or useVani’s interrupt/transcript logic. Only change what the homepage shows (layout, status, transcript visibility).

---

## 4. Implementation order (suggested)

1. **Homepage**  
   - Center Talk/Stop button.  
   - Add a single status line (connecting, thinking, listening, Shivam speaking, Ready, error).  
   - Hide transcript by default; add “Show transcript” toggle and fixed-height panel.  
   - Fix spacing between button and Space hint.  
   - Verify on mobile/tablet.

2. **Polish**  
   - Error slot fixed height; optional sessionStorage for transcript toggle; aria-live on status.

This keeps the pipeline unchanged and limits changes to homepage layout and UI.
