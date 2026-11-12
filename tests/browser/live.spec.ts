import { expect, test } from "@playwright/test";

test.use({ launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });

test("renders the night corridor and responds to playback, camera and navigation controls", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  if (process.env.CI) {
    // Exercise the real WebGL scene on the hosted runner's software renderer.
    await page.addInitScript(() => localStorage.setItem("chowk-quality", "low"));
  }

  await page.goto("/?tour=off");
  await expect(page.getByRole("heading", { name: "The corridor after dark." })).toBeVisible();
  const pause = page.getByRole("button", { name: "Pause simulation" });
  await expect(pause).toBeEnabled();
  await expect(page.getByText("Live comparison", { exact: true })).toBeVisible();
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
  const wipe = page.getByRole("slider", { name: "Comparison wipe" });
  await expect(wipe).toBeVisible();
  const initialWipe = Number(await wipe.getAttribute("aria-valuenow"));
  await wipe.press("ArrowRight");
  expect(Number(await wipe.getAttribute("aria-valuenow"))).toBeGreaterThan(initialWipe);

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

test("runs the same live corridor in 2D when WebGL 2 is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = new Proxy(HTMLCanvasElement.prototype.getContext, {
      apply: (getContext, canvas, args) =>
        args[0] === "webgl2" ? null : Reflect.apply(getContext, canvas, args),
    });
  });

  await page.goto("/?tour=off");
  await expect(page.getByRole("img", { name: "Top-down corridor simulation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Aerial view" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Pause simulation" })).toBeEnabled();
  await page.getByRole("link", { name: "Limits" }).click();
  await expect(page.getByRole("heading", { name: "Scope and limitations" })).toBeVisible();
});

test("guides a first-time visitor through the comparison and remembers dismissal", async ({
  page,
}) => {
  if (process.env.CI) {
    await page.addInitScript(() => localStorage.setItem("chowk-quality", "low"));
  }

  // Automated browsers skip the guide unless the URL asks for it.
  await page.goto("/?guide=on");
  const guide = page.getByRole("dialog", { name: "Getting started" });
  await expect(guide).toBeVisible({ timeout: 60_000 });
  await expect(guide.getByRole("heading", { name: "Welcome to CHOWK" })).toBeVisible();

  await guide.getByRole("button", { name: "Show me around" }).click();
  await expect(guide.getByRole("heading", { name: "One street, two controllers" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Comparison wipe" })).toBeVisible();
  for (const title of [
    "Read the difference",
    "Try to break it",
    "Look closer",
    "Check the proof",
  ]) {
    await guide.getByRole("button", { name: "Next" }).click();
    await expect(guide.getByRole("heading", { name: title })).toBeVisible();
  }
  await guide.getByRole("button", { name: "Done" }).click();
  await expect(guide).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem("chowk-guide"))).toBe("done");

  await page.getByRole("button", { name: "Open the getting started guide" }).click();
  await expect(guide).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(guide).toBeHidden();
});

test("briefs a first-time visitor on the problem and hands over to the live tour", async ({
  page,
}) => {
  if (process.env.CI) {
    await page.addInitScript(() => localStorage.setItem("chowk-quality", "low"));
  }

  // Automated browsers skip the briefing unless the URL asks for it.
  await page.goto("/?intro=on&guide=off");
  const briefing = page.getByRole("dialog", { name: "A junction full of people, run by a clock" });
  await expect(briefing).toBeVisible();
  for (const title of [
    "Without lanes, a queue is an area, not a number",
    "A classical rule, plus a learned nudge",
    "Trained by trial in the same simulator",
    "Judged on traffic it never saw",
    "Everything you see is computed live",
  ]) {
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    if (title === "Judged on traffic it never saw")
      await expect(
        page.getByText(/held-out seeds in simulated Indian mixed traffic/),
      ).toBeVisible();
  }
  const enter = page.getByRole("button", { name: "Enter the live corridor" });
  await expect(enter).toBeEnabled({ timeout: 60_000 });
  await enter.click();
  await expect(
    page.getByRole("heading", { name: "Everything you see is computed live" }),
  ).toBeHidden();
  await expect(page.locator(".instrument")).toHaveAttribute("data-tour", "true");
  expect(await page.evaluate(() => localStorage.getItem("chowk-briefing"))).toBe("done");

  await page.getByRole("button", { name: /What am I looking at/ }).click();
  await expect(
    page.getByRole("heading", { name: "A junction full of people, run by a clock" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "A junction full of people, run by a clock" }),
  ).toBeHidden();
});

test("shows the arithmetic behind live metrics and a junction's decision", async ({ page }) => {
  if (process.env.CI) {
    await page.addInitScript(() => localStorage.setItem("chowk-quality", "low"));
  }

  await page.goto("/?tour=off");
  await expect(page.getByRole("button", { name: "Pause simulation" })).toBeEnabled({
    timeout: 60_000,
  });
  await page.getByRole("button", { name: "How delay per person is calculated" }).click();
  const formula = page.locator("#metric-delay-description");
  await expect(formula).toBeVisible();
  await expect(formula).toContainText(/person-s ÷ [\d,]+ people = [\d.]+ s/);

  await page.getByRole("button", { name: "16 times speed" }).click();
  await page.locator(".decision-button").click();
  const panel = page.getByRole("complementary", { name: "How J3 decides" });
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Max-pressure: which green relieves the most?")).toBeVisible({
    timeout: 60_000,
  });
  await expect(panel.getByText(/matches the controller's own numbers/)).toBeVisible();
  await panel.getByRole("button", { name: /^A · / }).click();
  await expect(panel.getByText("Follow the timetable")).toBeVisible({ timeout: 30_000 });
});
