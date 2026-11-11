import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO, Primitive } from "@gltf-transform/core";
import {
  EXTMeshoptCompression,
  EXTTextureWebP,
  KHRMaterialsEmissiveStrength,
  KHRMeshQuantization,
  KHRTextureBasisu,
} from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

export const exportDirectory = fileURLToPath(new URL("../export/", import.meta.url));
export const modelDirectory = fileURLToPath(
  new URL("../../apps/web/public/models/", import.meta.url),
);

const fileBudget = 300_000;
const totalBudget = 3_000_000;
const textureBudget = 256;
const footprintTolerance = 0.05;
const originTolerance = 0.02;
const vehicleAssets = {
  "two-wheeler": { name: "veh_twowheeler", full: 500, low: 150 },
  "auto-rickshaw": { name: "veh_auto", full: 600, low: 200, sign: true },
  car: { name: "veh_car", full: 600, low: 200 },
  "light-commercial": { name: "veh_lcv", full: 600, low: 200 },
  bus: { name: "veh_bus", full: 900, low: 300, sign: true },
  ambulance: { name: "veh_ambulance", full: 700, low: 250, sign: true },
};
const dimensions = JSON.parse(
  await readFile(
    new URL("../../packages/sim/src/vehicle-dimensions.json", import.meta.url),
    "utf8",
  ),
);
const vehicleRules = new Map();
for (const vehicle of dimensions) {
  const { name, full, low, sign } = vehicleAssets[vehicle.id];
  vehicleRules.set(`${name}.glb`, { ...vehicle, triangles: full, sign, required: true });
  vehicleRules.set(`${name}_lod1.glb`, { ...vehicle, triangles: low, sign });
}

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
export const io = new NodeIO()
  .registerExtensions([
    EXTMeshoptCompression,
    EXTTextureWebP,
    KHRMaterialsEmissiveStrength,
    KHRMeshQuantization,
    KHRTextureBasisu,
  ])
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

export async function loadModels(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const names = entries
    .filter((entry) => entry.isFile() && /\.glb$/i.test(entry.name))
    .map(({ name }) => name);
  names.sort();
  return new Map(
    await Promise.all(names.map(async (name) => [name, await readFile(join(directory, name))])),
  );
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function validateTextures(root) {
  for (const texture of root.listTextures()) {
    const mime = texture.getMimeType();
    invariant(
      mime === "image/webp" || mime === "image/ktx2",
      "Palette textures must be WebP or KTX2.",
    );
    const size = texture.getSize();
    invariant(
      size?.every((axis) => axis > 0 && axis <= textureBudget),
      "Palette textures must fit within 256 × 256.",
    );
  }
}

function countTriangles(scene, vehicle) {
  let triangles = 0;
  let tail = false;
  let head = false;
  let sign = false;
  const position = [];
  const mask = [];

  scene.traverse((node) => {
    const world = node.getWorldMatrix();
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      const positions = primitive.getAttribute("POSITION");
      const indices = primitive.getIndices();
      const count = indices?.getCount() ?? positions?.getCount();
      invariant(
        positions && primitive.getMode() === Primitive.Mode.TRIANGLES && count && count % 3 === 0,
        "Expected a nonempty triangle mesh.",
      );
      triangles += count / 3;

      if (!vehicle) continue;
      const colors = primitive.getAttribute("COLOR_0");
      invariant(
        colors && colors.getElementSize() >= 3 && colors.getCount() === positions.getCount(),
        "Vehicle vertices need an RGB light mask.",
      );
      for (let i = 0; i < count; i++) {
        const vertex = indices?.getScalar(i) ?? i;
        colors.getElement(vertex, mask);
        positions.getElement(vertex, position);
        const z =
          world[2] * position[0] + world[6] * position[1] + world[10] * position[2] + world[14];
        if (mask[0] > 0.5) {
          invariant(z > 0, "Red tail-light vertices must face the +Z end of the vehicle.");
          tail = true;
        }
        if (mask[1] > 0.5) {
          invariant(z < 0, "Green headlight vertices must face the −Z end of the vehicle.");
          head = true;
        }
        sign ||= mask[2] > 0.5;
      }
    }
  });

  invariant(triangles > 0, "The scene contains no triangle mesh.");
  if (vehicle) {
    invariant(tail && head, "Missing red tail-light or green headlight vertices.");
    invariant(!vehicle.sign || sign, "Missing blue beacon or sign vertices.");
  }
  return triangles;
}

function validateVehicleBounds(bounds, vehicle) {
  const { min, max } = bounds;
  const expected = [
    [0, vehicle.width],
    [2, vehicle.length],
  ];
  for (const [axis, footprint] of expected) {
    const actual = max[axis] - min[axis];
    invariant(
      Math.abs(actual - footprint) <= footprint * footprintTolerance,
      `Footprint ${axis === 0 ? "width" : "length"} is ${actual.toFixed(3)} m, expected ${footprint} m ±5%.`,
    );
    invariant(
      Math.abs((max[axis] + min[axis]) / 2) <= originTolerance,
      "The footprint must be centered on the origin.",
    );
  }
  invariant(Math.abs(min[1]) <= originTolerance, "The base must sit at ground level.");
}

async function verifyModel(name, bytes) {
  const vehicle = vehicleRules.get(name);
  const building = /^bld_(low|mid|tall|roof)_\d+\.glb$/.test(name);
  invariant(
    vehicle || building || /^prop_[a-z][a-z0-9_]*\.glb$/.test(name),
    "Model filename does not match the asset naming convention.",
  );
  invariant(bytes.length <= fileBudget, `File size ${bytes.length} B exceeds ${fileBudget} B.`);

  const document = await io.readBinary(bytes);
  const root = document.getRoot();
  invariant(
    root
      .listExtensionsUsed()
      .some((extension) => extension.extensionName === "EXT_meshopt_compression"),
    "Model is missing meshopt compression.",
  );
  const scene = root.getDefaultScene();
  invariant(scene && root.listScenes().length === 1, "Expected one default scene.");
  const triangles = countTriangles(scene, vehicle);
  const triangleBudget = vehicle?.triangles ?? (building ? 200 : Infinity);
  invariant(
    triangles <= triangleBudget,
    `${triangles} triangles exceeds the budget of ${triangleBudget}.`,
  );

  const bounds = getBounds(scene);
  if (vehicle) validateVehicleBounds(bounds, vehicle);
  validateTextures(root);
  const point = (values) => values.map((value) => value.toFixed(3)).join(", ");
  return `${name}  ${triangles} triangles  [${point(bounds.min)}] → [${point(bounds.max)}] m  ${bytes.length} B`;
}

export async function verifyModels(models) {
  for (const [name, rule] of vehicleRules) {
    invariant(
      !rule.required || models.has(name),
      `Missing ${name}. Run npm run assets:placeholders and npm run assets:build.`,
    );
  }

  let total = 0;
  for (const [name, bytes] of models) {
    try {
      console.log(await verifyModel(name, bytes));
    } catch (error) {
      throw new Error(`${name}: ${error.message}`, { cause: error });
    }
    total += bytes.length;
  }
  invariant(total <= totalBudget, `Model set size ${total} B exceeds ${totalBudget} B.`);
  console.log(`${models.size} models, ${total} B total`);
}
