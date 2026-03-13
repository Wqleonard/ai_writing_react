<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from "vue";
import { ElButton, ElMessage, ElSlider } from "element-plus";
import { uploadFileReq } from "@/api/files.ts";
import scriptEmptyUploadIcon from "@/assets/images/quick_creation/script_empty_upload.svg";
// 导入 JSZip 用于解析 docx 文件
import JSZip from "jszip";
import type { FileItem, ScriptNovelOutlineChapterResult } from "@/vue/utils/interfaces";
import type { PostStreamData } from "@/api/index.ts";
import type { PostScriptTemplateStreamPlotRequestData } from "@/vue/utils/interfaces";
import MarkdownEditor from "@/vue/components/MarkdownEditor.vue";
import AutoScrollbar from "@/vue/components/AutoScrollbar.vue";
import { postScriptTemplateStreamPlot } from "@/api/generate-quick";

interface Props {
  novelContent?: string; // 从serverData读取的小说纲章内容（JSON字符串）
  locked?: boolean; // 是否锁定（不可编辑）
  hasNextContent?: boolean; // 后面是否有内容
}

interface Emits {
  (e: "confirm", data: any): void; // 确认时传递一些内容
  (e: "revert"): void; // 回退
  (e: "revert-to-current"): void; // 回退到当前步骤
}

const props = withDefaults(defineProps<Props>(), {
  novelContent: "",
  locked: false,
});

const emit = defineEmits<Emits>();

// 文件上传状态
type UploadStatus = "empty" | "hover" | "uploading" | "uploaded" | 'completed';

const uploadStatus = ref<UploadStatus>("empty");
const uploadedFile = ref<FileItem | null>(null);
const isDragging = ref(false);


const isStreaming = ref(false); // 是否正在流式生成中

// 章节信息
const totalWords = ref(0); // 总字数
const totalChapters = ref(0); // 总章节数
const selectedChapter = ref(1); // 选中的章节（单滑块）
const hasChapterFormat = ref(false); // 是否有章节格式

// 生成章纲的结果数据
const outlineResult = ref<ScriptNovelOutlineChapterResult | null>(null);

// 流式内容（生成中的内容）
const streamingContent = ref("");

// 获取不带扩展名的文件名
const fileNameWithoutExtension = computed(() => {
  const fileName = outlineResult.value?.originalName || uploadedFile.value?.originalName;
  if (!fileName) return "";
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex === -1) return fileName;
  return fileName.substring(0, lastDotIndex);
});

// 右侧 padding：有「重新上传/下一步」或「回退至小说纲章」按钮展示时为 120px，否则 285px
// const containerPaddingRightPx = computed(() => {
//   const hasCompletedActions = uploadStatus.value === "completed" && !props.locked && !isStreaming.value;
//   const hasRevertSection = !!props.hasNextContent;
//   return hasCompletedActions || hasRevertSection ? 260 : 285;
// });

// AbortController 用于取消流式请求
const plotStreamAbortController = ref<AbortController | null>(null);

// 文件大小限制：10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 支持的文件类型
const ALLOWED_EXTENSIONS = [".txt"];

// 验证文件
const validateFile = (file: File): boolean => {
  // 验证文件类型
  const extension = "." + file.name.split(".").pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    ElMessage.error("仅支持 .txt格式");
    return false;
  }

  // 验证文件大小
  if (file.size > MAX_FILE_SIZE) {
    ElMessage.error("文件大小不能超过10MB");
    return false;
  }

  return true;
};

// 处理文件上传
const handleFileUpload = async (file: File) => {
  if (!validateFile(file)) {
    return;
  }

  uploadStatus.value = "uploading";
  uploadedFile.value = null;

  try {
    // 上传文件
    const result = await uploadFileReq(file);

    // 获取文件扩展名
    const extension = file.name.split(".").pop()?.toLowerCase() || "";

    uploadedFile.value = {
      id: `file_${Date.now()}`,
      originalName: file.name, // 用户上传时的原始文件名
      serverFileName: result.fileName, // 服务器生成的文件名
      putFilePath: result.putFilePath, // 上传路径
      displayUrl: result.putFilePath, // 暂时使用上传路径作为显示URL
      type: file.type,
      size: file.size,
      extension: extension,
    };

    // 读取文件内容进行拆解
    await parseNovelContent(file);

    uploadStatus.value = "uploaded";
    // 文件上传完成后，更新提示位置
    updateChapterValuePosition();
  } catch (error) {
    console.error("文件上传失败:", error);
    ElMessage.error("文件上传失败，请重试");
    uploadStatus.value = "empty";
    uploadedFile.value = null;
  }
};

