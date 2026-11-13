import { useId } from "react";
import { trainingCurve } from "../sim/livePolicies";

export function TrainingCurveChart() {
  const titleId = useId();
  const curve = trainingCurve();
  const points = curve?.points.flatMap(({ generation, validationFitness }) =>
    validationFitness === undefined ? [] : [{ generation, fitness: validationFitness }],
  );
  if (!curve || !points?.length) return null;
  const first = points[0].generation;
  const last = points[points.length - 1].generation;
  const minimum = Math.min(0.995, ...points.map(({ fitness }) => fitness));
  const maximum = Math.max(1.005, ...points.map(({ fitness }) => fitness));
  const x = (generation: number) => 96 + ((generation - first) / (last - first || 1)) * 689;
  const y = (fitness: number) => 172 - ((fitness - minimum) / (maximum - minimum)) * 148;
  const selected = points.find(({ generation }) => generation === curve.bestGeneration);
  return (
    <figure className="results-chart">
      <figcaption>Validation fitness by generation</figcaption>
      <p>Fitness is measured against area max-pressure on the same demand. Lower is better.</p>
      {selected && (
        <p>
          Exported checkpoint: generation {selected.generation}, validation fitness{" "}
          {selected.fitness.toFixed(4)}×.
        </p>
      )}
      <div className="results-chart-scroll">
        <svg viewBox="0 0 830 222" role="img" aria-labelledby={titleId}>
          <title id={titleId}>
            Validation fitness across CHOWK generations. The dashed line marks area max-pressure
            fitness.
          </title>
          {[minimum, 1, maximum].map((fitness) => (
            <g key={fitness}>
              <line
                className={fitness === 1 ? "chart-axis" : "chart-grid"}
                x1="96"
                x2="785"
                y1={y(fitness)}
                y2={y(fitness)}
              />
              <text x="88" y={y(fitness) + 4} textAnchor="end">
                {fitness.toFixed(3)}×
              </text>
            </g>
          ))}
          <polyline
            points={points
              .map(({ generation, fitness }) => `${x(generation)},${y(fitness)}`)
              .join(" ")}
            fill="none"
            stroke="#3df2b4"
            strokeWidth="1.7"
          />
          {points.map(({ generation, fitness }) => (
            <g key={generation}>
              <title>
                Generation {generation}: {fitness.toFixed(4)}×
              </title>
              <circle
                cx={x(generation)}
                cy={y(fitness)}
                r={generation === curve.bestGeneration ? 5 : 3}
                fill={generation === curve.bestGeneration ? "#ffc27a" : "#3df2b4"}
              />
            </g>
          ))}
          <text x={x(first)} y="192" textAnchor="middle">
            {first}
          </text>
          {last !== first && (
            <text x={x(last)} y="192" textAnchor="middle">
              {last}
            </text>
          )}
          <text
            className="chart-axis-title"
            transform={`translate(14 ${y((minimum + maximum) / 2)}) rotate(-90)`}
            textAnchor="middle"
          >
            Fitness (ratio)
          </text>
          <text className="chart-axis-title" x={(96 + 785) / 2} y="216" textAnchor="middle">
            Training generation (lower fitness is better)
          </text>
        </svg>
      </div>
    </figure>
  );
}
