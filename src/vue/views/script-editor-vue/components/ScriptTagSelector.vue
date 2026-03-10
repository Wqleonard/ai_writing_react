<script setup lang="ts">
import { ref, watch, onMounted,nextTick, computed } from "vue";
import { ElButton, ElMessage, ElInput, } from "element-plus";
import {
  addCustomTagReq,
  delCustomTagReq,
  updateWorkInfoReq,
} from "@/api/works.ts";
import type { ScriptSelectedTagsResult } from "@/vue/utils/interfaces";
import { useEditorStore, type Tag } from "@/vue/stores/editor.ts";
import { storeToRefs } from "pinia";
import { getScriptSelectedTagsReq, getScriptTagsReq } from "@/api/generate-quick";

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
  novelPlot?: string; // 小说纲章内容（用于获取默认选中标签）
  synopsis?: string; // 故事的一句话梗概（从serverData中标签.md的值）
  description?: string; // 默认选中标签名称拼接（从serverData中标签.md的description，如「科幻，犯罪，男频」）
  triggerGenerate?: number; // 触发生成的标志（当值增加时触发重新获取默认选中标签）
}

interface Emits {
  (e: "confirm", data: { tagIds: string; synopsis: string; episodeNum: number; description: string }): void; // 确认时传递标签、一句话梗概、集数、描述
  (e: "revert"): void; // 回退
  (e: "revert-to-current"): void; // 回退到当前步骤
}

const props = withDefaults(defineProps<Props>(), {
  selectedTagIds: "",
  locked: false,
  novelPlot: "",
  synopsis: "",
  description: "",
  triggerGenerate: 0,
});

const emit = defineEmits<Emits>();

// 标签
const categories = ref<TagCategoryDataItem[]>([]);
const selectedTags = ref<Tag[]>([]);

// 判断是否有选中的标签
const hasSelectedTags = computed(() => selectedTags.value.length > 0);

const editorStore = useEditorStore();
const { workId } = storeToRefs(editorStore);

// 故事的一句话梗概
const synopsis = ref<string>("");
const MAX_SYNOPSIS_LENGTH = 50; // 最大长度30字符

// 一句话梗概的字符计数
const synopsisCharCount = computed(() => synopsis.value.length);

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

