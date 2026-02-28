import apiClient, { type RequestConfig } from "./index";
import type { CreateWorkType } from "./generate-dialog";

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

export { getQuickCharacterSettings, getQuickStoriesReq };
