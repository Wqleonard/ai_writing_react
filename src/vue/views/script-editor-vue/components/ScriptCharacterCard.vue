<script setup lang="ts">
import { ref, computed } from "vue";
import { ElMessage } from "element-plus";
import FEMALE from "@/assets/images/quick_creation/character_woman_sex.svg";
import MALE from "@/assets/images/quick_creation/character_man_sex.svg";
import CUSTOMSEX from "@/assets/images/quick_creation/character_custom_sex.svg";
import EditIcon from "@/assets/images/quick_creation/edit.svg";
import { addNote } from "@/api/notes";
import type { NoteSourceType, ScriptCharacterCardData } from "@/vue/utils/interfaces";


interface Props {
  data?: ScriptCharacterCardData;
  /** 剧本模式：使用此结构时展示 name / definition / age / personality / biography */
  showEdit?: boolean;
  /** 是否展示删除图标（未锁定时且有角色名时由父组件传入） */
  showDelete?: boolean;
  isCustom?: boolean; // 是否为自定义卡片
  loading?: boolean; // 是否显示加载状态
  isSelected?: boolean; // 是否被选中
  /** 编辑区右侧紧凑展示：标签行只显示第一个标签 + "...."，无渐变遮罩 */
  compactTags?: boolean;
}

interface Emits {
  (e: "click", event?: MouseEvent): void;
  (e: "edit", event: MouseEvent): void;
  (e: "delete", event: MouseEvent): void;
}

const props = withDefaults(defineProps<Props>(), {
  showEdit: false,
  showDelete: false,
  isCustom: false,
  loading: false,
  isSelected: false,
  compactTags: false,
});

const emit = defineEmits<Emits>();

const isCardHovered = ref(false);

// 根据 definition 是否包含「女」选图：含女用 MALE，否则 FEMALE（按需求说明）
const genderImage = computed(() =>
  props.data?.definition?.includes("女") ? FEMALE : MALE
);

// personality 按 、 切割为标签数组
const personalityTags = computed(() => {
  const s = props.data?.personality?.trim();
  if (!s) return [];
  return s.split(/[、,，]/).map((t) => t.trim()).filter(Boolean);
});

const handleClick = (event?: MouseEvent) => {
  // 点击卡片：由父组件决定是选中还是直接打开编辑（正常卡片区不展示选中态，直接打开编辑区）
  emit("click", event);
};

const handleEdit = (e: MouseEvent) => {
  e.stopPropagation();
  emit("edit", e);
};

const handleDelete = (e: MouseEvent) => {
  e.stopPropagation();
  emit("delete", e);
};

// 添加笔记（剧本卡片：name / definition / age / personality / biography）
const handleAddNote = async (e: MouseEvent) => {
  e.stopPropagation();
  if (!props.data?.name) {
    ElMessage.warning("角色信息不完整，无法添加笔记");
    return;
  }
  const parts: string[] = [];
  if (props.data.definition) parts.push(`身份：${props.data.definition}`);
  if (props.data.age) parts.push(props.data.age);
  if (props.data.personality) parts.push(props.data.personality);
  if (props.data.biography) parts.push(props.data.biography);
  const content = parts.join("\n\n");
  if (!content) {
    ElMessage.warning("角色内容为空，无法添加笔记");
    return;
  }
  try {
    await addNote(props.data.name, content, "PC_ADD" as NoteSourceType);
    ElMessage.success("笔记添加成功");
  } catch (error) {
    console.error("添加笔记失败:", error);
    ElMessage.error("添加笔记失败，请重试");
  }
};
</script>

