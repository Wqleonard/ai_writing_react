import apiClient, { type RequestConfig } from "./index";
import { addNote } from "./notes";
import type { NoteSourceType } from "./notes";

interface NovelDeconstructData {
  name: string;
  path: string;
}

const novelDeconstructStream = (
  data: NovelDeconstructData,
  onData: (data: any) => void,
  onError?: any,
  onComplete?: any,
  config?: RequestConfig
) => {
  return apiClient.postStream(
    "/api/works/novel-deconstruct",
    {
      messages: [{ role: "human", content: "" }],
      attachments: [{ name: data.name, remoteAddress: data.path }],
    },
    onData,
    onError,
    onComplete,
    config
  );
};

const saveAsNewNote = (
  title: string,
  content: string,
  source: NoteSourceType = "PC_NOVEL_DECONSTRUCT"
) => {
  return addNote(title, content, source);
};

const getKeywords = () => {
  return apiClient.get("/api/rank/keywords-rank");
};

const postWritingAnalysis = (originText: string) => {
  return apiClient.post("/api/works/writing-analysis", { originalText: originText });
};

const postWritingAnalysisStream = (
  originText: string,
  onData: (data: any) => void,
  onError?: any,
  onComplete?: any,
  config?: RequestConfig
) => {
  return apiClient.postStream(
    "/api/works/writing-analysis",
    { originalText: originText },
    onData,
    onError,
    onComplete,
    config
  );
};

const postNovelToScript = (originText: string) => {
  return apiClient.post("/api/works/novel-to-script", { originalText: originText });
};

// 暂时占位，小说转剧本流式接口
const postNovelToScriptStream = (
  originText: string,
  onData: (data: any) => void,
  onError?: any,
  onComplete?: any,
  config?: RequestConfig
) => {
  return apiClient.postStream(
    "/api/works/novel-to-script",
    { originalText: originText },
    onData,
    onError,
    onComplete,
    config
  );
};

const postWritingStyle = (data: { name: string; content: string }) => {
  return apiClient.post("/api/writing-styles", { name: data.name, content: data.content });
};

const addBookAnalysisHistory = (attachmentName: string) => {
  return apiClient.post("/api/works/novel-deconstruct/history", { attachmentName });
};

const updateBookAnalysisHistory = (deconstructResult: string, historyId: string) => {
  return apiClient.put(`/api/works/novel-deconstruct/history/${historyId}`, {
    deconstructResult,
  });
};

const getBookAnalysisHistoryList = () => {
  return apiClient.get("/api/works/novel-deconstruct/history");
};

const getBookAnalysisHistoryDetail = (historyId: string) => {
  return apiClient.get(`/api/works/novel-deconstruct/history/${historyId}`);
};

const addWritingStyleHistory = (attachmentName: string) => {
  return apiClient.post("/api/writing-styles/history", { attachmentName });
};

const updateWritingStyleHistory = (writingAnalyzeResult: string, historyId: string) => {
  return apiClient.put(`/api/writing-styles/history/${historyId}`, {
    writingAnalyzeResult,
  });
};

const getWritingStyleHistoryList = () => {
  return apiClient.get("/api/writing-styles/history");
};

const getWritingStyleHistoryDetail = (historyId: string) => {
  return apiClient.get(`/api/writing-styles/history/${historyId}`);
};

const addNovelToScriptHistory = (attachmentName: string) => {
  return apiClient.post("/api/works/novel-to-script/history", { attachmentName });
};

const updateNovelToScriptHistory = (novelToScriptResult: string, historyId: string) => {
  return apiClient.put(`/api/works/novel-to-script/history/${historyId}`, {
    novelToScriptResult,
  });
};

const getNovelToScriptHistoryList = () => {
  return apiClient.get("/api/works/novel-to-script/history");
};

const getNovelToScriptHistoryDetail = (historyId: string) => {
  return apiClient.get(`/api/works/novel-to-script/history/${historyId}`);
};

export {
  novelDeconstructStream,
  saveAsNewNote,
  getKeywords,
  postWritingAnalysis,
  postWritingAnalysisStream,
  postNovelToScript,
  postNovelToScriptStream,
  postWritingStyle,
  addBookAnalysisHistory,
  updateBookAnalysisHistory,
  getBookAnalysisHistoryList,
  getBookAnalysisHistoryDetail,
  addWritingStyleHistory,
  updateWritingStyleHistory,
  getWritingStyleHistoryList,
  getWritingStyleHistoryDetail,
  addNovelToScriptHistory,
  updateNovelToScriptHistory,
  getNovelToScriptHistoryList,
  getNovelToScriptHistoryDetail,
};
