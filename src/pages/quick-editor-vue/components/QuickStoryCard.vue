<script setup lang="ts">
import { ElMessage } from "element-plus";
import EditIcon from "@/assets/images/quick_creation/edit.svg";
import StoryCoverImage from "@/assets/images/quick_creation/story_card_cover.png";
import PlotConflictIcon from "@/assets/images/quick_creation/plot_conflict.svg";
import EmotionalHeartIcon from "@/assets/images/quick_creation/emotional_heart.svg";
import StarIcon from "@/assets/images/quick_creation/star.svg";
import { addNote } from "@/api/notes";
import type { NoteSourceType } from "@/utils/interfaces";

export interface QuickStoryCardData {
  title: string;
  intro: string;
  theme: string;
  tags?: string[]; // 标签，如 #电竞、#搞笑、#系统
  conflictLevel?: string; // 剧情冲突：极高
  emotionIndex?: string; // 情感指数
  coverImage?: string; // 封面图片
}

interface Props {
  data?: QuickStoryCardData;
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

  if (!props.data?.title || !props.data?.intro) {
    ElMessage.warning("故事内容不完整，无法添加笔记");
    return;
  }

  try {
    await addNote(
      props.data.title,
      props.data.intro,
      "PC_ADD" as NoteSourceType
    );
    ElMessage.success("笔记添加成功");
  } catch (error) {
    console.error("添加笔记失败:", error);
    ElMessage.error("添加笔记失败，请重试");
  }
};

// 默认标签（暂时写死）
const defaultTags = ["#电竞", "#搞笑", "#系统"];
// 默认剧情冲突和情感指数（暂时写死）
const defaultConflictLevel = "极高";
const defaultEmotionIndex = "";
</script>

<template>
  <!-- 自定义卡片 -->
  <div v-if="isCustom" class="quick-story-card custom-card" @click="handleClick">
    <!-- 内容 -->
    <div class="story-content custom-content">
      <div class="custom-text">自定义故事</div>
      <div class="custom-icon">
        <div class="plus-circle">
          <div class="plus-horizontal"></div>
          <div class="plus-vertical"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- 故事卡片 -->
  <div v-else class="quick-story-card" @click="handleClick">
    <!-- 骨架图加载状态 -->
    <el-skeleton v-if="props.loading || !props.data?.title" class="story-card-skeleton" animated>
      <template #template>
        <el-skeleton-item variant="rect" style="height: 120px; margin-top: 0; margin-bottom: 25px;" />
        <el-skeleton-item variant="rect" style="height: 120px; margin-bottom: 25px;" />
        <el-skeleton-item variant="rect" style="height: 28px; margin-bottom: 25px;" />
        <el-skeleton-item variant="rect" style="height: 55px;" />
      </template>
    </el-skeleton>

    <!-- 内容区域 -->
    <template v-else>
      <!-- 内容区域 -->
      <div class="story-content">
        <!-- 头部：编辑按钮和添加笔记 -->
        <div class="story-header">
          <div class="add-note-btn" @click="handleAddNote">
            <span class="add-note-text">添加笔记</span>
          </div>
          <div v-if="showEdit" class="edit-btn" @click="handleEdit">
            <img :src="EditIcon" alt="编辑" class="edit-icon" />
            <span class="edit-text">编辑</span>
          </div>
        </div>

        <!-- 书名和封面 -->
        <div class="story-title-section">
          <div class="story-cover">
            <img :src="StoryCoverImage" alt="封面" class="cover-image" />
          </div>
          <div class="story-title">《{{ props.data?.title }}》</div>
        </div>

        <!-- 梗概 -->
        <div class="story-intro">
          <div class="intro-text">梗概：{{ props.data?.intro }}</div>
        </div>

        <!-- 标签 -->
        <div class="story-tags">
          <div v-for="(tag, index) in props.data?.tags || defaultTags" :key="index" class="story-tag">
            {{ tag }}
          </div>
        </div>

        <!-- 剧情冲突和情感指数 -->
        <div class="story-metrics">
          <div class="metrics-group">
            <div class="metric-item metric-item-conflict">
              <div class="metric-icon">
                <img :src="PlotConflictIcon" alt="剧情冲突" />
              </div>
              <div class="metric-text">
                剧情冲突：{{ props.data?.conflictLevel || defaultConflictLevel }}
              </div>
            </div>
            <div class="metric-item metric-item-emotion">
              <div class="metric-icon">
                <img :src="EmotionalHeartIcon" alt="情感指数" />
              </div>
              <div class="metric-text">情感指数：</div>
              <div class="metric-stars">
                <img v-for="i in 5" :key="i" :src="StarIcon" alt="星" class="star-icon" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="less">
