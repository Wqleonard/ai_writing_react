import { useCallback, useState } from "react";
import apiClient from "../api";
import { useSSE, type StatusUpdateData } from "./useSSE";
import type { CueWord } from "./useChatApi";
import type {
  FeedBackAction,
  FeedBackType,
  StreamingContent,
} from "./useChatApi";

const DEFAULT_STREAMING_CONTENT: StreamingContent = {
  status: "ready",
  isStreaming: false,
  type: "",
  content: "",
  chapterNum: 0,
  chapterTitle: "",
};

export function useWritingAPI() {
  const [currentTask, setCurrentTask] = useState<{
    task_id: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [streamingContent, setStreamingContent] =
    useState<StreamingContent>(DEFAULT_STREAMING_CONTENT);
  const [statusData, setStatusData] = useState<StatusUpdateData[]>([]);

  const { isConnected, connect, disconnect } = useSSE();
  const writingAPI = apiClient.writingAPI;

  const stopMonitoring = useCallback(() => {
    disconnect();
    setCurrentTask(null);
    setStatusData([]);
    setStreamingContent({ ...DEFAULT_STREAMING_CONTENT });
  }, [disconnect]);

  const handleStatusUpdate = useCallback(
    (data: StatusUpdateData) => {
      setStatusData((prev) => [...prev, { ...data }]);
      switch (data.status) {
        case "running":
          break;
        case "streaming_outline":
          setStreamingContent({
            isStreaming: true,
            status: "streaming",
            type: "streaming_outline",
            content: data.accumulated || data.chunk || "",
            chapterNum: 0,
            chapterTitle: "",
          });
          break;
        case "streaming_detailed_outline":
          setStreamingContent({
            isStreaming: true,
            status: "streaming",
            type: "streaming_detailed_outline",
            content: data.accumulated || data.chunk || "",
            chapterNum: 0,
            chapterTitle: "",
          });
          break;
        case "streaming_chapter":
          setStreamingContent({
            isStreaming: true,
            status: "streaming",
            type: "streaming_chapter",
            content: data.accumulated || data.chunk || "",
            chapterNum: data.chapter_num || 0,
            chapterTitle: data.chapter_title || "",
          });
          break;
        case "waiting_for_outline_review":
          setStreamingContent({
            status: "ready",
            type: "waiting_for_outline_review",
            content: "",
            outline: data.outline_to_review,
            chapterNum: 0,
            chapterTitle: "",
            isStreaming: false,
          });
          break;
        case "waiting_for_detailed_outline_review":
          setStreamingContent({
            type: "waiting_for_detailed_outline_review",
            detailedOutline: data.detailed_outline_to_review,
            content: "",
            status: "ready",
            chapterNum: 0,
            chapterTitle: "",
            isStreaming: false,
          });
          break;
        case "waiting_for_chapter_review":
          setStreamingContent({
            status: "ready",
            type: "waiting_for_chapter_review",
            content: data.chapter_to_review || "",
            chapterNum: data.chapter_num || 0,
            chapterTitle: data.chapter_title || "",
            isStreaming: false,
          });
          break;
        case "processing_feedback":
          setStreamingContent({
            status: "ready",
            type: "processing_feedback",
            content: "",
            chapterNum: 0,
            chapterTitle: "",
            isStreaming: false,
          });
          break;
        case "completed":
          setStreamingContent({
            type: "completed",
            content: "",
            status: "ready",
            chapterNum: 0,
            chapterTitle: "",
            isStreaming: false,
          });
          stopMonitoring();
          break;
        case "failed":
          setStreamingContent({
            type: "failed",
            content: "",
            status: "error",
            chapterNum: 0,
            chapterTitle: "",
            isStreaming: false,
          });
          break;
        case "stream_closed":
          setStreamingContent({
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
    },
    [stopMonitoring]
  );

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

  const getTaskTypes = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await writingAPI.getTaskTypes();
      return data.available_tasks;
    } catch (err) {
      setError("获取任务类型失败");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [writingAPI]);

  const submitWritingTask = useCallback(
    async (
      brainwave: string,
      runtime_prompts: CueWord[],
      options: Record<string, unknown> = {}
    ) => {
      try {
        setIsLoading(true);
        setError("");
        stopMonitoring();
        setStreamingContent({
          status: "submitted",
          isStreaming: false,
          type: "",
          content: "",
          chapterNum: 0,
          chapterTitle: "",
        });
        const params = {
          brainwave,
          novel_type: "世情文",
          chapter_num: 10,
          model_name: "",
          ...options,
        };
        const response = await writingAPI.submitTask(
          "full_writing",
          runtime_prompts,
          params
        );
        setCurrentTask(response);
        startStatusMonitoring(response.task_id);
        return response;
      } catch (err) {
        setError("任务提交失败");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [writingAPI, stopMonitoring, startStatusMonitoring]
  );

  const refreshTaskStatus = useCallback(
    async (taskId: string) => {
      try {
        return await writingAPI.getTaskStatus(taskId);
      } catch (err) {
        setError("获取任务状态失败");
        throw err;
      }
    },
    [writingAPI]
  );

  const provideFeedback = useCallback(
    async (feedback: FeedBackAction, feedback_type: FeedBackType) => {
      if (!currentTask) throw new Error("没有活动任务");
      try {
        setIsLoading(true);
        const response = await writingAPI.provideFeedback(
          currentTask.task_id,
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
    [currentTask, writingAPI]
  );

  return {
    currentTask,
    isLoading,
    streamingContent,
    error,
    isConnected,
    statusData,
    getTaskTypes,
    submitWritingTask,
    refreshTaskStatus,
    provideFeedback,
    startStatusMonitoring,
    stopMonitoring,
  };
}
