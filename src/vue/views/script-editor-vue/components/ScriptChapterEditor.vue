<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from "vue";
import { ElButton, ElInput, ElMessage, ElMessageBox } from "element-plus";
import { addNote } from "@/api/notes";
import type { NoteSourceType, ScriptSplitOutlineDictRequest } from "@/vue/utils/interfaces";

import TiptapEditor from "@/components/TiptapEditor.vue";
import { useEditorStore } from "@/vue/stores/editor.ts";
import type {
  ScriptChapterStorageData,
  PostScriptTemplateStreamContentRequestData,
  ScriptSplitOutlineDict,
  ScriptOutlineStorageData,
  ScriptCharacterCardData,
} from "@/vue/utils/interfaces";
import type { PostStreamData } from "@/api";
import EditIcon from "@/assets/images/quick_creation/edit.svg";
// import { trackingQuickCreationGenerate } from "@/utils/matomoTrackingEvent/clickEvent";
import { postScriptTemplateStreamContent } from "@/api/generate-quick";

// 处理选中文本工具栏的笔记按钮点击
const handleSelectionNoteClick = async (text: string) => {
  if (!text || !text.trim()) {
    ElMessage.warning("选中的内容为空，无法添加笔记");
    return;
  }

  // 获取作品名（从 props 或 editorStore）
  const workTitle = props.workTitle || editorStore.workInfo?.title || "作品";

  // 构建笔记标题：作品名 + 第N集
  const chapterName = props.chapterData?.episode ?? `第${props.chapterIndex + 1}集`;
  const noteTitle = `${workTitle}-${chapterName}`;

  try {
    await addNote(
      noteTitle,
      text.trim(),
      "PC_WORD_HIGHLIGHT" as NoteSourceType
    );
    ElMessage.success("笔记添加成功");
  } catch (error) {
    console.error("添加笔记失败:", error);
    ElMessage.error("添加笔记失败，请重试");
  }
};

interface Props {
  chapterIndex: number; // 章节索引（从0开始）
  chapterData?: ScriptSplitOutlineDict | null; // 从大纲中解析的章节/集数据
  chapterContent?: string; // 从serverData读取的章节内容（JSON字符串）
  episodeNum?: number; // 集数（来自标签「故事有多少集数」，用于生成参数）
  locked?: boolean; // 是否锁定（不可编辑）
  isLastChapterWithContent?: boolean; // 是否是最后一个有内容的章节
  previousChapterIndex?: number; // 上一个有内容的章节索引（用于回退按钮显示）
  hasNextContent?: boolean; // 后面是否有内容
  workTitle?: string; // 作品名（用于添加笔记）
}

interface Emits {
  (e: "confirm", chapterData: string): void; // 确认时传递章节数据
  (e: "revert"): void; // 回退到编辑大纲（清空章节目录）
  (e: "revertToNote"): void; // 回退到故事梗概状态（清除细纲和正文，保留章节目录）
  (e: "updateChapterNote", chapterEpisodeNote: string): void; // 更新章节故事梗概（episode_note）
  (e: "scrollBoundary", boundary: "top" | "bottom"): void; // 滚动边界事件
  (e: "generateContent"): void; // 生成正文事件（用于初始化下一章）
  (e: "continueNextChapter"): void; // 继续下一章事件
  (e: "revert-to-current"): void; // 回退到当前步骤
}

const props = withDefaults(defineProps<Props>(), {
  chapterIndex: 0,
  chapterData: undefined,
  chapterContent: "",
  episodeNum: 60,
  locked: false,
  isLastChapterWithContent: false,
  workTitle: "",
});

const emit = defineEmits<Emits>();

const editorStore = useEditorStore();

// 章节数据：梗概（来自大纲 episode_note，可编辑）、正文
const chapterEpisodeNote = ref(""); // 本集故事梗概（episode_note）
const contentText = ref(""); // 正文内容

// 状态
const isEditingNote = ref(false);
const isGeneratingContent = ref(false);
const isEditingContent = ref(false);
const isNoteExpanded = ref(false);
const contentStreamAbortController = ref<AbortController | null>(null);
const contentStreamingText = ref("");

// 按钮区域引用
const contentSideActionsRef = ref<HTMLElement | null>(null);

// 计算属性
const hasContent = computed(() => contentText.value.trim().length > 0);

// 使用props传递的值
const isLastChapterWithContent = computed(() => props.isLastChapterWithContent);

const isEpisodeDir = (dir: string): boolean => /^第\d+集\.md$/.test(dir);

// 判断是否是最后一集：根据 serverData 中集数目录 + 大纲 outline_dict 长度取最大索引，当前等于该索引即为最后一集
const isLastChapter = computed(() => {
  const outlineDict = getOutlineDict();
  const outlineCount = outlineDict.length;
  const chapterDirs = Object.keys(editorStore.serverData).filter((k) => isEpisodeDir(k));
  const indices = chapterDirs
    .map((dir) => getChapterIndexFromDir(dir))
    .filter((idx) => idx >= 0)
    .sort((a, b) => a - b);
  const maxFromDirs = indices.length > 0 ? Math.max(...indices) : -1;
  const maxIndex = outlineCount > 0 ? Math.max(maxFromDirs, outlineCount - 1) : maxFromDirs;
  if (maxIndex < 0) return false;
  return props.chapterIndex === maxIndex;
});

// DOM引用
const tiptapEditorRef = ref<InstanceType<typeof TiptapEditor> | null>(null);
const chapterEditorRef = ref<HTMLElement | null>(null);
const outlineScrollRef = ref<HTMLElement | null>(null);
const outlineEditorWrapperRef = ref<HTMLElement | null>(null);
const contentEditorWrapperRef = ref<HTMLElement | null>(null);
const contentEditorRef = ref<InstanceType<typeof TiptapEditor> | null>(null);
const noteInputRef = ref<InstanceType<typeof ElInput> | null>(null);

// 记录编辑器的最后失焦位置
const lastBlurPosition = ref<number | null>(null);

// console.log("[ScriptChapterEditor] Component mounted, chapterIndex:", props.chapterIndex);


// 从目录名称提取集数索引（0-based）。目录统一为 第N集.md
const getChapterIndexFromDir = (dir: string): number => {
  const numMatch = dir.match(/^第(\d+)集\.md$/);
  if (numMatch) return Math.max(0, parseInt(numMatch[1], 10) - 1);
  return -1;
};

const getChapterDirByIndex = (index: number): string => `第${index + 1}集.md`;

const getOutlineDict = (): ScriptSplitOutlineDict[] => {
  try {
    const raw = editorStore.serverData["大纲.md"];
    if (!raw?.trim()) return [];
    const parsed = JSON.parse(raw) as ScriptOutlineStorageData;
    return parsed.jsonContent?.outline_dict ?? [];
  } catch (_) {
    return [];
  }
};

const getEpisodeLabel = (index: number): string => {
  const dict = getOutlineDict();
  return dict[index]?.episode ?? `第${index + 1}集`;
};

