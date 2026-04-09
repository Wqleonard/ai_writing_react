// 如果需要使用 @ai-sdk/vue 的 Message 类型，可以在这里导入
// import type { Message } from '@ai-sdk/vue'

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  type: ChatTabType;
  createdAt: number;
  updatedAt: number;
}

export type ChatTabType = "chat" | "faq" | "canvas";

// agent chat toolCalls key TYPE
export type ToolCallsKey =
  | "ls"
  | "read_file"
  | "write_file"
  | "edit_file"
  | "think_tool"
  | "word_count_tool"
  | "keyword_search_tool"
  | "knowledge_search_tool"
  | "internet_search_tool"
  | "write_todos"
  | "task"
  | "novel_deconstruct_tool"
  | "url_content_parser_tool"
  | "novel_inspiration_tool";

// agent chat toolCalls value TYPE
export interface ToolCallsValue {
  input?: ToolCallsValueItemInput;
  output?: ToolCallsValueItemOutput; //输出内容 不为空则需要遍历key
}

//ai输入内容类型
export interface ToolCallsValueItemInput {
  name: string;
  default_splice_value: string; //默认拼接值
  file_path: boolean;
  is_expend: boolean;
  keyword: boolean;
  file_type: boolean;
  query: boolean;
  subagent_type: boolean;
  need_show: ToolCallsValueNeedShowItem[];
}

//ai输出内容类型
export interface ToolCallsValueItemOutput {
  is_expend: boolean;
  default_result_value?: string; //默认结果值
}

export type ToolCallsValueNeedShowItem =
  | "content"
  | "old_string"
  | "new_string"
  | "thoughts"
  | "todos"
  | "document";

// toolCalls需要解析的项目TYPE
// export interface ToolCallsValueItem1 {
//   name: string; //显示名
//   file_path: boolean; //是否在显示名上拼接文件路径
//   is_expend: boolean; //是否折叠
//   content: boolean; //是否解析content的值
//   old_string: boolean; //解析旧内容
//   new_string: boolean; //解析新内容
//   thoughts: boolean; //解析思考的内容
//   keyword: boolean; //解析关键词
//   file_type: boolean; //解析知识库
//   query: boolean; //解析互联网信息
//   todos: boolean; //解析todos
//   subagent_type: boolean; //解析subagent_type
//   document: boolean; //待定字段，file文档key
// }

export interface ChatTab {
  id: string;
  title: string;
  messages: ChatMessage[];
  type: ChatTabType;
  createdAt: number;
  updatedAt: number;
}

// 数据结构接口
export interface TreeNode extends WorkNode {
  workId?: string;
  content?: string;
  isSelected?: boolean;
  path?: string[]; // 添加路径属性
}

export interface WorkNode {
  id?: string;
  label: string;
  children?: TreeNode[];
  perspective?: "0" | "1"; //'first_person' | 'third_person'
  audience?: "0" | "1"; //'male' | 'female'
  saveTime?: string;
  isSelected?: boolean;
  desc?: string;
}

// 文件项接口
export interface FileItem {
  id: string;
  originalName: string; // 用户上传时的原始文件名
  serverFileName: string; // 服务器生成的文件名
  putFilePath: string; // 上传路径
  displayUrl: string; // 显示/访问URL
  type: string; // MIME类型
  size: number; // 文件大小（字节）
  extension: string; // 文件扩展名
}

// 划词文本接口
export interface SelectedText {
  id: string;
  file: string; //文件名
  content: string; // 划词的内容
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "data";
  content: string;
  createdAt?: Date;
  customMessage?: AgentCustomMessage[]; //2025-10-10 新增Agent流式消息类型 (agentTodos现在是其中一项的属性)
  // timestamp?: Date
  hasActions?: boolean; // 标记是否有操作按钮
  outline?: OutlineToReview; // 大纲数据
  outlineType?: "outline" | "detailed_outline"; // 大纲类型
  messageType?: "outline" | "detailed_outline" | "chapter" | "edit" | "normal";
  detailedOutline?: DetailedOutlineToReview; // 细纲数据
  chapter?: ChapterToReview; // 章节数据
  editResult?: ChatEditResult; //编辑结果
  mode?: ChatTabType; // 标识当前是对话模式还是代写模式
  originalContent?: string; // 保存原始的创作内容，用于重新生成
  taskId?: string; // 保存任务ID，用于恢复任务状态
  isTaskCompleted?: boolean; // 标记创作任务是否已完成
  files?: FileItem[]; // 消息中的文件列表
  selectedTexts?: SelectedText[]; // 消息中的划词文本列表
  hasSensitiveWord?: boolean; // 标记是否触发了敏感词
}

