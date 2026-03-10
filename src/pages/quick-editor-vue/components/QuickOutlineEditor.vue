<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from "vue";
import { ElButton, ElMessage, ElMessageBox, ElInput } from "element-plus";
import type { PostStreamData } from "@/api/index.ts";
import { useEditorStore } from "@/stores/editor";
import { storeToRefs } from "pinia";
import type {
  DocCharacterData,
  DocGenerateOutlineData,
  DocOutlineStorageData,
  PostDocTemplateStreamOutlineRequestData,
} from "@/utils/interfaces";
import { addNote } from "@/api/notes";
import type { NoteSourceType } from "@/utils/interfaces";
import TiptapEditor from "@/components/TiptapEditor.vue";
import { postDocTemplateStreamOutline } from "@/api/generate-quick";

interface StoryData {
  title: string;
  intro: string;
  theme: string;
}

interface Props {
  selectedTagIds?: string; // 标签ID字符串（逗号分隔）
  storyContent?: string; // 故事内容（JSON字符串）
  characterContent?: string; // 角色内容（JSON字符串）
  outlineContent?: string; // 从serverData读取的大纲内容
  locked?: boolean; // 是否锁定（不可编辑）
  hasNextContent?: boolean; // 后面是否有内容
  triggerGenerate?: number; // 触发生成的标志（数字，每次需要生成时递增）
}

interface Emits {
  (e: "confirm", outlineData: string): void; // 确认时传递大纲数据
  (e: "revert"): void; // 回退到上一步
  (e: "revert-to-current"): void; // 回退到当前步骤
  (e: "error-and-revert", targetDir: string): void; // 错误时回退到指定目录
}

const props = withDefaults(defineProps<Props>(), {
  selectedTagIds: "",
  storyContent: "",
  characterContent: "",
  outlineContent: "",
  locked: false,
  triggerGenerate: 0,
});

const emit = defineEmits<Emits>();

const editorStore = useEditorStore();
const { workInfo } = storeToRefs(editorStore);

// 大纲内容
const outlineContentMd = ref(""); // 生成中的MD内容
const outlineContentJson = ref<DocGenerateOutlineData | null>(null); // 生成完成后的JSON数据
const isEditing = ref(false);
const outlineContainerRef = ref<HTMLElement | null>(null);
const isStreaming = ref(false);
const loading = ref(false);
const selectedVersion = ref("v1");

// TiptapEditor引用（保留用于其他地方）
// const tiptapEditorRef = ref<InstanceType<typeof TiptapEditor> | null>(null);

// AbortController 用于取消流式请求
const outlineStreamAbortController = ref<AbortController | null>(null);

console.log("[QuickOutlineEditor] Component mounted");

// 检查是否有大纲内容
const hasOutlineContent = computed(() => {
  return outlineContentJson.value !== null;
});

// 是否已生成完成（有JSON数据）
const isGenerateComplete = computed(() => outlineContentJson.value !== null);

// 从流式数据中提取内容
const getContentFromPartial = (partialData: any): string => {
  if (!partialData || !Array.isArray(partialData) || partialData.length === 0) {
    return "";
  }
  const firstItem = partialData[0];
  if (Array.isArray(firstItem.content) && firstItem.content.length > 0) {
    if (firstItem.content[0].text) {
      return firstItem.content[0].text;
    }
  }
  return "";
};

// 流式数据处理回调
const onOutlineStreamData = (data: PostStreamData) => {
  // console.log("[QuickOutlineEditor] Stream data:", data.event, data);

  switch (data.event) {
    case "messages/partial": {
      const content = getContentFromPartial(data.data);
      // 流式生成中，更新 MD 内容
      outlineContentMd.value = content;
      // console.log("[QuickOutlineEditor] outlineContentMd:", outlineContentMd.value);
      // console.log("[QuickOutlineEditor] outlineContentJson:", outlineContentJson.value);
      break;
    }
    case "updates": {
      // 生成完成，接收 JSON 数据
      const generate_outline: DocGenerateOutlineData | undefined =
        data?.data?.generate_writing_template?.result?.outline;
      if (
        generate_outline &&
        generate_outline.outline_dict &&
        Array.isArray(generate_outline.outline_dict)
      ) {
        outlineContentJson.value = generate_outline;
        // console.log("[QuickOutlineEditor] Stream finished, JSON data received:", generate_outline);
      }
      break;
    }
    case "end": {
      console.log("[QuickOutlineEditor] Stream end");
      break;
    }
  }
};

