import { type ReactNode, useEffect, useId, useState } from "react";
import architecture from "../../../../assets/architecture.svg?url";
import calibration from "../../../../results/calibration.json";
import { FixSection } from "./method/FixSection";
import { ProblemSection } from "./method/ProblemSection";
import { ProofSection } from "./method/ProofSection";
import { LearnedSection, WorksSection } from "./method/WorksSection";
import { FilteringReplay, ValidationPlots } from "./ValidationPlots";
import "../benchmark/results.css";
import "./method.css";
import "./method/explainer.css";

const references = [
  {
    title: "Nandakumar, Banerjee and Vanajakshi (2025)",
    url: "https://arxiv.org/abs/2509.21745",
    detail:
      "Queue-based reinforcement learning for a laneless, mixed-traffic intersection in SUMO.",
  },
  {
    title: "C-DAC’s CoSiCoSt-EnV",
    url: "https://cdac.in/index.aspx?id=product_details&productId=CoSiCoStEnV(CompositeSignalControlStrategyEnhancedVersion)",
    detail: "Adaptive signal control designed for non-lane-based mixed traffic in India.",
  },
  {
    title: "Varaiya (2013)",
    url: "https://people.eecs.berkeley.edu/~varaiya/publications.html#:~:text=Max%20pressure%20control%20of%20a%20network%20of%20signalized%20intersections",
    detail: "Max-pressure control for a network of signalized intersections.",
  },
  {
    title: "Webster (1958)",
    url: "https://books.google.co.uk/books/about/Traffic_Signal_Settings.html?id=c9QOQ4jXK5cC",
    detail: "Traffic Signal Settings, including the calculation behind the fixed-time baseline.",
  },
  {
    title: "Treiber, Hennecke and Helbing (2000)",
    url: "https://journals.aps.org/pre/abstract/10.1103/PhysRevE.62.1805",
    detail: "The Intelligent Driver Model for longitudinal car-following.",
  },
  {
    title: "Salimans et al. (2017)",
    url: "https://arxiv.org/abs/1703.03864",
    detail: "Evolution strategies for optimizing policies with parallel episode evaluations.",
  },
];

function RoadSpaceFigure() {
  const titleId = useId();
  return (
    <figure className="method-figure">
      <svg viewBox="0 0 740 186" role="img" aria-labelledby={titleId}>
        <title id={titleId}>
          A bus, an auto-rickshaw and a two-wheeler share a road cross-section and each occupies a
          different width.
        </title>
        <rect x="8" y="12" width="724" height="155" rx="9" fill="#121b2a" />
        {[42, 65, 88, 111, 134].map((y) => (
          <line key={y} x1="9" x2="731" y1={y} y2={y} stroke="#314154" strokeDasharray="3 7" />
        ))}
        <path d="M8 24H732M8 155H732" stroke="#75879c" strokeWidth="1.1" />
        <g fill="#3df2b4" stroke="#aafbe5" strokeWidth="0.7">
          <rect x="120" y="46" width="166" height="55" rx="8" />
          <rect x="410" y="91" width="71" height="35" rx="6" />
          <rect x="342" y="52" width="38" height="15" rx="6" />
        </g>
        <g fill="#063128" fontSize="13" textAnchor="middle" fontWeight="700">
          <text x="203" y="77">
            Bus
          </text>
          <text x="445" y="113">
            Auto
          </text>
        </g>
        <path d="M358 48V33h100" fill="none" stroke="#a9b7cc" />
        <text x="465" y="37" fill="#e8edf5" fontSize="13">
          Two-wheeler
        </text>
        <path d="M581 109h73m-8 -7 8 7-8 7" fill="none" stroke="#a9b7cc" strokeWidth="1.5" />
        <text x="581" y="134" fill="#a9b7cc" fontSize="12">
          Direction of travel
        </text>
      </svg>
      <figcaption>
        Each vehicle reserves enough strips for its width. The dotted lines show the model’s spatial
        grid.
      </figcaption>
    </figure>
  );
}

