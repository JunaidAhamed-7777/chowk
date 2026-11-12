import { expect, test } from "@playwright/test";
import timeline from "../../apps/web/src/tour/timeline.json" with { type: "json" };

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
  await expect(page.getByRole("heading", { name: "Morning peak" })).toBeVisible();
  const pause = page.getByRole("button", { name: "Pause simulation" });
  await expect(pause).toBeEnabled();
  await expect(page.locator(".instrument")).toHaveAttribute("data-ready", "true");
  await expect(page.getByText("Simulation result", { exact: true })).toBeVisible();
  const readout = (label: string) =>
    page.locator(".live-readouts div").filter({ hasText: label }).locator("dd");
  const count = readout("Vehicles on road");
  await expect(count).toHaveText(/[1-9][\d,]*/);
  await expect(readout("Simulated time")).toHaveText(/^\d\d:\d\d$/);
  const instrument = page.locator(".instrument");
  const initialTick = await instrument.getAttribute("data-tick");
  await expect(instrument).not.toHaveAttribute("data-tick", initialTick ?? "", { timeout: 60_000 });
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
  const briefing = page.getByRole("dialog", { name: "Traffic lights that ignore the traffic" });
  await expect(briefing).toBeVisible();
  for (const title of [
    "Why counting vehicles gets it wrong",
    "How CHOWK picks which light turns green",
    "How it learned",
    "Does it beat the other lights?",
    "How to read the live view",
  ]) {
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    if (title === "Does it beat the other lights?")
      await expect(page.getByText(/vs Fixed-time \(Webster\):/)).toBeVisible();
  }
  const enter = page.getByRole("button", { name: "Enter the live corridor" });
  await expect(enter).toBeEnabled({ timeout: 60_000 });
  await enter.click();
  await expect(page.getByRole("heading", { name: "How to read the live view" })).toBeHidden();
  await expect(page.locator(".instrument")).toHaveAttribute("data-tour", "true");
  expect(await page.evaluate(() => localStorage.getItem("chowk-briefing"))).toBe("done");

  await page.getByRole("button", { name: /What am I looking at/ }).click();
  await expect(
    page.getByRole("heading", { name: "Traffic lights that ignore the traffic" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "Traffic lights that ignore the traffic" }),
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
  await expect(panel.getByText(/What moved the correction for/)).toBeVisible({ timeout: 30_000 });
  await expect(panel.getByText("✓ matches the controller")).toBeVisible();
  await panel.getByRole("button", { name: /^A · / }).click();
  await expect(panel.getByText("Follow the timetable")).toBeVisible({ timeout: 30_000 });
});

test("scenarios set the scene description and clock, and menus close on an outside press", async ({
  page,
}) => {
  if (process.env.CI) {
    await page.addInitScript(() => localStorage.setItem("chowk-quality", "low"));
  }
  await page.goto("/?tour=off");
  await expect(page.getByRole("button", { name: "Pause simulation" })).toBeEnabled({
    timeout: 60_000,
  });
  const clock = page
    .locator(".live-readouts div")
    .filter({ hasText: "Simulated time" })
    .locator("dd");
  await expect(clock).toHaveText(/^08:\d\d$/);
  await expect(page.locator(".live-when")).toContainText("Daytime");

  await page.locator(".simulation-controls select").first().selectOption("monsoon");
  await expect(page.getByRole("heading", { name: "Monsoon" })).toBeVisible();
  await expect(page.locator(".live-when")).toContainText("raining");
  await expect(clock).toHaveText(/^21:\d\d$/, { timeout: 60_000 });

  const menu = page.locator("details.camera-menu");
  await menu.locator("summary").click();
  await expect(menu).toHaveAttribute("open", "");
  await page.locator(".live-footer").click();
  await expect(menu).not.toHaveAttribute("open", "");
});

test("explains every controller on its own page", async ({ page }) => {
  await page.goto("/controllers");
  await expect(page.getByRole("heading", { name: "How each controller decides" })).toBeVisible();
  for (const name of [
    "Fixed-time (Webster)",
    "Actuated (gap-out)",
    "Max-pressure (counts)",
    "Max-pressure (area)",
    "CHOWK",
    "CHOWK-pure",
  ])
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: /Two identical signal cycles/ })).toBeVisible();
});

