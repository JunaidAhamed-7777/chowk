export type InformationRoute = "/results" | "/method" | "/limits";

const limits = [
  [
    "Modelled roads",
    "The corridor is a fictional arterial with authored road dimensions and junction spacing.",
  ],
  [
    "Simplified behaviour",
    "Vehicle classes and driving parameters use documented assumptions. Pedestrians, parking and unscripted incidents are outside the model.",
  ],
  [
    "Sensing assumptions",
    "Area occupancy is an input to the controller. Sensor noise is an approximation of how physical detectors behave.",
  ],
  [
    "Estimated emissions",
    "The planned benchmark uses a simplified fuel model to estimate emissions.",
  ],
  [
    "Field calibration",
    "Applying the approach on public roads would require field calibration and safety validation.",
  ],
];

export function InformationView({ route }: { route: InformationRoute }) {
  return (
    <article className="information">
      <p className="section-label">{route.slice(1)}</p>
      {route === "/results" && (
        <>
          <h1 id="information-heading" tabIndex={-1}>
            Benchmark results
          </h1>
          <div className="information-empty">
            <h2>Publication pending</h2>
            <p>
              Results appear here after the benchmark runs on held-out demand seeds. The Live view
              runs a fixed-cycle simulation with provisional demand.
            </p>
          </div>
        </>
      )}
      {route === "/method" && (
        <>
          <h1 id="information-heading" tabIndex={-1}>
            How CHOWK works
          </h1>
          <p className="information-intro">
            The project studies signal control for mixed traffic on a modelled Indian urban
            arterial.
          </p>
          <dl className="information-list">
            <div>
              <dt>Road space</dt>
              <dd>
                The simulator design divides each carriageway into narrow strips so vehicles of
                different widths can occupy the road side by side.
              </dd>
            </div>
            <div>
              <dt>Signal control</dt>
              <dd>
                The controller design starts with area-based max-pressure and learns an adjustment
                to each phase score. The objective weights delay by vehicle occupancy.
              </dd>
            </div>
            <div>
              <dt>Evaluation</dt>
              <dd>
                The benchmark protocol pairs controllers on identical demand and evaluates them on
                held-out seeds. The authored protocol and prior-work references are available in the
                repository.
              </dd>
            </div>
          </dl>
          <a
            className="information-link"
            href="https://github.com/JunaidAhamed-7777/chowk/tree/main/plan"
          >
            Read the technical plans
          </a>
        </>
      )}
      {route === "/limits" && (
        <>
          <h1 id="information-heading" tabIndex={-1}>
            Scope and limitations
          </h1>
          <p className="information-intro">
            CHOWK is a simulation study. The Live view currently uses provisional traffic demand and
            fixed-cycle signal requests.
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