<template>
  <!-- 自定义卡片 -->
  <div v-if="isCustom" class="quick-character-card custom-card" @click="handleClick">
    <!-- 背景图片 -->
    <div class="character-gender-bg custom-bg">
      <img :src="CUSTOMSEX" alt="" />
    </div>

    <!-- 内容 -->
    <div class="character-content custom-content">
      <div class="custom-text">自定义角色</div>
      <div class="custom-icon">
        <div class="plus-circle">
          <div class="plus-horizontal"></div>
          <div class="plus-vertical"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- 角色卡片 -->
  <div v-else class="quick-character-card" @click="handleClick"
    @mouseenter="isCardHovered = true" @mouseleave="isCardHovered = false">
    <!-- 骨架图加载状态（纯CSS，避免 el-skeleton-item 在部分场景未渲染） -->
    <div v-if="props.loading || !props.data?.name" class="character-card-skeleton">
      <div class="script-character-skeleton-item skeleton-line-name"></div>
      <div class="script-character-skeleton-item skeleton-line-tags"></div>
      <div class="script-character-skeleton-item skeleton-line-desc"></div>
      <div class="script-character-skeleton-item skeleton-line-footer"></div>
    </div>

    <!-- 内容区域：设计稿 413-19008 四行布局 -->
    <template v-else>
      <div class="character-gender-bg">
        <img :src="genderImage" alt="" />
      </div>

      <div class="character-content">
        <!-- 第一行：姓名（单行...）+ 右上角 添加笔记、编辑（小号绝对定位） -->
        <div class="row-name">
          <div class="character-name" :title="props.data?.name">{{ props.data?.name }}</div>
          <div v-if="isCardHovered" class="header-actions">
            <span class="add-note-btn" @click="handleAddNote">添加笔记</span>
            <span v-if="showEdit" class="edit-btn" @click="handleEdit">
              <!-- <img :src="EditIcon" alt="编辑" class="edit-icon" /> -->
              编辑
            </span>
            <span v-if="showDelete" class="delete-btn" @click="handleDelete" title="删除角色">删除</span>
          </div>
        </div>

        <!-- 第二行：左右布局 definition | age，单行过长... -->
        <div class="row-definition-age">
          <div class="definition-text" :title="props.data?.definition">{{ props.data?.definition }}</div>
          <div class="age-text" :title="props.data?.age">{{ props.data?.age }}</div>
        </div>

        <!-- 第三行：personality 标签。紧凑模式（编辑区右侧）仅展示第一项+....；否则单行超出隐藏+右侧渐变省略 -->
        <div class="row-tags" :class="{ 'row-tags-compact': compactTags }">
          <div v-if="compactTags" class="tags-inner tags-inner-compact">
            <span v-if="personalityTags[0]" class="character-tag">{{ personalityTags[0] }}</span>
            <span class="tags-ellipsis">...</span>
          </div>
          <div v-else class="tags-inner">
            <span v-for="(tag, i) in personalityTags" :key="i" class="character-tag">{{ tag }}</span>
          </div>
        </div>

        <!-- 第四行：biography 多行可滚动，自上而下透明度渐变 -->
        <div class="row-biography">
          <div class="biography-mask"></div>
          <div class="biography-text">{{ props.data?.biography }}</div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="less">
