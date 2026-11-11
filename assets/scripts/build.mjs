import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { dedup, meshopt, weld } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import { exportDirectory, io, loadModels, modelDirectory, verifyModels } from "./models.mjs";

const sources = await loadModels(exportDirectory);
if (sources.size === 0) {
  throw new Error(
    "No raw GLBs in assets/export/. Run npm run assets:placeholders or export models from Blender.",
  );
}

const models = await loadModels(modelDirectory);
for (const [name, bytes] of sources) {
  const document = await io.readBinary(bytes);
  await document.transform(dedup(), weld(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  models.set(name, await io.writeBinary(document));
}

// Validate the combined set before replacing any committed output.
await verifyModels(models);
await mkdir(modelDirectory, { recursive: true });
await Promise.all(
  [...sources.keys()].map((name) => writeFile(join(modelDirectory, name), models.get(name))),
);
