<script setup lang="ts">
import { ref, watch, computed, onMounted, nextTick } from "vue";
import { ElButton, ElMessage, ElInput, ElMessageBox } from "element-plus";
import { useEditorStore } from "@/vue/stores/editor.ts";
import { storeToRefs } from "pinia";
import QuickStoryCard, { type QuickStoryCardData } from "./QuickStoryCard.vue";
import { getQuickStoriesReq } from "@/api/generate-quick";

export interface StoryData extends QuickStoryCardData {
  theme: string;
  isCustom?: boolean; // 标记是否为自定义故事
}

interface Props {
  selectedTagIds?: string; // 标签ID字符串（逗号分隔）
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
  selectedTagIds: "",
  storyContent: "",
  locked: false,
  triggerGenerate: 0,
});

const emit = defineEmits<Emits>();

const editorStore = useEditorStore();
const { workInfo } = storeToRefs(editorStore);

// 空数据占位
const EMPTY_STORIES: StoryData[] = [
  { title: "", intro: "", theme: "" },
  { title: "", intro: "", theme: "" },
  { title: "", intro: "", theme: "" },
];

// 故事列表
const stories = ref<StoryData[]>([...EMPTY_STORIES]);
const selectedStoryIndex = ref<number | null>(null);
const loading = ref(false);

// 编辑状态管理
const showEditPanel = ref(false);
const isCustomMode = ref(false); // true: 自定义模式, false: 编辑模式
const customStory = ref<StoryData>({ title: "", intro: "", theme: "" });
const editingStoryIndex = ref<number | null>(null);

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
  bottom: "92px", // 默认底部留出空间
  transformOrigin: "top left",
});
const isAnimating = ref(false);
const storyGridRef = ref<HTMLElement | null>(null);

// 字数限制
const MAX_TITLE_LENGTH = 30;
const MAX_INTRO_LENGTH = 300;

console.log("[QuickStorySelector] Component mounted");

// 检查是否已选中故事
const hasSelectedStory = computed(
  () => selectedStoryIndex.value !== null && !!stories.value[selectedStoryIndex.value]?.title
);

// 显示的故事列表：锁定时只显示有内容的卡片，未锁定时最后一个是自定义卡片（null）
const displayStories = computed(() => {
  if (props.locked) {
    // 锁定状态下，只显示有内容的故事
    return stories.value.filter((story) => story.title);
  }
  // 未锁定状态下，显示所有故事，最后添加null表示自定义卡片
  return [...stories.value, null];
});

// 生成故事列表
const generateStories = async () => {
  if (loading.value) {
    console.log("[QuickStorySelector] Already generating, skip");
    return;
  }
  console.log("[QuickStorySelector] generateStories called");
  console.log("[QuickStorySelector] selectedTagIds:", props.selectedTagIds);

  if (!props.selectedTagIds) {
    ElMessage.warning("请先选择标签");
    return;
  }

  loading.value = true;
  stories.value = [...EMPTY_STORIES];
  selectedStoryIndex.value = null;

  console.log("[QuickStorySelector] Start generating stories...");

  try {
    // 将标签ID字符串转换为数组
    const tagIds = props.selectedTagIds.split(",").filter((id) => id.trim());

    // 获取标签名称用于description（从workInfo的workTags获取）
    const description = workInfo.value?.workTags?.map((tag: any) => tag.name).join(",") || "";

    // 获取标签名称数组，用于显示在卡片上（添加 # 前缀）
    const tagNames = workInfo.value?.workTags?.map((tag: any) => `#${tag.name}`) || [];

    console.log("[QuickStorySelector] tagIds:", tagIds);
    console.log("[QuickStorySelector] description:", description);
    console.log("[QuickStorySelector] tagNames for cards:", tagNames);

    // 注意：这里的API调用参数需要根据实际情况调整
    // 由于现在是先梗概后角色，所以这里的roleCard参数可能需要调整
    // 先传空对象，等后端接口调整
    const res = await getQuickStoriesReq(
      {} as any, // roleCard参数待后端调整
      description,
      tagIds,
      "doc"
    );

    console.log("[QuickStorySelector] API response:", res);

    const theme = res?.theme || "";
    const stormList = Array.isArray(res?.brainStorms) ? res.brainStorms : [];

    // 用 for 循环填充数据，最多3条
    for (let i = 0; i < 3; i++) {
      if (i < stormList.length) {
        const item = stormList[i];
        stories.value[i] = {
          title: item.title || item.name || "",
          intro: item.intro || item.synopsis || item.description || "",
          theme: theme,
          tags: tagNames, // 将标签名称传递给卡片
        };
      }
    }

    console.log("[QuickStorySelector] Generated stories:", stories.value);
  } catch (e) {
    console.error("[QuickStorySelector] 获取故事梗概失败:", e);
    // ElMessage.error("生成故事梗概失败，请重试");
    // 发生错误时，重置为空数据
    stories.value = [...EMPTY_STORIES];
    // 触发错误回退事件，回退到标签选择
    emit("error-and-revert", "标签.md");
  } finally {
    loading.value = false;
    console.log("[QuickStorySelector] Generate stories completed");
  }
};