// 解析 docx 文件内容（使用 JSZip）
const parseDocxFile = async (file: File): Promise<string> => {
  try {
    // 读取文件为 ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // 使用 JSZip 解压 docx 文件
    const zip = await JSZip.loadAsync(arrayBuffer);

    // docx 文件的主要内容在 word/document.xml 中
    const documentXml = await zip.file("word/document.xml")?.async("string");

    if (!documentXml) {
      throw new Error("无法读取 docx 文件内容");
    }

    // 解析 XML 并提取文本内容
    // docx 的文本内容在 <w:t> 标签中
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(documentXml, "text/xml");

    // 提取所有文本节点
    const textNodes = xmlDoc.getElementsByTagName("w:t");
    const textParts: string[] = [];

    for (let i = 0; i < textNodes.length; i++) {
      const textNode = textNodes[i];
      if (textNode.textContent) {
        textParts.push(textNode.textContent);
      }
    }

    // 合并所有文本，保留换行（通过检查是否有段落分隔）
    // 检查是否有段落标签 <w:p>
    const paragraphs = xmlDoc.getElementsByTagName("w:p");
    let fullText = "";

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      const paragraphTexts = paragraph.getElementsByTagName("w:t");
      let paragraphText = "";

      for (let j = 0; j < paragraphTexts.length; j++) {
        if (paragraphTexts[j].textContent) {
          paragraphText += paragraphTexts[j].textContent;
        }
      }

      if (paragraphText.trim()) {
        fullText += paragraphText + "\n";
      }
    }

    // 如果没有通过段落提取到文本，则使用简单的文本节点合并
    if (!fullText.trim() && textParts.length > 0) {
      fullText = textParts.join("");
    }

    return fullText.trim();
  } catch (error) {
    console.error("解析 docx 文件失败:", error);
    throw new Error("docx 文件解析失败，请检查文件格式是否正确");
  }
};

// 解析小说内容
const parseNovelContent = async (file: File) => {
  try {
    let text = "";

    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      // 读取txt文件
      text = await file.text();
    } else if (
      file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.name.endsWith(".docx")
    ) {
      // 使用 JSZip 解析 docx 文件
      try {
        text = await parseDocxFile(file);
      } catch (docxError) {
        console.error("docx 文件解析失败:", docxError);
        ElMessage.error(
          docxError instanceof Error ? docxError.message : "docx 文件解析失败，请检查文件格式是否正确"
        );
        throw docxError;
      }
    } else {
      ElMessage.error("不支持的文件格式");
      return;
    }

    // 统计字数（去除空白字符后统计）
    // 这里统计的是纯文本字符数，不包括空格和换行
    const textWithoutSpaces = text.replace(/\s/g, "");
    totalWords.value = textWithoutSpaces.length;

    // 检测章节格式（查找"第N章"格式）
    const chapterPattern = /第[一二三四五六七八九十百千万\d]+章/g;
    const chapterMatches = text.match(chapterPattern);

    if (chapterMatches && chapterMatches.length > 0) {
      hasChapterFormat.value = true;
      totalChapters.value = chapterMatches.length;
      selectedChapter.value = totalChapters.value;
    } else {
      // 未检测到「第N章」格式：不按字数估算章节数，视为全文 1 段，避免误导用户
      hasChapterFormat.value = false;
      totalChapters.value = 1;
      selectedChapter.value = 1;
    }
  } catch (error) {
    console.error("解析小说内容失败:", error);
    ElMessage.error("解析文件内容失败");
    // 解析失败时重置状态
    uploadStatus.value = "empty";
    uploadedFile.value = null;
    totalWords.value = 0;
    totalChapters.value = 0;
    selectedChapter.value = 1;
    hasChapterFormat.value = false;
  }
};

// 处理文件选择
const handleFileSelect = () => {
  if (props.locked) return;

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".txt";
  fileInput.style.display = "none";

  fileInput.addEventListener("change", async (event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      await handleFileUpload(file);
    }
  });

  document.body.appendChild(fileInput);
  fileInput.click();
  document.body.removeChild(fileInput);
};

// 拖拽处理
const handleDragOver = (e: DragEvent) => {
  if (props.locked) return;
  e.preventDefault();
  e.stopPropagation();
  if (uploadStatus.value === "empty" || uploadStatus.value === "hover") {
    isDragging.value = true;
    uploadStatus.value = "hover";
  }
};

const handleDragLeave = (e: DragEvent) => {
  if (props.locked) return;
  e.preventDefault();
  e.stopPropagation();
  isDragging.value = false;
  if (uploadStatus.value === "hover") {
    uploadStatus.value = "empty";
  }
};

const handleDrop = async (e: DragEvent) => {
  if (props.locked) return;
  e.preventDefault();
  e.stopPropagation();
  isDragging.value = false;

  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    await handleFileUpload(files[0]);
  } else {
    uploadStatus.value = "empty";
  }
};

// 重新上传
const handleReupload = () => {
  if (props.locked) return;

  // 如果正在流式生成，先取消请求
  if (plotStreamAbortController.value) {
    plotStreamAbortController.value.abort();
    plotStreamAbortController.value = null;
  }

  // 重置状态
  uploadStatus.value = "empty";
  uploadedFile.value = null;
  totalWords.value = 0;
  totalChapters.value = 0;
  selectedChapter.value = 1;
  hasChapterFormat.value = false;
  outlineResult.value = null;
  streamingContent.value = "";
  isStreaming.value = false;
  handleFileSelect();
};