function SaturationFigure() {
  const titleId = useId();
  const mixNames = {
    mixed: "Mixed traffic",
    festival: "Festival mix",
    cars: "Lane-disciplined cars",
  };
  const rates = calibration.rows;
  const maximum =
    Math.ceil(Math.max(...rates.map(({ vehiclesPerSecond }) => vehiclesPerSecond)) * 5) / 5;
  const scale = (value: number) => 147 + (528 * value) / maximum;
  const widths = [...new Set(rates.map(({ strips }) => strips))].sort((a, b) => a - b);
  const top = 22;
  const height = top + widths.length * 74 + 52;
  return (
    <figure className="results-chart">
      <figcaption>Saturation flow across approach widths</figcaption>
      <p>
        Mean discharge measured after the start-up interval, during a long green in the simulator.
      </p>
      <ul className="chart-legend">
        <li>
          <span style={{ backgroundColor: "#3df2b4" }} />
          Mixed traffic
        </li>
        <li>
          <span style={{ backgroundColor: "#ffc27a" }} />
          Festival mix
        </li>
        <li>
          <span style={{ backgroundColor: "#92bdff" }} />
          Lane-disciplined cars
        </li>
      </ul>
      <div className="results-chart-scroll">
        <svg viewBox={`0 0 740 ${height}`} role="img" aria-labelledby={titleId}>
          <title id={titleId}>
            Measured simulated saturation flow in vehicles per second at each approach width for
            three demand mixes
          </title>
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
            <g key={fraction}>
              <line
                className="chart-grid"
                x1={scale(fraction * maximum)}
                x2={scale(fraction * maximum)}
                y1={top}
                y2={height - 45}
              />
              <text x={scale(fraction * maximum)} y={height - 27} textAnchor="middle">
                {(fraction * maximum).toFixed(2)}
              </text>
            </g>
          ))}
          {widths.map((width, group) => (
            <g key={width}>
              <text className="chart-scenario" x="8" y={top + group * 74 + 32}>
                {width / 2} m approach
              </text>
              {(["mixed", "festival", "cars"] as const).map((mix, index) => {
                const rate = rates.find((row) => row.strips === width && row.mix === mix);
                if (!rate) return null;
                const colours = ["#3df2b4", "#ffc27a", "#92bdff"];
                return (
                  <rect
                    key={mix}
                    x={scale(0)}
                    y={top + group * 74 + 9 + 17 * index}
                    width={scale(rate.vehiclesPerSecond) - scale(0)}
                    height="10"
                    rx="3"
                    fill={colours[index]}
                  >
                    <title>
                      {width / 2} m, {mixNames[mix]}: {rate.vehiclesPerSecond.toFixed(3)}{" "}
                      vehicles/s, {rate.areaPerSecond.toFixed(2)} m²/s
                    </title>
                  </rect>
                );
              })}
            </g>
          ))}
          <text className="chart-axis-title" x="8" y="12">
            Approach width
          </text>
          <text
            className="chart-axis-title"
            x={scale(maximum / 2)}
            y={height - 6}
            textAnchor="middle"
          >
            Saturation flow (vehicles per second)
          </text>
        </svg>
      </div>
    </figure>
  );
}

const chapters = [
  { id: "problem", number: "01", label: "The problem" },
  { id: "fix", number: "02", label: "How CHOWK fixes it" },
  { id: "decision", number: "03", label: "How a decision works" },
  { id: "learned", number: "04", label: "How it learned" },
  { id: "proof", number: "05", label: "Proof you can check" },
  { id: "details", number: "06", label: "Under the hood" },
] as const;

/** A chapter bar under the site header that follows the reader down the page. */
function ChapterNav() {
  const [current, setCurrent] = useState<string>(chapters[0].id);
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length > 0) setCurrent(visible[visible.length - 1].target.id);
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    for (const { id } of chapters) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);
  return (
    <nav className="explainer-chapters" aria-label="Chapters">
      {chapters.map(({ id, number, label }) => (
        <a key={id} href={`#${id}`} aria-current={current === id ? "location" : undefined}>
          <span>{number}</span>
          {label}
        </a>
      ))}
    </nav>
  );
}

