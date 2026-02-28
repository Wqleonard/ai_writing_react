/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import type { AxiosInstance, AxiosRequestConfig } from "axios";

// =====================
// 常用接口地址（保持与 Vue 版一致，便于迁移）
// =====================
export const WRITE_SREAM_URL = "/api/v1/writing/generate-stream";
export const SUBMIT_URL = "/submit";
export const STREAM_CHAT_URL = "api/works/chat";

// =====================
// 类型
// =====================
export interface ApiResponse<T = unknown> {
  code: string;
  message: string;
  data: T;
}

export interface RequestConfig extends AxiosRequestConfig {
  showLoading?: boolean;
  showError?: boolean;
}

export interface PostStreamData {
  id?: string;
  event: string;
  data: any;
}

export interface ApiClientOptions {
  baseURL?: string;
  timeoutMs?: number;
  /** 获取 token 的函数（默认从 localStorage.token 读取） */
  getToken?: () => string | null | undefined;
  /** token 过期/401 的统一处理（例如：清 token、跳转登录） */
  onTokenExpired?: () => void;
  /** 错误提示（替代 ElementPlus ElMessage） */
  onErrorMessage?: (message: string) => void;
  onWarnMessage?: (message: string) => void;
}

function defaultBaseURL() {
  // Vite：用 import.meta.env（.env.* 里必须是 VITE_ 前缀）
  const vite = import.meta.env.VITE_API_BASE_URL;
  console.log(import.meta.env.MODE, import.meta.env.VITE_API_BASE_URL);
  // 2) 兜底：vite.config.ts 通过 define 注入（loadEnv(mode, ...)）
  const injected = typeof __API_BASE_URL__ === "string" ? __API_BASE_URL__ : "";

  const raw =
    (typeof vite === "string" && vite.trim() ? vite.trim() : "") ||
    (typeof injected === "string" && injected.trim() ? injected.trim() : "");

  // 去掉末尾 /，避免 baseURL + path 出现双斜杠
  return raw ? raw.replace(/\/+$/, "") : "";
}

function defaultGetToken() {
  try {
    return localStorage.getItem("token") || 'eyJhbGciOiJIUzUxMiJ9.eyJqdGkiOiI0MzJhZTJmZS04ODliLTQ1YjAtYWRiMC00ZjM0MzY5NjVkOWQiLCJzdWIiOiI3NCIsInBob25lIjoiMTM2KioqKjI0MjMiLCJuaWNrTmFtZSI6IueUqOaIt19hN2Y4MiIsInJvbGUiOiJ1c2VyIiwic3RhdHVzIjoiQUNUSVZFIiwiaWF0IjoxNzcwMjc0NzQzLCJleHAiOjE3NzI4NjY3NDN9.TwV0TsulL1ntz7JecsbUJzgE5AoMBNxit2qi2FR5mtiO9ztYDbzhxap9HlECilen6K9ADLEmE_UaHk2wXRL7tA';
  } catch {
    return null;
  }
}

