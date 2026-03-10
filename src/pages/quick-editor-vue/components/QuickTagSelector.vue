<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from "vue";
import { ElButton, ElMessage, ElInput, ElSlider, ElInputNumber } from "element-plus";
import {
  addCustomTagReq,
  delCustomTagReq,
  getWorkTagsReq,
  updateWorkInfoReq,
} from "@/api/works.ts";
import { useEditorStore, type Tag } from "@/stores/editor";
import { storeToRefs } from "pinia";

interface TagCategoryDataItem {
  category: string; //标签分类名
  categoryId: string; //分类id
  max: number; //最大可选数
  tags: Tag[]; //标签列表
}

interface Props {
  selectedTagIds?: string; // 从serverData读取的标签ID字符串（逗号分隔）
  locked?: boolean; // 是否锁定（不可编辑）
  hasNextContent?: boolean; // 后面是否有内容
}

interface Emits {
  (e: "confirm", data: { tagIds: string; chapterNum: number; wordNum: number }): void; // 确认时传递标签和章节信息
  (e: "revert"): void; // 回退
  (e: "revert-to-current"): void; // 回退到当前步骤
}

const props = withDefaults(defineProps<Props>(), {
  selectedTagIds: "",
  locked: false,
});

const emit = defineEmits<Emits>();

// 标签
const categories = ref<TagCategoryDataItem[]>([]);
const selectedTags = ref<Tag[]>([]);

// 判断是否有选中的标签
const hasSelectedTags = computed(() => selectedTags.value.length > 0);

const editorStore = useEditorStore();
const { workId, workInfo } = storeToRefs(editorStore);

// 章节数和每章字数
const chapterNum = ref<number>(10); // 默认10章
const wordNum = ref<number>(800); // 默认800字

// 字数输入框的校正定时器
let wordNumCorrectionTimer: ReturnType<typeof setTimeout> | null = null;

// 每个分类的自定义输入框组件引用
const customInputRefs = ref<Record<string, any>>({});

// 每个分类的自定义标签输入状态
interface CustomInputState {
  visible: boolean;
  value: string;
}

const customInputMap = ref<Record<string, CustomInputState>>({});

const ensureCustomState = (categoryId: string): CustomInputState => {
  if (!customInputMap.value[categoryId]) {
    customInputMap.value[categoryId] = {
      visible: false,
      value: "",
    };
  }
  return customInputMap.value[categoryId];
};

const showCustomInput = (categoryId: string) => {
  if (props.locked) return;
  const state = ensureCustomState(categoryId);
  state.visible = true;
  nextTick(() => {
    const input = customInputRefs.value[categoryId];
    if (input) {
      input.focus();
      input.select();
    }
  });
};

const hideCustomInput = (categoryId: string) => {
  const state = ensureCustomState(categoryId);
  state.visible = false;
  state.value = "";
};

const isCustomInputVisible = (categoryId: string) => {
  return !!customInputMap.value[categoryId]?.visible;
};

const getCustomInputValue = (categoryId: string) => {
  return customInputMap.value[categoryId]?.value || "";
};

const setCustomInputValue = (categoryId: string, value: string) => {
  const state = ensureCustomState(categoryId);
  state.value = value;
};

const setCustomInputRef = (categoryId: string, el: any) => {
  customInputRefs.value[categoryId] = el;
};

// 用于防抖：延迟定时器
let confirmCustomTagTimer: ReturnType<typeof setTimeout> | null = null;

const addCustomTag = async (categoryId: string, tagName: string) => {
  try {
    await addCustomTagReq(categoryId, tagName);
    await updateTagCategories();
  } catch (e) {
    console.error(e);
  }
};

// 获取当前分类已选中的数量
const getSelectedCount = (categoryName: string) => {
  const category = categories.value.find((cat) => cat.category === categoryName);
  if (!category) return 0;
  const categoryTagIds = category.tags.map((tag) => tag.id);
  return selectedTags.value.filter((tag: Tag) => categoryTagIds.includes(tag.id)).length;
};

