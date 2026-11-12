import { corridor, DT, type Metrics } from "@chowk/sim";
import { type RefObject, useEffect, useRef, useState } from "react";
import { approachDirections } from "../sim/decisionMath";
import type { SimHost } from "../sim/SimHost";
import "./beatTheAI.css";

export const CHALLENGE_JUNCTION = 2;
export const ROUND_SECONDS = 180;
export type ChallengeStage = "off" | "intro" | "starting" | "playing" | "done";

const junction = corridor.junctions[CHALLENGE_JUNCTION];
const directions = approachDirections(corridor, CHALLENGE_JUNCTION);
const phaseNames = junction.phases.map(
  ({ approaches }) => directions[junction.approaches.indexOf(approaches[0])],
);
const hours = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

interface Round {
  startTick: number;
  start: [number, number];
}

function personHours(now: Metrics, start: number) {
  return (now.personDelay - start) / 3_600;
}

export function BeatTheAI({
  host,
  stage,
  ready,
  tick,
  metrics,
  rivalLabel,
  onStart,
  onStage,
  onExit,
}: {
  host: RefObject<SimHost | null>;
  stage: ChallengeStage;
  ready: boolean;
  tick: number | undefined;
  metrics: readonly [Metrics, Metrics] | undefined;
  rivalLabel: string;
  onStart: () => void;
  onStage: (stage: ChallengeStage) => void;
  onExit: () => void;
}) {
  const round = useRef<Round | undefined>(undefined);
  const [requested, setRequested] = useState(-1);
  const signal = host.current?.streams[0].current?.signals;
  const greenPhase =
    signal?.[2 * CHALLENGE_JUNCTION + 1] === 0 ? signal[2 * CHALLENGE_JUNCTION] : -1;

  useEffect(() => {
    if (stage !== "starting" || !ready || tick === undefined || !metrics) return;
    const current = host.current?.streams[0].current?.signals[2 * CHALLENGE_JUNCTION] ?? 0;
    round.current = { startTick: tick, start: [metrics[0].personDelay, metrics[1].personDelay] };
    // The visitor holds the junction from the first second; nothing changes until they ask.
    host.current?.setManual(0, CHALLENGE_JUNCTION, current);
    setRequested(current);
    onStage("playing");
  }, [stage, ready, tick, metrics, host, onStage]);

  useEffect(() => {
    if (stage !== "playing" || tick === undefined || !round.current) return;
    if ((tick - round.current.startTick) * DT >= ROUND_SECONDS) onStage("done");
  }, [stage, tick, onStage]);

  useEffect(() => {
    if (stage !== "playing") return;
    const press = (event: KeyboardEvent) => {
      const index = Number(event.key) - 1;
      if (!Number.isInteger(index) || !junction.phases[index]) return;
      event.preventDefault();
      host.current?.setManual(0, CHALLENGE_JUNCTION, index);
      setRequested(index);
    };
    window.addEventListener("keydown", press);
    return () => window.removeEventListener("keydown", press);
  }, [stage, host]);

  useEffect(() => {
    if (stage === "off" || stage === "intro") host.current?.setManual(0, -1, -1);
  }, [stage, host]);

  if (stage === "off") return null;
  const active = round.current && metrics && tick !== undefined;
  const yours = active ? personHours(metrics[0], round.current?.start[0] ?? 0) : 0;
  const theirs = active ? personHours(metrics[1], round.current?.start[1] ?? 0) : 0;
  const elapsed = active ? (tick - (round.current?.startTick ?? tick)) * DT : 0;
  const remaining = Math.max(0, ROUND_SECONDS - elapsed);

  return (
    <section className="challenge-panel" aria-label="Beat the AI">
      <header className="challenge-header">
        <h2>Beat the AI</h2>
        <button type="button" className="challenge-close" onClick={onExit}>
          <span aria-hidden="true">×</span>
          <span className="sr-only">Leave Beat the AI</span>
        </button>
      </header>
      {stage === "intro" && (
        <>
          <p>
            You run junction J{CHALLENGE_JUNCTION + 1} on the left. {rivalLabel} runs it on the
            right. Every other junction uses {rivalLabel} on both sides, and both sides get the same
            traffic.
          </p>
          <p>
            Choose which approach gets green. Minimum green, yellow and all-red still apply. After{" "}
            {ROUND_SECONDS / 60} simulated minutes, the side with fewer person-hours of delay wins.
          </p>
          <button type="button" className="control-button challenge-start" onClick={onStart}>
            Start round
          </button>
        </>
      )}
      {(stage === "starting" || stage === "playing") && (
        <>
          <fieldset className="challenge-phases" aria-label="Give green to">
            {phaseNames.map((name, phase) => (
              <button
                key={name}
                type="button"
                className="challenge-phase"
                data-green={greenPhase === phase}
                aria-pressed={requested === phase}
                disabled={stage !== "playing"}
                onClick={() => {
                  host.current?.setManual(0, CHALLENGE_JUNCTION, phase);
                  setRequested(phase);
                }}
              >
                <kbd>{phase + 1}</kbd> {name}
              </button>
            ))}
          </fieldset>
          <dl className="challenge-score">
            <div>
              <dt>You</dt>
              <dd>{hours.format(yours)}</dd>
            </div>
            <div>
              <dt>{rivalLabel}</dt>
              <dd>{hours.format(theirs)}</dd>
            </div>
            <div>
              <dt>Time left</dt>
              <dd>
                {Math.floor(remaining / 60)}:{String(Math.floor(remaining % 60)).padStart(2, "0")}
              </dd>
            </div>
          </dl>
          <p className="challenge-note">Person-hours of delay since the round began.</p>
        </>
      )}
      {stage === "done" && (
        <>
          <p className="challenge-verdict">
            {yours < theirs
              ? `You beat ${rivalLabel} by ${hours.format(theirs - yours)} person-hours.`
              : yours > theirs
                ? `${rivalLabel} beat you by ${hours.format(yours - theirs)} person-hours.`
                : "A draw."}
          </p>
          <dl className="challenge-score">
            <div>
              <dt>You</dt>
              <dd>{hours.format(yours)}</dd>
            </div>
            <div>
              <dt>{rivalLabel}</dt>
              <dd>{hours.format(theirs)}</dd>
            </div>
          </dl>
          <p className="challenge-note">
            One round on one seed is a game, not a benchmark. The published comparison is on the
            Results page.
          </p>
          <button type="button" className="control-button challenge-start" onClick={onStart}>
            Play again
          </button>
        </>
      )}
    </section>
  );
}