// 流式结束回调
const onOutlineStreamEnd = () => {
  console.log("[QuickOutlineEditor] onOutlineStreamEnd");
  isStreaming.value = false;
  loading.value = false;
  outlineStreamAbortController.value = null;

  // 大纲生成完成后自动进入编辑状态
  if (!props.locked && outlineContentJson.value !== null) {
    isEditing.value = true;
  }
};

// 流式错误回调
const onOutlineStreamError = (error: Error) => {
  console.error("[QuickOutlineEditor] 获取大纲失败:", error);
  // ElMessage.error("生成大纲失败，请重试");
  loading.value = false;
  isStreaming.value = false;
  outlineStreamAbortController.value = null;
  // 触发错误回退事件，回退到角色设定
  emit("error-and-revert", "主角设定.md");
};

// 添加笔记
const handleAddNote = async () => {
  // 检查是否正在生成中
  if (isStreaming.value) {
    ElMessage.warning("请等待大纲生成完成后再添加笔记");
    return;
  }

  // 获取工作标题
  const title = workInfo.value?.title || "大纲";

  // 直接使用 outlineContentMd 作为内容
  const content = outlineContentMd.value;

  if (!content) {
    ElMessage.warning("大纲内容为空，无法添加笔记");
    return;
  }

  try {
    await addNote(
      title,
      content,
      "PC_ADD" as NoteSourceType
    );
    ElMessage.success("笔记添加成功");
  } catch (error) {
    console.error("添加笔记失败:", error);
    ElMessage.error("添加笔记失败，请重试");
  }
};

// 生成大纲（流式）
const generateOutline = async () => {
  console.log("[QuickOutlineEditor] generateOutline called");

  // 防止重复调用
  if (loading.value || isStreaming.value) {
    console.log("[QuickOutlineEditor] Already generating, skip");
    return;
  }

  // 检查必要的数据
  if (!props.storyContent || !props.characterContent) {
    ElMessage.warning("请先完成前面的步骤");
    return;
  }

  try {
    // 从新的数据结构中提取 selectedData
    const storyWrapper = JSON.parse(props.storyContent);
    const characterWrapper = JSON.parse(props.characterContent);
    const story: StoryData = storyWrapper.selectedData || storyWrapper;
    const character: DocCharacterData = characterWrapper.selectedData || characterWrapper;

    console.log("[QuickOutlineEditor] story:", story);
    console.log("[QuickOutlineEditor] character:", character);

    // 如果已有正在进行的请求，先取消
    if (outlineStreamAbortController.value) {
      outlineStreamAbortController.value.abort();
    }

    // 重置内容
    outlineContentMd.value = "";
    outlineContentJson.value = null;
    isEditing.value = false;
    isStreaming.value = true;
    loading.value = true;

    // 获取章节数量
    const chapterNumber = getChapterNumber();

    // 获取标签名称用于description
    const description = workInfo.value?.workTags?.map((tag: any) => tag.name).join(",") || "";

    console.log("[QuickOutlineEditor] chapterNumber:", chapterNumber);
    console.log("[QuickOutlineEditor] description:", description);

    // 构建请求参数
    const requestData: PostDocTemplateStreamOutlineRequestData = {
      brainStorm: {
        title: story.title,
        intro: story.intro,
      },
      roleCard: character,
      chapterNum: chapterNumber,
      description: description,
    };

    console.log("[QuickOutlineEditor] Request data:", requestData);

    // 创建新的 AbortController
    outlineStreamAbortController.value = new AbortController();

    await postDocTemplateStreamOutline(
      requestData,
      onOutlineStreamData,
      onOutlineStreamError,
      onOutlineStreamEnd,
      { signal: outlineStreamAbortController.value.signal }
    );
  } catch (error) {
    // 如果是取消操作，不记录为错误
    if (error instanceof DOMException && error.name === "AbortError") {
      console.log("[QuickOutlineEditor] 流式请求已取消");
      loading.value = false;
      isStreaming.value = false;
      outlineStreamAbortController.value = null;
      return;
    }
    console.error("[QuickOutlineEditor] 调用模板流式接口失败:", error);
    loading.value = false;
    isStreaming.value = false;
    outlineStreamAbortController.value = null;
    // ElMessage.error("生成大纲失败，请重试");
    // 触发错误回退事件，回退到角色设定
    emit("error-and-revert", "主角设定.md");
  }
};

