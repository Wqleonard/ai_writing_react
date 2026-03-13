import apiClient, {
  WRITE_STREAM_URL,
  type PostStreamData,
} from "./index";

interface StreamChunk {
  content: string;
  finished: boolean;
  timestamp: number;
}

interface WritingRequest {
  prompt: string;
  maxLength: number;
  temperature: number;
}

export async function streamWritingWithAxios(request: WritingRequest) {
  let fullContent = "";
  await apiClient.postStream(
    WRITE_STREAM_URL,
    request,
    (chunk: any) => {
      fullContent += chunk?.data?.content ?? "";
      updateUI(fullContent);
    },
    (error: any) => {
      console.error("流式请求错误:", error);
      showError("请求失败: " + error?.message);
    },
    () => {
      showSuccess("内容生成完成");
    }
  );
}

export function streamWritingWithSSE(request: WritingRequest) {
  let fullContent = "";
  const eventSource = apiClient.postStreamSSE<StreamChunk>(
    WRITE_STREAM_URL,
    request,
    (chunk) => {
      fullContent += chunk?.content ?? "";
      updateUI(fullContent);
    },
    () => {
      showError("SSE连接失败");
    },
    () => {
      showSuccess("内容生成完成");
    }
  );
  return eventSource;
}

export function streamWritingWithXHR(request: WritingRequest) {
  let fullContent = "";
  const xhr = apiClient.postStreamXHR<StreamChunk>(
    WRITE_STREAM_URL,
    request,
    (chunk) => {
      fullContent += chunk?.content ?? "";
      updateUI(fullContent);
    },
    () => {
      showError("XHR请求失败");
    },
    () => {
      showSuccess("内容生成完成");
    }
  );
  return xhr;
}

export function useStreamWriting() {
  let currentRequest: EventSource | XMLHttpRequest | null = null;

  const startWriting = async (prompt: string) => {
    const request: WritingRequest = {
      prompt,
      maxLength: 1000,
      temperature: 0.7,
    };
    await streamWritingWithAxios(request);
  };

  const stopWriting = () => {
    if (currentRequest) {
      if (currentRequest instanceof EventSource) {
        currentRequest.close();
      } else if (currentRequest instanceof XMLHttpRequest) {
        currentRequest.abort();
      }
      currentRequest = null;
    }
  };

  return { startWriting, stopWriting };
}

function updateUI(content: string) {
  console.log("更新UI:", content);
}

function showError(message: string) {
  console.error("错误:", message);
}

function showSuccess(message: string) {
  console.log("成功:", message);
}
