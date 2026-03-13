<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from "vue";
import { ArrowDown } from "@element-plus/icons-vue";
import MainHeader from "@/vue/components/MainHeader.vue";
import QuickExportDialog from "@/vue/components/QuickExportDialog.vue";
import { useEditorStore } from "@/vue/stores/editor.ts";
import { storeToRefs } from "pinia";
import { ElButton, ElIcon } from "element-plus";

// import { showNotesSelectorDialog } from "@/utils/showNotesSelectorDialog";

interface Props {
  hideFeedback?: boolean; // 是否隐藏问题反馈
  isScript?: boolean; // 是否为剧本模式（与快捷创作数据结构不同，导出时需区分）
}

const props = withDefaults(defineProps<Props>(), {
  hideFeedback: false,
  isScript: false,
});

const emit = defineEmits<{
  (e: "back-click"): void;
  (e: "save-click"): void;
  (e: "update-title", value: string): void;
  (e: "notes-confirm", notes: any[]): void; // 笔记确认事件
}>();

const editorStore = useEditorStore();
const { workInfo, workId } = storeToRefs(editorStore);

const isEditingTitle = ref(false);
const editingTitleValue = ref(workInfo.value.title || "");
const titleInputRef = ref<HTMLInputElement | null>(null);

const displayTitle = computed(() => {
  const title = workInfo.value?.title || "";
  if (title === "未命名作品" && workInfo.value?.workId) {
    return `${title}${workInfo.value.workId}`;
  }
  return title;
});

watch(
    () => workInfo.value.title,
    (newTitle) => {
      if (!isEditingTitle.value) {
        editingTitleValue.value = newTitle || "";
      }
    }
);

const focusTitleInput = async () => {
  await nextTick();
  if (titleInputRef.value) {
    titleInputRef.value.focus();
    titleInputRef.value.select();
  }
};

const startEditTitle = async () => {
  isEditingTitle.value = true;
  editingTitleValue.value = workInfo.value.title || "";
  await focusTitleInput();
};

const finishEditTitle = () => {
  const newTitle = editingTitleValue.value.trim();

  if (!newTitle) {
    // 为空则恢复
    editingTitleValue.value = workInfo.value.title || "";
    isEditingTitle.value = false;
    return;
  }

  if (newTitle !== workInfo.value.title) {
    emit("update-title", newTitle);
  }
  isEditingTitle.value = false;
};

const cancelEditTitle = () => {
  editingTitleValue.value = workInfo.value.title || "";
  isEditingTitle.value = false;
};

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  editingTitleValue.value = target.value;
};

const handleBackClick = () => {
  emit("back-click");
};

const handleSaveClick = () => {
  emit("save-click");
};

const handleWorkTitleClick = () => {
  if (!isEditingTitle.value) {
    startEditTitle();
  }
};

const handleTitleBlur = () => {
  if (isEditingTitle.value) {
    finishEditTitle();
  }
};

const handleTitleKeydown = (event: KeyboardEvent) => {
  if (event.key === "Enter") {
    event.preventDefault();
    finishEditTitle();
  } else if (event.key === "Escape") {
    event.preventDefault();
    cancelEditTitle();
  }
};

// 导出对话框
const showExportDialog = ref(false);
const exportBtnRef = ref<HTMLElement | null>(null);

const toggleExportDialog = (event?: MouseEvent) => {
  if (event) {
    event.stopPropagation();
  }
  showExportDialog.value = !showExportDialog.value;
};

const closeExportDialog = () => {
  showExportDialog.value = false;
};

// 点击外部关闭导出对话框
const handleClickOutside = (event: MouseEvent) => {
  if (exportBtnRef.value && !exportBtnRef.value.contains(event.target as Node)) {
    closeExportDialog();
  }
};

// 监听点击事件
onMounted(() => {
  if (typeof window !== "undefined") {
    window.addEventListener("click", handleClickOutside);
  }
});

onUnmounted(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("click", handleClickOutside);
  }
});
</script>

<template>
  <div class="top-tool-container">
    <div class="left-top-content">
      <div class="left-content">
        <el-button link @click="handleBackClick">
          <span class="back-icon iconfont mr-2">&#xe62a;</span>
          <span class="back-text">返回</span>
        </el-button>
        <span class="divider">|</span>
        <el-button link @click="handleSaveClick"> 保存</el-button>

        <el-button v-if="!isEditingTitle" class="work-title-display" @click="handleWorkTitleClick"
                   :title="'点击编辑作品名称'"
                   link>
          {{ displayTitle }}
        </el-button>
        <input v-else ref="titleInputRef" :value="editingTitleValue" class="work-title-input" type="text"
               @blur="handleTitleBlur" @input="handleInput" @keydown="handleTitleKeydown"/>
      </div>
    </div>
    <div class="right-top-content">

      <div class="export-btn-container" ref="exportBtnRef">
        <el-button class="export-btn" @click="toggleExportDialog" title="导出">
          导出
          <el-icon class="export-icon">
            <ArrowDown/>
          </el-icon>
        </el-button>
        <QuickExportDialog v-if="showExportDialog" :visible="showExportDialog" :is-script="isScript"
                           @close="closeExportDialog"/>
      </div>
      <MainHeader :hide-feedback="hideFeedback"/>
    </div>
  </div>
</template>

<style scoped lang="less">
.top-tool-container {
  background: var(--bg-editor);
  padding: 0 28px;
  width: 100vw;
  display: flex;
  flex-direction: row;
  height: 56px;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;

  // 左侧顶部内容
  .left-top-content {
    height: 30px;
    background: transparent;
    display: flex;
    align-items: center;

    .left-content {
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 4px;

      // 返回链接
      .back-link {
        &:hover {
          color: var(--accent-color);
          background: transparent;
        }

        .back-icon {
          font-size: 18px;
        }

        .back-text {
          font-size: 14px;
        }
      }

      // 作品标题显示
      .work-title-display {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        transition: background-color 0.2s;

        &:hover {
          background-color: var(--bg-hover);
        }
      }

      // 作品标题输入框
      .work-title-input {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
        padding: 4px 8px;
        border: 1px solid var(--border-color);
        border-radius: 4px;
        background-color: var(--bg-primary);
        outline: none;
        min-width: 200px;
        max-width: 400px;
        transition: border-color 0.2s;

        &:focus {
          border-color: var(--accent-color);
        }
      }

      // 分隔符
      .divider {
        color: var(--border-color);
        font-size: 16px;
        margin: 0 8px;
        user-select: none;
      }
    }
  }

  // 右侧顶部内容
  .right-top-content {
    display: flex;
    align-items: center;
    // gap: 12px;

    .notes-trigger {
      display: flex;
      justify-content: center;
      align-items: center;
      color: #757575;
      width: 28px;
      height: 28px;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.2s;
      font-size: 18px !important;

      &:hover {
        background: var(--bg-tertiary);
      }
    }

    .export-btn-container {
      position: relative;
      margin-right: 10px;

      .export-btn {
        color: var(--text-primary);
        // background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 15px;
        padding: 8px 16px;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.2s ease;
        font-weight: normal;

        &:hover {
          background: var(--bg-primary);
          border-color: var(--border-hover);
        }

        .export-icon {
          font-size: 12px;
          width: 12px;
          height: 12px;
        }
      }
    }
  }
}

// 笔记管理弹窗样式
.notes-popover {
  padding: 0 !important;

  .notes-popover-content {
    padding: 8px 12px;
    font-size: 14px;
    color: #fff;
    background: #000;
    border-radius: 4px;
  }
}
</style>
