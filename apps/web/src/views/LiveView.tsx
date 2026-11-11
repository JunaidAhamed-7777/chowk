import { corridor, type Metrics } from "@chowk/sim";
import type { ReactNode } from "react";
import { Component, useEffect, useState } from "react";
import { NightCorridor } from "../scene/NightCorridor";
import type { CameraSelection, PlaybackSpeed, Quality } from "../scene/sceneSettings";
import { playingSpeeds, qualityPresets } from "../scene/sceneSettings";
import { liveSeed } from "../sim/liveScenario";
import type { ControllerChoice } from "../sim/protocol";
import type { ControllerPair, MetricsPair } from "../sim/SimHost";
import { useSimHost } from "../sim/useSimHost";
import { ComparisonWipe } from "../ui/ComparisonWipe";
import { Icon } from "../ui/Icon";

const stations = corridor.junctions.map((junction, index) => ({
  id: junction.id,
  name: `J${index + 1}`,
}));

interface LiveViewProps {
  active: boolean;
  quality: Quality;
  automatic: boolean;
  onQuality: (quality: Quality) => void;
}

class SceneBoundary extends Component<
  { children: ReactNode; onRetry: () => void },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? (
      <div className="scene-message" role="status">
        <h2>3D view interrupted</h2>
        <p>Try reloading the scene to reconnect to your graphics device.</p>
        <button className="control-button" type="button" onClick={this.props.onRetry}>
          <Icon name="reset" />
          Reload scene
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}

function readReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function formatTime(seconds: number) {
  const time = Math.floor(seconds);
  return `${Math.floor(time / 60)
    .toString()
    .padStart(2, "0")}:${(time % 60).toString().padStart(2, "0")}`;
}

const formatCount = new Intl.NumberFormat("en-IN");
const oneDecimal = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const choices = [
  { value: "fixed", label: "Fixed cycle" },
  { value: "pressure", label: "Area pressure" },
] as const;

/** Cumulative measurements since the run started, taken from the simulator's own counters. */
function readings(metrics: Metrics) {
  const hours = metrics.elapsed / 3600;
  return [
    {
      label: "Delay per person",
      value: metrics.generatedPeople > 0 ? metrics.personDelay / metrics.generatedPeople : 0,
      unit: "s",
      format: oneDecimal,
    },
    {
      label: "Stops per vehicle",
      value: metrics.generated > 0 ? metrics.stops / metrics.generated : 0,
      unit: "",
      format: oneDecimal,
    },
    {
      label: "People delivered",
      value: hours > 0 ? metrics.completedPeople / hours : 0,
      unit: "/h",
      format: formatCount,
    },
    {
      label: "CO\u2082 estimate",
      value: hours > 0 ? metrics.co2Kg / hours : 0,
      unit: "kg/h",
      format: formatCount,
    },
  ];
}

