import { expect, test } from "@playwright/test";

test("renders the night corridor and responds to playback, camera and navigation controls", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "The corridor after dark." })).toBeVisible();
  const pause = page.getByRole("button", { name: "Pause simulation" });
  await expect(pause).toBeEnabled();
  await expect(page.getByText("Fixed-cycle simulation", { exact: true })).toBeVisible();
  await expect(page.getByText("Simulation result", { exact: true })).toBeVisible();
  const readout = (label: string) =>
    page.locator(".live-readouts div").filter({ hasText: label }).locator("dd");
  const elapsed = readout("Simulated time");
  const count = readout("Vehicles on road");
  await expect(count).toHaveText(/[1-9][\d,]*/);
  const initialTime = await elapsed.textContent();
  await expect(elapsed).not.toHaveText(initialTime ?? "");
  await pause.click();
  await expect(page.getByRole("button", { name: "Play simulation" })).toBeEnabled();

  const scene = page.locator(".scene-stage canvas");
  const screenshot = (await scene.screenshot()).toString("base64");
  const litFraction = await page.evaluate(async (png) => {
    const frame = new Image();
    frame.src = `data:image/png;base64,${png}`;
    await frame.decode();
    const sample = document.createElement("canvas");
    sample.width = 64;
    sample.height = 36;
    const context = sample.getContext("2d");
    if (!context) throw new Error("Could not sample the rendered frame");
    context.drawImage(frame, 0, 0, sample.width, sample.height);
    const { data } = context.getImageData(0, 0, sample.width, sample.height);
    let litPixels = 0;
    for (let offset = 0; offset < data.length; offset += 4) {
      if (data[offset] + data[offset + 1] + data[offset + 2] > 60) litPixels++;
    }
    return litPixels / (sample.width * sample.height);
  }, screenshot);
  expect(litFraction).toBeGreaterThan(0.03);

  const fastForward = page.getByRole("button", { name: "4 times speed" });
  await fastForward.click();
  await expect(fastForward).toHaveAttribute("aria-pressed", "true");
  const junction = page.getByRole("button", { name: "Fly to junction J3" });
  await junction.press("Enter");
  await expect(junction).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Junction J3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Aerial view" }).click();

  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("link", { name: "Results" }).click();
  await expect(page.getByRole("heading", { name: "Benchmark results" })).toBeFocused();
  await nav.getByRole("link", { name: "Method" }).click();
  await expect(page.getByRole("heading", { name: "How CHOWK works" })).toBeVisible();
  await nav.getByRole("link", { name: "Limits" }).click();
  await expect(page.getByRole("heading", { name: "Scope and limitations" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "How CHOWK works" })).toBeVisible();
  await nav.getByRole("link", { name: "Live" }).click();
  await expect(page.getByRole("button", { name: "Play simulation" })).toBeEnabled();
  expect(browserErrors).toEqual([]);
});

test("opens a usable shell when WebGL 2 is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = new Proxy(HTMLCanvasElement.prototype.getContext, {
      apply: (getContext, canvas, args) =>
        args[0] === "webgl2" ? null : Reflect.apply(getContext, canvas, args),
    });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "3D view unavailable" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Aerial view" })).toBeDisabled();
  await page.getByRole("link", { name: "Limits" }).click();
  await expect(page.getByRole("heading", { name: "Scope and limitations" })).toBeVisible();
});
