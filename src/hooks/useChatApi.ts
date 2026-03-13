import { useCallback, useEffect, useState } from "react";
import apiClient from "../api";
import { useSSE, type StatusUpdateData } from "./useSSE";

// ---------- 类型定义（与 Vue 版 @/utils/interfaces 对齐） ----------
export type CueWordStage =
  | "brainwave_to_outline"
  | "outline_to_detailed"
  | "detailed_to_content";

export interface CueWord {
  stage: CueWordStage;
  category: string;
  content: string;
}

export type FeedBackType = "outline" | "detailed_outline" | "chapter" | "edit";
export type FeedBackAction = "approved" | "regenerate" | "rejected";

export interface NovelToEditChapter {
  chapter_num: number;
  title: string;
  content: string;
}

export interface NovelToEdit {
  title: string;
  genre: string;
  main_character: string;
  story_theme: string;
  chapters: NovelToEditChapter[];
}

export type NuxtUIProChatStatus = "ready" | "error" | "submitted" | "streaming" | undefined;

export type SSEStatus =
  | "running"
  | "streaming_outline"
  | "streaming_detailed_outline"
  | "streaming_chapter"
  | "waiting_for_outline_review"
  | "waiting_for_detailed_outline_review"
  | "waiting_for_chapter_review"
  | "processing_feedback"
  | "completed"
  | "failed"
  | "stream_closed"
  | "chat_streaming"
  | "chat_completed"
  | "edit_workflow_started"
  | "edit_completed"
  | "";

export interface StreamingContent {
  status?: NuxtUIProChatStatus;
  isStreaming: boolean;
  type: SSEStatus;
  content: string;
  chapterNum: number;
  chapterTitle: string;
  outline?: unknown;
  detailedOutline?: unknown;
  editResult?: unknown;
}

const DEFAULT_STREAMING_CONTENT: StreamingContent = {
  status: "ready",
  isStreaming: false,
  type: "",
  content: "",
  chapterNum: 0,
  chapterTitle: "",
};

const DEFAULT_NOVEL: NovelToEdit = {
  title: "",
  genre: "",
  main_character: "",
  story_theme: "",
  chapters: [],
};