// 处理下一步
const handleNextStep = () => {
  if (props.locked) return;
  if (!outlineResult.value) {
    ElMessage.warning("请先完成章纲生成");
    return;
  }
  // 传递生成的数据
  emit("confirm", outlineResult.value);
};

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) {
    return bytes + "B";
  } else if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + "KB";
  } else {
    return (bytes / (1024 * 1024)).toFixed(1) + "MB";
  }
};

// 获取文件图标类型
const getFileIconType = computed(() => {
  if (!uploadedFile.value) return "txt";
  return uploadedFile.value.extension === "docx" ? "docx" : "txt";
});

// 章节提示信息的位置（响应式）
const chapterValuePosition = ref(0);

// 计算章节提示信息的位置（跟随滑块移动）- 基于按钮的实际位置
// 使用按钮中心点作为 left 值，然后用 transform: translateX(-50%) 来居中
const updateChapterValuePosition = () => {
  nextTick(() => {
    // 获取 slider-content 和按钮的实际 DOM 元素
    const sliderContent = document.querySelector(".chapter-range-controls .slider-content") as HTMLElement;
    const sliderButton = sliderContent?.querySelector(".el-slider__button-wrapper") as HTMLElement;

    if (!sliderContent || !sliderButton) {
      chapterValuePosition.value = 0;
      return;
    }

    // 获取实际位置
    const contentRect = sliderContent.getBoundingClientRect();
    const buttonRect = sliderButton.getBoundingClientRect();

    // 计算按钮中心点相对于 slider-content 的左侧位置
    // 这个值将作为提示框的 left，然后使用 transform: translateX(-50%) 来居中
    const buttonCenter = buttonRect.left - contentRect.left + buttonRect.width / 2;
    chapterValuePosition.value = buttonCenter - 4;
  });
};

// 监听选中章节和总章节数变化，更新提示位置
watch([selectedChapter, totalChapters], () => {
  updateChapterValuePosition();
});

// 监听窗口大小变化
let resizeTimer: ReturnType<typeof setTimeout> | null = null;
const handleResize = () => {
  if (resizeTimer) {
    clearTimeout(resizeTimer);
  }
  resizeTimer = setTimeout(() => {
    updateChapterValuePosition();
  }, 100);
};

// 从流式数据中提取内容
const getContentFromPartial = (data: any): string => {
  if (!data || !Array.isArray(data) || data.length === 0) return "";
  const firstItem = data[0];
  if (Array.isArray(firstItem.content) && firstItem.content.length > 0) {
    if (firstItem.content[0].text) {
      return firstItem.content[0].text;
    }
  }
  return "";
};

// 流式数据处理回调
const onPlotStreamData = (data: PostStreamData) => {
  console.log("[ScriptNovelOutlineChapter] Stream data:", data.event, data);

  switch (data.event) {
    case "messages/partial": {
      const content = getContentFromPartial(data.data);
      // 流式生成中，更新内容
      streamingContent.value = content;
      // 实时更新 outlineResult 的 content
      if (!outlineResult.value) {
        outlineResult.value = { content: content || '', originalName: uploadedFile.value?.originalName, serverFileName: uploadedFile.value?.serverFileName, wordCount: totalWords.value, chapterNum: selectedChapter.value };
      } else {
        outlineResult.value.content = content || '';
      }
      // 如果有内容了，提前显示 completed 状态
      if (content && uploadStatus.value !== "completed") {
        uploadStatus.value = "completed";
      }
      break;
    }
    case "updates": {
      // 这里添加一个优化逻辑，如果没有正常拆解出内容，提醒用户内容违规，重新上传，并恢复到待上传状态
      if(!streamingContent.value){
        ElMessage.error("您上传的小说包含违规内容，请重新上传");
        uploadStatus.value = "empty";
        return;
      }
      // 生成完成，接收最终数据
      // 根据实际 API 返回的数据结构来解析
      const result = data?.data?.generate_writing_template?.result?.plot;
      if (result) {
        // 如果 API 返回了结构化的数据，解析并保存
        if (result.novel_plot) {
          outlineResult.value!.content = result.novel_plot;
        }
      }
      break;
    }
    case "end": {
      console.log("[ScriptNovelOutlineChapter] Stream end");
      break;
    }
  }
};

// 流式结束回调
const onPlotStreamEnd = () => {
  console.log("[ScriptNovelOutlineChapter] onPlotStreamEnd");
  isStreaming.value = false;
  plotStreamAbortController.value = null;
  // 确保最终内容已保存
  // if (streamingContent.value && outlineResult.value) {
  //   outlineResult.value.content = streamingContent.value;
  // }

  // // 生成完成后设置为 completed 状态
  // if (outlineResult.value) {
  //   uploadStatus.value = "completed";
  // }
};

