<template>
  <el-dialog
    v-model="dialogVisible"
    :title="message?.title || '消息详情'"
    append-to-body
    :before-close="handleClose"
    class="message-detail-dialog"
  >
    <div v-if="message" class="message-detail-content">
      <!-- 消息头部信息 -->
      <div class="message-header">
        <div class="message-meta">
          <span class="message-time">{{ message.timestamp }}</span>
        </div>
      </div>

      <!-- 消息内容 -->
      <el-scrollbar max-height="500px">
        <div class="message-body min-h-100">
          <RenderRichText
            v-if="message.content && message.content.trim()"
            :content="message.content"
            :bordered="false"
            class-name="message-content-text"
          />
          <div v-else class="empty-content">
            暂无内容
          </div>
        </div>
      </el-scrollbar>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">关闭</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Message } from '@/vue/stores/login'
import RenderRichText from '@/vue/components/RenderRichText/index.vue'

interface Props {
  modelValue: boolean
  message: Message | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const dialogVisible = ref(props.modelValue)

watch(() => props.modelValue, (newVal) => {
  dialogVisible.value = newVal
})

watch(dialogVisible, (newVal) => {
  emit('update:modelValue', newVal)
})

const handleClose = () => {
  dialogVisible.value = false
}
</script>

<style scoped lang="less">
.message-detail-dialog {
  .message-detail-content {
    padding: 0;
  }

  .message-header {
    padding-bottom: 8px;
    border-bottom: 1px solid #ebeef5;

    .message-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14px;
      color: #909399;

      .message-time {
        color: #909399;
      }

      .message-status {
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;

        &.unread {
          background-color: #fef0f0;
          color: #f56c6c;
        }

        &.read {
          background-color: #f0f9ff;
          color: #409eff;
        }
      }
    }
  }

  .message-body {

    .message-content-text {
      font-size: 14px;
      line-height: 1.8;
      color: #303133;
    }

    .empty-content {
      padding: 40px 0;
      text-align: center;
      color: #909399;
      font-size: 14px;
    }
  }
}
</style>

<style>
.message-detail-dialog.el-dialog {
  --el-dialog-width: 1020px;
  border-radius: 10px !important;
}
</style>
