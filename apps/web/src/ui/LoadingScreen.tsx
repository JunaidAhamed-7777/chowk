import { useEffect, useState } from "react";
import "./loadingScreen.css";

export interface LoadingStep {
  label: string;
  done: boolean;
}

const hints = [
  "Both sides of the divider receive exactly the same traffic.",
  "Drag the green divider to compare the two signal controllers.",
  "Surge, Block a lane and Ambulance disrupt both simulations at once.",
  "Results lets your own browser re-run the published benchmark.",
];
const exitMs = 450;
// Long enough to read the card on a fast machine, short enough not to feel like a delay.
const minimumMs = 1100;

/** The Live view's start-up sequence, shared by the route fallback and the view itself. */
export function liveLoadingSteps(scene: boolean, controllers: boolean, traffic: boolean) {
  return [
    { label: "Loading the 3D corridor", done: scene },
    { label: "Loading signal controllers", done: controllers },
    { label: "Warming up traffic in both simulations", done: traffic },
  ];
}

/**
 * Covers the scene until the simulations are ready, then fades out.
 * Steps report real start-up state; nothing here is a timed animation of progress.
 */
export function LoadingScreen({ steps, done }: { steps: LoadingStep[]; done: boolean }) {
  const [gone, setGone] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [hint, setHint] = useState(0);
  const [shownAt] = useState(() => performance.now());

  useEffect(() => {
    if (!done) {
      setGone(false);
      setLeaving(false);
      return;
    }
    const wait = Math.max(0, minimumMs - (performance.now() - shownAt));
    const leave = window.setTimeout(() => setLeaving(true), wait);
    const remove = window.setTimeout(() => setGone(true), wait + exitMs);
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(remove);
    };
  }, [done, shownAt]);

  useEffect(() => {
    if (done) return;
    const timer = window.setInterval(() => setHint((value) => (value + 1) % hints.length), 3600);
    return () => window.clearInterval(timer);
  }, [done]);

  if (gone) return null;
  const current = steps.findIndex((step) => !step.done);

  return (
    <div
      className="loading-screen"
      data-done={leaving}
      role="status"
      aria-label="Loading the corridor"
      aria-hidden={leaving}
    >
      <div className="loading-card">
        <span className="loading-mark" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
        <p className="loading-title">
          CHOWK<span>.</span>
        </p>
        <p className="loading-subtitle">Traffic signals for lane-free streets</p>
        <ol className="loading-steps">
          {steps.map((step, index) => (
            <li
              key={step.label}
              data-state={step.done ? "done" : index === current ? "active" : "waiting"}
            >
              <i aria-hidden="true" />
              {step.label}
            </li>
          ))}
        </ol>
        <div className="loading-bar" aria-hidden="true">
          <span />
        </div>
        <p className="loading-hint" key={hint}>
          {hints[hint]}
        </p>
      </div>
    </div>
  );
}
