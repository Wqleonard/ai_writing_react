<template>
  <NodeViewWrapper
    class="mermaid-container"
    :class="{ 'is-loading': isLoading, 'has-error': hasError, 'is-edit-mode': isEditMode }"
  >
    <!-- 右上角编辑按钮 -->
    <div class="mermaid-toolbar">
      <el-button
        class="mermaid-edit-btn"
        @click="toggleEditMode"
        :title="isEditMode ? '渲染图表' : '编辑图表代码'"
      >
        <span v-if="!isEditMode">编辑</span>
        <span v-else>预览</span>
      </el-button>
    </div>

    <!-- 编辑模式：显示代码编辑器 -->
    <div v-if="isEditMode" class="mermaid-editor">
      <textarea
        v-model="editableCode"
        class="mermaid-code-input"
        placeholder="输入 Mermaid 代码..."
        @input="onCodeInput"
      />
      <div class="mermaid-editor-hint">
        提示：点击"预览"按钮渲染图表
      </div>
    </div>

    <!-- 预览模式：显示渲染的图表 -->
    <template v-else>
      <div v-if="isLoading" class="mermaid-loading">
        正在渲染 Mermaid 图表...
      </div>
      <div v-if="hasError" class="mermaid-error">
        <div class="error-message">
          ⚠️ Mermaid 语法错误
        </div>
        <div class="error-detail">
          {{ errorMessage }}
        </div>
        <div class="error-hint">
          提示：点击右上角"编辑"按钮修改代码
        </div>
      </div>
      <div ref="mermaidRef" class="mermaid-content">
        <!-- Mermaid 图表将在这里渲染 -->
      </div>
    </template>
  </NodeViewWrapper>
</template>

<script setup lang="ts">
import {ref, onMounted, watch, onBeforeUnmount, computed, nextTick} from 'vue'
import {NodeViewWrapper} from '@tiptap/vue-3'
import mermaid from 'mermaid'
import { ElButton } from 'element-plus'

interface Props {
  node: {
    attrs: {
      code: string
    }
  }
  updateAttributes?: (attrs: { code: string }) => void
}

const props = defineProps<Props>()

const code = computed(() => {
  const codeValue = props.node?.attrs?.code || ''
  return codeValue
})

watch(code, val => {
  console.log(val)
})

const mermaidRef = ref<HTMLElement | null>(null)
const isLoading = ref(true)
const hasError = ref(false)
const errorMessage = ref('')
const renderId = ref<string>('')

// 编辑模式相关状态
const isEditMode = ref(false)
const editableCode = ref(code.value)

// 初始化 mermaid（只初始化一次）
if (typeof window !== 'undefined') {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
    },
  })
}

const renderMermaid = async () => {
  // 等待 DOM 准备好
  await nextTick()

  if (!code.value) {
    console.warn('Mermaid: No code to render')
    isLoading.value = false
    return
  }

  const mermaidCode = code.value.trim()
  if (!mermaidCode) {
    console.warn('Mermaid: Empty code after trim')
    isLoading.value = false
    return
  }

  // 再次等待，确保 ref 已经绑定
  await nextTick()

  if (!mermaidRef.value) {
    console.warn('Mermaid: mermaidRef not ready')
    isLoading.value = false
    return
  }

  isLoading.value = true
  hasError.value = false
  errorMessage.value = ''

  try {
    // 清理之前的渲染
    mermaidRef.value.innerHTML = ''

    // 生成唯一的 ID
    renderId.value = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // 渲染 Mermaid 图表
    const {svg} = await mermaid.render(renderId.value, mermaidCode)

    if (mermaidRef.value) {
      mermaidRef.value.innerHTML = svg
      isLoading.value = false
    } else {
      console.warn('Mermaid: mermaidRef lost after render')
      isLoading.value = false
    }
  } catch (error) {
    console.error('Mermaid rendering error:', error)
    hasError.value = true
    isLoading.value = false

    // 清理 mermaid 可能插入的错误 div
    const errorDiv = document.querySelector(`#${renderId.value}`)
    const errorDiv2 = document.querySelector(`#d${renderId.value}`)

    if (errorDiv) {
      errorDiv.remove()
    }
    if (errorDiv2) {
      errorDiv2.remove()
    }

    // 清空容器
    if (mermaidRef.value) {
      mermaidRef.value.innerHTML = ''
    }
    editableCode.value = code.value

    if (error instanceof Error) {
      errorMessage.value = error.message || 'Mermaid 图表渲染失败'
    } else {
      errorMessage.value = 'Mermaid 图表渲染失败'
    }
  }
}

