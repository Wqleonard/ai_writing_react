<script setup lang="ts">
import { ref, watch, computed, onMounted, nextTick } from "vue";
import { ElButton, ElMessage, ElInput, ElSkeleton } from "element-plus";
import type { ScriptStorySynopsisResult } from "@/vue/utils/interfaces";

// 图标导入
import titleIcon from "@/assets/images/quick_creation/script_story_title.svg";
import synopsisIcon from "@/assets/images/quick_creation/script_story_ synopsis.svg";
import backgroundIcon from "@/assets/images/quick_creation/script_story_background.svg";
import highlightIcon from "@/assets/images/quick_creation/script_story_highlight.svg";
import informationGapIcon from "@/assets/images/quick_creation/script_story_informationGap.svg";
import { getScriptStorySynopsisReq } from "@/api/generate-quick";
import confirmScPng from "@/assets/images/quick_creation/confirm_sc.png";

interface Props {
  novelPlot?: string; // 小说纲章内容
  description?: string; // 一句话梗概
  storyContent?: string; // 从serverData读取的故事内容（JSON字符串）
  locked?: boolean; // 是否锁定（不可编辑）
  hasNextContent?: boolean; // 后面是否有内容
  triggerGenerate?: number; // 触发生成的标志（当值增加时触发生成）
}

interface Emits {
  (e: "confirm", storyData: string, title: string): void; // 确认时传递故事数据（JSON字符串）
  (e: "revert"): void; // 回退到上一步
  (e: "revert-to-current"): void; // 回退到当前步骤
  (e: "error-and-revert", targetDir: string): void; // 错误时回退到指定目录
}

const props = withDefaults(defineProps<Props>(), {
  novelPlot: "",
  description: "",
  storyContent: "",
  locked: false,
  triggerGenerate: 0,
});

const emit = defineEmits<Emits>();

// 标签类型：固定 + 自定义槽位（最多3个）
type TabType = "original" | "inspiration1" | "inspiration2" | "custom1" | "custom2" | "custom3";

// const FIXED_TAB_IDS: TabType[] = ["original", "inspiration1", "inspiration2"];
const CUSTOM_TAB_IDS: TabType[] = ["custom1", "custom2", "custom3"];
const MAX_CUSTOM_TABS = 3;

// 当前启用的自定义槽位数量（0~3）
const customTabCount = ref(0);

// 计算标签列表：固定三项 + 已启用的自定义 + “自定义+”（未满3个时显示）
const tabs = computed(() => {
  const list: { id: TabType | "customAdd"; label: string }[] = [
    { id: "original", label: "小说原版" },
    { id: "inspiration1", label: "灵感版1" },
    { id: "inspiration2", label: "灵感版2" },
  ];
  for (let i = 0; i < customTabCount.value; i++) {
    list.push({ id: CUSTOM_TAB_IDS[i], label: `自定义${i + 1}` });
  }
  if (customTabCount.value < MAX_CUSTOM_TABS) {
    list.push({ id: "customAdd", label: "自定义+" });
  }
  return list;
});

// 当前选中的标签（不含 customAdd）
const activeTab = ref<TabType>("original");

// 当前标签是否可编辑：锁定后都不可编辑；未锁定时「小说原版」也不可编辑，仅灵感版/自定义可编辑
const isCurrentTabEditable = computed(() => !props.locked && activeTab.value !== "original");

// 空白卡片数据
const emptyCard = (): ScriptStorySynopsisResult => ({
  title: "",
  synopsis: "",
  background: "",
  highlight: "",
  informationGap: "",
});

// 卡片数据：固定 + 最多3个自定义
const cards = ref<Record<TabType, ScriptStorySynopsisResult>>({
  original: emptyCard(),
  inspiration1: emptyCard(),
  inspiration2: emptyCard(),
  custom1: emptyCard(),
  custom2: emptyCard(),
  custom3: emptyCard(),
});

// 加载状态
const loading = ref(false);

// 当前选中的填写条索引（用于控制动画）
const activeFieldIndex = ref<number | null>(null);

// 字数限制
const MAX_TITLE_LENGTH = 20;
const MAX_OTHER_LENGTH = 300;

// 确认印章：未锁定时点击确认先播「盖章」下落动画（静态图），播完再切模块；已锁定时展示静态图
const CONFIRM_STAMP_ANIMATION_MS = 600; // 动画时长约 0.6s + 短暂停留后切模块
const confirmStampPlaying = ref(false);
const confirmStampKey = ref(0);

