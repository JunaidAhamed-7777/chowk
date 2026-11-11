import type { Network, Scenario, SourceDemand } from "@chowk/sim";

export interface TurnShare {
  link: number;
  share: number;
}

/** Integrate the same piecewise-linear source profile used to generate arrivals. */
export function meanRate(rates: SourceDemand["rates"], start: number, end: number): number {
  let arrivals = 0;
  for (let i = 0; i < rates.length; i++) {
    const point = rates[i];
    const next = rates[i + 1];
    const left = Math.max(start, point.t);
    const right = Math.min(end, next?.t ?? end);
    if (right <= left) continue;
    const slope = next ? (next.rate - point.rate) / (next.t - point.t) : 0;
    const rateAtMiddle = point.rate + slope * ((left + right) / 2 - point.t);
    arrivals += (right - left) * rateAtMiddle;
  }
  return end > start ? arrivals / (end - start) : 0;
}

/** Assign the specified demand to each route, without using realised traffic or arrival seeds. */
export function expectedDemand(
  network: Network,
  scenario: Scenario,
  start = 0,
  end = scenario.duration,
) {
  const approach = new Float64Array(network.links.length);
  const turns = network.links.map(() => new Map<number, number>());
  for (const source of scenario.sources) {
    const rate = meanRate(source.rates, start, end);
    const totalWeight = source.routes.reduce((total, { weight }) => total + weight, 0);
    if (totalWeight <= 0 || rate === 0) continue;
    for (const { route: routeId, weight } of source.routes) {
      const flow = (rate * weight) / totalWeight;
      const { links } = network.routes[routeId];
      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        approach[link] += flow;
        if (i + 1 < links.length) {
          const exit = links[i + 1];
          turns[link].set(exit, (turns[link].get(exit) ?? 0) + flow);
        }
      }
    }
  }
  const shares = network.links.map(({ id }) => {
    const exits = network.connectors
      .filter(({ fromLink }) => fromLink === id)
      .map(({ toLink }) => toLink)
      .sort((a, b) => a - b);
    return exits.map(
      (link): TurnShare => ({
        link,
        share: approach[id] > 0 ? (turns[id].get(link) ?? 0) / approach[id] : 1 / exits.length,
      }),
    );
  });
  return { approach, shares };
}
