import { useEffect, useRef, useState } from "react";
import { GAME_LOGO } from "./Briefing";
import type { MissionMode } from "../game/simulation";
import "./tutorial.css";

function LessonArt({ step, touch }: { step: number; touch: boolean }) {
  return (
    <svg viewBox="0 0 400 190" aria-hidden="true" focusable="false">
      <path
        d="M20 142 85 96 170 115 277 68 380 115 334 171 190 183 86 169Z"
        fill="#78825a"
      />
      <path
        d="m60 147 100-12 80-30 91 18"
        fill="none"
        stroke="#c4b78c"
        strokeWidth="14"
      />
      {step === 0 ? (
        <>
          <circle cx="280" cy="112" r="26" fill="#e6ddba" />
          <path d="m280 84-14 18h28Z" fill="#344b36" />
          <rect x="268" y="108" width="24" height="30" rx="5" fill="#43593d" />
          {touch ? (
            <>
              <circle
                cx="115"
                cy="85"
                r="46"
                fill="#e9dfbb"
                stroke="#394d35"
                strokeWidth="4"
              />
              <circle cx="130" cy="69" r="20" fill="#a64e2a" />
              <path
                d="m179 82 42 0m-10-10 10 10-10 10"
                stroke="#f4e9c2"
                strokeWidth="4"
                fill="none"
              />
            </>
          ) : (
            <g fill="#f5ebc8" stroke="#354a34" strokeWidth="3">
              {[
                ["W", 105, 20],
                ["A", 55, 72],
                ["S", 105, 72],
                ["D", 155, 72],
              ].map(([k, x, y]) => (
                <g key={k}>
                  <rect x={x} y={y} width="46" height="44" rx="7" />
                  <text
                    x={Number(x) + 23}
                    y={Number(y) + 29}
                    textAnchor="middle"
                    fill="#344b36"
                    stroke="none"
                    fontSize="22"
                    fontWeight="800"
                  >
                    {k}
                  </text>
                </g>
              ))}
            </g>
          )}
        </>
      ) : step === 1 ? (
        <>
          <rect x="75" y="94" width="45" height="55" rx="8" fill="#40573b" />
          <circle cx="98" cy="84" r="23" fill="#c7bc8e" />
          <path d="m115 106 66-22" stroke="#273b2c" strokeWidth="13" />
          <path d="m190 80 45-15m16-5 19-6" stroke="#f7cc63" strokeWidth="5" />
          <circle
            cx="305"
            cy="44"
            r="23"
            fill="none"
            stroke="#a44b28"
            strokeWidth="4"
          />
          <path
            d="M305 10v19m0 30v19m-35-34h20m30 0h20"
            stroke="#a44b28"
            strokeWidth="4"
          />
        </>
      ) : step === 2 ? (
        <>
          <path d="M118 60h105v77q-52 38-105 0Z" fill="#eee4bc" />
          <ellipse cx="170" cy="60" rx="52" ry="15" fill="#704628" />
          <path
            d="M223 80h23q34 25-23 40"
            fill="none"
            stroke="#eee4bc"
            strokeWidth="15"
          />
          <path
            d="m149 32-6-12m31 12 5-17m20 20-4-12"
            stroke="#eee4bc"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle cx="294" cy="119" r="26" fill="#edc260" />
          <text
            x="294"
            y="129"
            textAnchor="middle"
            fontSize="28"
            fontWeight="800"
            fill="#30452f"
          >
            C
          </text>
        </>
      ) : step === 3 ? (
        <>
          <path d="m160 135 68-96 100 105-100 29Z" fill="#c4b581" />
          <path d="m228 39 0 134 100-29Z" fill="#8d9164" />
          <path d="m206 158 22-55 23 54-23 16Z" fill="#344832" />
          <path
            d="m55 143 39-11 38 7 39-8"
            stroke="#f4d276"
            strokeWidth="4"
            strokeDasharray="7 7"
            fill="none"
          />
          <circle cx="77" cy="144" r="10" fill="#4cdbef" />
          <circle cx="275" cy="62" r="23" fill="#f3e7bd" />
          <text
            x="275"
            y="71"
            textAnchor="middle"
            fontSize="27"
            fontWeight="800"
            fill="#30452f"
          >
            T
          </text>
        </>
      ) : (
        <>
          <path
            d="m192 27 18 38 42 5-31 29 8 42-37-21-37 21 8-42-31-29 42-5Z"
            fill="#e7b952"
          />
          <path
            d="m78 100 16-23 17 23-17 29Z m213 12 16-23 17 23-17 29Z"
            fill="#55bbac"
          />
          <path
            d="M57 155h84m111 0h83"
            stroke="#e8dab4"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}
export function Tutorial({
  onPlay,
  onClose,
  mode,
}: {
  onPlay: () => void;
  onClose: () => void;
  mode: MissionMode;
}) {
  const [step, setStep] = useState(-1);
  const [touch, setTouch] = useState(
    () =>
      matchMedia("(pointer: coarse)").matches ||
      new URLSearchParams(location.search).has("touch"),
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const el = dialog.current!;
    el.showModal();
    return () => el.close();
  }, []);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  useEffect(() => {
    const media = matchMedia("(pointer: coarse)");
    const update = () =>
      setTouch(
        media.matches || new URLSearchParams(location.search).has("touch"),
      );
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const lessons = [
    {
      title: "Keep your boots moving.",
      control: touch ? "Left stick · Move" : "W A S D · Move",
      body: touch
        ? "Drag the left stick to move around the battlefield. Tap Dodge to escape danger."
        : "Use WASD to move. Press Space to dodge out of danger.",
      tip: "The camera follows you. The battlefield is bigger than the screen.",
    },
    {
      title: "Point. Shoot. Keep moving.",
      control: touch
        ? "Right stick · Aim / fire"
        : "Mouse · Aim    Left click · Shoot",
      body: touch
        ? "Hold and drag the right stick to aim and fire. You can move with the left stick at the same time."
        : "Aim with your mouse and hold the left mouse button to fire. You can shoot while moving.",
      tip: touch
        ? "Use Reload when needed. Auto-fire and auto-reload are available in the game controls."
        : "Press R to reload, or enable auto-reload. Auto-fire is an optional toggle too.",
    },
    {
      title: "First, a fresh cup.",
      control: touch ? "Hold Coffee · Fill" : "Hold E · Fill",
      body: touch
        ? "Walk up to the coffee kitchen, marked C on the map. Hold the Coffee button for a moment to fill your cup."
        : "Walk up to the coffee kitchen, marked C on the map. Hold E for a moment to fill your cup.",
      tip: "Running does not spill coffee. Getting hit or dodging can spill a little.",
    },
    {
      title: "The general is waiting.",
      control: touch ? "Hold Coffee · Deliver" : "Hold E · Deliver",
      body: "Follow the map: the blue dot is you, C is the kitchen, and T is the general’s tent. The dotted line points toward your coffee destination.",
      tip: touch
        ? "Get close to the tent and hold Coffee to deliver. Bring it warm. Deliveries restore health and earn points."
        : "Get close to the tent and hold E to deliver. Bring it warm. Deliveries restore health and earn points.",
    },
    {
      title: "Survive. Upgrade. Have fun.",
      control:
        mode === "mission" ? "8 minutes · 5 deliveries" : "Endless survival",
      body:
        mode === "mission"
          ? "Survive the eight-minute mission and make at least five coffee deliveries to win."
          : "Survive as long as you can. Keep delivering coffee for health and points.",
      tip: "Collect turquoise gems dropped by enemies. Level up and pick an upgrade. Every new run starts fresh.",
    },
  ];
  const lesson = lessons[Math.max(step, 0)];
  return (
    <dialog
      ref={dialog}
      className="tutorial-dialog"
      aria-labelledby="tutorial-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header className="tutorial-header">
        <img src={GAME_LOGO} alt="Coffee Under Fire" />
        <button onClick={onClose} aria-label="Back to briefing">
          ✕
        </button>
      </header>
      <span className="tutorial-eyebrow">
        {step < 0
          ? "Before your first sip"
          : `Field guide · ${step + 1} of ${lessons.length}`}
      </span>
      <h1 id="tutorial-title" ref={heading} tabIndex={-1}>
        {step < 0 ? "Fancy a quick field guide?" : lesson.title}
      </h1>
      {step < 0 ? (
        <>
          <LessonArt step={2} touch={touch} />
          <p>
            Learn to move, shoot, and deliver the coffee in five quick
            illustrated steps.
          </p>
          <p className="tutorial-tip">
            No enemies or mission timer start while you read.
          </p>
          <div className="tutorial-actions">
            <button className="primary" onClick={() => setStep(0)}>
              Yes, show me
            </button>
            <button onClick={onPlay}>No, skip and play</button>
          </div>
        </>
      ) : (
        <>
          <div
            className="tutorial-progress"
            aria-label={`Step ${step + 1} of ${lessons.length}`}
          >
            {lessons.map((l, i) => (
              <span key={l.title} className={i <= step ? "complete" : ""} />
            ))}
          </div>
          <LessonArt step={step} touch={touch} />
          <b className="tutorial-control">{lesson.control}</b>
          <p>{lesson.body}</p>
          <p className="tutorial-tip">{lesson.tip}</p>
          <div className="tutorial-actions">
            <button onClick={() => setStep(step - 1)}>Back</button>
            <button
              className="primary"
              onClick={() =>
                step === lessons.length - 1 ? onPlay() : setStep(step + 1)
              }
            >
              {step === lessons.length - 1 ? "Let’s play" : "Next"}
            </button>
          </div>
          <button className="tutorial-skip" onClick={onPlay}>
            Skip guide and play
          </button>
        </>
      )}
    </dialog>
  );
}
