import apiClient, { type RequestConfig, type PostStreamData } from "./index";

const getWritingTemplatesListReq = (page: number, pageSize: number) => {
  return apiClient.get("/api/writing-templates", { page, pageSize });
};

const getWritingTemplateStorm = (content: string, tagIds: string[]) => {
  return apiClient.post("/api/works/brain-storm", {
    templateContent: content,
    tagIds,
  });
};

const getTemplateTags = () => {
  return apiClient.get("/api/works/template-tags");
};

const updateTemplateWorkFlowArr = (workId: string, workFlowArr: any[]) => {
  return apiClient.post(`/api/works/template-creations/${workId}`, {
    content: JSON.stringify(workFlowArr),
  });
};

export interface RoleSettingReqData {
  description?: string;
  theme?: string;
  brainStorm?: {
    title?: string;
    intro?: string;
  };
  roleCard?: any;
  outline?: string;
}

const postTemplateRoleSetting = async (data: RoleSettingReqData) => {
  return apiClient.post("/api/works/template-creation/role-setting", { ...data });
};

export interface PostTemplateStreamData {
  workId: string | number;
  targetStage?: string;
  description?: string;
  theme?: string;
  brainStorm?: {
    title: string;
    intro: string;
  };
  outline?: string;
  roleSetting?: string;
  chapterIndex?: number;
  existingChapters?: string;
  existingParas?: string[];
  mode?: string;
  chapterNumber: number;
  roleCard?: any;
}

const postTemplateStream = (
  data: PostTemplateStreamData,
  onData: (data: PostStreamData) => void,
  onError: (error: any) => void,
  onComplete: () => void,
  config?: { signal?: AbortSignal }
) => {
  return apiClient.postStream(
    "/api/works/chat/template-stream",
    data,
    onData,
    onError,
    onComplete,
    config as RequestConfig
  );
};

export interface PostDocTemplateStreamOutlineRequestData {
  description: string;
  brainStorm: { title: string; intro: string };
  roleCard: Record<string, unknown>;
  chapterNum: number;
}

const postDocTemplateStreamOutline = (
  data: PostDocTemplateStreamOutlineRequestData,
  onData: (data: PostStreamData) => void,
  onError: (error: any) => void,
  onComplete: () => void,
  config?: { signal?: AbortSignal }
) => {
  return apiClient.postStream(
    "api/works/doc/outline",
    data,
    onData,
    onError,
    onComplete,
    config as RequestConfig
  );
};

export interface PostDocTemplateStreamDetailedOutlineRequestData {
  description: string;
  brainStorm: { title: string; intro: string };
  roleCard: Record<string, unknown>;
  chapterOutline: {
    chapter: string;
    chapterNote: string;
    chapterTitle: string;
  };
  existingDetailedOutlines: string[];
  existingChapters: string;
}

const postDocTemplateStreamDetailedOutline = (
  data: PostDocTemplateStreamDetailedOutlineRequestData,
  onData: (data: PostStreamData) => void,
  onError: (error: any) => void,
  onComplete: () => void,
  config?: { signal?: AbortSignal }
) => {
  return apiClient.postStream(
    "api/works/doc/detailed-outline",
    data,
    onData,
    onError,
    onComplete,
    config as RequestConfig
  );
};

export interface PostDocTemplateStreamContentRequestData {
  description: string;
  brainStorm: { title: string; intro: string };
  roleCard: Record<string, unknown>;
  chapterOutline: {
    chapter: string;
    chapterNote: string;
    chapterTitle: string;
  };
  chapterDetailOutline: string;
  existingChapters: string;
  wordCount: number;
}

const postDocTemplateStreamContent = (
  data: PostDocTemplateStreamContentRequestData,
  onData: (data: PostStreamData) => void,
  onError: (error: any) => void,
  onComplete: () => void,
  config?: { signal?: AbortSignal }
) => {
  return apiClient.postStream(
    "api/works/chat/doc/writing",
    data,
    onData,
    onError,
    onComplete,
    config as RequestConfig
  );
};

export interface PostScriptTemplateStreamPlotRequestData {
  attachmentName: string;
  wordCount: number;
  chapterNum: number;
}

const postScriptTemplateStreamPlot = (
  data: PostScriptTemplateStreamPlotRequestData,
  onData: (data: PostStreamData) => void,
  onError: (error: any) => void,
  onComplete: () => void,
  config?: { signal?: AbortSignal }
) => {
  return apiClient.postStream(
    "api/works/script/plot",
    data,
    onData,
    onError,
    onComplete,
    config as RequestConfig
  );
};

export {
  getWritingTemplatesListReq,
  getWritingTemplateStorm,
  getTemplateTags,
  updateTemplateWorkFlowArr,
  postTemplateStream,
  postDocTemplateStreamOutline,
  postDocTemplateStreamDetailedOutline,
  postTemplateRoleSetting,
  postDocTemplateStreamContent,
  postScriptTemplateStreamPlot,
};
