import { useEffect, useRef } from "react";
import "./onboarding.css";

/** Which part of the interface a step points at; the stylesheet rings the matching controls. */
export type GuideFocus = "welcome" | "compare" | "numbers" | "events" | "look" | "proof";

interface GuideStep {
  focus: GuideFocus;
  title: string;
  body: (left: string, right: string) => string;
}

export const guideSteps: GuideStep[] = [
  {
    focus: "welcome",
    title: "Welcome to CHOWK",
    body: () =>
      "CHOWK is a traffic-signal controller trained for Indian streets, where vehicles share the road without lanes. This page runs it live in your browser, in simulation.",
  },
  {
    focus: "compare",
    title: "One street, two controllers",
    body: (left, right) =>
      `The same traffic runs twice. Left of the green line the signals use ${left}; right of it, ${right}. Drag the handle to move the line, or change either controller at the top.`,
  },
  {
    focus: "numbers",
    title: "Read the difference",
    body: () =>
      "Each card shows both sides, A and B, over the last five simulated minutes. Lower delay and fewer stops are better. Hover over or tap any card to open a larger graph with its formula and the live totals.",
  },
  {
    focus: "events",
    title: "Try to break it",
    body: () =>
      "Send a surge of traffic, block a lane or dispatch an ambulance. Both sides get the same disruption at the same moment, so you can watch how each controller copes.",
  },
  {
    focus: "look",
    title: "Look closer",
    body: () =>
      "J1 to J5 fly to a junction. How it decides walks through that junction's latest decision, number by number. Overlays show road pressure; click any vehicle to ride along.",
  },
  {
    focus: "proof",
    title: "Check the proof",
    body: () =>
      "Results holds the benchmark on traffic the controller never trained on, and your browser can re-run it to confirm the published numbers. Method and Limits say how it works and what it does not show.",
  },
];

const storageKey = "chowk-guide";

/** First-time visitors see the guide; automated browsers do not unless `?guide=on` asks for it. */
export function shouldOpenGuide(tour: boolean, capture: boolean) {
  const requested = new URLSearchParams(window.location.search).get("guide");
  if (requested === "on") return true;
  if (requested === "off" || !tour || capture || navigator.webdriver) return false;
  try {
    return window.localStorage.getItem(storageKey) !== "done";
  } catch {
    return true;
  }
}

export function rememberGuideSeen() {
  try {
    window.localStorage.setItem(storageKey, "done");
  } catch {
    // The guide simply reappears next visit when storage is unavailable.
  }
}

export function Onboarding({
  step,
  left,
  right,
  onStep,
  onClose,
  onResults,
}: {
  step: number;
  left: string;
  right: string;
  onStep: (step: number) => void;
  onClose: () => void;
  onResults: () => void;
}) {
  const current = guideSteps[step];
  const last = step === guideSteps.length - 1;
  const primary = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.documentElement.dataset.guide = current.focus;
    return () => {
      delete document.documentElement.dataset.guide;
    };
  }, [current.focus]);

  // Moving focus announces each step to screen readers; the first card must not steal it on load.
  useEffect(() => {
    if (step > 0) primary.current?.focus({ preventScroll: true });
  }, [step]);

  return (
    <section
      className="guide"
      data-step={current.focus}
      role="dialog"
      aria-label="Getting started"
      aria-describedby="guide-body"
    >
      <header>
        <span className="guide-count">
          {step === 0 ? "Start here" : `${step} of ${guideSteps.length - 1}`}
        </span>
        <button className="guide-skip" type="button" onClick={onClose}>
          {last ? "Close" : "Skip"}
        </button>
      </header>
      <h2>{current.title}</h2>
      <p id="guide-body">{current.body(left, right)}</p>
      <footer>
        <span className="guide-dots" aria-hidden="true">
          {guideSteps.map((entry, index) => (
            <i key={entry.focus} data-on={index === step} />
          ))}
        </span>
        <span className="guide-actions">
          {step > 0 && (
            <button className="control-button" type="button" onClick={() => onStep(step - 1)}>
              Back
            </button>
          )}
          {last && (
            <button className="control-button" type="button" onClick={onResults}>
              Open Results
            </button>
          )}
          <button
            ref={primary}
            className="control-button guide-next"
            type="button"
            onClick={() => (last ? onClose() : onStep(step + 1))}
          >
            {step === 0 ? "Show me around" : last ? "Done" : "Next"}
          </button>
        </span>
      </footer>
    </section>
  );
}
