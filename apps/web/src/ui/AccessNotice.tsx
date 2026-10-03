import { SupportCallout } from "./SupportCallout";
export function AccessNotice({
  block,
  score,
  onLeave,
  onSave,
}: {
  block: { code: string; message: string };
  score: number;
  onLeave: () => void;
  onSave: () => void;
}) {
  return (
    <div
      className="overlay"
      style={{ zIndex: 1000 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="access-title"
    >
      <section className="brief compact">
        <h1 id="access-title">A break between coffee runs.</h1>
        <p>{block.message}</p>
        <p>
          Your battlefield is paused. Score: <strong>{score}</strong>.
        </p>
        <button onClick={onLeave} autoFocus>
          Return to briefing
        </button>
        <button onClick={onSave}>Save decision replay</button>
        <SupportCallout />
      </section>
    </div>
  );
}
