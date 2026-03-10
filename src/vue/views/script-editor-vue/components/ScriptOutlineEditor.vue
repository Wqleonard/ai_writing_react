<script setup lang="ts">
import { ref, watch, computed, nextTick, onMounted, onUnmounted } from "vue";
import { ElButton, ElMessage, ElMessageBox, ElInput } from "element-plus";
import type { PostStreamData } from "@/api/index.ts";
import { useEditorStore } from "@/vue/stores/editor.ts";
import { storeToRefs } from "pinia";
import type {
  ScriptGenerateOutlineData,
  ScriptSplitOutlineDict,
  ScriptOutlineStorageData,
  PostScriptTemplateStreamSplitOutlineRequestData,
  ScriptCharacterCardData,
  ScriptStorySynopsisResult,
} from "@/vue/utils/interfaces";
import { addNote } from "@/api/notes";
import type { NoteSourceType } from "@/vue/utils/interfaces";
import TiptapEditor from "@/components/TiptapEditor.vue";
import { getScriptSplitOutline, postScriptTemplateStreamOutline } from "@/api/generate-quick";
// import EditScriptSplitOutlineIcon from "@/assets/images/quick_creation/edit_script_split_outline.svg";

// 大纲分段项（与 index.vue OutlineSegmentItem 一致）
export interface OutlineSegmentItem {
  start: number;
  end: number;
  label: string;
  /** 后端原样，如 "1-12(起)"，用于展示和 episodeNumAndPart */
  raw: string;
}

interface Props {
  storyContent?: string; // 故事更改内容（JSON字符串）
  characterContent?: string; // 角色设定内容（JSON字符串）
  outlineContent?: string; // 从serverData读取的大纲内容
  outlineSegments?: OutlineSegmentItem[]; // 起承转合分段（来自 getScriptSplitOutline）
  novelPlot?: string; // 小说纲章内容（用于获取分段）
  description?: string; // 一句话梗概（用于获取分段）
  episodeNum?: number; // 集数（来自标签「故事有多少集数」，用于生成参数）
  locked?: boolean; // 是否锁定（不可编辑）
  hasNextContent?: boolean; // 后面是否有内容
  triggerGenerate?: number; // 触发生成的标志（数字，每次需要生成时递增）
}

interface Emits {
  (e: "confirm", outlineData: string): void; // 确认时传递大纲数据
  (e: "revert"): void; // 回退到上一步
  (e: "revert-to-current"): void; // 回退到当前步骤
  (e: "error-and-revert", targetDir: string): void; // 错误时回退到指定目录
  (e: "split-ready", rawSegments: string[]): void; // 获取到分段后通知父组件（后端 splitOutline 原样）
}

const props = withDefaults(defineProps<Props>(), {
  storyContent: "",
  characterContent: "",
  outlineContent: "",
  outlineSegments: () => [],
  episodeNum: 60,
  locked: false,
  triggerGenerate: 0,
});

const emit = defineEmits<Emits>();

const editorStore = useEditorStore();
const {  workInfo } = storeToRefs(editorStore);

// 大纲内容：按分段存储，当前段流式/编辑用 md、json
const outlineContentMd = ref("");
const outlineContentJson = ref<ScriptGenerateOutlineData | null>(null);
const outlineContentBySegment = ref<string[]>([]);
const outlineJsonBySegment = ref<(ScriptGenerateOutlineData | null)[]>([]);
// 从 props.outlineContent 解析出来的存储结构（包括所有分段的 md / json），用于刷新后恢复状态
const storedOutlineData = ref<ScriptOutlineStorageData | null>(null);
const selectedSegmentIndex = ref(0);
const currentStreamingSegmentIndex = ref<number | null>(null);
const isEditing = ref(false);
const outlineContainerRef = ref<HTMLElement | null>(null);
const isStreaming = ref(false);
const loading = ref(false);
/** 本次会话内 fetch 拿到的分段 raw，用于「刚拉取分段后」立即生成第一段（不依赖父组件回传） */
const segmentRawsForRequest = ref<string[]>([]);

const selectedVersion = ref("v1");

// TiptapEditor引用（保留用于其他地方）
// const tiptapEditorRef = ref<InstanceType<typeof TiptapEditor> | null>(null);

// AbortController 用于取消流式请求
const outlineStreamAbortController = ref<AbortController | null>(null);