// 选择故事
const handleSelectStory = (story: StoryData | null, index: number) => {
  if (loading.value || !story || !story.title || props.locked) return;
  console.log("[QuickStorySelector] handleSelectStory:", story);
  selectedStoryIndex.value = index;
};

// 开始编辑故事
const handleEditStory = async (story: StoryData, index: number, event: MouseEvent) => {
  if (props.locked) return;
  console.log("[QuickStorySelector] handleEditStory:", index);
  customStory.value = { ...story };
  editingStoryIndex.value = index;
  isCustomMode.value = false;

  // 获取点击位置（可能是编辑按钮或卡片本身）
  const target = (event.currentTarget as HTMLElement).closest(".story-card-wrapper") as HTMLElement;
  if (target) {
    await animateFromCard(target);
  }
};

// 从卡片位置展开动画
const animateFromCard = async (cardElement: HTMLElement) => {
  if (!storyGridRef.value) return;

  const containerRect = storyGridRef.value.getBoundingClientRect();
  const cardRect = cardElement.getBoundingClientRect();

  // 计算卡片相对于容器的位置
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

  // 等待 DOM 更新
  await nextTick();

  // 动画展开到占据整个容器，但底部留出空间
  setTimeout(() => {
    // const containerHeight = storyGridRef.value?.clientHeight || 0;
    const bottomOffset = 40; // 底部按钮的高度 (footer-actions: 20px padding + 52px button height + 20px padding)
    editPanelStyle.value = {
      left: "0px",
      top: "0px",
      width: "100%",
      bottom: `${bottomOffset}px`, // 使用 bottom 而不是 height，让面板底部往上调整
      transformOrigin: "top left",
    };

    setTimeout(() => {
      isAnimating.value = false;
    }, 650);
  }, 50);
};

// 显示自定义故事编辑面板
const handleShowCustomDialog = async (event?: MouseEvent) => {
  if (props.locked || loading.value) return;
  console.log("[QuickStorySelector] handleShowCustomDialog");
  customStory.value = { title: "", intro: "", theme: "" };
  editingStoryIndex.value = null;
  isCustomMode.value = true;

  if (event) {
    const target = (event.currentTarget as HTMLElement).closest(
      ".story-card-wrapper"
    ) as HTMLElement;
    if (target) {
      await animateFromCard(target);
    } else {
      showEditPanel.value = true;
    }
  } else {
    showEditPanel.value = true;
  }
};

