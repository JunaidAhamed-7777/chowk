import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import {
  primaryPolicyPath,
  readBenchmark,
  sha256,
  simulatorVersion,
  verifyBenchmark,
} from "../../packages/bench/src/provenance.ts";

const root = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig(({ command }) => {
  const published = readBenchmark(root);
  const problems = published ? verifyBenchmark(root, published) : [];
  if (command === "build" && problems.length > 0) {
    const message = `Published benchmark is stale. Rerun the benchmark before building.\n${problems.join("\n")}`;
    if (process.env.ALLOW_STALE_RESULTS !== "1") throw new Error(message);
    console.warn(message);
  }
  const weights = resolve(root, primaryPolicyPath);
  return {
    plugins: [react(), tailwindcss()],
    worker: { format: "es" },
    define: {
      __CHOWK_SIM_VERSION__: JSON.stringify(simulatorVersion(root)),
      __CHOWK_POLICY_HASH__: JSON.stringify(
        existsSync(weights) ? sha256(readFileSync(weights)) : null,
      ),
    },
  };
});
