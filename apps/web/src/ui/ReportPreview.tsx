import { useState } from "react";
import { MissionReport, type ReportData } from "./MissionReport";
// Explicit development-only presentation fixture. No simulation or Jev calls.
export function ReportPreview() {
  const [won, setWon] = useState(false);
  const [endless, setEndless] = useState(false);
  const data: ReportData = {
    won,
    missionMode: endless ? "endless" : "mission",
    reason: won
      ? "Outpost held. Coffee delivered."
      : "The coffee run ends here.",
    deliveries: won ? 8 : 3,
    kills: won ? 162 : 35,
    time: won ? 480 : 142,
    score: won ? 14720 : 6400,
    level: won ? 9 : 4,
  };
  return (
    <main className="report-preview">
      <MissionReport
        data={data}
        onRestart={() => {
          location.href = "/";
        }}
      />
      <div className="report-preview-controls">
        <span>Offline visual fixture · sample stats · export disabled</span>
        <button
          onClick={() => {
            setWon(!won);
            setEndless(false);
          }}
        >
          {won ? "Preview defeat" : "Preview victory"}
        </button>
        <button
          onClick={() => {
            setEndless(!endless);
            setWon(false);
          }}
        >
          Toggle endless
        </button>
      </div>
    </main>
  );
}