// 填写条配置
const fields = [
  { key: "title" as keyof ScriptStorySynopsisResult, label: "剧名", required: true, maxLength: MAX_TITLE_LENGTH, icon: titleIcon },
  { key: "synopsis" as keyof ScriptStorySynopsisResult, label: "故事梗概", required: true, maxLength: MAX_OTHER_LENGTH, icon: synopsisIcon },
  { key: "background" as keyof ScriptStorySynopsisResult, label: "故事背景", required: true, maxLength: MAX_OTHER_LENGTH, icon: backgroundIcon },
  { key: "highlight" as keyof ScriptStorySynopsisResult, label: "核心亮点", required: false, maxLength: MAX_OTHER_LENGTH, icon: highlightIcon },
  { key: "informationGap" as keyof ScriptStorySynopsisResult, label: "信息差", required: false, maxLength: MAX_OTHER_LENGTH, icon: informationGapIcon },
];

// 用户已确认选中的标签（从 storyContent 解析，用于在标题右侧显示 * 区分）
const userSelectedTab = computed((): TabType | null => {
  if (!props.storyContent) return null;
  try {
    const data = JSON.parse(props.storyContent);
    const tab = data?.selectedTab;
    if (tab && tab !== "customAdd" && (tabs.value.some((t) => t.id === tab))) return tab as TabType;
  } catch (_e) {
    // ignore
  }
  return null;
});

// 当前卡片数据
const currentCard = computed(() => cards.value[activeTab.value]);

// 检查必填项是否已填写
const isFormValid = computed(() => {
  const card = currentCard.value;
  return (
    card.title?.trim() !== "" &&
    card.synopsis?.trim() !== "" &&
    card.background?.trim() !== ""
  );
});

// 生成故事梗概：接口调用三次——第一次只传 novelPlot（小说原版），第二、三次传 novelPlot + description（灵感版1、灵感版2）
const generateStorySynopsis = async () => {
  if (loading.value) {
    console.log("[ScriptStorySelector] Already generating, skip");
    return;
  }

  if (!props.novelPlot) {
    ElMessage.warning("请先完成小说纲章");
    return;
  }

  if (!props.description) {
    ElMessage.warning("请先完成故事标签");
    return;
  }

  loading.value = true;

  try {
    const [resOriginal, resInspiration1, resInspiration2]: ScriptStorySynopsisResult[] = await Promise.all([
      getScriptStorySynopsisReq(props.novelPlot, ""),
      getScriptStorySynopsisReq(props.novelPlot, props.description),
      getScriptStorySynopsisReq(props.novelPlot, props.description),
    ]);

    cards.value.original = {
      title: resOriginal?.title || "",
      synopsis: resOriginal?.synopsis || "",
      background: resOriginal?.background || "",
      highlight: resOriginal?.highlight || "",
      informationGap: resOriginal?.informationGap || "",
    };
    cards.value.inspiration1 = {
      title: resInspiration1?.title || "",
      synopsis: resInspiration1?.synopsis || "",
      background: resInspiration1?.background || "",
      highlight: resInspiration1?.highlight || "",
      informationGap: resInspiration1?.informationGap || "",
    };
    cards.value.inspiration2 = {
      title: resInspiration2?.title || "",
      synopsis: resInspiration2?.synopsis || "",
      background: resInspiration2?.background || "",
      highlight: resInspiration2?.highlight || "",
      informationGap: resInspiration2?.informationGap || "",
    };

    activeTab.value = "original";
  } catch (e) {
    console.error("[ScriptStorySelector] 获取故事梗概失败:", e);
    emit("error-and-revert", "标签.md");
  } finally {
    loading.value = false;
  }
};

// 切换标签（含“自定义+”）：锁定时仍可切换查看，但不可添加自定义标签
const handleTabChange = (tab: TabType | "customAdd") => {
  if (tab === "customAdd") {
    if (props.locked) return;
    if (customTabCount.value >= MAX_CUSTOM_TABS) return;
    customTabCount.value += 1;
    activeTab.value = CUSTOM_TAB_IDS[customTabCount.value - 1];
  } else {
    activeTab.value = tab;
  }
  activeFieldIndex.value = null;
};

