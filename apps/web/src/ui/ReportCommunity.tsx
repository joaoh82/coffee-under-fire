import { shareMessage, cleanShareUrl } from "./share-result";
import { useEffect, useState } from "react";
import {
  nicknameSchema,
  type BoardEntry,
  type BoardOptions,
} from "../../../../packages/shared/leaderboard";
import "./report-community.css";
export function ReportCommunity({
  data,
  options,
  onSubmit,
}: {
  data: { score: number; time: number; deliveries: number };
  options: BoardOptions;
  onSubmit?: (name: string) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [entries, setEntries] = useState<BoardEntry[]>([]);
  const [boardError, setBoardError] = useState(false);
  const [version, setVersion] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const [alternatives, setAlternatives] = useState(false);
  const query = new URLSearchParams(options).toString();
  const url = cleanShareUrl(
    typeof location === "undefined" ? "" : location.origin,
  );
  const text = shareMessage(data);
  useEffect(() => {
    const controller = new AbortController();
    setBoardError(false);
    void fetch(`/api/leaderboard?${query}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw Error();
        const data = await r.json();
        if (!Array.isArray(data.entries)) throw Error();
        setEntries(data.entries);
      })
      .catch(() => {
        if (!controller.signal.aborted) setBoardError(true);
      });
    return () => controller.abort();
  }, [query, version]);
  useEffect(() => {
    if (!onSubmit || nameEdited) return;
    const controller = new AbortController();
    void fetch("/api/profile", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) return;
        const profile = await r.json();
        if (!controller.signal.aborted)
          setName(profile.displayName || profile.id || "");
      })
      .catch(() => {});
    return () => controller.abort();
  }, [Boolean(onSubmit), nameEdited]);
  async function share() {
    if (sharing) return;
    setShareStatus("");
    if (!navigator.share) {
      setAlternatives(true);
      return;
    }
    setSharing(true);
    try {
      await navigator.share({ title: "Coffee Under Fire", text, url });
      setShareStatus("Share sheet completed.");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setAlternatives(true);
        setShareStatus("Choose a sharing option below.");
      }
    } finally {
      setSharing(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setShareStatus("Result and game link copied.");
    } catch {
      setShareStatus("Copy the message below to share it.");
      setAlternatives(true);
    }
  }
  return (
    <div className="report-community">
      <section aria-label="Share your run" className="report-share">
        <button onClick={() => void share()} disabled={sharing}>
          Share your run ↗
        </button>
        <button onClick={() => void copy()}>Copy result & link</button>
        {alternatives && (
          <div className="share-options">
            <a
              href={`https://twitter.com/intent/tweet?${new URLSearchParams({ text, url })}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Share on X
            </a>
            <a
              href={`https://wa.me/?${new URLSearchParams({ text: `${text} ${url}` })}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp
            </a>
            <label>
              Share message
              <textarea
                readOnly
                value={`${text}\n${url}`}
                onFocus={(e) => e.currentTarget.select()}
              />
            </label>
          </div>
        )}
        <p role="status">{shareStatus}</p>
      </section>
      <section
        className="report-leaderboard"
        aria-labelledby="leaderboard-title"
      >
        <h2 id="leaderboard-title">Field honours</h2>
        <p>Your best score for this map, difficulty and mode.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy || saved || !onSubmit) return;
            const parsed = nicknameSchema.safeParse(name);
            if (!parsed.success) {
              setStatus("Choose a name of 1–40 visible characters.");
              return;
            }
            setBusy(true);
            setStatus("");
            try {
              await onSubmit(parsed.data);
              setSaved(true);
              setStatus(
                "Score submitted. The leaderboard shows your best eligible run.",
              );
              setVersion((v) => v + 1);
            } catch (err) {
              setStatus(
                err instanceof Error
                  ? err.message
                  : "Could not save your score.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label htmlFor="leaderboard-name">Public nickname</label>
          <div className="score-submit">
            <input
              id="leaderboard-name"
              maxLength={40}
              value={name}
              onChange={(e) => {
                setNameEdited(true);
                setName(e.target.value);
              }}
              placeholder="Coffee Captain"
              autoComplete="off"
              disabled={!onSubmit || saved || busy}
              required
            />
            <button disabled={!onSubmit || saved || busy}>
              {saved
                ? "Score submitted"
                : busy
                  ? "Submitting…"
                  : "Add my score"}
            </button>
          </div>
          <small>
            This name and score will be public. Use a nickname, not personal
            information. You can edit this name; submitting remembers it for
            your next run. No profanity or sexual content.
          </small>
          {!onSubmit && (
            <p>Leaderboard submissions are available after a live Jev run.</p>
          )}
          <p role="status">{status}</p>
        </form>
        {boardError ? (
          <p>
            Scores are temporarily unavailable.{" "}
            <button onClick={() => setVersion((v) => v + 1)}>Try again</button>
          </p>
        ) : (
          <ol className="score-list">
            {entries.slice(0, 5).map((entry, i) => (
              <li key={entry.id}>
                <span>
                  {i + 1}. {entry.name}
                </span>
                <strong>{entry.score.toLocaleString("en-US")}</strong>
              </li>
            ))}
          </ol>
        )}
        {!boardError && !entries.length && (
          <p>No scores yet. Set the first one!</p>
        )}
        <a
          href={`/leaderboard?${query}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View full leaderboard ↗
        </a>
        <small className="community-disclosure">
          Community scores are browser-reported, with basic session checks—not
          anti-cheat verified.
        </small>
      </section>
    </div>
  );
}
