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
