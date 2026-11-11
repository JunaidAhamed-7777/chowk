import { describe, expect, it } from "vitest";
import data from "../networks/corridor.json";
import { corridor } from "../src/corridor";
import { loadNetwork } from "../src/network";

function editedData() {
  return JSON.parse(JSON.stringify(data)) as typeof data;
}

describe("authored corridor", () => {
  it("has the planned spacing, stub lengths, approach widths and phases", () => {
    expect(corridor.junctions.map((junction) => corridor.nodes[junction.node].x)).toEqual([
      0, 420, 800, 1350, 1810,
    ]);
    expect(corridor.junctions.map((junction) => junction.approaches.length)).toEqual([
      4, 4, 4, 4, 3,
    ]);
    expect(
      corridor.junctions.map(({ approaches }) => approaches.map((id) => corridor.links[id].strips)),
    ).toEqual([
      [11, 21, 11, 21],
      [11, 21, 11, 21],
      [14, 21, 14, 21],
      [11, 21, 11, 21],
      [21, 11, 21],
    ]);
    expect(corridor.sources).toHaveLength(11);
    for (const source of corridor.sources) {
      expect(corridor.links[source.link].length).toBe(300);
    }
    for (const junction of corridor.junctions) {
      expect(junction.phases.map(({ approaches }) => approaches[0])).toEqual(junction.approaches);
    }
  });

  it("covers every pair of distinct terminals, with a movement at each junction", () => {
    const sinks = corridor.nodes.filter(({ kind }) => kind === "sink");
    const routeKeys = new Set(corridor.routes.map(({ source, sink }) => `${source}:${sink}`));
    expect(routeKeys.size).toBe(corridor.routes.length);
    for (const { id, node } of corridor.sources) {
      for (const sink of sinks) {
        const sameTerminal = sink.x === corridor.nodes[node].x && sink.z === corridor.nodes[node].z;
        expect(routeKeys.has(`${id}:${sink.id}`)).toBe(!sameTerminal);
      }
    }
    expect(corridor.routes).toHaveLength(110);
  });

  it("rejects malformed references, geometry and disconnected routes", () => {
    const invalidLink = editedData();
    invalidLink.links[0].to = invalidLink.nodes.length;
    expect(() => loadNetwork(invalidLink)).toThrow(/links\[0\]\.to/);
    const invalidLeft = editedData();
    invalidLeft.links[0].left = [0, 1];
    expect(() => loadNetwork(invalidLeft)).toThrow(/left kerb/);
    const invalidPath = editedData();
    invalidPath.connectors[0].path[0][0] += 2;
    expect(() => loadNetwork(invalidPath)).toThrow(/path endpoints/);
    const invalidPhase = editedData();
    invalidPhase.junctions[0].phases[0].approaches.push(invalidPhase.junctions[0].approaches[1]);
    expect(() => loadNetwork(invalidPhase)).toThrow(/each phase/);
    const invalidRoute = editedData();
    const route = invalidRoute.routes.find((entry) => entry.links.length >= 3);
    expect(route).toBeDefined();
    route?.links.splice(1, 1);
    expect(() => loadNetwork(invalidRoute)).toThrow(/missing connector/);
  });
});
