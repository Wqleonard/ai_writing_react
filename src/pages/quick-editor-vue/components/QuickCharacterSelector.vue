<script setup lang="ts">
import { ref, watch, computed, onMounted, nextTick } from "vue";
import { ElButton, ElMessage, ElInput, ElSelect, ElOption, ElMessageBox } from "element-plus";
import type { CharacterCardData as BaseCharacterCardData } from "@/components/StepWorkflow/components/CharacterCard.vue";
import { useEditorStore } from "@/stores/editor";
import { storeToRefs } from "pinia";
import FEMALE from "@/assets/images/character_card/female.png";
import MALE from "@/assets/images/character_card/male.png";
import QuickCharacterCard from "./QuickCharacterCard.vue";
import { getQuickCharacterSettings } from "@/api/generate-quick";

// 扩展角色数据类型，添加自定义标记
interface CharacterCardData extends BaseCharacterCardData {
  isCustom?: boolean;
}

interface Props {
  selectedTagIds?: string; // 标签ID字符串（逗号分隔）
  storyContent?: string; // 故事梗概内容（用于生成角色）
  characterContent?: string; // 从serverData读取的角色内容（JSON字符串）
  locked?: boolean; // 是否锁定（不可编辑）
  hasNextContent?: boolean; // 后面是否有内容
  triggerGenerate?: number; // 触发生成的标志（数字，每次需要生成时递增）
}

interface Emits {
  (e: "confirm", characterData: string): void; // 确认时传递角色数据（JSON字符串）
  (e: "revert"): void; // 回退到上一步
  (e: "revert-to-current"): void; // 回退到当前步骤
  (e: "error-and-revert", targetDir: string): void; // 错误时回退到指定目录
}

const props = withDefaults(defineProps<Props>(), {
  selectedTagIds: "",
  characterContent: "",
  locked: false,
  triggerGenerate: 0,
});

const emit = defineEmits<Emits>();

const editorStore = useEditorStore();
const { workInfo } = storeToRefs(editorStore);

// 空角色数据
const EMPTY_CHARACTER: CharacterCardData = {
  name: "",
  gender: "",
  age: "",
  bloodType: "",
  mbti: "",
  experiences: "",
  personality: "",
  abilities: "",
  identity: "",
};

const EMPTY_CHARACTERS: CharacterCardData[] = [
  { ...EMPTY_CHARACTER },
  { ...EMPTY_CHARACTER },
  { ...EMPTY_CHARACTER },
];

// 角色列表
const characters = ref<CharacterCardData[]>([...EMPTY_CHARACTERS]);
const selectedCharacterIndex = ref<number | null>(null);
const loading = ref(false);

// 编辑状态管理
const showEditPanel = ref(false);
const isCustomMode = ref(false); // true: 自定义模式, false: 编辑模式
const customCharacter = ref<CharacterCardData>({ ...EMPTY_CHARACTER });
const editingCharacterIndex = ref<number | null>(null);

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

// 字数限制
const MAX_NAME_LENGTH = 5;
const MAX_EXPERIENCE_LENGTH = 300;
const MAX_PERSONALITY_LENGTH = 50;
const MAX_ABILITIES_LENGTH = 100;
const MAX_IDENTITY_LENGTH = 50;

console.log("[QuickCharacterSelector] Component mounted");

// 检查是否已选中角色
const hasSelectedCharacter = computed(
  () =>
    selectedCharacterIndex.value !== null && !!characters.value[selectedCharacterIndex.value]?.name
);

// 显示的角色列表：锁定时只显示有内容的卡片，未锁定时最后一个是自定义卡片
const displayCharacters = computed(() => {
  if (props.locked) {
    // 锁定状态下，只显示有内容的角色
    return characters.value.filter((char) => char.name);
  }
  // 未锁定状态下，显示所有卡片，最后添加一个自定义卡片标记
  return [...characters.value, null]; // null 表示自定义卡片
});

