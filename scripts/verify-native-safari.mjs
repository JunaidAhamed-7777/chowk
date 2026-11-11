import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { preview } from "vite";

const host = "127.0.0.1";
const appPort = 4173;
const driverPort = 4444;
const origin = `http://${host}:${appPort}`;
const elementKey = "element-6066-11e4-a52e-4f735466cecf";

async function request(method, path, data) {
  const response = await fetch(`http://${host}:${driverPort}${path}`, {
    method,
    ...(data !== undefined && {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.json();
  if (!response.ok || body.value?.error)
    throw new Error(`${method} ${path}: ${body.value?.message ?? response.status}`);
  return body.value;
}

async function waitFor(label, read, accept, timeout = 30_000) {
  const deadline = performance.now() + timeout;
  let value;
  do {
    value = await read();
    if (accept(value)) return value;
    await delay(200);
  } while (performance.now() < deadline);
  throw new Error(`Timed out waiting for ${label}. Last observation: ${JSON.stringify(value)}`);
}

const liveState = `
  const instrument = document.querySelector('.instrument');
  const canvas = document.querySelector('.scene-canvas canvas');
  const gl = canvas?.getContext('webgl2');
  const debug = gl?.getExtension('WEBGL_debug_renderer_info');
  return {
    ready: Boolean(document.querySelector('.simulation-status[data-ready=true]')),
    tour: instrument?.dataset.tour === 'true',
    tick: Number(instrument?.dataset.tick ?? 0),
    caption: document.querySelector('.tour-caption-text')?.textContent,
    right: document.querySelector('select[aria-label="Right controller"]')?.value,
    renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER),
    drawing: Boolean(gl && !gl.isContextLost() && gl.getParameter(gl.CURRENT_PROGRAM)),
    fallback: Boolean(document.querySelector('.top-down-corridor')),
  };
`;

const server = await preview({
  root: fileURLToPath(new URL("../apps/web/", import.meta.url)),
  configFile: false,
  preview: { host, port: appPort, strictPort: true },
});
const driver = spawn("/usr/bin/safaridriver", ["-p", String(driverPort)], { stdio: "inherit" });
let startupError;
driver.once("error", (error) => {
  startupError = error;
});
let session;
try {
  await waitFor(
    "Safari WebDriver to listen",
    async () => {
      if (startupError) throw startupError;
      if (driver.exitCode !== null) throw new Error(`safaridriver exited with ${driver.exitCode}`);
      return request("GET", "/status").catch((error) => ({ error: error.message }));
    },
    (status) => status?.ready === true,
  );
  const created = await request("POST", "/session", {
    capabilities: { alwaysMatch: { browserName: "safari" } },
  });
  assert.ok(created.sessionId, "Safari WebDriver did not return a session ID");
  session = `/session/${created.sessionId}`;
  assert.equal(created.capabilities.browserName.toLowerCase(), "safari");
  const execute = (script) => request("POST", `${session}/execute/sync`, { script, args: [] });
  const navigate = (path) => request("POST", `${session}/url`, { url: `${origin}${path}` });

  await navigate("/");
  const first = await waitFor(
    "default autoplay and a WebGL2 frame",
    () => execute(liveState),
    ({ ready, tour, caption, tick, drawing }) => ready && tour && caption && tick > 0 && drawing,
  );
  assert.equal(first.fallback, false);
  assert.equal(first.right, "chowk");
  const advancing = await waitFor(
    "advancing live simulation",
    () => execute(liveState),
    ({ drawing, tick, tour }) => drawing && tour && tick > first.tick,
  );
  console.log(
    `Native Safari ${created.capabilities.browserVersion}: ${first.renderer}. Autoplay advanced from tick ${first.tick} to ${advancing.tick}.`,
  );

  for (const [path, heading, content] of [
    ["/method", "How CHOWK works", ".method-content"],
    ["/limits", "Scope and limitations", ".information-list"],
    ["/results", "Benchmark results", ".results-headline"],
  ]) {
    await navigate(path);
    await waitFor(
      `direct ${path} route`,
      () =>
        execute(`return document.querySelector(${JSON.stringify(content)}) &&
          document.querySelector('#information-heading')?.textContent`),
      (value) => value === heading,
    );
    console.log(`${path} rendered ${heading}.`);
  }
  await waitFor(
    "published Results and enabled replay",
    () =>
      execute(`return Boolean(document.querySelector('.results-headline')?.textContent &&
        document.querySelector('.repro-panel button:not([disabled])'))`),
    Boolean,
  );

  if (process.env.CHOWK_SAFARI_VERIFY_REPLAY === "1") {
    const started = performance.now();
    const button = await request("POST", `${session}/element`, {
      using: "css selector",
      value: ".repro-panel button:not([disabled])",
    });
    await request("POST", `${session}/element/${button[elementKey]}/click`, {});
    await waitFor(
      "exact benchmark replay",
      () => execute("return document.querySelector('.repro-panel')?.innerText"),
      (text) => text?.includes("Your browser reproduced our published numbers exactly."),
      120_000,
    );
    const episodes = await execute(
      "return document.querySelectorAll('.repro-panel tbody .repro-match').length",
    );
    assert.equal(episodes, 9);
    console.log(
      `Native Safari replay matched in ${((performance.now() - started) / 1000).toFixed(1)}s (${episodes} exact rows).`,
    );
  }
} finally {
  if (session) await request("DELETE", session).catch((error) => console.error(error.message));
  driver.kill();
  await server.close();
}
