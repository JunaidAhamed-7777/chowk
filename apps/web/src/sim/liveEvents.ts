import {
  corridor,
  type Link,
  type Random,
  type Scenario,
  type SimEvent,
  VEHICLE_CLASSES,
} from "@chowk/sim";

export interface RoadLocation {
  link: Link;
  along: number;
  strip: number;
}

export interface ActiveEvent {
  id: number;
  tick: number;
  event: SimEvent;
}

export const eventLabels: Record<SimEvent["type"], string> = {
  surge: "Demand surge",
  block: "Lane block",
  ambulance: "Ambulance",
  sensorFreeze: "Sensor failure",
  outage: "Signal outage",
};

export function roadAt(x: number, z: number): RoadLocation | undefined {
  for (const link of corridor.links) {
    const dx = x - link.origin[0];
    const dz = z - link.origin[1];
    const along = dx * link.dir[0] + dz * link.dir[1];
    const lateral = -dx * link.left[0] - dz * link.left[1];
    if (
      along >= 0 &&
      along <= link.length &&
      lateral >= 0 &&
      lateral < link.strips * corridor.stripWidth
    )
      return { link, along, strip: Math.floor(lateral / corridor.stripWidth) };
  }
}

export function blockAt({ link, along, strip }: RoadLocation): SimEvent {
  const bus = VEHICLE_CLASSES[4];
  const length = Math.min(link.length, bus.length);
  const strips = Math.min(link.strips, bus.strips);
  const start = Math.min(link.length - length, Math.max(0, along - length / 2));
  return {
    type: "block",
    link: link.id,
    start,
    end: start + length,
    strip: Math.max(0, Math.min(link.strips - strips, strip - Math.floor(strips / 2))),
    strips,
    duration: 240,
  };
}

export function defaultBlock(): SimEvent {
  const junction = corridor.junctions[2];
  const link =
    corridor.links[
      junction.approaches.find((id) => corridor.links[id].dir[0] > 0) ?? junction.approaches[0]
    ];
  return blockAt({ link, along: link.length - 44, strip: 2 });
}

const crossCorridor = corridor.routes.find(
  ({ links }) =>
    links.length === corridor.junctions.length + 1 &&
    links.every((id) => corridor.links[id].dir[0] > 0),
);

export function makeEvent(
  type: Exclude<SimEvent["type"], "block">,
  scenario: Scenario,
  random: Random,
): SimEvent | undefined {
  switch (type) {
    case "surge": {
      const active = scenario.sources.filter(({ rates }) => rates.some(({ rate }) => rate > 0));
      const approach = active[Math.floor(random.next() * active.length)];
      return approach && { type, source: approach.source, duration: 180, multiplier: 3 };
    }
    case "ambulance":
      return crossCorridor && { type, source: crossCorridor.source, route: crossCorridor.id };
    case "sensorFreeze":
    case "outage":
      return {
        type,
        junction: Math.floor(random.next() * corridor.junctions.length),
        duration: 120,
      };
  }
}

export function roadPoint(link: Link, along: number, lateral: number) {
  return [
    link.origin[0] + link.dir[0] * along - link.left[0] * lateral,
    link.origin[1] + link.dir[1] * along - link.left[1] * lateral,
  ] as const;
}

export function eventPoint(event: SimEvent) {
  if (event.type === "sensorFreeze" || event.type === "outage") {
    const node = corridor.nodes[corridor.junctions[event.junction].node];
    return [node.x, node.z] as const;
  }
  if (event.type === "block") {
    const link = corridor.links[event.link];
    return roadPoint(
      link,
      (event.start + event.end) / 2,
      (event.strip + event.strips / 2) * corridor.stripWidth,
    );
  }
  const link = corridor.links[corridor.sources[event.source].link];
  return roadPoint(link, Math.min(18, link.length / 2), (link.strips * corridor.stripWidth) / 2);
}
