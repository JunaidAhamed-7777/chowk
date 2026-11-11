import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { cpus, platform, release } from "node:os";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { chromium } from "@playwright/test";

const [mode, ...extraArgs] = process.argv.slice(2);
if ((mode !== "soak" && mode !== "load") || extraArgs.length > 0) {
  process.stderr.write("Usage: npm run browser:budgets -- load|soak\n");
  process.exit(2);
}

const workspace = fileURLToPath(new URL("../", import.meta.url));
const root = resolve(workspace, process.env.CHOWK_BUDGET_BUILD ?? "apps/web/dist");
const out = resolve(workspace, "runs/browser-budgets");
const viewport = { width: 1440, height: 900 };
const types = new Map([
  [".html", "text/html"],
  [".js", "text/javascript"],
  [".mjs", "text/javascript"],
  [".css", "text/css"],
  [".svg", "image/svg+xml"],
  [".json", "application/json"],
  [".webp", "image/webp"],
  [".png", "image/png"],
  [".glb", "model/gltf-binary"],
  [".woff2", "font/woff2"],
  [".wasm", "application/wasm"],
  [".webm", "video/webm"],
]);
const zipped = new Set([".html", ".js", ".mjs", ".css", ".svg", ".json", ".wasm"]);
const responses = new Map();
const server = createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const file = resolve(root, path === "/" ? "index.html" : path.slice(1));
    const location = relative(root, file);
    if (location === ".." || location.startsWith(`..${sep}`) || isAbsolute(location)) {
      response.writeHead(403).end();
      return;
    }
    let stored = responses.get(file);
    if (!stored) {
      const extension = extname(file);
      const bytes = await readFile(file);
      stored = {
        mime: types.get(extension) ?? "application/octet-stream",
        bytes,
        compressed: zipped.has(extension) ? gzipSync(bytes) : null,
      };
      responses.set(file, stored);
    }
    const useGzip = stored.compressed && request.headers["accept-encoding"]?.includes("gzip");
    const payload = useGzip ? stored.compressed : stored.bytes;
    response
      .writeHead(200, {
        "Content-Type": stored.mime,
        "Content-Length": payload.length,
        "Cache-Control": "no-store",
        ...(useGzip ? { "Content-Encoding": "gzip" } : {}),
      })
      .end(payload);
  } catch {
    response.writeHead(404).end();
  }
});

