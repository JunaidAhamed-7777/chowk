import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { cpus, platform, release } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { chromium } from "@playwright/test";
import { preview } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const app = join(root, "apps/web");
const work = join(root, "runs/capture");
const media = join(root, "assets/demo");
const demoSource = join(work, "demo-source.webm");
const demoTiming = join(work, "demo-timing.json");
const origin = "http://127.0.0.1:4185";
const viewport = { width: 1440, height: 900 };
const videoViewport = { width: 1920, height: 1080 };
const mode = process.argv[2] ?? "stills";
if (!["stills", "video", "edit", "clips", "measure"].includes(mode))
  throw new Error(`Unknown capture mode ${mode}`);
mkdirSync(work, { recursive: true });
mkdirSync(media, { recursive: true });

function ffmpeg(args) {
  const result = spawnSync("ffmpeg", ["-v", "error", "-y", ...args], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`ffmpeg exited with status ${result.status}`);
}

function captureFont() {
  if (platform() !== "win32") return "font=Arial";
  const windows = (process.env.WINDIR ?? "C:/Windows").replaceAll("\\", "/");
  const fontDirectory = `${windows}/Fonts`;
  if (!process.env.FONTCONFIG_FILE) {
    const config = join(work, "fonts.conf");
    const escapeXml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
    const cache = join(work, "font-cache").replaceAll("\\", "/");
    writeFileSync(
      config,
      `<?xml version="1.0"?>\n<fontconfig><dir>${escapeXml(fontDirectory)}</dir><cachedir>${escapeXml(cache)}</cachedir></fontconfig>\n`,
    );
    process.env.FONTCONFIG_FILE = config;
  }
  const file = `${fontDirectory}/arial.ttf`.replaceAll(":", "\\:");
  return `fontfile='${file}'`;
}

function burnInCaptions() {
  const source = readFileSync(join(media, "captions.vtt"), "utf8");
  const time = (value) => value.replace(/^0/, "").replace(/\.(\d{2})\d$/, ".$1");
  const events = source
    .trim()
    .split(/\r?\n\r?\n/)
    .slice(1)
    .map((cue) => {
      const [timing, ...lines] = cue.split(/\r?\n/);
      const [start, end] = timing.split(" --> ");
      const position = start >= "00:01:27.000" ? 737 : 235;
      return `Dialogue: 0,${time(start)},${time(end)},Caption,,0,0,0,,{\\an8\\pos(960,${position})}${lines.join("\\N")}`;
    });
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Arial,37,&H00F8F1EA,&H00F8F1EA,&HBA130A06,&HBA130A06,0,0,0,0,100,100,0,0,3,10,0,8,360,360,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  writeFileSync(join(work, "demo-captions.ass"), `${header}${events.join("\n")}\n`);
}

function clips() {
  const demo = join(media, "chowk-demo.mp4");
  const scenes = [
    ["hero", 6.4, 4.25, 800],
    ["wipe", 6.8, 3.8, 520],
    ["surge", 52.5, 3.8, 520],
    ["ambulance", 41, 3.8, 520],
    ["decisions", 30.5, 3.8, 520],
    ["reproduce", 77.5, 4, 520],
  ];
  for (const [name, start, duration, width] of scenes) {
    ffmpeg([
      "-ss",
      `${start}`,
      "-i",
      demo,
      "-t",
      `${duration}`,
      "-filter_complex",
      `fps=9,scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3`,
      "-loop",
      "0",
      join(media, `${name}.gif`),
    ]);
  }
  if (statSync(join(media, "hero.gif")).size > 8_000_000) throw new Error("Hero GIF exceeds 8 MB");
  ffmpeg([
    "-ss",
    "21",
    "-i",
    demo,
    "-frames:v",
    "1",
    "-vf",
    "scale=1440:-2",
    "-c:v",
    "libwebp",
    "-quality",
    "88",
    join(media, "filtering.webp"),
  ]);
}

async function pageFor(browser, tier, size = viewport) {
  const context = await browser.newContext({ viewport: size });
  await context.addInitScript((quality) => localStorage.setItem("chowk-quality", quality), tier);
  const page = await context.newPage();
  page.on("pageerror", (error) => process.stderr.write(`${error.message}\n`));
  return { context, page };
}

