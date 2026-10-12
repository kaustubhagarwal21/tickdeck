/**
 * A minimal listener list, shared by both feeds to implement
 * MarketFeed.onMessage: `on` adds a listener and returns a function that
 * removes it, and `emit` calls every current listener.
 */
export function createEmitter<T>() {
  const listeners = new Set<(value: T) => void>();

  return {
    on(listener: (value: T) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    emit(value: T): void {
      listeners.forEach((listener) => listener(value));
    },
  };
}
