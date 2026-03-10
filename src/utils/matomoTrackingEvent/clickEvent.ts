/**
 * @description: 功能点击行为
 */
import { trackEvent } from "./trackingMatomoEvent.ts";

//  已添加
// 点击快捷创作短篇
// const trackingQuickCreationShort = () => {
//   trackEvent("Story Creation", "Click", "Quick New");
// };

//  已添加
// 点击创作短篇
// const trackingCreationStory = () => {
//   trackEvent("Story Creation", "Click", "New");
// };

export type CreateWorkName =
  | "Quick New from Landing"
  | "Common New from Landing"
  | "Quick New from Sidebar"
  | "Common New from Sidebar"
  | "Quick New from Workspace"
  | "Common New from Workspace"
  | "Common New from Chat";

//已添加 2025-1-29
// 点击创建新作品埋点
const trackingCreateNewWork = (name: CreateWorkName) => {
  trackEvent("Story Creation", "Click", name);
};
//  已添加
// 点击快捷创作短剧
const trackingQuickCreationDrama = () => {
  trackEvent("Drama Creation", "Click", "New");
};

//  已添加
// 点击发送对话消息
const trackingChatSendMessage = () => {
  trackEvent("AI Chat", "Generate", "Message Send");
};

//  已添加
// 快捷创作生成
const trackingQuickCreationGenerate = (
  name: "Brief" | "Character" | "Outline" | "Detailed Outline" | "Chapter",
) => {
  trackEvent("Quick Creation", "Generate", name);
};

//  已添加
// 左侧目录编辑事件
const trackingEditPageLeftSidebarOperation = (
  editType: "rename" | "add" | "delete",
  itemType: "Folder" | "File",
  data: { [key: string]: any },
) => {
  let eventName = "add_directory_item";
  switch (editType) {
    case "rename":
      eventName = "rename_directory_item";
      break;
    case "add":
      eventName = "add_directory_item";
      trackEvent("Directory", "Add", itemType);
      break;
    case "delete":
      eventName = "delete_directory_item";
      break;
  }
};

// 划词生成相关 修改、扩写、生图 Generate
// 划词使用相关 修改、扩写、添加到对话、生图 Use
// 2x3个埋点
const trackingEditorTool = (action: "Generate" | "Use", name: "Rewrite" | "Expand" | "Picture") => {
  trackEvent("Editor Tool", action, name);
};

type TrackingGuidedWritingClickName =
  'Custom Write from Tool'
  | 'Template Write from Tool'
  | 'Tag Write from Tool'
  | 'Template Write from Popup'
  | 'Tag Write from Popup'
  | 'Custom Write from Edit'
  | 'Template Write from Edit'
  | 'Tag Write from Edit'

// 带我写使用相关 点击自定义、模板、标签带我写
const trackingGuidedWritingClick = (name: TrackingGuidedWritingClickName) => {
  trackEvent("Guided Writing", "Start", name);
};

const trackingGuidedWritingStart = (name: 'Mode' | 'Content' | 'Protagonist' | 'Story' | 'Guided Writing') => {
  trackEvent("Guided Writing", "Start", name);
};

const trackingGuidedWritingComplete = () => {
  trackEvent("Guided Writing", "Complete", 'End');
};

// 工具使用点击 使用大纲、设定、角色、导语、正文、拆书、文风点击    Click
// 工具生成点击 点击大纲、设定、角色、导语、正文、拆书、文风工具生成 Generate
// 工具使用确认 点击大纲、设定、角色、导语、正文、拆书、文风结果确认 Use
// 注意 3X6 个埋点
const trackingAITool = (
  action: "Click" | "Generate" | "Use",
  name:
    | "Outline"
    | "Worldview"
    | "Character"
    | "Lead"
    | "Chapter"
    | "Book Analysis"
    | "Style Analysis"
    | "Guided Writing"
) => {
  trackEvent("AI Tool", action, name);
};

// 社区埋点 分享，提示词 Share/Prompt
// 点击分享详情Click 创建分享Create
//点击提示词详情Click 使用提示词Use 点击创建提示词Create（name特殊为Prompt Workflow）
// 注意 3X6 个埋点
const trackingCommunity = (
  action: "Click" | "Create" | "Use",
  name: "Share" | "Prompt" | "Prompt Workflow",
) => {
  trackEvent("Community", action, name);
};

// 拆书文风
// 点击拆书仿写模块的文件上传 Generate    Book Analysis
// 拆书结果页面点击立即仿写   Use         Book Analysis
// 点击文风提取模块的文件上传 Generate    Style Analysis
// 文风结果页面点击保存      Use         Style Analysis
const trackingDashboard = (
  action: "Generate" | "Use" | 'Click',
  name: "Book Analysis" | "Style Analysis",
) => {
  trackEvent("Dashboard", action, name);
};


export {
  trackingEditPageLeftSidebarOperation,
  trackingCreateNewWork,
  // trackingQuickCreationShort,
  // trackingCreationStory,
  trackingQuickCreationDrama,
  trackingChatSendMessage,
  trackingEditorTool,
  trackingGuidedWritingClick,
  trackingGuidedWritingStart,
  trackingGuidedWritingComplete,
  trackingAITool,
  trackingQuickCreationGenerate,
  trackingCommunity,
  trackingDashboard,
};
