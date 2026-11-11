import { Worker } from "node:worker_threads";
import type { EpisodeOutcome, Evaluation } from "./episode";
import type { WorkRequest, WorkResponse } from "./training-worker";

interface Job {
  request: WorkRequest;
  resolve: (outcomes: EpisodeOutcome[]) => void;
  reject: (error: Error) => void;
}

interface Slot {
  worker: Worker;
  current?: Job;
}

export class TrainingPool {
  private readonly slots: Slot[] = [];
  private readonly queue: Job[] = [];
  private serial = 0;
  private stopped?: Error;

  constructor(size: number) {
    for (let i = 0; i < size; i++) {
      const worker = new Worker(new URL("./training-worker.mjs", import.meta.url));
      const slot: Slot = { worker };
      worker.on("message", (message: WorkResponse) => {
        const job = slot.current;
        if (!job || message.id !== job.request.id) return;
        slot.current = undefined;
        if ("error" in message) job.reject(new Error(message.error));
        else job.resolve(message.outcomes);
        this.dispatch();
      });
      worker.on("error", (error) => this.stop(error));
      worker.on("exit", (code) => {
        if (!this.stopped) this.stop(new Error(`Training worker exited with status ${code}`));
      });
      this.slots.push(slot);
    }
  }

  evaluate(evaluation: Evaluation): Promise<EpisodeOutcome[]> {
    if (this.stopped) return Promise.reject(this.stopped);
    return new Promise((resolve, reject) => {
      this.queue.push({ request: { id: this.serial++, evaluation }, resolve, reject });
      this.dispatch();
    });
  }

  async close(): Promise<void> {
    this.stop(new Error("Training worker pool closed"));
    await Promise.all(this.slots.map(({ worker }) => worker.terminate()));
  }

  private dispatch(): void {
    if (this.stopped) return;
    for (const slot of this.slots) {
      if (slot.current || this.queue.length === 0) continue;
      slot.current = this.queue.shift();
      slot.worker.postMessage(slot.current?.request);
    }
  }

  private stop(error: Error): void {
    if (this.stopped) return;
    this.stopped = error;
    for (const job of this.queue) job.reject(error);
    this.queue.length = 0;
    for (const slot of this.slots) slot.current?.reject(error);
  }
}