console.log("[ScriptOutlineEditor] Component mounted");

const hasSegments = computed(() => (props.outlineSegments?.length ?? 0) > 0);

// 当前选中分段展示用 md
const currentSegmentMd = computed(() => {
  const i = selectedSegmentIndex.value;
  if (currentStreamingSegmentIndex.value === i) return outlineContentMd.value;
  return outlineContentBySegment.value[i] ?? "";
});

// 当前选中分段展示用 json
const currentSegmentJson = computed(() => {
  const i = selectedSegmentIndex.value;
  if (currentStreamingSegmentIndex.value === i) return outlineContentJson.value;
  return outlineJsonBySegment.value[i] ?? null;
});

// 是否全部段都已生成
const hasOutlineContent = computed(() => {
  const n = props.outlineSegments?.length ?? 0;
  return n > 0 && outlineJsonBySegment.value.length >= n && outlineJsonBySegment.value.every(Boolean);
});

// 是否至少有一个分段已生成（用于「下一步」可用：每段生成完成后即可点下一步触发后续段或确认）
const hasAnySegmentContent = computed(
  () => outlineJsonBySegment.value.length > 0 && outlineJsonBySegment.value.some(Boolean)
);

// 当前分段是否已生成完成
const isCurrentSegmentComplete = computed(() => {
  const i = selectedSegmentIndex.value;
  return !!outlineJsonBySegment.value[i];
});

const isGenerateComplete = computed(() => hasOutlineContent.value);

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

// 流式数据处理回调（分段模式会写入当前段的 outlineContentBySegment / outlineJsonBySegment）
// 使用捕获的 segmentIndex，避免异步回调执行时 currentStreamingSegmentIndex 已被新流改写，导致第三段等被写成第一段内容
const createOnOutlineStreamData = (segmentIndex: number) => (data: PostStreamData) => {
  const segIdx = segmentIndex;

  switch (data.event) {
    case "messages/partial": {
      const content = getContentFromPartial(data.data);
      outlineContentMd.value = content;
      if (segIdx !== null && outlineContentBySegment.value.length > 0) {
        const arr = [...outlineContentBySegment.value];
        arr[segIdx] = content;
        outlineContentBySegment.value = arr;
      }
      break;
    }
    case "updates": {
      const generate_outline: ScriptGenerateOutlineData | undefined =
        data?.data?.generate_writing_template?.result?.outline;
      if (generate_outline?.outline_dict && Array.isArray(generate_outline.outline_dict)) {
        outlineContentJson.value = generate_outline;
        if (segIdx !== null && outlineJsonBySegment.value.length > 0) {
          const arr = [...outlineJsonBySegment.value];
          arr[segIdx] = generate_outline;
          outlineJsonBySegment.value = arr;
          console.log("[ScriptOutlineEditor] updates 写入 json 分段", {
            segIdx,
            outline_dict_len: generate_outline.outline_dict.length,
            jsonBySegmentLen: arr.length,
          });
        } else {
          console.log("[ScriptOutlineEditor] updates 未写入 json 分段（条件不满足）", {
            segIdx,
            jsonBySegmentLength: outlineJsonBySegment.value.length,
          });
        }
      }
      break;
    }
    case "end": {
      break;
    }
  }
};

// 流式结束回调
const onOutlineStreamEnd = () => {
  const segCount = outlineJsonBySegment.value.length;
  const lastIdx = segCount - 1;
  console.log("[ScriptOutlineEditor] onOutlineStreamEnd", {
    jsonBySegmentLength: segCount,
    lastSegmentHasJson: lastIdx >= 0 ? !!outlineJsonBySegment.value[lastIdx] : "N/A",
    perSegmentHasJson: outlineJsonBySegment.value.map((j, i) => (j ? `${i}:${j.outline_dict?.length ?? 0}` : `${i}:null`)),
  });
  isStreaming.value = false;
  loading.value = false;
  outlineStreamAbortController.value = null;
  if (currentStreamingSegmentIndex.value !== null) {
    currentStreamingSegmentIndex.value = null;
  }
  if (!props.locked && (outlineContentJson.value !== null || outlineJsonBySegment.value.some(Boolean))) {
    isEditing.value = true;
  }
};

let hasThrowError = false;