export default function LiveView({ active, quality, automatic, onQuality }: LiveViewProps) {
  const [camera, setCamera] = useState<CameraSelection>("aerial");
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [paused, setPaused] = useState(readReducedMotion);
  const [reducedMotion, setReducedMotion] = useState(readReducedMotion);
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const [frame, setFrame] = useState<{ metrics: MetricsPair; tick: number }>();
  const [failure, setFailure] = useState("");
  const [controllers, setControllers] = useState<ControllerPair>(["fixed", "pressure"]);
  const [wipe, setWipe] = useState(50);
  const [singleView, setSingleView] = useState(false);
  const [webglAvailable] = useState(() => {
    try {
      const context = document.createElement("canvas").getContext("webgl2");
      context?.getExtension("WEBGL_lose_context")?.loseContext();
      return Boolean(context);
    } catch {
      return false;
    }
  });
  const host = useSimHost({
    active,
    paused,
    speed,
    seed: liveSeed,
    maxVehicles: qualityPresets.high.vehicleLimit,
    revision,
    controllers,
    pressure: false,
    onReady: setReady,
    onMetrics: (metrics, tick) => setFrame({ metrics, tick }),
    onError: setFailure,
  });

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => {
      setReducedMotion(media.matches);
      if (media.matches) setPaused(true);
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);

  useEffect(() => {
    if (!active || !ready || singleView) return;
    const onKey = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("input, select, textarea, [contenteditable]")
      )
        return;
      if (event.key === "[") setWipe((current) => Math.max(0, current - 3));
      else if (event.key === "]") setWipe((current) => Math.min(100, current + 3));
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, ready, singleView]);

  function reload() {
    setReady(false);
    setFrame(undefined);
    setFailure("");
    setRevision((value) => value + 1);
  }

  const cameraLabel =
    camera === "aerial"
      ? "Aerial view"
      : `Junction ${stations.find((station) => station.id === camera)?.name}`;
  const metrics = frame?.metrics[1];

  return (
    <div className="live-view">
      <div className="live-intro">
        <div>
          <p className="section-label">
            <span className="section-tick" /> Urban traffic simulation
          </p>
          <h1 id="live-heading" tabIndex={-1}>
            The corridor after dark<span>.</span>
          </h1>
        </div>
        <p className="live-deck">
          A modelled Indian arterial with buses, autos and two-wheelers sharing road space.
        </p>
      </div>

      <section className="instrument" aria-label="Live corridor simulation" data-tick={frame?.tick}>
        <div className="instrument-bar">
          <div className="instrument-id">
            <Icon name="camera" size={17} />
            <span>East–west corridor</span>
          </div>
          <div className="simulation-status" data-ready={ready}>
            <span /> Live comparison
          </div>
        </div>

        <div className="scene-stage">
          {webglAvailable ? (
            <SceneBoundary key={revision} onRetry={reload}>
              <NightCorridor
                active={active}
                automatic={automatic}
                camera={camera}
                onQuality={onQuality}
                host={host}
                wipe={wipe}
                singleView={singleView}
                ready={ready}
                paused={paused}
                quality={quality}
                reducedMotion={reducedMotion}
                speed={speed}
              />
              {!ready && !failure && (
                <div
                  className="scene-load-line"
                  role="status"
                  aria-label="Loading the 3D corridor"
                />
              )}
            </SceneBoundary>
          ) : (
            <div className="scene-message" role="status">
              <h2>3D view unavailable</h2>
              <p>This browser needs WebGL 2 to display the corridor.</p>
            </div>
          )}
          {failure && (
            <div className="scene-message" role="alert">
              <h2>Simulation interrupted</h2>
              <p>{failure}</p>
              <button className="control-button" type="button" onClick={reload}>
                Restart simulation
              </button>
            </div>
          )}
          {ready && webglAvailable && (
            <>
              {!singleView && <ComparisonWipe position={wipe} onChange={setWipe} />}
              <div className="comparison-labels">
                {!singleView && (
                  <label className="controller-chip">
                    <span className="controller-side">Left</span>
                    <select
                      aria-label="Left controller"
                      value={controllers[0]}
                      onChange={(event) =>
                        setControllers([event.target.value as ControllerChoice, controllers[1]])
                      }
                    >
                      {choices.map(({ value, label }) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="controller-chip controller-chip-right">
                  <span className="controller-side">{singleView ? "View" : "Right"}</span>
                  <select
                    aria-label="Right controller"
                    value={controllers[1]}
                    onChange={(event) =>
                      setControllers([controllers[0], event.target.value as ControllerChoice])
                    }
                  >
                    {choices.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          )}
          {metrics && ready && webglAvailable && (
            <dl className="hud" aria-label="Measurements since the run started">
              {readings(metrics).map(({ label, value, unit, format }) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>
                    {format.format(format === oneDecimal ? value : Math.round(value))}
                    {unit && <small>{unit}</small>}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {ready && webglAvailable && (
            <div className="scene-caption">
              <span className="scene-caption-line" />
              <span>
                <strong>{cameraLabel}</strong>
                <small>Authored network</small>
              </span>
            </div>
          )}
        </div>

        <div className="instrument-controls">
          <div className="playback-controls">
            <button
              className="control-button play-button"
              type="button"
              disabled={!ready || !webglAvailable}
              onClick={() => setPaused(!paused)}
              aria-label={paused ? "Play simulation" : "Pause simulation"}
              title={paused ? "Play simulation" : "Pause simulation"}
            >
              <Icon name={paused ? "play" : "pause"} size={19} />
            </button>
            <fieldset className="speed-picker" aria-label="Playback speed">
              {playingSpeeds.map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={!ready || !webglAvailable}
                  aria-label={`${value} times speed`}
                  aria-pressed={speed === value}
                  onClick={() => setSpeed(value)}
                >
                  {value}×
                </button>
              ))}
            </fieldset>
          </div>

          <fieldset className="junction-picker" aria-label="Fly to junction">
            {stations.map((station) => (
              <button
                key={station.id}
                type="button"
                className="station"
                disabled={!ready || !webglAvailable}
                aria-label={`Fly to junction ${station.name}`}
                aria-pressed={camera === station.id}
                onClick={() => setCamera(station.id)}
              >
                <i />
                <span>{station.name}</span>
              </button>
            ))}
          </fieldset>

          <div className="view-buttons">
            <button
              className="control-button"
              type="button"
              disabled={!ready || !webglAvailable}
              aria-pressed={singleView}
              onClick={() => setSingleView(!singleView)}
            >
              Single view
            </button>
            <button
              className="control-button aerial-button"
              type="button"
              disabled={!ready || !webglAvailable}
              aria-pressed={camera === "aerial"}
              onClick={() => setCamera("aerial")}
            >
              <Icon name="camera" />
              Aerial view
            </button>
          </div>
        </div>
      </section>

      <footer className="live-footer">
        <p>
          <span>Simulation result</span> · Uncalibrated demand
        </p>
        {metrics && ready && webglAvailable && (
          <dl className="live-readouts">
            <div>
              <dt>Simulated time</dt>
              <dd>{formatTime(metrics.elapsed)}</dd>
            </div>
            <div>
              <dt>Vehicles on road</dt>
              <dd>{formatCount.format(metrics.inNetwork)}</dd>
            </div>
          </dl>
        )}
        {ready && webglAvailable && <p>Drag to orbit · Scroll to zoom</p>}
      </footer>
    </div>
  );
}
