import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Driver } from "../game/driver";
function Stick({
  label,
  onMove,
}: {
  label: string;
  onMove: (x: number, z: number, held: boolean) => void;
}) {
  const pointer = useRef<number | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== e.pointerId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) / (rect.width * 0.35);
    const y = (e.clientY - rect.top - rect.height / 2) / (rect.height * 0.35);
    const scale = Math.max(1, Math.hypot(x, y));
    setOffset({ x: (x / scale) * 28, y: (y / scale) * 28 });
    onMove(x / scale, y / scale, true);
  };
  const release = (e: PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== e.pointerId) return;
    pointer.current = null;
    setOffset({ x: 0, y: 0 });
    onMove(0, 0, false);
  };
  return (
    <div
      className="touch-stick"
      aria-label={label}
      onPointerDown={(e) => {
        if (pointer.current !== null) return;
        e.preventDefault();
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <span style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }} />
      <b>{label}</b>
    </div>
  );
}
export function TouchControls({ driver }: { driver: Driver }) {
  const [enabled, setEnabled] = useState(
    () =>
      matchMedia("(pointer: coarse)").matches ||
      new URLSearchParams(location.search).has("touch"),
  );
  useEffect(() => {
    const media = matchMedia("(pointer: coarse)");
    const update = () =>
      setEnabled(
        media.matches || new URLSearchParams(location.search).has("touch"),
      );
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (driver.sim.status !== "running") {
      driver.input.x = driver.input.z = 0;
      driver.input.fire =
        driver.input.interact =
        driver.input.dodge =
        driver.input.reload =
          false;
    }
  }, [driver, driver.sim.status]);
  if (!enabled || driver.sim.status !== "running") return null;
  const hold = (key: "interact" | "dodge" | "reload") => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      driver.input[key] = true;
    },
    onPointerUp: () => {
      driver.input[key] = false;
    },
    onPointerCancel: () => {
      driver.input[key] = false;
    },
    onLostPointerCapture: () => {
      driver.input[key] = false;
    },
  });
  return (
    <div className="touch-controls">
      <Stick
        label="Move"
        onMove={(x, z) => {
          driver.input.x = x;
          driver.input.z = z;
        }}
      />
      <div className="touch-actions">
        <button {...hold("interact")}>Hold · Coffee</button>
        <button {...hold("dodge")}>Dodge</button>
        <button {...hold("reload")}>Reload</button>
      </div>
      <Stick
        label="Aim / fire"
        onMove={(x, z, held) => {
          if (Math.hypot(x, z) > 0.1) driver.touchAim = { x, z };
          driver.input.fire = held;
        }}
      />
    </div>
  );
}
