<template>
  <div
    ref="toolbarRootRef"
    class="tiptap-selection-toolbar font-YaHei absolute invisible left-0 top-0 z-[1] flex p-1 pointer-events-auto border-1 border-[#b4b4b4] box-border rounded-[10px] bg-white transition-opacity duration-150 ease-in-out"
    :style="toolbarStyle"
    :class="{ 'visible!': showTool }"
  >
    <div class="flex flex-col gap-2" v-if="!showChat">
      <div
        class="h-7 flex items-center hover:bg-[#e8e8e8] rounded-[6px] px-2 text-[#61615f] cursor-pointer"
        v-for="(btn, index) in toolBarBtns"
        :key="btn.value + index"
        @click.stop="handleBtnClick(btn.value)"
      >
        <div class="iconfont w-5 h-5 text-center leading-5" v-html="btn.icon"></div>
        <div class="text-base ml-1">{{ btn.label }}</div>
      </div>
    </div>

    <div class="w-105 p-3 pt-0" v-else>
      <div class="selection-toolbar-drag-header pt-3 cursor-move" @mousedown="onDragStart">
        <div class="h-[34px] text-xl flex justify-between items-centerselect-none">
          <div class="flex items-center text-[#61616f]">
            <span
              class="iconfont text-2xl w-6 h-6 text-center leading-6 rounded-sm hover:bg-[#e8e8e8] cursor-pointer"
              @click="handleBack"
            >
              &#xeaa2;
            </span>
            <span class="ml-2">{{ ActionMap.get(chatType)?.label }}</span>
          </div>

          <div
            class="iconfont text-base w-6 h-6 text-center leading-6 rounded-sm hover:bg-[#e8e8e8] cursor-pointer text-[#61616f]"
            @click.stop="handleClose"
          >
            &#xe633;
          </div>
        </div>
      </div>

      <AutoScrollbar ref="scrollbarRef" max-height="240px" class="mt-4">
        <div class="overflow-y-auto flex flex-col gap-4">
          <template v-for="chat in chatArr" :key="chat.content">
            <div
              v-if="chat.role == 'human'"
              class="bg-[#e8e8e8] self-end flex flex-row-reverse py-1.5 px-2.5 rounded-tl-[10px] rounded-tr-[10px] rounded-bl-[10px]"
            >
              {{ chat.content }}
            </div>
            <template v-else>
              <div class="flex flex-col" v-if="chat.content_type == 'image'">
                <el-image
                  class="w-[150px]"
                  :src="chat.content"
                  :preview-src-list="[chat.content]"
                  fit="cover"
                />
                <div v-if="chat.end" class="flex flex-row gap-1">
                  <el-button class="h-[22px] text-xs m-0 py-[3px] px-1.5" @click="handleInsetImage"
                    >插入
                  </el-button>
                </div>
              </div>
              <div class="pl-2.5 py-1.5" v-else-if="chat.content">
                {{ chat.content }}
              </div>
            </template>
          </template>
          <StreamIndicator v-if="chatLoading" class="ml-2.5 h-9!" />
        </div>
      </AutoScrollbar>

      <div
        v-if="!chatArr.length"
        class="flex gap-2 items-end justify-between min-h-12 border border-[#c4c4c4] p-2 rounded-lg"
      >
        <el-input
          v-model="inputVal"
          :placeholder="inputPlaceholder"
          type="textarea"
          autosize
          @keydown.enter="handleInputSend"
          ref="inputRef"
          class="panel-input"
          maxlength="500"
        >
        </el-input>
        <div
          class="iconfont text-xl shrink-0 -scale-x-100 w-9 h-9 rounded-full bg-[#fa9e00] text-white text-center leading-9 cursor-pointer hover:opacity-80"
          @click="handleInputSend"
        >
          &#xe63a;
        </div>
      </div>

      <div class="mt-2 flex gap-5 h-9 flex-row-reverse px-2" v-else>
        <template v-if="chatArr[1]?.end">
          <div
            class="iconfont text-xl shrink-0 w-9 h-9 rounded-full bg-[#fa9e00] text-white text-center leading-9 cursor-pointer hover:opacity-80"
            @click.stop="handleAccept"
          >
            &#xe610;
          </div>
          <div
            class="iconfont text-xl shrink-0 w-9 h-9 rounded-full bg-[#e8e8e8] text-white text-center leading-9 cursor-pointer hover:opacity-80"
            @click.stop="handleResetChat"
          >
            &#xe66f;
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import { ElMessage, ElInput } from 'element-plus'
import { generateImage, postSelectionToolbarStream } from '@/api/selection-toolbar.ts'
import type { PostStreamData } from '@/api/index.ts'
import AutoScrollbar from '@/vue/components/AutoScrollbar.vue'
import { useEditorStore } from '@/vue/stores/editor.ts'
import { storeToRefs } from 'pinia'
import { trackingEditorTool } from '@/utils/matomoTrackingEvent/clickEvent.ts'
import debounce from 'lodash-es/debounce'
import type { Editor } from '@tiptap/core'

