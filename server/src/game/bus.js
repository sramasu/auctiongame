// Tiny pub/sub so the engine stays independent from the socket layer.
const handlers = new Set();

export function onRoomEvent(fn) {
  handlers.add(fn);
  return () => handlers.delete(fn);
}

export function emitRoom(room, event, data = {}) {
  for (const fn of handlers) {
    try {
      fn(room, event, data);
    } catch (err) {
      console.error("[bus] handler failed", err);
    }
  }
}
