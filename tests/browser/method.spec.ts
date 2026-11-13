import { expect, test } from "@playwright/test";

test("Method shows measured checks and a keyboard-scrubbable filtering replay", async ({
  page,
}) => {
  await page.goto("/method");
  await expect(page.getByRole("heading", { name: "How CHOWK works", level: 1 })).toBeVisible();
  await expect(
    page.getByRole("img", { name: /shared simulator supplies training/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /simulated flow in vehicles per hour/i }),
  ).toBeVisible();
  const replay = page.getByRole("slider", { name: "Filtering replay frame" });
  await expect(replay).toHaveValue("0");
  await replay.press("ArrowRight");
  await expect(replay).toHaveValue("1");
  await replay.press("End");
  await expect(page.getByRole("button", { name: "Replay", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "TomTom Traffic Index" })).toHaveAttribute(
    "href",
    "https://www.tomtom.com/traffic-index/city/bengaluru/",
  );
});

test("Method explains the problem with a sandbox and walks through a decision", async ({
  page,
}) => {
  await page.goto("/method");
  await expect(page.getByRole("navigation", { name: "Chapters" })).toBeVisible();
  const verdict = page.locator(".sandbox-verdict");
  await page.getByRole("button", { name: "One bus vs a swarm" }).click();
  await page.getByRole("button", { name: "A vehicle-counting signal" }).click();
  await expect(verdict).toContainText("serves Approach B");
  await page.getByRole("button", { name: "CHOWK", exact: true }).click();
  await expect(verdict).toContainText("CHOWK sees Approach A");
  await page.getByRole("button", { name: "One more bus" }).last().click();
  await page.getByRole("button", { name: "One more bus" }).last().click();
  await expect(verdict).toContainText("CHOWK sees Approach B");
  const steps = page.getByRole("tablist", { name: "One decision, step by step" });
  await steps.getByRole("tab", { name: /Switch safely/ }).click();
  await expect(page.getByText("All-red while the box clears")).toBeVisible();
  const scale = page.getByRole("region", { name: "How much traffic CHOWK trained on" });
  await scale.scrollIntoViewIfNeeded();
  await expect(scale).toContainText(/hours of simulated traffic/);
  await expect(scale).toContainText(/training episodes/);
});

test("Limits describes the model and requirements for field use", async ({ page }) => {
  await page.goto("/limits");
  await expect(
    page.getByRole("heading", { name: "Scope and limitations", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText("All traffic results come from the simulator.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Field validation", { exact: true })).toBeVisible();
});