.quick-character-card {
  width: 100%;
  height: 100%;
  padding: 20px 20px 20px 20px;
  background: #fff8e5;
  border-radius: 10px;
  box-shadow: 5px 5px 5px 0px rgba(58, 37, 0, 0.15);
  box-sizing: border-box;
  position: relative;
  cursor: pointer;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;

  .character-gender-bg {
    position: absolute;
    right: -20px;
    bottom: -20px;
    width: 167px;
    height: 175px;
    pointer-events: none;
    z-index: 0;

    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  }

  .character-content {
    display: flex;
    flex-direction: column;
    gap: 15px;
    position: relative;
    z-index: 1;
    flex: 1;
    min-height: 0;
  }

  /* 第一行：姓名单行... + 右上角 添加笔记、编辑（小号绝对定位） */
  .row-name {
    position: relative;
    flex-shrink: 0;
    // height: 42px;
    min-width: 0;

    .character-name {
      font-size: 20px;
      font-weight: 700;
      line-height: 1.32;
      letter-spacing: 0.04em;
      color: #464646;
      // padding-right: 75px; /* 留给右上角按钮 */
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      display: block;
    }

    .header-actions {
      position: absolute;
      top: -15px;
      right: -15px;
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #999999;

      .add-note-btn,
      .edit-btn {
        cursor: pointer;
        white-space: nowrap;
        display: inline-flex;
        align-items: center;
      }
      .edit-btn {
        gap: 2px;
      }
      .edit-icon {
        width: 12px;
        height: 12px;
      }
      .add-note-btn:hover,
      .edit-btn:hover {
        color: var(--bg-editor-save);
      }
      .delete-btn {
        display: inline-flex;
        align-items: center;
        cursor: pointer;
        color: #999999;
        transition: color 0.2s;
      }
      .delete-btn:hover {
        color: #f56c6c;
      }
    }
  }

  /* 第二行：definition 左 | age 右，单行... */
  .row-definition-age {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
    min-width: 0;

    .definition-text {
      flex: 1;
      min-width: 0;
      font-size: 14px;
      font-weight: 400;
      line-height: 1.32;
      color: #464646;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .age-text {
      flex-shrink: 0;
      font-size: 14px;
      font-weight: 400;
      line-height: 1.32;
      color: #464646;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 80px;
      text-align: right;
    }
  }

  /* 第三行：personality 标签 */
  .row-tags {
    flex-shrink: 0;
    position: relative;
    min-width: 0;
    width: 100%;
    overflow: hidden;

    .tags-inner {
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;
      gap: 5px;
      overflow: hidden;
      min-width: 0;
    }

    .tags-inner-compact {
      overflow: visible;
      align-items: center;
    }

    .tags-ellipsis {
      font-size: 13px;
      font-weight: 400;
      line-height: 1.32;
      color: #8a8a8a;
      margin-left: 4px;
      flex-shrink: 0;
    }

    .character-tag {
      flex-shrink: 0;
      padding: 6px 12px;
      border-radius: 21px;
      background: rgba(239, 175, 0, 0.2);
      font-size: 13px;
      font-weight: 400;
      line-height: 1.32;
      color: #4d4d4d;
      white-space: nowrap;
    }

    /* 非紧凑模式：右侧渐变遮罩 + 省略号（仅主列表生效，编辑区右侧不显示） */
    &:not(.row-tags-compact)::after {
      content: '';
      position: absolute;
      right: 0;
      top: 0;
      height: 100%;
      width: 8%;
      // transform: translateY(-50%);
      // padding: 6px 4px 6px 14px;
      background: linear-gradient(to right, transparent 0%, rgba(255, 248, 229, 0.4) 20%, rgba(255, 248, 229, 0.95) 100%);
      font-size: 12px;
      font-weight: 400;
      line-height: 1.32;
      color: #8a8a8a;
      pointer-events: none;
      // min-width: 32px;
      text-align: right;
    }
  }

  /* 第四行：biography 多行可滚动，自上而下透明度渐变 */
  .row-biography {
    flex: 1;
    min-height: 80px; /* 保证有可滚动区域 */
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;

    .biography-mask {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 48px;
      background: linear-gradient(180deg, rgba(255, 248, 229, 0) 0%, rgba(255, 248, 229, 1) 100%);
      pointer-events: none;
      z-index: 1;
    }

    .biography-text {
      flex: 1;
      min-height: 0;
      width: 100%;
      overflow-y: auto;
      overflow-x: hidden;
      font-size: 14px;
      font-weight: 400;
      line-height: 1.32;
      letter-spacing: 0.04em;
      color: #464646;
      text-align: justify;
      padding-right: 6px;
      box-sizing: border-box;
      padding-bottom: 20px;
      -webkit-mask-image: linear-gradient(180deg, #000 0%, #000 70%, transparent 100%);
      mask-image: linear-gradient(180deg, #000 0%, #000 70%, transparent 100%);

      &::-webkit-scrollbar {
        width: 4px;
      }
      &::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 4px;
      }
    }
  }

  // 自定义卡片：文字与图标随窗口/卡片尺寸缩放，避免被截断
  &.custom-card {
    background: transparent;
    border: 2px dashed #d9d9d9;
    border-radius: 12px;
    box-shadow: 0px 0px 25px 0px rgba(58, 37, 0, 0.15);
    padding: 8%;
    transition: border-color 0.3s ease;
    outline: none !important;
    overflow: hidden;

    &:hover {
      border-color: var(--theme-color, rgba(239, 175, 0, 1));
      border-style: dashed;
      outline: none !important;
    }

    .custom-bg {
      right: -15%;
      bottom: -15%;
      width: min(180px, 65%);
      height: min(190px, 65%);
      opacity: 0.6;
    }

    .custom-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      min-height: 0;
      box-sizing: border-box;
      gap: 0;
    }

    .custom-text {
      font-size: clamp(14px, 2.8vmin, 28px);
      font-weight: 700;
      line-height: 1.32;
      letter-spacing: 0.04em;
      color: #d9d9d9;
      text-align: center;
      word-break: keep-all;
      padding: 0 4px;
      flex-shrink: 0;
      max-width: 100%;
      margin-bottom: 12px; /* 与下方加号图标间距 */
    }

    /* 加号容器：固定宽高比 1:1，避免变形 */
    .custom-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: min(72px, 28%);
      aspect-ratio: 1;
      max-width: 72px;
      max-height: 72px;
    }

    .plus-circle {
      position: relative;
      width: 100%;
      height: 100%;
      aspect-ratio: 1;
      border: 2px solid #c8c8c8;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .plus-horizontal {
      position: absolute;
      width: 50%;
      height: 0;
      border-top: 2px solid #c8c8c8;
      left: 50%;
      transform: translateX(-50%);
    }

    .plus-vertical {
      position: absolute;
      width: 0;
      height: 50%;
      border-left: 2px solid #c8c8c8;
      top: 50%;
      transform: translateY(-50%);
    }
  }
}

.character-card-skeleton {
  width: 100%;
  height: 100%; // 与父容器高度一致（380px）
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  align-items: stretch;
  box-sizing: border-box;
  position: relative;
  z-index: 1;

  .script-character-skeleton-item {
    position: relative;
    overflow: hidden;
    background: #e8e8e8 !important;
    border-radius: 4px;
    width: 100% !important;
    opacity: 1 !important;

    &::after {
      content: "";
      position: absolute;
      top: 0;
      left: -150%;
      width: 60%;
      height: 100%;
      background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0) 0%,
        rgba(255, 255, 255, 0.75) 50%,
        rgba(255, 255, 255, 0) 100%
      );
      animation: script-skeleton-shimmer 1.3s ease-in-out infinite;
    }
  }

  .skeleton-line-name {
    height: 42px;
  }

  .skeleton-line-tags {
    height: 28px;
  }

  .skeleton-line-desc {
    height: 90px;
  }

  .skeleton-line-footer {
    height: 40px;
  }
}

@keyframes script-skeleton-shimmer {
  0% {
    left: -70%;
  }
  100% {
    left: 120%;
  }
}
</style>