// 生成角色列表
const generateCharacters = async () => {
  console.log("[QuickCharacterSelector] generateCharacters called");
  console.log("[QuickCharacterSelector] selectedTagIds:", props.selectedTagIds);

  // 防止重复调用
  if (loading.value) {
    console.log("[QuickCharacterSelector] Already generating, skip");
    return;
  }

  if (!props.selectedTagIds) {
    ElMessage.warning("请先完成前面的步骤");
    return;
  }

  loading.value = true;
  // 点击"换一批"时，清空所有内容，包括自定义角色
  // 保留已有的自定义角色
  // const existingCustomCharacter = characters.value.find((c) => c.isCustom);
  characters.value = [...EMPTY_CHARACTERS];
  selectedCharacterIndex.value = null;

  console.log("[QuickCharacterSelector] Start generating characters...");

  try {
    // 获取标签名称用于description（从workInfo的workTags获取）
    const description = workInfo.value?.workTags?.map((tag: any) => tag.name).join(",") || "";

    console.log("[QuickCharacterSelector] description:", description);
    const storyDataWrapper = JSON.parse(props.storyContent || "{}");
    // 从新的数据结构中提取 selectedData
    const storyData = storyDataWrapper.selectedData || storyDataWrapper;
    const brainStorm = {
      title: storyData.title || "",
      intro: storyData.intro || "",
    };
    const res = await getQuickCharacterSettings("1", description, "doc", brainStorm);

    console.log("[QuickCharacterSelector] API response:", res);

    // 处理 API 返回的数据
    const characterList = Array.isArray(res?.roleCards) ? res.roleCards : [];

    // 用 for 循环填充数据，最多3条
    for (let i = 0; i < 3; i++) {
      if (i < characterList.length) {
        const item = characterList[i];
        characters.value[i] = {
          name: item.name || "",
          gender: item.gender || "",
          age: item.age || "",
          bloodType: item.bloodType || "",
          mbti: item.mbti || "",
          experiences: item.experiences || "",
          personality: item.personality || "",
          abilities: item.abilities || "",
          identity: item.identity || "",
        };
      }
    }

    console.log("[QuickCharacterSelector] Generated characters:", characters.value);
  } catch (e) {
    console.error("[QuickCharacterSelector] 获取角色失败:", e);
    // ElMessage.error("生成角色失败，请重试");
    // 发生错误时，重置为空数据
    characters.value = [...EMPTY_CHARACTERS];
    // 触发错误回退事件，回退到故事梗概
    emit("error-and-revert", "故事梗概.md");
  } finally {
    loading.value = false;
    console.log("[QuickCharacterSelector] Generate characters completed");
  }
};

// 选择角色
const handleSelectCharacter = (character: CharacterCardData, index: number) => {
  if (loading.value || !character.name || props.locked) return;
  console.log("[QuickCharacterSelector] handleSelectCharacter:", character, "index:", index);
  selectedCharacterIndex.value = index;
};

// 显示自定义角色编辑区（从自定义卡片位置展开）
const handleShowCustomDialog = async (event: MouseEvent) => {
  if (props.locked || loading.value) return;
  console.log("[QuickCharacterSelector] handleShowCustomDialog");
  // 初始化自定义角色，性别默认为男
  customCharacter.value = { ...EMPTY_CHARACTER, gender: "男" };
  editingCharacterIndex.value = null;
  isCustomMode.value = true;

  // 获取点击位置
  const target = event.currentTarget as HTMLElement;
  await animateFromCard(target);
};

// 编辑已有角色（从卡片位置展开）
const handleEditCharacter = async (
  character: CharacterCardData,
  index: number,
  event: MouseEvent
) => {
  if (props.locked) return;
  console.log("[QuickCharacterSelector] handleEditCharacter:", { character, index });
  customCharacter.value = { ...character };
  editingCharacterIndex.value = index;
  isCustomMode.value = false;

  // 获取点击位置（可能是编辑按钮或卡片本身）
  const target = (event.currentTarget as HTMLElement).closest(
    ".character-card-wrapper"
  ) as HTMLElement;
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

  // 等待 DOM 更新
  await nextTick();

  // 动画展开到占据整个容器（包括卡片和换一批按钮区域）
  setTimeout(() => {
    // 使用 bottom 而不是 height，与故事梗概编辑区保持一致
    const bottomOffset = 40; // 底部按钮的高度
    editPanelStyle.value = {
      left: "0px",
      top: "0px",
      width: "100%",
      bottom: `${bottomOffset}px`, // 使用 bottom 而不是 height，让面板底部往上调整
      transformOrigin: "top left",
    };

    // 动画结束后
    setTimeout(() => {
      isAnimating.value = false;
    }, 650);
  }, 50);
};