async function waitForScene(page) {
  await page.locator(".simulation-status[data-ready=true]").waitFor({ timeout: 30_000 });
  await page.locator(".scene-stage canvas").waitFor();
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

async function stills(browser) {
  const { context, page } = await pageFor(browser, "medium");
  try {
    await page.goto(`${origin}/?capture=hero`);
    await waitForScene(page);
    await page.waitForLoadState("networkidle");
    const canvas = join(work, "canvas.png");
    await page.locator(".scene-stage canvas").screenshot({ path: canvas });
    ffmpeg([
      "-i",
      canvas,
      "-vf",
      "scale=1280:-2",
      "-c:v",
      "libwebp",
      "-quality",
      "81",
      join(app, "public/poster.webp"),
    ]);
    await page.screenshot({ path: join(work, "corridor.png") });
    await page.goto(`${origin}/?capture=hero&camera=j3&overlay=pressure`);
    await waitForScene(page);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: join(work, "pressure.png") });
    for (const name of ["corridor", "pressure"]) {
      ffmpeg([
        "-i",
        join(work, `${name}.png`),
        "-c:v",
        "libwebp",
        "-quality",
        "88",
        join(media, `${name}.webp`),
      ]);
    }
  } finally {
    await context.close();
  }
}

async function video(browser) {
  const { context, page } = await pageFor(browser, "high", videoViewport);
  writeFileSync(demoSource, "");
  await page.exposeFunction("saveCaptureChunk", (base64) => {
    appendFileSync(demoSource, Buffer.from(base64, "base64"));
  });
  let tourStart = 0;
  let proofStart = 0;
  let proofEnd = 0;
  let recorded = 0;
  try {
    await page.goto(`${origin}/?tour=off`);
    await waitForScene(page);
    await page.evaluate(async () => {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1920, height: 1080, frameRate: { ideal: 60 } },
        audio: false,
        preferCurrentTab: true,
      });
      const track = stream.getVideoTracks()[0];
      const { width, height, frameRate, displaySurface } = track.getSettings();
      if (width !== 1920 || height !== 1080 || frameRate !== 60 || displaySurface !== "browser") {
        track.stop();
        throw new Error("Expected a 1080p60 capture of the CHOWK browser tab");
      }
      track.contentHint = "motion";
      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 16_000_000,
      });
      let saved = Promise.resolve();
      recorder.addEventListener("dataavailable", ({ data }) => {
        if (!data.size) return;
        saved = saved.then(async () => {
          const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(",", 2)[1]);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(data);
          });
          await window.saveCaptureChunk(base64);
        });
      });
      window.finishDemoCapture = () =>
        new Promise((resolve, reject) => {
          recorder.addEventListener(
            "stop",
            () => {
              track.stop();
              saved.then(resolve, reject);
            },
            { once: true },
          );
          recorder.stop();
        });
      recorder.start(1_000);
    });
    const start = performance.now();
    const elapsed = () => (performance.now() - start) / 1000;
    await page.keyboard.press("t");
    await page.getByText("A five-junction corridor, simulated live in your browser.").waitFor();
    tourStart = elapsed();
    await page.getByText("Compare person-delay, then reproduce the benchmark in Results.").waitFor({
      timeout: 90_000,
    });
    await page.getByRole("button", { name: "Block a lane", exact: true }).click();
    await page.mouse.click(1102, 506);
    await page.getByText("Lane block scheduled for both simulations.").waitFor();
    await page.waitForTimeout(4200);
    proofStart = elapsed();
    await page.getByRole("link", { name: "Results", exact: true }).click();
    await page.getByRole("button", { name: "Run benchmark", exact: true }).waitFor();
    await page.screenshot({ path: join(work, "results.png") });
    await page.getByRole("button", { name: "Run benchmark", exact: true }).click();
    await page
      .getByText("Your browser reproduced our published numbers exactly.")
      .waitFor({ timeout: 120_000 });
    await page.waitForTimeout(4500);
    proofEnd = elapsed();
    await page.getByRole("link", { name: "Live", exact: true }).click();
    await page.getByText("Watch it learn", { exact: true }).click();
    const slider = page.getByRole("slider", { name: "Policy checkpoint" });
    await slider.press("Home");
    await page.getByText("Generation 0 is active.").waitFor();
    await page.waitForTimeout(1500);
    await slider.press("End");
    await page.getByText(/Generation [1-9]\d* is active\./).waitFor();
    await page.waitForTimeout(2500);
    recorded = elapsed();
    await page.evaluate(() => window.finishDemoCapture());
    writeFileSync(demoTiming, JSON.stringify({ tourStart, proofStart, proofEnd, recorded }));
  } finally {
    await context.close();
  }
}

