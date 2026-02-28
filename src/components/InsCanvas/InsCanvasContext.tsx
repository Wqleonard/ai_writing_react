import React from "react";

export interface InsCanvasHandlers {
  handleMainCardCreate: (nodeId: string) => void;
  handleSummaryGenerate: (nodeId: string) => void;
  handleSummaryAdd: (nodeId: string) => void;
  handleSummaryDelete: (nodeId: string) => void;
  handleSummaryUpdate: (nodeId: string, content: string) => void;
  handleSettingGenerate: (nodeId: string) => void;
  handleSettingAdd: (nodeId: string) => void;
  handleSettingDelete: (nodeId: string) => void;
  handleSettingUpdate: (nodeId: string, content: string) => void;
  handleSettingExpand: (nodeId: string) => void;
  handleOutlineGenerate: (nodeId: string) => void;
  handleOutlineAdd: (nodeId: string) => void;
  handleOutlineDelete: (nodeId: string) => void;
  handleOutlineUpdate: (nodeId: string, content: string) => void;
  handleOutlineExpand: (nodeId: string) => void;
}

const defaultValue: InsCanvasHandlers = {
  handleMainCardCreate: () => {},
  handleSummaryGenerate: () => {},
  handleSummaryAdd: () => {},
  handleSummaryDelete: () => {},
  handleSummaryUpdate: () => {},
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
};

export const InsCanvasContext = React.createContext<InsCanvasHandlers>(defaultValue);

export const useInsCanvasHandlers = () => {
  return React.useContext(InsCanvasContext);
};