// 点击填写条
const handleFieldClick = (index: number) => {
  if (props.locked) return;
  if (!isCurrentTabEditable.value) {
    ElMessage.warning("小说原版不可修改");
    return;
  }
  const wasActive = activeFieldIndex.value === index;
  activeFieldIndex.value = wasActive ? null : index;

  // 如果激活了填写条，等待DOM更新后聚焦输入框
  if (!wasActive) {
    nextTick(() => {
      const inputElement = document.querySelector(`.field-item.active .field-input input, .field-item.active .field-textarea textarea`) as HTMLInputElement | HTMLTextAreaElement;
      if (inputElement) {
        inputElement.focus();
      }
    });
  }
};

// 更新字段值
const updateField = (key: keyof ScriptStorySynopsisResult, value: string) => {
  if (props.locked) return;
  if (!isCurrentTabEditable.value) return;
  cards.value[activeTab.value][key] = value;
};

// 获取字段值
const getFieldValue = (key: keyof ScriptStorySynopsisResult): string => {
  return currentCard.value[key] || "";
};

// 获取字段字符数
const getFieldCharCount = (key: keyof ScriptStorySynopsisResult): number => {
  return (currentCard.value[key] || "").length;
};

// 确认选择
const handleConfirm = () => {
  const card = currentCard.value;

  if (!isFormValid.value) {
    ElMessage.warning("请填写完整的必填项（剧名、故事梗概、故事背景）");
    return;
  }

  // 保存完整数据：选中的卡片 + 所有卡片数据 + 自定义标签数量
  const fullData = {
    selectedTab: activeTab.value,
    selectedData: card,
    allCards: cards.value,
    customTabCount: customTabCount.value,
  };

  const storyData = JSON.stringify(fullData);

  if (confirmStampPlaying.value) return;
  confirmStampKey.value += 1;
  confirmStampPlaying.value = true;
  setTimeout(() => {
    emit("confirm", storyData, card.title || "");
    setTimeout(() => {
      confirmStampPlaying.value = false;
    }, 500);
  }, CONFIRM_STAMP_ANIMATION_MS);
};

// 处理回退到当前步骤
const handleRevertToCurrent = () => {
  emit("revert-to-current");
};

// 从props初始化数据
const initFromProps = () => {
  console.log("[ScriptStorySelector] initFromProps");
  console.log("[ScriptStorySelector] storyContent:", props.storyContent);

  if (props.storyContent) {
    try {
      const data = JSON.parse(props.storyContent);

      // 剧本创作数据格式：包含 selectedTab, selectedData, allCards, customTabCount
      if (data.selectedTab && data.allCards) {
        console.log("[ScriptStorySelector] Loading story data");
        cards.value = { ...cards.value, ...data.allCards };
        activeTab.value = data.selectedTab || "original";
        if (typeof data.customTabCount === "number" && data.customTabCount >= 0 && data.customTabCount <= MAX_CUSTOM_TABS) {
          customTabCount.value = data.customTabCount;
        }
      }

      console.log("[ScriptStorySelector] Loaded story from props:", data);
    } catch (e) {
      console.error("[ScriptStorySelector] Failed to parse storyContent:", e);
    }
  }
};

