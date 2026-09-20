# Illustrated mission report — 2026-09-19

Replaced the plain end-of-run text panel with a field report matching the new briefing. Uses the existing generated game logo, editable project-authored SVG cup medal variants for victory/defeat, a prominent score and illustrated statistics for deliveries, enemies defeated, elapsed survival time and level reached. Narrow layouts use a two-by-two stat grid and stacked actions; short viewports retain scrolling.

`MissionReport.tsx` receives actual values from the completed simulation. Score remains `Math.round(score + time)`, and the simulation's actual end reason is retained. Restart and decision-replay export retain their existing handlers. No combat, Jev, progression or scoring rules changed.

Development-only `/report-preview` renders the same component with clearly labelled sample data, victory/defeat and endless controls. Export is disabled in the fixture; it makes no Jev requests. The route is not enabled in production.

Validation: TypeScript and production build pass (existing large-bundle warning remains). Browser inspected defeat and victory layouts at 1280 × 720; mode toggle verifies the endless label. Actual end-of-run data wiring and existing restart/export callbacks were inspected. Physical-mobile layout and a fresh end-to-end mission were not retested for this presentation-only change. No new provider latency/cost measurement.
