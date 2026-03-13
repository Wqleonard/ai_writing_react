<script setup lang="ts">
import { useLoginStore } from '@/vue/stores/login'
import { ElMessage } from 'element-plus'
import { watch, onUnmounted, onMounted, ref } from 'vue'
import { isMobileDevice } from "@/utils/utils.ts";

const model = defineModel<boolean>()
const loginStore = useLoginStore()
const emits = defineEmits<{
  (e: 'login-success'): void
  (e: 'login-failed'): void
}>()

const iframeUrl = 'https://www.baowenmao.com/login/login'
const allowedOrigin = 'https://www.baowenmao.com'
const iframeRef = ref<HTMLIFrameElement | null>(null)
const iframeLoadFailed = ref(false)
const loadTimeout = ref<NodeJS.Timeout | null>(null)
const isMobile = ref<boolean>(isMobileDevice())

// 处理来自 iframe 的 postMessage 事件
const handleMessage = async (event: MessageEvent) => {
  // 验证消息来源，确保安全性
  console.log(event)

  if (event.origin !== allowedOrigin) {
    console.log('收到来自未授权源的消息:', event.origin)
    return
  }
  if (!event.data?.action) {
    return
  }

  try {
    const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data

    // 根据消息类型处理不同的事件
    if (data?.action === 'ticketSend' && data?.data?.ticket) {
      const ticket = data?.data?.ticket
      const req = await loginStore.loginWithTicket(ticket)
      if (req?.success) {
        // showLoginDialog 中的 handleLoginSuccess 会处理对话框关闭和清理
        await loginStore.initUserInfo
        emits('login-success')
      } else {
        emits('login-failed')
      }
    }
    // 可以添加更多消息类型的处理
  } catch (error) {
    emits('login-failed')
    window.removeEventListener('message', handleMessage)
    console.error('解析 postMessage 数据失败:', error)
  }
}

onUnmounted(() => {
  // 移除 postMessage 监听器
  window.removeEventListener('message', handleMessage)
  // 清理超时定时器
  if (loadTimeout.value) {
    clearTimeout(loadTimeout.value)
    loadTimeout.value = null
  }
})

// 处理 iframe 加载成功
const handleIframeLoad = () => {
  if (loadTimeout.value) {
    clearTimeout(loadTimeout.value)
    loadTimeout.value = null
  }
  iframeLoadFailed.value = false
}

// 处理 iframe 加载失败
const handleIframeError = () => {
  iframeLoadFailed.value = true
  if (loadTimeout.value) {
    clearTimeout(loadTimeout.value)
    loadTimeout.value = null
  }
}

watch(model, (newVal) => {
  if (newVal) {
    isMobile.value = isMobileDevice()
    window.addEventListener('message', handleMessage)
    iframeLoadFailed.value = false

    // 设置超时检测（5秒后如果还没加载成功，显示兜底）
    loadTimeout.value = setTimeout(() => {
      if (iframeRef.value) {
        try {
          // 尝试访问 iframe 内容来判断是否加载成功
          const iframeDoc = iframeRef.value.contentDocument || iframeRef.value.contentWindow?.document
          if (!iframeDoc || !iframeDoc.body || iframeDoc.body.children.length === 0) {
            iframeLoadFailed.value = true
          }
        } catch (e) {
          // 跨域情况下无法访问，假设加载失败
          iframeLoadFailed.value = true
        }
      }
    }, 5000)
  } else {
    window.removeEventListener('message', handleMessage)
    if (loadTimeout.value) {
      clearTimeout(loadTimeout.value)
      loadTimeout.value = null
    }
  }
}, { immediate: true })

</script>

<template>
  <el-dialog
    v-model="model"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    :class="{
      'login-dialog': true,
      'mobile': isMobile,
    }"
  >
    <div
      :class="{
        'w-100 h-140 relative overflow-hidden': true,
        'w-full! h-230!': isMobile
      }"
      v-loading="iframeLoadFailed"
    >
      <div class="flex flex-row-reverse">
        <div
          class="iconfont text-[32px]! w-10 h-10 leading-10 text-center rounded-md active:bg-[#e5e5e5] cursor-pointer"
          @click="model = false">&#xe633;
        </div>
      </div>
      <iframe
        v-if="!iframeLoadFailed"
        ref="iframeRef"
        :src="iframeUrl"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        allow="camera; microphone"
        class="login-iframe w-full h-full"
        @load="handleIframeLoad"
        @error="handleIframeError"
      ></iframe>
      <!-- 兜底内容 -->
      <div
        v-else
        class="w-full h-full flex flex-col items-center justify-center bg-gray-50 border border-gray-200 rounded"
      >
        <div class="text-gray-500 text-center px-4">
          <div class="text-lg mb-2">无法加载登录页面</div>
          <div class="text-sm mb-4">请检查网络连接或稍后重试</div>
          <button
            @click="iframeLoadFailed = false"
            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            重新加载
          </button>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<style lang="less">
.login-dialog.el-dialog {
  --el-dialog-width: calc(400px + 32px * 2) !important;

  .el-dialog__header {
    display: none;
  }

  .el-dialog__body {
    display: flex;
    justify-content: center;
  }

  &.mobile {
    padding: 16px !important;
    --el-dialog-width: 650px !important;

    .el-dialog__headerbtn {
      right: 24px;
      top: 24px;
    }

    .el-icon.el-dialog__close {
      width: 40px;
      height: 40px;

      svg {
        width: 40px;
        height: 40px;
      }
    }
  }
}
</style>