interface Props {
  editor: Editor
  onLogClick?: (selectedText: string) => void
  btns?: SelectionToolBarAction[]
  left?: number
  top?: number
  from?: number
  to?: number
  selectedText?: string
}

export type SelectionToolBarAction =
  | 'edit'
  | 'expand'
  | 'search'
  | 'translate'
  | 'explain'
  | 'rewrite'
  | 'add'
  | 'image'
  | 'note' //添加到笔记

type ActionItem = {
  label: string
  icon: string
  value: SelectionToolBarAction
}

interface ChatArrItem {
  role: 'ai' | 'human'
  show_content: string
  content: string
  content_type?: string
  end: boolean
}

const props = withDefaults(defineProps<Props>(), {
  btns: () => ['edit', 'expand', 'add', 'note'],
  left: 0,
  top: 0,
  from: 0,
  to: 0,
  selectedText: '',
})

const emit = defineEmits<{
  add: [selectedText: string]
  note: [selectedText: string]
  'update:position': [{ left: number; top: number }]
  'accept-done': []
}>()

const ActionMap = new Map<SelectionToolBarAction, ActionItem>([
  ['edit', { icon: '&#xea48;', label: '修改', value: 'edit' }],
  ['expand', { icon: '&#xe616;', label: '扩写', value: 'expand' }],
  ['add', { icon: '&#xe62c;', label: '添加到对话', value: 'add' }],
  ['image', { icon: '&#xea2d;', label: '生图', value: 'image' }],
  ['note', { icon: '&#xe64c;', label: '添加到笔记', value: 'note' }],
  // ['search', {icon: '&#xe604;', label: '搜索', value: 'search'}],
  // ['translate', {icon: '&#xe716;', label: '翻译', value: 'translate'}],
  // ['explain', {icon: '&#xeba9;', label: '解释', value: 'explain'}],
  // ['rewrite', {icon: '&#xe791;', label: '重写', value: 'rewrite'}],
])

const toolBarBtns = computed<ActionItem[]>(() => {
  const back = []
  for (let i = 0; i < props.btns.length; i++) {
    const btn = props.btns[i]
    const btnDetail = ActionMap.get(btn)
    if (btnDetail) {
      back.push(btnDetail)
    }
  }
  return back
})

const showTool = defineModel<boolean>({ default: false })

const editorStore = useEditorStore()
const { currentContent } = storeToRefs(editorStore)

const showChat = ref(true)
const chatType = ref<SelectionToolBarAction>('edit')

const inputVal = ref('')
const inputPlaceholder = ref('请输入修改建议')
const inputRef = ref<InstanceType<typeof ElInput> | null>(null)

// 计算工具栏位置与显示样式（通过 display 控制显示/隐藏）
const toolbarStyle = computed(() => ({
  left: `${props.left}px`,
  top: `${props.top}px`,
}))

// 拖动标题改变工具栏位置，边界为编辑器容器
const toolbarRootRef = ref<HTMLElement | null>(null)
const dragState = ref<{
  startX: number
  startY: number
  startLeft: number
  startTop: number
} | null>(null)

