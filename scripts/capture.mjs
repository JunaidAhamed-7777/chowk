import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
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
const origin = "http://127.0.0.1:4185";
const viewport = { width: 1440, height: 900 };
const mode = process.argv[2] ?? "stills";
if (!["stills", "video", "measure"].includes(mode)) throw new Error(`Unknown capture mode ${mode}`);
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

async function pageFor(browser, tier, recordVideo) {
  const context = await browser.newContext({ viewport, recordVideo });
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
    await page.goto(`${origin}/?tour=off`);
    await waitForScene(page);
    await page.getByRole("button", { name: "Fly to junction J3" }).click();
    await page.getByLabel("Overlay").selectOption("pressure");
    await page.waitForTimeout(1900);
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
  const { context, page } = await pageFor(browser, "medium", { dir: work, size: viewport });
  const recording = page.video();
  if (!recording) throw new Error("Playwright did not start recording");
  const start = performance.now();
  const elapsed = () => (performance.now() - start) / 1000;
  let proofStart = 0;
  let proofEnd = 0;
  let recorded = 0;
  try {
    await page.goto(`${origin}/`);
    await waitForScene(page);
    await page.waitForTimeout(Math.max(0, 65_000 - (performance.now() - start)));
    proofStart = elapsed();
    await page.getByRole("link", { name: "Results", exact: true }).click();
    await page.getByRole("button", { name: "Run benchmark", exact: true }).click();
    await page
      .getByText("Your browser reproduced our published numbers exactly.")
      .waitFor({ timeout: 120_000 });
    await page.waitForTimeout(4500);
    proofEnd = elapsed();
    await page.getByRole("link", { name: "Method", exact: true }).click();
    await page.getByRole("heading", { name: "How CHOWK works" }).waitFor();
    await page.waitForTimeout(9000);
    recorded = elapsed();
  } finally {
    await context.close();
  }
  const raw = await recording.path();
  const proofScale = 17 / (proofEnd - proofStart);
  const finalScale = 8 / (recorded - proofEnd);
  const vf = [
    `[0:v]trim=end=${proofStart},setpts=(PTS-STARTPTS)*${65 / proofStart}[live]`,
    `[0:v]trim=start=${proofStart}:end=${proofEnd},setpts=(PTS-STARTPTS)*${proofScale}[proof]`,
    `[0:v]trim=start=${proofEnd}:end=${recorded},setpts=(PTS-STARTPTS)*${finalScale}[method]`,
    "[live][proof][method]concat=n=3:v=1:a=0,tpad=stop_mode=clone:stop_duration=1,fps=25,scale=1280:-2[out]",
  ].join(";");
  ffmpeg([
    "-i",
    raw,
    "-i",
    join(media, "captions.vtt"),
    "-filter_complex",
    vf,
    "-map",
    "[out]",
    "-map",
    "1:s:0",
    "-c:s",
    "mov_text",
    "-disposition:s:0",
    "default",
    "-t",
    "90",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "25",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    join(media, "chowk-demo.mp4"),
  ]);
  const gif = join(media, "hero.gif");
  ffmpeg([
    "-ss",
    "7",
    "-i",
    raw,
    "-t",
    "6.5",
    "-filter_complex",
    "fps=12,scale=1060:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3",
    "-loop",
    "0",
    gif,
  ]);
  if (statSync(gif).size > 8_000_000) throw new Error("Hero GIF exceeds 8 MB");
}

function median(sorted) {
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

async function measure(browser) {
  const rendering = [];
  let gpu;
  let load;
  for (const tier of ["low", "medium", "high"]) {
    const { context, page } = await pageFor(browser, tier);
    try {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      await page.goto(`${origin}/?tour=off`);
      await waitForScene(page);
      if (tier === "medium") {
        const data = await page.evaluate(() => {
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("webgl2");
          const extension = context?.getExtension("WEBGL_debug_renderer_info");
          const renderer =
            context && extension
              ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL)
              : undefined;
          context?.getExtension("WEBGL_lose_context")?.loseContext();
          const entries = [
            ...performance.getEntriesByType("navigation"),
            ...performance.getEntriesByType("resource"),
          ];
          return {
            interactiveMs: performance.now(),
            transferBytes: entries.reduce((sum, entry) => sum + entry.transferSize, 0),
            files: entries.map(({ name }) => new URL(name).pathname),
            gpu: renderer,
          };
        });
        gpu = data.gpu;
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
      rendering.push({ tier, medianFps, onePercentLowFps });
      process.stdout.write(
        `${tier}: ${medianFps.toFixed(1)} median FPS, ${onePercentLowFps.toFixed(1)} 1% low\n`,
      );
    } finally {
      await context.close();
    }
  }
  const file = join(root, "results/engineering.json");
  const existing = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const determinismFile = join(root, "runs/determinism.json");
  const testFile = join(root, "runs/vitest-report.json");
  const inferenceFile = join(root, "runs/policy-inference.json");
  const determinism = existsSync(determinismFile)
    ? JSON.parse(readFileSync(determinismFile, "utf8"))
    : existing.determinism;
  const report = existsSync(testFile) ? JSON.parse(readFileSync(testFile, "utf8")) : undefined;
  const tests = report
    ? { passed: report.numPassedTests, failed: report.numFailedTests }
    : existing.tests;
  let policyMicroseconds = existing.policyMicroseconds;
  if (existsSync(inferenceFile)) {
    const timing = JSON.parse(readFileSync(inferenceFile, "utf8"));
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
    `${JSON.stringify({ ...existing, hardware, rendering, load, determinism, tests, policyMicroseconds }, null, 2)}\n`,
  );
}

const server = await preview({
  root: app,
  configFile: false,
  preview: { host: "127.0.0.1", port: 4185, strictPort: true },
});
try {
  const browser = await chromium.launch({ channel: "chrome" });
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
