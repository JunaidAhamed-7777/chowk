import { POLICY_PARAMETER_COUNT } from "@chowk/controllers";
import { lazy, Suspense } from "react";

const ResultsView = lazy(() =>
  import("./ResultsView").then(({ ResultsView }) => ({ default: ResultsView })),
);
const ControllersView = lazy(() =>
  import("./ControllersView").then(({ ControllersView }) => ({ default: ControllersView })),
);
const MethodView = lazy(() =>
  import("./MethodView").then(({ MethodView }) => ({ default: MethodView })),
);

export type InformationRoute = "/controllers" | "/results" | "/method" | "/limits";

const titles = {
  "/controllers": "How each controller decides",
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

const parameters = new Intl.NumberFormat("en-IN").format(POLICY_PARAMETER_COUNT);

// None of these steps has been carried out. External facts are cited inline.
const pathSteps: { title: string; body: React.ReactNode }[] = [
  {
    title: "Sensing",
    body: (
      <>
        CHOWK needs, for each approach, how much road area is occupied and by whom. Camera-based
        detection is one way to measure it. Bengaluru’s adaptive signal system, for example, uses
        cameras and sensors to feed real-time traffic data to its controller.{" "}
        <a href="https://indianinfrastructure.com/2026/04/06/smart-mobility-a-case-study-of-the-bengaluru-adaptive-traffic-control-system/">
          Indian Infrastructure, April 2026
        </a>
      </>
    ),
  },
  {
    title: "Where it would sit",
    body: (
      <>
        Indian cities already run adaptive control built for lane-free traffic: Bengaluru’s system
        runs on C-DAC’s CoSiCoSt and covered 169 junctions by April 2025.{" "}
        <a href="https://indianinfrastructure.com/2026/04/06/smart-mobility-a-case-study-of-the-bengaluru-adaptive-traffic-control-system/">
          Indian Infrastructure, April 2026
        </a>{" "}
        A learned policy like CHOWK would be one more strategy inside such a system: it proposes the
        next phase, while the signal controller keeps enforcing minimum green, yellow and all-red,
        and falls back to its fixed-time plan if sensing or the policy fails.
      </>
    ),
  },
  {
    title: "Compute",
    body: `The policy is a hand-written network of ${parameters} parameters using only addition, multiplication and maximum. It needs no GPU or runtime library; the measured time per decision is on the Results page.`,
  },
  {
    title: "Before any trial",
    body: "Calibrate the simulator to counts and discharge measured at the target junctions, re-run the benchmark there, run CHOWK in shadow mode beside the existing controller while logging what it would have done, and only then seek an authority-approved, supervised pilot with independent safety review.",
  },
];

export function InformationView({ route }: { route: InformationRoute }) {
  return (
    <article className={route === "/results" ? "information information-results" : "information"}>
      <h1 id="information-heading" tabIndex={-1}>
        {titles[route]}
      </h1>
      {route !== "/limits" ? (
        <Suspense
          fallback={
            <div className="information-loading" role="status">
              <span className="information-spinner" aria-hidden="true" />
              Loading {route === "/results" ? "the benchmark results" : "this page"}…
              <span className="information-skeleton" aria-hidden="true">
                <span className="information-bar" />
                <span className="information-bar" />
                <span className="information-bar" />
              </span>
            </div>
          }
        >
          {route === "/results" ? (
            <ResultsView />
          ) : route === "/controllers" ? (
            <ControllersView />
          ) : (
            <MethodView />
          )}
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
          <h2 className="information-subheading">Path to a real junction</h2>
          <p className="information-intro">
            What a field trial would take. This is a plan; none of it has been done.
          </p>
          <dl className="information-list">
            {pathSteps.map(({ title, body }) => (
              <div key={title}>
                <dt>{title}</dt>
                <dd>{body}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </article>
  );
}