const isTagSelected = (tagId: number) => {
  return selectedTags.value.some((tag) => tag.id === tagId);
};

// 切换标签选中状态
const toggleTag = (categoryId: string, tagId: number, maxSelect: number) => {
  if (props.locked) return;

  // 获取当前分类
  const category = categories.value.find((cat) => cat.categoryId === categoryId);
  if (!category) return;

  // 查找要操作的 tag 对象
  const tag = category.tags.find((t) => t.id === tagId);
  if (!tag) return;

  // 查找是否已选中
  const index = selectedTags.value.findIndex((t) => t.id === tagId);

  if (index > -1) {
    // 已选中，取消选中
    selectedTags.value.splice(index, 1);
  } else {
    // 未选中，尝试选中
    // 获取当前分类已选中的标签数量
    const currentCategoryTagIds = category.tags.map((t) => t.id);
    const currentSelectedCount = selectedTags.value.filter((t) =>
      currentCategoryTagIds.includes(t.id)
    ).length;

    if (maxSelect === 0 || currentSelectedCount < maxSelect) {
      // 未达到最大值，直接添加
      selectedTags.value.push(tag);
    } else {
      // 已达到最大值，找到当前分类中最后一个选中的标签（按在数组中的位置），移除它
      let lastIndex = -1;
      for (let i = selectedTags.value.length - 1; i >= 0; i--) {
        if (currentCategoryTagIds.includes(selectedTags.value[i].id)) {
          lastIndex = i;
          break;
        }
      }
      if (lastIndex > -1) {
        selectedTags.value.splice(lastIndex, 1);
      }
      // 添加新选中的标签
      selectedTags.value.push(tag);
    }
  }
};

// 确认添加自定义标签（回车或失焦都会触发）
const confirmCustomTag = (categoryId: string) => {
  // 防抖：如果已有定时器，清除它
  if (confirmCustomTagTimer) {
    clearTimeout(confirmCustomTagTimer);
    confirmCustomTagTimer = null;
  }

  // 设置新的延迟定时器（300ms 延迟）
  confirmCustomTagTimer = setTimeout(async () => {
    const name = getCustomInputValue(categoryId).trim();

    if (!name) {
      hideCustomInput(categoryId);
      confirmCustomTagTimer = null;
      return;
    }

    const category = categories.value.find((cat) => cat.categoryId === categoryId);
    if (!category) {
      hideCustomInput(categoryId);
      confirmCustomTagTimer = null;
      return;
    }

    // 如果同名标签已存在，则不重复创建
    const existed = category.tags.find((t) => t.name === name);
    if (existed) {
      ElMessage.warning("该标签已存在");
      hideCustomInput(categoryId);
      confirmCustomTagTimer = null;
      return;
    }

    try {
      await addCustomTag(categoryId, name);

      // 重置输入状态
      hideCustomInput(categoryId);
      await updateTagCategories();
    } catch (e) {
      console.error(e);
    } finally {
      // 清除定时器引用
      confirmCustomTagTimer = null;
    }
  }, 300);
};

const handleDeleteTag = async (tag: Tag) => {
  if (props.locked) return;

  try {
    // 先调用接口删除自定义标签
    await delCustomTagReq(tag.id + "");

    // 如果该标签在已选中列表中，同步移除
    const index = selectedTags.value.findIndex((t) => t.id === tag.id);
    if (index > -1) {
      selectedTags.value.splice(index, 1);
    }

    // 重新拉取标签分类数据
    await updateTagCategories();
  } catch (e) {
    console.error(e);
  }
};

// 更新标签列表
const updateTagCategories = async () => {
  try {
    const response: any = await getWorkTagsReq();
    if (response) {
      categories.value = response;
    }
  } catch (error) {
    categories.value = [];
    console.error("获取标签数据失败:", error);
  }
};