test("the tour opens the split comparison within five seconds and keeps the dock aside", async ({
  page,
}) => {
  await page.goto("/?intro=off&guide=off");
  const instrument = page.locator(".instrument");
  await expect(instrument).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await expect(instrument).toHaveAttribute("data-tour", "true");
  // The timeline opens the comparison by 5 s of tour time; software rendering in CI runs
  // at a few frames per second, so the visibility check allows extra wall time.
  const wipeBeat = timeline.find((beat) => beat.wipe > 0);
  expect(wipeBeat?.t).toBeLessThanOrEqual(5);
  await expect(page.getByRole("slider", { name: "Comparison wipe" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("Click anywhere or press a key to take control")).toBeVisible();
  await expect(page.locator(".instrument-controls")).toHaveCSS("opacity", "0");

  await page.keyboard.press("Shift");
  await expect(instrument).toHaveAttribute("data-tour", "false");
  await expect(page.locator(".instrument-controls")).toHaveCSS("opacity", "1");
});

test("the time-space diagram plots both simulations along the corridor", async ({ page }) => {
  await page.goto("/?tour=off");
  await expect(page.locator(".instrument")).toHaveAttribute("data-ready", "true", {
    timeout: 60_000,
  });
  await page.getByRole("button", { name: "4 times speed" }).click();
  await page.getByRole("button", { name: "Time-space" }).click();
  const panel = page.getByRole("region", { name: "Time-space diagram" });
  await expect(panel).toBeVisible();
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          [...document.querySelectorAll<HTMLCanvasElement>(".time-space-canvas canvas")].map(
            (canvas) => {
              const data = canvas
                .getContext("2d")
                ?.getImageData(0, 0, canvas.width, canvas.height).data;
              let count = 0;
              for (let index = 3; data && index < data.length; index += 4)
                if (data[index] > 0) count++;
              return count > 500;
            },
          ),
        ),
      { timeout: 60_000 },
    )
    .toEqual([true, true]);
  await panel.getByRole("button", { name: "Close time-space diagram" }).click();
  await expect(panel).toBeHidden();
});

test("Beat the AI plays a round at J3 against CHOWK and reports a verdict", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/?tour=off");
  await expect(page.locator(".instrument")).toHaveAttribute("data-ready", "true", {
    timeout: 60_000,
  });
  await page.getByRole("button", { name: "Beat the AI" }).click();
  const panel = page.getByRole("region", { name: "Beat the AI" });
  await panel.getByRole("button", { name: "Start round" }).click();
  await expect(panel.getByRole("group", { name: "Give green to" })).toBeVisible({
    timeout: 60_000,
  });
  for (const key of ["2", "4", "1", "3"]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(2_000);
  }
  await page.getByRole("button", { name: "16 times speed" }).click();
  await expect(panel.getByRole("button", { name: "Play again" })).toBeVisible({
    timeout: 150_000,
  });
  await expect(panel.getByText(/beat|draw/i).first()).toBeVisible();
  await panel.getByRole("button", { name: "Leave Beat the AI" }).click();
  await expect(panel).toBeHidden();
});

test("rewinding returns both simulations a minute back and they keep running", async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto("/?tour=off");
  const instrument = page.locator(".instrument");
  await expect(instrument).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await page.getByRole("button", { name: "16 times speed" }).click();
  const tick = async () => Number(await instrument.getAttribute("data-tick"));
  const start = await tick();
  // A checkpoint at least a minute old needs a little over 70 simulated seconds.
  await expect.poll(tick, { timeout: 180_000 }).toBeGreaterThan(start + 4 * 80);
  await page.getByRole("button", { name: "Pause simulation" }).click();
  const before = await tick();
  await page.getByRole("button", { name: "Rewind one minute" }).click();
  await expect.poll(tick, { timeout: 15_000 }).toBeLessThanOrEqual(before - 4 * 60);
  await page.getByRole("button", { name: "Play simulation" }).click();
  const after = await tick();
  await expect.poll(tick, { timeout: 30_000 }).toBeGreaterThan(after);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
