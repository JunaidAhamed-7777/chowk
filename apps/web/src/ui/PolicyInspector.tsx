import type { Explanation } from "@chowk/controllers";
import { type ApproachSense, corridor, type JunctionSense } from "@chowk/sim";
import { type RefObject, useEffect, useState } from "react";
import type { SimHost } from "../sim/SimHost";

type Reading = {
  sense?: JunctionSense;
  decision?: Explanation;
};

const number = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const features = [
  { name: "Near area", key: "areaNear", max: 1 },
  { name: "Mid area", key: "areaMid", max: 1 },
  { name: "Far area", key: "areaFar", max: 1 },
  { name: "Stopped area", key: "stoppedArea", max: 1 },
  { name: "People", key: "people", max: 100 },
  { name: "Wait", key: "waitMax", max: 120 },
  { name: "Emergency", key: "emergency", max: 1 },
  { name: "Exit area", key: "outArea", max: 1 },
] satisfies readonly { name: string; key: keyof ApproachSense; max: number }[];

export function PolicyInspector({
  host,
  junction,
  onClose,
}: {
  host: RefObject<SimHost | null>;
  junction: number;
  onClose: () => void;
}) {
  const [approach, setApproach] = useState(0);
  const [reading, setReading] = useState<Reading>();
  useEffect(() => {
    function read() {
      const snapshot = host.current?.streams[1].current;
      if (!snapshot) return;
      const sense = snapshot.sense?.[junction];
      const decision = snapshot.explanations?.[junction];
      setReading((current) =>
        current?.sense === sense && current?.decision === decision ? current : { sense, decision },
      );
    }
    read();
    const interval = window.setInterval(read, 250);
    return () => window.clearInterval(interval);
  }, [host, junction]);
  const sense = reading?.sense;
  const networkJunction = corridor.junctions[junction];
  const current = Math.min(approach, Math.max(0, (sense?.approaches.length ?? 1) - 1));
  const input = sense?.approaches[current];
  const decision = reading?.decision;
  return (
    <aside className="policy-inspector" aria-label="Controller inspector">
      <header>
        <h2>J{junction + 1} · Right controller</h2>
        <button
          className="control-button"
          type="button"
          onClick={onClose}
          aria-label="Close inspector"
        >
          ×
        </button>
      </header>
      {sense && input ? (
        <>
          <label className="control-select">
            <span>Sensed approach</span>
            <select value={current} onChange={(event) => setApproach(Number(event.target.value))}>
              {networkJunction.approaches.map((link, index) => (
                <option key={link} value={index}>
                  Approach {index + 1}
                </option>
              ))}
            </select>
          </label>
          <dl>
            {features.map(({ name, key, max }) => {
              const value = input[key];
              return (
                typeof value === "number" && (
                  <div key={key} className="inspector-feature">
                    <dt>{name}</dt>
                    <dd>{number.format(value)}</dd>
                    <meter min={0} max={max} value={Math.min(value, max)} aria-label={name}>
                      {value}
                    </meter>
                  </div>
                )
              );
            })}
          </dl>
          <p>
            Current phase {sense.phase + 1} · {sense.state}
          </p>
          {decision ? (
            <>
              <p>{decision.reason}</p>
              {decision.scores.length > 0 && (
                <ul aria-label="Phase scores">
                  {decision.scores.map((score, index) => (
                    <li key={networkJunction.phases[index]?.approaches[0] ?? index}>
                      <span>Phase {index + 1}</span>
                      <strong>{number.format(score)}</strong>
                      {decision.prior?.[index] !== undefined && (
                        <span>Prior {number.format(decision.prior[index])}</span>
                      )}
                      {decision.learned?.[index] !== undefined && (
                        <span>Learned {number.format(decision.learned[index])}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p>This controller exposes its current phase.</p>
          )}
        </>
      ) : (
        <p role="status">Waiting for a sensor snapshot.</p>
      )}
      <p>Simulation result</p>
    </aside>
  );
}