const onDragMove = (e: MouseEvent) => {
  if (!dragState.value) return
  const root = toolbarRootRef.value
  const container = root?.offsetParent as HTMLElement | null
  if (!root || !container) return
  const dx = e.clientX - dragState.value.startX
  const dy = e.clientY - dragState.value.startY
  let newLeft = dragState.value.startLeft + dx
  let newTop = dragState.value.startTop + dy
  const cw = container.clientWidth
  const ch = container.clientHeight
  const tw = root.offsetWidth
  const th = root.offsetHeight
  newLeft = Math.max(0, Math.min(newLeft, cw - tw))
  newTop = Math.max(0, Math.min(newTop, ch - th))
  emit('update:position', { left: newLeft, top: newTop })
}

const onDragEnd = () => {
  if (dragState.value) {
    dragState.value = null
    document.removeEventListener('mousemove', onDragMove)
    document.removeEventListener('mouseup', onDragEnd)
    document.body.style.removeProperty('user-select')
    document.body.style.removeProperty('cursor')
  }
}

const onDragStart = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('.iconfont')) return
  e.preventDefault()
  dragState.value = {
    startX: e.clientX,
    startY: e.clientY,
    startLeft: props.left ?? 0,
    startTop: props.top ?? 0,
  }
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'move'
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
}

const handleUndone = () => {
  ElMessage.info('功能暂未开放，敬请期待')
}

// 去除用于提示用户的高亮、折叠选区并失焦（关闭/返回/意外关闭时统一调用，避免插件因选区仍存在再次弹出按钮列表）
const clearSelectionHighlight = () => {
  if (
    props.editor &&
    props.from !== undefined &&
    props.to !== undefined &&
    props.from < props.to
  ) {
    try {
      props.editor
        .chain()
        .setTextSelection({ from: props.from, to: props.to })
        .unsetHighlight()
        .setTextSelection(props.to)
        .blur()
        .run()
    } catch {
      // 选区可能已失效（如文档变化），忽略
    }
  }
}

// 监听 showTool 的变化：显示时重置为按钮界面并立即加高亮（此时选区尚未因点击失焦，无闪烁），关闭时去除高亮
watch(showTool, newVal => {
  if (newVal) {
    showChat.value = false
    // 在显示 toolbar 前就加高亮，避免用户点击按钮导致选区失焦后再 setTextSelection 产生闪烁
    if (
      props.editor &&
      props.from !== undefined &&
      props.to !== undefined &&
      props.from < props.to
    ) {
      props.editor
        .chain()
        .setTextSelection({ from: props.from, to: props.to })
        .setHighlight({ color: '#3367d1' })
        .run()
    }
  } else {
    clearSelectionHighlight()
  }
})

const chatArr = ref<ChatArrItem[]>([])
const chatLoading = ref(false)

// 请求参数，供多个函数使用
const requestData = ref<{
  action: string
  originalText: string
  query: string
  fullText?: string
} | null>(null)

// AutoScrollbar 引用
const scrollbarRef = ref<InstanceType<typeof AutoScrollbar> | null>(null)

// AbortController 用于取消流式请求
const streamAbortController = ref<AbortController | null>(null)

// 从流式数据中提取内容
const getContentFromPartial = (partialData: any): string => {
  if (!partialData || !Array.isArray(partialData) || partialData.length === 0) {
    return ''
  }
  const firstItem = partialData[0]
  if (firstItem.content && Array.isArray(firstItem.content) && firstItem.content.length > 0) {
    return firstItem.content[0].text
  }
  return ''
}

// 流式数据处理回调
const onStreamData = (data: PostStreamData) => {
  switch (data.event) {
    case 'messages/partial': {
      chatLoading.value = false
      const content = getContentFromPartial(data.data)
      // 更新 chatArr.value[1] 的内容
      if (chatArr.value.length > 1 && chatArr.value[1].role === 'ai') {
        chatArr.value[1].content = content
        chatArr.value[1].show_content = content
      }
      break
    }
    case 'updates': {
      const generate_content = data?.data?.generate_excerpt
      if (generate_content?.content) {
        // 更新最终内容
        if (chatArr.value.length > 1 && chatArr.value[1].role === 'ai') {
          chatArr.value[1].content = generate_content.content
          chatArr.value[1].show_content = generate_content.content
        }
      }
      break
    }
    case 'end': {
      break
    }
  }
}

