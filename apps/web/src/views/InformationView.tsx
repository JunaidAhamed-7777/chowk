import { lazy, Suspense } from "react";

const ResultsView = lazy(() =>
  import("./ResultsView").then(({ ResultsView }) => ({ default: ResultsView })),
);
const MethodView = lazy(() =>
  import("./MethodView").then(({ MethodView }) => ({ default: MethodView })),
);

export type InformationRoute = "/results" | "/method" | "/limits";

const titles = {
  "/results": "Benchmark results",
  "/method": "How CHOWK works",
  "/limits": "Scope and limitations",
};

const limits = [
  [
    "Modelled roads",
    "The corridor uses authored geometry and representative widths and spacing. A field study would need measurements from the streets it evaluates.",
  ],
  [
    "Simplified behaviour",
    "Vehicle dimensions, speeds, headways and occupancy use documented assumptions. Pedestrians, parking and unscripted incidents are outside the model.",
  ],
  [
    "Sensing assumptions",
    "The controller receives approach area, occupancy, waiting time and downstream conditions. Noise and freezes approximate detector faults in a simplified form.",
  ],
  [
    "Estimated emissions",
    "The simulator estimates fuel and CO₂ from speed, acceleration and idling. The estimate depends on assumptions about the fleet and fuel mix.",
  ],
  [
    "Emergency and fairness metrics",
    "Ambulance travel time covers completed trips. The completion count, approach waits and everyone else’s delay help interpret each result.",
  ],
  [
    "Field validation",
    "Applying the approach on public roads would require local calibration, independent safety validation and an authority-approved field trial.",
  ],
  [
    "Browser coverage",
    "Desktop testing covered Chrome and Edge on Windows and macOS, Safari on macOS, Firefox on Linux and Playwright WebKit on Windows. Portrait testing used Chromium touch emulation at Low quality. Testing on physical iOS and Android devices remains open.",
  ],
];

export function InformationView({ route }: { route: InformationRoute }) {
  return (
    <article className={route === "/results" ? "information information-results" : "information"}>
      <p className="section-label">{route.slice(1)}</p>
      <h1 id="information-heading" tabIndex={-1}>
        {titles[route]}
      </h1>
      {route !== "/limits" ? (
        <Suspense
          fallback={
            <div className="information-loading" role="status">
              <span className="information-spinner" aria-hidden="true" />
              Loading {route === "/results" ? "the benchmark results" : "the method"}…
              <span className="information-skeleton" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </div>
          }
        >
          {route === "/results" ? <ResultsView /> : <MethodView />}
        </Suspense>
      ) : (
        <>
          <p className="information-intro">
            All traffic results come from the simulator. Demand levels are calibrated to measured
            discharge inside the model.
          </p>
          <dl className="information-list">
            {limits.map(([title, description]) => (
              <div key={title}>
                <dt>{title}</dt>
                <dd>{description}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </article>
  );
}