// 保存自定义故事
const handleSaveCustomStory = () => {
  const title = customStory.value.title.trim();
  const intro = customStory.value.intro.trim();

  if (!title || !intro) {
    ElMessage.warning("请填写完整的书名和梗概");
    return;
  }

  console.log("[QuickStorySelector] handleSaveCustomStory:", customStory.value);

  // 获取标签名称数组（添加 # 前缀）
  const tagNames = workInfo.value?.workTags?.map((tag: any) => `#${tag.name}`) || [];

  if (editingStoryIndex.value !== null) {
    // 编辑模式：更新指定位置的故事
    console.log("[QuickStorySelector] Editing story at index:", editingStoryIndex.value);
    const updatedStory = {
      ...customStory.value,
      tags: tagNames, // 添加标签
    };

    // 如果原来是自定义故事，保留 isCustom 标记
    if (stories.value[editingStoryIndex.value]?.isCustom) {
      updatedStory.isCustom = true;
    }

    stories.value[editingStoryIndex.value] = updatedStory;
    selectedStoryIndex.value = editingStoryIndex.value;
  } else {
    // 新增模式：创建自定义故事对象
    const newStory: StoryData = {
      ...customStory.value,
      isCustom: true,
      tags: tagNames, // 添加标签
    };

    // 先查找是否有重名的卡片（isCustom: true 且 title 相同）
    const sameNameIndex = stories.value.findIndex(
      (s) => s.title && s.title.trim() === title && s.isCustom
    );

    if (sameNameIndex !== -1) {
      // 如果有重名的，替换它
      stories.value[sameNameIndex] = newStory;
      selectedStoryIndex.value = sameNameIndex;
    } else {
      // 如果不重名，在倒数第二个位置插入（因为 displayStories 会在最后添加 null）
      const insertIndex = Math.max(0, stories.value.length);
      stories.value.splice(insertIndex, 0, newStory);
      selectedStoryIndex.value = insertIndex;
    }
  }

  closeEditPanel();
};

// 关闭编辑面板
const closeEditPanel = () => {
  showEditPanel.value = false;
  isAnimating.value = false;
  editingStoryIndex.value = null;
  isCustomMode.value = false;
  customStory.value = { title: "", intro: "", theme: "" };
};

// 确认选择
const handleConfirm = () => {
  if (selectedStoryIndex.value === null || !stories.value[selectedStoryIndex.value]?.title) {
    ElMessage.warning("请先选择一个故事");
    return;
  }
  const selectedStory = stories.value[selectedStoryIndex.value];
  console.log("[QuickStorySelector] handleConfirm:", selectedStory);

  // 保存完整数据：选中的故事 + 所有生成的卡片（不包括自定义卡片的占位符）
  const generatedCards = stories.value.filter(s => s.title && s.title.trim() !== "");
  const fullData = {
    selectedData: selectedStory,
    generatedCards: generatedCards.length > 0 ? generatedCards : undefined, // 如果没有生成卡片，不保存该字段
  };

  const storyData = JSON.stringify(fullData);
  emit("confirm", storyData, selectedStory.title);
};

// 处理回退到当前步骤
const handleRevertToCurrent = () => {
  emit("revert-to-current");
};

// 回退（带二次确认）
const handleRevert = async () => {
  console.log("[QuickStorySelector] handleRevert");

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
    console.log("[QuickStorySelector] User cancelled revert");
  }
};

// 从props初始化数据
const initFromProps = () => {
  console.log("[QuickStorySelector] initFromProps");
  console.log("[QuickStorySelector] storyContent:", props.storyContent);

  if (props.storyContent) {
    try {
      const data = JSON.parse(props.storyContent);

      // 兼容新旧数据格式
      if (data.selectedData && data.generatedCards) {
        // 新格式：包含 selectedData 和 generatedCards
        console.log("[QuickStorySelector] Loading new format data with generated cards");

        // 有生成的卡片：展示所有生成的卡片（无论是否锁定）
        stories.value = data.generatedCards;
        // 找到选中的卡片索引
        const selectedIndex = stories.value.findIndex(
          (s: StoryData) => s.title === data.selectedData.title && s.intro === data.selectedData.intro
        );
        selectedStoryIndex.value = selectedIndex !== -1 ? selectedIndex : 0;
        console.log("[QuickStorySelector] Loaded all generated cards, selected index:", selectedStoryIndex.value);
      } else {
        // 旧格式：只有选中的故事，兼容历史数据
        console.log("[QuickStorySelector] Loading old format data (backward compatibility)");
        stories.value = [data];
        selectedStoryIndex.value = 0;
      }

      console.log("[QuickStorySelector] Loaded story from props:", data);
    } catch (e) {
      console.error("[QuickStorySelector] Failed to parse storyContent:", e);
    }
  }
};

