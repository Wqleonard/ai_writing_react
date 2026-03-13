<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useLoginStore } from '@/vue/stores/login.ts'
import { storeToRefs } from 'pinia'
import type { Message } from '@/vue/stores/login.ts'
import type { ElScrollbar } from 'element-plus'
import MessageDetailDialog from './MessageDetailDialog.vue'

const model = defineModel({ default: false })

// 从 loginStore 获取 messages 和未读状态
const loginStore = useLoginStore()
const { messages, hasUnreadMessages, hasMoreMessages, isLoadingMessages, isLoggedIn } = storeToRefs(loginStore)

// 滚动条引用
const scrollbarRef = ref<InstanceType<typeof ElScrollbar> | null>(null)

// 消息详情 dialog 相关
const detailDialogVisible = ref(false)
const currentMessage = ref<Message | null>(null)

// 处理滚动事件，实现瀑布流加载
const handleScroll = () => {
  if (isLoadingMessages.value || !hasMoreMessages.value) {
    return
  }

  const scrollbar = scrollbarRef.value
  if (!scrollbar) return

  const wrap = scrollbar.wrapRef
  if (!wrap) return

  const scrollTop = wrap.scrollTop
  const scrollHeight = wrap.scrollHeight
  const clientHeight = wrap.clientHeight

  // 当滚动到距离底部 100px 时触发加载
  if (scrollHeight - scrollTop - clientHeight < 100) {
    loginStore.loadMoreMessages()
  }
}

const handleViewDetail = (message: Message) => {
  currentMessage.value = message
  model.value = false
  detailDialogVisible.value = true

  // 如果消息未读，标记为已读
  if (!message.isReaded) {
    loginStore.markMessageAsRead(message.id)
  }
}


// 每 30 分钟刷新站内信
const REFRESH_INTERVAL_MS = 30 * 60 * 1000
let refreshTimer: ReturnType<typeof setInterval> | null = null

onMounted(async() => {
  if (isLoggedIn.value) {
    await loginStore.updateMessages()
  }
  refreshTimer = setInterval(() => {
    if (isLoggedIn.value) {
      loginStore.updateMessages()
    }
  }, REFRESH_INTERVAL_MS)
})

onUnmounted(() => {
  if (refreshTimer !== null) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})

watch(isLoggedIn, (newVal) => {
  if (newVal) {
    loginStore.updateMessages()
  }
})

</script>

<template>
  <el-popover
    placement="bottom"
    trigger="click"
    v-model:visible="model"
    :show-arrow="false"
    popper-class="insite-message-popover"
  >
    <template #reference>
      <div class="el-only-child-wrapper">
        <div class="relative">
          <div
            class="iconfont cursor-pointer w-6 h-6 text-center leading-6 rounded-sm overflow-hidden hover:bg-[#e4e4e4]"
          >
            &#xe64d;
          </div>
          <!-- 未读消息红点 -->
          <div
            v-if="hasUnreadMessages"
            class="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-white"
          ></div>
        </div>
      </div>
    </template>
    <div class="w-full py-2">
      <el-scrollbar
        ref="scrollbarRef"
        max-height="552px"
        @scroll="handleScroll"
      >
        <div class="flex flex-col px-8">
          <div
            v-for="(message, index) in messages"
            :key="message.id"
            class="py-5 border-b border-gray-200 last:border-b-0 flex"
          >
            <div class="flex flex-col flex-1 gap-3 min-w-0 max-w-full overflow-hidden">
              <!-- 标题 -->
              <div class="flex items-center gap-2">
                <div class="text-base font-semibold text-gray-700 truncate min-w-0">
                  {{ message.title }}
                </div>
                <!-- 未读消息红点 -->
                <div
                  v-if="!message.isReaded"
                  class="w-2 h-2 bg-red-500 rounded-full shrink-0"
                />
              </div>
              <!-- 内容 -->
              <div class="text-base text-gray-600 truncate">
                {{ message.desc }}
              </div>
              <!-- 底部：时间戳和查看详情 -->
              <div class="flex items-center justify-between mt-1">
                <div class="text-sm text-gray-400">
                  {{ message.timestamp }}
                </div>
              </div>
            </div>

            <div
              class="shrink-0 flex items-center justify-center"
            >
              <el-button
                link
                type="primary"
                class="text-base! font-semibold"
                @click.stop="handleViewDetail(message)"
              >
                查看详情
              </el-button>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-if="messages.length === 0 && !isLoadingMessages" class="px-4 py-8 text-center text-gray-400 text-sm">
            暂无消息
          </div>

          <!-- 加载更多提示 -->
          <div v-if="isLoadingMessages && messages.length > 0" class="px-4 py-4 text-center text-gray-400 text-sm">
            加载中...
          </div>
        </div>
      </el-scrollbar>
    </div>
  </el-popover>

  <!-- 消息详情 Dialog -->
  <MessageDetailDialog
    v-model="detailDialogVisible"
    :message="currentMessage"
  />
</template>

<style lang="less">
.insite-message-popover.el-popper {
  width: 370px !important;
  padding: 0 !important;
  border-radius: 10px !important;
  transform: translateX(-20px);
}
</style>
