import React from "react";
import { createRoot } from "react-dom/client";
import { GenerationSaveDialog } from "../components/Community/GenerationSaveDialog";

/**
 * 与 Vue 版本一致的返回数据结构
 */
export interface GenerationSaveResult {
  fileName: string;
  workType: "new" | "old";
  selectedWork: any | null;
  selectedPath: string | null;
}

export interface GenerationSaveOptions {
  fileNameDefault?: string;
  fileNamePlaceholder?: string;
  currentWorkId?: string;
}

const UNMOUNT_DELAY_MS = 300;

/**
 * 打开生成保存对话框（与 Vue showGenerationSaveDialog 用法一致）
 * @returns Promise：resolve 返回 { fileName, workType, selectedWork, selectedPath }；reject 表示用户取消
 */
export function showGenerationSaveDialog(
  options: GenerationSaveOptions = {}
): Promise<GenerationSaveResult> {
  return new Promise((resolve, reject) => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const root = createRoot(container);
    let open = true;
    let resolved = false;

    const onUnmount = () => {
      root.unmount();
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    };

    const finish = () => {
      open = false;
      renderDialog();
      setTimeout(onUnmount, UNMOUNT_DELAY_MS);
    };

    const handleConfirm = (result: GenerationSaveResult) => {
      if (resolved) return;
      resolved = true;
      resolve(result);
      finish();
    };

    const handleCancel = () => {
      if (resolved) return;
      resolved = true;
      reject(new Error("用户取消"));
      finish();
    };

    const renderDialog = () => {
      root.render(
        <GenerationSaveDialog
          open={open}
          onClose={handleCancel}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          fileNameDefault={options.fileNameDefault}
          fileNamePlaceholder={options.fileNamePlaceholder}
          currentWorkId={options.currentWorkId}
        />
      );
    };

    renderDialog();
  });
}