//2025-10-10 新增Agent流式完整消息体类型
export interface AgentState {
  messages: AgentCustomMessage[];
  todos?: AgentTodos[];
  files?: {
    [key: string]: string;
  };
}
export interface AdditionalKwargs {
  tool_calls?: ToolCalls[];
}

export interface ToolCalls {
  index: number;
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

//2025-10-10 新增判断是否一个流式消息体结束
export interface ResponseMetadata {
  finish_reason: string;
  model_name: string;
  service_tier: string;
}

//2025-10-10 新增展示 消息体中的工具调用
// 后端返回的 tool_calls 格式（args 已经是完整的对象）
export interface ToolCallItem {
  name: string;
  args: any; // 对象类型，后端返回完整数据
  id: string;
  type: string;
}

//2025-10-10 新增 一个agent流阶段性结束后main_agent通过updates event触发的todos
export interface AgentTodos {
  content: string;
  status: "completed" | "in_progress" | "pending";
}

//2025-10-10 新增 Agent流式完整消息体类型
export type AgentCustomMessageType = "ai" | "tool" | "human";

export type EditorSaveStatus = "0" | "1" | "2"; //0: 手动保存 1: 自动保存 2: 消息发送前保存

export type AgentCustomMessageResultType = "input" | "output";

export interface BrainstormItem {
  title: string;
  intro?: string;
}

// AI/Tool/Human 消息类型
export interface AgentCustomMessage {
  content: string;
  additional_kwargs: AdditionalKwargs;
  response_metadata: ResponseMetadata;
  type: "ai" | "tool" | "human";
  resultType?: AgentCustomMessageResultType;
  name: string | null;
  id: string;
  example: boolean;
  tool_calls: ToolCallItem[];
  invalid_tool_calls: [];
  usage_metadata: null;
  suggestions?: string[]; // 联想提示词
  hiltTodos?: AgentTodos[]; // 2025-12-29 新增 人在回路任务列表
  hiltStatus?: "in_progress" | "approved" | "rejected"; // 2025-12-29 新增 人在回路处理状态 默认in_progress 待处理 rejected拒绝 接受approved
  rating?: "none" | "like" | "dislike"; // 评价状态 三态
}

export interface StatusUpdateData {
  response?: string;
  message?: string;
  status?: SSEStatus;
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
  outline_to_review?: OutlineToReview;
  detailed_outline_to_review?: DetailedOutlineToReview;
  edit_result?: ChatEditResult; //编辑结果
}

//编辑结果类型
export interface ChatEditResult {
  operation_id?: string;
  edit_type?: string; //编辑类型 insert
  original_content?: string; //原始内容
  generated_content?: string; //生成内容
  target_location?: ChatEditTargetLocation; //目标位置
  edit_request?: string; //编辑请求
  status?: string; //编辑状态  completed
}
//编辑内容定位
export interface ChatEditTargetLocation {
  start_context?: string; //开始上下文
  end_context?: string; //结束上下文
  matched_text?: string; //匹配到的文本
  chapter_path?: string; //正文路径 novel.chapters[0].content
  full_path?: string; //完整路径 novel.chapters[0].content.paragraph[1]
  confidence?: number; //置信度
  chapter_title?: string; //章节标题
  chapter_index?: number; //章节索引
  paragraph_index?: number; //段落索引
}

export interface ChapterToEdit {
  title: string;
  content: string;
}

export type SSEStatus =
  | "running"
  | "streaming_outline"
  | "streaming_detailed_outline"
  | "streaming_chapter"
  | "waiting_for_outline_review"
  | "waiting_for_detailed_outline_review"
  | "waiting_for_chapter_review"
  | "processing_feedback"
  | "completed"
  | "failed"
  | "stream_closed"
  | "chat_streaming"
  | "chat_completed"
  | "edit_workflow_started" //编辑工作流开始
  | "edit_completed" //编辑完成
  | "";
// export type OutlineAction = 'approved' | 'regenerate' | 'rejected'

// 反馈类型  粗纲 细纲 章节 编辑
export type FeedBackType = "outline" | "detailed_outline" | "chapter" | "edit";
export type FeedBackAction = "approved" | "regenerate" | "rejected";

// SSE流任务类型
export type SSEStreamTaskType =
  | "full_writing"
  | "brainwave_to_outline"
  | "outline_to_detailed"
  | "detailed_to_content"; //完整创作 作品信息生成大纲 大纲生成细纲 细纲生成章节
export type NuxtUIProChatStatus = "ready" | "error" | "submitted" | "streaming" | undefined;
// SSE流任务参数类型
export interface SSEStreamParamsType {
  brainwave?: string;
  novel_type?: string;
  chapter_num?: number;
  model_name?: string;
  novel_outline?: NovelOutlineForSSEParams; //大纲数据
  detailed_outline?: DetailedOutlineToReview; //细纲数据
}

// 大纲数据 流接口参数类型
export interface NovelOutlineForSSEParams {
  title: string; //标题
  genre: string; //类型
  main_character: string; //主角设定
  story_theme: string; //故事主题
  chapters: string[]; //章节标题列表
}

// 大纲数据 表单处理，数据转换解析等使用
export interface NovelOutline {
  title: string; //标题
  genre: string; //类型
  main_character: string; //主角设定
  story_theme: string; //故事主题
  chapters: NovelOutlineChapter[]; //章节列表
}

export interface NovelOutlineChapter {
  title_name: string; //章节标题
  title_infos: string; //章节信息1,2,3,4
}

export interface AgentType {
  id: SSEStreamTaskType;
  name: AgentName;
  icon?: string;
  description?: string;
}

// 快速输入框通道值类型
export interface QuickChatInputChannel {
  title: string;
  icon?: string;
  value: QuickChatInputChannelValue[];
  disabled?: boolean; //是否禁用
}

export interface QuickChatInputChannelValue {
  mold: "tip" | "span" | "input"; //是tip提示文本 是span文本还是input输入框
  value: string; //文本值或者提示值
  width?: string; //输入框宽度，仅当mold为input时有效
}

export type AgentName = "完整创作" | "脑洞生成粗纲" | "粗纲生成细纲" | "细纲生成章节";

// 粗纲
export interface OutlineToReview {
  title: string; //标题
  genre: string; //类型
  main_character: string; //主角设定
  story_theme: string; //故事主题
  chapters: OutlineToReviewChapter[]; //章节
}

//chat 聊天发送给ai的可供编辑的小说数据
export interface NovelToEdit {
  title: string; //标题
  genre: string; //类型
  main_character: string; //主角设定
  story_theme: string; //故事主题
  chapters: NovelToEditChapter[]; //章节
}

export interface NovelToEditChapter {
  chapter_num: number; //章节编号
  title: string; //标题
  content: string; //章节内容
}

// 粗纲章节
export interface OutlineToReviewChapter {
  title: string; //标题
  title_infos: string; //章节信息1,2,3,4
}

// 细纲
export interface DetailedOutlineToReview {
  title: string; //标题
  genre: string; //类型
  main_character: string; //主角设定
  story_theme: string; //故事主题
  chapters: DetailedOutlineToReviewChapter[]; //章节
}

// 细纲章节
export interface DetailedOutlineToReviewChapter {
  title: string; //标题
  highlight: string; //爽点
  emotions: string; //情绪波动
  plot_points: string; //情节描述
}

export interface ChapterToReview {
  chapterNum: number;
  chapterTitle: string;
  content: string;
  isGenerated?: boolean;
}

export interface StreamingContent {
  status?: NuxtUIProChatStatus;
  isStreaming: boolean;
  type: SSEStatus;
  content: string;
  chapterNum: number;
  chapterTitle: string;
  outline?: OutlineToReview;
  detailedOutline?: DetailedOutlineToReview;
  editResult?: ChatEditResult; //编辑结果
}

// 每阶段任务提示词类型
export type CueWordStage = "brainwave_to_outline" | "outline_to_detailed" | "detailed_to_content"; //脑洞到粗纲 粗纲到细纲 细纲到正文

// 每阶段任务提示词
export interface CueWord {
  stage: CueWordStage;
  category: string;
  content: string;
}

// 运行时提示词b表单数据
export interface RuntimePromptsFormData extends CueWord {
  selected: boolean;
  editStatus: boolean; //当为true表示为编辑状态，应当展示保存按钮，点击保存按钮，置为false，表示当前状态为已保存
  id: string; //唯一标识
}

// 2025-12-27 新增 工具选择状态
export type AgentTalkToolValue =
  | "internet_search_tool"
  | "knowledge_search_tool"
  | "deep_thinking_tool"
  | "auto_execute_tool";

// export interface NuxtUIProChatMessage extends Message {
//   id: string
//   role: "user" | "assistant" | "system" | "data";
//   content: string;
//   createdAt?: Date | undefined;
//   messageType?: 'outline' | 'detailed_outline' | 'chapter' | 'normal'
//   outline?: OutlineToReview // 大纲数据
//   detailedOutline?: DetailedOutlineToReview // 细纲数据
//   chapter?: ChapterToReview // 章节数据
//   // mode?: ChatTabType // 标识当前是对话模式还是代写模式
//   // originalContent?: string // 保存原始的创作内容，用于重新生成
//   // taskId?: string // 保存任务ID，用于恢复任务状态
//   // isTaskCompleted?: boolean // 标记创作任务是否已完成
// }

// 作品信息当前的状态
export type WorkInfoStage = "blank" | "outline" | "main_content" | "final";

//agent传递出来的 编辑文件内容类型
export interface EditFileArgsType {
  file_path: string;
  old_string?: string; // ✅ 新方案：从后端 tool message 中提取的 old_string
  new_string?: string;
  start_string?: string; // 保留兼容性，但新方案不再使用
  end_string?: string; // 保留兼容性，但新方案不再使用
}
// 实际在编辑器页面需要使用的编辑文件类型
export interface EditFileResultType {
  old_string?: string;
  new_string?: string;
}

// 创建的作品类型
export type CreateWorkType = "editor" | "doc" | "script";

// 2025-12-2新增 doc版本生成大纲
export interface DocCharacterData {
  name: string;
  gender?: string;
  age?: string;
  bloodType?: string;
  mbti?: string;
  experiences?: string;
  personality?: string;
  abilities?: string;
  identity?: string;
}

// 剧本角色设定卡片字段（与接口返回一致）
export interface ScriptCharacterCardData {
  name: string;
  definition: string;
  age: string;
  personality: string;
  biography: string;
  isCustom?: boolean;
}

// export interface ScriptCharacterCardDataUse extends ScriptCharacterCardData {
//   isCustom?: boolean;
// }

// 2025-12-2新增 doc版本生成大纲
export interface DocGenerateOutlineData {
  results: {
    [key: string]: string;
  }[];
  outline_dict: DocOutlineDict[];
}
//2025-12-2 大纲项
export interface DocOutlineDict {
  chapter: string;
  chapter_title: string;
  chapter_note: string;
}

// 2026新增 剧本创作分段(起承转合)生成大纲
export interface ScriptGenerateOutlineData {
  initial_prompt?: string;
  prompt?: string;
  outline_dict: ScriptSplitOutlineDict[];
}

// 2026年2-10新增 剧本创作分段(起承转合)生成大纲
export interface ScriptSplitOutlineDict {
  episode: string;
  episode_title: string;
  episode_note: string;
}

// 2026新增 剧本创作分段(起承转合)生成大纲
export interface ScriptOutlineStorageData {
  /**
   * 分段大纲的 Markdown 内容
   * - 新结构：按分段存储，每一项对应一个分段（起/承/转/合）的 md 内容
   * - 旧数据：可能为单个字符串（所有分段拼接），读取时会自动兼容处理
   */
  mdContent: string[];
  /**
   * 合并后的 JSON 大纲数据（所有分段的 episode / episode_title / episode_note）
   */
  jsonContent: ScriptGenerateOutlineData;
}

//2025-12-2 实际存储的doc 大纲内容
export interface DocOutlineStorageData {
  mdContent: string; //生成的md内容
  jsonContent: DocGenerateOutlineData; //后续需要使用的json数据
}

//2025-12-2 实际存储的doc章节内容
export interface DocChapterStorageData {
  detailedOutline: string; //章节细纲内容
  content: string; //正文内容
  /** 最后一章点击「完成」后为 true，用于初始化时决定是否锁定最后一章 */
  isFinished?: boolean;
}

// 2025-12-2新增 doc版本生成大纲
export interface PostDocTemplateStreamOutlineRequestData {
  description: string;
  brainStorm: {
    title: string;
    intro: string;
  };
  roleCard: DocCharacterData;
  chapterNum: number;
}

// 2026年2-10新增 剧本创作分段(起承转合)生成大纲
export interface PostScriptTemplateStreamSplitOutlineRequestData {
  novelPlot: string; //小说纲章
  description: string; //一句话梗概
  brainStorm: ScriptStorySynopsisResult; //故事梗概
  roleCards: ScriptCharacterCardData[]; //角色设定
  episodeNum: number; //集数
  episodeNumAndPart: string; //当前生成哪一段 起？承？转？合？
  existingEpisodes: string[]; //已有的分段大纲
}

// 2025-12-2新增 doc版本生成正文细纲
export interface PostDocTemplateStreamDetailedOutlineRequestData {
  description: string;
  brainStorm: {
    title: string;
    intro: string;
  };
  roleCard: DocCharacterData;
  chapterOutline: {
    chapter: string;
    chapterNote: string;
    chapterTitle: string;
  };
  existingDetailedOutlines: string[]; // 已有的细纲列表
  existingChapters: string; // 已存在的章节正文拼接
}

// 2025-12-4新增 doc版本生成正文第N章的正文 流式接口参数类型
export interface PostDocTemplateStreamContentRequestData {
  description: string;
  brainStorm: {
    title: string;
    intro: string;
  };
  roleCard: DocCharacterData;
  chapterOutline: {
    chapter: string;
    chapterNote: string;
    chapterTitle: string;
  };
  chapterDetailOutline: string;
  existingChapters: string; // 已存在的章节正文拼接
  wordCount: number; // 每章节字数
}

// 2026年新增 剧本创作生成小说纲章 流式接口参数类型
// 小说纲章的类型
export interface ScriptNovelOutlineChapterResult {
  originalName?: string;
  serverFileName?: string;
  wordCount?: number;
  chapterNum?: number;
  content?: string;
  skipped?: boolean;
}

// 剧本标签默认选中项
export interface ScriptSelectedTagsResult {
  topics?: string[];
  plots?: string[];
  backgrounds?: [];
  storyAudiences?: [];
  episodeNum?: string;
  synopsis?: string;
}

// 2026年2-11新增 剧本创作生成小说章纲 流式接口参数类型
export interface PostScriptTemplateStreamPlotRequestData {
  attachmentName: string;
  wordCount: number;
  chapterNum: number;
}


// 后端接口传参需要驼峰
export interface ScriptSplitOutlineDictRequest {
  episode: string;
  episodeTitle: string;
  episodeNote: string;
}

// 2026年2-11新增 剧本创作生成正文 流式接口参数类型
export interface PostScriptTemplateStreamContentRequestData {
  roleCards: ScriptCharacterCardData[]; //角色
  episodeDict: ScriptSplitOutlineDictRequest; //每一集的大纲字段
  existingPlots: string; //当前章节往前数5章之前的每一章的episode_note拼接，再拼接当前章节前面5章的正文内容，比如当前生成第8章，那么该字段就是1-2章的episode_note拼接一起，再拼接上3-7章的正文内容
}

//2026-02-11 实际存储的script章节内容
export interface ScriptChapterStorageData {
  episodeNote: string; //集纲（梗概）内容 是否不存也没关系，之前短篇里没有存梗概，从大纲存储的数据中也能获取，如果这里存储更方便处理的话，可以存
  content: string; //正文内容
  /** 最后一章点击「完成」后为 true，用于初始化时决定是否锁定最后一章 */
  isFinished?: boolean;
}

// 剧本故事梗概接口返回数据
export interface ScriptStorySynopsisResult {
  title?: string;
  synopsis?: string;
  background?: string;
  highlight?: string;
  informationGap?: string;
}

// 故事梗概卡片数据
// export interface StorySynopsisCardData {
//   title: string; // 剧名
//   synopsis: string; // 故事梗概
//   background: string; // 故事背景
//   highlight: string; // 核心亮点
//   informationGap: string; // 信息差
// }

// 笔记来源类型
export type NoteSourceType =
  | "MINI_APP_ADD"
  | "MINI_APP_CHAT"
  | "MINI_APP_INSPIRATION"
  | "PC_ADD"
  | "PC_CANVAS"
  | "PC_NOVEL_DECONSTRUCT"
  | "PC_CHAT_MODE"
  | "PC_INSPIRATION_DRAW"
  | "PC_WORD_HIGHLIGHT";

// 笔记来源映射对象
export const NOTE_SOURCE_MAP: Record<NoteSourceType, string> = {
  MINI_APP_ADD: "小程序-手动添加",
  MINI_APP_CHAT: "小程序-对话",
  MINI_APP_INSPIRATION: "小程序-灵感",
  PC_ADD: "PC端-手动添加",
  PC_CANVAS: "PC端-无限画布",
  PC_NOVEL_DECONSTRUCT: "PC端-拆书仿写",
  PC_CHAT_MODE: "PC端-仅回答",
  PC_INSPIRATION_DRAW: "PC端-灵感画布",
  PC_WORD_HIGHLIGHT: "PC端-划词",
};

// 灵感工坊-我的分享的状态
export type TWEET_STATUS = "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "REJECTED"; //草稿，审核中，已过审，已拒绝，