// 流式错误回调
const onOutlineStreamError = (error: Error) => {
  if(hasThrowError) return;
   hasThrowError = true;
   console.error("[ScriptOutlineEditor] 获取大纲失败:", error);
  // ElMessage.error("生成大纲失败，请重试");
  loading.value = false;
  isStreaming.value = false;
  outlineStreamAbortController.value = null;
  setTimeout(() => {
    hasThrowError = false;
  }, 1000);
  // 触发错误回退事件，回退到角色设定
  emit("error-and-revert", "主角设定.md");
};

// 添加笔记：保存当前分段的大纲，笔记标题带上分段信息（如 1-10(起)）
const handleAddNote = async () => {
  if (isStreaming.value) {
    ElMessage.warning("请等待大纲生成完成后再添加笔记");
    return;
  }

  const content = currentSegmentMd.value;
  if (!content?.trim()) {
    ElMessage.warning("当前分段大纲内容为空，无法添加笔记");
    return;
  }

  const baseTitle = workInfo.value?.title || "大纲";
  const segs = props.outlineSegments ?? [];
  const seg = segs[selectedSegmentIndex.value];
  const title = seg?.raw ? `${baseTitle} - ${seg.raw}` : baseTitle;

  try {
    await addNote(title, content.trim(), "PC_ADD" as NoteSourceType);
    ElMessage.success("笔记添加成功");
  } catch (error) {
    console.error("添加笔记失败:", error);
    ElMessage.error("添加笔记失败，请重试");
  }
};

// 根据故事梗概是否为「小说原版」返回 description / brainStorm（与 ScriptCharacterSelector 一致）
function getStoryParamsForRequest(): { description: string; brainStorm: ScriptStorySynopsisResult } {
  try {
    const raw = props.storyContent || "";
    if (!raw.trim().startsWith("{")) return { description: props.description ?? "", brainStorm: {} };
    const storyDataWrapper = JSON.parse(raw);
    const selectedTab = storyDataWrapper.selectedTab;
    const selectedData = storyDataWrapper.selectedData || {};
    if (selectedTab === "original") {
      return { description: "", brainStorm: {} };
    }
    const brainStorm: ScriptStorySynopsisResult = {
      title: selectedData.title,
      synopsis: selectedData.synopsis,
      background: selectedData.background,
      highlight: selectedData.highlight,
      informationGap: selectedData.informationGap,
    };
    return { description: props.description ?? "", brainStorm };
  } catch (_) {
    return { description: props.description ?? "", brainStorm: {} };
  }
}

// 解析 props 得到角色列表 roleCard[]，全部传入接口（与 interfaces 中 roleCard: ScriptCharacterCardData[] 一致）
function getRoleCardList(): ScriptCharacterCardData[] {
  const normalize = (c: Record<string, unknown>): ScriptCharacterCardData => ({
    name: String(c.name ?? ""),
    definition: String(c.definition ?? ""),
    age: String(c.age ?? ""),
    personality: String(c.personality ?? ""),
    biography: String(c.biography ?? ""),
  });
  try {
    const rawChar = props.characterContent || "";
    if (!rawChar.trim()) return [];
    const data = JSON.parse(rawChar);
    if (Array.isArray(data.generatedCards) && data.generatedCards.length > 0) {
      return data.generatedCards.map((c: Record<string, unknown>) => normalize(c));
    }
    if (Array.isArray(data)) {
      return data.map((c: Record<string, unknown>) => normalize(c));
    }
    if (data && typeof data === "object") {
      const single = data.selectedData ?? data;
      if (Array.isArray(single)) return single.map((c: Record<string, unknown>) => normalize(c));
      return [normalize(single)];
    }
  } catch (_) {}
  return [];
}

