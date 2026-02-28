import apiClient, { type RequestConfig } from "./index";

const createNewMobileWork = () => {
  return apiClient.post("/api/works", { type: "mobile_chat" });
};

const getMobileChatHistory = () => {
  return apiClient.get("/api/works/mobile-chat");
};

export interface PostChatStreamData {
  sessionId: string;
  query: string;
  workId: number | string;
}

const postChatStream = (
  data: PostChatStreamData,
  onData: (data: any) => void,
  onError: (err: Error) => void,
  onComplete: () => void,
  config?: RequestConfig
) => {
  return apiClient.postStream(
    "api/works/chat",
    {
      attachments: [],
      auto: false,
      chatMode: "mobile",
      command: "",
      model: "kimi_k2",
      query: data.query,
      quotedFiles: [],
      quotedContent: [],
      notes: [],
      reload: false,
      sessionId: data.sessionId,
      stream_mode: ["messages", "updates"],
      stream_subgraphs: true,
      tools: [],
      workId: data.workId,
      writingStyleId: 1,
    },
    onData,
    onError,
    onComplete,
    config
  );
};

const getMobileChatHistoryById = (workId: string, sessionId: string) => {
  return apiClient.get(`/api/works/${workId}/session/${sessionId}/history`);
};

export {
  createNewMobileWork,
  getMobileChatHistory,
  postChatStream,
  getMobileChatHistoryById,
};
