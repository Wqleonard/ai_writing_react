export const AI_GENERATING_OUTLINE = "正在为您生成粗纲，请稍候...";
export const AI_GENERATING_DETAIL_OUTLINE = "正在为您生成细纲，请稍候...";
export const AI_GENERATING_CHAPTER = "正在为您生成正文，请稍候...";
export const AI_GENERATING_CONTENT = "正在为您生成内容，请稍候...";
export const AI_GENERATING_FINISH = "为您生成完成";
export const AI_CHAT_END_TEST = "321";

// 2025-12-08 新增高亮标记（不包含换行符，由插入逻辑动态决定）
export const HIGHLIGHT_START = `<<<--highlight-start-->>>`;
export const HIGHLIGHT_END = "<<<--highlight-end-->>>";

// localStorage 缓存管理
export const FLOW_CACHE_KEY = "chapter_flow_cache";
export const EDITOR_WORK_INFO_CACHE_KEY = "editor_work_info_cache";
// 缓存管理：保存/读取 作品ID -> 选中节点ID 的映射
export const SELECTED_NODE_CACHE_PREFIX = "work_selected_node_";

/**
 * 生成基于作品ID的作品信息缓存键
 * @param workId 作品ID
 * @returns 缓存键
 */
export const getWorkInfoCacheKey = (workId: string): string => {
  if (!workId) {
    return EDITOR_WORK_INFO_CACHE_KEY;
  }
  return `${EDITOR_WORK_INFO_CACHE_KEY}_${workId}`;
};

// 积分使用记录code-value映射表
export const ORDER_CODE_VALUE: Record<string, string> = {
  NEW_JOINER_REWARD: "新用户注册奖励",
  DAILY_FREE_CREDITS: "每日赠送",
  INVITATION_REWARD: "邀请新用户注册",
  CDKEY_REWARD: "兑换码兑换",
  AI_CHAT: "对话",
  NOVEL_DECONSTRUCT: "拆书仿写",
  WRITING_STYLE: "文风提炼",
  TOOL_STORY_SETTING: "使用提示词（故事设定）",
  TOOL_WORLD_SETTING: "使用提示词（故事设定）",
  TOOL_CHARACTER: "使用提示词（角色）",
  TOOL_OUTLINE: "使用提示词（大纲）",
  TOOL_MAIN_CONTENT: "使用提示词（正文）",
  TOOL_BRAIN_STORM: "使用提示词导语）",
  TOOL_CUSTOM_PROMPT_TEST: "灵感工坊：提示词测试",
  GENERATE_GUIDE: "对话联想",
  EDITOR_STORY_SETTING: "带你写-故事设定",
  EDITOR_MAIN_CHARACTER: "带你写-角色设定",
  TOOL_TEMPLATE_CREATION_OUTLINE: "带你写-大纲",
  EDITOR_BRAIN_STORM: "快捷创作-故事梗概",
  DOC_BRAIN_STORM: "快捷创作-故事梗概",
  DOC_MAIN_CHARACTER: "快捷创作-角色设定",
  DOC_OUTLINE: "快捷创作-大纲",
  DOC_DETAILED_OUTLINE: "快捷创作-细纲",
  DOC_MAIN_CONTENT: "快捷创作-正文",
  WORD_HIGHLIGHT_EXTEND: "划词修改/扩写",
  SCRIPT_PLOT: "快捷创作剧本-小说拆解",
  SCRIPT_BRAIN_STORM: "快捷创作剧本-故事梗概",
  SCRIPT_ROLE_SETTING: "快捷创作剧本-角色设定",
  SCRIPT_OUTLINE: "快捷创作剧本-大纲",
  SCRIPT_SPLIT_OUTLINE: "快捷创作剧本-细纲",
  SCRIPT_CONTENT: "快捷创作剧本-正文",
  GUIDE_TASK: "新手指南",
  START_CREAT_WORK: "新手指南-开始创作小说",
  SEND_CREATIVE_IDEA: "新手指南-发送创作想法",
  USE_WRITING_EDITOR: "新手指南-使用写作编辑器创作",
  CLICK_TRENDING_LIST: "新手指南-了解热门榜单",
  USE_AI_TOOLS: "新手指南-AI专家助力创作",
  USE_BOOK_ANALYSIS: "新手指南-体验拆书仿写",
  USE_WRITING_STYLE: "新手指南-体验文风提炼",
  USE_CREATION_COMMUNITY: "新手指南-前往灵感工坊",
  USE_COURSE: "新手指南-查看写作课程",
  USE_SHARE: "新手指南-查看分享信息",
  USE_PROMPTS: "新手指南-查看提示词工具",
  INSPIRATION_THEME: '画布创作-灵感选题',
  INSPIRATION_INTRODUCTION: '画布创作-故事梗概',
  INSPIRATION_STORY_SETTING: "画布创作-故事设定",
  INSPIRATION_STORY_OUTLINE: "画布创作-大纲"
};
