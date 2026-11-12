import { scenarioCatalog } from "@chowk/scenarios";
import { useState } from "react";
import { type OverlayMode, overlays } from "../scene/sceneSettings";
import type { LiveScenarioId } from "../sim/liveScenario";
import { maxLiveSeed, parseLiveSeed } from "../sim/liveSession";
import { Icon } from "./Icon";

type UserEvent = "surge" | "block" | "ambulance" | "sensorFreeze" | "outage";

interface LiveControlsProps {
  enabled: boolean;
  scenario: LiveScenarioId;
  onScenario: (scenario: LiveScenarioId) => void;
  onCustom: () => void;
  onInspect: () => void;
  overlay: OverlayMode;
  onOverlay: (overlay: OverlayMode) => void;
  seed: number;
  onSeed: (seed: number) => void;
  onEvent: (event: UserEvent) => void;
  picking: boolean;
  onDefaultBlock: () => void;
  onCancelBlock: () => void;
  onShare: () => void;
}

export function LiveControls({
  enabled,
  scenario,
  onScenario,
  onCustom,
  onInspect,
  overlay,
  onOverlay,
  seed,
  onSeed,
  onEvent,
  picking,
  onDefaultBlock,
  onCancelBlock,
  onShare,
}: LiveControlsProps) {
  const [seedDraft, setSeedDraft] = useState<string | undefined>(undefined);
  const [invalid, setInvalid] = useState(false);
  return (
    <section className="simulation-controls" aria-label="Scenario and traffic events">
      <label className="control-select">
        <span>Scenario</span>
        <select
          aria-label="Scenario"
          value={scenario}
          onChange={(event) => {
            if (event.target.value === "custom") onCustom();
            else onScenario(event.target.value as LiveScenarioId);
          }}
        >
          {scenarioCatalog.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
          <option value="custom">Custom demand…</option>
        </select>
      </label>
      <fieldset className="event-buttons" aria-label="Traffic events">
        <button
          className="control-button"
          type="button"
          disabled={!enabled}
          onClick={() => onEvent("surge")}
        >
          Surge
        </button>
        <button
          className="control-button"
          type="button"
          disabled={!enabled}
          aria-pressed={picking}
          onClick={() => onEvent("block")}
        >
          Block a lane
        </button>
        <button
          className="control-button"
          type="button"
          disabled={!enabled}
          onClick={() => onEvent("ambulance")}
        >
          Ambulance
        </button>
        <details className="event-menu">
          <summary className="control-button" aria-label="More traffic events">
            More
          </summary>
          <div>
            <button
              className="control-button"
              type="button"
              disabled={!enabled}
              onClick={() => onEvent("sensorFreeze")}
            >
              Sensor failure
            </button>
            <button
              className="control-button"
              type="button"
              disabled={!enabled}
              onClick={() => onEvent("outage")}
            >
              Signal outage
            </button>
            <button className="control-button" type="button" onClick={onCustom}>
              Custom demand
            </button>
            <button
              className="control-button"
              type="button"
              disabled={!enabled}
              onClick={onInspect}
            >
              How it decides
            </button>
          </div>
        </details>
      </fieldset>
      <label className="control-select">
        <span>Overlay</span>
        <select
          aria-label="Overlay"
          value={overlay}
          onChange={(event) => onOverlay(event.target.value as OverlayMode)}
        >
          {overlays.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <form
        className="seed-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const next = parseLiveSeed(seedDraft ?? String(seed));
          setInvalid(next === undefined);
          if (next === undefined) return;
          setSeedDraft(undefined);
          onSeed(next);
        }}
      >
        <label>
          Seed
          <input
            inputMode="numeric"
            value={seedDraft ?? seed}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? "seed-error" : undefined}
            onChange={(event) => {
              setSeedDraft(event.target.value);
              setInvalid(false);
            }}
          />
        </label>
        <button className="control-button" type="submit" aria-label="Apply seed" title="Apply seed">
          ↵
        </button>
        <button
          className="control-button"
          type="button"
          aria-label="Reroll seed"
          title="Reroll seed"
          onClick={() => {
            setInvalid(false);
            setSeedDraft(undefined);
            onSeed(crypto.getRandomValues(new Uint32Array(1))[0] % 500_000);
          }}
        >
          <Icon name="reset" size={14} />
        </button>
        {invalid && (
          <span className="seed-error" id="seed-error" role="alert">
            Use a whole number from 0 to {maxLiveSeed}.
          </span>
        )}
      </form>
      <button className="control-button share-control" type="button" onClick={onShare}>
        Share
      </button>
      {picking && (
        <div className="block-instructions" role="status">
          <span>Click a road to place the stalled bus.</span>
          <button className="control-button" type="button" onClick={onDefaultBlock}>
            Place at J3
          </button>
          <button className="control-button" type="button" onClick={onCancelBlock}>
            Cancel
          </button>
        </div>
      )}
    </section>
  );
}
