<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from "vue";
import { ElButton, ElMessage, ElInput, ElSelect, ElOption, ElMessageBox } from "element-plus";
import type { ScriptCharacterCardData, ScriptStorySynopsisResult } from "@/vue/utils/interfaces";
// import { useEditorStore } from "@/stores/editor";
// import { storeToRefs } from "pinia";
import MALE from "@/assets/images/character_card/male.png";
import EditIcon from "@/assets/images/quick_creation/edit.svg";
import CloseIcon from "@/assets/images/quick_creation/script_close.svg";
import ScriptCharacterCard from "./ScriptCharacterCard.vue";
import { getScriptCharacterSettings } from "@/api/generate-quick";
import confirmScPng from "@/assets/images/quick_creation/confirm_sc.png";


interface Props {
  selectedTagIds?: string;
  novelPlot?: string; // 小说纲章内容（故事梗概选小说原版时用）
  description?: string; // 标签/一句话梗概（故事梗概选灵感版或自定义时用）
  storyContent?: string; // 故事梗概 JSON（含 selectedTab、selectedData）
  characterContent?: string;
  locked?: boolean;
  hasNextContent?: boolean;
  triggerGenerate?: number;
}

interface Emits {
  (e: "confirm", characterData: string): void; // 确认时传递角色数据（JSON字符串）
  (e: "revert"): void; // 回退到上一步
  (e: "revert-to-current"): void; // 回退到当前步骤
  (e: "error-and-revert", targetDir: string): void; // 错误时回退到指定目录
}

const props = withDefaults(defineProps<Props>(), {
  selectedTagIds: "",
  novelPlot: "",
  description: "",
  characterContent: "",
  locked: false,
  triggerGenerate: 0,
});

const emit = defineEmits<Emits>();

// const editorStore = useEditorStore();
// const { workInfo } = storeToRefs(editorStore);

// 空角色数据
const EMPTY_SCRIPT_CHARACTER: ScriptCharacterCardData = {
  name: "",
  definition: "",
  age: "",
  personality: "",
  biography: "",
};

// 角色列表（剧本为多角色，全部生效，无需选中某一项）
const characters = ref<ScriptCharacterCardData[]>([]);
const selectedCharacterIndex = ref<number | null>(null);
const loading = ref(false);

// 编辑状态管理
const showEditPanel = ref(false);
const isCustomMode = ref(false); // true: 自定义模式, false: 编辑模式
const customCharacter = ref<ScriptCharacterCardData>({ ...EMPTY_SCRIPT_CHARACTER });
const editingCharacterIndex = ref<number | null>(null);
/** 编辑区左侧：true=仅查看（无表单项、无底部按钮），false=可编辑 */
const editPanelViewOnly = ref(true);

// 动画相关状态
const editPanelStyle = ref<{
  left?: string;
  top?: string;
  width?: string;
  height?: string;
  bottom?: string;
  transformOrigin?: string;
}>({
  left: "0px",
  top: "0px",
  width: "0px",
  height: "0px",
  transformOrigin: "top left",
});
const isAnimating = ref(false);
const characterGridRef = ref<HTMLElement | null>(null);
const characterScrollWrapRef = ref<HTMLElement | null>(null);
// 卡片行高：由容器高度动态计算，(容器高度 - 行间距 - margin) / 2，保证正好展示 2 行
const scriptCardRowHeightPx = ref<string>("340px");

const editPanelCardListRef = ref<HTMLElement | null>(null);
// 编辑区右侧卡片行高：容器高度去间距后 / 3，正好展示 3 行
const editPanelCardRowHeightPx = ref<string>("200px");

// 字数限制
const MAX_NAME_LENGTH = 5;
const MAX_EXPERIENCE_LENGTH = 300;
const MAX_PERSONALITY_LENGTH = 50;

// 定位下拉选项（与设计稿一致）
const DEFINITION_OPTIONS = ["男主", "女主", "男配", "女配"];

// 确认印章：未锁定时点击确认先播「盖章」下落动画（静态图），播完再切模块；已锁定时展示静态图
const CONFIRM_STAMP_ANIMATION_MS = 800; // 动画时长约 0.6s + 短暂停留后切模块
const confirmStampPlaying = ref(false);
const confirmStampKey = ref(0);

// 编辑区未保存检测：打开时存快照，取消/切换时对比
const initialEditSnapshot = ref<string>("");

console.log("[ScriptCharacterSelector] Component mounted");

// 剧本为多角色：生成完成即可下一步，无需选择某一角色
const canGoNext = computed(() => characters.value.some((c) => c.name && c.name.trim() !== ""));

// 显示的角色列表：只展示有 name 的角色（避免空 name 在卡片内显示骨架）；未锁定时末尾加自定义卡片
const displayCharacters = computed(() => {
  const withName = characters.value.filter((char) => char.name && char.name.trim());
  if (props.locked) {
    return withName;
  }
  return [...withName, null]; // null 表示自定义卡片
});

// 生成角色列表：根据故事梗概所选版本调用 getScriptCharacterSettings 不同传参
const generateCharacters = async () => {
  if (loading.value) return;
  if (!props.storyContent?.trim()) {
    ElMessage.warning("请先完成故事梗概");
    return;
  }

  loading.value = true;
  characters.value = [];
  selectedCharacterIndex.value = null;

  try {
    let res: { roleCards?: Array<Record<string, unknown>> };
    const storyDataWrapper = JSON.parse(props.storyContent || "{}");
    const selectedTab = storyDataWrapper.selectedTab;
    const selectedData = storyDataWrapper.selectedData || {};

    if (selectedTab === "original") {
      // 小说原版：只传 novelPlot，其它不传或为空
      res = await getScriptCharacterSettings(props.novelPlot || "", undefined, undefined);
    } else {
      // 灵感版1、灵感版2、自定义：不需要传 novelPlot，传 description + brainStorm
      const brainStorm: ScriptStorySynopsisResult = {
        title: selectedData.title,
        synopsis: selectedData.synopsis,
        background: selectedData.background,
        highlight: selectedData.highlight,
        informationGap: selectedData.informationGap,
      };
      res = await getScriptCharacterSettings("", props.description || "", brainStorm);
    }

    const list = Array.isArray(res?.roleCards) ? res.roleCards : [];
    characters.value = list.map((item: Record<string, unknown>) => ({
      name: String(item.name ?? ""),
      definition: String(item.definition ?? ""),
      age: String(item.age ?? ""),
      personality: String(item.personality ?? ""),
      biography: String(item.biography ?? ""),
    }));

    console.log("[ScriptCharacterSelector] Generated characters:", characters.value);
  } catch (e) {
    console.error("[ScriptCharacterSelector] 获取角色失败:", e);
    characters.value = [];
    emit("error-and-revert", "故事梗概.md");
  } finally {
    loading.value = false;
  }
};

