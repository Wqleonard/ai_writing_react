import React from "react";
import type { InsCanvasHandlers } from "@/components/InsCanvasV2/types";

const defaultValue: InsCanvasHandlers = {
  handleMainCardCreate: () => {},
  handleAddCardToDialog: () => {},
  handleAddGroupToDialog: () => {},
  requestOpenFileByPath: () => {},
  handlePrepareGenerateToDialog: () => {},
  handlePrepareBrainstormCard: () => {},
  handleGroupDelete: () => {},
  handleGenerateIns: () => {},
  handleGenerateOutlineFromContext: () => {},
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
