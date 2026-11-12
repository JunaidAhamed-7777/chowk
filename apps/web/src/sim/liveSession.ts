import { scenarioCatalog } from "@chowk/scenarios";
import { type CameraSelection, type OverlayMode, overlays } from "../scene/sceneSettings";
import { baselineChoices, defaultControllers } from "./livePolicies";
import {
  type CustomDemandValues,
  initialCustomDemand,
  type LiveScenarioId,
  liveSeed,
  parseCustomDemand,
} from "./liveScenario";
import type { ControllerPair } from "./SimHost";

export const maxLiveSeed = 999_999;

export function parseLiveSeed(input: string) {
  if (!/^\d+$/.test(input.trim())) return undefined;
  const seed = Number(input);
  return Number.isSafeInteger(seed) && seed >= 0 && seed <= maxLiveSeed ? seed : undefined;
}

export function readSession() {
  const params = new URLSearchParams(window.location.search);
  const capture = params.get("capture") === "hero";
  const seed = parseLiveSeed(params.get("seed") ?? "") ?? liveSeed;
  const custom = parseCustomDemand(params.get("load"), params.get("mix"));
  const scenario: LiveScenarioId =
    params.get("scenario") === "custom" && custom
      ? "custom"
      : (scenarioCatalog.find(({ id }) => id === params.get("scenario"))?.id ?? "morning-peak");
  const overlay = overlays.find(({ id }) => id === params.get("overlay"))?.id ?? "none";
  const lookup = (side: string) =>
    baselineChoices.find(({ controller }) => controller.id === params.get(side))?.controller;
  const controllers = [
    lookup("left") ?? defaultControllers[0],
    lookup("right") ?? defaultControllers[1],
  ] as const;
  const rawCamera = params.get("camera");
  const junction = /^j[1-5]$/.test(rawCamera ?? "") ? Number(rawCamera?.slice(1)) - 1 : undefined;
  const tour = !capture && params.get("tour") !== "off";
  // The tour opens on the street camera, positioned while the loading card still covers it.
  const camera: CameraSelection =
    junction ??
    (rawCamera === "ambulance" || rawCamera === "ride"
      ? rawCamera
      : tour && !rawCamera
        ? "street"
        : "aerial");
  return {
    capture,
    seed,
    scenario,
    custom: custom ?? initialCustomDemand,
    overlay,
    controllers,
    requestedControllers: [params.get("left"), params.get("right")] as const,
    camera,
    tour,
  };
}

export function sessionUrl({
  seed,
  scenario,
  controllers,
  overlay,
  camera,
  custom,
}: {
  seed: number;
  scenario: LiveScenarioId;
  controllers: ControllerPair;
  overlay: OverlayMode;
  camera: CameraSelection;
  custom: CustomDemandValues;
}) {
  const url = new URL("/", window.location.origin);
  url.search = new URLSearchParams({
    seed: String(seed),
    scenario,
    left: controllers[0].id,
    right: controllers[1].id,
    overlay,
    camera: typeof camera === "number" ? `j${camera + 1}` : camera,
    tour: "off",
    ...(scenario === "custom" && { load: String(custom.load), mix: custom.weights.join(",") }),
  }).toString();
  return url.toString();
}