const addCustomTag = async (categoryId: string, tagName: string) => {
  try {
    // 剧本标签需传 tagType: 'script'，否则会加到 editor 体系，刷新脚本标签列表时不会出现
    await addCustomTagReq(categoryId, tagName, "script");
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

// 「故事有多少集数」分类：通过分类名包含「集数」识别
const getEpisodeCategory = (): TagCategoryDataItem | undefined =>
  categories.value.find((cat) => cat.category?.includes("集数"));

// 集数分类无选中时默认选中第一项（如 60集），用于初始化或无保存数据时
const ensureEpisodeDefaultSelected = () => {
  const episodeCat = getEpisodeCategory();
  if (episodeCat?.tags?.length && getSelectedCount(episodeCat.category) === 0) {
    selectedTags.value = [...selectedTags.value, episodeCat.tags[0]];
  }
};

// 从标签名解析集数数字，如 "60集" -> 60
const parseEpisodeNumFromTagName = (name: string): number => {
  const m = String(name).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
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

// 校验集数分类的自定义输入：必须能提取出正整数（如 60集、80集）
const isValidEpisodeTagName = (name: string): boolean => {
  const num = parseEpisodeNumFromTagName(name);
  return num > 0;
};

// 确认添加自定义标签（回车或失焦都会触发）
const confirmCustomTag = async (categoryId: string) => {
  const name = getCustomInputValue(categoryId).trim();

  if (!name) {
    hideCustomInput(categoryId);
    return;
  }

  const category = categories.value.find((cat) => cat.categoryId === categoryId);
  if (!category) {
    hideCustomInput(categoryId);
    return;
  }

  // 集数分类：仅接受可提取数字的格式（如 60集、80集），否则提示并废弃此次输入
  const episodeCat = getEpisodeCategory();
  if (episodeCat?.categoryId === categoryId && !isValidEpisodeTagName(name)) {
    ElMessage.warning("集数请输入可提取数字的格式，如：60集、80集，请重新输入");
    return; // 不关闭输入框，方便用户修改
  }

  // 如果同名标签已存在，则不重复创建
  const existed = category.tags.find((t) => t.name === name);
  if (existed) {
    ElMessage.warning("该标签已存在");
    hideCustomInput(categoryId);
    return;
  }

  await addCustomTag(categoryId, name);

  // 重置输入状态
  hideCustomInput(categoryId);
  await updateTagCategories();
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
    const response: any = await getScriptTagsReq();
    if (response) {
      categories.value = response;
    }
  } catch (error) {
    categories.value = [];
    console.error("获取标签数据失败:", error);
  }
};

// 移除字数相关函数（不再需要）

// 处理确认
const handleConfirm = async () => {
  if (props.locked) return;

  try {
    const selectedTagIds = selectedTags.value.map((tag) => tag.id);

    // 同步更新标签到服务器
    await updateWorkInfoReq(workId.value, {
      tagIds: selectedTagIds,
    });
    // 更新本地 store 中的 workInfo
    await editorStore.updateWorkInfo();

    // 从「集数」分类的选中项中解析数字；若无则取该分类第一项的数值
    const episodeCat = getEpisodeCategory();
    let episodeNum = 0;
    if (episodeCat?.tags?.length) {
      const selectedInCategory = selectedTags.value.filter((t) =>
        episodeCat.tags.some((tag) => tag.id === t.id)
      );
      const tagForEpisode = selectedInCategory[0] ?? episodeCat.tags[0];
      episodeNum = parseEpisodeNumFromTagName(tagForEpisode.name) || parseEpisodeNumFromTagName(episodeCat.tags[0].name) || 60;
    } else {
      episodeNum = 60;
    }

    // description：用当前选中的标签名拼接，排除「章节」「chapter number」「集数」分类
    const descriptionParts: string[] = [];
    for (const tag of selectedTags.value) {
      const cat = categories.value.find((c) => c.tags?.some((t) => t.id === tag.id));
      if (!cat?.category) continue;
      if (cat.category.includes("章节") || cat.category.includes("chapter number") || cat.category.includes("集数")) continue;
      descriptionParts.push(tag.name);
    }
    const descriptionStr = descriptionParts.join(",");

    const tagIdsString = selectedTagIds.join(",");
    emit("confirm", {
      tagIds: tagIdsString,
      synopsis: synopsis.value.trim(),
      episodeNum,
      description: descriptionStr,
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

// 2026-2-12新增 获取根据上传的小说，默认生成的标签,作为description
const description = ref<string>("");

// 获取默认选中标签
const fetchDefaultSelectedTags = async () => {
  if (props.locked || !props.novelPlot) {
    return;
  }

  try {
    const result: ScriptSelectedTagsResult = await getScriptSelectedTagsReq(props.novelPlot);

    // 收集所有默认选中的标签名称（description 在用户确认时由选中标签名拼接，此处不再赋值）
    const defaultTagNames: string[] = [];
    if (result.topics) defaultTagNames.push(...result.topics);
    if (result.plots) defaultTagNames.push(...result.plots);
    if (result.backgrounds) defaultTagNames.push(...result.backgrounds);
    if (result.storyAudiences) defaultTagNames.push(...result.storyAudiences);
    if (result.episodeNum) defaultTagNames.push(result.episodeNum);
    if (result.synopsis) {
      synopsis.value = result.synopsis;
    }

    // 从所有分类的标签中匹配（值匹配）
    const matchedTags: Tag[] = [];
    categories.value.forEach((category) => {
      category.tags.forEach((tag) => {
        if (defaultTagNames.includes(tag.name) && !matchedTags.some(t => t.id === tag.id)) {
          matchedTags.push(tag);
        }
      });
    });

    if (matchedTags.length > 0 && selectedTags.value.length === 0) {
      selectedTags.value = matchedTags;
    }
    // 接口可能未返回集数，确保集数分类至少选中第一项（如 60集）
    ensureEpisodeDefaultSelected();
  } catch (error) {
    console.error("获取默认选中标签失败:", error);
  } finally {
    isFetchingDefaultSelectedTags.value = false;
  }
};

// 从props.selectedTagIds初始化selectedTags（无保存数据时置空，后续由集数默认补第一项）
const initSelectedTags = () => {
  if (!props.selectedTagIds || props.selectedTagIds.trim() === "") {
    selectedTags.value = [];
    return;
  }

  const tagIdArray = props.selectedTagIds
    .split(",")
    .map((id) => parseInt(id.trim()))
    .filter((id) => !isNaN(id));

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

// 初始化选中标签和一句话梗概；无用户保存数据时，集数分类默认选中第一项（如 60集）
const tryInitFromProps = () => {
  if (categories.value.length === 0) return;

  // 有保存的 selectedTagIds 时从 props 恢复选中
  if (props.selectedTagIds !== undefined && props.selectedTagIds !== null) {
    initSelectedTags();
  }
  if (props.synopsis !== undefined && props.synopsis !== null) {
    synopsis.value = props.synopsis;
  }
  if (props.description !== undefined && props.description !== null) {
    description.value = props.description;
  }
  ensureEpisodeDefaultSelected();
};

// 监听props.selectedTagIds变化（当props有值时初始化）
watch(
  () => props.selectedTagIds,
  (newVal, oldVal) => {
    console.log("[ScriptTagSelector] selectedTagIds changed:", {
      newVal,
      oldVal,
      newValType: typeof newVal,
      newValLength: newVal?.length,
      categoriesLength: categories.value.length,
      props: {
        selectedTagIds: props.selectedTagIds,
        synopsis: props.synopsis,
        novelPlot: props.novelPlot?.substring(0, 50)
      }
    });
    tryInitFromProps();
  },
  { immediate: true }
);

// 监听props.synopsis变化（当props有值时初始化）
watch(
  () => props.synopsis,
  (newVal, oldVal) => {
    console.log("[ScriptTagSelector] synopsis changed:", {
      newVal,
      oldVal,
      newValType: typeof newVal,
      newValLength: newVal?.length
    });
    tryInitFromProps();
  },
  { immediate: true }
);

// 监听 props.description 变化（从 serverData 恢复或异步加载后同步）
watch(
  () => props.description,
  (val) => {
    if (val !== undefined && val !== null) {
      description.value = val;
    }
  },
  { immediate: true }
);

// 监听categories变化，当categories加载完成后，如果props有值则初始化
watch(
  () => categories.value.length,
  (newLength) => {
    console.log("[ScriptTagSelector] categories.length changed:", newLength, "selectedTagIds:", props.selectedTagIds, "synopsis:", props.synopsis);
    if (newLength > 0) {
      // categories已加载，如果props有值则初始化
      tryInitFromProps();
    }
  }
);

const isFetchingDefaultSelectedTags = ref(false);

// 监听triggerGenerate变化，触发重新获取默认选中标签
watch(
  () => props.triggerGenerate,
  (newVal, oldVal) => {
    // 只有当 triggerGenerate 增加时才触发（避免初始化时触发）
    if (newVal > oldVal && !props.locked && props.novelPlot) {
      isFetchingDefaultSelectedTags.value = true;
      console.log("[ScriptTagSelector] triggerGenerate changed, fetch default selected tags:", { newVal, oldVal });
      // 清空当前选中的标签，重新获取默认选中标签
      selectedTags.value = [];
      synopsis.value = "";
      fetchDefaultSelectedTags();
    }
  }
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

// 初始化一句话梗概
// const initSynopsis = () => {
//   if (props.synopsis) {
//     synopsis.value = props.synopsis;
//   }
// };

onMounted(async () => {
  await updateTagCategories();
  // categories 加载后立即做一次初始化（含集数默认选第一项），避免仅依赖 watch 时序
  nextTick(() => tryInitFromProps());
  if (!props.selectedTagIds && !props.locked && props.novelPlot) {
    await fetchDefaultSelectedTags();
  }
});

// 移除章节相关函数（不再需要）
</script>

<template>
  <div class="quick-tag-selector">
    <div class="tag-select-layout" v-loading.lock="isFetchingDefaultSelectedTags">
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

      <!-- 故事的一句话梗概 -->
      <!-- <div class="category-section synopsis-settings">
        <div class="category-header">
          <div class="category-name">故事的一句话梗概是？</div>
          <div class="synopsis-title">（可不更换拆书核心梗）</div>
        </div>
        <div class="synopsis-input-container">
          <el-input v-model="synopsis" :disabled="locked" :maxlength="MAX_SYNOPSIS_LENGTH" placeholder="请填入"
            class="synopsis-input" />
          <div class="synopsis-char-count">{{ synopsisCharCount }}/{{ MAX_SYNOPSIS_LENGTH }}</div>
        </div>
      </div> -->
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
  padding: 50px 260px 50px 0px;
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
    width: 100%;
    height: 1px;
    background: #dedede;
    margin-top: clamp(8px, 1.2vh, 12px);
  }

  .category-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    margin-bottom: clamp(8px, 1.2vh, 12px);

    .category-name {
      font-size: 22px;
      font-style: normal;
      font-weight: 400;
      line-height: normal;
      letter-spacing: 0.88px;

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

// 故事的一句话梗概标题样式
.synopsis-title {
  color: #949494;
  font-size: 16px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
  letter-spacing: 0.64px;
}

.synopsis-input-container {
  display: flex;
  align-items: center;
  position: relative;
  width: 100%;
  height: 50px;

  .synopsis-input {
    flex: 1;
    height: 100%;
    width: 100%;

    :deep(.el-input__wrapper) {
      height: 50px;
      border-radius: 10px;
      border: 1px solid #d9d9d9;
      background: #ffffff;
      padding: 0 15px 0 15px;
      padding-right: 60px; // 右侧增加 padding，为字符计数留出空间（字符计数宽度约39px + 右侧间距15px + 安全边距）
      box-shadow: none;
      transition: border-color 0.2s;

      &.is-focus {
        border-color: #000000;
      }

      .el-input__inner {
        font-size: 20px;
        font-weight: 400;
        line-height: 1.32em;
        color: #000000;
        height: 100%;
        padding-right: 0; // 确保输入框内容不会与字符计数重叠

        &::placeholder {
          color: #b3b3b3;
        }
      }
    }

    // 未聚焦时，文本溢出显示省略号
    :deep(.el-input__wrapper:not(.is-focus)) {
      .el-input__inner {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    // 聚焦时，正常显示完整内容
    :deep(.el-input__wrapper.is-focus) {
      .el-input__inner {
        overflow: visible;
        text-overflow: clip;
        white-space: normal;
      }
    }
  }

  .synopsis-char-count {
    position: absolute;
    right: 15px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 14px;
    font-weight: 400;
    line-height: 1.32em;
    color: #9a9a9a;
    pointer-events: none;
    z-index: 1; // 确保字符计数在输入框上方
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
