import { useEffect, useState } from "react";
import { BufferAttribute, type BufferGeometry, Mesh } from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// Order matches the class values in simulator snapshots.
const models = ["twowheeler", "auto", "car", "lcv", "bus", "ambulance"];
const unloaded = models.map(() => null);
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const requests = new Map<string, Promise<BufferGeometry | null>>();

export function loadMeshAsset(model: string): Promise<BufferGeometry | null> {
  const pending = requests.get(model);
  if (pending) return pending;

  const request = loader
    .loadAsync(`${import.meta.env.BASE_URL}models/${model}.glb`)
    .then(({ scene }) => {
      scene.updateMatrixWorld(true);
      const mesh = scene.getObjectByProperty("isMesh", true);
      if (!(mesh instanceof Mesh)) throw new Error(`Missing mesh in asset ${model}`);
      const geometry: BufferGeometry = mesh.geometry;
      // Bake the node's quantization transform into floats so metre coordinates cannot wrap in Int16.
      for (const name of ["position", "normal"]) {
        const attribute = geometry.getAttribute(name);
        if (!attribute || attribute.array instanceof Float32Array) continue;
        const floats = new BufferAttribute(new Float32Array(attribute.count * 3), 3);
        for (let index = 0; index < attribute.count; index++) {
          floats.setXYZ(index, attribute.getX(index), attribute.getY(index), attribute.getZ(index));
        }
        geometry.setAttribute(name, floats);
      }
      geometry.applyMatrix4(mesh.matrixWorld);
      // COLOR_0 is the paint, trim, glass and lamp mask written by assets/blender/vehicles.py.
      const mask = geometry.getAttribute("color");
      if (mask && model.startsWith("veh_")) {
        geometry.setAttribute("mask", mask);
        geometry.deleteAttribute("color");
      }
      return geometry;
    })
    .catch(() => {
      requests.delete(model);
      return null;
    });
  requests.set(model, request);
  return request;
}

export function useVehicleGeometries(lowDetail = false): readonly (BufferGeometry | null)[] {
  const [geometries, setGeometries] = useState<readonly (BufferGeometry | null)[]>(unloaded);

  useEffect(() => {
    let mounted = true;
    const suffix = lowDetail ? "_lod1" : "";
    void Promise.all(models.map((model) => loadMeshAsset(`veh_${model}${suffix}`))).then(
      (loaded) => {
        if (mounted) setGeometries(loaded);
      },
    );
    return () => {
      mounted = false;
    };
  }, [lowDetail]);

  return geometries;
}