// 监听props变化
watch(
  () => props.storyContent,
  (newVal, oldVal) => {
    console.log("[ScriptStorySelector] storyContent changed:", { newVal, oldVal });

    if (oldVal && !newVal) {
      console.log("[ScriptStorySelector] Content cleared, reset state");
      Object.keys(cards.value).forEach((key) => {
        cards.value[key as TabType] = emptyCard();
      });
      customTabCount.value = 0;
      activeTab.value = "original";
      activeFieldIndex.value = null;
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
    if (newVal > oldVal && newVal > 0) {
      console.log("[ScriptStorySelector] triggerGenerate changed, trigger generate:", { newVal, oldVal });
      if (props.novelPlot && props.description && !props.locked) {
        console.log("[ScriptStorySelector] Conditions met, auto generate");
        generateStorySynopsis();
      } else {
        console.log("[ScriptStorySelector] Conditions not met, skip generate");
      }
    }
  }
);

onMounted(() => {
  console.log("[ScriptStorySelector] Component mounted");
  initFromProps();
});
</script>

<template>
  <div class="script-story-selector">
    <!-- 标题和重新生成按钮 -->
    <div class="header-section">
      <div class="section-title">请选择满意的故事梗概</div>
      <el-button v-if="!locked" link type="info" class="regenerate-btn" :disabled="loading"
        @click="generateStorySynopsis">
        <span class="iconfont refresh-icon">&#xe66f;</span>
        <span class="regenerate-text">重新生成</span>
      </el-button>
    </div>

    <!-- 主容器无边框，子元素垂直：顶部标签头容器 + 底部表单容器 -->
    <div class="tabs-form-wrapper">
      <!-- 顶部标签头容器：横排 标签、占位、标签、占位…、最后一个标签右侧也有占位、最后占满剩余空间 -->
      <div class="tabs-row">
        <template v-for="(tab, i) in tabs" :key="'tab-' + tab.id">
          <div
            class="tab-item"
            :class="{
              active: activeTab === tab.id,
              'tab-add': tab.id === 'customAdd',
              'tab-first': i === 0
            }"
            @click="handleTabChange(tab.id)"
          >
            <span class="tab-item-content">{{ tab.label }}</span>
          </div>
          <div
            class="tabs-spacer"
            :class="{
              'spacer-left-radius': activeTab === tab.id,
              'spacer-right-radius': i + 1 < tabs.length && activeTab === (tabs[i + 1]?.id),
              'spacer-last': i === tabs.length - 1
            }"
          />
        </template>
        <div class="tabs-fill" />
      </div>

      <!-- 底部表单容器：仅左、右、下边框，无上边框 -->
      <div class="card-section">
        <div class="story-card" :class="{ loading: loading }">
        <!-- 加载状态：骨架屏 -->
        <template v-if="loading">
          <div v-for="i in 5" :key="i" class="field-item skeleton-field">
            <div class="field-icon-skeleton">
              <el-skeleton :rows="0" animated>
                <template #template>
                  <el-skeleton-item variant="rect" style="width: 50px; height: 50px; border-radius: 5px" />
                </template>
              </el-skeleton>
            </div>
            <div class="field-content-skeleton">
              <el-skeleton :rows="1" animated>
                <template #template>
                  <el-skeleton-item variant="text" style="width: 100px; height: 24px; margin-bottom: 5px" />
                  <el-skeleton-item variant="rect" style="width: 100%; height: 24px; border-radius: 5px" />
                </template>
              </el-skeleton>
            </div>
          </div>
        </template>

        <!-- 填写条列表 -->
        <template v-else>
          <div v-for="(field, index) in fields" :key="field.key" class="field-item" :class="{
            active: activeFieldIndex === index,
            required: field.required,
            'has-value': getFieldValue(field.key),
          }" @click="handleFieldClick(index)">
            <!-- 左侧图标 -->
            <div class="field-icon">
              <img :src="field.icon" :alt="field.label" />
            </div>

            <!-- 右侧内容区 -->
            <div class="field-content">
              <!-- 标题 -->
              <div class="field-label">
                {{ field.label }}<span v-if="field.required" class="required-mark">*</span>
              </div>

              <!-- 未选中状态：单行显示，浅灰色，裁剪；hover 显示“编辑” -->
              <div v-if="activeFieldIndex !== index" class="field-preview">
                <div class="field-preview-text" :class="{ 'has-content': getFieldValue(field.key) }">
                  {{ getFieldValue(field.key) || `请输入${field.label}` }}
                </div>
                <div v-if="isCurrentTabEditable && !locked" class="field-edit-hint">
                  <img src="@/assets/images/quick_creation/edit.svg" alt="编辑" class="edit-icon" />
                  <span>编辑</span>
                </div>
              </div>

              <!-- 选中状态：多行输入，黑色，显示字数；失焦后收起 -->
              <div v-else class="field-input-wrapper" @click.stop>
                <el-input v-if="field.key === 'title'" v-model="currentCard[field.key]" :maxlength="field.maxLength"
                  :placeholder="`请输入${field.label}`" class="field-input"
                  @input="(val: string) => updateField(field.key, val)" @click.stop @blur="activeFieldIndex = null" />
                <el-input v-else v-model="currentCard[field.key]" type="textarea" :maxlength="field.maxLength"
                  :placeholder="`请输入${field.label}`" :autosize="{ minRows: 1, maxRows: 3 }" class="field-textarea"
                  @input="(val: string) => updateField(field.key, val)" @click.stop @blur="activeFieldIndex = null" />
                <div class="field-char-count">
                  {{ getFieldCharCount(field.key) }}/{{ field.maxLength }}
                </div>
              </div>
            </div>
          </div>
        </template>
        </div>
      </div>
      <!-- 内容区右下角：确认中播盖章下落动画（静态图），已锁定时展示静态「已定稿」章 -->
      <div v-if="locked || confirmStampPlaying" class="confirm-stamp-wrap">
        <img
          v-if="confirmStampPlaying"
          :key="'stamp-' + confirmStampKey"
          :src="confirmScPng"
          alt=""
          class="confirm-stamp-img stamp-drop"
        />
        <img v-else-if="locked && userSelectedTab != null && activeTab === userSelectedTab" :src="confirmScPng" alt="" class="confirm-stamp-img" />
      </div>
    </div>

    <!-- 底部操作区 -->
    <div v-if="!locked" class="footer-actions">
      <el-button type="primary" class="confirm-btn" :disabled="!isFormValid || confirmStampPlaying" @click="handleConfirm">
        下一步
      </el-button>
    </div>

    <!-- 底部回退按钮 -->
    <div v-if="hasNextContent" class="bottom-revert-section">
      <el-button class="revert-btn-bottom" @click="handleRevertToCurrent">
        回退至故事梗概
      </el-button>
    </div>
  </div>