// 流式错误回调
const onPlotStreamError = (error: Error) => {
  console.error("[ScriptNovelOutlineChapter] 生成章纲失败:", error);
  // ElMessage.error(error.message || "生成章纲失败，请重试");
  isStreaming.value = false;
  plotStreamAbortController.value = null;
};

// 处理确认
const handleConfirm = async () => {
  if (props.locked) return;

  if (uploadStatus.value !== "uploaded" || !uploadedFile.value) {
    ElMessage.warning("请先上传小说文件");
    return;
  }

  // 防止重复调用
  if (isStreaming.value) {
    console.log("[ScriptNovelOutlineChapter] Already generating, skip");
    return;
  }

  // 如果已有正在进行的请求，先取消
  if (plotStreamAbortController.value) {
    plotStreamAbortController.value.abort();
  }

  // 重置内容
  streamingContent.value = "";
  outlineResult.value = null;
  isStreaming.value = true;

  // 构建请求参数
  const data: PostScriptTemplateStreamPlotRequestData = {
    attachmentName: uploadedFile.value.serverFileName,
    wordCount: totalWords.value, //totalWords.value,暂时传1000字
    chapterNum: selectedChapter.value,
  };

  // 调用生成章纲的流式接口
  try {
    // 创建新的 AbortController
    plotStreamAbortController.value = new AbortController();

    await postScriptTemplateStreamPlot(
      data,
      onPlotStreamData,
      onPlotStreamError,
      onPlotStreamEnd,
      { signal: plotStreamAbortController.value.signal }
    );
  } catch (error: any) {
    // 如果是取消操作，不记录为错误
    if (error instanceof DOMException && error.name === "AbortError") {
      console.log("[ScriptNovelOutlineChapter] 流式请求已取消");
      isStreaming.value = false;
      plotStreamAbortController.value = null;
      return;
    }
    console.error("生成章纲失败:", error);
    // ElMessage.error(error.message || "生成章纲失败，请重试");
    isStreaming.value = false;
    plotStreamAbortController.value = null;
  }
};

// 处理回退
const handleRevert = () => {
  emit("revert");
};

// 处理回退到当前步骤
const handleRevertToCurrent = () => {
  emit("revert-to-current");
};

// 从props初始化数据
const initFromProps = () => {
  if (props.novelContent) {
    try {
      const data = JSON.parse(props.novelContent);
      // 待完善，只记录最终生成的数据
      outlineResult.value = data;
      uploadStatus.value = "completed";
      // if (data.fileName) {
      //   uploadedFile.value = {
      //     originalName: data.fileName,
      //     size: data.fileSize || 0,
      //     type: "",
      //     extension: data.fileName.split(".").pop()?.toLowerCase() || "",
      //   };
      //   totalWords.value = data.totalWords || 0;
      //   totalChapters.value = data.totalChapters || 0;
      //   // 兼容旧数据格式
      //   if (data.chapterRange && Array.isArray(data.chapterRange)) {
      //     selectedChapter.value = data.chapterRange[1] || data.chapterRange[0] || 1;
      //   } else if (data.selectedChapter) {
      //     selectedChapter.value = data.selectedChapter;
      //   } else {
      //     selectedChapter.value = totalChapters.value || 1;
      //   }
      //   hasChapterFormat.value = data.hasChapterFormat || false;
      //   uploadStatus.value = "uploaded";
      //   // 初始化数据后更新提示位置
      //   updateChapterValuePosition();
      // }
    } catch (e) {
      console.error("Failed to parse novelContent:", e);
    }
  }
};

// 监听props变化
watch(
  () => props.novelContent,
  () => {
    initFromProps();
  },
  { immediate: true }
);

onMounted(() => {
  initFromProps();
  // 初始化时计算提示位置
  updateChapterValuePosition();
  // 监听窗口大小变化
  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  // 组件卸载时清理
  window.removeEventListener("resize", handleResize);
  if (resizeTimer) {
    clearTimeout(resizeTimer);
  }
  // 取消正在进行的流式请求
  if (plotStreamAbortController.value) {
    plotStreamAbortController.value.abort();
    plotStreamAbortController.value = null;
  }
});
</script>

