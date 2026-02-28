import apiClient, { type PostStreamData } from "./index";

const postSelectionToolbarStream = (
  data: { action: string; originalText: string; query: string },
  onData: (data: PostStreamData) => void,
  onError: (error: any) => void,
  onComplete: () => void,
  config?: { signal?: AbortSignal }
) => {
  return apiClient.postStream(
    "api/works/word-highlight/extend",
    data,
    onData,
    onError,
    onComplete,
    config as import("./index").RequestConfig
  );
};

const generateImage = (selectedText: string, fullText: string) => {
  return apiClient.post("/api/works/word-highlight", {
    selectedText,
    fullText,
  });
};

export { postSelectionToolbarStream, generateImage };