// 选择角色（用于编辑等，剧本多角色不需要“选中一个”才能下一步）
const handleSelectCharacter = (character: ScriptCharacterCardData, index: number) => {
  if (loading.value || !character.name || props.locked) return;
  selectedCharacterIndex.value = index;
};

// 显示自定义角色编辑区（从自定义卡片位置展开，默认直接可编辑）
const handleShowCustomDialog = async (event: MouseEvent) => {
  if (props.locked || loading.value) return;
  console.log("[ScriptCharacterSelector] handleShowCustomDialog");
  customCharacter.value = { ...EMPTY_SCRIPT_CHARACTER };
  editingCharacterIndex.value = null;
  isCustomMode.value = true;

  const target = event.currentTarget as HTMLElement;
  await animateFromCard(target);
  editPanelViewOnly.value = false;
};

// 编辑已有角色（从卡片位置展开；锁定状态下也可打开，仅查看）
const handleEditCharacter = async (
  character: ScriptCharacterCardData,
  index: number,
  event?: MouseEvent
) => {
  customCharacter.value = { ...character };
  editingCharacterIndex.value = index;
  isCustomMode.value = false;

  const target = event?.currentTarget
    ? ((event.currentTarget as HTMLElement).closest(".character-card-wrapper") as HTMLElement)
    : (characterGridRef.value?.querySelector(".character-card-wrapper") as HTMLElement | null);
  if (target) {
    await animateFromCard(target);
  }
};

// 从卡片位置展开动画
const animateFromCard = async (cardElement: HTMLElement) => {
  if (!characterGridRef.value) return;

  const containerRect = characterGridRef.value.getBoundingClientRect();
  const cardRect = cardElement.getBoundingClientRect();

  // 计算卡片相对于容器的位置（不考虑滚动，因为编辑区在容器内部）
  const left = cardRect.left - containerRect.left;
  const top = cardRect.top - containerRect.top;
  const width = cardRect.width;
  const height = cardRect.height;

  // 设置初始位置和大小（从卡片位置开始）
  editPanelStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
    transformOrigin: "top left",
  };

  isAnimating.value = true;
  showEditPanel.value = true;
  editPanelViewOnly.value = true;

  await nextTick();
  initialEditSnapshot.value = JSON.stringify(customCharacter.value);

  // 动画展开到完全覆盖卡片区（与 card-edit-container 同高）
  setTimeout(() => {
    editPanelStyle.value = {
      left: "0px",
      top: "0px",
      width: "100%",
      height: "100%",
      bottom: "0px",
      transformOrigin: "top left",
    };

    // 动画结束后
    setTimeout(() => {
      isAnimating.value = false;
    }, 650);
  }, 50);
};

// 仅保存当前表单到列表，不关闭面板（供“保存后切换角色”使用）
const saveCurrentCharacterWithoutClose = (): boolean => {
  const name = customCharacter.value.name.trim();
  if (!name) {
    ElMessage.warning("请至少填写角色名字");
    return false;
  }
  const currentIndex = editingCharacterIndex.value;
  const nameExists = (idx: number) =>
    characters.value[idx]?.name?.trim().toLowerCase() === name.toLowerCase();
  if (currentIndex !== null) {
    const duplicateIdx = characters.value.findIndex((_, i) => i !== currentIndex && nameExists(i));
    if (duplicateIdx !== -1) {
      ElMessage.warning("该角色名已存在");
      return false;
    }
  } else {
    if (characters.value.some((c) => c.name?.trim().toLowerCase() === name.toLowerCase())) {
      ElMessage.warning("该角色名已存在");
      return false;
    }
  }
  const updated: ScriptCharacterCardData = { ...customCharacter.value };
  if (currentIndex !== null) {
    if (characters.value[currentIndex]?.isCustom) {
      updated.isCustom = true;
    }
    characters.value[currentIndex] = updated;
    selectedCharacterIndex.value = currentIndex;
  } else {
    updated.isCustom = true;
    const sameNameIndex = characters.value.findIndex(
      (c) => c.name?.trim() === name && c.isCustom
    );
    if (sameNameIndex !== -1) {
      characters.value[sameNameIndex] = updated;
      selectedCharacterIndex.value = sameNameIndex;
      editingCharacterIndex.value = sameNameIndex;
      isCustomMode.value = false;
    } else {
      characters.value.push(updated);
      const newIndex = characters.value.length - 1;
      selectedCharacterIndex.value = newIndex;
      editingCharacterIndex.value = newIndex;
      isCustomMode.value = false;
    }
  }
  initialEditSnapshot.value = JSON.stringify(customCharacter.value);
  return true;
};

// 保存并关闭
const handleSaveCustomCharacter = () => {
  if (!saveCurrentCharacterWithoutClose()) return;
  closeEditPanel();
};

// 是否有未保存的编辑
const isEditDirty = computed(
  () => initialEditSnapshot.value !== "" && JSON.stringify(customCharacter.value) !== initialEditSnapshot.value
);

// 关闭编辑面板（不弹二次确认，由调用方决定是否先弹窗）
const closeEditPanel = () => {
  showEditPanel.value = false;
  customCharacter.value = { ...EMPTY_SCRIPT_CHARACTER };
  editingCharacterIndex.value = null;
  isCustomMode.value = false;
  isAnimating.value = false;
  initialEditSnapshot.value = "";
};

