import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const hasPublication = existsSync(
  fileURLToPath(new URL("../../results/benchmark.json", import.meta.url)),
);

test("Results shows published data or an honest pending state", async ({ page }) => {
  await page.goto("/results");
  await expect(page.getByRole("heading", { name: "Benchmark results", level: 1 })).toBeVisible();
  if (!hasPublication) {
    await expect(page.getByRole("heading", { name: "Publication pending" })).toBeVisible();
    return;
  }
  await expect(page.getByText(/Simulation result\.$/)).toBeVisible();
  const scenario = page.getByRole("combobox", { name: "Scenario" });
  await expect(scenario).toHaveValue("morning-peak");
  await scenario.selectOption("off-peak");
  await expect(page.getByRole("table", { name: /Off-peak/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run benchmark", exact: true })).toBeEnabled();
});

test("browser reproduction matches the published raw results", async ({ page }) => {
  test.skip(
    !hasPublication || process.env.CHOWK_VERIFY_REPRO !== "1",
    "Requires the published benchmark and CHOWK_VERIFY_REPRO=1",
  );
  test.setTimeout(120_000);
  await page.goto("/results");
  await page.getByRole("button", { name: "Run benchmark", exact: true }).click();
  await expect(
    page.getByText("Your browser reproduced our published numbers exactly."),
  ).toBeVisible({ timeout: 110_000 });
  await expect(page.getByRole("cell", { name: "Exact", exact: true })).toHaveCount(9);
});
