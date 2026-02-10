import type { EditorEventBus } from "./types";

export function createEventBus(): EditorEventBus {
  const listeners = new Map<string, Set<(payload: any) => void>>();

  return {
    // 触发事件
    emit(event, payload) {
      const set = listeners.get(event);
      if (!set) return;
      for (const handler of set) handler(payload);
    },
    // 监听事件
    on(event, handler) {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(handler);
      return () => {
        set?.delete(handler);   
        if (set && set.size === 0) listeners.delete(event);
      };
    },
    // 一次性监听事件
    once(event, handler) {
      const off = this.on(event, (payload) => {
        off();
        handler(payload);
      });
      return off;
    }
  };
}