// 编辑区右上角「返回」：有未保存修改时二次确认，然后关闭编辑区
const handleReturnFromEdit = async () => {
  if (!isEditDirty.value) {
    closeEditPanel();
    return;
  }
  try {
    await ElMessageBox.confirm(
      "您已对内容进行修改，直接退出将会删除修改内容。",
      "编辑的内容还未保存",
      {
        confirmButtonText: "保存",
        cancelButtonText: "直接退出",
        type: "warning",
        distinguishCancelAndClose: true,
      }
    );
    handleSaveCustomCharacter();
  } catch (action) {
    if (action === "cancel") closeEditPanel();
  }
};

// 编辑区右上角「编辑」：切换到可编辑状态
const handleEnterEditMode = () => {
  if (props.locked) return;
  editPanelViewOnly.value = false;
};

// 取消编辑：不关闭编辑区，仅切回仅查看状态；有未保存内容时二次确认后丢弃修改
const handleCancelEdit = async () => {
  if (!isEditDirty.value) {
    editPanelViewOnly.value = true;
    return;
  }
  try {
    await ElMessageBox.confirm(
      "您已对内容进行修改，直接退出将会删除修改内容。",
      "编辑的内容还未保存",
      {
        confirmButtonText: "保存",
        cancelButtonText: "直接退出",
        type: "warning",
        distinguishCancelAndClose: true,
      }
    );
    saveCurrentCharacterWithoutClose();
    editPanelViewOnly.value = true;
  } catch (action) {
    if (action === "cancel") {
      customCharacter.value = JSON.parse(initialEditSnapshot.value || "{}");
      editPanelViewOnly.value = true;
    }
  }
};

// 确定：保存并切回仅查看状态，不关闭编辑区
const handleConfirmEditAndView = () => {
  if (!saveCurrentCharacterWithoutClose()) return;
  editPanelViewOnly.value = true;
};

// 删除角色卡片：二次确认后从列表中移除
const handleDeleteCharacter = async (character: ScriptCharacterCardData, index: number) => {
  try {
    await ElMessageBox.confirm(
      `确定删除角色「${character.name || ""}」吗？删除后不可恢复。`,
      "删除角色",
      {
        confirmButtonText: "确定删除",
        cancelButtonText: "取消",
        type: "warning",
      }
    );
  } catch {
    return;
  }
  const idx = characters.value.findIndex((c) => c === character);
  if (idx !== -1) {
    characters.value.splice(idx, 1);
    if (showEditPanel.value && editingCharacterIndex.value === index) {
      // 删除的正是当前选中的卡片：瞬移到下一个非自定义卡片，左侧内容区同步更新
      const withName = characters.value.filter((c) => c.name && c.name.trim());
      if (withName.length === 0) {
        customCharacter.value = { ...EMPTY_SCRIPT_CHARACTER };
        editingCharacterIndex.value = null;
        isCustomMode.value = true;
      } else {
        const nextIndex = Math.min(index, withName.length - 1);
        editingCharacterIndex.value = nextIndex;
        customCharacter.value = { ...withName[nextIndex] };
        isCustomMode.value = false;
      }
      initialEditSnapshot.value = JSON.stringify(customCharacter.value);
      editPanelViewOnly.value = true;
    } else if (showEditPanel.value && editingCharacterIndex.value !== null && editingCharacterIndex.value > index) {
      editingCharacterIndex.value -= 1;
    }
  }
};

// 编辑区内切换角色：有未保存内容时弹二次确认
const handleSwitchCharacterInEdit = async (character: ScriptCharacterCardData | null, index: number) => {
  const isCustom = character === null;
  const isCurrent = isCustom ? isCustomMode.value : editingCharacterIndex.value === index;
  if (isCurrent) return;
  if (isEditDirty.value) {
    try {
      await ElMessageBox.confirm(
        "您已对内容进行修改，直接退出将会删除修改内容。",
        "编辑的内容还未保存",
        {
          confirmButtonText: "保存",
          cancelButtonText: "直接退出",
          type: "warning",
          distinguishCancelAndClose: true,
        }
      );
      if (!saveCurrentCharacterWithoutClose()) return;
    } catch (action) {
      if (action !== "cancel") return;
    }
  }
  if (isCustom) {
    customCharacter.value = { ...EMPTY_SCRIPT_CHARACTER };
    editingCharacterIndex.value = null;
    isCustomMode.value = true;
    editPanelViewOnly.value = false;
  } else {
    customCharacter.value = { ...character };
    editingCharacterIndex.value = index;
    isCustomMode.value = false;
    editPanelViewOnly.value = true;
  }
  initialEditSnapshot.value = JSON.stringify(customCharacter.value);
};

// 确认：剧本多角色全部生效，保存所有生成的卡片
const handleConfirm = () => {
  const generatedCards = characters.value.filter((c) => c.name && c.name.trim() !== "");
  if (generatedCards.length === 0) {
    ElMessage.warning("请先生成或添加角色");
    return;
  }
  const fullData = { generatedCards };
  const characterData = JSON.stringify(fullData);

  if (confirmStampPlaying.value) return;
  confirmStampKey.value += 1;
  confirmStampPlaying.value = true;
  setTimeout(() => {
    emit("confirm", characterData);
    setTimeout(() => {
      confirmStampPlaying.value = false;
    }, 500);
    // 不重置 confirmStampPlaying，避免印章先消失再随 locked 出现造成闪烁；切到下一模块会卸载本组件
  }, CONFIRM_STAMP_ANIMATION_MS);
};

// 回退（带二次确认）
// 处理回退到当前步骤
const handleRevertToCurrent = () => {
  emit("revert-to-current");
};

const handleRevert = async () => {
  console.log("[ScriptCharacterSelector] handleRevert");

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
    console.log("[ScriptCharacterSelector] User cancelled revert");
  }
};

// 从 props 初始化数据（剧本格式：generatedCards 为 ScriptCharacterCardData[]）
const initFromProps = () => {
  if (!props.characterContent) return;
  try {
    const data = JSON.parse(props.characterContent);
    if (Array.isArray(data.generatedCards) && data.generatedCards.length > 0) {
      characters.value = data.generatedCards.map((c: Record<string, unknown>) => ({
        name: String(c.name ?? ""),
        definition: String(c.definition ?? ""),
        age: String(c.age ?? ""),
        personality: String(c.personality ?? ""),
        biography: String(c.biography ?? ""),
        isCustom: !!c.isCustom,
      }));
      selectedCharacterIndex.value = 0;
    } else if (data.name) {
      // 旧格式兼容
      characters.value = [{
        name: String(data.name ?? ""),
        definition: String(data.definition ?? data.identity ?? ""),
        age: String(data.age ?? ""),
        personality: String(data.personality ?? data.mbti ?? ""),
        biography: String(data.biography ?? data.experiences ?? ""),
      }];
      selectedCharacterIndex.value = 0;
    }
  } catch (e) {
    console.error("[ScriptCharacterSelector] Failed to parse characterContent:", e);
  }
};