// 从输入中提取数字（支持从包含中文等非数字字符的字符串中提取）
const extractNumber = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    return isNaN(value) ? null : value;
  }

  if (typeof value === "string") {
    // 如果字符串为空，返回null
    if (value.trim() === "") return null;

    // 提取所有数字字符
    const digits = value.match(/\d+/g);
    if (!digits || digits.length === 0) return null;

    // 将所有数字字符组合成一个数字
    const numStr = digits.join("");
    const numValue = parseInt(numStr, 10);

    return isNaN(numValue) ? null : numValue;
  }

  return null;
};

// 处理字数自动更正（100-5000），如果提取不到数字则恢复默认初始值800
const correctWordNum = (value: number | null | undefined): number => {
  // 如果提取不到数字，恢复默认初始值800
  if (value === null || value === undefined) return 800;
  // 如果小于最小值，使用最小值100
  if (value < 100) return 100;
  // 如果大于最大值，使用最大值5000
  if (value > 5000) return 5000;
  return value;
};

// 处理字数输入（延迟1秒后修正）
const handleWordNumInput = (value: string | number) => {
  // 清除之前的定时器
  if (wordNumCorrectionTimer) {
    clearTimeout(wordNumCorrectionTimer);
  }

  // 如果输入为空，暂时允许
  if (value === "" || value === null || value === undefined) {
    wordNum.value = "" as any;
    return;
  }

  // 从输入中提取数字（支持从包含中文等非数字字符的字符串中提取）
  const numValue = extractNumber(value);

  // 延迟1秒后修正到合法范围
  wordNumCorrectionTimer = setTimeout(() => {
    wordNum.value = correctWordNum(numValue);
    wordNumCorrectionTimer = null;
  }, 1000);
};

// 处理字数失焦（立即修正到合法范围）
const handleWordNumBlur = () => {
  // 清除延迟定时器
  if (wordNumCorrectionTimer) {
    clearTimeout(wordNumCorrectionTimer);
    wordNumCorrectionTimer = null;
  }

  // 从当前值中提取数字（支持从包含中文等非数字字符的字符串中提取）
  const numValue = extractNumber(wordNum.value);

  // 立即修正到合法范围
  wordNum.value = correctWordNum(numValue);
};

