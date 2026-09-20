# Jev contract research — 2026-09-19

Sources read before implementation:
- https://docs.typesafe.ai/introduction/quickstart
- https://docs.typesafe.ai/primitives/choice
- https://docs.typesafe.ai/api
- Context7 /websites/typesafe_ai: HTTP errors, Retry-After and usage.

The adapter calls POST https://api.typesafe.ai/v1/systemone with server-side bearer authorization, configurable model (default jev-latest), one NPC observation as state, and one Choice named tactic. Candidate IDs become criteria keys and complete action descriptions become criteria values. NPC identity appears in state because question IDs are not model input.

The validated response contains model, answers.tactic (type, choice, confidence, probabilities), and input/output usage. No chat completion, Java integration, generated code, independent action/target questions, or screenshot interpretation is substituted. Returned confidence is logged, never used as hit probability.

Probability keys must match the supplied candidates and sum approximately to one. The simulation additionally checks ownership, epoch, generation, sequence, age, life and current action legality. Schema success is not evidence of tactical quality.

The backend does not retry a stale snapshot. A failed attempt releases capacity, retains a conservative budget charge when usage is unknown and applies a cooldown; a subsequent decision uses a new observation. 429 honors Retry-After or retry-after-ms. Session-local backoff plus strict simulation pause prevents runaway retries. Logged token usage is actual provider usage; budget reservations are deliberately conservative allowances, not measured tokens.

The spike is capped at 36 requests. It covers visible-target, empty-magazine and low-health/lost-target observations for 12 actor IDs in batches of four. It is not sufficient evidence of sustained 12-NPC capacity, varied tactical quality, or a complete mission cost. No launch-price claim is used for measured dollars. Set account-confirmed input/output prices to enable a projection.

Search guidance was refined after the recorded probe and labelled tactics.v2. The saved live reports are tactics.v1; no current-prompt benchmark is implied.