// 监听props变化
watch(
  () => props.characterContent,
  (newVal, oldVal) => {
    console.log("[ScriptCharacterSelector] characterContent changed:", { newVal, oldVal });

    // 如果内容被清空（从有内容变为空），重置状态
    if (oldVal && !newVal) {
      characters.value = [];
      selectedCharacterIndex.value = null;
      // 移除自动生成逻辑，只通过 triggerGenerate prop 触发
    } else {
      initFromProps();
    }
  },
  { immediate: true }
);

// 监听 triggerGenerate 变化，触发重新生成
watch(
  () => props.triggerGenerate,
  (newVal, oldVal) => {
    // 只有当 triggerGenerate 增加时才触发（避免初始化时触发）
    if (newVal > oldVal && newVal > 0) {
      console.log("[ScriptCharacterSelector] triggerGenerate changed, trigger generate:", {
        newVal,
        oldVal,
      });
      // 检查条件：有故事梗概、有标签、未锁定（不管是否有角色内容都重新生成）
      if (props.storyContent?.trim() && !props.locked) {
        characters.value = [];
        selectedCharacterIndex.value = null;
        setTimeout(() => {
          generateCharacters();
        }, 100);
      } else {
        console.log("[ScriptCharacterSelector] Conditions not met, skip generate");
      }
    }
  }
);

// 卡片容器内正好 2 行：行高 = (容器高度 - 行间距 - margin) / 2
const ROW_GAP = 20;
const GRID_MARGIN_TOP = 5;
const GRID_MARGIN_BOTTOM = 32;
const TOTAL_GAP = ROW_GAP + GRID_MARGIN_TOP + GRID_MARGIN_BOTTOM; // 57
const MIN_ROW_HEIGHT = 220;

// 编辑区右侧 3 行卡片：行高 = (可视高度 - 上下 padding - 2 个行间距) / 3
const EDIT_PANEL_PADDING_V = 12 + 12; // top + bottom
const EDIT_PANEL_ROW_GAP_X2 = 12 * 2; // 两行之间的 gap
const EDIT_PANEL_TOTAL_GAP = EDIT_PANEL_PADDING_V + EDIT_PANEL_ROW_GAP_X2; // 48
let editPanelResizeObserver: ResizeObserver | null = null;
function updateEditPanelCardRowHeight() {
  const el = editPanelCardListRef.value;
  if (!el || !showEditPanel.value) return;
  const h = el.clientHeight;
  if (h <= 0) return;
  const rowHeight = Math.max(100, (h - EDIT_PANEL_TOTAL_GAP) / 3);
  editPanelCardRowHeightPx.value = `${Math.round(rowHeight)}px`;
}

function updateScriptCardRowHeight() {
  const el = characterScrollWrapRef.value;
  if (!el) return;
  const h = el.clientHeight;
  if (h <= 0) return;
  const rowHeight = Math.max(MIN_ROW_HEIGHT, (h - TOTAL_GAP) / 2);
  scriptCardRowHeightPx.value = `${Math.round(rowHeight)}px`;
}

let resizeObserver: ResizeObserver | null = null;

// 组件挂载后，不自动生成，等待用户手动触发；并监听卡片容器高度以动态计算行高
onMounted(() => {
  const el = characterScrollWrapRef.value;
  if (el) {
    nextTick(() => updateScriptCardRowHeight());
    resizeObserver = new ResizeObserver(() => updateScriptCardRowHeight());
    resizeObserver.observe(el);
  }
});

onUnmounted(() => {
  if (resizeObserver && characterScrollWrapRef.value) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (editPanelResizeObserver && editPanelCardListRef.value) {
    editPanelResizeObserver.disconnect();
    editPanelResizeObserver = null;
  }
});

watch(showEditPanel, async (visible) => {
  if (!visible) {
    if (editPanelResizeObserver && editPanelCardListRef.value) {
      editPanelResizeObserver.disconnect();
      editPanelResizeObserver = null;
    }
    return;
  }
  await nextTick();
  const el = editPanelCardListRef.value;
  if (el) {
    updateEditPanelCardRowHeight();
    editPanelResizeObserver = new ResizeObserver(updateEditPanelCardRowHeight);
    editPanelResizeObserver.observe(el);
  }
});
</script>

