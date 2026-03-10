import { defineStore } from "pinia";
import { ref } from "vue";
import type { FileItem, SelectedText, AgentTalkToolValue } from "@/utils/interfaces";
import type { Note } from "@/api/notes";

/**
 * 聊天输入框全局状态管理 Store
 * 统一管理关联关系、笔记、文件、划词文本和工具列表
 */
export const useChatInputStore = defineStore("chatInput", () => {
  // 关联关系标签列表
  const associationTags = ref<string[]>([]);

  // 选中的笔记列表
  const selectedNotes = ref<Note[]>([]);

  // 选中的文件列表
  const selectedFiles = ref<FileItem[]>([]);

  // 选中的划词文本列表
  const selectedTexts = ref<SelectedText[]>([]);

  // 是否触发一些场景需要弹出仅回答关闭的提示
  const isShowAnswerTip = ref<boolean>(false);
  const isShowWritingStyleTip = ref<boolean>(false);

  // 选中的工具列表
  const selectedTools = ref<AgentTalkToolValue[]>([
    "internet_search_tool",
    "knowledge_search_tool",
    "deep_thinking_tool",
    "auto_execute_tool",
  ]);

  // ========== 关联关系相关方法 ==========
  /**
   * 设置关联关系标签列表
   */
  const setAssociationTags = (tags: string[]) => {
    associationTags.value = [...tags];
  };

  /**
   * 添加关联关系标签
   */
  const addAssociationTag = (tag: string) => {
    if (!associationTags.value.includes(tag)) {
      associationTags.value.push(tag);
    }
  };

  /**
   * 移除关联关系标签
   */
  const removeAssociationTag = (index: number) => {
    if (index >= 0 && index < associationTags.value.length) {
      associationTags.value.splice(index, 1);
    }
  };

  /**
   * 清空关联关系标签
   */
  const clearAssociationTags = () => {
    associationTags.value = [];
  };

  // ========== 笔记相关方法 ==========
  /**
   * 设置笔记列表
   */
  const setSelectedNotes = (notes: Note[]) => {
    selectedNotes.value = [...notes];
  };

  /**
   * 添加笔记
   */
  const addNote = (note: Note) => {
    const existingIndex = selectedNotes.value.findIndex((n) => n.id === note.id);
    if (existingIndex === -1) {
      selectedNotes.value.push(note);
    }
  };

  /**
   * 移除笔记
   */
  const removeNote = (noteId: number) => {
    const index = selectedNotes.value.findIndex((n) => n.id === noteId);
    if (index > -1) {
      selectedNotes.value.splice(index, 1);
    }
  };

  /**
   * 清空笔记列表
   */
  const clearSelectedNotes = () => {
    selectedNotes.value = [];
  };

  // ========== 文件相关方法 ==========
  /**
   * 设置文件列表
   */
  const setSelectedFiles = (files: FileItem[]) => {
    selectedFiles.value = [...files];
  };

  /**
   * 添加文件
   */
  const addFile = (file: FileItem) => {
    selectedFiles.value.push(file);
  };

  /**
   * 移除文件
   */
  const removeFile = (fileId: string) => {
    const index = selectedFiles.value.findIndex((file) => file.id === fileId);
    if (index > -1) {
      selectedFiles.value.splice(index, 1);
    }
  };

  /**
   * 清空文件列表
   */
  const clearSelectedFiles = () => {
    selectedFiles.value = [];
  };

  // ========== 划词文本相关方法 ==========
  /**
   * 设置划词文本列表
   */
  const setSelectedTexts = (texts: SelectedText[]) => {
    selectedTexts.value = [...texts];
  };

  /**
   * 添加划词文本
   */
  const addSelectedText = (text: SelectedText) => {
    selectedTexts.value.push(text);
  };

  /**
   * 移除划词文本
   */
  const removeSelectedText = (textId: string) => {
    const index = selectedTexts.value.findIndex((t) => t.id === textId);
    if (index > -1) {
      selectedTexts.value.splice(index, 1);
    }
  };

  /**
   * 清空划词文本列表
   */
  const clearSelectedTexts = () => {
    selectedTexts.value = [];
  };

  // ========== 工具相关方法 ==========
  /**
   * 设置工具列表
   */
  const setSelectedTools = (tools: AgentTalkToolValue[]) => {
    selectedTools.value = [...tools];
  };

  /**
   * 切换工具开关
   */
  const toggleTool = (tool: AgentTalkToolValue) => {
    const index = selectedTools.value.indexOf(tool);
    if (index > -1) {
      selectedTools.value.splice(index, 1);
    } else {
      selectedTools.value.push(tool);
    }
  };

  /**
   * 重置工具列表为默认值
   */
  const resetSelectedTools = () => {
    selectedTools.value = [
      "internet_search_tool",
      "knowledge_search_tool",
      "deep_thinking_tool",
      "auto_execute_tool",
    ];
  };

  // ========== 批量操作方法 ==========
  /**
   * 清空所有选中的内容（发送消息后调用）
   */
  const clearAll = () => {
    clearAssociationTags();
    clearSelectedNotes();
    clearSelectedFiles();
    clearSelectedTexts();
    isShowAnswerTip.value = false;
    // 注意：不清空工具列表，保持用户的选择
  };

  /**
   * 初始化所有值（从外部参数初始化，如从首页跳转）
   */
  const initializeFromParams = (params: {
    associationTags?: string[];
    selectedNotes?: Note[];
    selectedFiles?: FileItem[];
    selectedTexts?: SelectedText[];
    selectedTools?: AgentTalkToolValue[];
    isShowAnswerTip?: boolean;
  }) => {
    if (params.associationTags) {
      setAssociationTags(params.associationTags);
    }
    if (params.selectedNotes) {
      setSelectedNotes(params.selectedNotes);
    }
    if (params.selectedFiles) {
      setSelectedFiles(params.selectedFiles);
    }
    if (params.selectedTexts) {
      setSelectedTexts(params.selectedTexts);
    }
    if (params.selectedTools) {
      setSelectedTools(params.selectedTools);
    }
    if (params.isShowAnswerTip !== undefined) {
      isShowAnswerTip.value = params.isShowAnswerTip;
    }
  };

  return {
    // 状态
    associationTags,
    selectedNotes,
    selectedFiles,
    selectedTexts,
    selectedTools,
    // 关联关系方法
    setAssociationTags,
    addAssociationTag,
    removeAssociationTag,
    clearAssociationTags,
    // 笔记方法
    setSelectedNotes,
    addNote,
    removeNote,
    clearSelectedNotes,
    // 文件方法
    setSelectedFiles,
    addFile,
    removeFile,
    clearSelectedFiles,
    // 划词文本方法
    setSelectedTexts,
    addSelectedText,
    removeSelectedText,
    clearSelectedTexts,
    // 工具方法
    setSelectedTools,
    toggleTool,
    resetSelectedTools,
    // 批量方法
    clearAll,
    initializeFromParams,
    isShowAnswerTip,
    isShowWritingStyleTip
  };
});