const getRoleCardsList = (): ScriptCharacterCardData[] => {
  const normalize = (c: Record<string, unknown>): ScriptCharacterCardData => ({
    name: String(c.name ?? ""),
    definition: String(c.definition ?? ""),
    age: String(c.age ?? ""),
    personality: String(c.personality ?? ""),
    biography: String(c.biography ?? ""),
  });
  try {
    const raw = editorStore.serverData["主角设定.md"];
    if (!raw?.trim()) return [];
    const data = JSON.parse(raw);
    const list = data?.generatedCards ?? (Array.isArray(data) ? data : []);
    return Array.isArray(list) ? list.map((c: Record<string, unknown>) => normalize(c)) : [];
  } catch (_) {
    return [];
  }
};

// existingPlots：往前数5章之前的 episode_note 拼接 + 前5章正文拼接（见 interfaces 注释）
const getExistingPlots = (): string => {
  const outlineDict = getOutlineDict();
  const serverData = editorStore.serverData;
  const i = props.chapterIndex;
  const noteEnd = Math.max(0, i - 5);
  const contentStart = Math.max(0, i - 5);
  const contentEnd = i;
  const parts: string[] = [];
  for (let idx = 0; idx < noteEnd; idx++) {
    const note = outlineDict[idx]?.episode_note?.trim();
    if (note) parts.push(note);
  }
  for (let idx = contentStart; idx < contentEnd; idx++) {
    const dir = getChapterDirByIndex(idx);
    if (!dir) continue;
    try {
      const str = serverData[dir];
      if (str) {
        const stored = JSON.parse(str) as ScriptChapterStorageData | { content?: string };
        const content = (stored as ScriptChapterStorageData).content?.trim?.();
        if (content) parts.push(content);
      }
    } catch (_) {}
  }
  return parts.join("\n\n");
};


// 点击故事梗概区域，进入编辑模式
const handleNoteAreaClick = () => {
  if (props.locked || isGeneratingContent.value) return;
  isEditingNote.value = true;

  nextTick(() => {
    noteInputRef.value?.focus();
  });
};

// 保存故事梗概
const saveChapterNote = () => {
  if (!isEditingNote.value) return;
  isEditingNote.value = false;
  console.log("[ScriptChapterEditor] Save chapter note:", chapterEpisodeNote.value);
  emit("updateChapterNote", chapterEpisodeNote.value);
};

// 保存章节数据到 serverData（ScriptChapterStorageData：episodeNote + content）
const saveChapterData = () => {
  const episodeNote = chapterEpisodeNote.value?.trim() ?? "";
  const storageData: ScriptChapterStorageData = {
    episodeNote,
    content: contentText.value || "",
  };
  const storageDataString = JSON.stringify(storageData);
  emit("confirm", storageDataString);
};

// 点击页面其他区域退出编辑
const handleDocumentClick = (e: MouseEvent) => {
  if (isEditingContent.value) {
    // 检查点击是否在正文编辑区域内
    if (
      contentEditorWrapperRef.value &&
      !contentEditorWrapperRef.value.contains(e.target as Node)
    ) {
      exitContentEditAndSave();
    }
  }
};

// 回退到编辑大纲或上一章（清空章节目录）
const handleRevert = async () => {
  console.log("[ScriptChapterEditor] handleRevert");

  // 如果有上一章，回退到上一章；否则回退到编辑大纲
  if (props.previousChapterIndex !== undefined && props.previousChapterIndex >= 0) {
    try {
      await ElMessageBox.confirm(
        `回退后，该步骤后续内容将被清空不可找回`,
        `是否回退至${getEpisodeLabel(props.previousChapterIndex)}？`,
        {
          confirmButtonText: "确认",
          cancelButtonText: "取消",
          type: "warning",
          customClass: "revert-confirm-dialog",
        }
      );
      emit("revert");
    } catch (e) {
      console.log("[ScriptChapterEditor] User cancelled revert");
    }
  } else {
    try {
      await ElMessageBox.confirm("回退后，该步骤后续内容将被清空不可找回", "是否回退至编辑大纲？", {
        confirmButtonText: "确认",
        cancelButtonText: "取消",
        type: "warning",
        customClass: "revert-confirm-dialog",
      });
      emit("revert");
    } catch (e) {
      console.log("[ScriptChapterEditor] User cancelled revert");
    }
  }
};

// 回退到故事梗概状态（清除正文，保留梗概）
const handleRevertToNote = async () => {
  if (isGeneratingContent.value) return;
  try {
    await ElMessageBox.confirm("回退后，正文内容将被清空不可找回", "是否回退至此步骤？", {
      confirmButtonText: "确认",
      cancelButtonText: "取消",
      type: "warning",
      customClass: "revert-confirm-dialog",
    });
    emit("revertToNote");
  } catch (_) {}
};

// 重新生成正文
const regenerateContent = async () => {
  console.log("[ScriptChapterEditor] regenerateContent called");

  try {
    await ElMessageBox.confirm("重新生成将清空当前正文内容", "是否确认重新生成？", {
      confirmButtonText: "确认",
      cancelButtonText: "取消",
      type: "warning",
    });

    // 清空正文内容
    contentText.value = "";
    contentStreamingText.value = "";
    isEditingContent.value = false; // 重置编辑状态

    // 重新生成
    await generateContent();
  } catch (e) {
    console.log("[ScriptChapterEditor] User cancelled regenerate content");
  }
};

// 继续下一章
const continueNextChapter = () => {
  console.log("[ScriptChapterEditor] continueNextChapter called");
  emit("continueNextChapter");
};

// 处理回退到当前步骤
const handleRevertToCurrent = () => {
  emit("revert-to-current");
};

// 插入笔记内容到光标位置
const insertNoteContent = (notes: any[]): { success: boolean; message: string } => {
  // 检查是否正在生成正文
  if (isGeneratingContent.value) {
    return { success: false, message: '请等待生成结束后添加' };
  }

  // 检查是否已生成正文（是否锁定）
  if (!hasContent.value) {
    return { success: false, message: '请先生成正文内容' };
  }

  // 检查编辑器引用是否存在
  if (!contentEditorRef.value) {
    return { success: false, message: '无法找到正文编辑器' };
  }

  // 检查编辑器是否有焦点（光标位置）
  const editor = contentEditorRef.value.editor;
  if (!editor) {
    return { success: false, message: '无法获取编辑器实例' };
  }

  // 检查是否有焦点或保存的失焦位置
  const editorElement = editor.view.dom as HTMLElement;
  const hasFocus = document.activeElement === editorElement || editorElement.contains(document.activeElement);

  let insertPosition: number;

  if (hasFocus) {
    // 如果有焦点，使用当前光标位置
    insertPosition = editor.state.selection.from;
  } else if (lastBlurPosition.value !== null) {
    // 如果有保存的失焦位置，使用该位置
    insertPosition = lastBlurPosition.value;
  } else {
    // 既没有焦点，也没有保存的位置，提示用户
    return { success: false, message: '请先在正文中确认位置' };
  }

  // 拼接所有笔记的内容
  const notesContent = notes.map(note => note.content).join('\n\n');

  // 在指定位置插入内容
  editor.chain()
    .focus()
    .setTextSelection(insertPosition)
    .insertContent(notesContent)
    .run();

  // 清空保存的失焦位置
  lastBlurPosition.value = null;

  // 更新 contentText（从编辑器获取最新内容）
  contentText.value = contentEditorRef.value.getText();

  // 自动保存章节数据
  saveChapterData();

  return { success: true, message: '笔记内容已添加到正文' };
};

