import React from "react";

type DeleteNodeOptions = {
  skipLayout?: boolean;
};

export interface InsCanvasHandlers {
  handleMainCardCreate: (nodeId: string) => void;
  handleAddCardToDialog: (nodeId: string) => void;
  handleAddGroupToDialog: (groupNodeId: string) => void;
  handlePrepareGenerateToDialog: (
    nodeId: string,
    outputType: "auto" | "brainstorm" | "role" | "summary" | "outline" | "info",
    options?: {
      files?: Record<string, string>;
      title?: string;
    }
  ) => void;
  handlePrepareBrainstormCard: (nodeId: string) => void;
  handleGroupDelete: (nodeId: string, options?: DeleteNodeOptions) => void;
  handleGenerateIns: (
    nodeId: string,
    outputType: "auto" | "brainstorm" | "role" | "summary" | "outline" | "info",
    options?: {
      files?: Record<string, string>;
      title?: string;
    }
  ) => void;

  handleRoleExpandRandom: (nodeId: string) => void;
  handleGenerateSummaryFromContext: (nodeId: string) => void;
  handleGenerateOutlineFromContext: (
    nodeId: string,
    options?: {
      chapterNum?: number;
      requirement?: string;
      files?: Record<string, string>;
      title?: string;
    }
  ) => void;
  handleGenerateInfoFromContext: (
    nodeId: string,
    options?: {
      files?: Record<string, string>;
      title?: string;
    }
  ) => void;

  // 可从任意节点派生创建新卡片；opts 仅部分场景使用（如“脑洞 -> 生成角色/梗概”）
  handleSummaryAdd: (
    nodeId: string,
    opts?: {
      label?: string;
      generateLabel?: string;
      allowTitleEdit?: boolean;
      allowImageUpload?: boolean;
      title?: string;
      content?: string;
      image?: string;
      isStreaming?: boolean;
      fromApi?: boolean;
    }
  ) => void;
  handleSettingAdd: (
    nodeId: string,
    opts?: {
      label?: string;
      generateLabel?: string;
      allowTitleEdit?: boolean;
      allowImageUpload?: boolean;
      title?: string;
      content?: string;
      image?: string;
      isStreaming?: boolean;
      fromApi?: boolean;
    }
  ) => void;
  handleOutlineAdd: (
    nodeId: string,
    opts?: {
      label?: string;
      generateLabel?: string;
      allowTitleEdit?: boolean;
      allowImageUpload?: boolean;
      title?: string;
      content?: string;
      image?: string;
      isStreaming?: boolean;
      fromApi?: boolean;
    }
  ) => void;
  handleSummaryGenerate: (nodeId: string) => void;
  handleSummaryDelete: (nodeId: string, options?: DeleteNodeOptions) => void;
  handleSummaryUpdate: (nodeId: string, content: string) => void;
  handleSummaryExpand: (nodeId: string) => void;
  handleSettingGenerate: (nodeId: string) => void;
  handleSettingDelete: (nodeId: string, options?: DeleteNodeOptions) => void;
  handleSettingUpdate: (nodeId: string, content: string) => void;
  handleSettingExpand: (nodeId: string) => void;
  handleOutlineGenerate: (nodeId: string) => void;
  handleOutlineDelete: (nodeId: string, options?: DeleteNodeOptions) => void;
  handleOutlineUpdate: (nodeId: string, content: string) => void;
  handleOutlineExpand: (nodeId: string) => void;
  getCanvasSessionId: () => string;
  msg: (type: "success" | "error" | "warning", msg: string) => void;
}

const defaultValue: InsCanvasHandlers = {
  handleMainCardCreate: () => {},
  handleAddCardToDialog: () => {},
  handleAddGroupToDialog: () => {},
  handlePrepareGenerateToDialog: () => {},
  handlePrepareBrainstormCard: () => {},
  handleGroupDelete: () => {},
  handleGenerateIns: () => {},
  handleRoleExpandRandom: () => {},
  handleGenerateSummaryFromContext: () => {},
  handleGenerateOutlineFromContext: () => {},
  handleGenerateInfoFromContext: () => {},
  handleSummaryGenerate: () => {},
  handleSummaryAdd: () => {},
  handleSummaryDelete: () => {},
  handleSummaryUpdate: () => {},
  handleSummaryExpand: () => {},
  handleSettingGenerate: () => {},
  handleSettingAdd: () => {},
  handleSettingDelete: () => {},
  handleSettingUpdate: () => {},
  handleSettingExpand: () => {},
  handleOutlineGenerate: () => {},
  handleOutlineAdd: () => {},
  handleOutlineDelete: () => {},
  handleOutlineUpdate: () => {},
  handleOutlineExpand: () => {},
  getCanvasSessionId: () => "",
  msg: () => {},
};

export const InsCanvasContext = React.createContext<InsCanvasHandlers>(defaultValue);

export const useInsCanvasHandlers = () => {
  return React.useContext(InsCanvasContext);
};
