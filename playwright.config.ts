import { defineConfig } from "@playwright/test";

const origin = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  workers: 1,
  use: {
    baseURL: origin,
    browserName: "chromium",
    viewport: { width: 1440, height: 900 },
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview --workspace @chowk/web -- --host 127.0.0.1 --port 4173 --strictPort",
    url: origin,
  },
});