<template>
  <div class="novel-outline-chapter-container">
    <div class="novel-outline-chapter-layout" v-loading.lock="isStreaming && uploadStatus !== 'completed'">
      <!-- 标题 -->
      <div v-if="uploadStatus !== 'uploaded' && uploadStatus !== 'completed'" class="section-title">
        导入小说原文,进行<span class="title-highlight">章纲拆解</span>
      </div>

      <!-- 文件上传区域 -->
      <div class="upload-area" :class="{
        'upload-area-empty': uploadStatus === 'empty',
        'upload-area-hover': uploadStatus === 'hover',
        'upload-area-uploading': uploadStatus === 'uploading',
        'upload-area-uploaded': uploadStatus === 'uploaded',
        'upload-area-completed': uploadStatus === 'completed',
      }" @dragover="handleDragOver" @dragleave="handleDragLeave" @drop="handleDrop"
        @click="uploadStatus === 'empty' || uploadStatus === 'hover' ? handleFileSelect() : null">
        <!-- 空状态 -->
        <template v-if="uploadStatus === 'empty'">
          <div class="upload-icon-wrapper">
            <img :src="scriptEmptyUploadIcon" alt="上传" class="upload-icon-empty"></img>
          </div>
          <div class="upload-text">
            <span>拖拽文件到此或点击</span>
            <span class="upload-link">上传</span>
          </div>
          <div class="upload-hint">仅支持 .txt格式,文件大小限制10MB</div>
        </template>

        <!-- hover状态 -->
        <template v-else-if="uploadStatus === 'hover'">
          <div class="upload-icon-wrapper">
            <img :src="scriptEmptyUploadIcon" alt="上传" class="upload-icon-empty"></img>
          </div>
          <div class="upload-text">
            <span>拖拽文件到此或点击</span>
            <span class="upload-link">上传</span>
          </div>
          <div class="upload-hint">仅支持 .txt 和 .docx 格式,文件大小限制10MB</div>
        </template>

        <!-- 上传中状态 -->
        <template v-else-if="uploadStatus === 'uploading'">
          <div class="upload-icon-wrapper">
            <div class="file-icon" :class="`file-icon-${getFileIconType}`">
              <div class="file-icon-text">{{ getFileIconType === "docx" ? ".docx" : ".TXT" }}</div>
              <div class="file-icon-arrow"></div>
            </div>
          </div>
          <div class="loading-indicator">
            <div class="loading-dot loading-dot-1"></div>
            <div class="loading-dot loading-dot-2"></div>
          </div>
          <div class="loading-text">加载中...</div>
        </template>

        <!-- 上传完成状态 -->
        <template v-else-if="uploadStatus === 'uploaded' && uploadedFile">
          <div class="uploaded-content">
            <!-- 文件信息卡片 -->
            <div class="file-info-card">
              <div class="file-icon-display" :class="`file-icon-${getFileIconType}`">
                <div class="file-icon-text">{{ getFileIconType === "docx" ? ".docx" : ".TXT" }}</div>
                <div class="file-icon-arrow"></div>
              </div>
              <div class="file-info">
                <div class="file-name">{{ uploadedFile.originalName }}</div>
                <div class="file-size">{{ formatFileSize(uploadedFile.size) }}</div>
              </div>
            </div>

            <!-- 章节范围选择器 -->
            <div v-if="totalChapters > 0" class="chapter-range-selector">
              <div class="chapter-range-info">
                本书共计{{ totalWords }}字, {{ totalChapters }}章, 请选择需要拆解的章节范围
              </div>
              <div class="chapter-range-note">
                注:若小说原文未使用"第N章"格式进行章节划分,则无法获取正确章节范围
              </div>
              <div class="chapter-range-controls">
                <div class="chapter-indicator chapter-indicator-left">
                  <span class="chapter-indicator-value">1</span>
                </div>
                <div class="chapter-slider-container">
                  <div class="slider-content">
                    <el-slider v-model="selectedChapter" :min="1" :max="totalChapters" :step="1"
                      :disabled="props.locked" :show-tooltip="false" class="chapter-slider" />
                    <div class="chapter-value"
                      :style="{ left: chapterValuePosition + 'px', transform: 'translateX(-50%)' }">
                      <span class="chapter-value-text">{{ selectedChapter }}章</span>
                    </div>
                  </div>
                </div>
                <div class="chapter-indicator chapter-indicator-right">
                  <span class="chapter-indicator-value">{{ totalChapters }}</span>
                </div>
              </div>
            </div>

            <!-- 重新上传按钮 -->
            <div class="reupload-btn" @click.stop="handleReupload">
              <img :src="scriptEmptyUploadIcon" class="reupload-icon"></img>
              <span>重新上传</span>
            </div>

            <!-- 操作按钮 - 只有上传成功后才显示 -->

            <el-button v-if="!locked" type="primary" class="confirm-btn" @click="handleConfirm">
              确定
            </el-button>

          </div>
        </template>
        <template v-else-if="uploadStatus === 'completed'">
          <div class="completed-content">
            <!-- 标题 -->
            <div v-if="fileNameWithoutExtension" class="completed-title">
              {{ fileNameWithoutExtension }}
            </div>

            <!-- 内容区域 - 撑满容器 -->
            <div class="completed-content-area">
              <AutoScrollbar max-height="100%" :auto-scroll="true">
                <MarkdownEditor v-if="outlineResult || streamingContent" key="script-novel-outline-chapter-editor"
                  class="script-novel-outline-chapter-editor"
                  :model-value="outlineResult?.content || streamingContent || ''" :readonly="true" />
              </AutoScrollbar>
            </div>

            <!-- 底部按钮区域 -->
            <div class="completed-actions">
              <!-- 重新上传按钮 -->
              <div v-if="!locked && !isStreaming" class="reupload-btn" @click.stop="handleReupload">
                <img :src="scriptEmptyUploadIcon" class="reupload-icon"></img>
                <span>重新上传</span>
              </div>

              <!-- 下一步按钮 -->
              <el-button v-if="!locked && !isStreaming" type="primary" class="next-step-btn" @click="handleNextStep"
                :disabled="isStreaming">
                下一步
              </el-button>
            </div>
          </div>
        </template>
      </div>

      <!-- 底部回退按钮 -->
      <div v-if="hasNextContent" class="bottom-revert-section">
        <el-button class="revert-btn-bottom" @click="handleRevertToCurrent">
          回退至小说纲章
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.novel-outline-chapter-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  padding: 50px 260px 50px 0; /* 右侧由 :style 动态设为 120px 或 285px */
  position: relative;
  container-type: size;
  container-name: novel-outline-chapter;
}

