# Homepage implementation plan

Fullscreen, mobile-friendly home with a unique landing experience and stable layout.

## Core behavior

- **Landing**: Brand (SHVM.IN + tagline), nav, and a single **Talk** CTA. No visualization yet.
- **After Talk**: Switch to voice view — visualization, Stop button, and a **fixed-height transcript strip** so content never shifts up/down.
- **Visualization**: Simple, creative, status-colored (idle / connecting / thinking / listening / assistant speaking / error). No overlay text on the viz.

---

## 10–15 implementation ideas

1. **Two-phase layout** — Landing view vs voice view. Only render the visualization and transcript panel after the user has pressed Talk (or is connecting/connected). Reduces clutter and makes the first tap feel intentional.

2. **Fixed-height transcript strip** — Reserve a fixed-height area (e.g. 4.5rem–5rem) at the bottom for transcript. Use `overflow-y: auto` and `min-height` so the strip always occupies the same space; only the text inside scrolls. Prevents layout shift.

3. **Concentric rings visualization** — 2–3 circular rings (border-only or thin fill) that scale and change opacity by status. Color per status (gray idle, orange connecting, indigo thinking, green listening, orange assistant, red error). Simple, recognizable, no blob.

4. **Equalizer bars** — 5–7 vertical bars, center-aligned; height and color driven by status. “Listening” could animate bar heights subtly; other states use a single height with status color. Works well on small screens.

5. **Single glowing ring** — One circle with a thick border and glow (box-shadow). Border color and glow intensity by status. Minimal and clear.

6. **Dot pulse** — A small central dot that pulses (scale/opacity). Color by status. Very minimal; pair with a thin outer ring for “active” states.

7. **Status-only transition** — When moving from landing to voice view, use a short fade or scale-in for the viz so the transition feels deliberate rather than abrupt.

8. **Transcript: scroll to bottom** — When new assistant text arrives, auto-scroll the transcript strip to the bottom so the latest line is visible. Use `scrollTop = scrollHeight` after content updates.

9. **Mobile tap target** — Talk/Stop button at least 44px height and full-width on very small screens (e.g. `min-h-[44px]`) for comfortable tapping.

10. **Safe area** — Use `env(safe-area-inset-*)` for header padding and transcript strip so notches and home indicators don’t clip content.

11. **Landing CTA prominence** — On landing, one primary button (“Talk”) with enough spacing so it’s the obvious action. Optional short line: “Press Space to start” only in voice view to avoid clutter.

12. **Error in fixed slot** — Show error + Retry in a fixed slot (e.g. above the transcript strip) so it doesn’t push the button or viz. Same height whether error is present or not (collapse to 0 height when no error).

13. **Viz size by viewport** — Size the visualization with `vmin` (e.g. `min(60vmin, 320px)`) so it scales on phones and tablets without overflowing.

14. **Optional: landing subtitle** — Short line under the tagline only on landing, e.g. “Click Talk to start a voice conversation.” Hide or shorten once in voice view.

15. **Keyboard shortcut only in voice view** — Enable Space to start/stop only when voice view is active (or when focus isn’t in an input). On landing, Space could optionally start and switch to voice view in one step.

---

## Layout summary

| Phase   | Top                | Middle              | Bottom                    |
|---------|--------------------|---------------------|---------------------------|
| Landing | Header + nav       | Tagline + Talk btn  | (optional hint)           |
| Voice   | Header + nav       | Viz + Stop btn      | Fixed transcript strip    |

Transcript strip: fixed height, overflow-y auto, no layout shift. Visualization: simple (e.g. concentric rings or bars), status-colored, no overlay text.
