import apiClient, { type RequestConfig } from "./index";

export type CreateWorkType = "editor" | "mobile_chat" | "script" | 'doc';

const getTemplatesReq = () => {
  return apiClient.get("/api/writing-templates", {
    page: 0,
    pageSize: 100000,
  });
};

export interface CharacterData {
  workType: CreateWorkType;
  description: string;
  brainStorm: {
    title: string;
    intro: string;
  };
}

const getCharacterSettings = (data: CharacterData, config?: RequestConfig) => {
  return apiClient.post("/api/works/main-character", { ...data }, config);
};

export interface StoryData {
  templateContent: string;
  tagIds: string[];
}

const getStoriesReq = (data: StoryData, config?: RequestConfig) => {
  return apiClient.post("/api/works/editor/story-setting", { ...data }, config);
};

export { getTemplatesReq, getCharacterSettings, getStoriesReq };
