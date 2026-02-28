import { create } from "zustand"
import { getRecommendConfig } from "@/api/editor-header-toolbar"

/** 推荐配置：与 Vue optionsStore.recommendConfig 对齐，key 如 coreMeme / background / persona / wordCount / perspective */
export type RecommendConfig = Record<string, string[]>

interface OptionsState {
  recommendConfig: RecommendConfig
  updateRecommendConfig: () => Promise<void>
}

export const useOptionsStore = create<OptionsState>((set) => ({
  recommendConfig: {},

  updateRecommendConfig: async () => {
    try {
      const req = (await getRecommendConfig()) as {
        recommend?: string
        vxQrCodeUrl?: string
        vxQrCodeDescription?: string
        bannerConfig?: unknown
      }
      if (!req?.recommend) return
      const recommend = JSON.parse(req.recommend) as Record<string, unknown>
      if (!recommend) return
      const recommendConfig = Object.entries(recommend).reduce<RecommendConfig>(
        (acc, [key, value]) => {
          acc[key] =
            value && typeof value === "object" && "value" in value
              ? Array.isArray((value as { value: unknown }).value)
                ? (value as { value: string[] }).value
                : []
              : Array.isArray(value)
                ? (value as string[])
                : []
          return acc
        },
        {}
      )
      set({ recommendConfig })
    } catch (e) {
      console.error("获取推荐配置失败:", e)
    }
  },
}))
