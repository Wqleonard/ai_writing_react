import { defineStore } from "pinia";
import { onMounted, ref } from "vue";
import { getPromptCategories } from "@/api/community-prompt.ts";
import { getRecommendConfig } from "@/api/editor-header-toolbar.ts";

export interface CategoryOption {
  label: string;
  value: string | number;
}

export interface RecommendConfigItem {
  key: string;
  label: string;
  value: string;
}

interface BannerConfig {
  title: string
  icon: string
  btnText: string
  content: string
  canOpen: boolean
}

interface config {
  recommendConfig: Record<string, any>,
  vxQrCode: string, // 图片
  vxQrCodeDesc: string, // 进群有礼描述
  privacyPolicy: string // HTML 隐私协议 待定
  userAgreement: string  // HTML 用户协议 待定
  bannerConfig: BannerConfig
}


export const useOptionsStore = defineStore("promptOptions", () => {
  // 提示词分类选项
  const promptCategories = ref<CategoryOption[]>([]);

  // 提示词图标选项
  const promptIconOptions = ref<CategoryOption[]>([
    {
      label: "图标1",
      value: "https://vibe-writing-qa-public.tos-cn-beijing.volces.com/default-book-mark-icon/Bookmark3.png",
    },
    {
      label: "图标2",
      value: "https://vibe-writing-qa-public.tos-cn-beijing.volces.com/default-book-mark-icon/Bookmark1.png",
    },
    {
      label: "图标3",
      value: "https://vibe-writing-qa-public.tos-cn-beijing.volces.com/default-book-mark-icon/Bookmark2.png",
    },
    {
      label: "图标4",
      value: "https://vibe-writing-qa-public.tos-cn-beijing.volces.com/default-book-mark-icon/Bookmark4.png",
    },
    {
      label: "图标5",
      value: "https://vibe-writing-qa-public.tos-cn-beijing.volces.com/default-book-mark-icon/Bookmark5.png",
    },
  ]);

  // 排序类型选项
  const sortTypeOptions = ref<CategoryOption[]>([
    { label: "最新", value: "updatedTime" },
    { label: "最热", value: "favoritesCount" },
  ]);

  // 页面类型选项
  const pageTypeOptions = ref<CategoryOption[]>([
    { label: "探索", value: "public" },
    { label: "我的", value: "my" },
    { label: "收藏", value: "favorite" },
  ]);

  const joinUsQrCode = ref('')
  const joinUsDesc = ref('')

  const bannerConfig = ref<BannerConfig>({
    title: '',
    icon: '',
    btnText: '',
    content: '',
    canOpen: false,
  })

  // 更新分类选项
  const updateCategories = async () => {
    try {
      const req = await getPromptCategories();
      if (req && Array.isArray(req)) {
        const categories = req.map((item) => {
          return {
            value: item.id + '',
            label: item.name,
          };
        });
        // 在前面添加"全部"选项
        promptCategories.value = [
          { label: "全部", value: "" },
          ...categories,
        ];
      }
    } catch (e) {
      console.error("获取提示词分类失败:", e);
      promptCategories.value = [
        { label: "全部", value: "" },
      ];
    }
  };

  const recommendConfig = ref<Record<string, string[]>>({})

  const updateConfig = async () => {
    try {
      const req: any = await getRecommendConfig();
      if (req.vxQrCodeUrl) {
        joinUsQrCode.value = req.vxQrCodeUrl;
      }
      if (req.vxQrCodeDescription) {
        joinUsDesc.value = req.vxQrCodeDescription
      }
      if (req.bannerConfig) {
        bannerConfig.value = {
          ...bannerConfig.value,
          ...req.bannerConfig,
        }
      }
      if (!req?.recommend) return
      const recommend = JSON.parse(req.recommend)

      if (recommend) {
        // 将对象转换为 Record<string, string[]> 格式
        // 如果对象的值有 value 属性，则提取 value；否则直接使用值
        recommendConfig.value = Object.entries(recommend).reduce<Record<string, string[]>>(
          (acc, [key, value]) => {
            // 如果 value 是对象且有 value 属性，提取它；否则直接使用（可能是数组）
            acc[key] = (value && typeof value === 'object' && 'value' in value)
              ? (Array.isArray(value.value) ? value.value : [])
              : (Array.isArray(value) ? value : []);
            return acc;
          },
          {}
        );
      }
    } catch (e) {
      console.error("获取推荐配置失败:", e);
    }
  }


  onMounted(async () => {
    await updateConfig()
  })

  return {
    // 状态
    promptCategories,
    promptIconOptions,
    sortTypeOptions,
    pageTypeOptions,
    recommendConfig,
    joinUsQrCode,
    joinUsDesc,
    bannerConfig,
    // 方法
    updateCategories,
    updateRecommendConfig: updateConfig,
  };
});

