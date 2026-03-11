<script setup lang="ts">
import { ElMessage } from "element-plus";
import FEMALE from "@/vue/assets/images/quick_creation/character_woman_sex.svg";
import MALE from "@/vue/assets/images/quick_creation/character_man_sex.svg";
import CUSTOMSEX from "@/vue/assets/images/quick_creation/character_custom_sex.svg";
import EditIcon from "@/vue/assets/images/quick_creation/edit.svg";
import { addNote } from "@/api/notes";
import type { NoteSourceType } from "@/utils/interfaces";
import { ElSkeleton, ElSkeletonItem } from "element-plus";

export interface QuickCharacterCardData {
  name: string;
  gender: string;
  age: string;
  bloodType: string;
  mbti: string;
  experiences: string;
  personality: string;
  abilities: string;
  identity: string;
}

interface Props {
  data?: QuickCharacterCardData;
  showEdit?: boolean;
  isCustom?: boolean; // 是否为自定义卡片
  loading?: boolean; // 是否显示加载状态
  isSelected?: boolean; // 是否被选中
}

interface Emits {
  (e: "click", event?: MouseEvent): void;

  (e: "edit", event: MouseEvent): void;
}

const props = withDefaults(defineProps<Props>(), {
  showEdit: false,
  isCustom: false,
  loading: false,
  isSelected: false,
});

const emit = defineEmits<Emits>();

const handleClick = (event?: MouseEvent) => {
  // 如果卡片已被选中，点击整个卡片触发编辑
  if (props.isSelected && props.showEdit && !props.isCustom) {
    if (event) {
      emit("edit", event);
    }
  } else {
    // 如果未被选中，触发选中
    emit("click", event);
  }
};

const handleEdit = (e: MouseEvent) => {
  e.stopPropagation();
  emit("edit", e);
};

