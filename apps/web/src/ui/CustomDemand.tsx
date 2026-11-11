import { useState } from "react";
import type { CustomDemandValues } from "../sim/liveScenario";

const labels = ["Two-wheelers", "Auto-rickshaws", "Cars", "Light commercial", "Buses"];

export function CustomDemand({
  initial,
  onApply,
  onCancel,
}: {
  initial: CustomDemandValues;
  onApply: (value: CustomDemandValues) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const total = draft.weights.reduce((sum, weight) => sum + weight, 0);
  return (
    <form
      className="custom-demand-panel"
      aria-label="Custom traffic demand"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (total > 0) onApply(draft);
      }}
    >
      <h2>Custom demand</h2>
      <label className="demand-field" htmlFor="custom-demand-load">
        <span>Demand relative to simulated capacity</span>
        <output>{Math.round(draft.load * 100)}%</output>
        <input
          id="custom-demand-load"
          type="range"
          min={40}
          max={140}
          step={5}
          value={Math.round(draft.load * 100)}
          onChange={(event) => {
            setDraft({ ...draft, load: Number(event.target.value) / 100 });
          }}
        />
      </label>
      <fieldset className="mix-fields">
        <legend>Vehicle mix</legend>
        {labels.map((label, index) => (
          <label className="demand-field" key={label} htmlFor={`custom-mix-${index}`}>
            <span>{label}</span>
            <output>{total > 0 ? Math.round((draft.weights[index] * 100) / total) : 0}%</output>
            <input
              id={`custom-mix-${index}`}
              type="range"
              min={0}
              max={100}
              value={draft.weights[index]}
              onChange={(event) => {
                const value = Number(event.target.value);
                setDraft({
                  ...draft,
                  weights: draft.weights.map((weight, position) =>
                    position === index ? value : weight,
                  ),
                });
              }}
            />
          </label>
        ))}
      </fieldset>
      <div className="custom-demand-actions">
        <button className="control-button" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="control-button" type="submit" disabled={total === 0}>
          Apply and restart
        </button>
      </div>
    </form>
  );
}
