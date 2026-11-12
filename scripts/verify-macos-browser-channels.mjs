import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { preview } from "vite";

const host = "127.0.0.1";
const port = 4173;
const deployedOrigin = process.env.CHOWK_SMOKE_ORIGIN;
const origin = deployedOrigin || `http://${host}:${port}`;
const server = deployedOrigin
  ? undefined
  : await preview({
      root: fileURLToPath(new URL("../apps/web/", import.meta.url)),
      configFile: false,
      preview: { host, port, strictPort: true },
    });

try {
  for (const [channel, name] of [
    ["chrome", "Google Chrome"],
    ["msedge", "Microsoft Edge"],
  ]) {
    const browser = await chromium.launch({ channel, headless: false });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.goto(`${origin}/`);
      const first = await page.waitForFunction(
        () => {
          const instrument = document.querySelector(".instrument");
          const tick = Number(instrument?.dataset.tick ?? 0);
          const gl = document.querySelector(".scene-canvas canvas")?.getContext("webgl2");
          if (
            instrument?.dataset.tour !== "true" ||
            !document.querySelector(".tour-caption-text")?.textContent ||
            !document.querySelector(".instrument[data-ready=true]") ||
            tick === 0 ||
            !gl ||
            gl.isContextLost() ||
            !gl.getParameter(gl.CURRENT_PROGRAM)
          ) {
            return null;
          }
          const debug = gl.getExtension("WEBGL_debug_renderer_info");
          return { tick, renderer: gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER) };
        },
        undefined,
        { timeout: 30_000 },
      );
      const { tick, renderer } = await first.jsonValue();
      assert.equal(
        await page.getByRole("combobox", { name: "Right controller" }).inputValue(),
        "chowk",
      );
      const advanced = await page.waitForFunction((start) => {
        const current = Number(document.querySelector(".instrument")?.dataset.tick ?? 0);
        return current > start ? current : null;
      }, tick);
      await page.getByRole("button", { name: "Pause simulation", exact: true }).click();
      await page.getByRole("button", { name: "Play simulation", exact: true }).waitFor();
      assert.equal(await page.locator(".instrument").getAttribute("data-tour"), "false");
      assert.deepEqual(errors, []);
      console.log(
        `${name} ${browser.version()}: ${renderer}. Autoplay advanced from tick ${tick} to ${await advanced.jsonValue()}; Pause ended the tour.`,
      );
    } finally {
      await browser.close();
    }
  }
} finally {
  await server?.close();
}
