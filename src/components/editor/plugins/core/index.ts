import type { EditorContentType, EditorContentValue, EditorPlugin } from "../../types";

export function corePlugin(): EditorPlugin {
  return {
    id: "core",
    setup(ctx) {
      // 初始化默认状态
      const s = ctx.getState();
      if (s.isEditorEditable === undefined) {
        ctx.setState({ isEditorEditable: true });
      }
      if (s.currentContentType === undefined) {
        ctx.setState({ currentContentType: "markdown" });
      }
    },
    commands(ctx) {
      return {
        // 设置工作 ID
        setWorkId(workId: string) {
          ctx.setState({ workId });
          ctx.bus.emit("work:changed", { workId });
        },
        // 设置当前编辑 ID
        setCurrentEditingId(id: string) {
          ctx.setState({ currentEditingId: id });
          ctx.bus.emit("file:changed", { id });
        },
        // 设置当前编辑内容
        setContent(content: EditorContentValue, opts?: { contentType?: EditorContentType }) {
          const contentType = opts?.contentType ?? ctx.getState().currentContentType ?? "markdown";
          ctx.setState({ currentContent: content, currentContentType: contentType });
          ctx.bus.emit("content:changed", { content, contentType });
        },
        // 获取当前编辑内容
        getContent() {
          return ctx.getState().currentContent ?? "";
        },
      };
    },
  };
}