function Chapter({
  id,
  number,
  title,
  kicker,
  children,
}: {
  id: string;
  number: string;
  title: string;
  kicker: string;
  children: ReactNode;
}) {
  return (
    <section className="explainer-chapter" id={id} aria-labelledby={`${id}-heading`}>
      <header>
        <span className="explainer-number">{number}</span>
        <p className="explainer-kicker">{kicker}</p>
        <h2 id={`${id}-heading`}>{title}</h2>
      </header>
      {children}
    </section>
  );
}

export function MethodView() {
  return (
    <div className="method-content explainer">
      <p className="information-intro explainer-intro">
        Indian junctions do not queue in lanes. CHOWK is a traffic-signal controller that measures
        the road the way this traffic uses it, and learned in simulation to cut the delay people
        feel. Here is the problem, the fix, and exactly how it works.
      </p>
      <ChapterNav />

      <Chapter
        id="problem"
        number="01"
        kicker="The problem"
        title="Signals that count vehicles cannot see Indian traffic"
      >
        <ProblemSection />
      </Chapter>

      <Chapter
        id="fix"
        number="02"
        kicker="The fix"
        title="CHOWK measures space and people, and it shows"
      >
        <FixSection />
      </Chapter>

      <Chapter
        id="decision"
        number="03"
        kicker="How it works"
        title="One decision, four steps, every five seconds"
      >
        <WorksSection />
      </Chapter>

      <Chapter
        id="learned"
        number="04"
        kicker="How it learned"
        title="Trained on simulated traffic, chosen on traffic it never trained on"
      >
        <LearnedSection />
      </Chapter>

      <Chapter id="proof" number="05" kicker="Proof" title="A fair test you can check yourself">
        <ProofSection />
      </Chapter>

      <Chapter
        id="details"
        number="06"
        kicker="Under the hood"
        title="The simulator, its checks and the prior work"
      >
        <section className="method-section" aria-labelledby="method-sim-heading">
          <h3 id="method-sim-heading">Simulating shared width</h3>
          <p>
            Roads are divided into narrow strips. Vehicles follow the nearest obstacle across their
            occupied strips and may move laterally when there is enough space. A two-wheeler can
            filter past a stopped car because it can fit in space a wider vehicle cannot use.
          </p>
          <p>
            Signal phases serve one approach at a time. The simulator enforces yellow and all-red
            clearances, keeps conflicting movements out of the junction box, and tracks vehicles
            waiting at the entry as well as vehicles on the road.
          </p>
          <RoadSpaceFigure />
          <FilteringReplay />
        </section>

        <section className="method-section" aria-labelledby="method-eval-heading">
          <h3 id="method-eval-heading">How comparisons work</h3>
          <p>
            Controllers run with identical seeded arrivals. The primary endpoint is delay per person
            in morning-peak mixed traffic versus area max-pressure. Results use paired bootstrap
            intervals. Secondary comparisons are exploratory and use unadjusted intervals.
          </p>
          <figure className="method-figure">
            <img
              src={architecture}
              alt="The shared simulator supplies training, Live workers, and benchmark runners. Validation selects the exported policy used in both Live and the benchmark."
            />
            <figcaption>
              Training, Live and reproduction share the same simulator and controller driver.
            </figcaption>
          </figure>
        </section>

        <section className="method-section" aria-labelledby="method-validation-heading">
          <h3 id="method-validation-heading">Simulator checks</h3>
          <p>
            Tests check vehicle conservation, junction exclusivity, filtering, rectangle overlap and
            repeatability. The calibration runs measure discharge for each approach width and
            vehicle mix, which sets the scale of scenario demand.
          </p>
          <SaturationFigure />
          <ValidationPlots />
        </section>

        <section className="method-section" aria-labelledby="method-prior-heading">
          <h3 id="method-prior-heading">Prior work and project contribution</h3>
          <p>
            CHOWK combines a deterministic browser simulator for mixed traffic, a shared corridor
            policy with person-weighted delay, a side-by-side scene with live disturbances, and
            benchmark reproduction in the browser.
          </p>
          <ul className="method-references">
            {references.map(({ title, url, detail }) => (
              <li key={url}>
                {detail} <a href={url}>{title}</a>
              </li>
            ))}
          </ul>
        </section>
      </Chapter>
    </div>
  );
}
