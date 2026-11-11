import holdoutData from "../networks/grid-holdout.json";
import { loadNetwork } from "./network";

export const holdoutNetwork = loadNetwork(holdoutData);
