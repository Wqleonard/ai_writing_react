import apiClient, { type PostStreamData, type RequestConfig } from "./index";

interface PublicPostStreamData {
  promptId: string;
  workId: string;
  description: string;
  relatedFiles: string[];
}

interface IntroductionPostStreamData {
  promptId: string;
  workId: string;
  description: string;
  relatedFiles: string[];
}

interface RecommendConfigResponse {
  vxQrCodeUrl?: string;
  vxQrCodeDescription?: string;
  bannerConfig?: {
    title?: string;
    icon?: string;
    btnText?: string;
    content?: string;
    canOpen?: boolean;
  };
  recommend?: string;
  clawGuideUrl?: string;
  clawVxQrCodeUrl?: string;
  clawFeishuQrCodeUrl?: string;
}

const introductionPostStream = (
  data: IntroductionPostStreamData | PublicPostStreamData,
  onData: (data: PostStreamData) => void,
  onError: (error: any) => void,
  onComplete: () => void,
  config?: { signal?: AbortSignal }
) => {
  return apiClient.postStream(
    "/api/works/tool/brain-storm",
    data,
    onData,
    onError,
    onComplete,
    config as RequestConfig
  );
};

interface CharacterPostStreamData {
  promptId: string;
  workId: string;
  description: string;
  roleNumber: number;
  relatedFiles: string[];
}

const characterPostStream = (
  data: CharacterPostStreamData | PublicPostStreamData,
  onData: (data: PostStreamData) => void,
  onError: (error: any) => void,
  onComplete: () => void,
  config?: { signal?: AbortSignal }
) => {
  return apiClient.postStream(
    "/api/works/tool/character",
    data,
    onData,
    onError,
    onComplete,
    config as RequestConfig
  );
};

interface WorldPostStreamData {
  promptId: string;
  workId: string;
  description: string;
  relatedFiles: string[];
}

const worldPostStream = (
  data: WorldPostStreamData | PublicPostStreamData,
  onData: (data: PostStreamData) => void,
  onError: (error: any) => void,
  onComplete: () => void,
  config?: { signal?: AbortSignal }
) => {
  return apiClient.postStream(
    "/api/works/tool/world-setting",
    data,
    onData,
    onError,
    onComplete,
    config as RequestConfig
  );
};

interface OutlinePostStreamData {
  promptId: string;
  workId: string;
  theme: string;
  description: string;
  chapterNum: number;
  relatedFiles: string[];
}

const outlinePostStream = (
  data: OutlinePostStreamData | PublicPostStreamData,
  onData: (data: PostStreamData) => void,
  onError: (error: any) => void,
  onComplete: () => void,
  config?: { signal?: AbortSignal }
) => {
  return apiClient.postStream(
    "/api/works/tool/outline",
    data,
    onData,
    onError,
    onComplete,
    config as RequestConfig
  );
};

interface ChapterPostStreamData {
  theme: string;
  description: string;
  relatedFiles: string[];
  promptId: string;
  workId: string;
}

const chapterPostStream = (
  data: ChapterPostStreamData | PublicPostStreamData,
  onData: (data: PostStreamData) => void,
  onError: (error: any) => void,
  onComplete: () => void,
  config?: { signal?: AbortSignal }
) => {
  return apiClient.postStream(
    "/api/works/tool/main-content",
    data,
    onData,
    onError,
    onComplete,
    config as RequestConfig
  );
};

const getRecommendConfig = () => {
  return apiClient.get<RecommendConfigResponse>("/api/rank/config");
};

export {
  introductionPostStream,
  characterPostStream,
  worldPostStream,
  outlinePostStream,
  chapterPostStream,
  getRecommendConfig,
};

export type {
  IntroductionPostStreamData,
  CharacterPostStreamData,
  WorldPostStreamData,
  OutlinePostStreamData,
};
