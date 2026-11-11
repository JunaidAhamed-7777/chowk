import { corridor } from "@chowk/sim";
import type { ReactNode } from "react";
import { Component, useEffect, useState } from "react";
import { NightCorridor } from "../scene/NightCorridor";
import type { CameraSelection, PlaybackSpeed, Quality } from "../scene/sceneSettings";
import { playingSpeeds } from "../scene/sceneSettings";
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

export default function LiveView({ active, quality, automatic, onQuality }: LiveViewProps) {
  const [camera, setCamera] = useState<CameraSelection>("aerial");
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [paused, setPaused] = useState(readReducedMotion);
  const [reducedMotion, setReducedMotion] = useState(readReducedMotion);
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const [webglAvailable] = useState(() => {
    try {
      const context = document.createElement("canvas").getContext("webgl2");
      context?.getExtension("WEBGL_lose_context")?.loseContext();
      return Boolean(context);
    } catch {
      return false;
    }
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

  function reload() {
    setReady(false);
    setRevision((value) => value + 1);
  }

  const cameraLabel =
    camera === "aerial"
      ? "Aerial view"
      : `Junction ${stations.find((station) => station.id === camera)?.name}`;

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

      <section className="instrument" aria-label="Interactive corridor preview">
        <div className="instrument-bar">
          <div className="instrument-id">
            <Icon name="camera" size={17} />
            <span>East–west corridor</span>
          </div>
          <div className="preview-status" aria-live="polite">
            <span /> Scene preview
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
                onReady={setReady}
                paused={paused}
                quality={quality}
                reducedMotion={reducedMotion}
                speed={speed}
              />
              {!ready && (
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
          {ready && (
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
              disabled={!ready}
              onClick={() => setPaused(!paused)}
              aria-label={paused ? "Play preview" : "Pause preview"}
              title={paused ? "Play preview" : "Pause preview"}
            >
              <Icon name={paused ? "play" : "pause"} size={19} />
            </button>
            <fieldset className="speed-picker" aria-label="Playback speed">
              {playingSpeeds.map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={!ready}
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
                disabled={!ready}
                aria-label={`Fly to junction ${station.name}`}
                aria-pressed={camera === station.id}
                onClick={() => setCamera(station.id)}
              >
                <i />
                <span>{station.name}</span>
              </button>
            ))}
          </fieldset>

          <button
            className="control-button aerial-button"
            type="button"
            disabled={!ready}
            aria-pressed={camera === "aerial"}
            onClick={() => setCamera("aerial")}
          >
            <Icon name="camera" />
            Aerial view
          </button>
        </div>
      </section>

      <footer className="live-footer">
        <p>Scripted preview traffic</p>
        <p>Drag to orbit · Scroll to zoom</p>
      </footer>
    </div>
  );
}