// 处理编辑器失焦事件，记录光标位置
const handleContentEditorBlur = () => {
  if (!contentEditorRef.value || !isEditingContent.value) {
    return;
  }

  const editor = contentEditorRef.value.editor;
  if (!editor) {
    return;
  }

  // 记录失焦时的光标位置
  const { from } = editor.state.selection;
  lastBlurPosition.value = from;
  console.log('[ScriptChapterEditor] 记录失焦位置:', from);
};

// 监听编辑器 DOM 的 blur 事件
watch(
  () => contentEditorRef.value,
  (newRef, oldRef) => {
    // 移除旧编辑器的事件监听器
    if (oldRef && oldRef.editor) {
      const oldEditorElement = oldRef.editor.view.dom as HTMLElement;
      oldEditorElement.removeEventListener('blur', handleContentEditorBlur);
    }

    // 为新编辑器添加事件监听器
    if (newRef && newRef.editor) {
      // 等待编辑器完全初始化
      nextTick(() => {
        if (newRef.editor) {
          const editorElement = newRef.editor.view.dom as HTMLElement;
          editorElement.addEventListener('blur', handleContentEditorBlur);
        }
      });
    }
  },
  { immediate: true }
);

// 组件卸载时清理事件监听器
onUnmounted(() => {
  if (contentEditorRef.value && contentEditorRef.value.editor) {
    const editorElement = contentEditorRef.value.editor.view.dom as HTMLElement;
    editorElement.removeEventListener('blur', handleContentEditorBlur);
  }
});

// 暴露方法给父组件
defineExpose({
  insertNoteContent,
  isGeneratingContent,
  hasContent,
  isEditingContent,
});

// 点击正文编辑区域
const handleContentEditorClick = (e: MouseEvent) => {
  e.stopPropagation();
  // 如果正在生成内容，不允许编辑
  if (isGeneratingContent.value) return;
  // 如果没有内容，不允许编辑
  if (!hasContent.value) return;
  // 如果已经处于编辑状态，不重复触发
  if (isEditingContent.value) return;
  isEditingContent.value = true;
};

// 退出正文编辑并保存
const exitContentEditAndSave = () => {
  console.log("[ScriptChapterEditor] exitContentEditAndSave");
  isEditingContent.value = false;
  saveChapterData();
};

// 切换故事梗概展开
const toggleNoteExpanded = () => {
  isNoteExpanded.value = !isNoteExpanded.value;
};

// 从流式数据中提取内容
const getContentFromPartial = (partialData: any): string => {
  if (!partialData || !Array.isArray(partialData) || partialData.length === 0) {
    return "";
  }
  const firstItem = partialData[0];
  return firstItem.content || "";
};

// 生成正文（新接口：roleCards + episodeDict + existingPlots）
const generateContent = async () => {
  if (!props.chapterData) {
    ElMessage.warning("缺少章节数据");
    return;
  }

  // trackingQuickCreationGenerate("Chapter");

  try {
    contentText.value = "";
    contentStreamingText.value = "";
    isGeneratingContent.value = true;
    contentStreamAbortController.value = new AbortController();

    const roleCards = getRoleCardsList();
    const episodeDict: ScriptSplitOutlineDictRequest = {
      episode: props.chapterData.episode,
      episodeTitle: props.chapterData.episode_title,
      episodeNote: chapterEpisodeNote.value || props.chapterData.episode_note || "",
    };
    const existingPlots = getExistingPlots();

    const requestData: PostScriptTemplateStreamContentRequestData = {
      roleCards,
      episodeDict,
      existingPlots,
    };

    // 流式数据回调
    const onContentStreamData = (data: PostStreamData) => {
      if (data?.event !== "messages/partial") return;
      const raw = getContentFromPartial(data.data);
      if (typeof raw === "string") {
        contentStreamingText.value = raw;
      } else {
        const arr = raw as unknown as { text?: string }[];
        if (Array.isArray(arr) && arr.length > 0 && arr[0]?.text) {
          contentStreamingText.value = arr[0].text;
        }
      }
    };

    let hasThrowError=false;
    // 流式错误回调
    const onContentStreamError = (error: any) => {
      console.error("[ScriptChapterEditor] Content stream error:", error);
      if (error instanceof DOMException && error.name === "AbortError") {
        console.log("[ScriptChapterEditor] 正文流式请求已取消");
        return;
      }
      if(hasThrowError) return;
      hasThrowError = true;
      // ElMessage.error("生成正文失败，请重试");
      isGeneratingContent.value = false;
      contentStreamAbortController.value = null;
      setTimeout(() => {
        hasThrowError = false;
      }, 1000);
    };

    // 流式完成回调
    const onContentStreamEnd = () => {
      console.log("[ScriptChapterEditor] Content stream completed");

      // 调试：查看原始数据是否包含换行符
      const content = contentStreamingText.value;
      console.log("[DEBUG 正文数据] 前300字符:", content.substring(0, 300));
      console.log(
        "[DEBUG 正文数据] 前300字符(可见空格):",
        JSON.stringify(content.substring(0, 300))
      );
      console.log("[DEBUG 正文数据] 总换行符数量:", (content.match(/\n/g) || []).length);
      console.log("[DEBUG 正文数据] 句号+换行数量:", (content.match(/。\n/g) || []).length);
      console.log("[DEBUG 正文数据] 句号+双空格+换行:", (content.match(/。  \n/g) || []).length);
      console.log("[DEBUG 正文数据] 句号+单空格+换行:", (content.match(/。 \n/g) || []).length);
      console.log("[DEBUG 正文数据] 句号+非换行数量:", (content.match(/。[^\n]/g) || []).length);
      console.log("[DEBUG 正文数据] 完整内容:", content);

      contentText.value = contentStreamingText.value;
      contentStreamingText.value = "";
      isGeneratingContent.value = false;
      contentStreamAbortController.value = null;

      // 自动保存
      saveChapterData();

      // 如果是最后一章，显示创作完成提示
      console.log(
        "[ScriptChapterEditor] Content stream end, isLastChapter:",
        isLastChapter.value,
        "hasContent:",
        hasContent.value
      );
      if (isLastChapter.value && hasContent.value) {
        console.log("[ScriptChapterEditor] Last chapter completed, showing success message");
        ElMessage.success({
          message: "恭喜！您已完成所有章节的创作！",
          duration: 3000,
        });
      }
      // 触发生成正文事件（用于父组件处理）
      emit("generateContent");
    };

    await postScriptTemplateStreamContent(
      requestData,
      onContentStreamData,
      onContentStreamError,
      onContentStreamEnd,
      { signal: contentStreamAbortController.value.signal }
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      console.log("[ScriptChapterEditor] 请求已取消");
      isGeneratingContent.value = false;
      contentStreamAbortController.value = null;
      return;
    }
    console.error("[ScriptChapterEditor] 调用正文接口失败:", error);
    isGeneratingContent.value = false;
    contentStreamAbortController.value = null;
    // ElMessage.error("生成正文失败，请重试");
  }
};