async function atomic(name, data) {
  const path = resolve(out, name);
  const temp = `${path}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(temp, path);
}

async function metadata(browser, indexHtml) {
  const control = await browser.newBrowserCDPSession();
  try {
    const { gpu } = await control.send("SystemInfo.getInfo");
    const git = (...args) => execFileSync("git", args, { cwd: workspace, encoding: "utf8" }).trim();
    return {
      schema: 1,
      checkoutCommit: git("rev-parse", "HEAD"),
      buildCommit: process.env.CHOWK_BUDGET_BUILD_COMMIT
        ? git("rev-parse", "--verify", "--end-of-options", process.env.CHOWK_BUDGET_BUILD_COMMIT)
        : null,
      frontendStatus: git("status", "--porcelain", "--", "apps/web", "packages")
        .split(/\r?\n/)
        .filter(Boolean),
      indexSha256: createHash("sha256").update(indexHtml).digest("hex"),
      liveAssetFingerprints: (await readdir(resolve(root, "assets")))
        .filter((name) =>
          /^(?:index-|LiveView-|livePolicies-|sim\.worker-).+\.(?:js|css)$/.test(name),
        )
        .sort(),
      hardware: {
        cpu: cpus()[0]?.model.trim(),
        gpu: gpu.auxAttributes?.glRenderer ?? gpu.devices[0]?.deviceString,
        os: `${platform()} ${release()}`,
        browser: `Chrome ${browser.version()}`,
        viewport,
      },
    };
  } finally {
    await control.detach();
  }
}

async function soak(browser, origin, details) {
  const context = await browser.newContext({ viewport });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(origin);
    await page.locator(".simulation-status[data-ready=true]").waitFor({ timeout: 45000 });
    const session = await context.newCDPSession(page);
    await session.send("HeapProfiler.enable");
    const samples = [];
    const started = performance.now();
    for (let minute = 0; minute <= 10; minute++) {
      const until = started + minute * 60_000 - performance.now();
      if (until > 0) await delay(until);
      const state = await page.evaluate(() => ({
        tick: Number(document.querySelector(".instrument")?.dataset.tick),
        tour: document.querySelector(".instrument")?.dataset.tour,
        overlay: document.querySelector(".instrument")?.dataset.overlay,
        quality: document.querySelector("[aria-label='Render quality']")?.value,
      }));
      await session.send("HeapProfiler.collectGarbage");
      const heap = await session.send("Runtime.getHeapUsage");
      const dom = await session.send("Memory.getDOMCounters");
      const sample = {
        minute,
        elapsedSeconds: (performance.now() - started) / 1000,
        pageWorkers: page.workers().length,
        ...state,
        heap,
        dom,
      };
      samples.push(sample);
      const stable = samples.slice(3).map(({ heap }) => heap.usedSize);
      const plateau =
        stable.length > 1
          ? {
              firstMinute: 3,
              minBytes: Math.min(...stable),
              maxBytes: Math.max(...stable),
              rangeBytes: Math.max(...stable) - Math.min(...stable),
              firstBytes: stable[0],
              lastBytes: stable.at(-1),
              relativeChange: stable.at(-1) / stable[0] - 1,
            }
          : null;
      await atomic("memory.json", {
        ...details,
        method:
          "One unattended default-quality desktop Live tab with autoplay. Forced full renderer GC immediately before each minute sample. Renderer V8 heap, associated storage and DOM counters. Dedicated-worker count tracked separately. Worker heaps and GPU allocations are outside this measurement.",
        complete: minute === 10,
        plateau,
        samples,
        errors,
      });
      process.stdout.write(
        `Minute ${minute}: ${(heap.usedSize / 1048576).toFixed(3)} MiB after GC; ${sample.pageWorkers} workers\n`,
      );
    }
    if (errors.length) throw new Error("Live page errors are recorded in memory.json");
  } finally {
    await context.close();
  }
}

function observeColdLoad() {
  const timings = {
    posterPaintMs: null,
    bootPosterPaintMs: null,
    scenePosterPaintMs: null,
    readyMs: null,
    fadeCompleteMs: null,
    posterPaintSource: null,
  };
  window.__chowkColdTimings = timings;
  const sceneObserver = new MutationObserver(() => {
    const stage = document.querySelector(".scene-stage");
    if (!stage) return;
    if (!stage.hasAttribute("elementtiming")) stage.setAttribute("elementtiming", "chowk-poster");
    sceneObserver.disconnect();
  });
  sceneObserver.observe(document, { childList: true, subtree: true });
  for (const type of ["element", "largest-contentful-paint"]) {
    if (!PerformanceObserver.supportedEntryTypes.includes(type)) continue;
    new PerformanceObserver((list) => {
      for (const item of list.getEntries()) {
        const boot = item.identifier === "chowk-boot-poster" || item.element?.id === "boot-poster";
        const scene = item.identifier === "chowk-poster";
        if (item.renderTime <= 0 || (!boot && !scene && !item.url?.endsWith("/poster.webp")))
          continue;
        if (boot) timings.bootPosterPaintMs = item.renderTime;
        if (scene) timings.scenePosterPaintMs = item.renderTime;
        if (timings.posterPaintMs === null || item.renderTime < timings.posterPaintMs) {
          timings.posterPaintMs = item.renderTime;
          const identifier = item.identifier || (boot ? "chowk-boot-poster" : "");
          timings.posterPaintSource = identifier ? `${type}:${identifier}` : type;
        }
      }
    }).observe({ type, buffered: true });
  }
  const sample = () => {
    const canvas = document.querySelector(".scene-stage canvas");
    if (canvas && document.querySelector(".simulation-status[data-ready=true]")) {
      const opacity = Number(getComputedStyle(canvas).opacity);
      if (opacity > 0.01 && timings.readyMs === null) timings.readyMs = performance.now();
      if (opacity >= 0.95) timings.fadeCompleteMs = performance.now();
    }
    if (timings.fadeCompleteMs === null) requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
}

async function load(browser, origin, details) {
  const profiles = [
    { name: "broadband", downloadMbps: 10, uploadMbps: 5, latencyMs: 40 },
    { name: "slow", downloadMbps: 2, uploadMbps: 1, latencyMs: 150 },
  ];
  const runs = [];
  for (const profile of profiles) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const context = await browser.newContext({ viewport });
      try {
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const session = await context.newCDPSession(page);
        await session.send("Network.enable");
        await session.send("Network.setCacheDisabled", { cacheDisabled: true });
        await session.send("Network.emulateNetworkConditions", {
          offline: false,
          latency: profile.latencyMs,
          downloadThroughput: profile.downloadMbps * 125_000,
          uploadThroughput: profile.uploadMbps * 125_000,
        });
        await page.addInitScript(observeColdLoad);
        let failure = null;
        try {
          await page.goto(origin, { waitUntil: "commit" });
          await page.waitForFunction(
            () => Number.isFinite(window.__chowkColdTimings?.fadeCompleteMs),
            null,
            { timeout: 15000 },
          );
        } catch (error) {
          failure = error.message;
        }
        const result = await page.evaluate(() => ({
          ...window.__chowkColdTimings,
          firstContentfulPaintMs:
            performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null,
        }));
        runs.push({ profile: profile.name, attempt, ...result, errors, failure });
        await atomic("load.json", {
          ...details,
          method:
            "Fresh browser context for each trial. Chrome page-target CDP cache disabling and network emulation. Local gzip-enabled HTTP/1.1 serving the production build. Poster paint from image-specific Element Timing or LCP. Ready is the first visible canvas frame after worker warm-up.",
          profiles,
          runs,
        });
        process.stdout.write(
          `${profile.name} trial ${attempt}: poster ${result.posterPaintMs ?? "unavailable"} ms, live ${result.readyMs} ms, fade ${result.fadeCompleteMs} ms\n`,
        );
      } finally {
        await context.close();
      }
    }
  }
  if (runs.some((run) => run.failure || run.errors.length || !Number.isFinite(run.posterPaintMs))) {
    throw new Error("Incomplete cold load trials are recorded in load.json");
  }
}

const indexHtml = await readFile(resolve(root, "index.html")).catch(() => {
  throw new Error(`No production build at ${root}. Run npm run build first.`);
});
await mkdir(out, { recursive: true });
server.listen(0, "127.0.0.1");
await once(server, "listening");
try {
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const details = await metadata(browser, indexHtml);
    await (mode === "soak" ? soak : load)(browser, origin, details);
  } finally {
    await browser.close();
  }
} finally {
  await new Promise((finish) => server.close(finish));
}
