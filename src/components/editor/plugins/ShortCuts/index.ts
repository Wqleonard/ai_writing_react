import type { EditorPlugin } from "../../types";

export function shortcutsPlugin(): EditorPlugin {
  return {
    id: "shortcuts",
    // 挂载插件
    onMount(ctx) {
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.ctrlKey && e.key.toLowerCase() === "s") {
          e.preventDefault();
          ctx.bus.emit("shortcut:save");
        }
      };
      // 监听键盘事件
      window.addEventListener("keydown", onKeyDown);
      ctx.addDisposer(() => window.removeEventListener("keydown", onKeyDown));
    },
  };
}