<template>
  <div class="quick-character-selector">
    <!-- 角色选择区域 -->
    <div class="character-select-layout" :class="{ 'edit-mode': showEditPanel }">
      <!-- 回退按钮：始终显示 -->
      <!-- <div class="header-actions">
        <el-button class="revert-btn" @click="handleRevert"> 回退至选择故事梗概 </el-button>
        <div class="header-divider"></div>
      </div> -->

      <!-- 标题 + 重新生成（右上，与故事梗概一致） -->
      <div class="section-header">
        <div class="section-title">请确认角色设定</div>
        <el-button
          v-if="!locked && !showEditPanel"
          link
          type="info"
          class="regenerate-btn"
          :disabled="loading"
          @click="generateCharacters"
        >
          <span class="iconfont refresh-icon">&#xe66f;</span>
          <span>重新生成</span>
        </el-button>
      </div>

      <!-- 卡片和编辑区容器 -->
      <div class="card-edit-container">
        <div class="character-edit-container" ref="characterGridRef">
          <!-- 滚动层：高度由父容器决定，行高通过 ResizeObserver 动态设为 (容器高度 - 间距) / 2 -->
          <div
            ref="characterScrollWrapRef"
            class="character-scroll-wrap"
            :style="{ '--script-card-row-height': scriptCardRowHeightPx }"
          >
            <div class="character-grid" :class="{ 'edit-mode': showEditPanel }">
            <!-- 生成中：固定展示 2 行×5 个骨架卡，尺寸与正式卡片一致 -->
            <template v-if="loading">
              <div v-for="i in 10" :key="'skeleton-' + i" class="character-card-wrapper">
                <ScriptCharacterCard :loading="true" />
              </div>
            </template>
            <template v-else>
              <div v-for="(character, index) in displayCharacters"
                :key="character ? character.name + index : 'custom-' + index"
                class="character-card-wrapper" :class="{ 'custom-wrapper': !character }">
                <ScriptCharacterCard v-if="character" :data="character"
                  :show-delete="!!(!locked && character.name)"
                  :show-edit="!!(!locked && character.name && !showEditPanel)" :loading="false"
                  :is-selected="false"
                  @click="(e?: MouseEvent) => handleEditCharacter(character, index, e)"
                  @edit="(e: MouseEvent) => handleEditCharacter(character, index, e)"
                  @delete="() => handleDeleteCharacter(character, index)" />
                <ScriptCharacterCard v-else :is-custom="true"
                  @click="(e?: MouseEvent) => e && handleShowCustomDialog(e)" />
              </div>
            </template>
            </div>
          </div>
        </div>
        <!-- 内联编辑区：白底，左表单 + 右侧角色卡片列表 -->
        <Transition name="edit-panel">
          <div v-if="showEditPanel" class="edit-panel" :style="editPanelStyle" :class="{ animating: isAnimating }">
            <div class="edit-panel-content edit-panel-layout">
              <!-- 左侧：查看/编辑 -->
              <div class="edit-panel-left">
                <div class="edit-panel-header">

                  <button v-if="!locked && editPanelViewOnly" type="button" class="edit-panel-header-btn" @click="handleEnterEditMode">
                    <img :src="EditIcon" alt="" class="edit-panel-header-icon" />
                    编辑
                  </button>
                  <button type="button" class="edit-panel-header-btn" @click="handleReturnFromEdit">
                    <img :src="CloseIcon" alt="" class="edit-panel-header-icon" />
                    返回
                  </button>
                </div>
                <div class="character-gender-image-float">
                  <img :src="MALE" alt="" />
                </div>
                <!-- 仅查看：纯展示，无表单项、无字数、无下拉图标，支持换行 -->
                <div v-if="editPanelViewOnly" class="edit-form edit-form-view-only">
                  <div class="form-group form-group-name">
                    <label class="form-label">姓名：</label>
                    <div class="form-value">{{ customCharacter.name || "—" }}</div>
                  </div>
                  <div class="form-group form-group-definition">
                    <label class="form-label">定位：</label>
                    <div class="form-value">{{ customCharacter.definition || "—" }}</div>
                  </div>
                  <div class="form-group form-group-gender">
                    <label class="form-label">年龄：</label>
                    <div class="form-value">{{ customCharacter.age || "—" }}</div>
                  </div>
                  <div class="form-group form-group-tags">
                    <label class="form-label">人物标签：</label>
                    <div class="form-value form-value-tags">{{ customCharacter.personality || "—" }}</div>
                  </div>
                  <div class="form-group form-group-bio">
                    <label class="form-label">人物小传：</label>
                    <div class="form-value form-value-bio">{{ customCharacter.biography || "—" }}</div>
                  </div>
                </div>
                <!-- 可编辑：表单项 + 底部按钮 -->
                <div v-else class="edit-form">
                  <div class="form-group form-group-name">
                    <label class="form-label">姓名：</label>
                    <div class="form-input-wrapper form-input-wrapper-name">
                      <el-input v-model="customCharacter.name" placeholder="请填入" :maxlength="MAX_NAME_LENGTH"
                        class="form-input" />
                      <span class="word-count">{{ (customCharacter.name || "").length }}/{{ MAX_NAME_LENGTH }}</span>
                    </div>
                  </div>
                  <div class="form-group form-group-definition">
                    <label class="form-label">定位：</label>
                    <div class="form-input-wrapper form-input-wrapper-definition">
                      <el-select v-model="customCharacter.definition" placeholder="请选择" class="form-select">
                        <el-option v-for="opt in DEFINITION_OPTIONS" :key="opt" :label="opt" :value="opt" />
                      </el-select>
                    </div>
                  </div>
                  <div class="form-group form-group-gender">
                    <label class="form-label">年龄：</label>
                    <div class="form-input-wrapper form-input-wrapper-gender">
                      <el-input v-model="customCharacter.age" placeholder="如：19岁" :maxlength="20" class="form-input" />
                    </div>
                  </div>
                  <div class="form-group form-group-tags">
                    <label class="form-label">人物标签：</label>
                    <div class="form-input-wrapper form-input-wrapper-tags">
                      <el-input v-model="customCharacter.personality" placeholder="如：ISFP、内敛（按、分割）"
                        :maxlength="MAX_PERSONALITY_LENGTH" class="form-input" />
                      <span class="word-count">{{ (customCharacter.personality || "").length }}/{{ MAX_PERSONALITY_LENGTH }}</span>
                    </div>
                  </div>
                  <div class="form-group form-group-bio">
                    <label class="form-label">人物小传：</label>
                    <div class="form-input-wrapper form-input-wrapper-bio">
                      <el-input v-model="customCharacter.biography" type="textarea" placeholder="填写角色的背景，过往经历、重要事件等"
                        :maxlength="MAX_EXPERIENCE_LENGTH" :rows="6" class="form-textarea" />
                      <span class="word-count word-count-bio">{{ (customCharacter.biography || "").length }}/{{ MAX_EXPERIENCE_LENGTH }}</span>
                    </div>
                  </div>
                  <div class="edit-actions">
                    <el-button class="cancel-btn" @click="handleCancelEdit">取消</el-button>
                    <el-button class="confirm-btn" @click="handleConfirmEditAndView">确定</el-button>
                  </div>
                </div>
              </div>

              <!-- 右侧：角色卡片列表（2 列，3 行可见，当前编辑项高亮边框） -->
              <div ref="editPanelCardListRef" class="edit-panel-right" :style="{ '--edit-card-row-height': editPanelCardRowHeightPx }">
                <div class="edit-panel-card-grid">
                  <template v-for="(item, idx) in displayCharacters" :key="item ? item.name + idx : 'custom-' + idx">
                    <div class="edit-panel-card-wrap" :class="{ 'is-selected': item ? editingCharacterIndex === idx : isCustomMode }">
                      <ScriptCharacterCard
                        v-if="item"
                        :data="item"
                        :show-edit="false"
                        :show-delete="!locked && !!item?.name"
                        :compact-tags="true"
                        :is-selected="editingCharacterIndex === idx"
                        @click="handleSwitchCharacterInEdit(item, idx)"
                        @delete="() => handleDeleteCharacter(item, idx)"
                      />
                      <ScriptCharacterCard
                        v-else
                        :is-custom="true"
                        @click="handleSwitchCharacterInEdit(null, idx)"
                      />
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </Transition>
        <!-- 内容区右下角：确认中播 GIF，已锁定时展示静态「已定稿」章 -->
        <!-- 内容区右下角：确认中播盖章下落动画（静态图），已锁定时展示静态「已定稿」章 -->
        <div v-if="locked || confirmStampPlaying" class="confirm-stamp-wrap">
          <img
            v-if="confirmStampPlaying"
            :key="'stamp-' + confirmStampKey"
            :src="confirmScPng"
            alt=""
            class="confirm-stamp-img stamp-drop"
          />
          <img v-else-if="locked" :src="confirmScPng" alt="" class="confirm-stamp-img" />
        </div>
      </div>
    </div>

    <!-- 底部操作区 -->
    <div v-if="!showEditPanel" class="footer-actions">
      <el-button v-if="!locked" type="primary" class="confirm-btn" :disabled="!canGoNext || confirmStampPlaying"
        @click="handleConfirm">
        下一步
      </el-button>
    </div>

    <!-- 底部回退按钮 -->
    <div v-if="hasNextContent" class="bottom-revert-section">
      <el-button class="revert-btn-bottom" @click="handleRevertToCurrent">
        回退至选择角色
      </el-button>
    </div>
  </div>