.quick-story-card {
  width: 100%;
  height: 100%; // 由父容器控制高度
  max-height: calc((100vh - 350px) * 0.9); // 视口高度减去其他元素
  min-height: 400px; // 提高最小高度，确保底部内容可见
  padding: clamp(15px, 1.5vw, 23px); // 自适应padding
  background: #fff8e5;
  border-radius: 10px;
  box-shadow: 0px 0px 20px 0px rgba(58, 37, 0, 0.15);
  box-sizing: border-box;
  position: relative;
  cursor: pointer;
  overflow: hidden; // 保持hidden以维持圆角效果
  display: flex;
  flex-direction: column;

  // 针对超宽屏（宽高比 > 2:1）优化
  @media (min-width: 2000px) and (max-height: 1200px) {
    min-height: 450px; // 在超宽屏上提高最小高度
    max-height: calc((100vh - 300px) * 0.95); // 在超宽屏上使用更大的高度比例
  }

  &.custom-card {
    border: 2.568px dashed #d9d9d9;
    background: transparent;
    box-shadow: 0px 0px 25.68px 0px rgba(58, 37, 0, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.3s ease;
    outline: none !important;

    &:hover {
      border-color: var(--theme-color, rgba(239, 175, 0, 1));
      border-style: dashed;
      outline: none !important;
    }
  }

  .story-card-skeleton {
    width: 100%;
    height: 100%;
  }

  .story-content {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
    min-height: 0; // 允许flex子元素缩小

    &.custom-content {
      align-items: center;
      justify-content: center;
      gap: 38.52px;
      padding: 38.52px 0px;

      .custom-text {
        font-size: clamp(20px, 3.5vw, 42px); // 自适应字体，最小20px，首选3.5vw，最大42px
        font-weight: 700;
        line-height: 1.32em;
        letter-spacing: 0.04em;
        color: #d9d9d9;
        text-align: center;
        word-break: keep-all; // 保持词语完整性
        padding: 0 10px; // 左右留一点内边距
      }

      .custom-icon {
        margin-bottom: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 11.556px;

        .plus-circle {
          position: relative;
          width: 113.42px;
          height: 113.42px;
          border: 7.29px solid #c8c8c8;
          border-radius: 50%;
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
        }

        .plus-horizontal {
          position: absolute;
          width: 45.51px;
          height: 0;
          border-top: 7.29px solid #c8c8c8;
          left: 50%;
          transform: translateX(-50%);
        }

        .plus-vertical {
          position: absolute;
          width: 0;
          height: 45.51px;
          border-left: 7.29px solid #c8c8c8;
          top: 50%;
          transform: translateY(-50%);
        }
      }
    }

    .story-header {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      justify-content: flex-end;
      width: 100%;
      height: 21px;
      flex-shrink: 0;
      margin-bottom: 2px;
      gap: 12px;

      .add-note-btn {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: flex-start;
        height: 21.01px;
        flex-shrink: 0;
        white-space: nowrap;
        cursor: pointer;

        .add-note-text {
          font-size: 16px;
          font-weight: 400;
          line-height: 1.32em;
          letter-spacing: 0.04em;
          color: #999999;
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
        width: 59.86px;
        height: 21.01px;
        flex-shrink: 0;
        white-space: nowrap;
        cursor: pointer;

        .edit-icon {
          width: 20.77px;
          height: 20.77px;
          flex-shrink: 0;
        }

        .edit-text {
          font-size: 16px;
          font-weight: 400;
          line-height: 1.32em;
          letter-spacing: 0.04em;
          color: #999999;
          margin-left: 5.86px;
          flex-shrink: 0;
        }
      }
    }

    .story-title-section {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      width: 100%;
      height: clamp(90px, 12vh, 120px); // 自适应高度
      flex-shrink: 0;
      margin-bottom: clamp(10px, 1.5vh, 15px); // 自适应间距
      position: relative;

      .story-cover {
        width: clamp(70px, 9vw, 89px); // 自适应宽度
        height: 100%; // 跟随父容器高度
        flex-shrink: 0;
        border-radius: 5px;
        overflow: hidden;
        box-shadow: 0px 1px 4px 2px rgba(0, 0, 0, 0.15);
        // background: #fff; // 添加背景色，确保图片周围有合适的背景
        // display: flex;
        // align-items: center;
        // justify-content: center;

        .cover-image {
          width: 100%;
          height: 100%;
          object-fit: contain; // 改为 contain，完整显示图片，不被裁剪
          display: block;
        }
      }

      .story-title {
        position: absolute;
        left: clamp(85px, 10vw, 104px); // 自适应位置
        top: clamp(10px, 1.5vh, 15px);
        right: 0;
        max-width: calc(100% - clamp(85px, 10vw, 104px));
        max-height: 100%;
        font-size: clamp(16px, 1.5vw, 22px); // 自适应字体
        font-weight: 700;
        line-height: 1.32em;
        letter-spacing: 0.04em;
        color: #464646;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
        word-wrap: break-word;
        word-break: break-word;
      }
    }

    .story-intro {
      width: 100%;
      flex: 1 1 auto; // 弹性布局，允许压缩和扩展
      min-height: clamp(60px, 8vh, 100px); // 降低最小高度，为底部内容留出空间
      max-height: clamp(120px, 15vh, 180px); // 自适应最大高度
      margin-bottom: clamp(10px, 1.5vh, 15px);
      overflow-y: auto;
      overflow-x: hidden;
      flex-shrink: 1; // 允许在空间不足时压缩

      .intro-text {
        width: 100%;
        font-size: clamp(14px, 1.3vw, 18px); // 自适应字体
        font-weight: 400;
        line-height: 1.5em;
        color: #464646;
        text-align: justify;
        word-wrap: break-word;
        overflow-wrap: break-word;
        word-break: break-word;
      }
    }

    .story-tags {
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap; // 不换行
      width: 100%;
      flex-shrink: 0;
      margin-bottom: clamp(8px, 1vh, 12px); // 自适应间距
      margin-left: -5px;
      overflow: hidden; // 超出隐藏
      position: relative;

      // 添加渐变遮罩和省略号
      &::after {
        content: '...';
        position: absolute;
        right: 0;
        top: 50%;
        transform: translateY(-50%);
        padding: 6px 8px 6px 20px; // 左边增加渐变过渡区域
        background: linear-gradient(to right, rgba(255, 248, 229, 0) 0%, rgba(255, 248, 229, 0.8) 40%, rgba(255, 248, 229, 1) 60%, rgba(255, 248, 229, 1) 100%);
        font-size: clamp(12px, 1vw, 14px); // 自适应字体
        font-weight: 400;
        line-height: 1.32em;
        color: #4d4d4d;
        pointer-events: none;
        min-width: 50px;
        text-align: right;
      }

      .story-tag {
        padding: clamp(4px, 0.5vh, 6px) clamp(8px, 0.8vw, 12px); // 自适应padding
        border-radius: 21px;
        background: rgba(226, 226, 226, 0.5);
        font-size: clamp(11px, 1vw, 14px); // 自适应字体
        font-weight: 400;
        line-height: 1.32em;
        letter-spacing: 0.04em;
        color: #4d4d4d;
        margin-left: 5px;
        white-space: nowrap; // 标签内容不换行
        flex-shrink: 0; // 标签本身不压缩
      }
    }

    .story-metrics {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      height: auto; // 自适应高度
      flex-shrink: 0; // 不允许压缩
      flex-grow: 0; // 不允许扩展
      margin-top: auto; // 推到底部
      min-height: clamp(50px, 6vh, 70px); // 确保有足够的最小高度显示内容

      .metrics-group {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: flex-start;
        width: auto;
        height: auto;
        gap: clamp(4px, 0.7vh, 7px); // 自适应间距

        .metric-item {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: flex-start;
          width: 100%;
          height: auto;
          flex-wrap: nowrap;

          .metric-icon {
            flex-shrink: 0;
            margin-right: clamp(4px, 0.6vw, 7px); // 自适应间距
            display: flex;
            align-items: center;
            justify-content: center;

            img {
              display: block;
            }
          }

          // 剧情冲突图标：自适应大小
          &.metric-item-conflict .metric-icon img {
            width: clamp(12px, 1.3vw, 16px);
            height: clamp(12px, 1.3vw, 16px);
          }

          // 情感指数图标：自适应大小
          &.metric-item-emotion .metric-icon img {
            width: clamp(11px, 1.2vw, 14px);
            height: clamp(9px, 1vw, 12px);
          }

          .metric-text {
            flex-shrink: 0;
            white-space: nowrap;
            font-size: clamp(12px, 1.2vw, 16px); // 自适应字体
            font-weight: 400;
            line-height: 1.5em;
            color: #999999;
          }

          .metric-stars {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: clamp(3px, 0.5vw, 6.26px); // 自适应间距
            margin-left: 0;
            flex-shrink: 0;

            .star-icon {
              width: clamp(14px, 1.5vw, 18px); // 自适应星星大小
              height: clamp(13px, 1.4vw, 17px);
              flex-shrink: 0;
              display: block;
            }
          }
        }
      }
    }
  }
}
</style>