// 处理确认
const handleConfirm = async () => {
  if (props.locked) return;

  try {
    const selectedTagIds = selectedTags.value.map((tag) => tag.id);

    // 确保字数在合法范围内
    const correctedWordNum = correctWordNum(wordNum.value);
    wordNum.value = correctedWordNum;

    console.log("[QuickTagSelector] 保存章节数:", chapterNum.value);
    console.log("[QuickTagSelector] 保存每章字数:", correctedWordNum);
    workInfo.value.chapterNum = chapterNum.value;
    workInfo.value.wordNum = correctedWordNum;
    // 同步更新 workInfo.chapterNum 和 workInfo.wordNum 到服务器
    await updateWorkInfoReq(workId.value, {
      tagIds: selectedTagIds,
      chapterNum: chapterNum.value, // 用户通过滑块选择的章节数，同步更新到 workInfo.chapterNum
      wordNum: correctedWordNum,
    });
    // 更新本地 store 中的 workInfo
    await editorStore.updateWorkInfo();

    // 将标签ID用逗号拼接，并传递章节信息
    const tagIdsString = selectedTagIds.join(",");
    emit("confirm", {
      tagIds: tagIdsString,
      chapterNum: chapterNum.value,
      wordNum: correctedWordNum,
    });
  } catch (e) {
    console.error(e);
    ElMessage.error("保存失败,请稍后重试");
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

// 从props.selectedTagIds初始化selectedTags
const initSelectedTags = () => {
  if (!props.selectedTagIds) {
    // 如果没有选中的标签ID，默认选中10章 不默认选中了，否则有问题
    // if (categories.value.length > 0) {
    //   const chapterCategory = categories.value.find((cat) => cat.category.includes("章"));
    //   if (chapterCategory) {
    //     // 查找10章标签
    //     const defaultChapterTag = chapterCategory.tags.find((tag) => tag.name.includes("10"));
    //     if (defaultChapterTag) {
    //       // 检查是否已经选中
    //       const isAlreadySelected = selectedTags.value.some(
    //         (tag) => tag.id === defaultChapterTag.id
    //       );
    //       if (!isAlreadySelected) {
    //         selectedTags.value = [defaultChapterTag];
    //       }
    //       return;
    //     }
    //   }
    // }
    selectedTags.value = [];
    return;
  }

  const tagIdArray = props.selectedTagIds
    .split(",")
    .map((id) => parseInt(id.trim()))
    .filter((id) => !isNaN(id));
  chapterNum.value = workInfo.value.chapterNum || 10;
  wordNum.value = workInfo.value.wordNum || 800;

  // 从所有分类的标签中找到对应的标签对象
  const foundTags: Tag[] = [];
  categories.value.forEach((category) => {
    category.tags.forEach((tag) => {
      if (tagIdArray.includes(tag.id)) {
        foundTags.push(tag);
      }
    });
  });

  selectedTags.value = foundTags;
};

// 监听props.selectedTagIds变化
watch(
  () => props.selectedTagIds,
  () => {
    if (categories.value.length > 0) {
      initSelectedTags();
    }
  },
  { immediate: true }
);

// 监听categories变化，初始化选中标签
// watch(
//   categories,
//   () => {
//     if (categories.value.length > 0) {
//       initSelectedTags();
//     }
//   },
//   { deep: true }
// );

onMounted(async () => {
  await updateTagCategories();
  if (props.selectedTagIds) {
    initSelectedTags();
  }
});

// 计算章节提示信息的位置（跟随滑块移动）
const getChapterValuePosition = () => {
  // 获取当前 slider-content 的实际宽度
  const sliderContent = document.querySelector(".slider-content") as HTMLElement;

  if (!sliderContent) {
    return 0;
  }

  const currentSliderContentWidth = sliderContent.offsetWidth;

  // 根据CSS clamp计算实际的slider宽度（约为容器宽度的87%）
  const sliderWidth = currentSliderContentWidth * 0.87;
  const sliderStart = currentSliderContentWidth * 0.05;

  const min = 1;
  const max = 20;
  const current = chapterNum.value;

  // 计算滑块按钮的位置（相对于滑块起点）
  const percentage = (current - min) / (max - min);
  const buttonPosition = percentage * sliderWidth;

  // 章节提示信息宽度约为容器宽度的12%，需要居中显示在按钮上方
  const valueWidth = currentSliderContentWidth * 0.14;
  const valueLeft = sliderStart + buttonPosition - valueWidth / 2;

  return valueLeft - currentSliderContentWidth * 0.01;
};

onUnmounted(() => {
  // 清理字数修正定时器
  if (wordNumCorrectionTimer) {
    clearTimeout(wordNumCorrectionTimer);
    wordNumCorrectionTimer = null;
  }
  // 清理自定义标签确认定时器
  if (confirmCustomTagTimer) {
    clearTimeout(confirmCustomTagTimer);
    confirmCustomTagTimer = null;
  }
});
</script>

<template>
  <div class="quick-tag-selector">
    <div class="tag-select-layout">
      <div v-for="(category, index) in categories" :key="category.category + category.categoryId"
        v-show="!category.category.includes('章节') && !category.category.includes('chapter number')" class="category-section">
        <div class="category-header">
          <div class="category-name">
            {{ category.category }}
            <span v-if="category.max > 0" class="category-count">
              <span :class="{ 'has-selection': getSelectedCount(category.category) > 0 }">
                {{ getSelectedCount(category.category) }}
              </span>
              /{{ category.max }}
            </span>
          </div>
        </div>
        <div class="tags-container">
          <div v-for="tag in category.tags" :key="tag.id" class="tag-item-layout">
            <el-button class="tag-item" :type="isTagSelected(tag.id) ? 'primary' : 'default'" :disabled="locked"
              size="small" @click="toggleTag(category.categoryId, tag.id, category.max)">
              {{ tag.name }}
            </el-button>
            <div v-if="tag.userId != '1' && !locked" class="tag-delete iconfont" @click.stop="handleDeleteTag(tag)">
              &#xe633;
            </div>
          </div>

          <template v-if="!locked">
            <!-- 每个分类最后的「+自定义」按钮（当未显示输入框时） -->
            <el-button v-if="!isCustomInputVisible(category.categoryId)" class="tag-item custom-tag-btn" type="default"
              size="small" plain @click="showCustomInput(category.categoryId)">
              + 自定义
            </el-button>

            <!-- 自定义标签输入框（显示时隐藏按钮） -->
            <!-- 自定义标签输入框（显示时隐藏按钮） -->
            <el-input v-else class="custom-tag-input" size="small" maxlength="6"
              :model-value="getCustomInputValue(category.categoryId)" placeholder="请输入自定义标签..."
              :ref="(el) => setCustomInputRef(category.categoryId, el)"
              @update:model-value="setCustomInputValue(category.categoryId, $event as string)"
              @keydown.enter.prevent="confirmCustomTag(category.categoryId)"
              @blur="confirmCustomTag(category.categoryId)" />
          </template>
        </div>
        <div v-if="index !== categories.length - 1">
          <div class="category-divider"></div>
        </div>
      </div>

      <!-- 章节数选择 -->
      <div class="category-section chapter-settings">
        <div class="category-header">
          <div class="category-name">故事有多少章节数？</div>
        </div>
        <div class="chapter-slider-container">
          <div class="slider-content">
            <el-slider v-model="chapterNum" :min="1" :max="20" :disabled="locked" :show-tooltip="false" />
            <div class="chapter-value" :style="{ left: getChapterValuePosition() + 'px' }">
              <!-- <img :src="chapterTipBg" alt="" class="chapter-tip-bg" /> -->
              <span class="chapter-value-text">{{ chapterNum }}章</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 每章字数选择 -->
      <div class="category-section word-settings">
        <div class="category-header">
          <div class="category-name">每章节字数大约为？</div>
        </div>
        <div class="word-input-container">
          <el-input v-model.number="wordNum" :disabled="locked" placeholder="请输入字数" @input="handleWordNumInput"
            @blur="handleWordNumBlur" />
        </div>
      </div>
      <!-- 操作按钮 -->
      <div v-if="!locked" class="action-buttons">
        <el-button type="primary" class="confirm-btn" :disabled="!hasSelectedTags" @click="handleConfirm">
          下一步
        </el-button>
      </div>

      <!-- 底部回退按钮 -->
      <div v-if="hasNextContent" class="bottom-revert-section">
        <el-button class="revert-btn-bottom" @click="handleRevertToCurrent">
          回退至故事标签
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.quick-tag-selector {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  padding: 50px 120px 50px 0px;
  position: relative;

  // 使用容器查询来动态调整内容大小
  container-type: size;
  container-name: tag-selector;
}

.tag-select-layout {
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  width: 100%;
  // padding-bottom: 120px; // 为悬浮按钮留出空间

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

.category-section {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 0;

  // &:not(:last-child) {
  //   margin-bottom: 0;
  //   padding-bottom: 16px;
  //   border-bottom: 1px solid #dedede;
  // }

  &:not(:first-child) {
    padding-top: clamp(8px, 1.2vh, 12px);
  }

  .category-divider {
    width: 90%;
    height: 1px;
    background: #dedede;
    margin-top: clamp(8px, 1.2vh, 12px);
  }

  .category-header {
    display: flex;
    align-items: flex-start;
    margin-bottom: clamp(8px, 1.2vh, 12px);

    .category-name {
      font-size: clamp(14px, 1.6vw, 18px);
      font-weight: 400;
      line-height: 1.32em;
      letter-spacing: 0.04em;
      color: #000000;
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;

      .category-count {
        font-size: clamp(14px, 1.6vw, 18px);
        font-weight: 400;
        line-height: 1.32em;
        letter-spacing: 0.04em;
        color: #000000;
        margin-left: clamp(10px, 1vw, 14px);

        .has-selection {
          color: transparent;
          background: linear-gradient(90deg, rgba(239, 175, 0, 1) 0%, rgba(255, 149, 0, 1) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-weight: 700;
        }
      }
    }
  }

  .tags-container {
    display: flex;
    flex-wrap: wrap;
    margin: 0;
    padding: 0;
    width: 100%;

    .tag-item-layout {
      position: relative;
      margin-right: clamp(6px, 0.6vw, 8px);
      margin-bottom: clamp(6px, 0.8vh, 8px);
      flex-shrink: 0;

      .tag-delete {
        position: absolute;
        top: -4px;
        right: -4px;
        width: 15px;
        height: 15px;
        line-height: 15px;
        text-align: center;
        border-radius: 50%;
        background: #fff;
        border: 1px solid var(--border-color);
        font-size: 6px !important;
        color: var(--text-secondary);
        cursor: pointer;
        z-index: 1;

        &:hover {
          border-color: var(--bg-editor-save);
          color: var(--bg-editor-save);
        }
      }
    }

    .tag-item {
      position: relative;
      margin: 0;
      padding: clamp(3px, 0.4vh, 4px) clamp(8px, 0.8vw, 10px);
      border-radius: clamp(15px, 1.5vw, 18px);
      font-size: clamp(13px, 1.3vw, 15px);
      height: clamp(26px, 3vh, 30px);
      font-weight: 400;
      letter-spacing: 0.04em;
      cursor: pointer;
      transition: all 0.2s;
      user-select: none;
      border: 1px solid rgba(0, 0, 0, 0.2);
      background: transparent;
      color: #4d4d4d;

      &:hover {
        border-color: rgba(0, 0, 0, 0.3);
      }

      &.el-button--primary {
        background: linear-gradient(90deg, rgba(239, 175, 0, 1) 0%, rgba(255, 149, 0, 1) 100%);
        border: none;
        color: #ffffff;
        font-weight: 700;

        &:hover {
          background: linear-gradient(90deg,
              rgba(239, 175, 0, 0.9) 0%,
              rgba(255, 149, 0, 0.9) 100%);
        }
      }
    }

    .custom-tag-btn {
      border-style: solid;
      border-color: rgba(0, 0, 0, 0.2);
      background: transparent;
      color: #4d4d4d;

      &:hover {
        border-color: rgba(0, 0, 0, 0.3);
        color: #4d4d4d;
      }
    }

    .custom-tag-input {
      width: auto;
      min-width: clamp(80px, 8vw, 100px);
      height: auto;
      border-radius: clamp(15px, 1.5vw, 18px);
      margin-right: clamp(6px, 0.6vw, 8px);
      margin-bottom: clamp(6px, 0.8vh, 8px);
      flex-shrink: 0;
      font-size: clamp(13px, 1.3vw, 15px);

      :deep(.el-input__wrapper) {
        padding: clamp(3px, 0.4vh, 4px) clamp(8px, 0.8vw, 10px);
        border-radius: clamp(15px, 1.5vw, 18px);
        border: 1px solid rgba(0, 0, 0, 0.2);
      }
    }
  }
}

.chapter-settings,
.word-settings {
  margin-top: 0;
}

.chapter-slider-container {
  padding: 0;
  margin: 0;
  margin-left: clamp(5px, 0.8vw, 10px);

  .slider-content {
    display: flex;
    align-items: flex-start;
    width: clamp(320px, 30vw, 400px);
    height: clamp(45px, 5.5vh, 55px);
    margin: 0;
    padding: 0;
    position: relative;

    :deep(.el-slider) {
      width: clamp(280px, 26vw, 350px);
      height: clamp(9px, 1.1vh, 11px);
      margin: clamp(32px, 3.8vh, 38px) 0 0 clamp(16px, 1.6vw, 20px);
      padding: 0;
    }

    :deep(.el-slider__runway) {
      height: clamp(9px, 1.1vh, 11px);
      border-radius: clamp(6px, 0.8vw, 8px);
      background-color: rgba(255, 149, 0, 0.3);
      width: 100%;
    }

    :deep(.el-slider__bar) {
      background: linear-gradient(90deg, rgba(239, 175, 0, 1) 0%, rgba(255, 149, 0, 1) 100%);
      border-radius: clamp(6px, 0.8vw, 8px);
      height: clamp(9px, 1.1vh, 11px);
    }

    :deep(.el-slider__button) {
      width: clamp(18px, 2vw, 22px);
      height: clamp(18px, 2vw, 22px);
      border: clamp(2px, 0.25vw, 2.5px) solid rgba(255, 149, 0, 1);
      border-radius: clamp(15px, 1.8vw, 18px);
      background-color: #ffffff;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;

      &::after {
        content: "";
        display: block;
        width: clamp(6px, 0.7vw, 8px);
        height: clamp(7px, 0.8vw, 9px);
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
      top: clamp(-4.5px, -0.55vh, -5.5px);
    }

    :deep(.el-slider__stop) {
      display: none;
    }

    :deep(.el-slider__tooltip) {
      display: none !important;
    }

    .chapter-value {
      position: absolute;
      top: clamp(1px, 0.2vh, 2px);
      width: clamp(42px, 4.8vw, 52px);
      height: clamp(24px, 3vh, 30px);
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
        margin-bottom: clamp(4px, 0.5vh, 5px);
        font-size: clamp(10px, 1.1vw, 12px);
        font-weight: 700;
        line-height: 1.8em;
        letter-spacing: 0.04em;
        color: transparent;
        background: linear-gradient(90deg, rgba(239, 175, 0, 1) 0%, rgba(255, 149, 0, 1) 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        white-space: nowrap;
        text-align: center;
      }
    }
  }
}

.word-input-container {
  display: flex;
  align-items: center;
  padding: 0;
  margin: 0;

  :deep(.el-input) {
    width: clamp(150px, 16vw, 180px);
    height: clamp(36px, 4.2vh, 42px);

    .el-input__wrapper {
      padding: clamp(8px, 1vh, 10px) clamp(10px, 1vw, 12px);
      border-radius: clamp(6px, 0.8vw, 8px);
      border: 1px solid #d9d9d9;
      background: #ffffff;
      height: clamp(36px, 4.2vh, 42px);
      box-shadow: none;
      transition: border-color 0.2s;

      &.is-focus {
        border-color: #000000;
        color: #000000 !important;

        .el-input__inner {
          color: #000000 !important;
        }
      }
    }

    .el-input__inner {
      text-align: left;
      font-size: clamp(14px, 1.5vw, 17px);
      font-weight: 400;
      line-height: 1.32em;
      color: #b3b3b3;
      height: clamp(18px, 2.2vh, 22px);
      transition: color 0.2s;

      &::placeholder {
        font-size: clamp(14px, 1.5vw, 17px);
        color: #b3b3b3;
      }
    }
  }
}

.action-buttons {
  position: absolute;
  bottom: 0;
  right: 0;
  display: flex;
  padding: 0;
  margin: 0;
  justify-content: flex-end;
  z-index: 10;

  .confirm-btn {
    width: 200px;
    height: 46px;
    padding: 0;
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    line-height: 1.32em;
    background: linear-gradient(90deg, rgba(239, 175, 0, 1) 0%, rgba(255, 149, 0, 1) 100%);
    border: none;
    border-radius: 8px;
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