</template>

<style scoped lang="less">
.quick-character-selector {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
  padding: 50px 260px 50px 0px;
  box-sizing: border-box;
}

.character-select-layout {
  overflow: hidden; // 外层容器不滚动
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  position: relative;

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

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 40px;
    flex-shrink: 0;
  }

  .section-title {
    font-size: 24px;
    font-weight: 400;
    line-height: 1.32em;
    color: #000000;
  }

  .regenerate-btn {
    padding: 6px 0;
    font-size: 14px;
    color: var(--text-tertiary);
    .refresh-icon {
      margin-right: 4px;
    }
    &:hover:not(:disabled) {
      color: var(--bg-editor-save);
    }
  }

  .card-edit-container {
    position: relative;
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .confirm-stamp-wrap {
    position: absolute;
    right: 120px;
    bottom: 100px;
    z-index: 10;
    pointer-events: none;
    overflow: visible;
  }

  .confirm-stamp-img {
    display: block;
    width: 240px;
    height: auto;

    &.stamp-drop {
      animation: stamp-drop 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
  }

  @keyframes stamp-drop {
    0% {
      transform: translateY(-140%) scale(1.5);
      opacity: 0.9;
    }
    75% {
      transform: translateY(2%) scale(1.02);
      opacity: 1;
    }
    100% {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
  }

  .character-edit-container {
    position: relative;
    padding: 5px 2px 2px 2px;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  // 滚动层：占满剩余高度，行高由 JS 根据本容器高度计算 (高度 - 间距) / 2，保证正好 2 行
  .character-scroll-wrap {
    padding: 0 5px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.15);
      border-radius: 4px;

      &:hover {
        background: rgba(0, 0, 0, 0.3);
      }
    }
  }

  // 编辑模式时禁用滚动
  &.edit-mode {
    .character-scroll-wrap {
      overflow: hidden;
    }
  }
}

.character-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  grid-auto-rows: var(--script-card-row-height);
  gap: 20px 16px;
  margin-bottom: 32px;
  margin-top: 5px;
  position: relative;
  min-height: min-content;

  &.edit-mode {
    opacity: 0.3;
    pointer-events: none;
  }

  .character-card-wrapper,
  .custom-wrapper {
    min-height: 0;
    min-width: 0;
    height: var(--script-card-row-height);

    &:hover:not(.disabled) {
      :deep(.quick-character-card) {
        outline: 2px solid var(--theme-color);
      }
    }

    &.selected {
      :deep(.quick-character-card) {
        outline: 2px solid var(--theme-color);
      }
    }
  }

  .custom-wrapper.disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
}

// 编辑面板动画
.edit-panel-enter-active,
.edit-panel-leave-active {
  transition: all 0.6s ease;
}

.edit-panel-enter-from,
.edit-panel-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

