export type Point = [x: number, z: number];

export interface NetworkNode {
  id: number;
  kind: "junction" | "source" | "sink";
  x: number;
  z: number;
}

export interface Link {
  id: number;
  from: number;
  to: number;
  length: number;
  strips: number;
  speedLimit: number;
  origin: Point;
  dir: Point;
  left: Point;
}

export interface Connector {
  id: number;
  junction: number;
  fromLink: number;
  toLink: number;
  movement: "left" | "through" | "right";
  length: number;
  strips: number;
  path: Point[];
}

export interface Phase {
  approaches: number[];
}

export interface Junction {
  id: number;
  node: number;
  approaches: number[];
  phases: Phase[];
  minGreen: number;
  yellow: number;
  allRed: number;
  maxGreen: number;
}

export interface Source {
  id: number;
  node: number;
  link: number;
  name: string;
}

export interface Route {
  id: number;
  source: number;
  sink: number;
  links: number[];
}

export interface Network {
  id: string;
  stripWidth: number;
  nodes: NetworkNode[];
  links: Link[];
  connectors: Connector[];
  junctions: Junction[];
  sources: Source[];
  routes: Route[];
}

const GEOMETRY_TOLERANCE = 1e-6;

function requireValid(condition: unknown, field: string, reason: string): asserts condition {
  if (!condition) throw new TypeError(`Invalid network ${field}: ${reason}`);
}

function object(value: unknown, field: string): Record<string, unknown> {
  requireValid(
    value && typeof value === "object" && !Array.isArray(value),
    field,
    "expected an object",
  );
  return value as Record<string, unknown>;
}

function list(value: unknown, field: string): unknown[] {
  requireValid(Array.isArray(value), field, "expected an array");
  return value;
}

function string(value: unknown, field: string): string {
  requireValid(
    typeof value === "string" && value.trim().length > 0,
    field,
    "expected non-empty text",
  );
  return value;
}

function number(value: unknown, field: string): number {
  requireValid(
    typeof value === "number" && Number.isFinite(value),
    field,
    "expected a finite number",
  );
  return value;
}

function positive(value: unknown, field: string): number {
  const result = number(value, field);
  requireValid(result > 0, field, "expected a positive number");
  return result;
}

function integer(value: unknown, field: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const result = number(value, field);
  requireValid(
    Number.isSafeInteger(result) && result >= min && result <= max,
    field,
    `expected an integer from ${min} to ${max}`,
  );
  return result;
}

function reference(value: unknown, field: string, size: number): number {
  return integer(value, field, 0, size - 1);
}

function pair(value: unknown, field: string): Point {
  const items = list(value, field);
  requireValid(items.length === 2, field, "expected two coordinates");
  return [number(items[0], field), number(items[1], field)];
}

function records<T>(
  value: unknown,
  field: string,
  parse: (data: Record<string, unknown>, label: string, id: number) => T,
  idOffset = 0,
): T[] {
  return Array.from(list(value, field), (item, index) => {
    const label = `${field}[${index}]`;
    const data = object(item, label);
    const id = index + idOffset;
    requireValid(data.id === id, label, `expected id ${id} in index order`);
    return parse(data, label, id);
  });
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= GEOMETRY_TOLERANCE;
}

function distance(a: Point, b: Point): number {
  const x = a[0] - b[0];
  const z = a[1] - b[1];
  return Math.sqrt(x * x + z * z);
}

function centerAt(link: Link, position: number, stripWidth: number): Point {
  const half = (link.strips * stripWidth) / 2;
  return [
    link.origin[0] + link.dir[0] * position - link.left[0] * half,
    link.origin[1] + link.dir[1] * position - link.left[1] * half,
  ];
}