// 监听props变化
watch(
  () => props.storyContent,
  (newVal, oldVal) => {
    console.log("[QuickStorySelector] storyContent changed:", { newVal, oldVal });

    // 如果内容被清空（从有内容变为空），重置状态
    if (oldVal && !newVal) {
      console.log("[QuickStorySelector] Content cleared, reset state");
      stories.value = [...EMPTY_STORIES];
      selectedStoryIndex.value = null;
      editingStoryIndex.value = null;
      showEditPanel.value = false;
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
      console.log("[QuickStorySelector] triggerGenerate changed, trigger generate:", { newVal, oldVal });
      // 检查条件：有标签、未锁定
      if (props.selectedTagIds && !props.locked) {
        console.log("[QuickStorySelector] Conditions met, auto generate");
        stories.value = [...EMPTY_STORIES];
        selectedStoryIndex.value = null;
        setTimeout(() => {
          generateStories();
        }, 100);
      } else {
        console.log("[QuickStorySelector] Conditions not met, skip generate");
      }
    }
  }
);

// 组件挂载后，不自动生成，等待用户手动触发
onMounted(() => {
  console.log("[QuickStorySelector] onMounted");
  // 移除自动生成逻辑，避免重新打开页面时自动生成
  // 如果需要生成，用户可以点击"换一批"按钮
});
</script>

<template>
  <div class="quick-story-selector" :class="{ 'edit-mode': showEditPanel }">
    <!-- 故事选择区域 -->
    <div class="story-select-layout">
      <!-- 标题 -->
      <div class="section-title">请选择满意的故事梗概</div>

      <!-- 卡片和编辑区容器 -->
      <div class="card-edit-container">
        <div class="story-edit-container" ref="storyGridRef">
          <div class="story-grid" :class="{ 'edit-mode': showEditPanel }">
            <div
              v-for="(story, index) in displayStories"
              :key="story ? story.title + index : 'custom-' + index"
              class="story-card-wrapper"
              :class="{
                selected: story && story.title && selectedStoryIndex === index,
                'custom-wrapper': !story,
              }"
            >
              <QuickStoryCard
                v-if="story"
                :data="story"
                :show-edit="!!(!locked && story.title && !showEditPanel)"
                :loading="loading"
                :is-selected="selectedStoryIndex === index"
                @click="handleSelectStory(story, index)"
                @edit="(e: MouseEvent) => handleEditStory(story, index, e)"
              />
              <QuickStoryCard
                v-else
                :is-custom="true"
                :class="{ disabled: loading }"
                @click="(e?: MouseEvent) => e && handleShowCustomDialog(e)"
              />
            </div>
          </div>

          <!-- 换一批按钮 -->
          <div v-if="!locked && !showEditPanel" class="refresh-container">
            <el-button
              link
              type="info"
              class="refresh-btn"
              :disabled="loading"
              @click="generateStories"
            >
              <span class="iconfont refresh-icon">&#xe66f;</span>
              <span>换一批</span>
            </el-button>
          </div>
        </div>
        <!-- 内联编辑区：在 story-edit-container 内部，只占据卡片和换一批按钮区域 -->
        <Transition name="edit-panel">
          <div
            v-if="showEditPanel"
            class="edit-panel"
            :style="editPanelStyle"
            :class="{ animating: isAnimating }"
          >
            <!-- 编辑已有故事或自定义故事 -->
            <div class="edit-panel-content">
              <!-- 编辑区内容根据设计稿 node-id=62-15878 -->
              <div class="edit-form">
                <!-- 标题 -->
                <div class="edit-title">编辑故事梗概</div>

                <!-- 书名 -->
                <div class="form-group">
                  <label class="form-label">书名：</label>
                  <div class="form-input-wrapper form-input-wrapper-title">
                    <el-input
                      v-model="customStory.title"
                      placeholder="请填入"
                      :maxlength="MAX_TITLE_LENGTH"
                      class="form-input"
                    />
                    <span class="word-count"
                      >{{ (customStory.title || "").length }}/{{ MAX_TITLE_LENGTH }}</span
                    >
                  </div>
                </div>

                <!-- 梗概 -->
                <div class="form-group">
                  <label class="form-label">梗概：</label>
                  <div class="form-input-wrapper form-input-wrapper-intro">
                    <el-input
                      v-model="customStory.intro"
                      type="textarea"
                      placeholder="请简述核心故事情节"
                      :maxlength="MAX_INTRO_LENGTH"
                      class="form-textarea"
                    />
                    <span class="word-count"
                      >{{ (customStory.intro || "").length }}/{{ MAX_INTRO_LENGTH }}</span
                    >
                  </div>
                </div>

                <!-- 操作按钮 -->
                <div class="edit-actions">
                  <el-button class="cancel-btn" @click="closeEditPanel">取消</el-button>
                  <el-button class="confirm-btn" @click="handleSaveCustomStory">确定</el-button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- 底部操作区 -->
    <div v-if="!showEditPanel" class="footer-actions">
      <el-button
        v-if="!locked"
        type="primary"
        class="confirm-btn"
        :disabled="!hasSelectedStory"
        @click="handleConfirm"
      >
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
.quick-story-selector {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
  padding: 40px 120px 20px 0px;
  box-sizing: border-box;

  &.edit-mode {
    .story-edit-container {
      overflow: hidden;
    }
  }
}

