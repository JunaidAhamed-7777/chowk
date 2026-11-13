import { DIRECTION_NAMES, layoutFor } from "@chowk/controllers/observation";
import { corridor, DT, type Metrics } from "@chowk/sim";
import { type CSSProperties, type RefObject, useEffect, useRef, useState } from "react";
import type { SimHost } from "../sim/SimHost";
import "./beatTheAI.css";

export const CHALLENGE_JUNCTION = 2;
export const ROUND_SECONDS = 180;
export type ChallengeStage = "off" | "intro" | "starting" | "playing" | "done";

const junction = corridor.junctions[CHALLENGE_JUNCTION];
const layout = layoutFor(corridor, CHALLENGE_JUNCTION);
// One arm per approach, clockwise from north; each arm is the phase that serves it.
const arms = DIRECTION_NAMES.flatMap((name, direction) => {
  const approach = layout.approaches[direction];
  if (approach < 0) return [];
  const road = corridor.links[junction.approaches[approach]];
  return [
    {
      name,
      direction,
      phase: layout.phaseAtDirection[direction],
      // Wider arms for roads with more strips, so the arterial reads as the main road.
      width: Math.min(40, Math.max(18, road.strips * 3)),
    },
  ];
});
const boxSize = Math.max(...arms.map(({ width }) => width));
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
  heading,
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
  /** The camera's compass bearing in radians; absent when the map is drawn north-up. */
  heading: RefObject<number> | undefined;
  onStart: () => void;
  onStage: (stage: ChallengeStage) => void;
  onExit: () => void;
}) {
  const round = useRef<Round | undefined>(undefined);
  const [requested, setRequested] = useState(-1);
  const signal = host.current?.streams[0].current?.signals;
  const currentPhase = signal?.[2 * CHALLENGE_JUNCTION] ?? -1;
  const signalState = signal?.[2 * CHALLENGE_JUNCTION + 1] ?? 2;
  const lampOf = (phase: number) =>
    phase !== currentPhase || signalState === 2 ? "red" : signalState === 0 ? "green" : "amber";
  const dial = useRef<HTMLDivElement>(null);
  const playing = stage === "starting" || stage === "playing";

  // The dial turns so that its top is the way the camera faces. It follows the camera every
  // animation frame without going through React, and only writes when the bearing moves.
  useEffect(() => {
    const element = dial.current;
    if (!playing || !element) return;
    if (!heading) {
      element.style.setProperty("--turn", "0deg");
      return;
    }
    let frame = 0;
    let shown = Number.NaN;
    const follow = () => {
      const bearing = heading.current;
      if (!(Math.abs(bearing - shown) < 0.003)) {
        shown = bearing;
        element.style.setProperty("--turn", `${((-bearing * 180) / Math.PI).toFixed(2)}deg`);
      }
      frame = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(frame);
  }, [playing, heading]);

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
            <div className="challenge-dial" ref={dial}>
              <svg className="challenge-roads" viewBox="-100 -100 200 200" aria-hidden="true">
                <g className="challenge-map">
                  {arms.map(({ name, direction, phase, width }) => {
                    const lamp = lampOf(phase);
                    return (
                      <g key={name} transform={`rotate(${direction * 90})`} data-lamp={lamp}>
                        <rect x={-width / 2} y={-100} width={width} height={100} />
                        <path className="challenge-centre" d={`M0 -96V${-boxSize / 2 - 4}`} />
                        <path className="challenge-flow" d={`M${width / 4 - 3.5} -66h7l-3.5 6Z`} />
                        <circle cx={width / 4} cy={-boxSize / 2 - 7} r="4.2" />
                      </g>
                    );
                  })}
                  <rect
                    className="challenge-box"
                    x={-boxSize / 2}
                    y={-boxSize / 2}
                    width={boxSize}
                    height={boxSize}
                    rx="3"
                  />
                </g>
              </svg>
              <span className="challenge-compass" aria-hidden="true">
                <svg viewBox="-10 -10 20 20" aria-hidden="true">
                  <path d="M0 -8 4 5 0 2.5-4 5Z" />
                </svg>
                N
              </span>
              {arms.map(({ name, direction, phase }) => (
                <button
                  key={name}
                  type="button"
                  className="challenge-arm"
                  style={{ "--arm": `${direction * 90}deg` } as CSSProperties}
                  data-lamp={lampOf(phase)}
                  aria-pressed={requested === phase}
                  aria-label={`${phase + 1}: ${name} approach`}
                  disabled={stage !== "playing"}
                  onClick={() => {
                    host.current?.setManual(0, CHALLENGE_JUNCTION, phase);
                    setRequested(phase);
                  }}
                >
                  {phase + 1}
                </button>
              ))}
            </div>
            <p className="challenge-dial-note">
              Up is the way the camera faces. The numbers match the markers over J
              {CHALLENGE_JUNCTION + 1}; click one or press its key.
            </p>
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