// 获取章节数量
const getChapterNumber = (): number => {
  // 优先使用 workInfo 中的 chapterNum
  if (workInfo.value?.chapterNum) {
    return workInfo.value.chapterNum;
  }

  if (!workInfo.value?.workTags) return 10;

  // 查找章节数量标签
  const chapterTag = workInfo.value.workTags.find((tag: any) => tag.name.includes("章"));
  if (chapterTag) {
    const match = chapterTag.name.match(/\d+/);
    return match ? parseInt(match[0], 10) : 10;
  }

  return 10;
};

// 处理章节输入变化
const handleChapterInput = (
  chapterIndex: number,
  field: "chapter_title" | "chapter_note",
  value: string
) => {
  if (!outlineContentJson.value || !outlineContentJson.value.outline_dict) return;

  outlineContentJson.value.outline_dict[chapterIndex][field] = value;
  console.log(`[QuickOutlineEditor] Updated chapter ${chapterIndex} ${field}:`, value);
};

// 切换编辑状态
const toggleEdit = () => {
  if (props.locked || isStreaming.value) return;
  console.log("[QuickOutlineEditor] toggleEdit, current isEditing:", isEditing.value);
  isEditing.value = !isEditing.value;
};

// 点击大纲内容区触发编辑状态
const handleOutlineContainerClick = (e: MouseEvent) => {
  if (props.locked || isStreaming.value) return;

  const target = e.target as HTMLElement;

  // 如果点击的是编辑按钮或重新生成按钮，不触发
  // if (target.closest('.header-actions')) return;

  // 如果点击的是输入框或输入框相关的元素，不触发（用于获取焦点修改内容）
  if (
    target.closest(".field-input") ||
    target.closest(".el-input") ||
    target.closest(".el-textarea")
  ) {
    return;
  }

  // isEditing.value = !isEditing.value;
};

// 点击外部退出编辑状态
const handleClickOutside = (e: MouseEvent) => {
  if (!isEditing.value) return;
  if (props.locked || isStreaming.value) return;

  const target = e.target as HTMLElement;
  // 如果点击的是大纲容器内部，不退出
  if (outlineContainerRef.value && outlineContainerRef.value.contains(target)) {
    return;
  }
  // 如果点击的是编辑按钮，不退出（由toggleEdit处理）
  if (target.closest(".header-actions .action-btn")) {
    return;
  }
  // isEditing.value = false;
};

// 确认
const handleConfirm = () => {
  if (!hasOutlineContent.value) {
    ElMessage.warning("请先生成大纲内容");
    return;
  }

  // 构建存储数据
  const storageData: DocOutlineStorageData = {
    mdContent: outlineContentMd.value,
    jsonContent: outlineContentJson.value!,
  };

  const storageDataString = JSON.stringify(storageData);
  console.log("[QuickOutlineEditor] handleConfirm, storage data:", storageDataString);
  emit("confirm", storageDataString);
};

// 处理回退到当前步骤
const handleRevertToCurrent = () => {
  emit("revert-to-current");
};

// 回退（带二次确认）
const handleRevert = async () => {
  console.log("[QuickOutlineEditor] handleRevert");

  try {
    await ElMessageBox.confirm("回退后，该步骤后续内容将被清空不可找回", "是否回退到该步骤？", {
      confirmButtonText: "确认",
      cancelButtonText: "取消",
      type: "warning",
      customClass: "revert-confirm-dialog",
    });
    emit("revert");
  } catch (e) {
    // 用户取消
    console.log("[QuickOutlineEditor] User cancelled revert");
  }
};