// 切换编辑模式
const toggleEditMode = () => {
  if (isEditMode.value) {
    // 从编辑模式切换到预览模式：更新节点属性并重新渲染
    if (editableCode.value !== code.value) {
      // 如果代码有变化，更新节点属性
      if (props.updateAttributes) {
        props.updateAttributes({ code: editableCode.value })
      }
    }
    isEditMode.value = false
    // 切换后立即渲染
    nextTick(() => {
      renderMermaid()
    })
  } else {
    // 从预览模式切换到编辑模式：同步当前代码到编辑器
    editableCode.value = code.value
    isEditMode.value = true
  }
}

// 处理代码输入（实时更新）
const onCodeInput = () => {
  // 可以在这里添加实时验证逻辑
}

// 监听 code 变化，同步到 editableCode
watch(code, (newCode) => {
  editableCode.value = newCode
  if (!isEditMode.value) {
    renderMermaid()
  }
})

onMounted(async () => {
  await nextTick()
  await renderMermaid()
})

onBeforeUnmount(() => {
  // 清理
  if (mermaidRef.value) {
    mermaidRef.value.innerHTML = ''
  }
})
</script>

<style scoped>
.mermaid-container {
  margin: 1em 0;
  padding: 3em 1em 1em 1em;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  background: #f8f9fa;
  position: relative;
  min-height: 200px;
}

/* 工具栏 */
.mermaid-toolbar {
  position: absolute;
  top: 0.5em;
  right: 0.5em;
  z-index: 10;
}

.mermaid-edit-btn {
  padding: 0.4em 2em;
  background: #4a90e2;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 0.3em;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.mermaid-edit-btn:hover {
  background: #357abd;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.mermaid-edit-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* 编辑器 */
.mermaid-editor {
  display: flex;
  flex-direction: column;
  gap: 0.5em;
}

.mermaid-code-input {
  width: 100%;
  min-height: 450px;
  padding: 1em;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
  background: #ffffff;
  color: #333;
  transition: border-color 0.2s ease;
}

.mermaid-code-input:focus {
  outline: none;
  border-color: #4a90e2;
  box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
}

.mermaid-code-input::placeholder {
  color: #adb5bd;
}

.mermaid-editor-hint {
  font-size: 12px;
  color: #6c757d;
  font-style: italic;
  text-align: center;
  padding: 0.5em;
}

.mermaid-content {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100px;
  overflow-x: auto;
}

.mermaid-content :deep(svg) {
  max-width: 100%;
  height: auto;
}

.mermaid-loading {
  text-align: center;
  padding: 2em;
  color: #6c757d;
  font-size: 14px;
}

.mermaid-error {
  padding: 1.5em;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 6px;
  margin: 1em 0;
  box-shadow: 0 2px 8px rgba(255, 193, 7, 0.2);
}

.error-message {
  color: #856404;
  font-weight: bold;
  font-size: 16px;
  margin-bottom: 0.8em;
  display: flex;
  align-items: center;
  gap: 0.5em;
}

.error-detail {
  color: #664d03;
  font-size: 14px;
  margin-bottom: 0.8em;
  padding: 0.8em;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 4px;
  word-break: break-word;
}

.error-hint {
  color: #856404;
  font-size: 12px;
  font-style: italic;
  text-align: center;
  padding-top: 0.5em;
  border-top: 1px dashed #ffc107;
}

.error-code {
  margin-top: 0.5em;
  background: #fff;
  padding: 0.5em;
  border-radius: 4px;
  border: 1px solid #dee2e6;
}

.error-code pre {
  margin: 0;
  font-size: 12px;
  color: #495057;
  overflow-x: auto;
}

.error-code code {
  white-space: pre-wrap;
  word-break: break-all;
}
</style>

