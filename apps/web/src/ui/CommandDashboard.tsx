import { useState } from "react";
import type { Candidate } from "../../../../packages/shared/contracts";
import type { Driver, TraceRow } from "../game/driver";
function actionLabel(c: Candidate | undefined, id = "Waiting") {
  if (!c) return id.replaceAll("_", " ");
  if (c.kind === "move")
    return `${c.purpose === "approach" ? "Advance" : c.purpose === "investigate" ? "Investigate" : "Reposition"} → ${c.destination.x.toFixed(0)}, ${c.destination.z.toFixed(0)}`;
  if (c.kind === "cannon")
    return `Cannon → ${c.aimPoint.x.toFixed(1)}, ${c.aimPoint.z.toFixed(1)} (locked aim)`;
  if (c.kind === "fire") return "Fire at player";
  if (c.kind === "reaction") return `General: ${c.reaction}`;
  return c.kind === "reload" ? "Reload" : "Hold position";
}
export function CommandDashboard({
  driver,
  onClose,
  onExport,
}: {
  driver: Driver;
  onClose: () => void;
  onExport: () => void;
}) {
  const [frozen, setFrozen] = useState<TraceRow | null>(null);
  const npc =
    driver.sim.npcs.find((n) => n.id === driver.inspectedNpcId) ??
    driver.sim.npcs.find((n) => n.role === "rifleman") ??
    driver.sim.npcs[0];
  const latest = [...driver.traces]
    .reverse()
    .find((r) => r.request.observation.npc === npc?.id && r.decision);
  const row = frozen ?? latest;
  const observation = row?.request.observation;
  const decisions = driver.traces.filter((r) => r.decision?.source === "jev");
  const times = decisions
    .map((r) => r.decision!.latencyMs)
    .sort((a, b) => a - b);
  const median = times.length
    ? Math.round(times[Math.floor((times.length - 1) * 0.5)])
    : null;
  const p95 = times.length
    ? Math.round(times[Math.ceil((times.length - 1) * 0.95)])
    : null;
  const source = row?.decision?.source;
  const chosen = row?.request.candidates.find(
    (c) => c.id === row.decision?.selected,
  );
  return (
    <aside className="command-panel" aria-label="Jev command dashboard">
      <header className="command-heading">
        <div>
          <span className="command-eyebrow">Coffee Under Fire</span>
          <h2>Inside the decisions</h2>
        </div>
        <button aria-label="Close Jev dashboard" onClick={onClose}>
          ×
        </button>
      </header>
      <div
        className={`source-strip ${driver.sim.mode === "mock" ? "mock" : ""}`}
      >
        <span className="status-dot" />
        {driver.sim.mode === "strict"
          ? "Jev · live mode"
          : `${driver.sim.mode} · development`}
        <span>{driver.sim.status}</span>
      </div>
      <p className="command-intro">
        Jev chooses the tactic. The game executes movement and combat. Select an
        NPC to view its decisions. This does not control the NPC.
      </p>
      <div className="command-metrics">
        <div>
          <b>{driver.totals.applied}</b>
          <span>Applied choices</span>
        </div>
        <div>
          <b>
            {median ?? "N/A"}
            <small> ms</small>
          </b>
          <span>Jev median</span>
        </div>
        <div>
          <b>
            {p95 ?? "N/A"}
            <small> ms</small>
          </b>
          <span>Jev p95</span>
        </div>
      </div>
      <div className="command-meta">
        {driver.pending.size} in flight · {driver.totals.rejected} rejected ·{" "}
        {driver.totals.errors} errors
        <br />
        {driver.totals.inputTokens.toLocaleString()} reported input tokens ·
        latency over recent {times.length} Jev responses
      </div>
      <label className="soldier-select">
        Inspect NPC
        <select
          value={npc?.id ?? ""}
          onChange={(e) => {
            driver.inspectedNpcId = e.target.value;
            setFrozen(null);
          }}
        >
          {driver.sim.npcs.map((n) => (
            <option key={n.id} value={n.id}>
              {n.id.replaceAll("_", " ")} · {n.role}
            </option>
          ))}
        </select>
      </label>
      <div className="current-action">
        <span>Executing now</span>
        <strong>
          {npc?.action ? actionLabel(npc.action) : "Awaiting a legal choice"}
        </strong>
        <small>
          {npc?.action
            ? `${Math.max(0, (npc.actionUntil - driver.sim.tick) / 60).toFixed(1)}s remaining`
            : "Strict mode never substitutes a tactic"}
        </small>
      </div>
      <section className="decision-card">
        <div className="card-heading">
          <h3>{frozen ? "Pinned decision" : "Latest decision"}</h3>
          {frozen ? (
            <button onClick={() => setFrozen(null)}>Follow live</button>
          ) : (
            <button
              disabled={!row}
              onClick={() => row && setFrozen(structuredClone(row))}
            >
              Pin to explain
            </button>
          )}
        </div>
        {row?.decision ? (
          <>
            <div className="decision-result">
              <strong>{actionLabel(chosen, row.decision.selected)}</strong>
              <span className={`decision-source ${source}`}>{source}</span>
            </div>
            <p className="decision-facts">
              #{row.request.sequence} · {row.status} ·{" "}
              {Math.round(row.decision.latencyMs)} ms
              <br />
              {row.decision.model} / {row.decision.config}
            </p>
            <div className="confidence">
              Confidence <b>{Math.round(row.decision.confidence * 100)}%</b>
            </div>
            <h4>What this soldier knew</h4>
            <ul className="observations">
              <li>
                Health {observation?.hp} · Ammo {observation?.ammo}/12
              </li>
              <li>
                {observation?.visible.length
                  ? "Player visible"
                  : "Player not visible"}
              </li>
              <li>
                {observation?.lastSeen
                  ? `Last seen ${observation.lastSeen.age.toFixed(1)}s ago`
                  : "No recent sighting"}
              </li>
              <li>
                {observation?.audible
                  ? `${observation.audible.kind} heard ${observation.audible.age.toFixed(1)}s ago (approximate position)`
                  : "No recent sound"}
              </li>
            </ul>
            <h4>Legal options sent to Jev</h4>
            <div className="choice-options">
              {row.request.candidates.map((c) => {
                const probability = row.decision?.probabilities?.[c.id];
                return (
                  <div
                    className={`choice ${c.id === row.decision?.selected ? "selected" : ""}`}
                    key={c.id}
                  >
                    <div>
                      <span>{actionLabel(c)}</span>
                      <b>
                        {probability === undefined
                          ? "N/A"
                          : `${Math.round(probability * 100)}%`}
                      </b>
                    </div>
                    <div className="choice-track">
                      <span style={{ width: `${(probability ?? 0) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="source-note">
              Probabilities and confidence are provider outputs, not damage
              modifiers. Jev does not return a written explanation for this
              Choice.
            </p>
            <details>
              <summary>Inspect observation and response</summary>
              <pre>
                {JSON.stringify(
                  {
                    observation,
                    candidates: row.request.candidates,
                    decision: { ...row.decision, session: undefined },
                  },
                  null,
                  2,
                )}
              </pre>
            </details>
          </>
        ) : (
          <p className="empty-state">
            {row
              ? `${row.status}: ${row.reason ?? "Awaiting a provider result"}`
              : driver.sim.status === "ready"
                ? "Start a mission to see real decisions arrive. No sample results are displayed here."
                : "No completed decision for this soldier yet. See recent activity for pending requests and errors."}
          </p>
        )}
      </section>
      <section className="decision-feed">
        <div className="card-heading">
          <h3>Recent activity</h3>
          <button onClick={onExport}>Export replay</button>
        </div>
        {driver.traces
          .slice(-12)
          .reverse()
          .map((r) => (
            <button
              key={r.id}
              className={`feed-row ${r.status}`}
              onClick={() => {
                driver.inspectedNpcId = r.request.observation.npc;
                setFrozen(structuredClone(r));
              }}
            >
              <span>
                {r.request.observation.npc.replaceAll("_", " ")}{" "}
                <small>#{r.request.sequence}</small>
              </span>
              <strong>
                {r.decision
                  ? actionLabel(
                      r.request.candidates.find(
                        (c) => c.id === r.decision?.selected,
                      ),
                    )
                  : r.status}
              </strong>
              <small>
                {r.status}
                {r.reason ? ` · ${r.reason}` : ""}
              </small>
            </button>
          ))}
      </section>
    </aside>
  );
}