// 从props初始化数据
const initFromProps = () => {
  console.log("[QuickOutlineEditor] initFromProps");
  console.log(
    "[QuickOutlineEditor] outlineContent from props:",
    props.outlineContent?.substring(0, 100)
  );

  if (props.outlineContent) {
    // 先检查是否是 JSON 格式（以 { 开头）
    const trimmedContent = props.outlineContent.trim();
    const isJsonFormat = trimmedContent.startsWith("{") && trimmedContent.endsWith("}");

    if (isJsonFormat) {
      try {
        // 尝试解析为 DocOutlineStorageData
        const storageData: DocOutlineStorageData = JSON.parse(props.outlineContent);
        outlineContentMd.value = storageData.mdContent || "";
        outlineContentJson.value = storageData.jsonContent || null;
        console.log("[QuickOutlineEditor] Loaded outline from props:", {
          mdLength: outlineContentMd.value.length,
          jsonChapters: outlineContentJson.value?.outline_dict?.length || 0,
        });
      } catch (e) {
        // JSON 格式但解析失败，记录错误
        console.error("[QuickOutlineEditor] Failed to parse JSON outline content:", e);
        // 回退到旧格式处理
        outlineContentMd.value = props.outlineContent;
        outlineContentJson.value = null;
      }
    } else {
      // 不是 JSON 格式，直接作为旧格式的 MD 内容处理
      outlineContentMd.value = props.outlineContent;
      outlineContentJson.value = null;
      console.log("[QuickOutlineEditor] Loaded outline as markdown format (legacy)");
    }
  }
};

// 监听props变化
watch(
  () => props.outlineContent,
  (newVal, oldVal) => {
    console.log("[QuickOutlineEditor] outlineContent changed:", {
      newVal: newVal?.substring(0, 50),
      oldVal: oldVal?.substring(0, 50),
    });

    // 如果内容被清空（从有内容变为空），重置状态
    if (oldVal && !newVal) {
      console.log("[QuickOutlineEditor] Content cleared, reset state");
      outlineContentMd.value = "";
      outlineContentJson.value = null;
      // isEditing.value = false;
      // 移除自动生成逻辑，避免刷新页面时自动生成
      // 如果需要生成，通过 triggerGenerate prop 触发
    } else {
      initFromProps();
    }
  },
  { immediate: true }
);

// 监听角色内容变化，当角色改变时重新生成大纲
// 注意：移除自动生成逻辑，只通过 triggerGenerate prop 触发，避免刷新页面时自动生成
watch(
  () => props.characterContent,
  (newVal, oldVal) => {
    console.log("[QuickOutlineEditor] characterContent changed:", {
      newVal: newVal?.substring(0, 50),
      oldVal: oldVal?.substring(0, 50),
    });
    // 移除自动生成逻辑，避免刷新页面时自动生成
    // 如果需要生成，通过 triggerGenerate prop 触发
  }
);

// 监听锁定状态，当从锁定变为未锁定时，检查是否需要重新生成
// 注意：移除自动生成逻辑，只通过 triggerGenerate prop 触发，避免刷新页面时自动生成
watch(
  () => props.locked,
  (newVal, oldVal) => {
    console.log("[QuickOutlineEditor] locked changed:", { newVal, oldVal });
    // 移除自动生成逻辑，避免刷新页面时自动生成
    // 如果需要生成，通过 triggerGenerate prop 触发
  }
);

// 监听 triggerGenerate 变化，触发重新生成
watch(
  () => props.triggerGenerate,
  (newVal, oldVal) => {
    // 只有当 triggerGenerate 增加时才触发（避免初始化时触发）
    if (newVal > oldVal && newVal > 0) {
      console.log("[QuickOutlineEditor] triggerGenerate changed, trigger generate:", { newVal, oldVal });
      // 检查条件：有故事梗概、有角色内容、未锁定（不管是否有大纲内容都重新生成）
      if (
        props.storyContent &&
        props.storyContent.trim() !== "" &&
        props.characterContent &&
        props.characterContent.trim() !== "" &&
        props.selectedTagIds &&
        !props.locked
      ) {
        console.log("[QuickOutlineEditor] Conditions met, auto generate");

        // 如果正在生成，先终止之前的流式请求
        if (isStreaming.value || loading.value) {
          console.log("[QuickOutlineEditor] Aborting previous generation");
          if (outlineStreamAbortController.value) {
            outlineStreamAbortController.value.abort();
            outlineStreamAbortController.value = null;
          }
          isStreaming.value = false;
          loading.value = false;
        }

        // 清除之前的内容和状态
        outlineContentMd.value = "";
        outlineContentJson.value = null;

        setTimeout(() => {
          generateOutline();
        }, 100);
      } else {
        console.log("[QuickOutlineEditor] Conditions not met, skip generate");
      }
    }
  }
);