// ---------- Hook ----------
export function useChatAPI() {
  const [currentChatTask, setCurrentChatTask] = useState<{ task_id: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [streamingChatContent, setStreamingChatContent] =
    useState<StreamingContent>(DEFAULT_STREAMING_CONTENT);
  const [statusData, setStatusData] = useState<StatusUpdateData[]>([]);

  const { isConnected, connect, disconnect } = useSSE();

  const writingAPI = apiClient.writingAPI;

  const stopMonitoring = useCallback(() => {
    disconnect();
    setCurrentChatTask(null);
    setStatusData([]);
    setStreamingChatContent({ ...DEFAULT_STREAMING_CONTENT });
  }, [disconnect]);

  const handleStatusUpdate = useCallback((data: StatusUpdateData) => {
    setStatusData((prev) => [...prev, { ...data }]);

    switch (data.status) {
      case "running":
        break;
      case "chat_streaming":
        setStreamingChatContent({
          status: "streaming",
          isStreaming: true,
          type: "chat_streaming",
          content: data.chunk || data.accumulated || "",
          chapterNum: 0,
          chapterTitle: "",
        });
        break;
      case "chat_completed": {
        let response = "";
        if (data.response?.trim()) {
          response = data.response.trim();
        }
        setStreamingChatContent({
          status: "ready",
          isStreaming: false,
          type: "chat_completed",
          content: response,
          chapterNum: 0,
          chapterTitle: "",
        });
        break;
      }
      case "streaming_outline":
        setStreamingChatContent({
          isStreaming: true,
          status: "streaming",
          type: "streaming_outline",
          content: data.chunk || data.accumulated || "",
          chapterNum: 0,
          chapterTitle: "",
        });
        break;
      case "streaming_detailed_outline":
        setStreamingChatContent({
          isStreaming: true,
          status: "streaming",
          type: "streaming_detailed_outline",
          content: data.chunk || data.accumulated || "",
          chapterNum: 0,
          chapterTitle: "",
        });
        break;
      case "streaming_chapter":
        setStreamingChatContent({
          isStreaming: true,
          status: "streaming",
          type: "streaming_chapter",
          content: data.chunk || data.accumulated || "",
          chapterNum: data.chapter_num || 0,
          chapterTitle: data.chapter_title || "",
        });
        break;
      case "waiting_for_outline_review":
        setStreamingChatContent({
          status: "ready",
          type: "waiting_for_outline_review",
          outline: data.outline_to_review,
          content: "",
          chapterNum: 0,
          chapterTitle: "",
          isStreaming: false,
        });
        break;
      case "waiting_for_detailed_outline_review":
        setStreamingChatContent({
          status: "ready",
          type: "waiting_for_detailed_outline_review",
          detailedOutline: data.detailed_outline_to_review,
          content: "",
          chapterNum: 0,
          chapterTitle: "",
          isStreaming: false,
        });
        break;
      case "waiting_for_chapter_review":
        setStreamingChatContent({
          status: "ready",
          type: "waiting_for_chapter_review",
          content: data.chapter_to_review || "",
          chapterNum: data.chapter_num || 0,
          chapterTitle: data.chapter_title || "",
          isStreaming: false,
        });
        break;
      case "edit_workflow_started":
        setStreamingChatContent({
          status: "streaming",
          type: "edit_workflow_started",
          content: data.response || "",
          chapterNum: 0,
          chapterTitle: "",
          isStreaming: true,
        });
        break;
      case "edit_completed":
        setStreamingChatContent({
          status: "ready",
          type: "edit_completed",
          content: "",
          editResult: data.edit_result,
          chapterNum: 0,
          chapterTitle: "",
          isStreaming: false,
        });
        break;
      case "processing_feedback":
        setStreamingChatContent({
          type: "processing_feedback",
          status: "ready",
          content: "",
          chapterNum: 0,
          chapterTitle: "",
          isStreaming: false,
        });
        break;
      case "completed":
        setStreamingChatContent({
          type: "completed",
          content: "",
          status: "ready",
          chapterNum: 0,
          chapterTitle: "",
          isStreaming: false,
        });
        break;
      case "failed":
        setStreamingChatContent({
          status: "error",
          type: "failed",
          content: "",
          chapterNum: 0,
          chapterTitle: "",
          isStreaming: false,
        });
        break;
      case "stream_closed":
        setStreamingChatContent({
          type: "stream_closed",
          content: "",
          status: "ready",
          chapterNum: 0,
          chapterTitle: "",
          isStreaming: false,
        });
        stopMonitoring();
        break;
    }
  }, [stopMonitoring]);

  const handleStreamError = useCallback(() => {
    setError("SSE连接错误");
  }, []);

  const startStatusMonitoring = useCallback(
    (taskId: string) => {
      const streamURL = writingAPI.getStreamURL(taskId);
      connect(streamURL, handleStatusUpdate, handleStreamError);
    },
    [connect, handleStatusUpdate, handleStreamError, writingAPI]
  );

  const startChat = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      stopMonitoring();
      const response = await writingAPI.getAiChatTaskId();
      setCurrentChatTask(response as { task_id: string });
      startStatusMonitoring((response as { task_id: string }).task_id);
      return response;
    } catch (err) {
      setError("任务提交失败");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [writingAPI, startStatusMonitoring, stopMonitoring]);

  const sendMessageToAI = useCallback(
    async (
      message: string,
      runtime_prompts: CueWord[],
      novel: NovelToEdit = DEFAULT_NOVEL
    ) => {
      try {
        setIsLoading(true);
        setError("");

        let taskId = currentChatTask?.task_id;
        if (!taskId) {
          const response = (await writingAPI.getAiChatTaskId()) as { task_id: string };
          taskId = response.task_id;
          setCurrentChatTask(response);
          startStatusMonitoring(taskId);
        }
        if (!taskId) {
          setError("发送消息失败：无可用任务");
          return;
        }

        setStreamingChatContent({
          status: "submitted",
          isStreaming: false,
          type: "",
          content: "",
          chapterNum: 0,
          chapterTitle: "",
        });

        await writingAPI.sendMessageToAI(taskId, message, runtime_prompts, novel);
      } catch (err) {
        setError("发送消息失败");
        setStreamingChatContent({
          status: "error",
          isStreaming: false,
          type: "",
          content: "",
          chapterNum: 0,
          chapterTitle: "",
        });
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [currentChatTask, startStatusMonitoring, writingAPI]
  );

  const refreshTaskStatus = useCallback(
    async (taskId: string) => {
      try {
        const status = await writingAPI.getTaskStatus(taskId);
        return status;
      } catch (err) {
        setError("获取任务状态失败");
        throw err;
      }
    },
    [writingAPI]
  );

  const provideFeedback = useCallback(
    async (feedback: FeedBackAction, feedback_type: FeedBackType) => {
      if (!currentChatTask?.task_id) {
        throw new Error("没有活动任务");
      }
      try {
        setIsLoading(true);
        const response = await writingAPI.provideFeedback(
          currentChatTask.task_id,
          feedback,
          feedback_type
        );
        return response;
      } catch (err) {
        setError("提交反馈失败");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [currentChatTask, writingAPI]
  );

  useEffect(() => {
    startChat();
    return () => {
      stopMonitoring();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount

  return {
    currentChatTask,
    isLoading,
    streamingChatContent,
    error,
    isConnected,
    statusData,
    refreshTaskStatus,
    sendMessageToAI,
    provideFeedback,
    startStatusMonitoring,
    stopMonitoring,
    startChat,
  };
}