// 保存自定义角色
const handleSaveCustomCharacter = () => {
  const name = customCharacter.value.name.trim();

  if (!name) {
    ElMessage.warning("请至少填写角色名字");
    return;
  }

  console.log("[QuickCharacterSelector] handleSaveCustomCharacter:", customCharacter.value);

  if (editingCharacterIndex.value !== null) {
    // 编辑模式：更新指定位置的角色
    console.log(
      "[QuickCharacterSelector] Editing character at index:",
      editingCharacterIndex.value
    );
    const updatedCharacter = { ...customCharacter.value };

    // 如果原来是自定义角色，保留 isCustom 标记
    if (characters.value[editingCharacterIndex.value]?.isCustom) {
      updatedCharacter.isCustom = true;
    }

    characters.value[editingCharacterIndex.value] = updatedCharacter;
    selectedCharacterIndex.value = editingCharacterIndex.value;
  } else {
    // 新增模式：创建自定义角色对象
    const newCharacter: CharacterCardData = {
      ...customCharacter.value,
      isCustom: true,
    };

    // 先查找是否有重名的卡片（isCustom: true 且 name 相同）
    const sameNameIndex = characters.value.findIndex(
      (c) => c.name && c.name.trim() === name && c.isCustom
    );

    if (sameNameIndex !== -1) {
      // 如果有重名的，替换它
      characters.value[sameNameIndex] = newCharacter;
      selectedCharacterIndex.value = sameNameIndex;
    } else {
      // 如果不重名，在倒数第二个位置插入（因为 displayCharacters 会在最后添加 null）
      const insertIndex = Math.max(0, characters.value.length);
      characters.value.splice(insertIndex, 0, newCharacter);
      selectedCharacterIndex.value = insertIndex;
    }
  }

  closeEditPanel();
};

// 关闭编辑面板
const closeEditPanel = () => {
  showEditPanel.value = false;
  customCharacter.value = { ...EMPTY_CHARACTER };
  editingCharacterIndex.value = null;
  isCustomMode.value = false;
  isAnimating.value = false;
};

// 确认选择
const handleConfirm = () => {
  if (selectedCharacterIndex.value === null) {
    ElMessage.warning("请先选择一个角色");
    return;
  }
  const selectedCharacter = characters.value[selectedCharacterIndex.value];
  console.log("[QuickCharacterSelector] handleConfirm:", selectedCharacter);

  // 保存完整数据：选中的角色 + 所有生成的卡片（不包括自定义卡片的占位符）
  const generatedCards = characters.value.filter((c) => c.name && c.name.trim() !== "");
  const fullData = {
    selectedData: selectedCharacter,
    generatedCards: generatedCards.length > 0 ? generatedCards : undefined, // 如果没有生成卡片，不保存该字段
  };

  const characterData = JSON.stringify(fullData);
  emit("confirm", characterData);
};

// 回退（带二次确认）
// 处理回退到当前步骤
const handleRevertToCurrent = () => {
  emit("revert-to-current");
};

const handleRevert = async () => {
  console.log("[QuickCharacterSelector] handleRevert");

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
    console.log("[QuickCharacterSelector] User cancelled revert");
  }
};

// 从props初始化数据
const initFromProps = () => {
  console.log("[QuickCharacterSelector] initFromProps");
  console.log("[QuickCharacterSelector] characterContent:", props.characterContent);

  if (props.characterContent) {
    try {
      const data = JSON.parse(props.characterContent);

      // 兼容新旧数据格式
      if (data.selectedData && data.generatedCards) {
        // 新格式：包含 selectedData 和 generatedCards
        console.log("[QuickCharacterSelector] Loading new format data with generated cards");

        // 有生成的卡片：展示所有生成的卡片（无论是否锁定）
        characters.value = data.generatedCards;
        // 找到选中的卡片索引
        const selectedIndex = characters.value.findIndex(
          (c: CharacterCardData) =>
            c.name === data.selectedData.name && c.mbti === data.selectedData.mbti
        );
        selectedCharacterIndex.value = selectedIndex !== -1 ? selectedIndex : 0;
        console.log(
          "[QuickCharacterSelector] Loaded all generated cards, selected index:",
          selectedCharacterIndex.value
        );
      } else {
        // 旧格式：只有选中的角色，兼容历史数据
        console.log("[QuickCharacterSelector] Loading old format data (backward compatibility)");
        characters.value = [data];
        selectedCharacterIndex.value = 0;
      }

      console.log("[QuickCharacterSelector] Loaded character from props:", data);
    } catch (e) {
      console.error("[QuickCharacterSelector] Failed to parse characterContent:", e);
    }
  }
};