</template>

<style scoped lang="less">
.script-story-selector {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  padding: 20px 260px 20px 0px;
  box-sizing: border-box;
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
  flex-shrink: 0;

  .section-title {
    font-size: 24px;
    font-weight: 400;
    line-height: 1.32em;
    color: #000000;
  }

  .regenerate-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0;
    font-size: 20px;
    font-weight: 400;
    line-height: 1.32em;
    color: #464646;
    background: transparent;
    border: none;

    &:hover:not(:disabled) {
      color: var(--bg-editor-save);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .refresh-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
      margin-right: 6px;
    }

    .regenerate-text {
      margin-left: 2px;
    }
  }
}

/* 主容器：无边框，子元素垂直分布；背景仅给表单区，顶部标签区无黄底 */
.tabs-form-wrapper {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
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

  /* 盖章动画：从上往下落 + 尺寸从大到小 */
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

/* 顶部标签头容器：无黄色背景，横排 标签、占位、…、最后占满剩余空间 */
.tabs-row {
  display: flex;
  align-items: stretch;
  flex-shrink: 0;
  background: transparent;
}

/* 标签：两个绝对布局层——①上半个占满有上左右+左上右上圆角 ②内容层覆盖展示文字；底边框在标签上 */
.tab-item {
  --tab-border: 2px solid rgba(239, 175, 0, 1);
  position: relative;
  padding: 0;
  font-size: 20px;
  height: 51px;
  font-weight: 400;
  // line-height: 1.32em;
  color: rgba(239, 175, 0, 1);
  background: #ffffff;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  border-top: none;
  border-bottom: var(--tab-border);
  border-left: none;
  border-right: none;
  box-sizing: border-box;

  /* ① 上半个空间：上、左、右边框，左上右上圆角，与标签等宽 */
  &::before {
    content: '';
    position: absolute;
    left: -2px;
    right: -2px;
    top: 0;
    height: 55%;
    border-top: var(--tab-border);
    border-left: var(--tab-border);
    border-right: var(--tab-border);
    border-top-left-radius: 10px;
    border-top-right-radius: 10px;
    background: inherit;
    pointer-events: none;
    box-sizing: border-box;
    z-index: 0;
  }

  &.tab-first::before{
    left: 0;
  }

  /* 最左侧标签：用伪元素补充整高的左侧边框（::before 只覆盖上半部分） */
  &.tab-first::after {
    content: '';
    position: absolute;
    left: 0;
    top: 10px;
    bottom: -5px;
    width: 0;
    border-left: var(--tab-border);
    pointer-events: none;
    z-index: 2;
  }

  /* ② 内容层：覆盖在上方，展示文字 */
  .tab-item-content {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 51px;
    padding: 0px 28px;
    // min-height: 52px;
    box-sizing: border-box;
  }

  &.active {
    font-weight: 700;
    font-size: 24px;
    background: #fff8e5;
    border-bottom-color: transparent; /* 融合：无底边 */
  }

  &:hover:not(.active) {
    opacity: 0.9;
  }

  &.tab-add {
    font-weight: 400;
  }
}

/* 占位：高度为一半、仅占下半部分，绝对定位与标签下半对齐，只画左/右/底边框及底角圆角 */
.tabs-spacer {
  width: 14px;
  flex-shrink: 0;
  align-self: flex-end;
  height: 50%;
  min-height: 0;
  border-top: none;
  border-left: 2px solid rgba(239, 175, 0, 1);
  border-right: 2px solid rgba(239, 175, 0, 1);
  border-bottom: 2px solid rgba(239, 175, 0, 1);
  background: transparent;
  box-sizing: border-box;

  &.spacer-left-radius {
    border-bottom-left-radius: 10px;
  }

  &.spacer-right-radius {
    border-bottom-right-radius: 10px;
  }

  &.spacer-last {
    border-right: none;
  }
}

/* 占满剩余空间：仅底边，无右边（最右侧边框线不要） */
.tabs-fill {
  flex: 1;
  min-width: 0;
  border-bottom: 2px solid rgba(239, 175, 0, 1);
  border-right: none;
  background: transparent;
}

/* 底部表单容器：仅左、右、下边框，无上边框；提供黄色背景 */
.card-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin-bottom: 20px;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  background: #fff8e5;
  padding: 17px;
  border: 2px solid rgba(239, 175, 0, 1);
  border-top: none;
  border-radius: 0 0 10px 10px;

  // 自定义滚动条样式
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

.story-card {
  display: flex;
  flex-direction: column;
  // height: 100%;
  gap: 17px;

  &.loading {
    .skeleton-field {
      display: flex;
      // gap: 30px;
      // padding: 15px;
      // min-height: 90px;
      align-items: flex-start;

      .field-icon-skeleton {
        flex-shrink: 0;
        width: 60px;
      }

      .field-content-skeleton {
        flex: 1;
        min-width: 0;
      }
    }
  }
}

.field-item {
  display: flex;
  gap: 24px;
  padding: 10px 20px;
  align-items: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 12px;
  background: #ffffff;
  box-sizing: border-box;

  &:hover:not(.active) {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  &.active {
    padding: 20px 24px;
    height: 130px;
    align-items: flex-start;
    box-shadow: 0px 20px 40px 0px rgba(0, 0, 0, 0.05);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    /* 用户输入后高度自适应（由 textarea autosize 撑开） */
    height: auto;
  }

  .field-icon {
    flex-shrink: 0;
    width: 45px;
    height: 45px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
  }

  &.active .field-icon {
    width: 60px;
    height: 60px;
  }

  .field-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;

    .field-label {
      font-size: 22px;
      font-weight: 400;
      line-height: 1.32em;
      color: #949494;
      flex-shrink: 0;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

      .required-mark {
        color: #f56c6c;
        margin-left: 2px;
      }
    }
  }

  &.active .field-content .field-label {
    font-size: 24px;
    color: #464646;
  }

  /* 失焦后有内容：标题 #464646，内容单行省略 #C8C8C8 */
  &.has-value:not(.active) .field-content .field-label {
    color: #464646;
  }

  .field-preview {
    min-height: 32px;
    display: flex;
    align-items: center;
    padding-right: 80px;
    position: relative;

    .field-preview-text {
      font-size: 20px;
      font-weight: 400;
      line-height: 1.32em;
      color: #c8c8c8;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      width: 100%;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

      &.has-content {
        color: #c8c8c8;
      }
    }

    .field-edit-hint {
      position: absolute;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 16px;
      color: #c8c8c8;
      letter-spacing: 0.04em;
      opacity: 0;
      transition: opacity 0.2s;

      .edit-icon {
        width: 18px;
        height: 18px;
        object-fit: contain;
      }
    }
  }

  &:hover:not(.active) .field-edit-hint {
    opacity: 1;
  }

  .field-input-wrapper {
    position: relative;
    flex: 1;
    margin-top: 5px; // 与标题的间距

    .field-input {
      :deep(.el-input__wrapper) {
        background: transparent;
        border: none;
        border-radius: 0;
        padding: 0 90px 0 0;
        box-shadow: none;
        height: auto;
        min-height: 40px;

        .el-input__inner {
          font-size: 24px;
          color: #464646;

          &::placeholder {
            color: #c8c8c8;
          }
        }
      }
    }

    .field-textarea {
      :deep(.el-textarea__inner) {
        background: transparent;
        border: none;
        border-radius: 0;
        padding: 0 90px 0 0;
        font-size: 24px;
        color: #464646;
        box-shadow: none;
        min-height: 84px;
        resize: none;
        line-height: 1.32em;
        letter-spacing: 0;

        &::placeholder {
          color: #c8c8c8;
        }
      }
    }

    .field-char-count {
      position: absolute;
      right: 20px;
      top: 0;
      font-size: 24px;
      font-weight: 400;
      line-height: 1.21em;
      color: #c8c8c8;
      pointer-events: none;
      z-index: 1;
    }

    .field-textarea + .field-char-count {
      top: 0;
    }
  }
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 20px 0px;
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
  padding-bottom: 20px;
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
</style>
