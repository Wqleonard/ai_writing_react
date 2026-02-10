import type { EditorPlugin } from "../../types";

export function autosavePlugin(): EditorPlugin {
  return {
    id: "autosave",
    onMount(ctx) {
      const off1 = ctx.bus.on<{ content: unknown; contentType?: string }>("content:changed", () => {
        // 简化：真实项目里这里做 debounce + 调用 services.worksApi.save(...)
        // 同时在这里统一吞掉被取消的 promise
        console.log("[autosave] content changed -> save");   
      });

      const off2 = ctx.bus.on("shortcut:save", () => {
        // console.log("[autosave] Ctrl+S -> save now");
      });

      ctx.addDisposer(() => {
        off1();
        off2();
      });
    },
    commands(ctx) {
      return {
        save() {
          const s = ctx.getState();
          // console.log("[save]", s.workId, s.currentEditingId, (s.currentContent ?? "").length);
          ctx.bus.emit("save:requested", { state: s });
        },
      };
    },
  };
}