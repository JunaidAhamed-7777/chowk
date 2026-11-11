import type { MouseEvent } from "react";
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Quality, QualityMode } from "./scene/sceneSettings";
import { qualityPresets } from "./scene/sceneSettings";
import { setTrafficSoundEnabled } from "./sim/trafficAudio";
import { Icon } from "./ui/Icon";
import type { InformationRoute } from "./views/InformationView";
import { InformationView } from "./views/InformationView";
import "./styles.css";

const LiveView = lazy(() => import("./views/LiveView"));
const repository = "https://github.com/JunaidAhamed-7777/chowk";
const routes = [
  { path: "/", label: "Live" },
  { path: "/results", label: "Results" },
  { path: "/method", label: "Method" },
  { path: "/limits", label: "Limits" },
] as const;

type Route = (typeof routes)[number]["path"];

function readPath() {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  return routes.find((route) => route.path === path)?.path;
}

function readQualityMode(): QualityMode {
  try {
    const value = window.localStorage.getItem("chowk-quality");
    if (value === "low" || value === "medium" || value === "high") return value;
  } catch {
    // Storage can be unavailable in private or restricted browser sessions.
  }
  return "auto";
}

export default function App() {
  const [route, setRoute] = useState(readPath);
  const [visitedLive, setVisitedLive] = useState(() => readPath() === "/");
  const [qualityMode, setQualityMode] = useState(readQualityMode);
  const [automaticQuality, setAutomaticQuality] = useState<Quality>("medium");
  const [sound, setSound] = useState(false);
  const [changingSound, setChangingSound] = useState(false);
  const focusOnNavigation = useRef(false);
  const quality = qualityMode === "auto" ? automaticQuality : qualityMode;

  useEffect(() => {
    const handleHistory = () => {
      const next = readPath();
      if (next === "/") setVisitedLive(true);
      setRoute(next);
    };
    window.addEventListener("popstate", handleHistory);
    return () => window.removeEventListener("popstate", handleHistory);
  }, []);

  useEffect(() => {
    const label = routes.find((entry) => entry.path === route)?.label ?? "Page unavailable";
    document.title = `${label} · CHOWK`;
  }, [route]);

  useLayoutEffect(() => {
    if (!focusOnNavigation.current) return;
    focusOnNavigation.current = false;
    const heading = document.getElementById(route === "/" ? "live-heading" : "information-heading");
    (heading ?? document.getElementById("main"))?.focus({ preventScroll: true });
  }, [route]);

  function navigate(event: MouseEvent<HTMLAnchorElement>, next: Route) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    if (route === next) return;
    window.history.pushState(null, "", next);
    focusOnNavigation.current = true;
    if (next === "/") setVisitedLive(true);
    setRoute(next);
    window.scrollTo(0, 0);
  }

  function updateQuality(mode: QualityMode) {
    setQualityMode(mode);
    try {
      window.localStorage.setItem("chowk-quality", mode);
    } catch {
      // The selected tier remains active for this session.
    }
  }

  async function toggleSound() {
    setChangingSound(true);
    setSound(await setTrafficSoundEnabled(!sound));
    setChangingSound(false);
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <a
            className="wordmark"
            href="/"
            onClick={(event) => navigate(event, "/")}
            aria-label="CHOWK home"
          >
            <span className="brand-mark" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span>
              CHOWK<span className="wordmark-period">.</span>
            </span>
          </a>
          <nav className="topbar-nav" aria-label="Main navigation">
            {routes.map((entry) => (
              <a
                key={entry.path}
                href={entry.path}
                aria-current={route === entry.path ? "page" : undefined}
                onClick={(event) => navigate(event, entry.path)}
              >
                {entry.label}
              </a>
            ))}
          </nav>
          <div className="topbar-tools">
            <label className="quality-control">
              <Icon name="layers" />
              <select
                aria-label="Render quality"
                value={qualityMode}
                onChange={(event) => updateQuality(event.target.value as QualityMode)}
              >
                <option value="auto">Auto · {qualityPresets[automaticQuality].label}</option>
                {Object.entries(qualityPresets).map(([value, { label }]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <Icon name="chevron" size={13} />
            </label>
            {route === "/" && (
              <button
                className="control-button sound-toggle"
                type="button"
                aria-label="Simulation sound"
                title={sound ? "Mute simulation sound" : "Enable simulation sound"}
                aria-pressed={sound}
                disabled={changingSound}
                onClick={toggleSound}
              >
                <Icon name={sound ? "sound" : "muted"} />
              </button>
            )}
            <a className="repo-link" href={repository} target="_blank" rel="noreferrer">
              <Icon name="github" size={18} />
              GitHub
              <Icon name="arrow" size={12} />
            </a>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        {visitedLive && (
          <section className="live-surface" hidden={route !== "/"}>
            <Suspense
              fallback={
                <div className="loading-route" role="status">
                  Loading the corridor…
                </div>
              }
            >
              <LiveView
                active={route === "/"}
                quality={quality}
                automatic={qualityMode === "auto"}
                onQuality={setAutomaticQuality}
                sound={sound}
              />
            </Suspense>
          </section>
        )}
        {route && route !== "/" && <InformationView route={route satisfies InformationRoute} />}
        {!route && (
          <article className="information">
            <h1 id="information-heading" tabIndex={-1}>
              This page is unavailable.
            </h1>
            <a href="/" onClick={(event) => navigate(event, "/")}>
              Return to the corridor
            </a>
          </article>
        )}
      </main>
    </>
  );
}