// 监听props变化
watch(
  () => props.characterContent,
  (newVal, oldVal) => {
    console.log("[QuickCharacterSelector] characterContent changed:", { newVal, oldVal });

    // 如果内容被清空（从有内容变为空），重置状态
    if (oldVal && !newVal) {
      console.log("[QuickCharacterSelector] Content cleared, reset state");
      characters.value = [...EMPTY_CHARACTERS];
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
      console.log("[QuickCharacterSelector] triggerGenerate changed, trigger generate:", {
        newVal,
        oldVal,
      });
      // 检查条件：有故事梗概、有标签、未锁定（不管是否有角色内容都重新生成）
      if (
        props.storyContent &&
        props.storyContent.trim() !== "" &&
        props.selectedTagIds &&
        !props.locked
      ) {
        console.log("[QuickCharacterSelector] Conditions met, auto generate");
        characters.value = [...EMPTY_CHARACTERS];
        selectedCharacterIndex.value = null;
        setTimeout(() => {
          generateCharacters();
        }, 100);
      } else {
        console.log("[QuickCharacterSelector] Conditions not met, skip generate");
      }
    }
  }
);

// 组件挂载后，不自动生成，等待用户手动触发
onMounted(() => {
  console.log("[QuickCharacterSelector] onMounted");
  // 移除自动生成逻辑，避免重新打开页面时自动生成
  // 如果需要生成，用户可以点击"换一批"按钮
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

      <!-- 标题 -->
      <div class="section-title">请选择心仪的男/女主角设定</div>

      <!-- 卡片和编辑区容器 -->
      <div class="card-edit-container">
        <div class="character-edit-container" ref="characterGridRef">
          <div class="character-grid" :class="{ 'edit-mode': showEditPanel }">
            <div v-for="(character, index) in displayCharacters"
              :key="character ? character.name + character.mbti + index : 'custom-' + index"
              class="character-card-wrapper" :class="{
                selected: character && character.name && selectedCharacterIndex === index,
                'custom-wrapper': !character,
              }">
              <QuickCharacterCard v-if="character" :data="character"
                :show-edit="!!(!locked && character.name && !showEditPanel)" :loading="loading"
                :is-selected="selectedCharacterIndex === index" @click="handleSelectCharacter(character, index)"
                @edit="(e: MouseEvent) => handleEditCharacter(character, index, e)" />
              <QuickCharacterCard v-else :is-custom="true" :class="{ disabled: loading }"
                @click="(e?: MouseEvent) => e && handleShowCustomDialog(e)" />
            </div>
          </div>

          <!-- 换一批按钮 -->
          <div v-if="!locked && !showEditPanel" class="refresh-container">
            <el-button
              link
              type="info"
              class="refresh-btn"
              :disabled="loading"
              @click="generateCharacters"
            >
              <span class="iconfont refresh-icon">&#xe66f;</span>
              <span>换一批</span>
            </el-button>
          </div>
        </div>
        <!-- 内联编辑区：在 character-edit-container 内部，只占据卡片和换一批按钮区域 -->
        <Transition name="edit-panel">
          <div v-if="showEditPanel" class="edit-panel" :style="editPanelStyle" :class="{ animating: isAnimating }">
            <!-- 编辑已有角色 -->
            <div v-if="!isCustomMode" class="edit-panel-content">
              <!-- 性别图片：悬浮在右下角 -->
              <div class="character-gender-image-float">
                <img :src="customCharacter.gender === '女' ? FEMALE : MALE" alt="" />
              </div>

              <!-- 编辑区内容根据设计稿 node-id=62-15914 -->
              <div class="edit-form">
                <!-- 姓名 -->
                <div class="form-group form-group-name">
                  <label class="form-label">姓名：</label>
                  <div class="form-input-wrapper form-input-wrapper-name">
                    <el-input v-model="customCharacter.name" placeholder="请填入" :maxlength="MAX_NAME_LENGTH"
                      class="form-input" />
                    <span class="word-count">{{ (customCharacter.name || "").length }}/{{ MAX_NAME_LENGTH }}</span>
                  </div>
                </div>

                <!-- 性别 -->
                <div class="form-group form-group-gender">
                  <label class="form-label">性别：</label>
                  <div class="form-input-wrapper form-input-wrapper-gender">
                    <el-select v-model="customCharacter.gender" placeholder="请选择" class="form-select">
                      <el-option label="男" value="男" />
                      <el-option label="女" value="女" />
                    </el-select>
                  </div>
                </div>

                <!-- 人物标签 -->
                <div class="form-group form-group-tags">
                  <label class="form-label">人物标签：</label>
                  <div class="form-input-wrapper form-input-wrapper-tags">
                    <el-input v-model="customCharacter.abilities" placeholder="填写角色的特殊能力、金手指等（按、分割）"
                      :maxlength="MAX_ABILITIES_LENGTH" class="form-input" />
                    <span class="word-count">{{ (customCharacter.abilities || "").length }}/{{
                      MAX_ABILITIES_LENGTH
                      }}</span>
                  </div>
                </div>

                <!-- 人物身份 -->
                <div class="form-group form-group-identity">
                  <label class="form-label">人物身份：</label>
                  <div class="form-input-wrapper form-input-wrapper-identity">
                    <el-input v-model="customCharacter.identity" placeholder="如：重生农神、地下牧师（按、分割）"
                      :maxlength="MAX_IDENTITY_LENGTH" class="form-input" />
                    <span class="word-count">{{ (customCharacter.identity || "").length }}/{{ MAX_IDENTITY_LENGTH
                    }}</span>
                  </div>
                </div>

                <!-- 人物小传 -->
                <div class="form-group form-group-bio">
                  <label class="form-label">人物小传：</label>
                  <div class="form-input-wrapper form-input-wrapper-bio">
                    <el-input v-model="customCharacter.experiences" type="textarea" placeholder="填写角色的背景，过往经历、重要事件等"
                      :maxlength="MAX_EXPERIENCE_LENGTH" :rows="6" class="form-textarea" />
                    <span class="word-count word-count-bio">{{ (customCharacter.experiences || "").length }}/{{
                      MAX_EXPERIENCE_LENGTH
                      }}</span>
                  </div>
                </div>

                <!-- 操作按钮 -->
                <div class="edit-actions">
                  <el-button class="cancel-btn" @click="closeEditPanel">取消</el-button>
                  <el-button class="confirm-btn" @click="handleSaveCustomCharacter">确定</el-button>
                </div>
              </div>
            </div>

            <!-- 自定义角色 -->
            <div v-else class="edit-panel-content">
              <!-- 性别图片：悬浮在右下角 -->
              <div class="character-gender-image-float">
                <img :src="customCharacter.gender === '女' ? FEMALE : MALE" alt="" />
              </div>

              <!-- 编辑区内容：与编辑模式相同的表单结构 -->
              <div class="edit-form">
                <!-- 姓名 -->
                <div class="form-group form-group-name">
                  <label class="form-label">姓名：</label>
                  <div class="form-input-wrapper form-input-wrapper-name">
                    <el-input v-model="customCharacter.name" placeholder="请填入" :maxlength="MAX_NAME_LENGTH"
                      class="form-input" />
                    <span class="word-count">{{ (customCharacter.name || "").length }}/{{ MAX_NAME_LENGTH }}</span>
                  </div>
                </div>

                <!-- 性别 -->
                <div class="form-group form-group-gender">
                  <label class="form-label">性别：</label>
                  <div class="form-input-wrapper form-input-wrapper-gender">
                    <el-select v-model="customCharacter.gender" placeholder="请选择" class="form-select">
                      <el-option label="男" value="男" />
                      <el-option label="女" value="女" />
                    </el-select>
                  </div>
                </div>

                <!-- 人物标签 -->
                <div class="form-group form-group-tags">
                  <label class="form-label">人物标签：</label>
                  <div class="form-input-wrapper form-input-wrapper-tags">
                    <el-input v-model="customCharacter.abilities" placeholder="填写角色的特殊能力、金手指等（按、分割）"
                      :maxlength="MAX_ABILITIES_LENGTH" class="form-input" />
                    <span class="word-count">{{ (customCharacter.abilities || "").length }}/{{
                      MAX_ABILITIES_LENGTH
                      }}</span>
                  </div>
                </div>

                <!-- 人物身份 -->
                <div class="form-group form-group-identity">
                  <label class="form-label">人物身份：</label>
                  <div class="form-input-wrapper form-input-wrapper-identity">
                    <el-input v-model="customCharacter.identity" placeholder="如：重生农神、地下牧师（按、分割）"
                      :maxlength="MAX_IDENTITY_LENGTH" class="form-input" />
                    <span class="word-count">{{ (customCharacter.identity || "").length }}/{{ MAX_IDENTITY_LENGTH
                    }}</span>
                  </div>
                </div>

                <!-- 人物小传 -->
                <div class="form-group form-group-bio">
                  <label class="form-label">人物小传：</label>
                  <div class="form-input-wrapper form-input-wrapper-bio">
                    <el-input v-model="customCharacter.experiences" type="textarea" placeholder="填写角色的背景，过往经历、重要事件等"
                      :maxlength="MAX_EXPERIENCE_LENGTH" :rows="6" class="form-textarea" />
                    <span class="word-count word-count-bio">{{ (customCharacter.experiences || "").length }}/{{
                      MAX_EXPERIENCE_LENGTH
                      }}</span>
                  </div>
                </div>

                <!-- 操作按钮 -->
                <div class="edit-actions">
                  <el-button class="cancel-btn" @click="closeEditPanel">取消</el-button>
                  <el-button class="confirm-btn" @click="handleSaveCustomCharacter">确定</el-button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- 底部操作区 -->
    <div v-if="!showEditPanel" class="footer-actions">
      <el-button v-if="!locked" type="primary" class="confirm-btn" :disabled="!hasSelectedCharacter"
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
  padding: 50px 120px 50px 0px;
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
    overflow: hidden;
  }

  .character-edit-container {
    position: relative;
    padding: 5px 2px 2px 2px; // 增加顶部padding，确保阴影不被截断
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

  // 编辑模式时禁用滚动
  &.edit-mode {
    .character-edit-container {
      overflow: hidden;
    }
  }
}