function edit() {
  const { tourStart, proofStart, proofEnd, recorded } = JSON.parse(
    readFileSync(demoTiming, "utf8"),
  );
  const proofScale = 17 / (proofEnd - proofStart);
  const learningScale = 5 / (recorded - proofEnd);
  const font = captureFont();
  burnInCaptions();
  const title = [
    "drawbox=x=0:y=0:w=iw:h=ih:color=0x060a13:t=fill",
    `drawtext=text=CHOWK:${font}:fontsize=96:fontcolor=0x3df2b4:x=(w-tw)/2:y=430`,
    `drawtext=text=Lane-free traffic simulation:${font}:fontsize=32:fontcolor=0xeaf1f8:x=(w-tw)/2:y=556`,
    `drawtext=text=github.com/JunaidAhamed-7777/chowk:${font}:fontsize=24:fontcolor=0xa2b3c9:x=(w-tw)/2:y=618`,
  ].map((filter) => `${filter}:enable='gte(t,87)'`);
  const vf = [
    `[0:v]trim=start=${tourStart}:end=${proofStart},setpts=(PTS-STARTPTS)*${65 / (proofStart - tourStart)},fade=t=in:d=0.6[live]`,
    `[0:v]trim=start=${proofStart}:end=${proofEnd},setpts=(PTS-STARTPTS)*${proofScale}[proof]`,
    `[0:v]trim=start=${proofEnd}:end=${recorded},setpts=(PTS-STARTPTS)*${learningScale}[learning]`,
    "[live][proof][learning]concat=n=3:v=1:a=0,tpad=stop_mode=clone:stop_duration=8,fps=60,format=yuv420p[edit]",
    `[edit]${[...title, "ass=runs/capture/demo-captions.ass"].join(",")}[out]`,
  ].join(";");
  ffmpeg([
    "-i",
    demoSource,
    "-filter_complex",
    vf,
    "-map",
    "[out]",
    "-t",
    "90",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-threads",
    "4",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    join(media, "chowk-demo.mp4"),
  ]);
  ffmpeg([
    "-i",
    join(work, "results.png"),
    "-vf",
    "scale=1440:-2",
    "-c:v",
    "libwebp",
    "-quality",
    "88",
    join(media, "results.webp"),
  ]);
  clips();
}