// 流式结束回调
const onStreamEnd = () => {
  // 流式输出完成后，将 chatArr.value[1].end 设置为 true
  if (chatArr.value.length > 1 && chatArr.value[1].role === 'ai') {
    chatArr.value[1].end = true
  }
  streamAbortController.value = null

  // 流式输出完成后，强制滚动到底部
  scrollbarRef.value?.scrollToBottom()
}

// 流式错误回调
const onStreamError = (error: Error) => {
  console.error('流式请求失败:', error)
  // 如果是取消操作，不记录为错误
  if (error instanceof DOMException && error.name === 'AbortError') {
    console.log('流式请求已取消')
    streamAbortController.value = null
    return
  }
  // 更新错误状态
  if (chatArr.value.length > 1 && chatArr.value[1].role === 'ai') {
    chatArr.value[1].content = '生成失败，请重试'
    chatArr.value[1].show_content = '生成失败，请重试'
    chatArr.value[1].end = true
  }
  streamAbortController.value = null
}

const handleEdit = async () => {
  trackingEditorTool('Generate', 'Rewrite')
  chatType.value = 'edit'
  showChat.value = true
  chatArr.value = []
  inputVal.value = ''
  inputPlaceholder.value = '请输入修改建议'
  setTimeout(() => {
    if (inputRef.value) {
      inputRef.value?.focus()
    }
  }, 20)
}

const handleInputSend = async () => {
  if (chatType.value == 'edit') {
    await postEditStream()
  } else if (chatType.value == 'expand') {
    await postExpandStream()
  }
}

const postEditStream = async () => {
  if (!inputVal.value) {
    ElMessage.warning('请输入修改建议')
    return
  }
  chatLoading.value = true
  // 构建请求参数
  requestData.value = {
    action: chatType.value,
    originalText: props.selectedText,
    query: inputVal.value,
    fullText: currentContent.value,
  }
  chatArr.value = []
  chatArr.value.push({
    role: 'human',
    show_content: inputVal.value,
    content: inputVal.value,
    end: true,
  })
  inputVal.value = ''
  chatArr.value.push({
    role: 'ai',
    show_content: '',
    content: '',
    end: false,
  })
  // 如果已有正在进行的请求，先取消
  if (streamAbortController.value) {
    streamAbortController.value.abort()
  }
  // 重置滚动状态
  scrollbarRef.value?.resetScrollState()
  // 创建新的 AbortController
  streamAbortController.value = new AbortController()

  try {
    await postSelectionToolbarStream(requestData.value, onStreamData, onStreamError, onStreamEnd, {
      signal: streamAbortController.value.signal,
    })
    chatLoading.value = false
  } catch (error) {
    chatLoading.value = false
    // 如果是取消操作，不记录为错误
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.log('流式请求已取消')
      streamAbortController.value = null
      return
    }
    console.error('调用流式接口失败:', error)
    streamAbortController.value = null
    // 更新错误状态
    if (chatArr.value.length > 1 && chatArr.value[1].role === 'ai') {
      chatArr.value[1].content = '生成失败，请重试'
      chatArr.value[1].show_content = '生成失败，请重试'
      chatArr.value[1].end = false
    }
  }
}

const handleExpand = async () => {
  trackingEditorTool('Generate', 'Expand')
  chatType.value = 'expand'
  showChat.value = true
  chatArr.value = []
  inputVal.value = '保持内容不变，字数扩写至两倍'
  inputPlaceholder.value = '请输入扩写建议'
  setTimeout(() => {
    if (inputRef.value) {
      inputRef.value?.focus()
    }
  }, 20)
}

