import {
  corridor,
  createRandomStreams,
  DT,
  type Random,
  type SimEvent,
  SNAPSHOT_STRIDE,
  VEHICLE_CLASSES,
} from "@chowk/sim";
import {
  Component,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { NightCorridor } from "../scene/NightCorridor";
import { RainOverlay } from "../scene/RainOverlay";
import {
  type CameraSelection,
  type OverlayMode,
  overlays,
  type PlaybackSpeed,
  playingSpeeds,
  type Quality,
  qualityPresets,
  type VehicleFollow,
} from "../scene/sceneSettings";
import { TopDownCorridor } from "../scene/TopDownCorridor";
import { LiveMetrics, type LiveReadout } from "../sim/LiveMetrics";
import {
  type ActiveEvent,
  blockAt,
  defaultBlock,
  eventLabels,
  makeEvent,
  roadAt,
} from "../sim/liveEvents";
import { baselineChoices, hasPolicyAssets, loadControllerChoices } from "../sim/livePolicies";
import { type LiveScenarioId, makeLiveScenario } from "../sim/liveScenario";
import { readSession, sessionUrl } from "../sim/liveSession";
import type { ControllerPair, MetricsPair, SimulationSide } from "../sim/SimHost";
import { clockTime, scenarioScenes } from "../sim/scenarioScene";
import { useSimHost } from "../sim/useSimHost";
import { useTour } from "../tour/useTour";
import { BeatTheAI, CHALLENGE_JUNCTION, type ChallengeStage } from "../ui/BeatTheAI";
import { Briefing, shouldOpenBriefing } from "../ui/Briefing";
import { CheckpointControl } from "../ui/CheckpointControl";
import { ComparisonWipe } from "../ui/ComparisonWipe";
import { CustomDemand } from "../ui/CustomDemand";
import { DecisionPanel } from "../ui/DecisionPanel";
import { Icon } from "../ui/Icon";
import { LiveControls } from "../ui/LiveControls";
import { LoadingScreen, liveLoadingSteps } from "../ui/LoadingScreen";
import { MetricHud } from "../ui/MetricHud";
import { guideSteps, Onboarding, rememberGuideSeen, shouldOpenGuide } from "../ui/Onboarding";
import { TimeSpacePanel } from "../ui/TimeSpacePanel";
import "../ui/advancedLive.css";
import "../ui/liveLayout.css";

const stations = corridor.junctions.map(({ id }) => ({ id, name: `J${id + 1}` }));
const formatCount = new Intl.NumberFormat("en-IN");
const ambulanceClass = VEHICLE_CLASSES.findIndex(({ id }) => id === "ambulance");

interface LiveViewProps {
  active: boolean;
  quality: Quality;
  automatic: boolean;
  onQuality: (quality: Quality) => void;
}

interface LiveFrame {
  metrics: MetricsPair;
  tick: number;
  readout: LiveReadout;
}

class SceneBoundary extends Component<
  { children: ReactNode; onRetry: () => void; onFallback: () => void },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? (
      <div className="scene-message" role="status">
        <h2>3D view interrupted</h2>
        <p>Reload the scene to reconnect to your graphics device.</p>
        <button className="control-button" type="button" onClick={this.props.onRetry}>
          <Icon name="reset" />
          Reload scene
        </button>
        <button className="control-button" type="button" onClick={this.props.onFallback}>
          Use top-down view
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}

function readReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const moodNames = { day: "Daytime", evening: "Evening", night: "Night" } as const;

export default function LiveView({ active, quality, automatic, onQuality }: LiveViewProps) {
  const [initial] = useState(readSession);
  const [camera, setCamera] = useState<CameraSelection>(initial.camera);
  const [vehicle, setVehicle] = useState<VehicleFollow>();
  const [overlay, setOverlay] = useState<OverlayMode>(initial.overlay);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [paused, setPaused] = useState(initial.capture);
  const [reducedMotion, setReducedMotion] = useState(readReducedMotion);
  const [revision, setRevision] = useState(0);
  const [graphicsRevision, setGraphicsRevision] = useState(0);
  const [contextLost, setContextLost] = useState(false);
  const [ready, setReady] = useState(false);
  const [frame, setFrame] = useState<LiveFrame>();
  const [failure, setFailure] = useState("");
  const [controllers, setControllers] = useState<ControllerPair>(initial.controllers);
  const [controllerChoices, setControllerChoices] = useState(baselineChoices);
  const [policiesReady, setPoliciesReady] = useState(!hasPolicyAssets);
  const [wipe, setWipe] = useState(initial.tour ? 0 : 50);
  const [singleView, setSingleView] = useState(false);
  const [seed, setSeed] = useState(initial.seed);
  const [scenarioId, setScenarioId] = useState<LiveScenarioId>(initial.scenario);
  const [custom, setCustom] = useState(initial.custom);
  const [editingDemand, setEditingDemand] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [timeSpace, setTimeSpace] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [challenge, setChallenge] = useState<ChallengeStage>("off");
  const [inspectedJunction, setInspectedJunction] = useState(2);
  const [picking, setPicking] = useState(false);
  const [events, setEvents] = useState<ActiveEvent[]>([]);
  const [tour, setTour] = useState(initial.tour);
  const [caption, setCaption] = useState("");
  const [notice, setNotice] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [guide, setGuide] = useState<number | null>(() =>
    shouldOpenGuide(initial.tour, initial.capture) ? 0 : null,
  );
  const [briefing, setBriefing] = useState(() => shouldOpenBriefing(initial.tour, initial.capture));
  const [history] = useState(() => new LiveMetrics());
  const retries = useRef(0);
  const lastTick = useRef(0);
  const eventId = useRef(0);
  const eventRandom = useRef<Random | undefined>(undefined);
  const [webglAvailable, setWebglAvailable] = useState(() => {
    try {
      const context = document.createElement("canvas").getContext("webgl2");
      context?.getExtension("WEBGL_lose_context")?.loseContext();
      return Boolean(context);
    } catch {
      return false;
    }
  });
  const liveQuality = !webglAvailable ? "low" : initial.capture ? "medium" : quality;
  const demandScale = liveQuality === "low" ? 0.6 : 1;
  const scenario = useMemo(
    () => makeLiveScenario(scenarioId, demandScale, custom),
    [scenarioId, demandScale, custom],
  );

  const host = useSimHost({
    start: policiesReady,
    active,
    paused: paused || contextLost,
    speed,
    seed,
    maxVehicles: qualityPresets[liveQuality].vehicleLimit,
    scenario,
    revision,
    controllers,
    pressure: overlay === "pressure" || inspecting,
    decision: overlay === "decision" || inspecting,
    inspection: inspecting,
    onReady: setReady,
    onRestart: () => {
      setReady(false);
      setFrame(undefined);
      setFailure("");
      setPicking(false);
      history.reset();
      lastTick.current = 0;
      eventRandom.current = createRandomStreams(seed).events;
      eventId.current = 0;
      setEvents(
        scenario.events.map(({ tick, event }) => {
          const id = eventId.current++;
          history.mark(id, tick * DT, eventLabels[event.type]);
          return { id, tick, event };
        }),
      );
    },
    onMetrics: (metrics, tick, warmup) => {
      if (warmup) history.seed(warmup);
      if (tick < lastTick.current) history.rewindTo(metrics[0].elapsed);
      lastTick.current = tick;
      setFrame({ metrics, tick, readout: history.push(metrics) });
    },
    onError: (message) => {
      if (retries.current < 1) {
        retries.current++;
        setNotice("Restarting the simulation from the same seed.");
        setRevision((value) => value + 1);
      } else setFailure(message);
    },
  });

  useEffect(() => {
    if (!hasPolicyAssets) return;
    const request = new AbortController();
    void loadControllerChoices(request.signal).then((choices) => {
      if (request.signal.aborted) return;
      const get = (id: string | null) =>
        choices.find(({ controller }) => controller.id === id)?.controller;
      setControllerChoices(choices);
      setControllers([
        get(initial.requestedControllers[0]) ?? initial.controllers[0],
        get(initial.requestedControllers[1]) ??
          (initial.requestedControllers[1] === null ? get("chowk") : undefined) ??
          initial.controllers[1],
      ]);
      setPoliciesReady(true);
    });
    return () => request.abort();
  }, [initial]);

  const endTour = useCallback(() => {
    if (!tour) return;
    setTour(false);
    setWipe((current) => (current === 0 ? 50 : current));
  }, [tour]);

  function showGuide(step: number) {
    setGuide(step);
    // The comparison steps need both sides on screen and the whole corridor in view.
    if (guideSteps[step].focus === "welcome") return;
    setSingleView(false);
    setWipe((current) => (current < 20 || current > 80 ? 50 : current));
    setVehicle(undefined);
    setCamera("aerial");
  }

  function closeBriefing() {
    setBriefing(false);
    // The briefing already said what CHOWK is, so a first-time guide skips its welcome card.
    setGuide((current) => (current === 0 ? 1 : current));
  }

  function closeGuide() {
    setGuide(null);
    rememberGuideSeen();
  }

  function openResults() {
    closeGuide();
    const link = document.querySelector<HTMLAnchorElement>('.topbar-nav a[href="/results"]');
    if (link) link.click();
    else window.location.assign("/results");
  }

  function startTour() {
    retries.current = 0;
    setTour(true);
    setPaused(false);
    setSingleView(false);
    setCamera("aerial");
    setVehicle(undefined);
    setWipe(0);
    setOverlay("none");
    setSpeed(1);
    setRevision((value) => value + 1);
  }

  function addEvent(event: SimEvent | undefined) {
    if (!event) return;
    const tick = host.current?.inject(event);
    if (tick === undefined) {
      setNotice("Start a new run to add more events.");
      return;
    }
    const id = eventId.current++;
    history.mark(id, tick * DT, eventLabels[event.type]);
    setEvents((current) => [...current, { id, tick, event }]);
    const location = event.type === "surge" ? ` at ${corridor.sources[event.source].name}` : "";
    setNotice(`${eventLabels[event.type]}${location} scheduled for both simulations.`);
  }

  function chooseEvent(type: SimEvent["type"]) {
    endTour();
    if (type === "block") {
      setPicking(!picking);
      return;
    }
    const random = eventRandom.current;
    if (random) addEvent(makeEvent(type, scenario, random));
  }

  useTour({
    running: active && ready && tour && !paused && !initial.capture && !briefing,
    reducedMotion,
    onBeat: (beat) => {
      setCaption(beat.caption);
      if (
        typeof beat.camera === "number" ||
        beat.camera === "aerial" ||
        beat.camera === "street" ||
        beat.camera === "ride" ||
        beat.camera === "ambulance"
      )
        setCamera(beat.camera);
      const mode = overlays.find(({ id }) => id === beat.overlay);
      if (mode) setOverlay(mode.id);
      const rate = playingSpeeds.find((item) => item === beat.speed);
      if (rate) setSpeed(rate);
      if ((beat.event === "ambulance" || beat.event === "surge") && eventRandom.current)
        addEvent(makeEvent(beat.event, scenario, eventRandom.current));
    },
    onWipe: setWipe,
    onLoop: startTour,
  });

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReducedMotion(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!active || !tour || briefing) return;
    window.addEventListener("pointerdown", endTour, true);
    window.addEventListener("keydown", endTour, true);
    return () => {
      window.removeEventListener("pointerdown", endTour, true);
      window.removeEventListener("keydown", endTour, true);
    };
  }, [active, tour, endTour, briefing]);

  useEffect(() => {
    if (!active || !ready || briefing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.metaKey || event.ctrlKey || event.repeat) return;
      if (event.key === "Escape") {
        setGuide((current) => {
          if (current !== null) rememberGuideSeen();
          return null;
        });
        setPicking(false);
        setEditingDemand(false);
        setInspecting(false);
        setShareUrl("");
        return;
      }
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("input, select, textarea, button, [contenteditable]")
      )
        return;
      if (event.key === "[" && !singleView) setWipe((current) => Math.max(0, current - 3));
      else if (event.key === "]" && !singleView) setWipe((current) => Math.min(100, current + 3));
      else if (event.key === " ") setPaused((current) => !current);
      else if (/^[1-3]$/.test(event.key)) setSpeed(playingSpeeds[Number(event.key) - 1]);
      else if (event.key.toLowerCase() === "o")
        setOverlay(
          (current) =>
            overlays[(overlays.findIndex(({ id }) => id === current) + 1) % overlays.length].id,
        );
      else if (event.key.toLowerCase() === "t") {
        retries.current = 0;
        setTour(true);
        setPaused(false);
        setSingleView(false);
        setWipe(0);
        setRevision((value) => value + 1);
      } else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, ready, singleView, briefing]);

  function reload() {
    retries.current = 0;
    setContextLost(false);
    setGraphicsRevision((value) => value + 1);
    setRevision((value) => value + 1);
  }

  function restoreGraphics() {
    setContextLost(false);
    setGraphicsRevision((value) => value + 1);
  }

  function fallback() {
    setContextLost(false);
    setWebglAvailable(false);
  }

  function chooseCamera(choice: CameraSelection) {
    endTour();
    setVehicle(undefined);
    setCamera(choice);
    if (typeof choice === "number") setInspectedJunction(choice);
    if (choice === "ambulance" && !ambulanceOnRoad()) {
      const random = eventRandom.current;
      if (!random) return;
      addEvent(makeEvent("ambulance", scenario, random));
      setNotice("Ambulance dispatched to both sides. The camera follows it from behind.");
    }
  }

  function ambulanceOnRoad() {
    const sample = host.current?.streams[1].current;
    if (!sample) return false;
    for (let index = 0; index < sample.count * SNAPSHOT_STRIDE; index += SNAPSHOT_STRIDE)
      if (sample.positions[index + 5] === ambulanceClass) return true;
    return false;
  }

  const rival = controllerChoices.find(({ controller }) => controller.id === "chowk");

  function startChallenge() {
    const learned = rival?.controller;
    if (!learned) return;
    endTour();
    setInspecting(false);
    setTimeSpace(false);
    setEditingDemand(false);
    setControllers([learned, learned]);
    setSpeed(4);
    setPaused(false);
    setSingleView(false);
    setWipe(50);
    setCamera(CHALLENGE_JUNCTION);
    setVehicle(undefined);
    retries.current = 0;
    // Wait for the restarted pair, not the last frame of the previous run.
    setReady(false);
    setFrame(undefined);
    setChallenge("starting");
    setRevision((value) => value + 1);
  }

  useEffect(() => {
    if (!photo) return;
    const leave = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPhoto(false);
    };
    window.addEventListener("keydown", leave);
    return () => window.removeEventListener("keydown", leave);
  }, [photo]);

  const onChallengeStage = useCallback((next: ChallengeStage) => {
    setChallenge(next);
    if (next === "done") setPaused(true);
  }, []);

  function openDecision(junction: number) {
    endTour();
    setEditingDemand(false);
    setInspectedJunction(junction);
    setTimeSpace(false);
    setChallenge("off");
    setInspecting(true);
    setCamera(junction);
    setVehicle(undefined);
  }

  function selectController(side: SimulationSide, id: string) {
    endTour();
    const choice = controllerChoices.find(({ controller }) => controller.id === id)?.controller;
    if (!choice) return;
    setControllers((previous) => (side === 0 ? [choice, previous[1]] : [previous[0], choice]));
  }

  function pickRoad(x: number, z: number, screenX: number) {
    if (picking) {
      const location = roadAt(x, z);
      if (!location) {
        setNotice("Choose a carriageway between junctions.");
        return;
      }
      setPicking(false);
      addEvent(blockAt(location));
      return;
    }
    const side: SimulationSide = singleView || screenX / window.innerWidth >= wipe / 100 ? 1 : 0;
    const sample = host.current?.streams[side].current;
    if (!sample) return;
    let closest = 25;
    let id: number | undefined;
    for (let index = 0; index < sample.count * SNAPSHOT_STRIDE; index += SNAPSHOT_STRIDE) {
      const dx = sample.positions[index] - x;
      const dz = sample.positions[index + 1] - z;
      const distance = dx * dx + dz * dz;
      if (distance < closest) {
        closest = distance;
        id = sample.positions[index + 6];
      }
    }
    if (id === undefined) return;
    endTour();
    setVehicle({ id, side });
    setCamera("ride");
  }

  async function share() {
    endTour();
    const url = sessionUrl({ seed, scenario: scenarioId, controllers, overlay, camera, custom });
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Link copied.");
    } catch {
      setShareUrl(url);
    }
  }

  const onContext = useCallback((state: "lost" | "restored") => {
    setContextLost(state === "lost");
    setNotice(
      state === "lost"
        ? "The graphics device disconnected. Restoring the scene…"
        : "The 3D scene has been restored.",
    );
  }, []);

  const disabled = !ready || contextLost;
  const labelOf = (id: string) =>
    controllerChoices.find(({ controller }) => controller.id === id)?.label ?? id;
  const metrics = frame?.metrics[1];
  const scene = scenarioScenes[scenarioId];

  return (
    <div className="live-view" data-photo={photo}>
      <div className="live-intro">
        <p className="live-when">
          <span>{clockTime(scene, metrics?.elapsed ?? 0)}</span>
          {moodNames[scene.mood]}
          {scene.rain && ", raining"}
        </p>
        <h1 id="live-heading" tabIndex={-1}>
          {scene.title}
        </h1>
        <p className="live-deck">{scene.description}</p>
        <button className="briefing-open" type="button" onClick={() => setBriefing(true)}>
          What am I looking at?
        </button>
      </div>

      <section
        className="instrument"
        aria-label="Live corridor simulation"
        data-tick={frame?.tick}
        data-ready={ready}
        data-tour={tour}
        data-overlay={overlay}
      >
        <div className="scene-stage" data-picking={picking}>
          {webglAvailable ? (
            <SceneBoundary key={graphicsRevision} onRetry={restoreGraphics} onFallback={fallback}>
              <NightCorridor
                active={active}
                automatic={automatic && !initial.capture}
                camera={camera}
                onQuality={onQuality}
                host={host}
                wipe={wipe}
                singleView={singleView}
                overlay={overlay}
                events={events}
                tick={frame?.tick ?? 0}
                vehicle={vehicle}
                onRoadPick={pickRoad}
                onContext={onContext}
                ready={ready}
                paused={paused}
                quality={liveQuality}
                reducedMotion={reducedMotion || initial.capture}
                speed={speed}
                mood={scene.mood}
                rain={scene.rain}
              />
            </SceneBoundary>
          ) : (
            <TopDownCorridor
              active={active}
              host={host}
              camera={camera}
              vehicle={vehicle}
              wipe={wipe}
              singleView={singleView}
              overlay={overlay}
              events={events}
              tick={frame?.tick ?? 0}
              paused={paused}
              speed={speed}
              onRoadPick={pickRoad}
            />
          )}
          <RainOverlay
            active={active && scene.rain && webglAvailable}
            reducedMotion={reducedMotion}
          />
          {!failure && (
            <LoadingScreen done={ready} steps={liveLoadingSteps(true, policiesReady, ready)} />
          )}
          {contextLost && (
            <div className="scene-message context-recovery" role="status">
              <h2>Restoring the 3D scene</h2>
              <p>The simulation is paused while the graphics device reconnects.</p>
              <button className="control-button" type="button" onClick={restoreGraphics}>
                Reload scene
              </button>
              <button className="control-button" type="button" onClick={fallback}>
                Use top-down view
              </button>
            </div>
          )}
          {failure && (
            <div className="scene-message" role="alert">
              <h2>Simulation interrupted</h2>
              <p>{failure}</p>
              <button className="control-button" type="button" onClick={reload}>
                Restart simulation
              </button>
            </div>
          )}
          {ready && (
            <>
              {!singleView && (!tour || wipe > 0) && (
                <ComparisonWipe position={wipe} onChange={setWipe} />
              )}
              <div className="comparison-labels">
                {!singleView && (!tour || wipe > 0) && (
                  <label className="controller-chip">
                    <span className="controller-side">A</span>
                    <select
                      aria-label="Left controller"
                      value={controllers[0].id}
                      onChange={(event) => selectController(0, event.target.value)}
                    >
                      {controllerChoices.map(({ controller, label }) => (
                        <option key={controller.id} value={controller.id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="controller-chip controller-chip-right">
                  <span className="controller-side">B</span>
                  <select
                    aria-label="Right controller"
                    value={controllers[1].id}
                    onChange={(event) => selectController(1, event.target.value)}
                  >
                    {controllerChoices.map(({ controller, label }) => (
                      <option key={controller.id} value={controller.id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {frame && (
                <MetricHud
                  readout={frame.readout}
                  single={singleView || (tour && wipe === 0)}
                  clock={(elapsed) => clockTime(scene, elapsed)}
                />
              )}
              <CheckpointControl
                policy={controllers[1].policy}
                disabled={disabled}
                onPolicy={(policy) => {
                  endTour();
                  setControllers((previous) => [previous[0], { id: "chowk", policy }]);
                }}
              />
              {tour && caption && (
                <div className="tour-caption">
                  <span className="tour-caption-text">
                    {caption
                      .replace("{left}", labelOf(controllers[0].id))
                      .replace("{right}", labelOf(controllers[1].id))}
                  </span>
                  <span className="tour-caption-hint">
                    Click anywhere or press a key to take control
                  </span>
                </div>
              )}
            </>
          )}
          {editingDemand && (
            <CustomDemand
              initial={custom}
              onCancel={() => setEditingDemand(false)}
              onApply={(value) => {
                retries.current = 0;
                setCustom(value);
                setScenarioId("custom");
                setEditingDemand(false);
              }}
            />
          )}
          {inspecting && ready && (
            <DecisionPanel
              host={host}
              junction={inspectedJunction}
              controllers={controllers}
              labelOf={labelOf}
              scenario={scenario}
              onJunction={(id) => {
                setInspectedJunction(id);
                chooseCamera(id);
              }}
              onClose={() => setInspecting(false)}
            />
          )}
          {challenge !== "off" && (
            <BeatTheAI
              host={host}
              stage={challenge}
              ready={ready}
              tick={frame?.tick}
              metrics={frame?.metrics}
              rivalLabel={rival?.label ?? "CHOWK"}
              onStart={startChallenge}
              onStage={onChallengeStage}
              onExit={() => {
                setChallenge("off");
                setPaused(false);
              }}
            />
          )}
          {timeSpace && ready && (
            <TimeSpacePanel
              host={host}
              labels={[labelOf(controllers[0].id), labelOf(controllers[1].id)]}
              onClose={() => setTimeSpace(false)}
            />
          )}
          {photo && (
            <button type="button" className="photo-exit" onClick={() => setPhoto(false)}>
              Exit photo mode
            </button>
          )}
          {notice && (
            <div className="live-notice" role="status">
              {notice}
            </div>
          )}
          {shareUrl && (
            <div className="share-notice" role="dialog" aria-label="Share this simulation">
              <label>
                Share this simulation
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(event) => event.currentTarget.select()}
                />
              </label>
              <button className="control-button" type="button" onClick={() => setShareUrl("")}>
                Close
              </button>
            </div>
          )}
        </div>

        <LiveControls
          enabled={!disabled}
          scenario={scenarioId}
          onScenario={(next) => {
            endTour();
            retries.current = 0;
            setScenarioId(next);
          }}
          onCustom={() => {
            endTour();
            setInspecting(false);
            setEditingDemand(true);
          }}
          onInspect={() => openDecision(typeof camera === "number" ? camera : inspectedJunction)}
          overlay={overlay}
          onOverlay={(next) => {
            endTour();
            setOverlay(next);
          }}
          seed={seed}
          onSeed={(next) => {
            endTour();
            retries.current = 0;
            setSeed(next);
          }}
          onEvent={chooseEvent}
          picking={picking}
          onDefaultBlock={() => {
            setPicking(false);
            addEvent(defaultBlock());
          }}
          onCancelBlock={() => setPicking(false)}
          onShare={share}
        />
        <div className="instrument-controls">
          <div className="playback-controls">
            <button
              className="control-button play-button"
              type="button"
              disabled={disabled}
              onClick={() => {
                endTour();
                setPaused(!paused);
              }}
              aria-label={paused ? "Play simulation" : "Pause simulation"}
              title={paused ? "Play simulation" : "Pause simulation"}
            >
              <Icon name={paused ? "play" : "pause"} size={19} />
            </button>
            <button
              className="control-button rewind-button"
              type="button"
              disabled={disabled}
              onClick={() => {
                endTour();
                host.current?.rewind(60);
              }}
              aria-label="Rewind one minute"
              title="Return both simulations to their state a minute ago; they replay exactly"
            >
              −1 min
            </button>
            <fieldset className="speed-picker" aria-label="Playback speed">
              {playingSpeeds.map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={disabled}
                  aria-label={`${value} times speed`}
                  aria-pressed={speed === value}
                  onClick={() => {
                    endTour();
                    setSpeed(value);
                  }}
                >
                  {value}×
                </button>
              ))}
            </fieldset>
          </div>

          <fieldset className="junction-picker" aria-label="Fly to junction">
            {stations.map((station) => (
              <button
                key={station.id}
                type="button"
                className="station"
                disabled={disabled}
                aria-label={`Fly to junction ${station.name}`}
                aria-pressed={camera === station.id}
                onClick={() => chooseCamera(station.id)}
              >
                <i />
                <span>{station.name}</span>
              </button>
            ))}
          </fieldset>

          <div className="view-buttons">
            <button
              className="control-button"
              type="button"
              disabled={disabled}
              aria-pressed={singleView}
              onClick={() => {
                endTour();
                setSingleView(!singleView);
              }}
            >
              Single view
            </button>
            <details className="event-menu camera-menu">
              <summary className="control-button" aria-label="Camera modes">
                <Icon name="camera" />
              </summary>
              <div>
                <button
                  className="control-button"
                  type="button"
                  disabled={disabled}
                  aria-pressed={camera === "ride"}
                  onClick={() => chooseCamera("ride")}
                >
                  Ride along
                </button>
                <button
                  className="control-button"
                  type="button"
                  disabled={disabled}
                  aria-pressed={camera === "ambulance"}
                  onClick={() => chooseCamera("ambulance")}
                >
                  Ambulance camera
                </button>
              </div>
            </details>
            <button
              className="control-button aerial-button"
              type="button"
              disabled={disabled}
              aria-pressed={camera === "aerial"}
              onClick={() => chooseCamera("aerial")}
            >
              Aerial view
            </button>
            <button
              className="control-button decision-button"
              type="button"
              disabled={disabled}
              aria-pressed={inspecting}
              onClick={() =>
                inspecting
                  ? setInspecting(false)
                  : openDecision(typeof camera === "number" ? camera : inspectedJunction)
              }
            >
              How it decides
            </button>
            <button
              className="control-button challenge-button"
              type="button"
              disabled={disabled || !rival}
              aria-pressed={challenge !== "off"}
              onClick={() => {
                endTour();
                setInspecting(false);
                setTimeSpace(false);
                setChallenge(challenge === "off" ? "intro" : "off");
              }}
            >
              Beat the AI
            </button>
            <button
              className="control-button time-space-button"
              type="button"
              disabled={disabled}
              aria-pressed={timeSpace}
              onClick={() => {
                endTour();
                setInspecting(false);
                setChallenge("off");
                setTimeSpace(!timeSpace);
              }}
            >
              Time-space
            </button>
            <button
              className="control-button photo-button"
              type="button"
              disabled={disabled}
              onClick={() => {
                endTour();
                setInspecting(false);
                setTimeSpace(false);
                setChallenge("off");
                setPhoto(true);
              }}
              aria-label="Photo mode"
              title="Photo mode: hide the interface"
            >
              <Icon name="photo" size={17} />
            </button>
            <button
              className="control-button tour-button"
              type="button"
              disabled={disabled}
              aria-pressed={tour}
              onClick={startTour}
            >
              Tour
            </button>
            <button
              className="control-button guide-button"
              type="button"
              disabled={disabled}
              aria-pressed={guide !== null}
              aria-label="Open the getting started guide"
              title="Getting started guide"
              onClick={() => (guide === null ? showGuide(0) : closeGuide())}
            >
              ?
            </button>
          </div>
        </div>
      </section>

      {briefing && active && (
        <Briefing
          ready={ready}
          onClose={closeBriefing}
          onDecision={() => openDecision(inspectedJunction)}
        />
      )}

      {guide !== null && ready && !briefing && (
        <Onboarding
          step={guide}
          left={labelOf(controllers[0].id)}
          right={labelOf(controllers[1].id)}
          onStep={showGuide}
          onClose={closeGuide}
          onResults={openResults}
        />
      )}

      <footer className="live-footer">
        <p>
          <span>Simulation result</span>
          {demandScale < 1 && " · Reduced demand on Low"}
        </p>
        {metrics && ready && (
          <dl className="live-readouts">
            <div>
              <dt>Simulated time</dt>
              <dd>{clockTime(scene, metrics.elapsed)}</dd>
            </div>
            <div>
              <dt>Vehicles on road</dt>
              <dd>{formatCount.format(metrics.inNetwork)}</dd>
            </div>
          </dl>
        )}
        {ready && webglAvailable && <p>Drag to orbit · Scroll to zoom</p>}
      </footer>
    </div>
  );
}
