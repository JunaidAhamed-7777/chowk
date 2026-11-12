import { spawn } from "node:child_process";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const commands = {
  train: {
    cli: "packages/train/src/cli.ts",
    "training-worker": "packages/train/src/training-worker.ts",
  },
  "train-export": { cli: "packages/train/src/export.ts" },
  "train-tune": {
    cli: "packages/train/src/tune.ts",
    "training-worker": "packages/train/src/training-worker.ts",
  },
  bench: { cli: "packages/bench/src/cli.ts", "cli-worker": "packages/bench/src/cli-worker.ts" },
  calibrate: { cli: "packages/scenarios/tools/calibrate.ts" },
  diagnose: { cli: "packages/bench/tools/diagnose-capacity.ts" },
  "sim-bench": { cli: "packages/sim/tools/bench.ts" },
  "sim-validate": { cli: "packages/sim/tools/validate.ts" },
};

const [command, ...args] = process.argv.slice(2);
if (!Object.hasOwn(commands, command)) throw new Error(`Unknown Node command ${command}`);
const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = await realpath(tmpdir());
const outDir = await mkdtemp(join(temporary, "chowk-node-"));

try {
  const inputs = Object.fromEntries(
    Object.entries(commands[command]).map(([name, path]) => [name, resolve(root, path)]),
  );
  await build({
    root,
    configFile: false,
    logLevel: "warn",
    build: {
      ssr: true,
      target: "node22",
      minify: false,
      outDir,
      emptyOutDir: false,
      rolldownOptions: {
        input: inputs,
        output: {
          format: "es",
          entryFileNames: "[name].mjs",
          chunkFileNames: "chunks/[name]-[hash].mjs",
        },
      },
    },
    ssr: { noExternal: true },
  });
  process.exitCode = await new Promise((accept, reject) => {
    const child = spawn(process.execPath, [join(outDir, "cli.mjs"), ...args], {
      cwd: root,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => accept(code ?? (signal === "SIGINT" ? 130 : 1)));
  });
} finally {
  if (dirname(await realpath(outDir)) === temporary)
    await rm(outDir, { recursive: true, force: true });
}
