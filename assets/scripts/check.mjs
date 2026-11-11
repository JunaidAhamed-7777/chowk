import { loadModels, modelDirectory, verifyModels } from "./models.mjs";

await verifyModels(await loadModels(modelDirectory));