const postExpandStream = async () => {
  if (!inputVal.value) {
    ElMessage.warning('请输入扩写建议')
    return
  }
  chatLoading.value = true
  // 创建新的 AbortController
  streamAbortController.value = new AbortController()

  // 构建请求参数
  requestData.value = {
    action: chatType.value,
    originalText: props.selectedText,
    query: inputVal.value,
    fullText: currentContent.value,
  }
  chatArr.value = []
  chatArr.value.push({
    role: 'human',
    show_content: inputVal.value,
    content: inputVal.value,
    end: true,
  })
  inputVal.value = ''
  chatArr.value.push({
    role: 'ai',
    show_content: '正在生成中，请稍后...',
    content: '正在生成中，请稍后...',
    end: false,
  })

  try {
    await postSelectionToolbarStream(requestData.value, onStreamData, onStreamError, onStreamEnd, {
      signal: streamAbortController.value.signal,
    })
    chatLoading.value = false
  } catch (error) {
    chatLoading.value = false
    // 如果是取消操作，不记录为错误
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.log('流式请求已取消')
      streamAbortController.value = null
      return
    }
    console.error('调用流式接口失败:', error)
    streamAbortController.value = null
    // 更新错误状态
    if (chatArr.value.length > 1 && chatArr.value[1].role === 'ai') {
      chatArr.value[1].content = '生成失败，请重试'
      chatArr.value[1].show_content = '生成失败，请重试'
      chatArr.value[1].end = false
    }
  }
}

const handleAccept = () => {
  // 检查编辑器是否可用
  if (!props.editor) {
    ElMessage.error('编辑器未就绪')
    return
  }

  // 检查是否有生成的内容
  if (chatArr.value.length < 2 || chatArr.value[1].role !== 'ai') {
    ElMessage.warning('没有可用的内容')
    return
  }

  const newContent = chatArr.value[1].content
  if (!newContent || newContent.trim() === '') {
    ElMessage.warning('生成的内容为空')
    return
  }

  // 检查 from 和 to 是否有效
  if (props.from === undefined || props.to === undefined || props.from >= props.to) {
    ElMessage.error('选中范围无效')
    return
  }

  if (chatType.value == 'edit') {
    trackingEditorTool('Use', 'Rewrite')
  } else if (chatType.value == 'expand') {
    trackingEditorTool('Use', 'Expand')
  }

  try {
    const editor = props.editor

    // 步骤1：设置选中范围并删除原内容
    editor.chain().setTextSelection({ from: props.from, to: props.to }).deleteSelection().run()

    // 步骤2：获取删除后的插入位置（光标位置）
    const insertPos = editor.state.selection.$from.pos

    // 步骤3：在插入位置插入新内容
    editor
      .chain()
      .setTextSelection(insertPos)
      .insertContent(newContent, {
        parseOptions: {
          preserveWhitespace: 'full',
        },
      })
      .run()

    // 步骤4：选中替换后的新内容；通过 emit 让父级短暂抑制划词工具，避免再次弹出
    nextTick(() => {
      const currentPos = editor.state.selection.$from.pos
      const startPos = insertPos
      const endPos = currentPos
      if (endPos > startPos) {
        editor.chain().focus().setTextSelection({ from: startPos, to: endPos }).run()
      }
      emit('accept-done')
    })

    ElMessage.success({
      message: '内容已替换',
      offset: 100,
    })

    // 关闭工具栏
    showChat.value = false
    showTool.value = false
  } catch (error) {
    console.error('替换内容失败:', error)
    ElMessage.error('替换内容失败，请重试')
  }
}

const handleImage = async () => {
  trackingEditorTool('Generate', 'Picture')
  const editor = props?.editor
  if (editor) {
    editor.chain().focus().setTextSelection({ from: props?.from, to: props?.to }).run()
  }
  chatType.value = 'image'
  showChat.value = true
  chatArr.value = []
  inputVal.value = ''
  chatArr.value.push({
    role: 'human',
    show_content: '请根据选中内容生成图片',
    content: '请根据选中内容生成图片',
    end: true,
  })
  chatArr.value.push({
    role: 'ai',
    show_content: '正在生成中，请稍后...',
    content: '正在生成中，请稍后...',
    end: false,
  })

  try {
    const req = await generateImage(props.selectedText, currentContent.value)
    if (req?.imageUrl && req.imageUrl != '') {
      chatArr.value[1].content = req.imageUrl
      chatArr.value[1].show_content = req.imageUrl
      chatArr.value[1].end = true
      chatArr.value[1].content_type = 'image'
    } else {
      chatArr.value[1].content = '生成失败，请稍后重试'
      chatArr.value[1].show_content = '生成失败，请稍后重试'
      chatArr.value[1].end = true
      chatArr.value[1].content_type = 'chat'
    }
  } catch (e) {
    console.error(e)
    chatArr.value[1].content = '生成失败，请稍后重试'
    chatArr.value[1].show_content = '生成失败，请稍后重试'
    chatArr.value[1].end = true
    chatArr.value[1].content_type = 'chat'
  }
}

