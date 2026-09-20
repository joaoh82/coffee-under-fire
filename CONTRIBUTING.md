# Contributing

Use Node 24.x and `npm ci`. Work on a feature branch. Run `DECISION_MODE=mock npm run dev` for an explicitly labelled offline game. Use your own server-side Jev credentials only when intentionally testing live service behavior.

Before opening a pull request:

```sh
npm run build
npm test
```

Keep simulation separate from React rendering. Every autonomous NPC tactical choice in strict mode must come from Jev selecting a legal candidate. Do not add hidden heuristic tactics or replace Jev with a chat model. Keep observation/action contracts versioned, perception limited, cancellation/expiry enforced and decision provenance replayable.

Include reproduction steps and relevant checks. Mark mocks, unverified client statistics and unmeasured performance clearly. Do not add credentials, private player telemetry or third-party reference art. For original asset changes, include editable sources, reproducible generators and runtime exports.

Contributions are submitted under the repository's MIT license; only contribute material you have the right to license. Report vulnerabilities through [SECURITY.md](SECURITY.md), not public issues.
