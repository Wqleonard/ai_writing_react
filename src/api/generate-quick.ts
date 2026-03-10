import apiClient, { type PostStreamData, type RequestConfig } from "./index";
import type { CreateWorkType } from "./generate-dialog";
import type { PostDocTemplateStreamOutlineRequestData } from "@/api/writing-templates.ts";

export interface CharacterCardData {
  title?: string;
  intro?: string;
  [key: string]: unknown;
}

export interface ScriptStorySynopsisResult {
  title?: string;
  synopsis?: string;
  background?: string;
  highlight?: string;
  informationGap?: string;
}

export interface ScriptSplitOutlineDict {
  episode: string;
  episode_title: string;
  episode_note: string;
}

export interface ScriptGenerateOutlineData {
  outline_dict: ScriptSplitOutlineDict[];
}

export interface PostScriptTemplateStreamSplitOutlineRequestData {
  novelPlot: string;
  description: string;
  brainStorm: ScriptStorySynopsisResult;
  roleCards: Array<{
    name?: string;
    definition?: string;
    age?: string;
    personality?: string;
    biography?: string;
  }>;
  episodeNum: number;
  episodeNumAndPart: string;
  existingEpisodes: string[];
}

export interface PostScriptTemplateStreamPlotRequestData {
  attachmentName: string;
  wordCount: number;
  chapterNum: number;
}

export interface PostScriptTemplateStreamContentRequestData {
  roleCards: Array<{
    name?: string;
    definition?: string;
    age?: string;
    personality?: string;
    biography?: string;
  }>;
  episodeDict: {
    episode?: string;
    episodeTitle?: string;
    episodeNote?: string;
  };
  existingPlots: string;
}

const getQuickCharacterSettings = (
  theme: string,
  description: string,
  type: CreateWorkType = "editor",
  brainStorm: { title: string; intro: string } = { title: "", intro: "" },
  config?: RequestConfig
) => {
  return apiClient.post(
    "/api/works/main-character",
    {
      theme,
      description,
      brainStorm,
      workType: type,
    },
    config
  );
};

const getQuickStoriesReq = (
  roleCard: CharacterCardData,
  templateContent: string,
  tagIds: string[],
  type: CreateWorkType = "editor",
  config?: RequestConfig
) => {
  return apiClient.post(
    "/api/works/brain-storm",
    {
      roleCard,
      templateContent,
      tagIds,
      workType: type,
    },
    config
  );
};

const postDocTemplateStreamOutline = (
  data: PostDocTemplateStreamOutlineRequestData,
  onData: (data: PostStreamData) => void,
  onError: (error: any) => void,
  onComplete: () => void,
  config?: { signal?: AbortSignal }
) => {
  return apiClient.postStream("/api/works/doc/outline", data, onData, onError, onComplete, config);
};

const getScriptCharacterSettings = (
  novelPlot: string,
  description?: string,
  brainStorm?: ScriptStorySynopsisResult,
  config?: RequestConfig
) => {
  return apiClient.post(
    "/api/works/script/role-setting",
    {
      novelPlot,
      description,
      brainStorm,
    },
    config
  );
};

const getScriptStorySynopsisReq = (
  novelPlot: string,
  description: string,
  config?: RequestConfig
) => {
  return apiClient.post(
    "/api/works/script/brain-storm",
    {
      novelPlot,
      description,
    },
    config
  );
};

const getScriptTagsReq = (config?: RequestConfig) => {
  return apiClient.get("/api/works/tags/script", undefined, config);
};

const getScriptSelectedTagsReq = (
  novelPlot: string,
  config?: RequestConfig
) => {
  return apiClient.post(
    "/api/works/script/tag",
    {
      novelPlot,
    },
    config
  );
};

const getScriptSplitOutline = (
  novelPlot: string,
  description: string,
  brainStorm: ScriptStorySynopsisResult,
  episodeNum: number,
  config?: RequestConfig
) => {
  return apiClient.post(
    "/api/works/script/split-outline",
    {
      novelPlot,
      description,
      brainStorm,
      episodeNum,
    },
    config
  );
};

const postScriptTemplateStreamOutline = (
  data: PostScriptTemplateStreamSplitOutlineRequestData,
  onData: (data: PostStreamData) => void,
  onError: (error: any) => void,
  onComplete: () => void,
  config?: { signal?: AbortSignal }
) => {
  return apiClient.postStream("/api/works/script/outline", data, onData, onError, onComplete, config);
};

const postScriptTemplateStreamPlot = (
  data: PostScriptTemplateStreamPlotRequestData,
  onData: (data: PostStreamData) => void,
  onError: (error: any) => void,
  onComplete: () => void,
  config?: { signal?: AbortSignal }
) => {
  return apiClient.postStream("/api/works/script/plot", data, onData, onError, onComplete, config);
};

const postScriptTemplateStreamContent = (
  data: PostScriptTemplateStreamContentRequestData,
  onData: (data: PostStreamData) => void,
  onError: (error: any) => void,
  onComplete: () => void,
  config?: { signal?: AbortSignal }
) => {
  return apiClient.postStream("/api/works/script/content", data, onData, onError, onComplete, config);
};

const postDocTemplateStreamContent = (
  data: any,
  onData: (data: PostStreamData) => void,
  onError: (error: any) => void,
  onComplete: () => void,
  config?: { signal?: AbortSignal }
) => {
  return apiClient.postStream("/api/works/chat/doc/writing", data, onData, onError, onComplete, config);
};

const postDocTemplateStreamDetailedOutline = (
  data: any,
  onData: (data: PostStreamData) => void,
  onError: (error: any) => void,
  onComplete: () => void,
  config?: { signal?: AbortSignal }
) => {
  return apiClient.postStream("/api/works/doc/detailed-outline", data, onData, onError, onComplete, config);
};

export {
  getQuickCharacterSettings,
  getQuickStoriesReq,
  postDocTemplateStreamOutline,
  getScriptCharacterSettings,
  getScriptTagsReq,
  getScriptSelectedTagsReq,
  getScriptStorySynopsisReq,
  getScriptSplitOutline,
  postScriptTemplateStreamPlot,
  postScriptTemplateStreamOutline,
  postScriptTemplateStreamContent,
  postDocTemplateStreamContent,
  postDocTemplateStreamDetailedOutline
};
