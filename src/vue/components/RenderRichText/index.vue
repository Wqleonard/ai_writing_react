<template>
  <div
    v-if="content && content.trim() !== ''"
    :class="containerClass"
    :style="containerStyle"
  >
    <div
      class="render-rich-text-content"
      :style="contentStyle"
      v-html="content"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import './index.less'

/**
 * RenderRichText 组件 Props
 */
interface RenderRichTextProps {
  /**
   * HTML 内容字符串
   */
  content?: string
  /**
   * 自定义类名
   */
  className?: string
  /**
   * 自定义样式
   */
  style?: Record<string, string | number>
  /**
   * 是否显示边框和背景
   * @default false
   */
  bordered?: boolean
  /**
   * 最大高度，超出时显示滚动条
   */
  maxHeight?: number | string
}

const props = withDefaults(defineProps<RenderRichTextProps>(), {
  content: '',
  className: '',
  bordered: false,
})

// 计算容器类名
const containerClass = computed(() => {
  const classes = ['render-rich-text']
  if (props.bordered) {
    classes.push('render-rich-text-bordered')
  }
  if (props.className) {
    classes.push(props.className)
  }
  return classes.join(' ')
})

// 计算容器样式
const containerStyle = computed(() => {
  const style: Record<string, string | number> = {}
  if (props.style) {
    Object.assign(style, props.style)
  }
  return style
})

// 计算内容区域样式
const contentStyle = computed(() => {
  const style: Record<string, string | number> = {}
  if (props.maxHeight) {
    style.maxHeight = typeof props.maxHeight === 'number'
      ? `${props.maxHeight}px`
      : props.maxHeight
    style.overflowY = 'auto'
  }
  return style
})
</script>
