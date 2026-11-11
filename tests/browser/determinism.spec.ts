import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect, firefox, test, webkit } from "@playwright/test";
import { build } from "vite";
import type { determinismFixture } from "../../packages/bench/test/determinism-fixture";

const root = fileURLToPath(new URL("../..", import.meta.url));
const fixture = fileURLToPath(
  new URL("../../packages/bench/test/determinism-fixture.ts", import.meta.url),
);
const engines = process.env.CHOWK_BROWSER_MATRIX === "1" ? [chromium, firefox, webkit] : [chromium];

function recordEngineHash(engine: string, hash: number, nodeHash: number): void {
  if (process.env.CHOWK_WRITE_ENGINEERING !== "1") return;
  const directory = resolve(root, "runs");
  mkdirSync(directory, { recursive: true });
  const file = resolve(directory, "determinism.json");
  const saved: Record<string, number> = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const names: Record<string, string> = { chromium: "Chromium", firefox: "Firefox", webkit: "WebKit" };
  const hashes = { ...(saved.Node === nodeHash ? saved : {}), Node: nodeHash, [names[engine] ?? engine]: hash };
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(hashes, null, 2)}\n`);
  renameSync(temporary, file);
}

async function bundleFixture(): Promise<string> {
  const result = await build({
    root,
    configFile: false,
    logLevel: "error",
    build: {
      target: "es2022",
      write: false,
      minify: false,
      lib: { entry: fixture, formats: ["es"] },
    },
  });
  const builds = Array.isArray(result) ? result : [result];
  for (const entry of builds) {
    if (!("output" in entry)) continue;
    const chunk = entry.output.find((item) => item.type === "chunk");
    if (chunk?.type === "chunk") return chunk.code;
  }
  throw new Error("No browser fixture was bundled");
}

for (const engine of engines) {
  test(`${engine.name()} matches Node through 10,000 simulator ticks`, async () => {
    test.setTimeout(90_000);
    const source = await bundleFixture();
    const dataModule = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
    const module = (await import(dataModule)) as { determinismFixture: typeof determinismFixture };
    const expected = module.determinismFixture();
    const browser = await engine.launch();
    try {
      const page = await browser.newPage();
      await page.route("https://chowk.test/determinism", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: "<!doctype html><title>Simulator determinism</title>",
        }),
      );
      await page.route("https://chowk.test/engine.mjs", (route) =>
        route.fulfill({ contentType: "text/javascript", body: source }),
      );
      await page.goto("https://chowk.test/determinism");
      const actual = await page.evaluate(async (url) => {
        const workerModule = (await import(url)) as {
          determinismFixture: typeof determinismFixture;
        };
        return workerModule.determinismFixture();
      }, "https://chowk.test/engine.mjs");
      expect(actual).toEqual(expected);
      const hash = actual.checkpoints.at(-1);
      const nodeHash = expected.checkpoints.at(-1);
      if (hash === undefined || nodeHash === undefined) throw new Error("The fixture returned no final state hash");
      recordEngineHash(engine.name(), hash, nodeHash);
      console.log(`${engine.name()} state ${hash.toString(16).padStart(8, "0")}`);
    } finally {
      await browser.close();
    }
  });
}
