# Gameplay cost estimate

Estimated on: 2026-09-20  
Currency: USD  
Scope: Jev inference for one player, plus separately allocated hosting.

## Planning estimate

Budget **$0.20–$0.25 per player per 10-minute session** for Jev. The latest recorded full scripted mission implies approximately **$0.157 per 10 minutes** before an allowance for uncertainty. The planning range is not a measured maximum or guaranteed billing cap.

| Ten-minute sessions | Jev planning budget |
| ---: | ---: |
| 1 | $0.20–$0.25 |
| 100 | $20–$25 |
| 1,000 | $200–$250 |

## Pricing and calculation

TypeSafe publishes **$0.042 per million input tokens**, with **no output-token charge**. Verified on 2026-09-20 against [TypeSafe’s launch announcement](https://typesafe.ai/blog/introducing-system-one-models-and-jev) and [TypeSafe’s homepage](https://typesafe.ai/). Account-specific terms and future pricing changes may differ.

The repository report `docs/benchmarks/live-mission-responsiveness-tank-pass.json`, dated 2026-09-19, records:

- 480 simulation seconds (8 minutes); 495.13 wall-clock seconds including interruptions.
- 3,171 requests sent to the backend.
- 2,989,870 reported input tokens and 255,428 output tokens.
- A scripted player using live Jev, with `pressure.v1` waves and `armor.v1` combat.

Calculation based on active gameplay time:

```text
10-minute input estimate = 2,989,870 × (10 / 8)
                         = 3,737,337.5 tokens
Estimated Jev cost       = 3,737,337.5 / 1,000,000 × $0.042
                         = $0.15697 ≈ $0.16
```

This is an extrapolation of recorded usage, not a newly measured 10-minute session or an invoice. No paid probe was run for this estimate. The report’s original `costUsd` remains null; the dollar estimate here applies the subsequently checked public price.

## Assumptions and limitations

- The benchmark predates the latest tank and difficulty changes. More surviving enemies and different player behavior can increase decision traffic.
- Cancelled or failed requests without returned usage may still be billable and are not fully captured by these token totals.
- Ten minutes means active gameplay time. Existing finite missions last eight minutes; this extrapolation can describe endless play or time spread across runs.
- The $0.20–$0.25 range adds a planning allowance; it is not a measured confidence interval.
- No claim of current production billing reconciliation or measured per-difficulty cost is made.

## Hosting and donations

The Render instance selected during setup was quoted at **$7/month**. Treat that as a shared fixed hosting cost while that plan remains unchanged; additional usage charges, upgrades, taxes and payment fees are excluded.

```text
Allocated cost per session ≈ Jev session cost + ($7 / monthly session count)
```

For example, 100 sessions/month would allocate $0.07 of base hosting to each session, giving approximately $0.27–$0.32 total per session before extra charges.

A $5 donation could cover roughly **20–25 ten-minute sessions of Jev usage**, before donation fees and hosting. This is budgeting context, not a promise to donors.

## Related references

- [Render deployment](deployment/render.md)
- [Ko-fi page](https://ko-fi.com/thepolyglotprogrammer)
- [Game](https://coffee-under-fire.onrender.com/)
- [Private repository benchmark](https://github.com/joaoh82/coffee-under-fire/blob/main/docs/benchmarks/live-mission-responsiveness-tank-pass.json)
