import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { BenchmarkFile } from "@chowk/bench";
import { chromium, expect, firefox, test, webkit } from "@playwright/test";

const publishedFile = new URL("../../results/benchmark.json", import.meta.url);
const publication = existsSync(publishedFile)
  ? (JSON.parse(readFileSync(publishedFile, "utf8")) as BenchmarkFile)
  : undefined;

test("the comparison explorer computes paired differences and replays a seed", async ({ page }) => {
  test.skip(!publication, "No publication to explore");
  test.setTimeout(180_000);
  await page.goto("/results");
  const section = page.getByRole("region", { name: "Check any comparison" });
  await expect(section.getByText(/was better on \d+ of 20 held-out seeds/)).toBeVisible();
  await expect(section.locator(".skeptic-dot")).toHaveCount(20);
  await section.getByRole("combobox", { name: "B" }).selectOption("webster");
  await expect(section.getByText(/versus Fixed-time \(Webster\)/)).toBeVisible();
  await section.getByText("Every seed").click();
  await section.getByRole("button", { name: "Replay" }).first().click();
  await expect(
    section.getByText(/matched the published metrics and final state hashes/),
  ).toBeVisible({
    timeout: 150_000,
  });
});

test("Results shows published data or an honest pending state", async ({ page }) => {
  await page.goto("/results");
  await expect(page.getByRole("heading", { name: "Benchmark results", level: 1 })).toBeVisible();
  if (!publication) {
    await expect(page.getByRole("heading", { name: "Publication pending" })).toBeVisible();
    return;
  }
  await expect(page.getByText(publication.headline, { exact: true })).toBeVisible();
  const scenario = page.getByRole("combobox", { name: "Scenario" });
  await expect(scenario).toHaveValue("morning-peak");
  await scenario.selectOption("off-peak");
  await expect(page.getByRole("table", { name: /Off-peak/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run benchmark", exact: true })).toBeEnabled();
  for (const [suite, name] of [
    ["B3", "Policy ablations"],
    ["B4", "Generalisation"],
    ["B5", "Robustness"],
    ["B7", "Fairness"],
  ]) {
    if (!publication.summary.some((row) => row.suite === suite)) continue;
    const label = page.locator("summary").filter({ hasText: new RegExp(`^${name}$`) });
    const panel = page.locator("details").filter({ has: label });
    await label.click();
    await expect(panel.getByRole("table").first()).toBeVisible();
    if (suite === "B3")
      await expect(panel.getByRole("img", { name: /across policy variants/ })).toBeVisible();
    if (suite === "B4") {
      await expect(panel.getByRole("img", { name: /over calibrated demand loads/ })).toBeVisible();
      await expect(
        panel.getByRole("img", { name: /unseen mixes and the held-out grid/ }),
      ).toBeVisible();
    }
    if (suite === "B5") {
      await expect(
        panel.getByRole("img", { name: /same controller on clean sensors/ }),
      ).toBeVisible();
      await expect(
        panel.getByRole("list", { name: "Delay per person compared to the clean run" }).first(),
      ).toBeVisible();
    }
    await label.click();
  }
  if (publication.engineering) {
    const engineering = page.getByRole("region", { name: "Engineering measurements" });
    await expect(engineering).toBeVisible();
    const { models, reproduction, shapedLoads } = publication.engineering;
    if (models)
      await expect(
        engineering.getByText(
          `${models.count} GLBs · ${(models.bytes / 1_024).toFixed(1)} KiB total`,
        ),
      ).toBeVisible();
    for (const { label, downloadMbps, latencyMs } of shapedLoads ?? [])
      await expect(
        engineering.getByText(`${label} · ${downloadMbps} Mbps down · ${latencyMs} ms latency`),
      ).toBeVisible();
    for (const { episodes, wallSeconds } of reproduction ?? [])
      await expect(
        engineering.getByText(`${episodes} exact matches · ${wallSeconds.toFixed(2)} s`),
      ).toBeVisible();
  }
});

const engines = process.env.CHOWK_BROWSER_MATRIX === "1" ? [chromium, firefox, webkit] : [chromium];

for (const engine of engines) {
  test(`${engine.name()} reproduces the published raw results`, async ({ baseURL }) => {
    test.skip(
      !publication || process.env.CHOWK_VERIFY_REPRO !== "1",
      "Requires the published benchmark and CHOWK_VERIFY_REPRO=1",
    );
    test.setTimeout(120_000);
    const browser = await engine.launch();
    try {
      const page = await browser.newPage({ baseURL });
      await page.goto("/results");
      const start = performance.now();
      await page.getByRole("button", { name: "Run benchmark", exact: true }).click();
      await expect(
        page.getByText("Your browser reproduced our published numbers exactly."),
      ).toBeVisible({ timeout: 110_000 });
      const wallSeconds = (performance.now() - start) / 1_000;
      const matches = page.getByRole("cell", { name: "Exact", exact: true });
      await expect(matches).toHaveCount(9);
      const episodes = await matches.count();
      const name = engine.name();
      console.log(`${name} reproduced all ${episodes} episodes in ${wallSeconds.toFixed(2)} s`);
      if (process.env.CHOWK_WRITE_ENGINEERING === "1") {
        const directory = new URL("../../runs/", import.meta.url);
        mkdirSync(directory, { recursive: true });
        writeFileSync(
          new URL(`reproduction-${name}.json`, directory),
          `${JSON.stringify({ engine: name, version: browser.version(), wallSeconds, episodes }, null, 2)}\n`,
        );
      }
    } finally {
      await browser.close();
    }
  });
}
