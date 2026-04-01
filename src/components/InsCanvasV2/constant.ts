import type {
  CanvasModeCategory,
  CanvasModelType,
  CanvasOutputType,
} from "./types";

export const MODE_CATEGORY_OPTIONS: Array<{
  key: CanvasModeCategory;
  label: string;
  disabled?: boolean;
}> = [
  { key: "smart", label: "智能模式", disabled: false },
  { key: "image", label: "图片生成模式", disabled: true },
  { key: "video", label: "视频生成模式", disabled: true },
];

export const OUTPUT_TYPE_OPTIONS: Array<{ key: CanvasOutputType; label: string }> = [
  { key: "auto", label: "自动" },
  { key: "brainstorm", label: "脑洞" },
  { key: "role", label: "角色" },
  { key: "summary", label: "梗概" },
  { key: "outline", label: "大纲" },
  { key: "info", label: "信息" },
];

export const MODEL_TYPE_OPTIONS: Array<{ key: CanvasModelType; label: string }> = [
  { key: "fast", label: "Fast" },
  { key: "max", label: "Max" },
];

export const IDEA_PLACEHOLDER_OPTIONS = [
  "输入一个想法，或点随机选题试试...",
  "拖动目录任意文件到画布，变为信息卡继续发散创意吧！",
  "将卡片添加到对话，可以根据卡片内容继续创作哦~",
  "头脑风暴开始咯！",
] as const;

export const AUTO_CARD_FIELD_LABELS: Record<string, string> = {
  synopsis: "梗概",
  summary: "梗概",
  short_summary: "梗概",
  shortSummary: "梗概",
  background: "背景",
  storySetting: "故事设定",
  story_setting: "故事设定",
  highlight: "亮点",
  informationGap: "信息差",
  intro: "简介",
  description: "描述",
  definition: "设定",
  content: "内容",
  age: "年龄",
  personality: "性格",
  biography: "经历",
};

export const CANVAS_UI = {
  randomIdeaOptionsMarker: "**三个脑洞选项：**",
  dockRestOffsetRem: -0.75,
} as const;

export const CANVAS_LAYOUT = {
  cardGapX: 28,
  cardGapY: 36,
  infoColumnGapX: 72,
} as const;

export const ROLE_GROUP_LAYOUT = {
  minHeight: 580,
  maxCols: 3,
  cardWidth: 300,
  cardHeight: 450,
  cardGapX: 24,
  cardGapY: 28,
  paddingTop: 64,
  padding: 24,
} as const;

export const OUTLINE_GROUP_LAYOUT = {
  settingsCardWidth: 600,
  settingsCardHeight: 420,
  settingsCollapsedHeight: 56,
  horizontalPadding: 20,
  settingsTop: 56,
  settingsBottomGap: 24,
  settingsNodeType: "outlineSettingCard",
  defaultTop: 56,
  maxCols: 3,
  cardWidth: 300,
  cardHeight: 260,
  cardGapX: 24,
  cardGapY: 28,
} as const;
