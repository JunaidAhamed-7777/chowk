import { VEHICLE_CLASSES } from "@chowk/sim";
import {
  type OverlayMode,
  peopleColors,
  peopleMetresPerRootPerson,
  speedBands,
} from "../scene/sceneSettings";
import "./overlayLegend.css";

const kmh = (metresPerSecond: number) => Math.round(metresPerSecond * 3.6);

function speedRange(index: number): string {
  const lower = index === 0 ? 0 : speedBands[index - 1].upTo;
  const upper = speedBands[index].upTo;
  if (index === 0) return `under ${kmh(upper)} km/h`;
  if (!Number.isFinite(upper)) return `over ${kmh(lower)} km/h`;
  return `${kmh(lower)}–${kmh(upper)} km/h`;
}

// Example markers drawn at the same relative sizes as in the scene.
const examples = (["two-wheeler", "bus"] as const).flatMap((id) => {
  const vehicle = VEHICLE_CLASSES.find((entry) => entry.id === id);
  return vehicle
    ? [
        {
          id,
          people: vehicle.occupancy,
          metres: peopleMetresPerRootPerson * Math.sqrt(vehicle.occupancy),
        },
      ]
    : [];
});
const largest = Math.max(...examples.map(({ metres }) => metres), 1);

/** Says what the Speed and People overlays draw, so the markers read at a glance. */
export function OverlayLegend({ overlay }: { overlay: OverlayMode }) {
  if (overlay === "speed")
    return (
      <aside className="overlay-legend" aria-label="Speed overlay legend">
        <strong>Speed</strong>
        <ul>
          {speedBands.map(({ label, color }, index) => (
            <li key={label}>
              <i style={{ background: color }} />
              {label} <span>{speedRange(index)}</span>
            </li>
          ))}
        </ul>
      </aside>
    );
  if (overlay === "people")
    return (
      <aside className="overlay-legend" aria-label="People overlay legend">
        <strong>People on board</strong>
        <ul>
          {examples.map(({ id, people, metres }) => (
            <li key={id}>
              <i
                className="overlay-legend-dot"
                style={{ width: 22 * (metres / largest) + 6, height: 22 * (metres / largest) + 6 }}
              />
              {id === "bus" ? "Bus" : "Two-wheeler"} <span>{people} people</span>
            </li>
          ))}
          <li>
            <i style={{ background: peopleColors.waiting }} />
            Waiting <span>stopped</span>
          </li>
          <li>
            <i style={{ background: peopleColors.moving }} />
            Moving
          </li>
        </ul>
      </aside>
    );
  return null;
}