const handleInsetImage = () => {
  // 检查编辑器是否可用
  if (!props.editor) {
    ElMessage.error('编辑器未就绪')
    return
  }

  // 检查 chatArr 是否有数据
  if (!chatArr.value || chatArr.value.length === 0) {
    ElMessage.warning('没有可用的图片')
    return
  }

  trackingEditorTool('Use', 'Picture')

  // 按照用户要求，使用 chatArr.value[0].content 作为图片地址
  // 但为了更准确，优先查找第一个图片项
  let imageUrl: string | undefined
  // 优先查找第一个图片项
  const imageItem = chatArr.value.find(item => item.content_type === 'image')
  if (imageItem && imageItem.content) {
    imageUrl = imageItem.content
  } else if (chatArr.value[0] && chatArr.value[0].content) {
    // 如果没有找到图片项，使用第一个元素的内容
    imageUrl = chatArr.value[0].content
  }

  if (!imageUrl || imageUrl.trim() === '') {
    ElMessage.warning('图片地址为空')
    return
  }

  try {
    const editor = props.editor

    // 确定插入位置：优先使用 props.to，如果无效则使用当前光标位置
    let insertPos: number
    if (props.to !== undefined && props.to >= 0) {
      insertPos = props.to
    } else {
      const { from } = editor.state.selection
      insertPos = from
    }
    // 使用 setImage 命令
    const canSetImage = editor.can().setImage({ src: imageUrl })
    if (canSetImage) {
      // 先设置插入位置，再插入图片
      editor
        .chain()
        .focus()
        .setTextSelection(insertPos)
        .setImage({
          src: imageUrl,
          alt: '插入的图片',
        })
        .run()

      ElMessage.success('图片插入成功')
      showChat.value = false
      showTool.value = false
      return
    }
  } catch (error) {
    console.error('插入图片失败:', error)
    console.error('错误详情:', {
      error,
      imageUrl,
      insertPos: props.to !== undefined ? props.to : 'current cursor',
      hasSetImage: props.editor?.can().setImage,
      editorState: props.editor?.state,
    })
    ElMessage.error(`插入图片失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

const handleAdd = () => {
  // 触发事件，传递选中的文本
  emit('add', props.selectedText || '')
  showTool.value = false
}

const handleNote = () => {
  // 触发事件，传递选中的文本
  emit('note', props.selectedText || '')
  showTool.value = false
}

const handleBack = () => {
  clearSelectionHighlight()
  if (streamAbortController.value) {
    streamAbortController.value.abort()
    streamAbortController.value = null
  }
  showChat.value = false
}

const handleClose = () => {
  clearSelectionHighlight()
  if (streamAbortController.value) {
    streamAbortController.value.abort()
    streamAbortController.value = null
  }
  showChat.value = false
  showTool.value = false
  chatType.value = 'edit'
}

const handleResetChat = () => {
  chatArr.value = []
  chatLoading.value = false
  inputVal.value = ''
  if (chatType.value == 'edit') {
    inputPlaceholder.value = '请输入修改建议'
  } else if (chatType.value == 'expand') {
    inputPlaceholder.value = '请输入扩写建议'
  }
  inputRef.value?.focus()
}

const handleBtnClick = debounce(
  (action: SelectionToolBarAction) => {
    switch (action) {
      case 'edit':
        handleEdit()
        break
      case 'expand':
        handleExpand()
        break
      case 'add':
        handleAdd()
        break
      case 'note':
        handleNote()
        break
    }
  },
  200,
  { leading: true, trailing: false }
)
</script>

<style scoped lang="less">
.panel-input {
  --el-font-size-base: 16px;
  padding-bottom: 6px;

  :deep(.el-textarea__inner) {
    box-shadow: none;
    resize: none;
    padding: 0 8px;
  }
}
</style>
