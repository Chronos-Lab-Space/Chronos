export type ChronosEventType =
  | "SimulationFinished"
  | "DecisionRanked"
  | "MemoryUpdated"
  | "UIUpdated"
  | "TaskStarted"
  | "TaskCompleted"
  | "TaskFailed"
  | "GraphCompleted";

export type ChronosEvent<T = Record<string, unknown>> = {
  type: ChronosEventType;
  payload: T;
  at: string;
};

export type EventHandler<T = Record<string, unknown>> = (
  event: ChronosEvent<T>
) => void | Promise<void>;

/** In-process pub/sub. Services emit events; they do not call each other. */
export class EventBus {
  private readonly handlers = new Map<ChronosEventType | "*", Set<EventHandler>>();

  subscribe<T = Record<string, unknown>>(
    type: ChronosEventType | "*",
    handler: EventHandler<T>
  ): () => void {
    const set = this.handlers.get(type) ?? new Set();
    set.add(handler as EventHandler);
    this.handlers.set(type, set);
    return () => {
      set.delete(handler as EventHandler);
    };
  }

  async publish<T = Record<string, unknown>>(
    type: ChronosEventType,
    payload: T
  ): Promise<void> {
    const event: ChronosEvent<T> = {
      type,
      payload,
      at: new Date().toISOString(),
    };
    const targets = [
      ...(this.handlers.get(type) ?? []),
      ...(this.handlers.get("*") ?? []),
    ];
    for (const handler of targets) {
      await handler(event as ChronosEvent);
    }
  }
}

export const eventBus = new EventBus();