.edit-panel {
  position: absolute;
  background: #ffffff; /* 整个容器白底 */
  // border: 2px solid rgba(255, 149, 0, 1);
  border-radius: 10px;
  z-index: 100;
  overflow: hidden;
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;

  &.animating {
    transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .edit-panel-content {
    position: relative;
    height: 100%;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    overflow: hidden;
  }

  /* 左右分栏：左表单占剩余宽度，右侧卡片列表固定宽度；留出内边距使圆角边框完整显示 */
  .edit-panel-layout {
    flex-direction: row;
    height: 100%;
    min-height: 0;
    padding: 8px;
    box-sizing: border-box;
  }

  /* 左侧：表单区域，与之前表单一致有背景色，占据剩余宽度 */
  .edit-panel-left {
    flex: 1;
    min-width: 0;
    height: 100%;
    border-radius: 8px;
    border: 2px solid rgba(255, 149, 0, 1);
    padding: 30px 40px 20px 50px;
    position: relative;
    overflow-y: auto;
    overflow-x: hidden;
    background: #fff8e5; /* 与主流程表单一致的背景色 */
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }

  .edit-panel-header {
    position: sticky;
    top: 0;
    right: 0;
    margin-left: auto;
    // margin-bottom: 20px;
    transform: translate(25px, -25px);
    margin-top: -20px;
    display: flex;
    align-items: center;
    gap: 16px;
    z-index: 2;
  }

  .edit-panel-header-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    font-size: 14px;
    color: #999999;
    background: none;
    border: none;
    cursor: pointer;
    transition: color 0.2s;
  }

  .edit-panel-header-btn:hover {
    color: var(--bg-editor-save, rgba(239, 175, 0, 1));
  }

  .edit-panel-header-icon {
    width: 16px;
    height: 16px;
    object-fit: contain;
  }

  .edit-panel-left {
    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.05);
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 3px;

      &:hover {
        background: rgba(0, 0, 0, 0.3);
      }
    }
  }

  /* 右侧：角色卡片列表，固定宽度，2 列，容器内正好 3 行再滚动 */
  .edit-panel-right {
    flex: 0 0 380px;
    width: 380px;
    height: 100%;
    min-height: 0;
    padding: 12px 16px 12px 12px;
    overflow-y: auto;
    overflow-x: hidden;
    background: #ffffff;
    border-left: 1px solid rgba(0, 0, 0, 0.06);
    border-radius: 8px;

    /* 编辑区卡片标签整体调小，多展示内容 */
    :deep(.row-tags .tags-inner) {
      gap: 3px;
    }
    :deep(.row-tags .character-tag) {
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 14px;
    }

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.15);
      border-radius: 4px;
    }
  }

  .edit-panel-card-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-auto-rows: var(--edit-card-row-height, 200px);
    gap: 12px;
    min-height: min-content;
  }

  .edit-panel-card-wrap {
    min-height: 0;
    min-width: 0;
    height: var(--edit-card-row-height, 200px);

    /* 使用 box-shadow 贴合卡片圆角，避免 outline 直角 */
    &.is-selected {
      :deep(.quick-character-card) {
        outline: none;
        box-shadow: 0 0 0 2px var(--theme-color);
      }
    }
  }

    // 性别图片：悬浮在左下角
    .character-gender-image-float {
      position: absolute;
      right: 0;
      bottom: 0;
      width: 346px;
      height: 365px;
      pointer-events: none;
      z-index: 0;
      // opacity: 0.1;

      img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
    }

    .edit-form {
      display: flex;
      flex-direction: column;
      gap: 22px;
      position: relative;
      z-index: 1;
      flex: 0 0 auto; // 与故事梗概编辑区保持一致，不压缩，根据内容自适应高度
      min-height: min-content; // 最小高度为内容高度
      overflow: visible;

      /* 仅查看态前三行：与编辑态前三行框宽一致（327px） */
      &.edit-form-view-only .form-group-name .form-value,
      &.edit-form-view-only .form-group-definition .form-value,
      &.edit-form-view-only .form-group-gender .form-value {
        flex: 1 1 auto;
        min-width: 0;
        max-width: 327px;
        width: min(327px, 100%);
      }

      .edit-title-large {
        font-size: 30px;
        font-weight: 400;
        line-height: 1.32em;
        letter-spacing: 0.04em;
        color: #464646;
        text-align: center;
        margin-bottom: 20px;
      }

      .form-group {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        gap: 50px;
        flex-shrink: 0;

        .form-label {
          flex-shrink: 0;
          width: 124px; // 统一标签宽度，确保输入框对齐
          font-size: 24px;
          font-weight: 400;
          line-height: 1.32em;
          letter-spacing: 0.04em;
          color: #464646;
          padding-top: 15px;
          white-space: nowrap; // 不换行
        }

        /* 仅查看态：与编辑态输入框同款“框”（无边框、同背景、同圆角、单行高度一致） */
        .form-value {
          flex: 1;
          min-width: 0;
          font-size: 24px;
          font-weight: 400;
          line-height: 1.32em;
          letter-spacing: 0.04em;
          color: #464646;
          word-break: break-word;
          background: rgba(255, 245, 205, 0.5);
          border: none;
          border-radius: 10px;
          padding: 13px 32px;
          min-height: 58.77px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
        }

        /* 人物标签：第四行宽度保持当前（不限制 327px），允许换行展示 */
        .form-value-tags {
          white-space: normal;
          word-break: break-word;
          align-items: flex-start;
          min-height: 58.77px;
          padding-top: 13px;
          padding-bottom: 13px;
        }

        .form-value-bio {
          white-space: pre-wrap;
          word-break: break-word;
          align-items: flex-start;
          padding: 15px 32px;
          min-height: 150px;
          line-height: 1.5em;
        }

        .form-input-wrapper {
          position: relative;

          .form-input,
          .form-select,
          .form-textarea {
            :deep(.el-input__wrapper) {
              background: rgba(255, 245, 205, 0.5);
              border: none;
              border-radius: 10px;
              padding: 13px 32px;
              padding-right: 100px; // 预留字数提示空间
              min-height: 58.77px;
            }

            :deep(.el-select__selected-item) {
              color: #464646 !important;
            }

            :deep(.el-input__inner) {
              font-size: 24px;
              font-weight: 400;
              line-height: 1.32em;
              letter-spacing: 0.04em;
              color: #464646;
              background: transparent;
              width: 100%;

              &::placeholder {
                color: #999999;
              }
            }

            :deep(.el-textarea__inner) {
              font-size: 24px;
              font-weight: 400;
              line-height: 1.5em;
              letter-spacing: 0.04em;
              color: #464646;
              background: rgba(255, 245, 205, 0.5);
              border: none;
              border-radius: 10px;
              padding: 15px 32px;
              padding-right: 100px; // 预留字数提示空间
              height: 100%;
              width: 100%;
              resize: none;
              box-sizing: border-box;

              &::placeholder {
                color: #999999;
              }
            }

            :deep(.el-select__wrapper) {
              background: rgba(255, 245, 205, 0.5);
              border: none;
              border-radius: 10px;
              padding: 13px 32px;
              min-height: 58.77px;
            }

            :deep(.el-select__selected-item) {
              font-size: 24px;
              font-weight: 400;
              line-height: 1.32em;
              letter-spacing: 0.04em;
              color: #464646;
            }

            :deep(.el-select__placeholder) {
              font-size: 24px;
              font-weight: 400;
              line-height: 1.32em;
              letter-spacing: 0.04em;
              color: #999999;
            }

            :deep(.el-select__caret) {
              color: #464646;
            }
          }

          .word-count {
            position: absolute;
            right: 16px;
            top: 16px;
            font-size: 24px;
            font-weight: 400;
            line-height: 1.32em;
            color: #9a9a9a;
            pointer-events: none;
            white-space: nowrap;
          }

          .word-count-bio {
            top: auto;
            bottom: 16px;
          }
        }

        // 输入框统一对齐：所有输入框从同一位置开始
        .form-input-wrapper {
          flex: 1;
          min-width: 0;
        }

        // 姓名、定位、年龄输入框：宽度一致，随窗口缩小自适应
        &.form-group-name,
        &.form-group-definition,
        &.form-group-gender {
          .form-input-wrapper {
            flex: 1 1 auto;
            min-width: 0;
            max-width: 327px;
            width: min(327px, 100%);
          }
        }

        // 人物小传输入框：限制高度，但与其他输入框左对齐
        // 注意：form-group-bio 本身保持 flex-direction: row（继承自 .form-group）
        // 只有内部的输入框容器需要 column 布局来让 textarea 垂直填充
        &.form-group-bio {
          flex-shrink: 0; // 不占据所有剩余空间
          // 不设置 flex-direction，继承父级的 row

          .form-input-wrapper-bio {
            flex: 1;
            min-height: 0;
            display: flex;
            flex-direction: column; // 只有这里需要 column，让 textarea 垂直填充
            max-height: 160px; // 限制最大高度

            .form-textarea {
              flex: 1;
              min-height: 0;
              display: flex;
              flex-direction: column;
              width: 100%;

              :deep(.el-textarea__inner) {
                height: 100%;
                min-height: 150px; // 设置最小高度
                max-height: 200px; // 限制最大高度
                width: 100%;
                overflow-y: auto; // 内容超出时显示滚动条
              }
            }
          }
        }
      }

      .edit-actions {
        display: flex;
        justify-content: center;
        gap: 25px;
        margin-top: clamp(15px, 3vh, 20px); // 顶部间距，确保与表单内容有足够距离
        margin-bottom: 15px;
        flex-shrink: 0; // 不允许压缩，确保按钮始终可见
        min-height: 52px; // 确保按钮高度
        position: relative;
        z-index: 10; // 确保按钮在输入框之上

        .cancel-btn {
          width: 130.91px;
          height: 52px;
          border: 2px solid #9a9a9a;
          border-radius: 10px;
          background: transparent;
          font-size: 24px;
          font-weight: 400;
          line-height: 1.32em;
          color: #464646;

          &:hover {
            border-color: var(--bg-editor-save);
            color: var(--bg-editor-save);
          }
        }

        .confirm-btn {
          width: 129px;
          height: 52px;
          border-radius: 10px;
          background: linear-gradient(90deg, rgba(239, 175, 0, 1) 0%, rgba(255, 149, 0, 1) 100%);
          border: none;
          font-size: 24px;
          font-weight: 700;
          line-height: 1.32em;
          color: #ffffff;

          &:hover {
            opacity: 0.9;
          }
        }
      }
    }
}

