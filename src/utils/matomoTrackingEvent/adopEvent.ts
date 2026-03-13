/**
 * @description: 编辑&内容采纳（结果导向）
 */

import { trackEvent } from "./trackingMatomoEvent.ts";

// 已添加
// 作品保存埋点，参数中有saveStatus字段，EditorSaveStatus = "0" | "1" | "2"; //0: 手动保存 1: 自动保存 2: 消息发送前保存
const trackingWorkInfoSave = (data: { [key: string]: any }) => {
  // 手动保存埋点
  if (data.save_status == "0") {
    trackEvent("Content", "Save", "Draft");
  }
};

// 已添加
//作品信息导出
const trackingWorkInfoExport = () => {
  trackEvent("Content", "Export", "Article");
};

export { trackingWorkInfoSave, trackingWorkInfoExport };
