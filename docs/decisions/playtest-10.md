# Briefing art and bounded automatic recovery — 2026-09-19

The user's screenshots showed repeated manual “Waiting for Jev” dialogs, a long text-only briefing, and a native mode dropdown. This pass improves recovery interaction and the title/briefing presentation. It does not claim to eliminate provider delays or tactical starvation.

## Recovery findings and changes

The previous driver invalidated pending requests at strict starvation and then waited indefinitely for a manual retry. It also replaced an existing long provider backoff with shorter concurrent errors, and recovery could start another batch after receiving a Retry-After response. Losing window focus on the initial briefing called invalidation against the offline/nonexistent session, potentially producing a spurious connection error before a mission had even started.

- The 90-tick strict starvation threshold is unchanged. All simulation, damage and coffee time remain frozen until fresh legal Jev choices are available.
- A small explicit “Battlefield paused” notice replaces the immediate large dialog. Automatic recovery starts after a 350 ms notice delay or the existing backoff, whichever is later. There are at most two attempts per interruption, separated by at least two seconds after failure, and at most four automatic attempts in a rolling minute. Each attempt uses the existing four-call concurrency and bounded contention passes, under the existing server request/token/session budgets.
- Exhaustion or continued failure leaves gameplay paused and exposes manual retry/quit. Manual retries cannot clear the provider backoff. Recovery stops starting new batches after a backoff arrives and retains the longest concurrent backoff.
- Pause, loss of focus and disposal cancel automatic recovery; late results cannot restart the mission. Losing focus on the briefing does not invalidate a nonexistent session.
- No tactical fallback, longer action lifetime, hidden targeting or substitute provider was added.

## Briefing and logo

The new mug-and-helmet logo appears in the briefing and HUD. Illustrated radio cards replace the dropdown. Short fill/deliver/upgrade instructions and expandable controls reduce the initial reading load. Mode choices remain native radio controls with visible focus and checked state. Global game key handling leaves native form controls usable.

See `docs/art/briefing-logo-01.md` for the imagegen prompt, tool provenance, palette and asset path. The project contains the generated alpha PNG and editable SVG mode illustrations.

## Evidence and limits

- 74 tests pass, including bounded automatic recovery, frozen simulation until decisions arrive, 429 backoff, two-attempt and rolling-minute limits, cancellation, and no invalidation on the initial briefing. These new recovery tests use explicitly synthetic contract fixtures, not live API results.
- Production build passes with the existing large-bundle warning.
- Historical eight-minute live recording still reproduces all 2,814 applied choices and its exact result without API calls.
- Browser inspected the logo/briefing at 1280 × 720 and switched both radio modes, verifying the checked state and start-button labels. The visual cards fill the two-column layout. Responsive CSS is included; physical-mobile and keyboard end-to-end testing remain open.
- No new live-provider benchmark was run in this pass. There are no new measured Jev latency, cost or pause-reduction figures. The previous six-pause result remains historical evidence, not validation of the new recovery behavior. A future bounded live playtest should measure automatic versus manual recovery, including actual provider/network failure codes.

Next: playtest the new briefing and recovery interaction, then resume difficulty/scenery work once the remaining interruption behavior is acceptable.