.novel-outline-chapter-layout {
  overflow-y: auto;
  overflow-x: hidden;
  align-items: center;
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  width: 100%;
}

.section-title {
  font-size: 32px;
  margin-top: 60px;
  font-weight: 400;
  line-height: 1.32em;
  color: #464646;
  text-align: center;
  margin-bottom: 60px;
  flex-shrink: 0;

  .title-highlight {
    background: linear-gradient(90deg, rgba(239, 175, 0, 1) 0%, rgba(255, 149, 0, 1) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
}

.upload-area {
  width: 100%;
  height: 429px;
  border-radius: 20px;
  display: flex;
  overflow: visible;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  box-sizing: border-box;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  flex-shrink: 0;

  &.upload-area-empty {
    cursor: pointer;
    // 空状态：白色背景，黄色虚线边框
    background: #ffffff;
    border: 1px dashed rgba(239, 175, 0, 1);
  }

  &.upload-area-hover {
    // hover状态：黄色渐变背景，黄色虚线边框
    background: #FFFCF3;
    border: 1px dashed rgba(239, 175, 0, 1);
  }

  &.upload-area-uploading {
    width: 608px;
    height: 386px;
    border-radius: 20px;
    border: 1px dashed #EFAF00;
    background: linear-gradient(180deg, rgba(255, 252, 243, 0.50) 0%, rgba(255, 249, 232, 0.50) 100%);
  }

  &.upload-area-uploaded {
    cursor: default;
    align-items: center;
    justify-content: flex-start;
    background: transparent;
    border: none;
    padding: 0;
  }

  &.upload-area-completed {
    cursor: default;
    align-items: flex-start;
    justify-content: flex-start;
    background: transparent;
    border: none;
    padding: 0;
    height: 100%;
  }
}

.upload-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}

.upload-icon-empty {
  width: 56px;
  height: 56px;
  margin-bottom: 20px;
}

.file-icon {
  width: 140px;
  height: 178px;
  position: relative;
  background-image: url(@/assets/images/quick_creation/upload_back_image.svg);
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  // box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.1);

  &.file-icon-txt,
  &.file-icon-docx {
    .file-icon-text {
      font-size: 36px;
      font-weight: 700;
      line-height: 1.32em;
      letter-spacing: 0.04em;
      background: linear-gradient(90deg, rgba(239, 175, 0, 1) 0%, rgba(255, 149, 0, 1) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
  }
}

// .file-icon-text {
//   font-size: 36px;
//   font-weight: 700;
//   line-height: 1.32em;
//   letter-spacing: 0.04em;
//   background: linear-gradient(90deg, rgba(239, 175, 0, 1) 0%, rgba(255, 149, 0, 1) 100%);
//   -webkit-background-clip: text;
//   -webkit-text-fill-color: transparent;
//   background-clip: text;
// }

.file-icon-arrow {
  position: absolute;
  bottom: -10px;
  right: 12px;
  width: 42px;
  height: 59px;
  background-image: url(@/assets/images/quick_creation/upload_up_image.svg);
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

.upload-text {
  font-size: 18px;
  font-weight: 400;
  line-height: 1.32em;
  letter-spacing: 0.04em;
  color: #4b4b4b;
  text-align: center;
  margin-bottom: 10px;

  .upload-link {
    color: transparent;
    background: linear-gradient(90deg, rgba(239, 175, 0, 1) 0%, rgba(255, 149, 0, 1) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-color: rgba(239, 175, 0, 1);
    text-underline-offset: 2px;
  }
}

.upload-hint {
  font-size: 14px;
  font-weight: 400;
  line-height: 1.8em;
  letter-spacing: 0.04em;
  color: #949494;
  text-align: center;
}

.loading-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 20px 0;
}

.loading-dot {
  width: 29px;
  height: 29px;
  border-radius: 50%;
  animation: loading-bounce 1.4s ease-in-out infinite both;

  &.loading-dot-1 {
    background: #efaf00;
    animation-delay: -0.32s;
  }

  &.loading-dot-2 {
    background: #ff9500;
    animation-delay: -0.16s;
  }
}

@keyframes loading-bounce {

  0%,
  80%,
  100% {
    transform: scale(0);
  }

  40% {
    transform: scale(1);
  }
}

.loading-text {
  font-size: 15px;
  font-weight: 400;
  line-height: 1.32em;
  letter-spacing: 0.04em;
  color: #949494;
  text-align: center;
}

.uploaded-content {
  overflow: visible;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 26px;
}

.file-info-card {
  margin-top: 89px;
  width: 554px;
  height: 211px;
  border-radius: 20px;
  border: 1px dashed #EFAF00;
  background: linear-gradient(180deg, rgba(255, 252, 243, 0.50) 0%, rgba(255, 249, 232, 0.50) 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: visible;
}

.file-icon-display {
  width: 140px;
  height: 178px;
  margin-top: -89px;
  position: relative;
  background-image: url(@/assets/images/quick_creation/upload_back_image.svg);
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &.file-icon-txt,
  &.file-icon-docx {
    .file-icon-text {
      font-size: 36px;
      font-weight: 700;
      line-height: 1.32em;
      letter-spacing: 0.04em;
      background: linear-gradient(90deg, rgba(239, 175, 0, 1) 0%, rgba(255, 149, 0, 1) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      position: relative;
      z-index: 1;
    }
  }

  .file-icon-arrow {
    position: absolute;
    bottom: -10px;
    right: 12px;
    width: 42px;
    height: 59px;
    background-image: url(@/assets/images/quick_creation/upload_up_image.svg);
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
    z-index: 2;
  }
}

.file-info {
  margin-top: 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 100%;
}

.file-name,
.file-size {
  background: linear-gradient(90deg, #EFAF00 0%, #FF9500 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-size: 20px;
  font-style: normal;
  font-weight: 400;
  line-height: 180%;
  letter-spacing: 0.8px;
}

.chapter-range-selector {
  width: 704px;
  height: 184px;
  border-radius: 20px;
  border: 1px dashed #EFAF00;
  background: linear-gradient(180deg, rgba(255, 252, 243, 0.50) 0%, rgba(255, 249, 232, 0.50) 100%);
  display: flex;
  align-items: center;
  flex-direction: column;
}

.chapter-range-info {
  color: #464646;
  text-align: center;
  font-size: 18px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
  letter-spacing: 0.72px;
  margin-top: 27px;
}

.chapter-range-note {
  margin-top: 15px;
  color: #999;
  text-align: center;
  font-size: 14px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
  letter-spacing: 0.56px;
}

.chapter-range-controls {
  display: flex;
  flex-direction: row;
  width: 517px;
  align-items: center;
  gap: 25px;
  margin-top: 32px;
}

.chapter-indicator {
  width: 39px;
  height: 36px;
  border-radius: 6px;
  border: 2px solid #EFAF00;
  // background: linear-gradient(180deg, rgba(255, 252, 243, 0.50) 0%, rgba(255, 249, 232, 0.50) 100%);;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  .chapter-indicator-value {
    font-size: 16px;
    font-weight: 700;
    line-height: 1.32em;
    color: transparent;
    background: linear-gradient(90deg, rgba(239, 175, 0, 1) 0%, rgba(255, 149, 0, 1) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-align: center;
  }
}

.chapter-slider-container {
  flex: 1;
  padding: 0;
  margin: 0;

  .slider-content {
    display: flex;
    align-items: center;
    width: 100%;
    height: 45px;
    margin: 0;
    padding: 0;
    position: relative;

    :deep(.el-slider) {
      width: 100%;
      height: 13px;
      margin: 0;
      padding: 0;
    }

    :deep(.el-slider__runway) {
      height: 13px;
      border-radius: 10px;
      background-color: rgba(255, 149, 0, 0.3);
      width: 100%;
    }

    :deep(.el-slider__bar) {
      background: linear-gradient(90deg, rgba(239, 175, 0, 1) 0%, rgba(255, 149, 0, 1) 100%);
      border-radius: 10px;
      height: 13px;
    }

    :deep(.el-slider__button) {
      width: 25px;
      height: 25px;
      border: 3px solid rgba(255, 149, 0, 1);
      border-radius: 50%;
      background-color: #ffffff;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;

      &::after {
        content: "";
        display: block;
        width: 8px;
        height: 9px;
        background-image: url("@/assets/images/quick_creation/chapter_position.svg");
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
      }

      &:hover {
        transform: scale(1.1);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
      }
    }

    :deep(.el-slider__button-wrapper) {
      top: -6px;
    }

    :deep(.el-slider__stop) {
      display: none;
    }

    :deep(.el-slider__tooltip) {
      display: none !important;
    }

    .chapter-value {
      position: absolute;
      top: -22px;
      width: 52px;
      height: 30px;
      display: flex;
      align-items: center;
      background-image: url("@/assets/images/quick_creation/chapter_tip.svg");
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      justify-content: center;
      pointer-events: none;
      flex-shrink: 0;

      .chapter-value-text {
        position: relative;
        z-index: 1;
        margin-bottom: 4px;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.8em;
        letter-spacing: 0.04em;
        color: transparent;
        background: linear-gradient(90deg, rgba(239, 175, 0, 1) 0%, rgba(255, 149, 0, 1) 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        white-space: nowrap;
      }
    }
  }
}

.reupload-btn {
  display: flex;
  align-items: center;
  gap: 11px;
  font-size: 20px;
  font-weight: 500;
  line-height: 1.21em;
  color: #b4b4b4;
  cursor: pointer;
  transition: color 0.2s;

  &:hover {
    color: #999999;
  }
}

.reupload-icon {
  width: 17px;
  height: 17px;
  // 使用 filter 将图标颜色改为 #b4b4b4 (RGB: 180, 180, 180)
  // 这个方法将图标转换为灰度，然后调整到目标颜色
  filter: brightness(0) saturate(100%) invert(71%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(100%) contrast(100%);

  // 如果上面的效果不理想，可以尝试这个更简单的方案（将图标变灰）
  // filter: grayscale(100%) brightness(0.7);
}


.confirm-btn {
  width: 233px;
  height: 66px;
  padding: 0;
  margin: 0;
  margin-top: 25px;
  font-size: 32px;
  font-weight: 700;
  line-height: 1.32em;
  background: linear-gradient(90deg, rgba(239, 175, 0, 1) 0%, rgba(255, 149, 0, 1) 100%);
  border: none;
  border-radius: 10px;
  color: #ffffff;
  box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.15);

  &:hover:not(:disabled) {
    background: linear-gradient(90deg, rgba(239, 175, 0, 0.9) 0%, rgba(255, 149, 0, 0.9) 100%);
    opacity: 1;
    transform: translateY(-2px);
    box-shadow: 0px 6px 16px rgba(0, 0, 0, 0.2);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}


.completed-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  padding: 0;
  height: 100%;
  margin: 0 auto;
  gap: 0;

  .completed-content-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0; // 允许 flex 子元素收缩
    overflow: hidden;
    width: 100%;
  }

  :deep(.auto-scrollbar) {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .script-novel-outline-chapter-editor {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;

    :deep(.ProseMirror) {
      outline: none;
      padding: 0 !important;
      color: #464646 !important;
      font-size: 20px !important;
      font-style: normal !important;
      font-weight: 400 !important;
      line-height: 1.8 !important;
      flex: 1;
      overflow-y: auto;
    }
  }
}

.completed-title {
  font-size: 40px;
  font-weight: 400;
  line-height: 1.8em;
  color: #000000;
  text-align: left;
  width: 100%;
  flex-shrink: 0; // 标题不收缩
  margin-bottom: 0; // 移除默认间距，由 gap 控制
}

.completed-description {
  font-size: 18px;
  font-weight: 400;
  line-height: 1.8em;
  color: #949494;
  text-align: left;
  width: 100%;
}

.completed-text-content {
  font-size: 20px;
  font-weight: 400;
  line-height: 1.8em;
  color: #464646;
  text-align: left;
  width: 100%;
  max-height: 400px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-wrap: break-word;

  // 自定义滚动条样式
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: #ccc;
    border-radius: 4px;

    &:hover {
      background: #999;
    }
  }
}

.completed-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  gap: 20px;
  width: 100%;
  margin-top: 20px;
  padding-top: 20px;
  flex-shrink: 0; // 按钮区域不收缩
}

.next-step-btn {
  width: 221px;
  height: 52px;
  padding: 0;
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.32em;
  background: linear-gradient(90deg, rgba(239, 175, 0, 1) 0%, rgba(255, 149, 0, 1) 100%);
  border: none;
  border-radius: 10px;
  color: #ffffff;
  box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.15);

  &:hover:not(:disabled) {
    background: linear-gradient(90deg, rgba(239, 175, 0, 0.9) 0%, rgba(255, 149, 0, 0.9) 100%);
    opacity: 1;
    transform: translateY(-2px);
    box-shadow: 0px 6px 16px rgba(0, 0, 0, 0.2);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.bottom-revert-section {
  position: absolute;
  bottom: 0px;
  right: 0;
  display: flex;
  justify-content: flex-end;
  z-index: 10;

  .revert-btn-bottom {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 230px;
    height: 46px;
    padding: 6px 0px;
    border-radius: 8px;
    font-size: 24px;
    font-weight: 400;
    line-height: 1.32em;
    color: #999999;
    background: #ffffff;
    border: 2px solid #999999;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.1);

    &:hover {
      color: var(--bg-editor-save);
      border-color: var(--bg-editor-save);
      transform: translateY(-2px);
      box-shadow: 0px 6px 16px rgba(0, 0, 0, 0.15);
    }
  }
}
</style>