// 流式生成当前分段大纲（postScriptTemplateStreamOutline）
const generateSegmentOutline = async (segmentIndex: number) => {
  const raws = segmentRawsForRequest.value.length
    ? segmentRawsForRequest.value
    : (props.outlineSegments?.map((s) => s.raw) ?? []);
  if (!raws.length || segmentIndex < 0 || segmentIndex >= raws.length) return;
  if (loading.value || isStreaming.value) return;
  if (!props.storyContent?.trim() || !props.characterContent?.trim()) {
    ElMessage.warning("请先完成前面的步骤");
    return;
  }

  const { description, brainStorm } = getStoryParamsForRequest();
  const novelPlot = props.novelPlot ?? "";
  const episodeNum = props.episodeNum ?? 60;
  const segmentRaw = raws[segmentIndex];
  const existingEpisodes = outlineContentBySegment.value.slice(0, segmentIndex);
  const roleCards = getRoleCardList();

  const requestData: PostScriptTemplateStreamSplitOutlineRequestData = {
    novelPlot,
    description,
    brainStorm,
    roleCards,
    episodeNum,
    episodeNumAndPart: segmentRaw,
    existingEpisodes,
  };

  if (outlineStreamAbortController.value) outlineStreamAbortController.value.abort();
  outlineContentMd.value = "";
  outlineContentJson.value = null;
  currentStreamingSegmentIndex.value = segmentIndex;
  isStreaming.value = true;
  loading.value = true;
  outlineStreamAbortController.value = new AbortController();

  try {
    await postScriptTemplateStreamOutline(
      requestData,
      createOnOutlineStreamData(segmentIndex),
      onOutlineStreamError,
      onOutlineStreamEnd,
      { signal: outlineStreamAbortController.value.signal }
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      loading.value = false;
      isStreaming.value = false;
      currentStreamingSegmentIndex.value = null;
      outlineStreamAbortController.value = null;
      return;
    }
    console.error("[ScriptOutlineEditor] generateSegmentOutline failed:", error);
    loading.value = false;
    isStreaming.value = false;
    currentStreamingSegmentIndex.value = null;
    outlineStreamAbortController.value = null;
    emit("error-and-revert", "主角设定.md");
  }
};