function median(sorted) {
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function readMeasurement(name) {
  const file = join(root, "runs", name);
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : undefined;
}

function supplementalMeasurements(existing) {
  const cold = readMeasurement("browser-budgets/load.json");
  const soak = readMeasurement("browser-budgets/memory.json");
  const firefox = readMeasurement("browser-matrix/firefox-repro.json");
  const labels = { chromium: "Chromium", firefox: "Firefox", webkit: "WebKit" };
  const wslReplay =
    firefox?.liveScene && firefox.errors.length === 0
      ? {
          version: firefox.firefox,
          environment: firefox.platform,
          wallSeconds: firefox.seconds,
          episodes: firefox.episodes,
        }
      : undefined;
  const reproduction = Object.entries(labels).flatMap(([key, engine]) => {
    const replay =
      readMeasurement(`reproduction-${key}.json`) ??
      (key === "firefox" ? wslReplay : undefined) ??
      existing.reproduction?.find((row) => row.engine === engine);
    return replay?.episodes === 9 ? [{ ...replay, engine }] : [];
  });
  const shapedLoads = cold?.profiles.flatMap(({ name, downloadMbps, latencyMs }) => {
    const rows = cold.runs.filter(
      (row) =>
        row.profile === name &&
        !row.failure &&
        row.errors.length === 0 &&
        Number.isFinite(row.readyMs) &&
        Number.isFinite(row.posterPaintMs),
    );
    if (!rows.length) return [];
    const sampleMedian = (key) => median(rows.map((row) => row[key]).sort((a, b) => a - b));
    return [
      {
        label: name === "broadband" ? "Broadband" : "Slow connection",
        downloadMbps,
        latencyMs,
        samples: rows.length,
        posterMs: sampleMedian("posterPaintMs"),
        interactiveMs: sampleMedian("readyMs"),
      },
    ];
  });
  const memory =
    soak?.complete && soak.plateau && soak.errors.length === 0
      ? {
          minutes: soak.samples.at(-1).minute,
          firstBytes: soak.plateau.firstBytes,
          lastBytes: soak.plateau.lastBytes,
          plateauRangeBytes: soak.plateau.rangeBytes,
          workers: soak.samples.at(-1).pageWorkers,
        }
      : existing.memory;
  if (cold && soak?.complete) {
    const evidence = { load: cold, memory: soak, reproduction };
    writeFileSync(
      join(root, "results", "browser-budgets.json"),
      `${JSON.stringify(evidence, null, 2)}\n`,
    );
  }
  const directory = join(app, "public", "models");
  const models = readdirSync(directory).filter((name) => name.endsWith(".glb"));
  return {
    shapedLoads: shapedLoads?.length ? shapedLoads : existing.shapedLoads,
    memory,
    reproduction,
    models: {
      count: models.length,
      bytes: models.reduce((total, name) => total + statSync(join(directory, name)).size, 0),
    },
  };
}

function adapterArgs() {
  const luid = process.env.CHOWK_CAPTURE_GPU_LUID;
  if (!luid) return [];
  if (platform() !== "win32" || !/^-?\d+,\d+$/.test(luid)) {
    throw new Error("CHOWK_CAPTURE_GPU_LUID requires a Windows adapter LUID as high,low");
  }
  return ["--use-angle=d3d11", `--use-adapter-luid=${luid}`];
}

async function measure(browser) {
  const rendering = [];
  let gpu;
  let load;
  for (const tier of ["low", "medium", "high"]) {
    const args = tier === "high" ? adapterArgs() : [];
    const tierBrowser = args.length ? await chromium.launch({ channel: "chrome", args }) : browser;
    const { context, page } = await pageFor(tierBrowser, tier);
    try {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      await page.goto(`${origin}/?tour=off`);
      await waitForScene(page);
      const tierGpu = await page.evaluate(() => {
        const context = document.querySelector(".scene-stage canvas")?.getContext("webgl2");
        const extension = context?.getExtension("WEBGL_debug_renderer_info");
        return context && extension
          ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL)
          : undefined;
      });
      if (tier === "medium") {
        const data = await page.evaluate(() => {
          const entries = [
            ...performance.getEntriesByType("navigation"),
            ...performance.getEntriesByType("resource"),
          ];
          return {
            interactiveMs: performance.now(),
            transferBytes: entries.reduce((sum, entry) => sum + entry.transferSize, 0),
            files: entries.map(({ name }) => new URL(name).pathname),
          };
        });
        gpu = tierGpu;
        const initialJavaScriptGzipBytes = [...new Set(data.files)]
          .filter((name) => /^\/assets\/[\w.-]+\.js$/.test(name))
          .reduce(
            (sum, name) => sum + gzipSync(readFileSync(join(app, "dist", name.slice(1)))).length,
            0,
          );
        load = {
          interactiveMs: data.interactiveMs,
          transferBytes: data.transferBytes,
          initialJavaScriptGzipBytes,
        };
      }
      await page.waitForTimeout(850);
      const intervals = await page.evaluate(
        () =>
          new Promise((resolve) => {
            const deltas = [];
            let previous;
            const deadline = performance.now() + 7000;
            const sample = (time) => {
              if (previous !== undefined) deltas.push(time - previous);
              previous = time;
              if (time < deadline) requestAnimationFrame(sample);
              else resolve(deltas);
            };
            requestAnimationFrame(sample);
          }),
      );
      intervals.sort((a, b) => a - b);
      if (intervals.length < 2) throw new Error(`No usable frame sample at ${tier} quality`);
      const slowest = intervals.slice(-Math.max(1, Math.ceil(intervals.length / 100)));
      const medianFps = 1000 / median(intervals);
      const onePercentLowFps =
        (1000 * slowest.length) / slowest.reduce((sum, interval) => sum + interval, 0);
      rendering.push({ tier, medianFps, onePercentLowFps, gpu: tierGpu });
      process.stdout.write(
        `${tier}: ${medianFps.toFixed(1)} median FPS, ${onePercentLowFps.toFixed(1)} 1% low\n`,
      );
    } finally {
      await context.close();
      if (tierBrowser !== browser) await tierBrowser.close();
    }
  }
  const file = join(root, "results/engineering.json");
  const existing = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const determinism = readMeasurement("determinism.json") ?? existing.determinism;
  const report = readMeasurement("vitest-report.json");
  const tests = report
    ? { passed: report.numPassedTests, failed: report.numFailedTests }
    : existing.tests;
  let policyMicroseconds = existing.policyMicroseconds;
  const timing = readMeasurement("policy-inference.json");
  if (timing) {
    const policy = readFileSync(join(app, "public/policies/chowk.json"));
    const hash = createHash("sha256").update(policy).digest("hex");
    if (timing.policyHash !== hash)
      throw new Error("Measure inference again for the exported policy");
    policyMicroseconds = timing.policyMicroseconds;
  }
  const hardware = {
    cpu: cpus()[0]?.model.trim() ?? "Unknown CPU",
    gpu,
    os: `${platform()} ${release()}`,
    runtime: `Node ${process.versions.node}`,
  };
  writeFileSync(
    file,
    `${JSON.stringify({ ...existing, ...supplementalMeasurements(existing), hardware, rendering, load, determinism, tests, policyMicroseconds }, null, 2)}\n`,
  );
}

if (mode === "clips") {
  clips();
} else if (mode === "edit") {
  edit();
} else {
  const server = await preview({
    root: app,
    configFile: false,
    preview: { host: "127.0.0.1", port: 4185, strictPort: true },
  });
  try {
    const browser = await chromium.launch({
      channel: "chrome",
      args: mode === "video" ? ["--auto-accept-this-tab-capture", ...adapterArgs()] : [],
    });
    try {
      if (mode === "stills") await stills(browser);
      if (mode === "video") await video(browser);
      if (mode === "measure") await measure(browser);
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
  if (mode === "video") edit();
}