.character-grid {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap; // 允许换行
  flex-shrink: 0;
  margin-bottom: 32px;
  margin-left: -30px;
  margin-top: 5px; // 调整顶部margin，配合容器padding确保阴影完整显示
  position: relative; // 为编辑区提供定位参考

  &.edit-mode {
    opacity: 0.3;
    pointer-events: none;
  }

  .character-card-wrapper {
    display: flex;
    flex-direction: row;
    margin-left: 30px;
    margin-top: 30px;
    flex: 0 0 calc(25% - 30px); // 始终保持一行4个，每个占25%减去间距
    max-width: calc(25% - 30px);
    height: 380px; // 固定高度，确保所有卡片高度一致
    min-height: 380px; // 最小高度
    max-height: 380px; // 最大高度，与生成后的卡片高度保持一致

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

  .custom-wrapper {
    display: flex;
    flex-direction: row;
    margin-left: 30px;
    margin-top: 30px;
    flex: 0 0 calc(25% - 30px); // 始终保持一行4个
    max-width: calc(25% - 30px);
    height: 380px; // 固定高度，与生成后的卡片高度保持一致
    min-height: 380px; // 最小高度
    max-height: 380px; // 最大高度，与生成后的卡片高度保持一致

    &.disabled {
      cursor: not-allowed;
      opacity: 0.6;
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
    padding: 30px 50px;
    padding-bottom: clamp(30px, 5vh, 50px); // 底部padding，确保按钮有足够空间
    position: relative;
    height: 100%; // 与故事梗概编辑区保持一致
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

    // 性别图片：悬浮在右下角
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

        // 姓名和性别输入框：固定宽度，但与其他输入框左对齐
        &.form-group-name,
        &.form-group-gender {
          .form-input-wrapper {
            flex: 0 0 auto;
            width: 327px;
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
        margin-top: clamp(20px, 3vh, 40px); // 顶部间距，确保与表单内容有足够距离
        margin-bottom: 20px;
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