export function loadNetwork(input: unknown): Network {
  const data = object(input, "root");
  const id = string(data.id, "id");
  const stripWidth = positive(data.stripWidth, "stripWidth");

  const nodes = records<NetworkNode>(data.nodes, "nodes", (item, field, index) => {
    const { kind } = item;
    requireValid(
      kind === "junction" || kind === "source" || kind === "sink",
      field,
      "unknown node kind",
    );
    return { id: index, kind, x: number(item.x, `${field}.x`), z: number(item.z, `${field}.z`) };
  });

  const links = records<Link>(data.links, "links", (item, field, index) => {
    const from = reference(item.from, `${field}.from`, nodes.length);
    const to = reference(item.to, `${field}.to`, nodes.length);
    requireValid(
      from !== to && nodes[from].kind !== "sink" && nodes[to].kind !== "source",
      field,
      "invalid link endpoints",
    );
    const dir = pair(item.dir, `${field}.dir`);
    const left = pair(item.left, `${field}.left`);
    requireValid(
      near(dir[0] * dir[0] + dir[1] * dir[1], 1),
      field,
      "direction must be a unit vector",
    );
    requireValid(
      near(left[0], dir[1]) && near(left[1], -dir[0]),
      field,
      "left must point towards the left kerb",
    );
    return {
      id: index,
      from,
      to,
      dir,
      left,
      length: positive(item.length, `${field}.length`),
      strips: integer(item.strips, `${field}.strips`, 1, 0xffff),
      speedLimit: positive(item.speedLimit, `${field}.speedLimit`),
      origin: pair(item.origin, `${field}.origin`),
    };
  });

  const junctionNodes = new Set<number>();
  const junctions = records<Junction>(data.junctions, "junctions", (item, field, index) => {
    const node = reference(item.node, `${field}.node`, nodes.length);
    requireValid(
      nodes[node].kind === "junction" && !junctionNodes.has(node),
      field,
      "expected a distinct junction node",
    );
    junctionNodes.add(node);
    const approaches = Array.from(list(item.approaches, `${field}.approaches`), (approach) =>
      reference(approach, field, links.length),
    );
    const incoming = links.filter((link) => link.to === node);
    const unique = new Set(approaches);
    requireValid(
      approaches.length > 0 &&
        approaches.length === incoming.length &&
        unique.size === approaches.length &&
        incoming.every((link) => unique.has(link.id)),
      field,
      "approaches must list each incoming link once",
    );
    const available = new Set(approaches);
    const phases = Array.from(list(item.phases, `${field}.phases`), (value) => {
      const entries = list(object(value, field).approaches, `${field}.phases.approaches`);
      const approach = reference(entries[0], field, links.length);
      requireValid(
        entries.length === 1 && available.delete(approach),
        field,
        "each phase must serve one distinct approach",
      );
      return { approaches: [approach] };
    });
    requireValid(available.size === 0, field, "a phase is missing for an approach");
    const minGreen = positive(item.minGreen, `${field}.minGreen`);
    const maxGreen = positive(item.maxGreen, `${field}.maxGreen`);
    requireValid(minGreen <= maxGreen, field, "minimum green exceeds maximum green");
    return {
      id: index,
      node,
      approaches,
      phases,
      minGreen,
      maxGreen,
      yellow: positive(item.yellow, `${field}.yellow`),
      allRed: positive(item.allRed, `${field}.allRed`),
    };
  });
  requireValid(
    nodes.every((node) => node.kind !== "junction" || junctionNodes.has(node.id)),
    "junctions",
    "a junction node has no junction",
  );

  const connectionKey = (from: number, to: number) => from * links.length + to;
  const connections = new Set<number>();
  const connectors = records<Connector>(
    data.connectors,
    "connectors",
    (item, field, index) => {
      const junction = reference(item.junction, `${field}.junction`, junctions.length);
      const fromLink = reference(item.fromLink, `${field}.fromLink`, links.length);
      const toLink = reference(item.toLink, `${field}.toLink`, links.length);
      const from = links[fromLink];
      const to = links[toLink];
      requireValid(
        from.to === junctions[junction].node && to.from === from.to,
        field,
        "connector links must meet at its junction",
      );
      const key = connectionKey(fromLink, toLink);
      requireValid(!connections.has(key), field, "duplicate movement between links");
      connections.add(key);
      const { movement } = item;
      requireValid(
        movement === "left" || movement === "through" || movement === "right",
        field,
        "unknown movement",
      );
      const path = Array.from(list(item.path, `${field}.path`), (point) =>
        pair(point, `${field}.path`),
      );
      requireValid(
        path.length >= 2 &&
          near(distance(path[0], centerAt(from, from.length, stripWidth)), 0) &&
          near(distance(path[path.length - 1], centerAt(to, 0, stripWidth)), 0),
        field,
        "path endpoints must join the carriageway centers",
      );
      let pathLength = 0;
      for (let k = 1; k < path.length; k++) {
        const segment = distance(path[k - 1], path[k]);
        requireValid(segment > 0, field, "path must not contain zero-length segments");
        pathLength += segment;
      }
      const length = positive(item.length, `${field}.length`);
      requireValid(near(pathLength, length), field, "length does not match the path");
      return {
        id: index,
        junction,
        fromLink,
        toLink,
        movement,
        length,
        strips: integer(item.strips, `${field}.strips`, 1, 0xffff),
        path,
      };
    },
    links.length,
  );

  const sourceNodes = new Set<number>();
  const sources = records<Source>(data.sources, "sources", (item, field, index) => {
    const node = reference(item.node, `${field}.node`, nodes.length);
    const link = reference(item.link, `${field}.link`, links.length);
    requireValid(
      nodes[node].kind === "source" && links[link].from === node && !sourceNodes.has(node),
      field,
      "expected a distinct source node and its entry link",
    );
    sourceNodes.add(node);
    const name =
      item.name === undefined ? `Source ${index + 1}` : string(item.name, `${field}.name`);
    return { id: index, node, link, name };
  });
  requireValid(
    nodes.every((node) => node.kind !== "source" || sourceNodes.has(node.id)),
    "sources",
    "a source node has no source",
  );

  const routes = records<Route>(data.routes, "routes", (item, field, index) => {
    const source = reference(item.source, `${field}.source`, sources.length);
    const sink = reference(item.sink, `${field}.sink`, nodes.length);
    const road = Array.from(list(item.links, `${field}.links`), (link) =>
      reference(link, field, links.length),
    );
    requireValid(
      road[0] === sources[source].link &&
        nodes[sink].kind === "sink" &&
        links[road[road.length - 1]].to === sink,
      field,
      "route must run from its source to its sink",
    );
    for (let k = 1; k < road.length; k++) {
      requireValid(
        connections.has(connectionKey(road[k - 1], road[k])),
        field,
        "route includes a missing connector",
      );
    }
    return { id: index, source, sink, links: road };
  });
  requireValid(
    links.length > 0 && sources.length > 0 && routes.length > 0,
    "root",
    "a network must have roads, sources and routes",
  );
  return { id, stripWidth, nodes, links, connectors, junctions, sources, routes };
}
