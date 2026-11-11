import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./poster.css";

const root = document.getElementById("root");
if (!root) throw new Error("CHOWK is missing its application root.");
const TrafficDebug =
  import.meta.env.DEV && location.pathname === "/debug"
    ? lazy(() => import("./debug/TrafficDebug"))
    : undefined;

createRoot(root).render(
  <StrictMode>
    {TrafficDebug ? (
      <Suspense fallback={<p role="status">Loading the debug view…</p>}>
        <TrafficDebug />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
