import { useCallback, useState } from "react";
import apiClient from "../api";
import { useSSE, type StatusUpdateData } from "./useSSE";
import type { CueWord } from "./useChatApi";
import type {
  FeedBackAction,
  FeedBackType,
  StreamingContent,
} from "./useChatApi";

export type SSEStreamTaskType =
  | "full_writing"
  | "brainwave_to_outline"
  | "outline_to_detailed"
  | "detailed_to_content";

export interface SSEStreamParamsType {
  brainwave?: string;
  novel_type?: string;
  chapter_num?: number;
  model_name?: string;
  novel_outline?: unknown;
  detailed_outline?: unknown;
}

const DEFAULT_STREAMING_CONTENT: StreamingContent = {
  status: "ready",
  isStreaming: false,
  type: "",
  content: "",
  chapterNum: 0,
  chapterTitle: "",
};

export function useSegmentedWritingAPI() {
  const [currentSegmentedTask, setCurrentSegmentedTask] = useState<{
    task_id: string;
  } | null>(null);
  const [isSegmentedLoading, setIsSegmentedLoading] = useState(false);
  const [segmentedError, setSegmentedError] = useState<string>("");
  const [segmentedStreamingContent, setSegmentedStreamingContent] =
    useState<StreamingContent>(DEFAULT_STREAMING_CONTENT);
  const [segmentedStatusData, setSegmentedStatusData] = useState<
    StatusUpdateData[]
  >([]);

  const { connect, disconnect } = useSSE();
  const writingAPI = apiClient.writingAPI;

  const stopSegmentedMonitoring = useCallback(() => {
    disconnect();
    setCurrentSegmentedTask(null);
    setSegmentedStatusData([]);
    setSegmentedStreamingContent({ ...DEFAULT_STREAMING_CONTENT });
  }, [disconnect]);

  const handleStatusUpdate = useCallback(
    (data: StatusUpdateData) => {
      setSegmentedStatusData((prev) => [...prev, { ...data }]);
      switch (data.status) {
        case "running":
          break;
        case "streaming_outline":
          setSegmentedStreamingContent({
            isStreaming: true,
            status: "streaming",
            type: "streaming_outline",
            content: data.accumulated || data.chunk || "",
            chapterNum: 0,
            chapterTitle: "",
          });
          break;
        case "streaming_detailed_outline":
          setSegmentedStreamingContent({
            isStreaming: true,
            status: "streaming",
            type: "streaming_detailed_outline",
            content: data.accumulated || data.chunk || "",
            chapterNum: 0,
            chapterTitle: "",
          });
          break;
        case "streaming_chapter":
          setSegmentedStreamingContent({
            isStreaming: true,
            status: "streaming",
            type: "streaming_chapter",
            content: data.accumulated || data.chunk || "",
            chapterNum: data.chapter_num || 0,
            chapterTitle: data.chapter_title || "",
          });
          break;
        case "waiting_for_outline_review":
          setSegmentedStreamingContent({
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
          setSegmentedStreamingContent({
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
          setSegmentedStreamingContent({
            status: "ready",
            type: "waiting_for_chapter_review",
            content: data.chapter_to_review || "",
            chapterNum: data.chapter_num || 0,
            chapterTitle: data.chapter_title || "",
            isStreaming: false,
          });
          break;
        case "processing_feedback":
          setSegmentedStreamingContent({
            status: "ready",
            type: "processing_feedback",
            content: "",
            chapterNum: 0,
            chapterTitle: "",
            isStreaming: false,
          });
          break;
        case "completed":
          setSegmentedStreamingContent({
            status: "ready",
            type: "completed",
            content: "",
            chapterNum: 0,
            chapterTitle: "",
            isStreaming: false,
          });
          stopSegmentedMonitoring();
          break;
        case "failed":
          setSegmentedStreamingContent({
            type: "failed",
            status: "error",
            content: "",
            chapterNum: 0,
            chapterTitle: "",
            isStreaming: false,
          });
          break;
        case "stream_closed":
          setSegmentedStreamingContent({
            type: "stream_closed",
            status: "ready",
            content: "",
            chapterNum: 0,
            chapterTitle: "",
            isStreaming: false,
          });
          stopSegmentedMonitoring();
          break;
      }
    },
    [stopSegmentedMonitoring]
  );

  const handleStreamError = useCallback(() => {
    setSegmentedError("SSE连接错误");
  }, []);

  const startSegmentedMonitoring = useCallback(
    (taskId: string) => {
      const streamURL = writingAPI.getStreamURL(taskId);
      connect(streamURL, handleStatusUpdate, handleStreamError);
    },
    [connect, handleStatusUpdate, handleStreamError, writingAPI]
  );

  const getSegmentedTypes = useCallback(async () => {
    try {
      setIsSegmentedLoading(true);
      const data = await writingAPI.getTaskTypes();
      return data.available_tasks;
    } catch (err) {
      setSegmentedError("获取任务类型失败");
      throw err;
    } finally {
      setIsSegmentedLoading(false);
    }
  }, [writingAPI]);

  const submitSegmentedWritingTask = useCallback(
    async (
      taskType: SSEStreamTaskType,
      runtime_prompts: CueWord[],
      options: SSEStreamParamsType = {}
    ) => {
      try {
        setIsSegmentedLoading(true);
        setSegmentedError("");
        stopSegmentedMonitoring();
        setSegmentedStreamingContent({
          status: "submitted",
          isStreaming: false,
          type: "",
          content: "",
          chapterNum: 0,
          chapterTitle: "",
        });
        const params = {
          novel_type: "世情文",
          chapter_num: 10,
          model_name: "Kimi-k2",
          ...options,
        };
        const response = await writingAPI.submitTask(
          taskType,
          runtime_prompts,
          params
        );
        setCurrentSegmentedTask(response);
        startSegmentedMonitoring(response.task_id);
        return response;
      } catch (err) {
        setSegmentedError("任务提交失败");
        throw err;
      } finally {
        setIsSegmentedLoading(false);
      }
    },
    [writingAPI, stopSegmentedMonitoring, startSegmentedMonitoring]
  );

  const refreshSegmentedTaskStatus = useCallback(
    async (taskId: string) => {
      try {
        return await writingAPI.getTaskStatus(taskId);
      } catch (err) {
        setSegmentedError("获取任务状态失败");
        throw err;
      }
    },
    [writingAPI]
  );

  const provideSegmentedFeedback = useCallback(
    async (feedback: FeedBackAction, feedback_type: FeedBackType) => {
      if (!currentSegmentedTask) throw new Error("没有活动任务");
      try {
        setIsSegmentedLoading(true);
        const response = await writingAPI.provideFeedback(
          currentSegmentedTask.task_id,
          feedback,
          feedback_type
        );
        if (
          (feedback === "approved" && feedback_type !== "chapter") ||
          feedback === "rejected"
        ) {
          stopSegmentedMonitoring();
        }
        return response;
      } catch (err) {
        setSegmentedError("提交反馈失败");
        throw err;
      } finally {
        setIsSegmentedLoading(false);
      }
    },
    [currentSegmentedTask, writingAPI, stopSegmentedMonitoring]
  );

  return {
    currentSegmentedTask,
    isSegmentedLoading,
    segmentedStreamingContent,
    segmentedError,
    segmentedStatusData,
    getSegmentedTypes,
    submitSegmentedWritingTask,
    refreshSegmentedTaskStatus,
    provideSegmentedFeedback,
    startSegmentedMonitoring,
    stopSegmentedMonitoring,
  };
}
