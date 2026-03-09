import apiClient, { type RequestConfig } from "./index";
import type { CreateWorkType } from "./generate-dialog";

export type WorkInfoStage = string;

const getWorksListReq = (page: number, pageSize: number = 20) => {
  return apiClient.get("/api/works", { page, size: pageSize });
};

const createWorkReq = (type: CreateWorkType = "editor") => {
  return apiClient.post("/api/works", { type });
};

const getWorksByIdReq = (workId: string) => {
  return apiClient.get(`/api/works/${workId}`);
};

const getSessionHistoryReq = (workId: string, sessionId: string) => {
  return apiClient.get(`/api/works/${workId}/session/${sessionId}/history`);
};

const deleteSessionReq = (workId: string, sessionId: string) => {
  return apiClient.del(`/api/works/${workId}/session/${sessionId}`);
};

const getWorksByIdAndVersionReq = (workId: string, versionId: string) => {
  return apiClient.get(`/api/works/${workId}/versions/${versionId}`);
};

const deleteWorkReq = (workId: string) => {
  return apiClient.del(`/api/works/${workId}`);
};

const batchDeleteWorkReq = (workIds: string[]) => {
  return apiClient.del(`/api/works/batch`, { data: workIds });
};

const generateGuideReq = (
  sessionId: string,
  workId: number,
  config?: RequestConfig
) => {
  return apiClient.post(
    "/api/works/guide",
    { sessionId, workId },
    config
  );
};

const getWorkTagsReq = () => {
  return apiClient.get("/api/works/tags/editor");
};

const getScriptSelectedTagsReq = (novelPlot: string) => {
  return apiClient.post("/api/works/script/tag", { novelPlot });
};

const getScriptStorySynopsisReq = (novelPlot: string, description: string) => {
  return apiClient.post("/api/works/script/brain-storm", {
    novelPlot,
    description,
  });
};

const updateWorkInfoReq = async (
  workId: string,
  data: {
    title?: string;
    introduction?: string;
    stage?: WorkInfoStage;
    background?: string;
    tagIds?: number[];
    description?: string;
    userId?: string;
    chapterNum?: number;
    wordNum?: number;
  }
) => {
  return apiClient.put(`/api/works/${workId}`, data);
};

const generateBrainstormReq = (tagIds: number[]) => {
  return apiClient.post("/api/works/brain-storm", { tagIds });
};

const generateInspirationReq = (inspiration?: string) => {
  return apiClient.post("/api/works/inspiration", {
    inspiration: inspiration != "" ? inspiration : undefined,
  });
};

interface GenerateInspirationImageReqData {
  inspirationWord: string;
  inspirations: {
    inspirationTheme: string;
    referenceStyle: string;
  }[];
}

const generateInspirationImageReq = (data: GenerateInspirationImageReqData) => {
  return apiClient.post("/api/works/inspiration-image", {
    inspirationWord: data.inspirationWord,
    inspirations: data.inspirations,
  });
};

interface PostInspirationStreamData {
  inspirationWord: string;
  inspirationTheme: string;
  shortSummary?: string;
  storySetting?: string;
  modelEndpoint?: string;
  sessionId?: string;
}

const postInspirationStream = (
  data: PostInspirationStreamData,
  onData: (data: any) => void,
  onError: (error: any) => void,
  onComplete: () => void
) => {
  return apiClient.postStream(
    "/api/works/inspiration-stream",
    data,
    onData,
    onError,
    onComplete
  );
};

const generateInspirationDrawIdReq = (
  workId: string,
  canvas: { nodes: any; edges: any }
): Promise<{ id: string }> => {
  return apiClient.post("/api/works/inspiration-draw", {
    workId,
    content: JSON.stringify(canvas),
  });
};

/** 更新灵感画布内容（PUT） */
const updateInspirationDrawReq = (
  inspirationDrawId: string,
  canvas: { nodes: any; edges: any }
) => {
  return apiClient.put(`/api/works/inspiration-draw/${inspirationDrawId}`, {
    content: JSON.stringify(canvas),
  });
};

/** 保存灵感画布数据（POST，InsCanvas 等使用） */
const saveInspirationCanvasReq = (
  inspirationDrawId: string | number,
  canvas: { nodes: unknown[]; edges: unknown[] },
) => {
  return apiClient.put(`/api/works/inspiration-draw/${inspirationDrawId}`, {
    content: JSON.stringify(canvas),
  });
};

const messageLikeReq = (messageId: string, likeValue: 1 | 2) => {
  return apiClient.post("/api/works/message/like", {
    messageId,
    likeValue,
  });
};

export interface SentimentAnalysisItem {
  sentiment: string;
  emoji: string;
  originalText: string;
}

const sentimentAnalysisReq = (text: string): Promise<SentimentAnalysisItem[]> => {
  return apiClient.post("/api/works/sentiment-analysis", { text });
};

const updateWorkVersionReq = async (
  workId: string | number,
  content: string,
  saveStatus: "0" | "1" | "2"
) => {
  return apiClient.post(`/api/works/${workId}/versions`, {
    content,
    saveStatus,
  });
};

const addCustomTagReq = (
  categoryId: string,
  tagName: string,
  tagType: "editor" | "script" = "editor"
) => {
  return apiClient.post("/api/works/tags", {
    categoryId,
    tagName,
    tagType,
  });
};

const delCustomTagReq = (tagId: string) => {
  return apiClient.del(`/api/works/tags/${tagId}`);
};

const generateInspirationReqNew = (inspiration?: string) => {
  return apiClient.post("/api/works/inspiration", {
    inspiration: inspiration != "" ? inspiration : undefined,
  });
};

const exportRecordReq = () => {
  return apiClient.post("/api/works/export-record")
}

export {
  getWorksListReq,
  createWorkReq,
  deleteWorkReq,
  getWorksByIdReq,
  getWorksByIdAndVersionReq,
  getSessionHistoryReq,
  deleteSessionReq,
  generateGuideReq,
  getWorkTagsReq,
  getScriptSelectedTagsReq,
  getScriptStorySynopsisReq,
  updateWorkInfoReq,
  generateBrainstormReq,
  generateInspirationReq,
  generateInspirationReqNew,
  generateInspirationImageReq,
  postInspirationStream,
  generateInspirationDrawIdReq,
  saveInspirationCanvasReq,
  updateInspirationDrawReq,
  messageLikeReq,
  sentimentAnalysisReq,
  updateWorkVersionReq,
  addCustomTagReq,
  delCustomTagReq,
  batchDeleteWorkReq,
  exportRecordReq
};