.regenerate-btn .refresh-icon {
  font-size: 20px;
  width: 20px;
  height: 20px;
  margin-right: 6px;
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  // padding: 20px 0px;
  flex-shrink: 0;

  .confirm-btn {
    width: 221px;
    height: 52px;
    padding: 0;
    border-radius: 10px;
    font-size: 28px;
    font-weight: 700;
    line-height: 1.32em;
    color: #ffffff;
    background: linear-gradient(90deg, rgba(239, 175, 0, 1) 0%, rgba(255, 149, 0, 1) 100%);
    border: none;

    &:hover:not(:disabled) {
      opacity: 0.9;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

.bottom-revert-section {
  display: flex;
  justify-content: flex-end;
  // padding: 20px 40px;
  // background: var(--bg-secondary);
  flex-shrink: 0;

  .revert-btn-bottom {
    width: 261px;
    height: 52px;
    padding: 7px 0px;
    border-radius: 10px;
    font-size: 28px;
    font-weight: 400;
    line-height: 1.32em;
    color: #999999;
    background: transparent;
    border: 2px solid #999999;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      color: var(--bg-editor-save);
      border-color: var(--bg-editor-save);
    }
  }
}

.custom-character-dialog {
  :deep(.el-dialog__body) {
    padding: 20px 30px;
  }

  .custom-form {
    .form-row {
      display: flex;
      align-items: flex-start;
      margin-bottom: 20px;

      &:last-child {
        margin-bottom: 0;
      }

      .form-label {
        width: 100px;
        flex-shrink: 0;
        padding-top: 8px;
        font-size: 14px;
        color: var(--text-primary);
        font-weight: 500;

        &.gender-label {
          width: 60px;
          margin-left: 20px;
        }

        &.age-label {
          width: 60px;
          margin-left: 20px;
        }

        &.mbti-label {
          width: 70px;
          margin-left: 20px;
        }
      }

      .form-input,
      .form-textarea,
      .form-select {
        flex: 1;
        background: #f9eece;
        border-radius: 4px;

        &.name-input {
          max-width: 180px;
        }

        &.age-input {
          max-width: 120px;
        }

        :deep(.el-input__inner),
        :deep(.el-textarea__inner) {
          background: #f9eece !important;
          border: none;
        }

        :deep(.el-input__count),
        :deep(.el-input__suffix),
        :deep(.el-input__prefix),
        :deep(.el-input__wrapper) {
          background: #f9eece !important;
        }

        :deep(.el-input__count-inner) {
          background: #f9eece !important;
        }
      }

      .form-select {
        flex: none;

        &.gender-select {
          width: 120px;
        }

        &.mbti-select {
          width: 150px;
        }

        &:not(.gender-select):not(.mbti-select) {
          width: 150px;
        }

        // 覆盖所有 Element Plus Select 的背景色
        :deep(.el-select__wrapper) {
          background: #f9eece !important;
        }

        :deep(.el-input__wrapper) {
          background: #f9eece !important;
        }

        :deep(.el-input__inner) {
          background: #f9eece !important;
        }
      }
    }
  }

  .dialog-footer {
    display: flex;
    justify-content: center;
    gap: 12px;
  }

  :deep(.el-button--primary) {
    background-color: var(--bg-editor-save);
    border-color: var(--bg-editor-save);

    &:hover {
      background-color: var(--bg-editor-save);
      border-color: var(--bg-editor-save);
      opacity: 0.8;
    }
  }
}
</style>
