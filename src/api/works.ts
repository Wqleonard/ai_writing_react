// 这里先提供最小可用的 API 占位实现，避免 InsCanvas 中的动态 import 出现类型错误。
// 后续接入真实后端时，替换为实际的 fetch/axios 调用即可。

import apiClient from "./index";

export async function generateInspirationDrawIdReq(
  workId: string,
  _payload: { nodes: unknown; edges: unknown },
): Promise<{ id: string }> {
  // mock：用时间戳生成一个 id
  return { id: `${workId}-${Date.now()}` };
}

export async function generateInspirationReq(
  ideaContent?: string,
): Promise<{ inspirationWord: string; inspirations: Array<{ inspirationTheme: string; referenceStyle: string }> }> {
  const inspirationWord = (ideaContent ?? "灵感").slice(0, 20) || "灵感";
  return {
    inspirationWord,
    inspirations: [
      { inspirationTheme: "蒸汽朋克城市与齿轮钟楼", referenceStyle: "cinematic" },
      { inspirationTheme: "雪夜列车上的密室故事", referenceStyle: "noir" },
      { inspirationTheme: "海底遗迹与发光生物群", referenceStyle: "fantasy" },
    ],
  };
}

export const generateInspirationReqNew = (inspiration?: string) => {
    return apiClient.post("/api/works/inspiration", {
        inspiration: inspiration != "" ? inspiration : undefined,
    });
};

export async function generateInspirationImageReq(_payload: {
  inspirationWord?: string;
  inspirations?: Array<{ inspirationTheme: string }>;
}): Promise<Array<{ inspirationTheme: string; imageUrl: string }>> {
  // mock：暂不生成图片
  return apiClient.post("/api/works/inspiration-image", {
    inspirationWord: _payload.inspirationWord,
    inspirations: _payload.inspirations,
  });
}

export async function getWorksByIdReq(workId: string): Promise<any> {
  // mock：返回一个示例工作对象
  return {
    id: workId,
    title: "示例工作",
    description: "这是一个示例工作",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

interface PostInspirationStreamData {
  inspirationWord: string;
  inspirationTheme: string;
  shortSummary?: string;
  storySetting?: string;
  modelEndpoint?: string;
}

// 保存灵感画布数据
export async function saveInspirationCanvasReq(
  inspirationDrawId: string | number,
  payload: { nodes: unknown[]; edges: unknown[] },
) {
  return apiClient.post("/api/works/inspiration-canvas/save", {
    inspirationDrawId,
    ...payload,
  });
}

// 灵感画布流式输出内容
export async function postInspirationStream(
  data: PostInspirationStreamData,
  onData: (data: any) => void,
  onError: (error: any) => void,
  onComplete: () => void
) {
  return apiClient.postStream("/api/works/inspiration-stream", data, onData, onError, onComplete);
};