// 从 props 初始化（ScriptChapterStorageData：episodeNote + content）
const initFromProps = () => {
  // 优先用大纲的 episode_note（chapterData），避免被章节文件里的空 episodeNote 覆盖导致不展示
  if (props.chapterData?.episode_note != null) {
    chapterEpisodeNote.value = props.chapterData.episode_note || "";
  }
  if (!props.chapterContent?.trim()) {
    if (!contentText.value) contentText.value = "";
    return;
  }
  try {
    const storageData = JSON.parse(props.chapterContent) as ScriptChapterStorageData | { content?: string; episodeNote?: string };
    const newNote = (storageData as ScriptChapterStorageData).episodeNote ?? "";
    const newContent = (storageData as ScriptChapterStorageData).content ?? "";
    if (contentText.value !== newContent) contentText.value = newContent;
    // 仅当章节文件里存了梗概时才覆盖；若大纲有值而存储为空，保留大纲值
    if (newNote || !props.chapterData?.episode_note) {
      chapterEpisodeNote.value = newNote;
    }
  } catch (_) {
    if (!contentText.value) contentText.value = "";
  }
};

// 监听props变化
watch(
  () => [props.chapterData, props.chapterContent],
  () => {
    initFromProps();
  },
  { immediate: true, deep: true }
);

// 处理细纲区域滚动
const handleOutlineScroll = () => {
  if (!outlineScrollRef.value) return;

  const el = outlineScrollRef.value;
  const scrollTop = el.scrollTop;

  if (scrollTop <= 0) {
    console.log("[ScriptChapterEditor] Scroll to top");
    emit("scrollBoundary", "top");
  }
};

// 处理主容器滚动（已不需要，使用 sticky 定位）
const handleMainScroll = () => {
  // 使用 sticky 定位后，不再需要手动计算位置
};

// 组件挂载
onMounted(() => {
  // console.log("[ScriptChapterEditor] onMounted");
  initFromProps();

  // 添加细纲区域滚动监听
  nextTick(() => {
    if (outlineScrollRef.value) {
      outlineScrollRef.value.addEventListener("scroll", handleOutlineScroll, { passive: true });
    }

    // 添加主容器滚动监听（用于按钮悬浮）
    const scrollContainer = document.querySelector(".content-scroll-area") as HTMLElement;
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", handleMainScroll, { passive: true });
      // 初始检查一次
      handleMainScroll();
    }
  });

  // 添加点击外部退出编辑的监听
  document.addEventListener("click", handleDocumentClick);
});

// 组件卸载
onUnmounted(() => {
  console.log("[ScriptChapterEditor] onUnmounted");

  if (outlineScrollRef.value) {
    outlineScrollRef.value.removeEventListener("scroll", handleOutlineScroll);
  }

  // 移除主容器滚动监听
  const scrollContainer = document.querySelector(".content-scroll-area") as HTMLElement;
  if (scrollContainer) {
    scrollContainer.removeEventListener("scroll", handleMainScroll);
  }

  document.removeEventListener("click", handleDocumentClick);
});
</script>

<template>
  <div class="quick-chapter-editor" ref="chapterEditorRef">
    <!-- 第一部分：内容区域 -->
    <div class="viewport-section">
      <!-- 回退按钮 -->
      <!-- <div class="header-actions">
        <el-button class="revert-btn" @click="handleRevert">
          {{
            props.previousChapterIndex !== undefined && props.previousChapterIndex >= 0
              ? `回退至${getEpisodeLabel(props.previousChapterIndex)}`
              : "回退至编辑大纲"
          }}
        </el-button>
        <div class="header-divider"></div>
      </div> -->

      <!-- 章节标题 -->
      <div class="chapter-title">{{ props.chapterData?.episode }} {{ props.chapterData?.episode_title }}</div>

      <!-- 故事梗概区域 -->
      <div class="chapter-note-section">
        <!-- 故事梗概展示条 -->
        <div class="note-container" :class="{
          editing: isEditingNote,
          locked: hasContent && !isGeneratingContent,
          expanded: isNoteExpanded,
          'has-outline': hasContent || isGeneratingContent,
        }" @click="handleNoteAreaClick">
          <div class="note-content">
            <span v-if="!isEditingNote" class="note-text" :class="{ expanded: isNoteExpanded }">
              {{ chapterEpisodeNote }}
            </span>
            <el-input v-else ref="noteInputRef" v-model="chapterEpisodeNote" type="textarea" :rows="3"
              class="note-input" :autosize="false" @blur="saveChapterNote" @click.stop />
          </div>
          <div v-if="!hasContent && !isGeneratingContent" class="note-edit-btn">
            <img :src="EditIcon" alt="编辑" class="edit-icon" />
            <span class="edit-text">编辑</span>
          </div>
        </div>

        <!-- 右侧：生成正文 / 回退至此步骤 -->
        <div class="note-side-actions">
          <el-button v-if="!hasContent && !isGeneratingContent" type="primary" class="generate-btn"
            :disabled="!chapterEpisodeNote" @click="generateContent">
            生成正文
          </el-button>
          <el-button v-else-if="hasContent || isGeneratingContent" class="revert-btn-outline"
            :disabled="isGeneratingContent" @click.stop="handleRevertToNote">
            回退至此步骤
          </el-button>
        </div>
      </div>

      <!-- 正文内容骨架提示条：当点击生成正文按钮且内容未传递过来时显示 -->
      <div v-if="isGeneratingContent && !contentText && !contentStreamingText" class="content-tip-bar-container">
        <div class="content-tip-bar-item"></div>
        <div class="content-tip-bar-item"></div>
        <div class="content-tip-bar-item"></div>
        <div class="content-tip-bar-item content-tip-bar-item-short"></div>
        <div class="content-tip-bar-item content-tip-bar-item-short"></div>
      </div>
    </div>

    <!-- 第二部分：正文内容区域（高度根据内容自适应） -->
    <div v-if="
      (hasContent || contentStreamingText) &&
      !(isGeneratingContent && !contentText && !contentStreamingText)
    " class="content-section">
      <div class="content-editor-container">
        <div ref="contentEditorWrapperRef" class="content-editor-wrapper" :class="{
          editing: isEditingContent,
          generating: isGeneratingContent,
          'last-chapter-completed': isLastChapter && hasContent && !isGeneratingContent,
        }" @click="handleContentEditorClick">
          <div v-if="!isGeneratingContent && hasContent && !isEditingContent" class="content-edit-icon">
            <!-- <img :src="EditIcon" alt="编辑" class="edit-icon" />
            <span class="edit-text">编辑</span> -->
          </div>
          <!-- <div v-if="isGeneratingContent" class="content-streaming-text">
            {{ contentStreamingText || "正在生成正文..." }}
          </div> -->
          <TiptapEditor v-if="isGeneratingContent" v-model="contentStreamingText" contentType="md" :show-toolbar="false"
            :need-selection-toolbar="false" :placeholder="'正文内容...'" :editable="false"
            :btns="['edit', 'expand', 'note']" class="content-editor" @selection-note="handleSelectionNoteClick" />
          <TiptapEditor v-else v-model="contentText" :placeholder="'正文内容...'" :editable="!isGeneratingContent"
            :show-toolbar="false" contentType="md" :btns="['edit', 'expand', 'note']" class="content-editor"
            ref="contentEditorRef" @selection-note="handleSelectionNoteClick" />
        </div>
        <div class="content-side-actions" ref="contentSideActionsRef">
          <div class="sticky-actions-container">
            <el-button v-if="hasContent && !isGeneratingContent && !props.locked"
              class="action-btn regenerate-content-btn" @click.stop="regenerateContent">
              重新生成
            </el-button>
            <el-button v-if="
              isLastChapterWithContent && hasContent && !isGeneratingContent && !props.locked
            " class="action-btn continue-next-btn" @click.stop="continueNextChapter">
              {{ isLastChapter ? '完成' : '继续下一集' }}
            </el-button>
            <el-button v-if="props.locked && !isGeneratingContent" class="action-btn revert-btn-bottom"
              @click="handleRevertToCurrent">
              回退至{{ props.chapterData?.episode ?? getEpisodeLabel(chapterIndex) }}
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部回退按钮 -->
    <!-- <div v-if="hasNextContent && !isLastChapter" class="bottom-revert-section">
      <el-button v-if="hasNextContent && !isLastChapter" class="revert-btn-bottom" @click="handleRevertToCurrent">
        回退至{{ props.chapterData?.episode ?? getEpisodeLabel(chapterIndex) }}
      </el-button>
    </div> -->
  </div>