// 组件挂载后，不自动生成，等待用户手动触发或通过 triggerGenerate 触发
onMounted(() => {
  console.log("[QuickOutlineEditor] onMounted");
  // 移除自动生成逻辑，避免刷新页面时自动生成（即使组件被 CSS 隐藏也会挂载）
  // 如果需要生成，通过 triggerGenerate prop 触发
  // 添加点击外部退出编辑的监听
  document.addEventListener("click", handleClickOutside);
});

// 组件卸载时，取消流式请求
onUnmounted(() => {
  console.log("[QuickOutlineEditor] onUnmounted");
  if (outlineStreamAbortController.value) {
    outlineStreamAbortController.value.abort();
    outlineStreamAbortController.value = null;
  }
  // 移除点击外部退出编辑的监听
  document.removeEventListener("click", handleClickOutside);
});
</script>

<template>
  <div class="quick-outline-editor">
    <!-- 标题部分：横排左右布局 -->
    <div class="header-section">
      <div class="header-title">请确认大纲内容</div>
      <div class="header-actions">
        <div class="add-note-btn" @click="handleAddNote">
          <span class="add-note-text">添加笔记</span>
        </div>
        <template v-if="!locked">
          <!-- <el-button
            link
            type="info"
            class="action-btn"
            :disabled="loading || !hasOutlineContent"
            @click="toggleEdit"
          >
            <span class="iconfont edit-icon">&#xea38;</span>
            <span>{{ isEditing ? "完成编辑" : "编辑" }}</span>
          </el-button> -->
          <el-button link type="info" class="action-btn" :disabled="loading" @click="generateOutline">
            <span class="iconfont refresh-icon">&#xe66f;</span>
            <span>重新生成</span>
          </el-button>
        </template>
      </div>
    </div>

    <!-- 大纲容器：占满剩余高度，可滚动 -->
    <div class="outline-container" ref="outlineContainerRef" @click.stop="handleOutlineContainerClick">
      <div class="editor-header">
        <div class="header-title-text">大纲</div>
        <!-- 版本选择暂时隐藏 -->
        <!-- <el-select
          v-if="!locked && !isStreaming"
          v-model="selectedVersion"
          placeholder="版本1"
          size="small"
          class="version-select"
        >
          <el-option label="版本1" value="v1" />
        </el-select> -->
      </div>

      <!-- 生成中显示 MarkdownEditor -->
      <TiptapEditor v-if="isStreaming" v-model="outlineContentMd" :placeholder="'开始编写大纲...'" :editable="false"
        :show-toolbar="false" model-type="md" class="outline-editor" />

      <!-- 生成完成后显示 HTML 表单 -->
      <div v-else class="outline-form" :class="{ 'is-editing': isEditing || locked || outlineContentJson }">
        <div v-for="(chapter, index) in outlineContentJson?.outline_dict" :key="index" class="chapter-item">
          <!-- 编辑状态：章节标题label在左侧，标题内容和描述在右侧对齐 -->
          <template v-if="isEditing || locked || outlineContentJson">
            <div class="chapter-edit-row">
              <div class="chapter-label">{{ chapter.chapter }}</div>
              <div class="chapter-edit-content">
                <div class="chapter-title-edit-wrapper">
                  <el-input :disabled="locked" :model-value="chapter.chapter_title" type="textarea"
                    :autosize="{ minRows: 1, maxRows: 10 }" class="field-input chapter-title-input" @click.stop
                    @input="(val) => handleChapterInput(index, 'chapter_title', val as string)" />
                </div>
                <div class="chapter-note-edit-wrapper">
                  <el-input :disabled="locked" :model-value="chapter.chapter_note" type="textarea"
                    :autosize="{ minRows: 1, maxRows: 10 }" class="field-input chapter-note-input" @click.stop
                    @input="(val) => handleChapterInput(index, 'chapter_note', val as string)" />
                </div>
              </div>
            </div>
          </template>
          <!-- 非编辑状态：保持原有布局 -->
          <template v-else>
            <div class="chapter-header">
              <span class="chapter-number">{{ chapter.chapter }}</span>
              <span class="chapter-separator">: </span>
              <span class="chapter-title-content">
                <span class="chapter-title-text">{{ chapter.chapter_title }}</span>
              </span>
            </div>
            <div class="field-row">
              <span class="field-content">
                <span class="field-text">{{ chapter.chapter_note }}</span>
              </span>
            </div>
          </template>
        </div>
      </div>

      <!-- 流式生成中的提示 -->
      <div v-if="isStreaming" class="streaming-indicator">
        <span class="iconfont spinning">&#xe66f;</span>
        <span>正在生成大纲...</span>
      </div>
    </div>

    <!-- 下一步按钮：绝对定位在右下角 -->
    <div v-if="!locked" class="next-step-btn-container">
      <el-button type="primary" class="next-step-btn" :disabled="!hasOutlineContent || isStreaming"
        @click="handleConfirm">
        下一步
      </el-button>
    </div>

    <!-- 回退按钮：绝对定位在右下角，与下一步按钮并排 -->
    <div v-if="hasNextContent" class="revert-btn-container">
      <el-button class="revert-btn" @click="handleRevertToCurrent"> 回退至编辑大纲 </el-button>
    </div>
  </div>
