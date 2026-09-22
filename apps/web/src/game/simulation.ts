import {
  ENEMY_TYPES,
  infantryArchetype,
  type EnemyArchetype,
  type RosterProfile,
} from "./enemyRoster";
import { weaponOrigin } from "./weaponOrigins";
import { mapPreset, type MapId } from "./maps";
import { armorSettings } from "./armor";
import { type Difficulty, difficultyPreset } from "./difficulty";
import { waveSettings, type WaveProfile } from "./waveProfile";
import { UPGRADES, type Upgrade } from "./upgrades";
import {
  VERSION,
  type Candidate,
  type Decision,
  type DecisionRequest,
  type Vec,
} from "../../../../packages/shared/contracts";
import {
  arena,
  clear,
  distance,
  path,
  segmentBox,
  segmentCircle,
  sight,
} from "./arena";
export const DT = 1 / 60;
export const FIRST_SPAWN_SECONDS = 5;
export type Input = {
  x: number;
  z: number;
  aim: Vec;
  fire: boolean;
  reload: boolean;
  interact: boolean;
  dodge: boolean;
};
export const idleInput = (): Input => ({
  x: 0,
  z: 0,
  aim: { x: 0, z: 0 },
  fire: false,
  reload: false,
  interact: false,
  dodge: false,
});
export type Actor = {
  id: string;
  generation: number;
  pos: Vec;
  previous: Vec;
  previousAngle: number;
  hp: number;
  ammo: number;
  angle: number;
  reloadUntil: number;
  shotAt: number;
};
export type NPC = Actor & {
  maxHp: number;
  archetype: EnemyArchetype;
  role: "rifleman" | "general" | "tank";
  sequence: number;
  action: Candidate | null;
  actionUntil: number;
  actionStart: number;
  route: Vec[];
  lastSeen: { position: Vec; tick: number } | null;
  lastHeard: {
    position: Vec;
    tick: number;
    kind: "footsteps" | "gunfire";
  } | null;
  damagedAt: number;
  starvedAt: number;
  decision: Decision | null;
  request: DecisionRequest | null;
  nextDecision: number;
};
type Bullet = {
  id: number;
  shell?: boolean;
  kind?: "rocket" | "grenade";
  age?: number;
  origin?: Vec;
  launchFrom?: Vec;
  height?: number;
  pos: Vec;
  velocity: Vec;
  owner: string;
  life: number;
};
export type Applied = {
  tick: number;
  request: DecisionRequest;
  decision: Decision;
};
export type MissionMode = "mission" | "endless";
export const REPLAY_TICK_LIMIT = 30 * 60 * 60;
export type CombatProfile = "infantry.v1" | "armor.v1" | "armor.v2";
export type Recording = {
  rosterProfile?: RosterProfile;
  mapId?: MapId;
  difficulty?: Difficulty;
  combatProfile?: CombatProfile;
  projectileOriginProfile?: "muzzle.v1" | "center.v1";
  waveProfile?: WaveProfile;
  missionMode?: MissionMode;
  truncated?: boolean;
  version: "replay.v1" | "replay.v2";
  upgrades?: { tick: number; choice: Upgrade }[];
  seed: number;
  mode: string;
  inputs: { tick: number; input: Input }[];
  decisions: Applied[];
  epochs: { tick: number; epoch: number }[];
};
export class Simulation {
  rosterProfile: RosterProfile = "specialists.v1";
  infantryScheduled = 0;
  projectileOriginProfile: "muzzle.v1" | "center.v1" = "muzzle.v1";
  difficulty: Difficulty = "normal.v1";
  combatProfile: CombatProfile = "armor.v2";
  tankScheduledWave = -1;
  tanksScheduled = 0;
  lastTankAt = -100000;
  mapId: MapId;
  arena: typeof arena;
  clear(p: Vec, radius = 0.45) {
    return clear(p, radius, this.arena);
  }
  sight(a: Vec, b: Vec) {
    return sight(a, b, this.arena);
  }
  path(a: Vec, b: Vec, radius = 0.45) {
    return path(a, b, radius, this.arena);
  }
  waveProfile: WaveProfile = "pressure.v1";
  missionMode: MissionMode = "mission";
  tick = 0;
  epoch = 0;
  session = "offline";
  status:
    | "ready"
    | "running"
    | "paused"
    | "reconnecting"
    | "upgrading"
    | "won"
    | "lost" = "ready";
  reason = "";
  lastStarvation: {
    tick: number;
    waiting: {
      id: string;
      waitTicks: number;
      nextDecision: number;
      lastChoice: string | null;
    }[];
  } | null = null;
  mode: "strict" | "mock" | "replay" = "strict";
  player: Actor = {
    id: "player",
    generation: 0,
    pos: { ...arena.kitchen },
    previous: { ...arena.kitchen },
    previousAngle: 0,
    hp: 100,
    ammo: 12,
    angle: 0,
    reloadUntil: 0,
    shotAt: -100,
  };
  npcs: NPC[] = [];
  bullets: Bullet[] = [];
  // Bounded presentation events; never queried by perception or combat rules.
  impacts: {
    pos: Vec;
    from: Vec;
    born: number;
    target: "actor" | "cover";
    owner: string;
  }[] = [];
  coffeeFeedback: {
    kind: "fill" | "spill" | "delivery";
    pos: Vec;
    born: number;
    amount: number;
    score: number;
  }[] = [];
  recordCoffee(kind: "fill" | "spill" | "delivery", amount = 0, score = 0) {
    this.coffeeFeedback.push({
      kind,
      pos: { ...this.player.pos },
      born: this.tick,
      amount,
      score,
    });
    if (this.coffeeFeedback.length > 8) this.coffeeFeedback.shift();
  }
  cup: { volume: number; warmth: number } | null = null;
  deliveries = 0;
  score = 0;
  kills = 0;
  progressionEnabled = true;
  xp = 0;
  level = 1;
  ranks: Record<Upgrade, number> = {
    boots: 0,
    damage: 0,
    cadence: 0,
    heal: 0,
    magazine: 0,
    rockets: 0,
    grenades: 0,
  };
  rocketAt = -180;
  grenadeAt = -300;
  get magazineSize() {
    return 12 + this.ranks.magazine * 6;
  }
  gems: { id: number; pos: Vec; value: number; born: number }[] = [];
  deathBursts: { pos: Vec; born: number }[] = [];
  tankBursts: { pos: Vec; born: number }[] = [];
  events: {
    id: number;
    kind:
      | "cannon"
      | "tankDeath"
      | "shot"
      | "impact"
      | "hit"
      | "death"
      | "pickup"
      | "coffee"
      | "spill"
      | "delivery"
      | "level";
    pos?: Vec;
    enemy?: boolean;
    tick: number;
  }[] = [];
  eventSerial = 0;
  gemSerial = 0;
  get xpNeeded() {
    return 30 + (this.level - 1) * 15;
  }
  get upgradeChoices(): Upgrade[] {
    return (Object.keys(UPGRADES) as Upgrade[]).filter(
      (key) => this.ranks[key] < UPGRADES[key].cap,
    );
  }
  emit(kind: Simulation["events"][number]["kind"], pos?: Vec, enemy?: boolean) {
    this.events.push({
      id: ++this.eventSerial,
      kind,
      tick: this.tick,
      ...(pos ? { pos: { ...pos } } : {}),
      ...(enemy ? { enemy } : {}),
    });
    if (this.events.length > 64) this.events.shift();
  }
  chooseUpgrade(choice: Upgrade) {
    if (this.status !== "upgrading" || !this.upgradeChoices.includes(choice))
      return false;
    this.xp -= this.xpNeeded;
    this.level++;
    this.ranks[choice]++;
    if (choice === "magazine") this.player.ammo += 6;
    if (choice === "heal") this.player.hp = Math.min(100, this.player.hp + 25);
    if (this.tick < REPLAY_TICK_LIMIT && !this.recording.truncated)
      this.recording.upgrades?.push({ tick: this.tick, choice });
    this.status = this.xp >= this.xpNeeded ? "upgrading" : "running";
    return true;
  }
  collectGems() {
    if (this.status !== "running") return;
    this.gems = this.gems.filter((gem) => {
      if (this.tick - gem.born > 90 * 60) return false;
      if (
        distance(this.player.pos, gem.pos) > 1.4 ||
        !this.sight(this.player.pos, gem.pos)
      )
        return true;
      this.xp += gem.value;
      this.score += 25;
      this.emit("pickup");
      return false;
    });
    if (this.progressionEnabled && this.xp >= this.xpNeeded) {
      this.status = "upgrading";
      this.emit("level");
    }
  }
  interaction = 0;
  interactionAt = "";
  spillAt = -100;
  dodgeAt = -100;
  dodgeUntil = 0;
  spillFxUntil = 0;
  tent: Vec;
  seed: number;
  rng: number;
  serial = 0;
  footstepAt = -100;
  lastSpawn = -100;
  wave = 0;
  spawnQueue = 0;
  scheduled = 0;
  telegraphs: {
    pos: Vec;
    until: number;
    role?: "rifleman" | "tank";
    archetype?: EnemyArchetype;
  }[] = [];
  logs: {
    tick: number;
    npc: string;
    selected?: string;
    source?: string;
    reason?: string;
  }[] = [];
  recording: Recording;
  constructor(seed = 7341, mapId: MapId = "woodland.v1") {
    this.mapId = mapId;
    this.arena = mapPreset(mapId).layout;
    this.player.pos = { ...this.arena.kitchen };
    this.player.previous = { ...this.player.pos };
    this.seed = seed;
    this.rng = seed;
    this.tent = {
      ...this.arena.tents[Math.floor(this.random() * this.arena.tents.length)],
    };
    this.recording = {
      version: "replay.v2",
      rosterProfile: this.rosterProfile,
      mapId,
      waveProfile: this.waveProfile,
      combatProfile: this.combatProfile,
      projectileOriginProfile: this.projectileOriginProfile,
      upgrades: [],
      seed,
      mode: this.mode,
      inputs: [],
      decisions: [],
      epochs: [],
    };
    this.addNPC("general", { x: this.tent.x + 1, z: this.tent.z });
  }
  get time() {
    return this.tick * DT;
  }
  random() {
    this.rng = (Math.imul(1664525, this.rng) + 1013904223) >>> 0;
    return this.rng / 4294967296;
  }
  start(
    mode: "strict" | "mock" | "replay",
    session: string,
    missionMode: MissionMode = "mission",
    difficulty: Difficulty = "normal.v1",
  ) {
    difficultyPreset(difficulty);
    this.difficulty = difficulty;
    this.recording.difficulty = difficulty;
    this.missionMode = missionMode;
    this.recording.missionMode = missionMode;
    this.recording.rosterProfile = this.rosterProfile;
    this.recording.waveProfile = this.waveProfile;
    this.recording.combatProfile = this.combatProfile;
    this.recording.projectileOriginProfile = this.projectileOriginProfile;
    this.mode = mode;
    this.session = session;
    this.recording.mode = mode;
    this.status = "running";
  }
  invalidate() {
    this.epoch++;
    if (this.recording.epochs.length >= 10000) this.recording.truncated = true;
    if (this.tick < REPLAY_TICK_LIMIT && !this.recording.truncated)
      this.recording.epochs.push({ tick: this.tick, epoch: this.epoch });
    for (const n of this.npcs) {
      n.action = null;
      n.route = [];
      n.request = null;
      n.starvedAt = this.tick;
      n.nextDecision = this.tick;
    }
  }
  pause() {
    if (this.status === "running" || this.status === "reconnecting") {
      this.status = "paused";
      this.invalidate();
    }
  }
  resume() {
    if (this.status === "paused" || this.status === "reconnecting") {
      this.invalidate();
      this.status = "running";
      this.reason = "";
    }
  }
  addNPC(role: NPC["role"], pos: Vec, archetype: EnemyArchetype = "rifleman") {
    const maxHp =
      role === "general"
        ? 100
        : role === "tank"
          ? this.combatProfile === "armor.v2"
            ? armorSettings(this.wave, this.difficulty).hp
            : 90
          : 30;
    const n: NPC = {
      maxHp,
      archetype,
      id: role === "general" ? "general" : `enemy_${++this.serial}`,
      generation: 0,
      pos: { ...pos },
      previous: { ...pos },
      previousAngle: 0,
      hp: maxHp,
      ammo: 12,
      angle: 0,
      reloadUntil: 0,
      shotAt: -100,
      role,
      sequence: 0,
      action: null,
      actionUntil: 0,
      actionStart: 0,
      route: [],
      lastSeen: null,
      lastHeard: null,
      damagedAt: -1000,
      starvedAt: this.tick,
      decision: null,
      request: null,
      nextDecision: this.tick,
    };
    this.npcs.push(n);
    return n;
  }
  radius(actor: Actor) {
    return "role" in actor && actor.role === "tank" ? 1.2 : 0.45;
  }
  move(actor: Actor, dx: number, dz: number) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.2));
    for (let i = 0; i < steps; i++) {
      const a = { x: actor.pos.x + dx / steps, z: actor.pos.z },
        b = { x: actor.pos.x, z: actor.pos.z + dz / steps };
      const free = (p: Vec) =>
        this.clear(p, this.radius(actor)) &&
        !this.npcs.some(
          (n) =>
            n !== actor &&
            n.hp > 0 &&
            distance(n.pos, p) < this.radius(n) + this.radius(actor),
        ) &&
        !(
          actor !== this.player &&
          distance(this.player.pos, p) < 0.45 + this.radius(actor)
        );
      if (free(a)) actor.pos.x = a.x;
      b.x = actor.pos.x;
      if (free(b)) actor.pos.z = b.z;
    }
  }
  infantrySettings(n: NPC) {
    return ENEMY_TYPES[
      this.rosterProfile === "legacy" ? "rifleman" : n.archetype
    ];
  }
  inFireRange(n: NPC) {
    return (
      distance(n.pos, this.player.pos) <= this.infantrySettings(n).fireRange
    );
  }
  visible(n: NPC) {
    return (
      n.role !== "general" &&
      distance(n.pos, this.player.pos) <=
        (n.role === "rifleman"
          ? this.infantrySettings(n).perceptionRange
          : 14) &&
      this.sight(n.pos, this.player.pos) &&
      this.player.hp > 0
    );
  }
  hear(kind: "footsteps" | "gunfire") {
    const range = kind === "gunfire" ? 22 : 16;
    // Quantized, temporary sound observations. No continuous hidden target tracking.
    const position = {
      x: Math.max(-21, Math.min(21, Math.round(this.player.pos.x / 3) * 3)),
      z: Math.max(-17, Math.min(17, Math.round(this.player.pos.z / 3) * 3)),
    };
    for (const n of this.npcs)
      if (n.role !== "general" && distance(n.pos, this.player.pos) <= range)
        n.lastHeard = { position: { ...position }, tick: this.tick, kind };
  }
  candidates(n: NPC): Candidate[] {
    if (n.role === "general")
      return ["map", "watch", "sip", "pleased"].map((reaction) => ({
        id: reaction,
        kind: "reaction",
        reaction: reaction as "map",
        duration: 4,
      }));
    const actions: Candidate[] = [{ id: "hold", kind: "hold", duration: 1 }];
    if (
      n.role === "rifleman" &&
      this.visible(n) &&
      this.inFireRange(n) &&
      n.ammo > 0
    )
      actions.push({
        id: "fire_player",
        kind: "fire",
        target: "player",
        duration: 0.8,
      });
    if (n.role === "tank" && this.visible(n) && n.ammo > 0)
      actions.push({
        id: "cannon_player",
        kind: "cannon",
        target: "player",
        aimPoint: { ...this.player.pos },
        duration: 1.8,
      });
    if (n.ammo < 12)
      actions.push({ id: "reload", kind: "reload", duration: 1.2 });
    const known = this.visible(n)
      ? this.player.pos
      : n.lastSeen && this.tick - n.lastSeen.tick <= 600
        ? n.lastSeen.position
        : n.lastHeard && this.tick - n.lastHeard.tick <= 180
          ? n.lastHeard.position
          : null;
    if (known && distance(n.pos, known) > 2) {
      const route = this.path(n.pos, known, this.radius(n));
      const destination = route.filter((p) => distance(n.pos, p) <= 4).at(-1);
      if (
        destination &&
        distance(n.pos, destination) > 0.5 &&
        !this.npcs.some(
          (o) =>
            o !== n &&
            o.hp > 0 &&
            distance(o.pos, destination) <
              this.radius(n) + this.radius(o) + 0.1,
        )
      )
        actions.push({
          id: "advance_contact",
          kind: "move",
          destination: { ...destination },
          purpose: this.visible(n) ? "approach" : "investigate",
          duration: 2,
        });
    }
    // Enumerate surrounding feasible destinations uniformly; no scoring or chosen tactical goal.
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const destination = {
        x: Math.round(n.pos.x + Math.cos(a) * 4),
        z: Math.round(n.pos.z + Math.sin(a) * 4),
      };
      if (
        this.clear(destination, this.radius(n)) &&
        !this.npcs.some(
          (other) =>
            other !== n &&
            other.hp > 0 &&
            distance(other.pos, destination) <
              this.radius(n) + this.radius(other) + 0.1,
        ) &&
        this.path(n.pos, destination, this.radius(n)).length
      )
        actions.push({
          id: `move_${i}`,
          kind: "move",
          destination,
          purpose: "reposition",
          route:
            this.mapId === "village.v1"
              ? undefined
              : destination.x < -8
                ? "orchard"
                : destination.z > 3
                  ? "supply"
                  : "central",
          occludedFromLastSeen:
            n.lastSeen && this.tick - n.lastSeen.tick <= 600
              ? !this.sight(destination, n.lastSeen.position)
              : null,
          duration: 2,
        });
    }
    // Existing destination reservations are legality constraints, not tactical scores.
    return actions.filter((action) => this.legal(n, action));
  }
  request(n: NPC): DecisionRequest {
    if (this.visible(n))
      n.lastSeen = { position: { ...this.player.pos }, tick: this.tick };
    const age = n.lastSeen ? (this.tick - n.lastSeen.tick) * DT : Infinity;
    const r: DecisionRequest = {
      version: VERSION,
      session: this.session,
      epoch: this.epoch,
      generation: n.generation,
      sequence: ++n.sequence,
      tick: this.tick,
      observation: {
        npc: n.id,
        role: n.role,
        ...(n.role === "rifleman" && this.rosterProfile === "specialists.v1"
          ? {
              archetype: n.archetype,
              combat: {
                movementSpeed: this.infantrySettings(n).speed,
                fireRange: this.infantrySettings(n).fireRange,
                fireCadenceTicks: this.infantrySettings(n).cadenceTicks,
                fireWindupTicks: this.infantrySettings(n).windupTicks,
              },
            }
          : {}),
        position: { ...n.pos },
        hp: n.hp,
        ...(this.combatProfile === "armor.v2" ? { maxHp: n.maxHp } : {}),
        ammo: n.ammo,
        visible: this.visible(n)
          ? [{ id: "player", position: { ...this.player.pos } }]
          : [],
        lastSeen:
          n.lastSeen && age <= 10
            ? { position: { ...n.lastSeen.position }, age }
            : null,
        recentDamage: this.tick - n.damagedAt < 60,
        audible:
          n.lastHeard && this.tick - n.lastHeard.tick <= 180
            ? {
                position: { ...n.lastHeard.position },
                age: (this.tick - n.lastHeard.tick) * DT,
                kind: n.lastHeard.kind,
              }
            : null,
        currentAction: n.action?.id ?? null,
        frame: "XZ_meters_Y_up",
      },
      candidates: this.candidates(n),
    };
    n.request = r;
    return r;
  }
  legal(n: NPC, c: Candidate) {
    if (n.hp <= 0) return false;
    if (c.kind === "cannon")
      return (
        n.role === "tank" &&
        n.ammo > 0 &&
        this.visible(n) &&
        this.sight(n.pos, c.aimPoint) &&
        distance(n.pos, c.aimPoint) > 0.1
      );
    if (c.kind === "fire")
      return (
        n.role === "rifleman" &&
        n.ammo > 0 &&
        this.visible(n) &&
        this.inFireRange(n) &&
        c.target === "player"
      );
    if (c.kind === "reload") return n.role !== "general" && n.ammo < 12;
    if (c.kind === "move")
      return (
        this.clear(c.destination, this.radius(n)) &&
        !this.npcs.some(
          (o) =>
            o !== n &&
            o.hp > 0 &&
            (distance(o.pos, c.destination) <
              this.radius(n) + this.radius(o) + 0.1 ||
              (o.action?.kind === "move" &&
                distance(o.action.destination, c.destination) <
                  this.radius(n) + this.radius(o) + 0.1)),
        ) &&
        this.path(n.pos, c.destination, this.radius(n)).length > 0
      );
    return true;
  }
  apply(r: DecisionRequest, d: Decision) {
    const n = this.npcs.find((n) => n.id === d.npc);
    let reason = "";
    if (!n || n.hp <= 0) reason = "dead_or_missing";
    else if (this.status !== "running") reason = "not_running";
    else if (
      d.session !== this.session ||
      r.session !== this.session ||
      d.epoch !== this.epoch ||
      r.epoch !== this.epoch ||
      d.generation !== n.generation ||
      d.sequence !== n.sequence ||
      d.tick !== r.tick ||
      d.npc !== r.observation.npc
    )
      reason = "identity_mismatch";
    else if (
      n.decision?.epoch === d.epoch &&
      n.decision?.sequence === d.sequence
    )
      reason = "duplicate";
    else if (this.tick - r.tick > 60 || r.tick > this.tick) reason = "stale";
    else if (this.mode === "strict" && d.source !== "jev")
      reason = "wrong_source";
    const c = r.candidates.find((c) => c.id === d.selected);
    if (!reason && (!c || !this.legal(n!, c))) reason = "illegal";
    this.logs.push({
      tick: this.tick,
      npc: d.npc,
      selected: d.selected,
      source: d.source,
      ...(reason ? { reason } : {}),
    });
    if (this.logs.length > 500) this.logs.shift();
    if (reason) return false;
    n!.action = c!;
    n!.actionStart = this.tick;
    n!.actionUntil = this.tick + Math.ceil(c!.duration / DT);
    n!.starvedAt = this.tick;
    n!.decision = d;
    n!.request = null;
    n!.route =
      c!.kind === "move"
        ? this.path(n!.pos, c!.destination, this.radius(n!))
        : [];
    if (c!.kind === "reload") n!.reloadUntil = n!.actionUntil;
    if (this.tick < REPLAY_TICK_LIMIT && !this.recording.truncated)
      this.recording.decisions.push({
        tick: this.tick,
        request: structuredClone(r),
        decision: structuredClone(d),
      });
    return true;
  }
  spill() {
    if (this.cup && this.tick - this.spillAt >= 60) {
      const spilled = Math.min(5, this.cup.volume);
      this.cup.volume = Math.max(0, this.cup.volume - 5);
      if (spilled > 0) {
        this.recordCoffee("spill", spilled);
        this.emit("spill", this.player.pos);
      }
      this.spillAt = this.tick;
      this.spillFxUntil = this.tick + 20;
    }
  }
  damage(actor: Actor, amount: number) {
    if (actor.hp <= 0) return;
    actor.hp = Math.max(0, actor.hp - amount);
    this.emit("hit", actor.pos);
    if (actor === this.player) {
      this.spill();
      if (actor.hp === 0) {
        this.status = "lost";
        this.reason = "The coffee run ends here.";
      }
    } else {
      const n = actor as NPC;
      n.damagedAt = this.tick;
      if (n.hp === 0) {
        this.kills++;
        this.score += 10;
        this.emit(n.role === "tank" ? "tankDeath" : "death", n.pos);
        if (n.role === "tank") {
          this.tankBursts.push({ pos: { ...n.pos }, born: this.tick });
          if (this.tankBursts.length > 8) this.tankBursts.shift();
        } else {
          this.deathBursts.push({ pos: { ...n.pos }, born: this.tick });
          if (this.deathBursts.length > 32) this.deathBursts.shift();
        }
        if (this.progressionEnabled && n.role !== "general") {
          const gem = {
            id: ++this.gemSerial,
            pos: { ...n.pos },
            value: 10,
            born: this.tick,
          };
          if (this.gems.length >= 128) gem.value += this.gems.shift()!.value;
          this.gems.push(gem);
        }
        n.action = null;
        n.generation++;
        n.request = null;
      } else if (n.role !== "tank") {
        n.action = null;
        n.starvedAt = this.tick;
        n.nextDecision = this.tick;
      }
    }
  }
  launch(actor: Actor, kind: "rifle" | "rocket" | "grenade" | "tank") {
    if (this.projectileOriginProfile === "center.v1")
      return { origin: { ...actor.pos }, pos: { ...actor.pos } };
    const point = weaponOrigin(actor.pos, actor.angle, kind);
    const pos = { x: point.x, z: point.z };
    return {
      origin: { ...pos },
      pos,
      launchFrom: { ...actor.pos },
      height: point.y,
    };
  }
  shoot(actor: Actor, speed: number, aim?: Vec) {
    if (
      actor.ammo <= 0 ||
      actor.reloadUntil > this.tick ||
      this.tick - actor.shotAt <
        (actor === this.player
          ? Math.max(4, 9 - this.ranks.cadence)
          : "role" in actor && actor.role === "rifleman"
            ? this.infantrySettings(actor as NPC).cadenceTicks
            : 24)
    )
      return;
    actor.ammo--;
    if (actor === this.player) {
      this.hear("gunfire");
    }
    this.emit(
      "role" in actor && actor.role === "tank" ? "cannon" : "shot",
      actor.pos,
      actor !== this.player,
    );
    actor.shotAt = this.tick;
    const rifleLaunch = this.launch(
      actor,
      "role" in actor && actor.role === "tank" ? "tank" : "rifle",
    );
    const fireAngle =
      aim && this.projectileOriginProfile === "muzzle.v1"
        ? Math.atan2(aim.x - rifleLaunch.pos.x, aim.z - rifleLaunch.pos.z)
        : actor.angle;
    this.bullets.push({
      id: ++this.serial,
      ...rifleLaunch,
      velocity: {
        x: Math.sin(fireAngle) * speed,
        z: Math.cos(fireAngle) * speed,
      },
      owner: actor.id,
      life: 150,
    });
    if (actor === this.player) {
      for (const kind of ["rocket", "grenade"] as const) {
        const rocket = kind === "rocket";
        if (
          !this.ranks[rocket ? "rockets" : "grenades"] ||
          this.tick - (rocket ? this.rocketAt : this.grenadeAt) <
            (rocket ? 180 : 300)
        )
          continue;
        if (rocket) this.rocketAt = this.tick;
        else this.grenadeAt = this.tick;
        const velocity = rocket ? 18 : 8;
        const auxiliaryLaunch = this.launch(actor, kind);
        const auxiliaryAngle =
          aim && this.projectileOriginProfile === "muzzle.v1"
            ? Math.atan2(
                aim.x - auxiliaryLaunch.pos.x,
                aim.z - auxiliaryLaunch.pos.z,
              )
            : actor.angle;
        this.bullets.push({
          id: ++this.serial,
          kind,
          age: 0,
          ...auxiliaryLaunch,
          velocity: {
            x: Math.sin(auxiliaryAngle) * velocity,
            z: Math.cos(auxiliaryAngle) * velocity,
          },
          owner: actor.id,
          life: rocket ? 90 : 60,
        });
      }
    }
  }
  explode(b: Bullet, pos: Vec, direct: Actor | null) {
    const radius = b.kind === "grenade" ? 3 : 2.4;
    for (const n of this.npcs) {
      if (n.role === "general" || n.hp <= 0) continue;
      // Cover blocks splash. A directly struck target still takes one hit.
      if (
        n === direct ||
        (distance(pos, n.pos) <= radius && this.sight(pos, n.pos))
      )
        this.damage(n, b.kind === "grenade" ? 24 : 30);
    }
    this.tankBursts.push({ pos: { ...pos }, born: this.tick });
    if (this.tankBursts.length > 8) this.tankBursts.shift();
    this.emit("cannon", pos);
  }
  traceBullet(b: Bullet, from: Vec, to: Vec) {
    let hit = 1,
      actor: Actor | null = null,
      blocked = false;
    for (const o of this.arena.obstacles) {
      const t = segmentBox(from, to, o, b.shell ? 0.18 : 0.07);
      if (t !== null && t <= hit) {
        hit = t;
        blocked = true;
      }
    }
    const targets =
      b.owner === "player"
        ? this.npcs.filter((n) => n.role !== "general" && n.hp > 0)
        : [this.player];
    for (const a of targets) {
      const t = segmentCircle(
        from,
        to,
        a.pos,
        this.radius(a) + (b.shell ? 0.18 : 0),
      );
      if (t !== null && t < hit) {
        hit = t;
        actor = a;
        blocked = true;
      }
    }
    return { hit, actor, blocked };
  }
  step(input: Input) {
    if (this.status !== "running") return;
    if (
      this.mode === "strict" &&
      this.npcs.some(
        (n) => n.hp > 0 && !n.action && this.tick - n.starvedAt >= 90,
      )
    ) {
      this.lastStarvation = {
        tick: this.tick,
        waiting: this.npcs
          .filter((n) => n.hp > 0 && !n.action)
          .map((n) => ({
            id: n.id,
            waitTicks: this.tick - n.starvedAt,
            nextDecision: n.nextDecision,
            lastChoice: n.decision?.selected ?? null,
          })),
      };
      this.status = "reconnecting";
      this.reason = "Reconnecting to command";
      this.invalidate();
      return;
    }
    if (this.tick >= REPLAY_TICK_LIMIT || this.recording.truncated)
      this.recording.truncated = true;
    else
      this.recording.inputs.push({
        tick: this.tick,
        input: structuredClone(input),
      });
    for (const actor of [this.player, ...this.npcs]) {
      actor.previous = { ...actor.pos };
      actor.previousAngle = actor.angle;
    }
    this.tick++;
    if (this.missionMode === "mission" && this.tick >= 480 * 60) {
      this.status = this.deliveries >= 5 && this.player.hp > 0 ? "won" : "lost";
      this.reason =
        this.status === "won"
          ? "Outpost held. Coffee delivered."
          : "Outpost held; coffee orders missed";
      return;
    }
    const p = this.player;
    if (p.reloadUntil && this.tick >= p.reloadUntil) {
      p.ammo = this.magazineSize;
      p.reloadUntil = 0;
    }
    if (input.reload && p.ammo < this.magazineSize && !p.reloadUntil)
      p.reloadUntil = this.tick + 72;
    if (input.dodge && this.tick - this.dodgeAt >= 120) {
      this.dodgeAt = this.tick;
      this.dodgeUntil = this.tick + 12;
      this.spill();
    }
    const length = Math.hypot(input.x, input.z) || 1;
    const speed =
      5 *
      (1 + this.ranks.boots * 0.1) *
      (this.cup ? 0.95 : 1) *
      (this.tick < this.dodgeUntil ? 2.5 : 1);
    this.move(
      p,
      (input.x / Math.max(1, length)) * speed * DT,
      (input.z / Math.max(1, length)) * speed * DT,
    );
    if (
      distance(p.pos, p.previous) > 0.01 &&
      this.tick - this.footstepAt >= 30
    ) {
      this.footstepAt = this.tick;
      this.hear("footsteps");
    }
    p.angle = Math.atan2(input.aim.x - p.pos.x, input.aim.z - p.pos.z);
    if (input.fire) this.shoot(p, 26, input.aim);
    if (this.cup) this.cup.warmth = Math.max(0, this.cup.warmth - 0.5 * DT);
    const at =
      distance(p.pos, this.arena.kitchen) < 2
        ? "kitchen"
        : distance(p.pos, this.tent) < 2
          ? "tent"
          : "";
    if (input.interact && at) {
      if (this.interactionAt !== at) {
        this.interaction = 0;
        this.interactionAt = at;
      }
      this.interaction++;
      if (this.interaction >= 36) {
        this.interaction = 0;
        if (at === "kitchen") {
          if (!this.cup || this.cup.volume < 100 || this.cup.warmth < 99) {
            this.emit("coffee", p.pos);
            this.recordCoffee("fill");
          }
          this.cup = { volume: 100, warmth: 100 };
        } else if (this.cup && this.cup.volume >= 25 && this.cup.warmth >= 20) {
          this.deliveries++;
          this.emit("delivery", p.pos);
          const reward = 1000 + 5 * (this.cup.volume + this.cup.warmth);
          this.recordCoffee("delivery", Math.min(20, 100 - p.hp), reward);
          this.score += reward;
          p.hp = Math.min(100, p.hp + 20);
          this.cup = null;
        }
      }
    } else {
      this.interaction = 0;
      this.interactionAt = "";
    }
    this.waves();
    for (const n of this.npcs) {
      if (n.hp <= 0) continue;
      if (this.visible(n))
        n.lastSeen = { position: { ...p.pos }, tick: this.tick };
      const a = n.action;
      if (!a) continue;
      if (this.tick >= n.actionUntil) {
        if (a.kind === "reload") {
          n.ammo = 12;
          n.reloadUntil = 0;
        }
        n.action = null;
        n.starvedAt = this.tick;
        continue;
      }
      if (a.kind === "fire") {
        if (!this.visible(n) || !this.inFireRange(n) || n.ammo === 0) {
          n.action = null;
          n.starvedAt = this.tick;
          n.nextDecision = this.tick;
          continue;
        }
        const target = Math.atan2(p.pos.x - n.pos.x, p.pos.z - n.pos.z);
        const diff = Math.atan2(
          Math.sin(target - n.angle),
          Math.cos(target - n.angle),
        );
        n.angle += Math.max(-2.5 * DT, Math.min(2.5 * DT, diff));
        if (
          this.tick - n.actionStart >= this.infantrySettings(n).windupTicks &&
          Math.abs(diff) < 0.15
        )
          this.shoot(n, this.infantrySettings(n).bulletSpeed);
      }
      if (a.kind === "cannon") {
        // The selected snapshot stays fixed. No tracking, hidden retarget or tactical fallback.
        const target = Math.atan2(
          a.aimPoint.x - n.pos.x,
          a.aimPoint.z - n.pos.z,
        );
        const diff = Math.atan2(
          Math.sin(target - n.angle),
          Math.cos(target - n.angle),
        );
        n.angle += Math.max(-3 * DT, Math.min(3 * DT, diff));
        if (
          this.tick - n.actionStart >= 72 &&
          n.shotAt < n.actionStart &&
          Math.abs(diff) < 0.05
        ) {
          const before = n.shotAt;
          this.shoot(n, 9);
          if (n.shotAt !== before)
            this.bullets[this.bullets.length - 1].shell = true;
        }
      }
      if (a.kind === "move") {
        const next = n.route[0];
        if (!next) {
          n.action = null;
          n.starvedAt = this.tick;
          n.nextDecision = this.tick;
          continue;
        }
        const len = distance(n.pos, next);
        if (len < 0.1) {
          n.route.shift();
          continue;
        }
        const old = { ...n.pos };
        this.move(
          n,
          ((next.x - n.pos.x) / len) *
            (n.role === "tank" ? 1.4 : this.infantrySettings(n).speed) *
            DT,
          ((next.z - n.pos.z) / len) *
            (n.role === "tank" ? 1.4 : this.infantrySettings(n).speed) *
            DT,
        );
        n.angle = Math.atan2(next.x - old.x, next.z - old.z);
        if (distance(old, n.pos) < 0.001) {
          n.action = null;
          n.route = [];
          n.starvedAt = this.tick;
          n.nextDecision = this.tick;
        }
      }
    }
    for (const b of this.bullets) {
      const to = {
        x: b.pos.x + b.velocity.x * DT,
        z: b.pos.z + b.velocity.z * DT,
      };
      let from = b.pos;
      let end = to;
      let result = this.traceBullet(b, from, end);
      if (b.launchFrom) {
        const launch = this.traceBullet(b, b.launchFrom, b.pos);
        if (launch.blocked) {
          from = b.launchFrom;
          end = b.pos;
          result = launch;
        }
        delete b.launchFrom;
      }
      const { hit, actor, blocked } = result;
      if (blocked) {
        const impact = {
          x: from.x + (end.x - from.x) * hit,
          z: from.z + (end.z - from.z) * hit,
        };
        this.impacts.push({
          pos: impact,
          from: { ...from },
          born: this.tick,
          target: actor ? "actor" : "cover",
          owner: b.owner,
        });
        if (this.impacts.length > 64) this.impacts.shift();
        if (!actor) this.emit("impact", impact);
      }
      if (actor && !b.kind)
        this.damage(
          actor,
          b.owner === "player"
            ? 10 + this.ranks.damage * 2
            : Math.round(
                (b.shell ? 16 : 8) *
                  difficultyPreset(this.difficulty).damageScale,
              ),
        );
      const impact = {
        x: from.x + (end.x - from.x) * hit,
        z: from.z + (end.z - from.z) * hit,
      };
      b.pos = blocked ? impact : to;
      b.life--;
      if (b.kind) b.age = (b.age ?? 0) + 1;
      if (blocked || !this.clear(to, 0)) b.life = 0;
      if (b.kind && b.life <= 0) this.explode(b, b.pos, actor);
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
    this.coffeeFeedback = this.coffeeFeedback.filter(
      (v) => this.tick - v.born < 120,
    );
    this.impacts = this.impacts.filter((v) => this.tick - v.born < 18);
    this.npcs = this.npcs.filter((n) => n.hp > 0);
    this.tankBursts = this.tankBursts.filter((b) => this.tick - b.born < 96);
    this.deathBursts = this.deathBursts.filter((b) => this.tick - b.born < 48);
    this.collectGems();
  }
  waves() {
    const wave = Math.floor(this.time / 60);
    if (wave !== this.wave) {
      this.wave = wave;
      this.spawnQueue = 0;
      this.scheduled = 0;
      this.infantryScheduled = 0;
    }
    const settings = waveSettings(wave, this.waveProfile, this.difficulty);
    const within = this.time % 60;
    const desired =
      within < settings.activeSeconds
        ? (Math.floor(
            Math.max(0, within - (wave === 0 ? FIRST_SPAWN_SECONDS : 0)) /
              settings.interval,
          ) +
            1) *
          settings.batch
        : this.scheduled;
    if (within < (wave === 0 ? FIRST_SPAWN_SECONDS : 0)) return;
    if (desired > this.scheduled) {
      this.spawnQueue = Math.min(
        settings.cap,
        this.spawnQueue + desired - this.scheduled,
      );
      this.scheduled = desired;
    }
    for (const mark of [...this.telegraphs])
      if (this.tick >= mark.until) {
        if (
          distance(mark.pos, this.player.pos) >= 10 &&
          !this.npcs.some(
            (n) =>
              distance(n.pos, mark.pos) <
              this.radius(n) + (mark.role === "tank" ? 1.2 : 0.45) + 0.1,
          )
        )
          this.addNPC(mark.role ?? "rifleman", mark.pos, mark.archetype);
        this.telegraphs.splice(this.telegraphs.indexOf(mark), 1);
      }
    if (
      within >= settings.activeSeconds ||
      this.spawnQueue <= 0 ||
      this.tick - this.lastSpawn < settings.telegraphGap ||
      this.npcs.filter((n) => n.role !== "general").length +
        this.telegraphs.length >=
        settings.cap
    )
      return;
    const armor = armorSettings(wave, this.difficulty);
    const tank =
      this.combatProfile === "armor.v2"
        ? (this.tankScheduledWave === wave ? this.tanksScheduled : 0) <
            armor.quota &&
          this.tick - this.lastTankAt >= armor.spacingTicks &&
          this.npcs.filter((n) => n.role === "tank").length +
            this.telegraphs.filter((t) => t.role === "tank").length <
            armor.activeCap
        : this.combatProfile === "armor.v1" &&
          wave >= 3 &&
          this.tankScheduledWave !== wave &&
          !this.npcs.some((n) => n.role === "tank") &&
          !this.telegraphs.some((t) => t.role === "tank");
    const radius = tank ? 1.2 : 0.45;
    const spawnPoints =
      this.waveProfile === "legacy"
        ? this.arena.spawns
        : this.arena.spawns.flatMap((p) =>
            [-1.6, 0, 1.6].map((offset) =>
              Math.abs(p.x) >= 20
                ? { x: p.x, z: p.z + offset }
                : { x: p.x + offset, z: p.z },
            ),
          );
    const spots = (
      tank
        ? spawnPoints.map((p) => ({
            x: Math.max(-20.5, Math.min(20.5, p.x)),
            z: Math.max(-16.5, Math.min(16.5, p.z)),
          }))
        : spawnPoints
    ).filter(
      (p) =>
        this.clear(p, radius) &&
        distance(p, this.player.pos) >= 10 &&
        distance(p, this.tent) >= 6 &&
        distance(p, this.arena.kitchen) >= 6 &&
        !this.npcs.some(
          (n) => distance(n.pos, p) < this.radius(n) + radius + 0.1,
        ) &&
        !this.telegraphs.some(
          (t) =>
            distance(t.pos, p) <
            (t.role === "tank" ? 1.2 : 0.45) + radius + 0.1,
        ),
    );
    if (spots.length) {
      this.telegraphs.push({
        pos: {
          ...(this.wave === 0 &&
          (this.waveProfile === "legacy"
            ? this.scheduled === 1
            : within < FIRST_SPAWN_SECONDS + 2)
            ? spots.reduce((a, b) =>
                distance(a, this.player.pos) < distance(b, this.player.pos)
                  ? a
                  : b,
              )
            : spots[Math.floor(this.random() * spots.length)]),
        },
        until: this.tick + (tank ? 120 : 60),
        ...(tank
          ? { role: "tank" as const }
          : this.rosterProfile === "specialists.v1"
            ? {
                archetype: infantryArchetype(
                  wave,
                  this.infantryScheduled,
                  this.rosterProfile,
                ),
              }
            : {}),
      });
      if (tank) {
        this.tanksScheduled =
          this.tankScheduledWave === wave ? this.tanksScheduled + 1 : 1;
        this.tankScheduledWave = wave;
        this.lastTankAt = this.tick;
      }
      if (!tank) this.infantryScheduled++;
      this.spawnQueue--;
      this.lastSpawn = this.tick;
    }
  }
}
