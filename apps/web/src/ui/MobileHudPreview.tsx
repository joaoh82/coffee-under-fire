import { useState } from "react";
import { Driver } from "../game/driver";
import App from "../App";
// Presentation fixture only: no simulation loop, provider requests, or real session.
export function MobileHudPreview() {
  const [driver] = useState(() => {
    const d = new Driver(async (input) => {
      if (
        String(input) === "/api/invalidate" ||
        String(input) === "/api/session"
      )
        return new Response(null, { status: 204 });
      throw new Error("Network disabled in presentation fixture");
    });
    d.sim.start("mock", "offline-mobile-layout-fixture");
    d.sim.player.hp = 72;
    d.sim.player.ammo = 8;
    d.sim.tick = 300;
    if (new URLSearchParams(location.search).has("paused")) d.pause();
    return d;
  });
  if (new URLSearchParams(location.search).has("frame"))
    return <App layoutDriver={driver} />;
  return (
    <div
      style={{
        display: "flex",
        gap: 20,
        padding: 12,
        flexWrap: "wrap",
        background: "#243126",
        minHeight: "100vh",
      }}
    >
      {[
        [320, 568],
        [390, 640],
        [430, 740],
        [568, 320],
        [667, 375],
        [844, 390],
      ].map(([width, height]) => (
        <iframe
          key={`${width}x${height}`}
          title={`Phone HUD ${width} by ${height}`}
          src={`/mobile-preview?frame&touch${new URLSearchParams(location.search).has("paused") ? "&paused" : ""}`}
          style={{ width, height, border: "2px solid #cabc93", flexShrink: 0 }}
        />
      ))}
    </div>
  );
}