.story-select-layout {
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

  .section-title {
    font-size: 24px;
    font-weight: 400;
    line-height: 1.32em;
    color: #000000;
    margin-bottom: 40px;
    flex-shrink: 0;
  }

  .card-edit-container {
    position: relative;
    flex: 1;
    display: flex;
    overflow: hidden; // 为底部按钮预留空间 (footer-actions: 20px padding + 52px button height + 20px padding = 92px)
  }

  .story-edit-container {
    position: relative;
    padding: 2px;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto; // 只有卡片区滚动
    overflow-x: hidden;

    // 自定义滚动条样式
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
}

.story-grid {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap; // 允许换行
  flex-shrink: 0;
  margin-bottom: 32px;
  margin-left: -30px;
  margin-top: -30px;
  position: relative; // 为编辑区提供定位参考

  &.edit-mode {
    opacity: 0.3;
    pointer-events: none;
  }

  .story-card-wrapper {
    display: flex;
    flex-direction: row;
    margin-left: 30px;
    margin-top: 30px;
    flex: 0 0 calc(25% - 30px); // 始终保持一行4个，每个占25%减去间距
    max-width: calc(25% - 30px);
    height: auto; // 高度自适应
    max-height: calc((100vh - 350px) * 0.9); // 视口高度减去头部等元素，留10%缓冲
    min-height: 400px; // 提高最小高度，确保底部内容可见

    // 针对超宽屏（宽高比 > 2:1）优化
    @media (min-width: 2000px) and (max-height: 1200px) {
      min-height: 450px; // 在超宽屏上提高最小高度
      max-height: calc((100vh - 300px) * 0.95); // 在超宽屏上使用更大的高度比例
    }

    &:hover:not(.disabled) {
      :deep(.quick-story-card) {
        outline: 2px solid var(--theme-color);
      }
    }

    &.selected {
      :deep(.quick-story-card) {
        outline: 2px solid var(--theme-color);
      }
    }
  }

  .custom-wrapper {
    display: flex;
    flex-direction: row;
    margin-left: 30px;
    margin-top: 30px;
    flex: 0 0 calc(25% - 30px); // 始终保持一行4个
    max-width: calc(25% - 30px);
    height: auto; // 高度自适应
    max-height: calc((100vh - 350px) * 0.9); // 与普通卡片保持一致
    min-height: 400px; // 提高最小高度，确保底部内容可见

    // 针对超宽屏（宽高比 > 2:1）优化
    @media (min-width: 2000px) and (max-height: 1200px) {
      min-height: 450px; // 在超宽屏上提高最小高度
      max-height: calc((100vh - 300px) * 0.95); // 在超宽屏上使用更大的高度比例
    }

    &.disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
  }
}

.refresh-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0;
  flex-shrink: 0;
  height: 32px;

  .refresh-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0;
    font-size: 24px;
    font-weight: 400;
    line-height: 1.32em;
    color: #999999;
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
      font-size: 30px;
      width: 30px;
      height: 30px;
      margin-right: 10px;
    }
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
  background: #fff8e5;
  border: 2px solid rgba(255, 149, 0, 1);
  // border-image: linear-gradient(90deg, rgba(239, 175, 0, 1) 0%, rgba(255, 149, 0, 1) 100%) 1;
  border-radius: 10px;
  // box-shadow: 0px 0px 20px 0px rgba(58, 37, 0, 0.15);
  z-index: 100;
  overflow: hidden; // 防止滚动条
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  top: 0;
  left: 0;
  right: 0;
  // bottom 由 editPanelStyle 动态设置，默认留出底部空间
  display: flex;
  flex-direction: column;

  &.animating {
    transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .edit-panel-content {
    padding: 35px 100px;
    padding-bottom: clamp(35px, 5vh, 50px); // 底部padding，确保按钮有足够空间
    position: relative;
    height: 100%;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    overflow-y: auto; // 支持垂直滚动
    overflow-x: hidden;

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

    .edit-title {
      font-size: 30px;
      font-weight: 400;
      line-height: 1.32em;
      letter-spacing: 0.04em;
      color: #464646;
      text-align: center;
      margin-bottom: 20px;
      flex-shrink: 0;
    }

    .edit-form {
      display: flex;
      flex-direction: column;
      gap: 30px; // 书名和梗概之间的间距
      flex: 0 0 auto; // 不压缩，根据内容自适应高度
      min-height: min-content; // 最小高度为内容高度

      .form-group {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        flex-shrink: 0;

        .form-label {
          width: 50px;
          flex-shrink: 0;
          white-space: nowrap;
          font-size: 24px;
          font-weight: 400;
          line-height: 1.32em;
          letter-spacing: 0.04em;
          color: #464646;
          padding-top: 15px; // 与输入框对齐
        }

        // &.form-group-intro {
        //   flex: 1;
        // }

        .form-input-wrapper {
          position: relative;
          flex: 1;
          min-width: 0;

          &.form-input-wrapper-title {
            flex: 1;
            // width: 1016.98px;
            margin-left: 100px; // 标签和输入框的间距
          }

          &.form-input-wrapper-intro {
            flex: 1;
            // width: 1017px;
            // height: 270px;
            margin-left: 100px; // 标签宽度
          }

          .word-count {
            position: absolute;
            font-size: 24px;
            color: #9a9a9a;
            white-space: nowrap;
            pointer-events: none;
          }

          &.form-input-wrapper-title .word-count {
            right: 16px;
            top: 13px;
          }

          &.form-input-wrapper-intro .word-count {
            right: 16px;
            bottom: 16px;
          }
        }
      }

      .edit-actions {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        gap: 25.91px;
        margin-top: clamp(20px, 3vh, 40px); // 顶部间距，确保与表单内容有足够距离
        margin-bottom: 0;
        flex-shrink: 0; // 不允许压缩，确保按钮始终可见
        min-height: 52px; // 确保按钮高度
        z-index: 10;

        .cancel-btn {
          width: 130.91px;
          height: 52px;
          padding: 0;
          border-radius: 10px;
          font-size: 24px;
          font-weight: 400;
          line-height: 1.32em;
          color: #464646;
          background: transparent;
          border: 2px solid #9a9a9a;

          &:hover {
            opacity: 0.8;
          }
        }

        .confirm-btn {
          width: 129px;
          height: 52px;
          padding: 0;
          border-radius: 10px;
          font-size: 24px;
          font-weight: 700;
          line-height: 1.32em;
          color: #ffffff;
          background: linear-gradient(90deg, rgba(239, 175, 0, 1) 0%, rgba(255, 149, 0, 1) 100%);
          border: none;

          &:hover {
            opacity: 0.9;
          }
        }
      }
    }
  }

  // 输入框样式
  :deep(.el-input__wrapper) {
    background: rgba(255, 245, 205, 0.5);
    border-radius: 10px;
    padding: 13px 30.91px; // 设计稿中placeholder的x位置是30.91
    padding-right: 100px; // 预留字数提示空间
    box-shadow: none;
    height: 100%;
    box-sizing: border-box;

    .el-input__inner {
      font-size: 24px;
      color: #464646;
      height: 100%;

      &::placeholder {
        color: #999999;
      }
    }
  }

  :deep(.el-textarea__inner) {
    background: rgba(255, 245, 205, 0.5);
    border-radius: 10px;
    padding: 14.81px 32.26px; // 设计稿中placeholder的x位置是32.26
    padding-right: 100px; // 预留字数提示空间
    font-size: 24px;
    color: #464646;
    height: 270px;
    min-height: 270px;
    max-height: 270px;
    overflow-y: auto;
    box-shadow: none;
    border: none;
    resize: none;
    box-sizing: border-box;

    &::placeholder {
      color: #999999;
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
  // padding: 20px 40px;
  padding-bottom: 20px;
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
</style>