// 重新生成：清空全部段内容，从第一段开始生成
const generateOutline = async () => {
  if (!hasSegments.value || !props.outlineSegments?.length) return;
  if (loading.value || isStreaming.value) return;

  if (outlineStreamAbortController.value) outlineStreamAbortController.value.abort();
  const n = props.outlineSegments.length;
  outlineContentBySegment.value = Array(n).fill("");
  outlineJsonBySegment.value = Array(n).fill(null);
  outlineContentMd.value = "";
  outlineContentJson.value = null;
  selectedSegmentIndex.value = 0;
  nextTick(() => generateSegmentOutline(0));
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

// 处理集数输入变化（写入当前段 json，episode_title / episode_note）
const handleChapterInput = (
  episodeIndex: number,
  field: "episode_title" | "episode_note",
  value: string
) => {
  const i = selectedSegmentIndex.value;
  const j = outlineJsonBySegment.value[i];
  if (j?.outline_dict?.[episodeIndex]) {
    j.outline_dict[episodeIndex][field] = value;
    outlineJsonBySegment.value = [...outlineJsonBySegment.value];
  }
};

// 切换编辑状态
const toggleEdit = () => {
  if (props.locked || isStreaming.value) return;
  console.log("[ScriptOutlineEditor] toggleEdit, current isEditing:", isEditing.value);
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

// 点击分段标签：生成中禁止切换，避免多标签同时展示当前流式内容
const handleSegmentTabClick = (segIdx: number) => {
  if (isStreaming.value) return;
  selectedSegmentIndex.value = segIdx;
};

// 下一步：全部完成则确认；否则按顺序找到第一个未生成大纲的分段，自动切到该分段并触发生成（保证顺序，避免用户手动切到后面分段时跳过中间未生成的段）
const handleNextStep = () => {
  if (hasOutlineContent.value) {
    handleConfirm();
    return;
  }
  const segs = props.outlineSegments ?? [];
  if (!segs.length) return;
  const n = segs.length;
  let firstUngeneratedIndex = -1;
  for (let i = 0; i < n; i++) {
    if (!outlineJsonBySegment.value[i]) {
      firstUngeneratedIndex = i;
      break;
    }
  }
  if (firstUngeneratedIndex === -1) {
    handleConfirm();
    return;
  }
  selectedSegmentIndex.value = firstUngeneratedIndex;
  nextTick(() => generateSegmentOutline(firstUngeneratedIndex));
};

// 确认：分段模式合并各段 md 与 json 后提交
const handleConfirm = () => {
  if (!hasOutlineContent.value) {
    ElMessage.warning("请先生成大纲内容");
    return;
  }

  const segs = props.outlineSegments ?? [];
  const bySegment = [...outlineContentBySegment.value];
  // 确保长度与分段数一致，避免最后一格未写入时丢失
  while (bySegment.length < segs.length) bySegment.push("");
  bySegment[selectedSegmentIndex.value] = outlineContentMd.value;
  const mdBySegment: string[] = [];
  const allDict: ScriptSplitOutlineDict[] = [];
  for (let i = 0; i < segs.length; i++) {
    const md = bySegment[i] ?? "";
    mdBySegment.push(md);
    const j = outlineJsonBySegment.value[i];
    if (j?.outline_dict?.length) allDict.push(...j.outline_dict);
  }
  const mdContent = mdBySegment;
  const jsonContent: ScriptGenerateOutlineData = { outline_dict: allDict };
  const storageData: ScriptOutlineStorageData = { mdContent, jsonContent };
  // 追踪：下一步提交时各段长度与 json，排查最后一段丢失
  const lastIdx = segs.length - 1;
  console.log("[ScriptOutlineEditor] handleConfirm 提交", {
    segsLength: segs.length,
    bySegmentLength: bySegment.length,
    mdBySegmentLength: mdBySegment.length,
    lastSegmentMdLength: mdBySegment[lastIdx]?.length ?? 0,
    lastSegmentMdPreview: (mdBySegment[lastIdx] ?? "").slice(0, 80),
    allDictLength: allDict.length,
    perSegmentJson: outlineJsonBySegment.value.map((j, i) => (j ? `${i}:${j.outline_dict?.length ?? 0}` : `${i}:null`)),
    lastSegmentHasJson: !!outlineJsonBySegment.value[lastIdx],
  });
  emit("confirm", JSON.stringify(storageData));
};

// 处理回退到当前步骤
const handleRevertToCurrent = () => {
  emit("revert-to-current");
};

// 回退（带二次确认）
const handleRevert = async () => {
  console.log("[ScriptOutlineEditor] handleRevert");

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
    console.log("[ScriptOutlineEditor] User cancelled revert");
  }
};

// 根据存储结构和分段信息，将所有分段的 md / json 恢复到 outlineContentBySegment / outlineJsonBySegment
const hydrateFromStoredData = (storageData: ScriptOutlineStorageData) => {
  const segs = props.outlineSegments ?? [];
  const len = segs.length;
  if (len <= 0) return;

  const mergedJson = storageData.jsonContent;
  const allEpisodes = mergedJson?.outline_dict ?? [];
  const mdArr: string[] = Array(len).fill("");
  if (Array.isArray(storageData.mdContent)) {
    for (let i = 0; i < len; i++) {
      mdArr[i] = storageData.mdContent[i] ?? "";
    }
  } else {
    mdArr[0] = storageData.mdContent || "";
  }
  outlineContentBySegment.value = mdArr;

  const jsonBySegment: (ScriptGenerateOutlineData | null)[] = Array(len).fill(null);
  if (allEpisodes.length && len > 0) {
    for (let i = 0; i < len; i++) {
      const seg = segs[i];
      const startIdx = Math.max(0, (seg.start ?? 1) - 1);
      const endIdx = Math.min(allEpisodes.length, seg.end ?? allEpisodes.length);
      const slice = allEpisodes.slice(startIdx, endIdx);
      jsonBySegment[i] = {
        ...mergedJson,
        outline_dict: slice,
      };
    }
  }
  outlineJsonBySegment.value = jsonBySegment;

  // 追踪：恢复时各段 md/json，排查最后一段丢失
  const lastIdx = len - 1;
  console.log("[ScriptOutlineEditor] hydrateFromStoredData 恢复", {
    segsLength: len,
    storedMdContentLength: storageData.mdContent?.length ?? 0,
    lastSegmentMdLength: mdArr[lastIdx]?.length ?? 0,
    lastSegmentMdPreview: (mdArr[lastIdx] ?? "").slice(0, 80),
    allEpisodesLength: allEpisodes.length,
    perSegmentDictLen: jsonBySegment.map((j) => j?.outline_dict?.length ?? 0),
    lastSegmentDictLen: jsonBySegment[lastIdx]?.outline_dict?.length ?? 0,
  });

  selectedSegmentIndex.value = 0;
  outlineContentMd.value = outlineContentBySegment.value[0] ?? "";
  outlineContentJson.value = outlineJsonBySegment.value[0] ?? null;
};

// 从 props 初始化：仅支持 ScriptOutlineStorageData（确认后保存的合并大纲）
const initFromProps = () => {
  if (!props.outlineContent?.trim()) return;
  const trimmed = props.outlineContent.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return;
  try {
    const storageData: ScriptOutlineStorageData = JSON.parse(props.outlineContent);
    storedOutlineData.value = storageData;
    // 追踪：从 props 解析出的存储里 mdContent 长度
    const mdLen = Array.isArray(storageData.mdContent) ? storageData.mdContent.length : 0;
    const lastMd = Array.isArray(storageData.mdContent) ? (storageData.mdContent[mdLen - 1] ?? "") : "";
    console.log("[ScriptOutlineEditor] initFromProps 解析", {
      mdContentLength: mdLen,
      outlineSegmentsLength: props.outlineSegments?.length ?? 0,
      lastSegmentMdLength: lastMd.length,
      lastSegmentMdPreview: lastMd.slice(0, 80),
    });
    // 先填充当前段的内容，后续在有分段信息时再按分段恢复
    if (Array.isArray(storageData.mdContent)) {
      outlineContentMd.value = storageData.mdContent[0] ?? "";
    } else {
      outlineContentMd.value = storageData.mdContent || "";
    }
    outlineContentJson.value = storageData.jsonContent || null;
    // 如果此时已经有分段信息，则直接按分段恢复
    if (props.outlineSegments?.length) {
      hydrateFromStoredData(storageData);
    }
  } catch (e) {
    console.error("[ScriptOutlineEditor] Failed to parse outline JSON:", e);
  }
};

// 监听props变化
watch(
  () => props.outlineContent,
  (newVal, oldVal) => {
    console.log("[ScriptOutlineEditor] outlineContent changed:", {
      newVal: newVal?.substring(0, 50),
      oldVal: oldVal?.substring(0, 50),
    });

    // 如果内容被清空（从有内容变为空），重置状态，避免回退后仍展示旧内容
    if (oldVal && !newVal) {
      console.log("[ScriptOutlineEditor] Content cleared, reset state");
      outlineContentMd.value = "";
      outlineContentJson.value = null;
      storedOutlineData.value = null;
      outlineContentBySegment.value = [];
      outlineJsonBySegment.value = [];
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
    console.log("[ScriptOutlineEditor] characterContent changed:", {
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
    console.log("[ScriptOutlineEditor] locked changed:", { newVal, oldVal });
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
      console.log("[ScriptOutlineEditor] triggerGenerate changed, trigger generate:", { newVal, oldVal });
      // 检查条件：有故事梗概、有角色内容、未锁定（不管是否有大纲内容都重新生成）
      if (
        props.storyContent &&
        props.storyContent.trim() !== "" &&
        props.characterContent &&
        props.characterContent.trim() !== "" &&
        !props.locked
      ) {
        console.log("[ScriptOutlineEditor] Conditions met, auto generate");

        // 如果正在生成，先终止之前的流式请求
        if (isStreaming.value || loading.value) {
          console.log("[ScriptOutlineEditor] Aborting previous generation");
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
          // 先获取大纲分段（起承转合），仅展示分段并通知父组件生成章节目录
          fetchSplitOutline();
          // 后续真正生成大纲内容时，再调用 generateOutline()
        }, 100);
      } else {
        console.log("[ScriptOutlineEditor] Conditions not met, skip generate");
      }
    }
  }
);

// 父组件回传 outlineSegments（如刷新/重新进入）时，同步数组长度；
// 如果已经有存储数据（storedOutlineData），则按分段恢复内容；否则仅初始化为空数组
watch(
  () => props.outlineSegments?.length ?? 0,
  (len) => {
    if (len <= 0) return;
    // 若已有存储数据，则优先按存储数据恢复
    if (storedOutlineData.value) {
      hydrateFromStoredData(storedOutlineData.value);
      return;
    }
    // 若有未解析的 outlineContent（JSON），先尝试解析恢复，避免执行顺序导致被空数组覆盖
    if (props.outlineContent?.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(props.outlineContent!) as ScriptOutlineStorageData;
        if (parsed.mdContent != null) {
          storedOutlineData.value = parsed;
          hydrateFromStoredData(parsed);
          return;
        }
      } catch (_) {}
      return;
    }
    // 无存储数据时，仅在数组尚未初始化时创建占位
    if (outlineContentBySegment.value.length !== len) {
      const segs = props.outlineSegments!;
      outlineContentBySegment.value = segs.map(() => "");
      outlineJsonBySegment.value = segs.map(() => null);
    }
  }
);

// 切换分段标签时，把当前编辑内容写回上一段，并加载选中段内容到编辑器
watch(selectedSegmentIndex, (newIdx, oldIdx) => {
  if (!hasSegments.value || oldIdx === newIdx) return;
  const arr = [...outlineContentBySegment.value];
  if (oldIdx >= 0 && oldIdx < arr.length) arr[oldIdx] = outlineContentMd.value;
  outlineContentBySegment.value = arr;
  outlineContentMd.value = outlineContentBySegment.value[newIdx] ?? "";
  outlineContentJson.value = outlineJsonBySegment.value[newIdx] ?? null;
});

// 编辑器内容变更时写回当前段
watch(outlineContentMd, (val) => {
  if (!hasSegments.value || isStreaming.value) return;
  const i = selectedSegmentIndex.value;
  const arr = [...outlineContentBySegment.value];
  if (i >= 0 && i < arr.length) {
    arr[i] = val;
    outlineContentBySegment.value = arr;
  }
});

// 调用 getScriptSplitOutline 获取大纲分段，并通过事件通知父组件（小说原版只传 novelPlot，非原版传全参数）
const fetchSplitOutline = async () => {
  try {
    if (!props.novelPlot?.trim()) {
      console.warn("[ScriptOutlineEditor] fetchSplitOutline skipped: missing novelPlot");
      return;
    }
    const { description, brainStorm } = getStoryParamsForRequest();
    const resp: any = await getScriptSplitOutline(
      props.novelPlot,
      description,
      brainStorm,
      props.episodeNum || 60
    );
    const rawArr: string[] = resp?.splitOutline && Array.isArray(resp.splitOutline) ? resp.splitOutline : [];
    console.log("[ScriptOutlineEditor] fetchSplitOutline raw:", rawArr);
    emit("split-ready", rawArr);
    if (rawArr.length > 0) {
      segmentRawsForRequest.value = rawArr;
      outlineContentBySegment.value = rawArr.map(() => "");
      outlineJsonBySegment.value = rawArr.map(() => null);
      selectedSegmentIndex.value = 0;
      nextTick(() => generateSegmentOutline(0));
    }
  } catch (e) {
    console.error("[ScriptOutlineEditor] fetchSplitOutline failed:", e);
    ElMessage.warning("获取大纲分段失败，请稍后重试");
  }
};

// 组件挂载后，不自动生成，等待用户手动触发或通过 triggerGenerate 触发
onMounted(() => {
  console.log("[ScriptOutlineEditor] onMounted");
  // 移除自动生成逻辑，避免刷新页面时自动生成（即使组件被 CSS 隐藏也会挂载）
  // 如果需要生成，通过 triggerGenerate prop 触发
  // 添加点击外部退出编辑的监听
  document.addEventListener("click", handleClickOutside);
});

// 组件卸载时，取消流式请求
onUnmounted(() => {
  console.log("[ScriptOutlineEditor] onUnmounted");
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
          <el-button link type="info" class="action-btn" :disabled="loading || isStreaming || !hasSegments" @click="generateOutline">
            <span class="iconfont refresh-icon">&#xe66f;</span>
            <span>重新生成</span>
          </el-button>
        </template>
      </div>
    </div>

    <!-- 起承转合分段标签（来自 getScriptSplitOutline），生成中禁止切换；生成中在行末显示「正在生成大纲...」 -->
    <div v-if="outlineSegments?.length" class="outline-segments-row">
      <div class="outline-segments-tabs">
        <button
          v-for="(seg, segIdx) in outlineSegments"
          :key="seg.raw"
          type="button"
          class="segment-tab"
          :class="{
            'segment-tab-selected': selectedSegmentIndex === segIdx,
            'segment-tab-disabled': isStreaming,
          }"
          :disabled="isStreaming"
          @click="handleSegmentTabClick(segIdx)"
        >
          {{ seg.raw }}
        </button>
      </div>
      <div v-if="isStreaming" class="streaming-indicator-in-row">
        <span class="iconfont spinning">&#xe66f;</span>
        <span>正在生成大纲...</span>
      </div>
    </div>

    <!-- 大纲容器：占满剩余高度，可滚动 -->
    <div class="outline-container" ref="outlineContainerRef" @click.stop="handleOutlineContainerClick">
      <!-- <div class="editor-header">
        <div class="header-title-text">大纲</div> -->
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
      <!-- </div> -->

      <!-- 生成中显示 MarkdownEditor -->
      <TiptapEditor v-if="isStreaming" v-model="outlineContentMd" :placeholder="'开始编写大纲...'" :editable="false"
        :show-toolbar="false" model-type="md" class="outline-editor" />

      <!-- 生成完成后显示 HTML 表单（当前段 outline_dict：episode / episode_title / episode_note） -->
      <div v-else class="outline-form" :class="{ 'is-editing': isEditing || locked || currentSegmentJson }">
        <div v-for="(item, index) in currentSegmentJson?.outline_dict" :key="index" class="chapter-item">
          <!-- 编辑状态：集数 label 在左侧，标题和描述在右侧 -->
          <template v-if="isEditing || locked || currentSegmentJson">
            <div class="chapter-edit-row">
              <div class="chapter-label">{{ item.episode }}</div>
              <div class="chapter-edit-content">
                <div class="chapter-title-edit-wrapper">
                  <el-input :disabled="locked" :model-value="item.episode_title" type="textarea"
                    :autosize="{ minRows: 1, maxRows: 10 }" class="field-input chapter-title-input" @click.stop
                    @input="(val) => handleChapterInput(index, 'episode_title', val as string)" />
                </div>
                <div class="chapter-note-edit-wrapper">
                  <el-input :disabled="locked" :model-value="item.episode_note" type="textarea"
                    :autosize="{ minRows: 3, maxRows: 10 }" class="field-input chapter-note-input" @click.stop
                    @input="(val) => handleChapterInput(index, 'episode_note', val as string)" />
                </div>
              </div>
            </div>
          </template>
          <!-- 非编辑状态：保持原有布局 -->
          <template v-else>
            <div class="chapter-header">
              <span class="chapter-number">{{ item.episode }}</span>
              <span class="chapter-separator">: </span>
              <span class="chapter-title-content">
                <span class="chapter-title-text">{{ item.episode_title }}</span>
              </span>
            </div>
            <div class="field-row">
              <span class="field-content">
                <span class="field-text">{{ item.episode_note }}</span>
              </span>
            </div>
          </template>
        </div>
      </div>

    </div>

    <!-- 下一步按钮：分段模式下先切下一段并生成，全部完成后确认 -->
    <div v-if="!locked" class="next-step-btn-container">
      <el-button
        type="primary"
        class="next-step-btn"
        :disabled="isStreaming || !outlineSegments?.length || !(hasOutlineContent || hasAnySegmentContent)"
        @click="handleNextStep"
      >
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
  padding: 50px 260px 50px 0px;
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

// 起承转合分段标签行（设计稿：1-10章(起)、11-20章(承) 等）；右侧为「正在生成大纲...」占位
.outline-segments-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 24px;
  flex-shrink: 0;
}

.outline-segments-tabs {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.streaming-indicator-in-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-secondary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  flex-shrink: 0;

  .spinning {
    animation: spin 1s linear infinite;
  }
}

.segment-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  font-size: 16px;
  font-weight: 400;
  line-height: 1.32;
  color: #EFAF00;
  // background: rgba(239, 175, 0, 0.15);
  border: 1px solid #EFAF00;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s;

  &:hover {
    border-color: #FF9500;
  }

  &.segment-tab-selected {
    border-color: #FF9500;
    color: #FF9500;
    background: rgba(255, 149, 0, 0.12);
  }

  &.segment-tab-disabled,
  &:disabled {
    cursor: not-allowed;
    opacity: 0.85;
  }

  &.segment-tab-disabled:not(.segment-tab-selected):hover,
  &:disabled:not(.segment-tab-selected):hover {
    border-color: #EFAF00;
    background: transparent;
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
    line-height: 1.8em;

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
                border: none !important;
                border-radius: 10px;
                color: #333333 !important;
                font-size: 24px !important;
                font-weight: 400 !important;
                line-height: 1.8em !important; // From Figma style_MR6JPI
                box-shadow: none;
                resize: none;
                overflow-y: auto !important;
                height: auto !important;
                min-height: 5.9em !important; // 至少展示 3 行（3 × 1.8em）
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
  right: 260px;
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
  right: 260px;
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
