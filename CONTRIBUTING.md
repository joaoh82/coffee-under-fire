# Contributing

Use Node 24.x and `npm ci`. Work on a feature branch. Run `npm run dev` for a complete local game; no API keys or external services are needed.

Before opening a pull request:

```sh
npm run build
npm test
```

Keep simulation separate from React rendering. Every autonomous NPC tactical choice comes from the tactics scorer (`apps/web/src/game/tactics.ts`) selecting a legal candidate; physics, perception and execution must not quietly choose a new tactical goal. Keep tactics deterministic per decision so replays stay exact. Keep observation/action contracts versioned, perception limited, cancellation/expiry enforced and decision provenance replayable.

Include reproduction steps and relevant checks. Mark scripted fixtures, unverified client statistics and unmeasured performance clearly. Do not add credentials, private player telemetry or third-party reference art. For original asset changes, include editable sources, reproducible generators and runtime exports.

Contributions are submitted under the repository's MIT license; only contribute material you have the right to license. Report vulnerabilities through [SECURITY.md](SECURITY.md), not public issues.
