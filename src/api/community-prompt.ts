import apiClient, { type PostStreamData } from "./index";

const getPromptCategories = () => {
  return apiClient.get("/api/prompts/categories");
};

const getPublicPrompts = (
  page: number,
  size: number,
  sortBy: string,
  categoryId?: string
) => {
  return apiClient.get("/api/prompts/public", {
    page,
    size,
    sortBy,
    categoryId: categoryId != "" ? categoryId : undefined,
  });
};

const getPromptDetails = (promptId: string) => {
  return apiClient.get(`/api/prompts/${promptId}`);
};

const getMyPrompts = (
  page: number,
  size: number,
  sortBy: string,
  categoryId?: string
) => {
  return apiClient.get("/api/prompts/my", {
    page,
    size,
    sortBy,
    categoryId: categoryId != "" ? categoryId : undefined,
  });
};

const getFavoritesPrompts = (
  page: number,
  size: number,
  sortBy: string,
  categoryId?: string
) => {
  return apiClient.get("/api/prompts/favorites", {
    page,
    size,
    sortBy,
    categoryId: categoryId != "" ? categoryId : undefined,
  });
};

const addFavoritePrompt = (promptId: string | number) => {
  return apiClient.post(`/api/prompts/${promptId}/favorite`);
};

const cancelFavoritePrompt = (promptId: string | number) => {
  return apiClient.del(`/api/prompts/${promptId}/favorite`);
};

export interface AddNewPromptData {
  name: string;
  description: string;
  iconUrl: string;
  systemPrompt: string;
  outputFormat: string;
  userExample: string;
  isPublic: boolean;
  categoryIds: [number | string];
}

const addNewPrompt = (data: AddNewPromptData) => {
  return apiClient.post("/api/prompts", data);
};

const getPromptsByCategoryId = (categoryId: string) => {
  return apiClient.get(`/api/prompts/category/${categoryId}`);
};

interface PostPublicPromptStreamData {
  description: string;
  systemPrompt: string;
}

const postPublicPromptStream = (
  data: PostPublicPromptStreamData,
  onData: (data: PostStreamData) => void,
  onError: (error: any) => void,
  onComplete: () => void,
  config?: { signal?: AbortSignal }
) => {
  return apiClient.postStream(
    "api/works/tool-test/brain-storm",
    data,
    onData,
    onError,
    onComplete,
    config as import("./index").RequestConfig
  );
};

export type ToolName =
  | "brain_storm"
  | "outline"
  | "character"
  | "worldview"
  | "main_content";

interface PostTestPromptStreamData {
  toolName: ToolName;
  description: string;
  systemPrompt: string;
}

const postTestPromptStream = (
  data: PostTestPromptStreamData,
  onData: (data: PostStreamData) => void,
  onError: (error: any) => void,
  onComplete: () => void,
  config?: { signal?: AbortSignal }
) => {
  return apiClient.postStream(
    "/api/works/tool-test",
    data,
    onData,
    onError,
    onComplete,
    config as import("./index").RequestConfig
  );
};

export {
  getPromptCategories,
  getPublicPrompts,
  getPromptDetails,
  getMyPrompts,
  getFavoritesPrompts,
  addFavoritePrompt,
  cancelFavoritePrompt,
  addNewPrompt,
  getPromptsByCategoryId,
  postPublicPromptStream,
  postTestPromptStream,
};
