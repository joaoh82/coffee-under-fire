import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Driver } from "../game/driver";
// Measures the renderer's frame cadence, independently of the fixed 60 Hz simulation.
export function FrameCounter({ driver }: { driver: Driver }) {
  const sample = useRef({ previous: 0, elapsed: 0, frames: 0 });
  useEffect(() => {
    const reset = () => {
      sample.current = { previous: 0, elapsed: 0, frames: 0 };
      driver.renderStats = null;
    };
    document.addEventListener("visibilitychange", reset);
    return () => {
      document.removeEventListener("visibilitychange", reset);
      reset();
    };
  }, [driver]);
  useFrame(() => {
    if (document.hidden) return;
    const now = performance.now();
    const window = sample.current;
    if (window.previous) {
      window.elapsed += now - window.previous;
      window.frames++;
    }
    window.previous = now;
    if (window.elapsed >= 500) {
      driver.renderStats = {
        fps: Math.round((window.frames * 1000) / window.elapsed),
        frameMs: window.elapsed / window.frames,
      };
      window.elapsed = 0;
      window.frames = 0;
    }
  });
  return null;
}