function genStreamId() {
  // 不依赖 dayjs；尽量用更稳定的 id
  const uuid = (globalThis.crypto as any)?.randomUUID?.();
  if (uuid) return uuid;
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function extractErrorMessage(data: any, fallback: string) {
  return data?.message || data?.error || data?.msg || fallback;
}

export function createApiClient(options: ApiClientOptions = {}) {
  const {
    baseURL = defaultBaseURL(),
    timeoutMs = 120000,
    getToken = defaultGetToken,
    onTokenExpired,
    onErrorMessage,
    onWarnMessage,
  } = options;

  const api: AxiosInstance = axios.create({
    baseURL,
    timeout: timeoutMs,
    headers: {
      "Content-Type": "application/json",
    },
  });

  const handleTokenExpired = () => {
    onWarnMessage?.("登录已过期，请重新登录");
    onTokenExpired?.();
  };

  // 请求拦截器
  api.interceptors.request.use(
    (config) => {
      // Vue 版里设置了该 header，这里保留但通常无意义（CORS 是响应头）
      (config.headers as any)["Access-Control-Allow-Origin"] = "*";
      const token = getToken?.();
      if (token) (config.headers as any).Authorization = `Bearer ${token}`;
      return config;
    },
    (error) => Promise.reject(error)
  );

  // 响应拦截器
  api.interceptors.response.use(
    (response) => {
      const { data } = response;
      if (data && data.code === "TOKEN_EXPIRED") {
        handleTokenExpired();
        return Promise.reject(new Error("TOKEN_EXPIRED"));
      }
      return response;
    },
    (error) => {
      if (error?.response) {
        const { status, data } = error.response;
        if (data && data.code === "TOKEN_EXPIRED") {
          handleTokenExpired();
          return Promise.reject(new Error("TOKEN_EXPIRED"));
        }
        if (status === 401) {
          handleTokenExpired();
          return Promise.reject(new Error("TOKEN_EXPIRED"));
        }

        if (status === 400) {
          const msg = extractErrorMessage(data, "请求参数错误，请检查后重试");
          if (data?.code === "PARAMETER_ERROR") onErrorMessage?.(msg);
          const customError: any = new Error(msg);
          customError.response = error.response;
          customError.status = status;
          return Promise.reject(customError);
        }

        const msg = extractErrorMessage(data, "服务器错误，请稍后重试");
        onErrorMessage?.(msg);
      }
      return Promise.reject(error);
    }
  );

  // ==============
  // 基础 CRUD
  // ==============
  async function post<T = any>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    try {
      const response = await api.post<ApiResponse<T>>(url, data, config);
      return response.data.data;
    } catch (error) {
      if (config?.showError !== false) {
        // 这里不做 UI，交给 onErrorMessage
      }
      throw error;
    }
  }

  async function get<T = unknown>(url: string, params?: unknown, config?: RequestConfig): Promise<T> {
    try {
      const response = await api.get<ApiResponse<T>>(url, { params, ...config });
      return response.data.data;
    } catch (error) {
      if (config?.showError !== false) {
        // noop
      }
      throw error;
    }
  }

  async function put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T> {
    try {
      const response = await api.put<ApiResponse<T>>(url, data, config);
      return response.data.data;
    } catch (error) {
      if (config?.showError !== false) {
        // noop
      }
      throw error;
    }
  }

  async function del<T = any>(url: string, config?: RequestConfig): Promise<T> {
    try {
      const response = await api.delete<ApiResponse<T>>(url, config);
      return response.data.data;
    } catch (error) {
      if (config?.showError !== false) {
        // noop
      }
      throw error;
    }
  }

  async function upload<T = any>(url: string, file: File, config?: RequestConfig): Promise<T> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post<ApiResponse<T>>(url, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      ...config,
    });
    return response.data.data;
  }

  // ==============
  // Stream helpers
  // ==============
  function isTokenExpiredData(data: any): boolean {
    if (data && data.code === "TOKEN_EXPIRED") {
      handleTokenExpired();
      return true;
    }
    return false;
  }

  function processSSEData(raw: string, onData: (data: PostStreamData) => void) {
    // 兼容 Vue 版的解析方式：支持 event:/data: 以及直接 JSON 行
    const lines = raw.split("\n");
    let currentEvent = "";
    for (const line of lines) {
      if (!line.trim()) continue;
      if (line.startsWith("event:")) {
        currentEvent = line.substring(6).trim();
        continue;
      }
      if (line.startsWith("data:")) {
        const payload = line.substring(5).trim();
        if (!payload) continue;
        if (payload === "[DONE]") {
          onData({ event: "done", data: "[DONE]", id: genStreamId() });
          continue;
        }
        try {
          const parsed = JSON.parse(payload);
          onData({ event: currentEvent || "message", data: parsed, id: genStreamId() });
        } catch {
          onData({ event: currentEvent || "message", data: payload, id: genStreamId() });
        }
        continue;
      }
      // 非 SSE 标准行：尽量当 JSON 处理
      try {
        const parsed = JSON.parse(line.trim());
        onData({ event: currentEvent || "message", data: parsed, id: genStreamId() });
      } catch {
        onData({ event: currentEvent || "message", data: line.trim(), id: genStreamId() });
      }
    }
  }

  /**
   * 流式 POST（fetch + ReadableStream），用于 text/event-stream 或普通响应。
   */
  async function postStream(
    url: string,
    data: any,
    onData: (data: PostStreamData) => void,
    onError?: (error: Error) => void,
    onComplete?: () => void,
    config?: RequestConfig
  ): Promise<void> {
    const fullUrl = `${baseURL}${url}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      ...(((config?.headers as any) || {}) as Record<string, string>),
    };
    const token = getToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;

    const requestConfig: RequestInit = {
      method: "POST",
      headers,
      body: JSON.stringify(data),
      signal: (config as any)?.signal,
    };

    try {
      const response = await fetch(fullUrl, requestConfig);
      if (!response.ok) {
        if (response.status === 401) {
          handleTokenExpired();
          throw new Error("TOKEN_EXPIRED");
        }
        let errorMessage = `HTTP error! status: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.clone().json();
          if (isTokenExpiredData(errorData)) return;
          errorMessage = extractErrorMessage(errorData, errorMessage);
        } catch {
          try {
            const txt = await response.clone().text();
            if (txt) errorMessage = txt;
          } catch {
            // ignore
          }
        }
        if (config?.showError !== false) onErrorMessage?.(errorMessage);
        const apiError = new Error(errorMessage);
        onError?.(apiError);
        throw apiError;
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/event-stream")) {
        const text = await response.text();
        try {
          const parsed = JSON.parse(text);
          if (isTokenExpiredData(parsed)) return;
          onData({ event: "post", data: parsed, id: genStreamId() });
        } catch {
          onData({ event: "post", data: text, id: genStreamId() });
        }
        onComplete?.();
        return;
      }

      if (!response.body) throw new Error("响应体为空");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          if ((config as any)?.signal?.aborted) {
            await reader.cancel();
            throw new DOMException("The operation was aborted.", "AbortError");
          }

          const { done, value } = await reader.read();
          if (done) {
            if (buffer.trim()) processSSEData(buffer, onData);
            onComplete?.();
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() || "";
          for (const evt of events) if (evt.trim()) processSSEData(evt, onData);
        }
      } catch (streamError: any) {
        // AbortError 视为正常取消
        if (streamError?.name !== "AbortError") {
          onError?.(streamError instanceof Error ? streamError : new Error("流式读取失败"));
          throw streamError;
        }
      } finally {
        reader.releaseLock();
      }
    } catch (e: any) {
      const err = e instanceof Error ? e : new Error("Unknown error");
      if (config?.showError !== false) {
        // noop
      }
      onError?.(err);
      throw err;
    }
  }

  /**
   * SSE（EventSource）版本：仅适合 GET 场景（这里保持与 Vue 版一致，把 data 编进 query）。
   */
  function postStreamSSE<T = any>(
    url: string,
    data: any,
    onData: (chunk: T) => void,
    onError?: (error: Event) => void,
    onComplete?: () => void,
    config?: RequestConfig
  ): EventSource {
    const params = new URLSearchParams();
    Object.entries(data || {}).forEach(([k, v]) => params.append(k, String(v)));
    const fullUrl = `${baseURL}${url}?${params.toString()}`;
    const es = new EventSource(fullUrl, { withCredentials: config?.withCredentials });

    es.onmessage = (event) => {
      try {
        if (event.data === "[DONE]") {
          onComplete?.();
          es.close();
          return;
        }
        onData(JSON.parse(event.data));
      } catch {
        onData(event.data as T);
      }
    };

    es.onerror = (err) => {
      if (config?.showError !== false) {
        // noop
      }
      onError?.(err);
      es.close();
    };

    return es;
  }

  /**
   * XHR 流：某些后端对 fetch stream 支持差时可用（保持与 Vue 版一致）。
   */
  function postStreamXHR<T = any>(
    url: string,
    data: any,
    onData: (chunk: T) => void,
    onError?: (error: Event) => void,
    onComplete?: () => void,
    config?: RequestConfig
  ): XMLHttpRequest {
    const xhr = new XMLHttpRequest();
    const fullUrl = `${baseURL}${url}`;
    xhr.open("POST", fullUrl, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Accept", "text/event-stream");
    xhr.setRequestHeader("Cache-Control", "no-cache");

    const token = getToken?.();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    if (config?.headers) {
      Object.entries(config.headers).forEach(([k, v]) => xhr.setRequestHeader(k, String(v)));
    }

    let buffer = "";
    xhr.onprogress = () => {
      if (!xhr.responseText) return;
      const newData = xhr.responseText.slice(buffer.length);
      buffer = xhr.responseText;
      const lines = newData.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        if (line.startsWith("data: ")) {
          const dataStr = line.slice(6);
          if (dataStr === "[DONE]") {
            onComplete?.();
            return;
          }
          try {
            onData(JSON.parse(dataStr));
          } catch {
            onData(dataStr as T);
          }
        }
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) onComplete?.();
      else onError?.(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`) as any);
    };

    xhr.onerror = (err) => onError?.(err);
    xhr.send(JSON.stringify(data));
    return xhr;
  }

  /**
   * LangGraph SSE：按 event/data 解析
   */
  async function postLangGraphStream(
    url: string,
    data: any,
    onEvent: (eventType: string, eventData: any) => void,
    onError?: (error: Error) => void,
    onComplete?: () => void,
    config?: RequestConfig
  ): Promise<void> {
    const fullUrl = `${baseURL}${url}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
      ...(((config?.headers as any) || {}) as Record<string, string>),
    };
    const token = getToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      const response = await fetch(fullUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
        signal: (config as any)?.signal,
      });

      if (!response.ok) {
        if (response.status === 401) {
          handleTokenExpired();
          throw new Error("TOKEN_EXPIRED");
        }
        throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
      }

      if (!response.body) throw new Error("响应体为空");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (trimmed.startsWith("event:")) {
              currentEvent = trimmed.substring(6).trim();
            } else if (trimmed.startsWith("data:")) {
              const dataStr = trimmed.substring(5).trim();
              if (!dataStr) continue;
              try {
                const parsed = JSON.parse(dataStr);
                if (isTokenExpiredData(parsed)) {
                  onComplete?.();
                  return;
                }
                if (currentEvent) onEvent(currentEvent, parsed);
              } catch {
                // ignore parse error
              }
            }
          }
        }
        onComplete?.();
      } catch (streamError: any) {
        onError?.(streamError instanceof Error ? streamError : new Error("流式读取失败"));
        throw streamError;
      } finally {
        reader.releaseLock();
      }
    } catch (e: any) {
      const err = e instanceof Error ? e : new Error("Unknown error");
      onError?.(err);
      throw err;
    }
  }

  // ==============
  // writingAPI（保持原命名，类型改成更松耦合）
  // ==============
  const writingAPI = {
    async getTaskTypes() {
      const response = await api.get("/task-types");
      return response.data;
    },
    async submitTask(taskType: string, runtime_prompts: any[], params: Record<string, any> = {}) {
      const response = await api.post("/api/tasks/start", {
        task_type: taskType,
        model_name: params.model_name || "Kimi-k2",
        runtime_prompts,
        params,
      });
      return response.data;
    },
    async getAiChatTaskId(params: Record<string, any> = {}) {
      const response = await api.post("/chat/start", { params });
      return response.data;
    },
    async sendMessageToAI(taskId: string, message: string, runtime_prompts: any[], novel: any) {
      const response = await api.post("/chat/send", {
        task_id: taskId,
        message,
        runtime_prompts,
        novel,
      });
      return response.data;
    },
    async chatFeedback(taskId: string, feedback: any, feedback_type: any) {
      const response = await api.post(`/chat/feedback/${taskId}`, { feedback, feedback_type });
      return response.data;
    },
    async getTaskStatus(taskId: string) {
      const response = await api.get(`/task/${taskId}`);
      return response.data;
    },
    async provideFeedback(taskId: string, feedback: any, feedback_type: any) {
      const response = await api.post(`api/tasks/feedback/${taskId}`, {
        feedback,
        type: feedback_type,
      });
      return response.data;
    },
    getStreamURL(taskId: string) {
      return `${baseURL}/api/tasks/stream/${taskId}`;
    },
  };

  return {
    api,
    // base CRUD
    get,
    post,
    put,
    del,
    upload,
    // streams
    postStream,
    postStreamSSE,
    postStreamXHR,
    postLangGraphStream,
    // grouped
    writingAPI,
    // helpers
    isTokenExpiredData,
  };
}

// 兼容“直接 import { apiClient }”的用法：给一个默认实例（你也可以在业务里自行 create）
export const apiClient = createApiClient();

// 为了与 Vue 版 `export default post` 的调用习惯兼容：默认导出 post
export default apiClient;

