import type { EditorCtx, EditorPlugin, EditorRef } from "./types";
import { createEventBus } from "./EventBus";

export interface CreateEditorHostArgs {
  plugins: EditorPlugin[];
  ctxBase: Omit<EditorCtx, "bus" | "addDisposer" | "registerCommands">;
}

export function createEditorHost(args: CreateEditorHostArgs) {
  const bus = createEventBus();
  // 存储 disposers
  const disposers: Array<() => void> = [];
  // 存储 commands
  const commandsByPlugin = new Map<string, Record<string, (...args: any[]) => any>>();

  // 添加 disposer
  const addDisposer = (fn: () => void) => disposers.push(fn);
  
  // 注册 commands 给 pluginId 对应的 commands
  const registerCommands = (pluginId: string, commands: Record<string, (...args: any[]) => any>) => {
    commandsByPlugin.set(pluginId, commands);
  };

  const ctx: EditorCtx = {
    ...args.ctxBase,
    bus,
    addDisposer,
    registerCommands,
  };

  // 装配（类似 tiptap: extensions -> setup -> commands）
  const plugins = [...args.plugins].sort((a, b) => (a.id > b.id ? 1 : -1));

  async function setup() {
    // 装配 plugins
    for (const p of plugins) {
      await p.setup?.(ctx);
      const cmds = p.commands?.(ctx);
      if (cmds) registerCommands(p.id, cmds);
    }
  }

  async function mount() {
    // 挂载 plugins
    for (const p of plugins) await p.onMount?.(ctx);
  }

  function unmount() {
    // 卸载 plugins
    for (const p of plugins) p.onUnmount?.(ctx);
    for (const dispose of disposers.splice(0)) dispose();
  }

  // 获取 commands
  const getCommands = () => {
    const merged: Record<string, (...args: any[]) => any> = {};
    for (const [, cmds] of commandsByPlugin) Object.assign(merged, cmds);
    return merged;
  };

  // 获取编辑器 ref
  const getRef = (): EditorRef => ({
    commands: getCommands(),
    // 获取编辑器状态
    getState: () => ctx.getState(),
    // 事件总线
    bus,
  });

  return { ctx, setup, mount, unmount, getRef };
}