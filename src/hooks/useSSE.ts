import { useCallback, useEffect, useRef, useState } from "react";

export interface StatusUpdateData {
  response?: string;
  message?: string;
  status?: string;
  accumulated?: string;
  chunk?: string;
  draft?: string;
  total_chapters?: number;
  chapter_to_review?: string;
  completed_chapters?: number;
  feedback_type?: string;
  chapter_num?: number;
  chapter_index?: number;
  chapter_title?: string;
  outline_to_review?: unknown;
  detailed_outline_to_review?: unknown;
  edit_result?: unknown;
}

export function useSSE() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<StatusUpdateData | null>(null);
  const [error, setError] = useState<string>("");
  const eventSourceRef = useRef<EventSource | null>(null);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const connect = useCallback(
    (
      url: string | URL,
      onMessage: (data: StatusUpdateData) => void,
      onErrorCallback?: (err: unknown) => void
    ) => {
      try {
        disconnect();

        const eventSource = new EventSource(url);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          setIsConnected(true);
          setError("");
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as StatusUpdateData;
            setLastEvent(data);
            onMessage?.(data);

            if (data.status === "stream_closed") {
              disconnect();
            }
          } catch (err) {
            console.error("解析SSE数据失败:", err);
          }
        };

        eventSource.onerror = (event) => {
          setError("SSE连接错误");
          setIsConnected(false);
          onErrorCallback?.(event);
        };
      } catch (err) {
        setError("SSE连接错误");
        onErrorCallback?.(err);
      }
    },
    [disconnect]
  );

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    lastEvent,
    error,
    connect,
    disconnect,
  };
}
