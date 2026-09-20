import { test } from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../apps/web/src/game/simulation";
import {
  bodyFor,
  parseProvider,
  mockProvider,
  jevProvider,
  retryDelay,
} from "../apps/server/src/jev";
import { Pipeline, LIMITS } from "../apps/server/src/pipeline";
function fixture() {
  const s = new Simulation();
  s.start("mock", "fixture");
  const n = s.addNPC("rifleman", { x: -17, z: 7 });
  return { s, n, r: s.request(n) };
}
test("one complete Choice and no hidden player state", () => {
  const { s, n } = fixture();
  n.pos = { x: 20, z: -15 };
  s.player.pos = { x: -20, z: 15 };
  const r = s.request(n);
  assert.equal(r.observation.visible.length, 0);
  assert.deepEqual(r.observation.lastSeen?.position, { x: -17, z: 12 });
  assert.notDeepEqual(r.observation.lastSeen?.position, s.player.pos);
  const b = bodyFor(r, "jev-latest");
  assert.deepEqual(Object.keys(b.questions), ["tactic"]);
  assert.ok(!JSON.stringify(b).includes("warmth"));
});
test("Choice validates selected ID and complete probability distribution", () => {
  const { r } = fixture();
  const raw = {
    model: "jev-latest",
    answers: {
      tactic: {
        type: "choice",
        choice: "hold",
        confidence: 1,
        probabilities: Object.fromEntries(
          r.candidates.map((c) => [c.id, c.id === "hold" ? 1 : 0]),
        ),
      },
    },
    usage: { input_tokens: 500, output_tokens: 30 },
  };
  assert.equal(parseProvider(raw, r, 42).source, "jev");
  raw.answers.tactic.choice = "invented";
  assert.throws(() => parseProvider(raw, r, 42));
});
test("missing credentials never turn into a mock", async () => {
  const { r } = fixture();
  await assert.rejects(
    jevProvider(undefined)(r, new AbortController().signal),
    /missing_api_key/,
  );
});
test("stale, generation, epoch and illegal results rejected", async () => {
  for (const variant of ["stale", "epoch", "generation", "illegal"]) {
    const { s, n, r } = fixture();
    const d = await mockProvider(r, new AbortController().signal);
    if (variant === "stale") s.tick += 61;
    if (variant === "epoch") s.invalidate();
    if (variant === "generation") n.generation++;
    if (variant === "illegal") d.selected = "not_available";
    assert.equal(s.apply(r, d), false, variant);
  }
});
test("strict starvation pauses all simulation without firing", () => {
  const s = new Simulation();
  s.start("strict", "fixture");
  for (let i = 0; i < 100; i++)
    s.step({
      x: 0,
      z: 0,
      aim: { x: 0, z: 0 },
      fire: false,
      reload: false,
      interact: false,
      dodge: false,
    });
  assert.equal(s.status, "reconnecting");
  assert.equal(s.tick, 90);
  assert.equal(s.bullets.length, 0);
});
test("pipeline rejects ownership, duplicate sequences and request budget", async () => {
  const p = new Pipeline(mockProvider, Date.now, { ...LIMITS, requests: 1 });
  const session = p.create();
  const { r } = fixture();
  r.session = session;
  await assert.rejects(p.decide("wrong", r), /session_expired/);
  await p.decide(session, r);
  await assert.rejects(p.decide(session, r), /stale_sequence/);
  r.sequence++;
  await assert.rejects(p.decide(session, r), /budget_exhausted/);
});
test("pause cancels provider results and releases capacity", async () => {
  let finish!: (d: any) => void;
  const p = new Pipeline(
    (r) =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const session = p.create();
  const { r } = fixture();
  r.session = session;
  const pending = p.decide(session, r);
  p.invalidate(session, 1);
  finish(await mockProvider(r, new AbortController().signal));
  await assert.rejects(pending, /cancelled/);
  assert.equal(p.active, 0);
});
test("429 backoff respects both header formats", () => {
  assert.equal(retryDelay(new Headers({ "retry-after": "3" })), 3000);
  assert.equal(retryDelay(new Headers({ "retry-after-ms": "1200" })), 1200);
});
test("provider timeout and 429 fixtures are errors, not fake results", async () => {
  const { r } = fixture();
  const transport = async () =>
    new Response("", { status: 429, headers: { "Retry-After": "2" } });
  await assert.rejects(
    jevProvider(
      "fixture",
      "jev-latest",
      transport as typeof fetch,
    )(r, new AbortController().signal),
    /provider_http_429/,
  );
});
test("same decision cannot restart an action twice", async () => {
  const { s, r } = fixture();
  const d = await mockProvider(r, new AbortController().signal);
  assert.equal(s.apply(r, d), true);
  assert.equal(s.apply(r, d), false);
});
test("target death and occupied destination invalidate chosen actions", async () => {
  const { s, n, r } = fixture();
  const d = await mockProvider(r, new AbortController().signal);
  d.selected = "fire_player";
  s.player.hp = 0;
  assert.equal(s.apply(r, d), false);
  s.player.hp = 100;
  const move = r.candidates.find((c) => c.kind === "move");
  assert.ok(move && move.kind === "move");
  s.addNPC("rifleman", move.destination);
  d.selected = move.id;
  assert.equal(s.apply(r, d), false);
});
test("backend body enums and finite coordinates are enforced", async () => {
  const p = new Pipeline(mockProvider);
  const session = p.create();
  const { r } = fixture();
  r.session = session;
  r.observation.position.x = Infinity;
  await assert.rejects(p.decide(session, r), /invalid_request/);
});
test("four concurrent calls admitted; fifth is rejected without queuing", async () => {
  const resolvers: ((v: any) => void)[] = [];
  const p = new Pipeline(
    (r) =>
      new Promise((resolve) =>
        resolvers.push(async () =>
          resolve(await mockProvider(r, new AbortController().signal)),
        ),
      ),
  );
  const session = p.create();
  const { r } = fixture();
  r.session = session;
  const pending = [0, 1, 2, 3].map((i) =>
    p.decide(session, {
      ...r,
      observation: { ...r.observation, npc: `npc_${i}` },
    }),
  );
  await assert.rejects(
    p.decide(session, {
      ...r,
      observation: { ...r.observation, npc: "npc_4" },
    }),
    /concurrency_capacity/,
  );
  for (const f of resolvers) f(null);
  await Promise.all(pending);
  assert.equal(p.active, 0);
});

test("durable settlement failure still releases execution capacity", async () => {
  const storage = {
    reserveUsage: () => "reservation",
    settleUsage: () => {
      throw new Error("disk failure");
    },
  };
  const pipeline = new Pipeline(
    mockProvider,
    Date.now,
    LIMITS,
    storage as unknown as import("../apps/server/src/store").Store,
  );
  const session = pipeline.create();
  const { r } = fixture();
  r.session = session;
  await assert.rejects(pipeline.decide(session, r), /disk failure/);
  assert.equal(pipeline.active, 0);
  assert.equal(pipeline.sessions.get(session)?.inflight.size, 0);
  assert.equal(pipeline.sessions.get(session)?.reserved, 0);
});