// 添加笔记
const handleAddNote = async (e: MouseEvent) => {
  e.stopPropagation();

  if (!props.data?.name) {
    ElMessage.warning("角色信息不完整，无法添加笔记");
    return;
  }

  // 拼接角色内容：标签 + abilities + experiences + identity
  const contentParts: string[] = [];

  // 添加标签信息（只取前三个，跟展示逻辑一样：gender、age、mbti）
  const tagParts: string[] = [];
  if (props.data.gender) {
    tagParts.push(props.data.gender);
  }
  if (props.data.age) {
    tagParts.push(props.data.age);
  }
  if (props.data.mbti) {
    tagParts.push(props.data.mbti);
  }
  // 只取前三个标签，不包含 bloodType
  if (tagParts.length > 0) {
    contentParts.push(tagParts.join("、"));
  }

  // 添加能力描述
  if (props.data.abilities) {
    contentParts.push(props.data.abilities);
  }

  // 添加经历描述
  if (props.data.experiences) {
    contentParts.push(props.data.experiences);
  }

  // 添加身份
  if (props.data.identity) {
    contentParts.push(`身份：${props.data.identity}`);
  }

  const content = contentParts.join("\n\n");

  if (!content) {
    ElMessage.warning("角色内容为空，无法添加笔记");
    return;
  }

  try {
    await addNote(
        props.data.name,
        content,
        "PC_ADD" as NoteSourceType
    );
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
      <img :src="CUSTOMSEX" alt=""/>
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
  <div v-else class="quick-character-card" @click="handleClick">
    <!-- 骨架图加载状态 -->
    <el-skeleton v-if="props.loading || !props.data?.name" class="character-card-skeleton" animated>
      <template #template>
        <el-skeleton-item variant="rect" style="height: 42px; margin-top: 0; margin-bottom: 25px;"/>
        <el-skeleton-item variant="rect" style="height: 28px; margin-bottom: 25px;"/>
        <el-skeleton-item variant="rect" style="height: 90px; margin-bottom: 25px;"/>
        <el-skeleton-item variant="rect" style="height: 40px;"/>
      </template>
    </el-skeleton>

    <!-- 内容区域 -->
    <template v-else>
      <!-- 性别图片背景 -->
      <div class="character-gender-bg">
        <img :src="props.data?.gender === '女' ? FEMALE : MALE" alt=""/>
      </div>

      <!-- 内容区域 -->
      <div class="character-content">
        <!-- 头部：名称和编辑按钮 -->
        <div class="character-header">
          <div class="character-name">{{ props.data?.name }}</div>
          <div class="header-actions">
            <div class="add-note-btn" @click="handleAddNote">
              <span class="add-note-text">添加笔记</span>
            </div>
            <div v-if="showEdit" class="edit-btn" @click="handleEdit">
              <img :src="EditIcon" alt="编辑" class="edit-icon"/>
              <span class="edit-text">编辑</span>
            </div>
          </div>
        </div>

        <!-- 标签 -->
        <div class="character-tags">
          <div v-if="props.data?.gender" class="character-tag">{{ props.data.gender }}</div>
          <div v-if="props.data?.age" class="character-tag">{{ props.data.age }}</div>
          <div v-if="props.data?.bloodType" class="character-tag">{{ props.data.bloodType }}</div>
          <div v-if="props.data?.mbti" class="character-tag">{{ props.data.mbti }}</div>
        </div>

        <!-- 描述 -->
        <div class="character-description">
          <div v-if="props.data?.abilities" class="description-item">
            {{ props.data.abilities }}
          </div>

          <!-- <div v-if="props.data?.identity" class="description-item">
            {{ props.data.identity }}
          </div> -->
          <!-- <div v-if="props.data?.personality" class="description-item">
            {{ props.data.personality }}
          </div> -->
          <div v-if="props.data?.experiences" class="description-item">
            {{ props.data.experiences }}
          </div>

        </div>

        <!-- 身份 -->
        <div class="character-identity">
          <div class="identity-title">身份</div>
          <div class="identity-divider"></div>
          <div class="identity-desc">{{ props.data?.identity }}</div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="less">
.quick-character-card {
  width: 100%;
  height: 100%; // 由父容器控制高度，固定为380px
  padding: clamp(18px, 1.8vw, 26px); // 增大padding
  background: #fff8e5;
  border-radius: 10px;
  box-shadow: 0px 0px 20px 0px rgba(58, 37, 0, 0.15);
  box-sizing: border-box;
  position: relative;
  cursor: pointer;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  .character-gender-bg {
    position: absolute;
    right: -23px;
    bottom: -23px;
    width: 222.3px;
    height: 234px;
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
    position: relative;
    z-index: 1;
    height: 100%;
  }

  .character-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    height: auto; // 自适应高度
    margin-bottom: clamp(15px, 2vh, 25px); // 自适应间距
    width: 100%;
    min-width: 0;
    flex-shrink: 0; // 头部不缩小

    .header-actions {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 12px;
    }
  }

  .character-name {
    font-size: clamp(22px, 2.8vw, 24px); // 增大字体范围
    font-weight: 700;
    line-height: 1.32em;
    letter-spacing: 0.04em;
    color: #464646;
    margin-top: -3px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .add-note-btn {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    cursor: pointer;
    width: auto;
    height: auto;
    flex-shrink: 0;
    white-space: nowrap;

    .add-note-text {
      font-size: clamp(12px, 1.2vw, 16px);
      font-weight: 400;
      line-height: 1.32em;
      letter-spacing: 0.04em;
      color: #999999;
      white-space: nowrap;
      flex-shrink: 0;
    }

    &:hover .add-note-text {
      color: var(--bg-editor-save);
    }
  }

  .edit-btn {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    cursor: pointer;
    width: auto; // 自适应宽度
    height: auto;
    flex-shrink: 0;
    white-space: nowrap;

    .edit-icon {
      width: clamp(14px, 1.5vw, 18.56px); // 自适应图标大小
      height: clamp(14px, 1.5vw, 18.56px);
      flex-shrink: 0;
      margin-right: clamp(3px, 0.4vw, 5px);
    }

    .edit-text {
      font-size: clamp(12px, 1.2vw, 16px); // 自适应字体
      font-weight: 400;
      line-height: 1.32em;
      letter-spacing: 0.04em;
      color: #999999;
      white-space: nowrap;
      flex-shrink: 0;
    }

    &:hover .edit-text {
      color: var(--bg-editor-save);
    }
  }

  .character-tags {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    // width: 242px;
    margin-bottom: clamp(18px, 2.2vh, 28px); // 增大间距
    margin-left: -5px;
    margin-top: -5px;
    flex-shrink: 0; // 标签区域不缩小

    .character-tag {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      padding: clamp(5px, 0.6vh, 7px) clamp(10px, 1.2vw, 14px); // 增大padding
      border-radius: 21px;
      background: rgba(239, 175, 0, 0.2);
      font-size: clamp(12px, 1.1vw, 14px); // 增大字体
      font-weight: 400;
      line-height: 1.32em;
      letter-spacing: 0.04em;
      color: #4d4d4d;
      white-space: nowrap;
      margin-left: 5px;
      margin-top: 5px;
    }
  }

  .character-description {
    font-size: clamp(14px, 1.3vw, 17px); // 增大字体
    font-weight: 400;
    line-height: 1.5em;
    color: #464646;
    text-align: justify;
    // width: 280px;
    flex: 1; // 允许描述区域自适应高度
    min-height: clamp(140px, 18vh, 220px); // 增大最小高度
    margin-bottom: clamp(18px, 2.2vh, 28px); // 增大间距
    overflow-y: auto;
    display: flex;
    flex-direction: column;

    .description-item {
      word-wrap: break-word;
      overflow-wrap: break-word;
      word-break: break-word;
      margin-bottom: clamp(14px, 1.7vh, 18px); // 增大间距

      &:last-child {
        margin-bottom: 0;
      }
    }
  }

  .character-identity {
    display: flex;
    flex-direction: column;
    width: fit-content;
    flex-shrink: 0; // 身份区域不缩小

    .identity-title {
      font-size: clamp(14px, 1.3vw, 17px); // 增大字体
      font-weight: 400;
      line-height: 1.32em;
      color: #464646;
      margin-bottom: clamp(4px, 0.5vh, 6px); // 增大间距
    }

    .identity-divider {
      width: clamp(100px, 11vw, 130px); // 增大宽度
      height: 1px;
      background: linear-gradient(90deg, rgba(222, 222, 222, 1) 0%, rgba(77, 77, 77, 0) 75%);
      margin-bottom: clamp(4px, 0.5vh, 6px); // 增大间距
    }

    .identity-desc {
      font-size: clamp(13px, 1.2vw, 15px); // 增大字体
      font-weight: 400;
      line-height: 1.32em;
      color: #9a9a9a;
      max-width: clamp(180px, 20vw, 240px); // 增大最大宽度
    }
  }

  // 自定义卡片样式
  &.custom-card {
    background: transparent;
    border: 2.568px dashed #d9d9d9;
    border-radius: 12.84px;
    box-shadow: 0px 0px 25.68px 0px rgba(58, 37, 0, 0.15);
    padding: 0;
    transition: border-color 0.3s ease;
    outline: none !important;

    &:hover {
      border-color: var(--theme-color, rgba(239, 175, 0, 1));
      border-style: dashed;
      outline: none !important;
    }

    .custom-bg {
      right: clamp(-20px, -2vw, -25.68px); // 自适应位置
      bottom: clamp(-24px, -2.5vh, -29.53px);
      width: clamp(170px, 18vw, 213.47px); // 自适应宽度
      height: clamp(180px, 19vh, 224.7px); // 自适应高度
    }

    .custom-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      box-sizing: border-box;
    }

    .custom-text {
      font-size: clamp(20px, 3.5vw, 42px); // 自适应字体，最小20px，首选3.5vw，最大42px
      font-weight: 700;
      line-height: 1.32em;
      letter-spacing: 0.04em;
      color: #d9d9d9;
      text-align: center; // 居中对齐
      margin-bottom: clamp(25px, 3vh, 38.52px); // 自适应间距
      word-break: keep-all; // 保持词语完整性
      padding: 0 10px; // 左右留一点内边距
    }

    .custom-icon {
      display: flex;
      margin-bottom: clamp(30px, 4vh, 50px); // 自适应间距
      flex-direction: row;
      align-items: center;
      justify-content: center;
      width: clamp(80px, 9vw, 113.42px); // 自适应宽度
      height: clamp(80px, 9vw, 113.42px); // 自适应高度
    }

    .plus-circle {
      position: relative;
      width: 100%; // 使用百分比
      height: 100%;
      border: clamp(5px, 0.6vw, 7.29px) solid #c8c8c8; // 自适应边框
      border-radius: 50%;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
    }

    .plus-horizontal {
      position: absolute;
      width: 40%; // 使用百分比
      height: 0;
      border-top: clamp(5px, 0.6vw, 7.29px) solid #c8c8c8; // 自适应边框
      left: 50%;
      transform: translateX(-50%);
    }

    .plus-vertical {
      position: absolute;
      width: 0;
      height: 40%; // 使用百分比
      border-left: clamp(5px, 0.6vw, 7.29px) solid #c8c8c8; // 自适应边框
      top: 50%;
      transform: translateY(-50%);
    }
  }
}

.character-card-skeleton {
  width: 100%;
  height: 100%; // 与父容器高度一致（380px）
  padding: clamp(18px, 1.8vw, 26px); // 与卡片padding保持一致
  box-sizing: border-box;
  position: relative;
  z-index: 1;

  :deep(.el-skeleton__item) {
    background: linear-gradient(90deg, #f2f2f2 25%, #e6e6e6 50%, #f2f2f2 75%);
    background-size: 400% 100%;
    border-radius: 4px;
    width: 100%;
  }
}
</style>