</template>

<style scoped lang="less">
.quick-outline-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
  padding: 50px 120px 50px 0px;
  position: relative;
  box-sizing: border-box;
  font-size: 24px; // 确保基础字体大小，避免被继承的样式覆盖
}

// 标题部分：横排左右布局
.header-section {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  flex-shrink: 0;
  margin-bottom: 50px;

  .header-title {
    font-size: 24px;
    font-weight: 400;
    line-height: 1.32em;
    color: #000000;
  }

  .header-actions {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 32px;

    .add-note-btn {
      display: flex;
      flex-direction: row;
      align-items: center;
      cursor: pointer;
      padding: 0;
      font-size: 20px;
      font-weight: 400;
      line-height: 1.32em;
      letter-spacing: 0.04em;
      color: #464646;
      background: transparent;
      border: none;

      .add-note-text {
        color: #464646;
      }

      &:hover .add-note-text {
        opacity: 0.8;
      }
    }

    .action-btn {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 10px;
      padding: 0;
      font-size: 20px;
      font-weight: 400;
      line-height: 1.32em;
      letter-spacing: 0.04em;
      color: #464646;
      background: transparent;
      border: none;

      &:hover:not(:disabled) {
        opacity: 0.8;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .edit-icon {
        width: 23.31px;
        height: 23.31px;
        font-size: 23.31px;
        margin-right: 10px;
      }

      .refresh-icon {
        width: 24px;
        height: 24px;
        font-size: 24px;
        margin-right: 10px;
      }
    }
  }
}

// 大纲容器：占满剩余高度，可滚动
.outline-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  padding-bottom: 50px; // 右侧留出空间，避免与滚动条贴一起

  // 自定义滚动条样式
  &::-webkit-scrollbar {
    width: 2px !important;
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

  .editor-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    margin-bottom: 30px;

    .header-title-text {
      font-size: 32px;
      font-weight: 700;
      line-height: 1.32em;
      color: #464646;
    }

    .version-select {
      width: 127px;
      height: 36px;
    }
  }

  .outline-editor {
    width: 100%;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    // TiptapEditor 根容器
    :deep(.tiptap-editor) {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    // TiptapEditor 内容容器
    :deep(.tiptap-content) {
      flex: 1;
      min-height: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    // TiptapEditor 滚动容器
    :deep(.tiptap-editor-content) {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      height: 100%;

      &::-webkit-scrollbar {
        width: 2px !important;
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

    :deep(.ProseMirror) {
      outline: none;
      padding: 0 !important;
      color: #333333 !important; // 使用 TiptapEditor 默认颜色
      font-size: 24px !important; // 使用 TiptapEditor 默认字号
      line-height: 1.8em;
      min-height: auto !important; // 允许内容自然增长

      // 确保段落之间没有额外间距，与HTML表单一致
      p {
        margin: 0 !important;
        line-height: 1.8em !important;
      }
    }
  }

  .outline-form {
    width: 100%;
    padding: 0;
    color: #333333; // 使用 TiptapEditor 默认颜色
    font-size: 24px; // 使用 TiptapEditor 默认字号

    .chapter-item {
      margin-bottom: 0; // 章节之间无额外间距，与MD一致

      &:last-child {
        margin-bottom: 0;
      }
    }

    // 编辑状态下，章节之间添加间距
    &.is-editing {
      .chapter-item {
        margin-bottom: 16px;

        &:last-child {
          margin-bottom: 0;
        }
      }

      // 编辑状态布局：章节标题label在左侧，标题内容和描述在右侧对齐
      .chapter-edit-row {
        display: flex;
        align-items: flex-start;
        gap: 36px; // 从设计稿看，label和内容之间有间距

        .chapter-label {
          flex-shrink: 0;
          font-size: 24px; // 使用 TiptapEditor 默认字号
          font-weight: 400;
          line-height: 1.8em; // From Figma
          color: #333333; // 使用 TiptapEditor 默认颜色
          width: 72px; // From Figma layout_07JEWA
          white-space: nowrap; // 第N章标题要一行完全展示
        }

        .chapter-edit-content {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 10px; // 标题和描述之间的间距

          .chapter-title-edit-wrapper {
            width: 429px; // From Figma layout_SZRIG6 (width: 429) - 标题输入框宽度要更小

            .chapter-title-input {
              width: 100%;
              font-size: 24px; // 使用 TiptapEditor 默认字号

              :deep(.el-textarea__inner) {
                background: #f7f7f8; // From Figma fill_C94O3K
                padding: 0px 10px !important; // From Figma layout_802NL0 (y: 3, x: 114-88=26)
                border: none !important; // 不要边框
                border-radius: 10px; // From Figma borderRadius
                color: #333333 !important; // 使用 TiptapEditor 默认颜色
                font-size: 24px !important; // 使用 TiptapEditor 默认字号
                font-weight: 400 !important;
                line-height: 1.8em !important; // From Figma style_MR6JPI
                box-shadow: none;
                resize: none;
                overflow-y: auto !important;
                height: auto !important;
                min-height: 45px !important; // From Figma layout_SZRIG6 (height: 50)
                max-height: 45px !important; // 章节标题输入框不需要这么大这么高
                transition: all 0.2s;

                &:focus {
                  outline: none;
                  background: #f0f0f0; // 聚焦时稍微变深
                }
              }
            }
          }

          .chapter-note-edit-wrapper {
            max-width: 940px; // From Figma layout_X5E09T (width: 940) - 描述输入框宽度

            .chapter-note-input {
              width: 100%;
              font-size: 24px; // 使用 TiptapEditor 默认字号

              :deep(.el-textarea__inner) {
                background: #f7f7f8; // From Figma fill_C94O3K
                // padding: 13px 10px !important; // From Figma layout_FDIYD8
                border: none !important; // 不要边框
                border-radius: 10px; // From Figma borderRadius
                color: #333333 !important; // 使用 TiptapEditor 默认颜色
                font-size: 24px !important; // 使用 TiptapEditor 默认字号
                font-weight: 400 !important;
                line-height: 1.8em !important; // From Figma style_MR6JPI
                box-shadow: none;
                resize: none;
                overflow-y: auto !important;
                height: auto !important;
                min-height: 140px; // From Figma layout_X5E09T (height: 140)
                transition: all 0.2s;

                &:focus {
                  outline: none;
                  background: #f0f0f0; // 聚焦时稍微变深
                }
              }
            }
          }
        }
      }
    }
  }

  .streaming-indicator {
    position: absolute;
    top: 0;
    right: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 8px;
    font-size: 14px;
    color: var(--text-secondary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    z-index: 10;

    .spinning {
      animation: spin 1s linear infinite;
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

// 下一步按钮：绝对定位在右下角
.next-step-btn-container {
  position: absolute;
  right: 120px;
  bottom: 50px;
  z-index: 100;

  .next-step-btn {
    width: 221px;
    height: 52px;
    padding: 0;
    border-radius: 10px;
    background: linear-gradient(90deg, rgba(239, 175, 0, 1) 0%, rgba(255, 149, 0, 1) 100%);
    border: none;
    font-size: 28px;
    font-weight: 700;
    line-height: 1.32em;
    color: #ffffff;
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
}

// 回退按钮：绝对定位在右下角，与下一步按钮并排（在左侧）
.revert-btn-container {
  position: absolute;
  right: 120px;
  bottom: 50px;
  z-index: 100;

  .revert-btn {
    width: 261px; // From Figma Frame 3250
    height: 52px; // From Figma Frame 3250
    padding: 7px 0px; // From Figma Frame 3250
    border-radius: 10px; // From Figma Frame 3250
    border: 2px solid #999999; // From Figma Frame 3250
    // background: #fff;
    font-size: 28px; // From Figma Frame 3250
    font-weight: 400; // From Figma Frame 3250
    line-height: 1.32em; // From Figma Frame 3250
    color: #999999; // From Figma Frame 3250
    padding: 0; // Reset padding to allow full button size
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
</style>
