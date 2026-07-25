/**
 * Worker queue scaffold (Phase 6 — later).
 * Planner enqueues work; workers drain with bounded concurrency.
 */

export type QueueJob<T = unknown> = {
  id: string;
  payload: T;
  enqueuedAt: string;
};

export type QueueWorker<T = unknown, R = unknown> = (job: QueueJob<T>) => Promise<R>;

export class WorkerQueue<T = unknown, R = unknown> {
  private readonly jobs: QueueJob<T>[] = [];

  constructor(
    private readonly worker: QueueWorker<T, R>,
    private readonly concurrency = 1
  ) {}

  enqueue(id: string, payload: T): QueueJob<T> {
    const job: QueueJob<T> = {
      id,
      payload,
      enqueuedAt: new Date().toISOString(),
    };
    this.jobs.push(job);
    return job;
  }

  size(): number {
    return this.jobs.length;
  }

  /** Drain queued jobs up to concurrency. Not yet used by product path. */
  async drain(): Promise<R[]> {
    const results: R[] = [];
    const limit = Math.max(1, this.concurrency);

    const next = async (): Promise<void> => {
      const job = this.jobs.shift();
      if (!job) return;
      results.push(await this.worker(job));
      await next();
    };

    await Promise.all(Array.from({ length: limit }, () => next()));
    return results;
  }
}
