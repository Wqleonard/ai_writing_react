import apiClient, { type PostStreamData, type RequestConfig } from "./index";
import type { CreateWorkType } from "./generate-dialog";
import type {
  PostDocTemplateStreamContentRequestData,
  PostDocTemplateStreamDetailedOutlineRequestData,
  PostDocTemplateStreamOutlineRequestData,
} from "@/api/writing-templates.ts";

export interface CharacterCardData {
  title?: string;
  intro?: string;
  [key: string]: unknown;
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
  return apiClient.postStream("api/works/doc/outline", data, onData, onError, onComplete, config);
};

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
    config
  );
};

const postDocTemplateStreamContent = (
  data: PostDocTemplateStreamContentRequestData,
  onData: (data: PostStreamData) => void,
  onError: (error: any) => void,
  onComplete: () => void,
  config?: { signal?: AbortSignal }
) => {
  return apiClient.postStream("api/works/chat/doc/writing", data, onData, onError, onComplete, config);
};

export {
  getQuickCharacterSettings,
  getQuickStoriesReq,
  postDocTemplateStreamOutline,
  postDocTemplateStreamDetailedOutline,
  postDocTemplateStreamContent,
};