</template>

<style scoped lang="less">
.quick-chapter-editor {
  display: flex;
  flex-direction: column;
  padding: 87px 260px 20px 0px;

  // 第一部分：内容区域
  .viewport-section {
    display: flex;
    flex-direction: column;

    box-sizing: border-box;

    // 细纲展开且未锁定时使用固定高度
    &.fixed-height {
      height: calc(100vh - 56px);
      overflow: hidden; // 防止内容溢出容器
    }
  }

  .header-actions {
    display: flex;
    flex-direction: column;
    margin-bottom: 24px;
    margin-top: 20px;
    flex-shrink: 0;
    opacity: 0.5;

    .revert-btn {
      align-self: flex-end;
      padding: 6px 16px;
      font-size: 13px;
      color: var(--text-tertiary);
      background: transparent;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
      margin-bottom: 16px;

      &:hover {
        color: var(--bg-editor-save);
        border-color: var(--bg-editor-save);
      }
    }

    .header-divider {
      width: 100%;
      height: 1px;
      background: var(--border-color);
    }
  }

  .chapter-title {
    font-size: 32px; // From Figma
    font-weight: 700; // From Figma
    line-height: 1.32em;
    color: #464646; // From Figma
    margin-bottom: 20px;
    flex-shrink: 0;
  }

  // 故事梗概区域
  .chapter-note-section {
    display: flex;
    align-items: center;
    gap: 60px; // 保证跟右侧按钮的间距 From Figma
    margin-bottom: 12px;
    min-width: 0;
    flex-shrink: 0;

    // 展开时，按钮区域顶部对齐
    &:has(.note-container.expanded) {
      align-items: flex-start;
    }

    .note-container {
      flex: 1; // 占据剩余宽度
      min-width: 0;
      height: 45px; // From Figma Rectangle 4455
      display: flex;
      align-items: center; // 垂直居中对齐
      gap: 12px;
      padding: 0px 12px;
      border: 1px solid #d6d6d6; // From Figma Rectangle 4455
      border-radius: 5px; // From Figma Rectangle 4455
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
      overflow: hidden;
      box-sizing: border-box; // 确保 padding 不影响宽度计算

      &.editing {
        border-color: var(--theme-color);
        height: auto; // 编辑态允许高度随 textarea 三行展开，不再被 45px 限制
        min-height: 45px;
        align-items: flex-start;
        overflow: visible;
      }

      // 有细纲或正在生成细纲时，移除可点击样式
      &.has-outline,
      &.locked {
        cursor: default;
      }

      // 有细纲时的样式变化（生成中或生成完成）
      &.has-outline {
        border: none; // 无边框
        // padding: 0; // 无padding
        height: auto; // 高度自适应
        min-height: 26px; // 最小高度 From Figma layout_BD6VM2

        .note-content {
          align-items: flex-start; // 锁定状态下文本顶部对齐，支持多行显示

          .note-text {
            font-size: 20px; // From Figma style_OV2UCE
            color: #999999; // From Figma fill_VG0UNE
            white-space: normal; // 锁定状态下多行显示
            word-wrap: break-word;
            overflow-wrap: break-word;
            word-break: break-word;
            overflow: visible; // 允许内容溢出显示
            text-overflow: unset; // 移除省略号
          }
        }
      }

      &.locked {
        // background: #f9eece;
        cursor: default;

        &.expanded {
          overflow: visible;

          .note-content {
            overflow: visible;
          }
        }
      }

      .note-content {
        flex: 1;
        display: flex;
        align-items: center;
        min-width: 0;
        overflow: hidden;
        width: 100%;

        // 编辑态时内容顶部对齐、不裁切，让 textarea 三行高度正常展示
        .note-container.editing & {
          align-items: flex-start;
          overflow: visible;
        }

        .note-text {
          flex: 1;
          min-width: 0;
          font-size: 24px; // 使用 TiptapEditor 默认字号
          font-weight: 400;
          line-height: 1.32em;
          color: #333333; // 使用 TiptapEditor 默认颜色
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .note-input {
          flex: 1;
          min-width: 0;
          align-self: stretch; // 编辑态下占满容器高度，避免被压成一行

          :deep(.el-textarea__inner) {
            min-height: 4em; // 约三行高度，避免被外层压扁
            background: transparent;
            border: none;
            padding: 0;
            margin: 0;
            font-size: 24px;
            font-weight: 400;
            line-height: 1.32em;
            color: #333333;
            outline: none;
            box-shadow: none;
            resize: none;
            // 隐藏滚动条，三行内容不出现滚动条；超过三行仍可用滚轮/触摸滚动
            scrollbar-width: none;
            -ms-overflow-style: none;
            &::-webkit-scrollbar {
              display: none;
            }

            &:focus {
              outline: none;
              box-shadow: none;
            }
          }
        }
      }

      .note-edit-btn {
        display: flex;
        flex-direction: row;
        align-items: center; // 垂直居中对齐
        gap: 5px; // From Figma Frame 3507
        flex-shrink: 0;
        cursor: pointer;
        height: 100%; // 确保按钮区域高度与容器一致

        .edit-icon {
          width: 20px; // From Figma
          height: 20px; // From Figma
          color: #999999; // From Figma
          display: flex;
          align-items: center; // 垂直居中
        }

        .edit-text {
          font-size: 20px; // From Figma
          font-weight: 400;
          line-height: 1.32em;
          letter-spacing: 0.04em; // From Figma
          color: #999999; // From Figma
          display: flex;
          align-items: center; // 垂直居中
        }
      }
    }

    // 右侧按钮区域
    .note-side-actions {
      display: flex;
      flex-direction: row;
      align-items: center;
      // height: 40px;
      // gap: 12px;
      flex-shrink: 0;
      // width: 200px; // 固定宽度，确保对齐

      .generate-btn {
        width: 165px; // From Figma Rectangle 4413
        height: 52px; // From Figma Rectangle 4413
        padding: 0;
        border-radius: 10px; // From Figma Rectangle 4413
        background: linear-gradient(90deg,
            rgba(239, 175, 0, 1) 0%,
            rgba(255, 149, 0, 1) 100%); // From Figma Rectangle 4413
        border: none;
        font-size: 24px; // From Figma Rectangle 4413
        font-weight: 700; // From Figma Rectangle 4413
        line-height: 1.32em;
        color: #ffffff; // From Figma Rectangle 4413
        display: flex;
        align-items: center;
        justify-content: center;

        &:hover:not(:disabled) {
          opacity: 0.9;
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }

      .revert-btn-outline {
        width: 165px;
        height: 40px;
        border-radius: 10px;
        border: 2px solid #999;
        color: #999;
        text-align: center;
        font-size: 20px;

        &:hover:not(:disabled) {
          color: var(--bg-editor-save);
          border-color: var(--bg-editor-save);
        }

        &:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }
      }

      // .expand-btn {
      //   padding: 4px 8px;
      //   font-size: 16px;
      //   color: var(--text-secondary);
      //   min-height: auto;
      // }
    }
  }

  // 提示条容器：当点击生成细纲按钮且内容未传递过来时显示
  .outline-tip-bar-container {
    flex: 1; // 占满剩余宽度
    display: flex;
    flex-direction: column;
    gap: 40px; // From Figma Frame 3540
    padding-right: 223px; // 右侧 padding
    margin-top: 50px; // 顶部间距
    margin-bottom: 0;
    flex-shrink: 0;

    .outline-tip-bar-item {
      width: 100%; // 前三个撑满容器
      height: 52px; // From Figma Frame 3540
      background: linear-gradient(90deg, #d9d9d9 0%, #e8e8e8 50%, #d9d9d9 100%); // 渐变背景
      background-size: 200% 100%; // 背景尺寸，用于动画
      border-radius: 10px; // 圆角
      flex-shrink: 0;
      animation: shimmer 1.5s ease-in-out infinite; // 渐变移动动画

      &.outline-tip-bar-item-short {
        width: 756px; // From Figma layout_GR55YT - 后面两个缩短一些
      }
    }
  }

  // 正文内容骨架提示条容器：当点击生成正文按钮且内容未传递过来时显示
  .content-tip-bar-container {
    flex: 1; // 占满剩余宽度
    display: flex;
    flex-direction: column;
    gap: 40px; // From Figma Frame 3540
    padding-right: 223px; // 右侧 padding
    margin-top: 50px; // 顶部间距
    margin-bottom: 0;
    flex-shrink: 0;

    .content-tip-bar-item {
      width: 100%; // 前三个撑满容器
      height: 52px; // From Figma Frame 3540
      background: linear-gradient(90deg, #d9d9d9 0%, #e8e8e8 50%, #d9d9d9 100%); // 渐变背景
      background-size: 200% 100%; // 背景尺寸，用于动画
      border-radius: 10px; // 圆角
      flex-shrink: 0;
      animation: shimmer 1.5s ease-in-out infinite; // 渐变移动动画

      &.content-tip-bar-item-short {
        width: 756px; // From Figma layout_GR55YT - 后面两个缩短一些
      }
    }
  }

  // 细纲区域容器
  .detailed-outline-wrapper {
    flex-shrink: 0;
    margin-top: 10px;

    // 展开时占据剩余空间（无论是否锁定）
    &.is-expanded {
      flex: 1;
      min-height: 0;
      max-height: 100%; // 限制最大高度
      display: flex;
      flex-direction: column;
      overflow: hidden; // 防止内容溢出
    }

    // 锁定后且未展开时不再占据剩余空间
    &.is-locked:not(.is-expanded) {
      flex: none;
    }
  }

  // 骨架图区域
  .skeleton-section {
    display: flex;
    gap: 16px;
    flex: 1;
    min-height: 0;

    .skeleton-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: var(--bg-secondary);
      border-radius: 12px;
      padding: 24px;
      border: 1px solid var(--border-color);

      .skeleton-header {
        margin-bottom: 20px;
      }

      .skeleton-content {
        flex: 1;

        :deep(.el-skeleton__paragraph) {
          margin-top: 12px;
        }
      }
    }

    .outline-side-actions {
      width: 200px; // 固定宽度，确保对齐
    }
  }

  // 细纲锁定状态（展示条）
  .outline-locked-section {
    display: flex;
    gap: 60px; // 与故事梗概条保持一致
    align-items: center;
    flex: 1; // 展开时占据剩余空间
    min-height: 0; // 关键：允许 flex 子元素缩小
    overflow: hidden; // 防止内容溢出
    flex-shrink: 0;

    // 生成正文中或已生成正文时的细纲条样式（类似故事梗概条，但保留展开功能）
    .outline-bar-generating {
      flex: 1; // 占据剩余宽度
      min-width: 0;
      height: auto; // 高度自适应
      min-height: 26px; // 最小高度
      display: flex;
      align-items: center;
      border: none; // 无边框
      padding: 0 12px; // 无padding
      cursor: pointer; // 可点击
      transition: all 0.2s;

      &.expanded {
        align-items: flex-start;

        .outline-bar-content-generating {
          flex-direction: column;
          align-items: flex-start;
          overflow: visible;

          .outline-bar-label-generating {
            margin-bottom: 12px;
          }
        }
      }

      .outline-bar-content-generating {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        overflow: hidden;
        width: 100%;

        .outline-bar-label-generating {
          flex-shrink: 0;
          font-size: 20px; // From Figma style_OV2UCE
          font-weight: 400;
          line-height: 1.32em;
          color: #999999; // From Figma fill_VG0UNE - 锁定状态保持原样
        }

        .outline-bar-text-generating {
          flex: 1;
          min-width: 0;
          font-size: 20px; // From Figma style_OV2UCE
          font-weight: 400;
          line-height: 1.32em;
          color: #999999; // From Figma fill_VG0UNE - 锁定状态保持原样
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .outline-bar-full-generating {
          flex: 1;
          min-height: 0;
          width: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          display: flex;
          flex-direction: column;

          .outline-readonly-editor {
            flex: 1;
            min-height: 0;
            display: flex;
            flex-direction: column;

            :deep(.tiptap-editor) {
              flex: 1;
              min-height: 0;
              display: flex;
              flex-direction: column;
            }

            :deep(.ProseMirror) {
              outline: none;
              padding: 0 !important;
              color: #464646;
              font-size: 24px;
              font-style: normal;
              font-weight: 400;
              line-height: 180%;
              /* 43.2px */
            }
          }
        }
      }
    }

    .outline-bar {
      flex: 1;
      min-width: 0;
      min-height: 0; // 关键：允许 flex 子元素缩小
      display: flex;
      height: 34px;
      flex-direction: column;
      justify-content: center;
      background: #f9eece; // 黄色背景
      border: none; // 无边框
      border-radius: 8px;
      padding: 0px 12px;
      cursor: pointer;
      transition: all 0.2s;
      // overflow: hidden; // 防止内容溢出

      &.expanded {
        padding: 16px;
        height: 100%;

        .outline-bar-content {
          flex: 1;
          min-height: 0;
          flex-direction: column;
          align-items: flex-start;
          // overflow: hidden; // 防止内容溢出
          display: flex;
        }

        .outline-bar-label {
          margin-bottom: 12px;
          flex-shrink: 0;
        }

        .outline-bar-full {
          flex: 1;
          min-height: 0;
          width: 100%;
          overflow-y: auto; // 允许滚动
          overflow-x: hidden;
          display: flex;
          flex-direction: column;
        }
      }

      .outline-bar-content {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        overflow: hidden;
      }

      .outline-bar-label {
        flex-shrink: 0;
        color: var(--text-primary);
        font-size: 16px;
      }

      .outline-bar-text {
        flex: 1;
        min-width: 0;
        color: var(--text-primary);
        font-size: 16px;
        line-height: 1.5;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis; // 多余内容...裁剪
      }

      .outline-bar-full {
        flex: 1;
        min-height: 0;
        width: 100%;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        overflow-x: hidden;

        .outline-readonly-editor {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;

          :deep(.tiptap-editor) {
            flex: 1;
            min-height: 0;
            display: flex;
            flex-direction: column;
          }

          :deep(.ProseMirror) {
            color: #464646;
            font-size: 24px;
            font-style: normal;
            font-weight: 400;
            line-height: 180%;
            /* 43.2px */
          }
        }
      }
    }

    .outline-side-actions {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
      width: 165px; // 固定宽度，与回退按钮一致

      .revert-btn-outline {
        width: 165px;
        height: 40px;
        padding: 0;
        border-radius: 10px;
        border: 2px solid #999999;
        background: transparent;
        color: #999999;
        font-size: 20px;
        line-height: 1.32em;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;

        &:hover:not(:disabled) {
          color: var(--bg-editor-save);
          border-color: var(--bg-editor-save);
        }

        &:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }
      }

      .revert-btn-side {
        padding: 8px 16px;
        font-size: 13px;
        color: var(--text-tertiary);
        background: transparent;
        border: 1px solid var(--border-color);
        border-radius: 4px;
        white-space: nowrap;

        &:hover {
          color: var(--bg-editor-save);
          border-color: var(--bg-editor-save);
        }
      }

      .expand-btn {
        padding: 4px 8px;
        font-size: 16px;
        color: var(--text-secondary);
        min-height: auto;
      }
    }
  }

  // 细纲编辑区域
  .outline-edit-section {
    display: flex;
    gap: 60px;
    flex: 1;
    // min-height: 0;
    max-height: 100%; // 限制最大高度
    // overflow: hidden; // 防止内容溢出

    // 展开状态（锁定后的展开）：按钮顶部对齐，内容可滚动
    &.outline-edit-section-expanded {
      align-items: flex-start; // 按钮顶部对齐
      height: 100%; // 关键：允许 flex 子元素缩小
      overflow: hidden; // 防止内容溢出

      .outline-editor-wrapper {
        flex: 1; // 占据剩余空间
        min-height: 0; // 关键：允许 flex 子元素缩小
        max-height: 100%; // 限制最大高度
        cursor: pointer; // 可点击收起
        overflow: hidden; // 防止内容溢出
      }

      // .outline-scroll-area {
      //   flex: 1; // 占据剩余空间
      //   min-height: 0; // 关键：允许 flex 子元素缩小
      //   max-height: 100%; // 限制最大高度
      //   overflow-y: auto; // 允许垂直滚动
      //   overflow-x: hidden;
      // }
    }

    .outline-editor-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: transparent; // 无背景色
      border-radius: 0; // 无圆角
      padding: 0; // 无padding
      border: none; // 无边框
      cursor: text;
      transition: all 0.2s;
      box-sizing: border-box;
      // overflow: hidden; // 防止内容溢出
      position: relative; // 用于定位编辑按钮

      &.editing {
        border: 0.1px solid var(--theme-color); // 编辑状态：黑色边框
        border-radius: 10px;
        padding: 0;
      }

      // 右上角编辑按钮
      .outline-edit-btn {
        position: absolute;
        top: 10px;
        right: 10px;
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 10px; // From Figma layout_B43CSC
        z-index: 10;
        cursor: pointer;
        padding: 0;
        background: transparent;

        .edit-icon {
          width: 20px; // From Figma layout_6IP8FI
          height: 20px; // From Figma layout_6IP8FI
          font-size: 20px;
          color: #999999; // From Figma fill_FHVUI2
        }

        .edit-text {
          font-size: 20px; // From Figma style_BZIK5H
          font-weight: 400;
          line-height: 1.32em;
          letter-spacing: 0.04em; // From Figma style_BZIK5H
          color: #999999; // From Figma fill_FHVUI2
        }
      }

      .outline-scroll-area {
        flex: 1;
        // min-height: 0;
        // max-height: 100%; // 限制最大高度
        overflow-y: auto;
        overflow-x: hidden;
        position: relative; // 确保滚动容器正确定位

        &::-webkit-scrollbar {
          width: 2px;
        }

        &::-webkit-scrollbar-track {
          background: transparent;
        }

        &::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 4px;

          &:hover {
            background: rgba(0, 0, 0, 0.3);
          }
        }
      }

      .outline-editor {
        // height: 100%; // 确保编辑器占满滚动区域
        display: flex;
        flex-direction: column;

        :deep(.tiptap-editor) {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          // height: 100%;
        }

        :deep(.ProseMirror) {
          padding: 0 12px !important;
          color: #333333 !important; // 使用 TiptapEditor 默认颜色
          font-size: 24px !important; // 使用 TiptapEditor 默认字号
          font-style: normal !important;
          font-weight: 400 !important;
          line-height: 180% !important;
          /* 43.2px */
        }
      }
    }

    .outline-side-actions-edit {
      display: flex;
      // width: 165px;
      flex-direction: column; // 竖排布局
      align-items: flex-start; // 左对齐，确保按钮对齐
      gap: 25px; // From Figma layout_TVYG2B
      flex-shrink: 0;

      .regenerate-btn {
        // Rectangle 4456 重新生成
        width: 165px;
        height: 52px;
        padding: 0 !important;
        margin: 0 !important;
        margin-top: 8px !important;
        border-radius: 10px;
        border: 2px solid #9a9a9a;
        background: transparent;
        color: #464646;
        font-size: 24px;
        font-weight: 400;
        line-height: 1.32em;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box; //宽度计算包含边框

        &:hover {
          color: var(--bg-editor-save);
          border-color: var(--bg-editor-save);
        }
      }

      .generate-content-btn {
        // Rectangle 4413 生成正文
        width: 165px;
        height: 52px;
        padding: 0 !important;
        margin: 0 !important;
        border-radius: 10px;
        border: none;
        background: linear-gradient(90deg,
            rgba(239, 175, 0, 1) 0%,
            rgba(255, 149, 0, 1) 100%); // From Figma 橙色渐变
        color: #ffffff; // From Figma fill_76X5SZ
        font-size: 24px; // From Figma style_X8IV9O
        font-weight: 700; // From Figma style_X8IV9O
        line-height: 1.32em;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;

        &:hover:not(:disabled) {
          opacity: 0.9;
        }
      }
    }

    // 空白占位
    .outline-side-actions {
      width: 165px; // 固定宽度，确保对齐
    }
  }

  // 第二部分：正文内容区域（高度自适应）
  .content-section {
    // padding: 0 40px 20px; // 与viewport-section的padding一致，确保宽度对齐
    margin-top: 20px; // 与细纲之间添加间距
    flex-shrink: 0; // 不限制高度，根据内容自动撑开

    .content-editor-container {
      display: flex;
      gap: 60px; // 与梗概和细纲保持一致
      align-items: stretch; // 让两个子元素等高，这样 sticky 才能正常工作
      min-height: 0; // 确保 flex 容器可以正确计算高度
    }

    .content-editor-wrapper {
      flex: 1;
      min-width: 0;
      position: relative;
      // 默认无边框，与梗概和细纲保持一致
      border: none;
      border-radius: 0;
      padding: 0; // 无padding
      cursor: text;
      transition: all 0.2s;
      min-height: 200px; // 类似细纲的框，有最小高度

      &.editing {
        border: 1px solid var(--theme-color); // 编辑状态：黑色边框
        border-radius: 10px;
        padding: 0;
      }

      &.generating {

        // 生成中状态
        .content-streaming-text {
          font-size: 16px;
          line-height: 1.8;
          color: var(--text-primary);
          white-space: pre-wrap;
          word-wrap: break-word;
          min-height: 200px;
        }
      }

      //    &.last-chapter-completed {
      // 最后一章完成后的背景色，与梗概和细纲条的黄色一致
      //      background-color: #f9eece;
      //    }

      .content-edit-icon {
        position: absolute;
        top: -20px;
        right: 12px;
        cursor: pointer;
        z-index: 1;
        display: flex;
        opacity: 0.6;
        align-items: center;
        justify-content: center;
        gap: 10px;
        transition: opacity 0.2s;

        &:hover {
          opacity: 1;
        }

        .edit-icon {
          width: 23px;
          height: 23px;
        }

        .edit-text {
          color: #999;
          font-size: 16px;
          font-style: normal;
          font-weight: 400;
          line-height: normal;
          letter-spacing: 0.64px;
        }
      }
    }

    .content-side-actions {
      display: flex;
      flex-direction: column; // 上下布局，与梗概条右侧一致
      align-items: flex-start; // 左对齐，确保按钮对齐
      flex-shrink: 0;
      width: 165px; // 固定宽度，与设计稿一致
      align-self: stretch; // 拉伸到与内容区域同高，让 sticky 可以正常工作
      // position: relative; // 为 sticky 定位提供参考
      min-height: 100%; // 确保至少与内容区域同高
    }
  }

  // 按钮容器（使用 sticky 定位，随正文内容滚动固定在底部）
  .sticky-actions-container {
    position: sticky;
    bottom: 80px; // 距离底部20px
    top: auto; // 确保从底部定位
    width: 165px; // 与固定按钮区域宽度一致
    z-index: 100;
    display: flex;
    flex-direction: column; // 上下布局，与固定按钮区域一致
    align-items: flex-start; // 左对齐
    gap: 25px; // 与固定按钮区域一致
    margin-top: auto; // 将按钮推到底部

    .action-btn {
      width: 165px;
      height: 52px;
      padding: 0;
      margin: 0;
      border-radius: 10px;
      font-size: 24px;
      line-height: 1.32em;
      display: flex;
      align-items: center;
      justify-content: center;
      white-space: nowrap;
      box-sizing: border-box;
    }

    .regenerate-content-btn {
      // Rectangle 4456 重新生成
      border: 2px solid #9a9a9a;
      background: transparent;
      color: #464646;
      font-weight: 400;

      &:hover {
        color: var(--bg-editor-save);
        border-color: var(--bg-editor-save);
      }
    }

    .continue-next-btn {
      // Rectangle 4413 生成下一章
      border: none;
      background: linear-gradient(90deg, rgba(239, 175, 0, 1) 0%, rgba(255, 149, 0, 1) 100%);
      color: #ffffff;
      font-weight: 700;

      &:hover:not(:disabled) {
        opacity: 0.9;
      }
    }

    .revert-btn-bottom {
      border-radius: 10px;
      border: 2px solid #999999;
      background: transparent;
      color: #999999;
      font-size: 20px;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        color: var(--bg-editor-save);
        border-color: var(--bg-editor-save);
      }
    }
  }

  .content-section {
    .content-editor {
      :deep(.ProseMirror) {
        outline: none;
        padding: 0 12px !important;
        min-height: 200px;
        // 与 TiptapEditor 默认样式保持一致
        color: #333333 !important; // 使用 TiptapEditor 默认颜色
        font-size: 24px !important; // 使用 TiptapEditor 默认字号
        font-style: normal !important;
        font-weight: 400 !important;
        line-height: 180% !important;
        /* 43.2px */
      }
    }
  }

  // 底部回退按钮
  .bottom-revert-section {
    display: flex;
    justify-content: flex-end;
    padding: 20px 40px;
    background: var(--bg-secondary);
    flex-shrink: 0;

    .revert-btn-bottom {
      border-radius: 10px;
      border: 2px solid #999999;
      background: transparent;
      color: #999999;
      font-size: 20px;
      line-height: 1.32em;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        color: var(--bg-editor-save);
        border-color: var(--bg-editor-save);
      }
    }
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }

  100% {
    background-position: 200% 0;
  }
}
</style>
