<template>
  <el-scrollbar
    ref="scrollbarRef"
    :max-height="maxHeight"
    @scroll="handleScrollbarScroll"
    class="auto-scrollbar"
  >
    <slot/>
  </el-scrollbar>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted, onBeforeUnmount } from 'vue';

interface Props {
  maxHeight?: string | number;
  // 是否启用自动滚动
  autoScroll?: boolean;
  // 底部阈值
  bottomThreshold?: number;
}

const props = withDefaults(defineProps<Props>(), {
  maxHeight: 400,
  autoScroll: true,
  bottomThreshold: 50
});

// el-scrollbar 引用
const scrollbarRef = ref<any>(null);

// 用户是否手动滚动离开底部（默认false，false时自动滚动）
const isUserScrolledAway = ref(false);

// ResizeObserver 实例
let resizeObserver: ResizeObserver | null = null;

// 防抖定时器
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// 上次滚动位置，用于检测滚动方向
const lastScrollTop = ref<number>(0);

// wheel 事件处理函数引用（用于清理）
let wheelHandler: ((e: WheelEvent) => void) | null = null;

/**
 * 检查是否在底部区域
 */
const isNearBottom = (threshold = props.bottomThreshold): boolean => {
  if (!scrollbarRef.value) return false;
  const scrollbarWrap = scrollbarRef.value?.wrapRef;
  if (!scrollbarWrap) return false;

  const {scrollTop, scrollHeight, clientHeight} = scrollbarWrap;
  return scrollHeight - scrollTop - clientHeight <= threshold;
};

/**
 * 检查是否需要自动滚动到底部
 * 只有当用户没有主动滚动离开底部时，才自动滚动
 */
const checkAndAutoScroll = () => {
  if (!props.autoScroll || !scrollbarRef.value || isUserScrolledAway.value) {
    return;
  }

  nextTick(() => {
    try {
      const scrollbarWrap = scrollbarRef.value?.wrapRef;
      if (!scrollbarWrap) return;

      scrollbarWrap.scrollTop = scrollbarWrap.scrollHeight;
    } catch (error) {
      console.error('[AutoScrollbar] 自动滚动失败:', error);
    }
  });
};

/**
 * 强制滚动到底部
 * 无论用户是否滚动过，都会滚动到底部，并重置用户滚动状态
 */
const scrollToBottom = () => {
  if (!scrollbarRef.value) return;

  nextTick(() => {
    try {
      const scrollbarWrap = scrollbarRef.value?.wrapRef;
      if (!scrollbarWrap) return;

      scrollbarWrap.scrollTop = scrollbarWrap.scrollHeight;

      // 重置用户滚动状态，恢复自动滚动
      isUserScrolledAway.value = false;
    } catch (error) {
      console.error('[AutoScrollbar] 滚动到底部失败:', error);
    }
  });
};

/**
 * 滚动到顶部
 */
const scrollToTop = () => {
  if (!scrollbarRef.value) return;

  nextTick(() => {
    try {
      const scrollbarWrap = scrollbarRef.value?.wrapRef;
      if (!scrollbarWrap) return;

      scrollbarWrap.scrollTop = 0;
    } catch (error) {
      console.error('[AutoScrollbar] 滚动到顶部失败:', error);
    }
  });
};

/**
 * 重置自动滚动状态
 * 恢复自动滚动功能
 */
const resetScrollState = () => {
  isUserScrolledAway.value = false;
  checkAndAutoScroll();
};

/**
 * 处理用户手动滚动
 * 检测用户滚动行为，更新 isUserScrolledAway 状态
 */
const handleScrollbarScroll = () => {
  if (!scrollbarRef.value) return;

  try {
    const scrollbarWrap = scrollbarRef.value?.wrapRef;
    if (!scrollbarWrap) return;

    const scrollHeight = scrollbarWrap.scrollHeight;
    const scrollTop = scrollbarWrap.scrollTop;
    const clientHeight = scrollbarWrap.clientHeight;

    // 计算距离底部的距离
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;

    // 如果用户滚动到了最底部，重新开启自动滚动
    if (distanceToBottom <= props.bottomThreshold) {
      isUserScrolledAway.value = false;
    } else if (Math.abs(scrollTop - lastScrollTop.value) > 0.5) {
      // 滚动位置发生变化（排除微小误差），说明用户操作了滚动条
      // 且不在底部，标记为已操作，停止自动滚动
      isUserScrolledAway.value = true;
    }

    // 更新上次滚动位置
    lastScrollTop.value = scrollTop;
  } catch (error) {
    console.error('[AutoScrollbar] 处理滚动事件失败:', error);
  }
};

/**
 * 处理 wheel 事件
 * 更精确地检测用户滚动操作
 */
const handleWheel = () => {
  // 用户通过滚轮操作，标记为已操作
  isUserScrolledAway.value = true;

  // 延迟检查是否滚动到底部
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    if (isNearBottom()) {
      // 如果滚动到底部，恢复自动滚动
      isUserScrolledAway.value = false;
    }
  }, 100);
};

/**
 * 获取当前滚动位置信息
 */
const getScrollInfo = () => {
  if (!scrollbarRef.value) {
    return {
      scrollTop: 0,
      scrollHeight: 0,
      clientHeight: 0,
      distanceToBottom: 0,
      isAtBottom: false
    };
  }

  try {
    const scrollbarWrap = scrollbarRef.value?.wrapRef;
    if (!scrollbarWrap) {
      return {
        scrollTop: 0,
        scrollHeight: 0,
        clientHeight: 0,
        distanceToBottom: 0,
        isAtBottom: false
      };
    }

    const scrollHeight = scrollbarWrap.scrollHeight;
    const scrollTop = scrollbarWrap.scrollTop;
    const clientHeight = scrollbarWrap.clientHeight;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;

    return {
      scrollTop,
      scrollHeight,
      clientHeight,
      distanceToBottom,
      isAtBottom: distanceToBottom < 2
    };
  } catch (error) {
    console.error('[AutoScrollbar] 获取滚动信息失败:', error);
    return {
      scrollTop: 0,
      scrollHeight: 0,
      clientHeight: 0,
      distanceToBottom: 0,
      isAtBottom: false
    };
  }
};

/**
 * 设置内容变化监听
 * 使用 ResizeObserver 自动检测内容高度变化
 */
const setupContentObserver = () => {
  nextTick(() => {
    try {
      const scrollbarWrap = scrollbarRef.value?.wrapRef;
      if (!scrollbarWrap) return;

      // 获取内容容器（scrollbarWrap 的第一个子元素）
      const contentElement = scrollbarWrap.querySelector('.el-scrollbar__view');
      if (!contentElement) return;

      // 清理旧的观察器
      if (resizeObserver) {
        resizeObserver.disconnect();
      }

      // 创建 ResizeObserver 监听内容高度变化
      resizeObserver = new ResizeObserver(() => {
        checkAndAutoScroll();
      });

      // 开始观察
      resizeObserver.observe(contentElement);

      // 监听 wheel 事件，更精确地检测用户操作
      wheelHandler = handleWheel;
      scrollbarWrap.addEventListener('wheel', wheelHandler, {passive: true});

      // 初始化滚动位置
      lastScrollTop.value = scrollbarWrap.scrollTop;
    } catch (error) {
      console.error('[AutoScrollbar] 设置内容监听失败:', error);
    }
  });
};

/**
 * 清理内容监听
 */
const cleanupContentObserver = () => {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  // 清理 wheel 事件监听
  if (wheelHandler && scrollbarRef.value?.wrapRef) {
    scrollbarRef.value.wrapRef.removeEventListener('wheel', wheelHandler);
    wheelHandler = null;
  }

  // 清理防抖定时器
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
};

// 监听 autoScroll 属性变化
watch(() => props.autoScroll, (newVal) => {
  if (newVal) {
    // 启用自动滚动时，重置状态并滚动到底部
    resetScrollState();
  }
});

// 组件挂载后设置监听
onMounted(() => {
  setupContentObserver();
});

// 组件卸载前清理
onBeforeUnmount(() => {
  cleanupContentObserver();
});

// 暴露方法给父组件
defineExpose({
  scrollToBottom,
  scrollToTop,
  resetScrollState,
  checkAndAutoScroll,
  getScrollInfo,
  scrollbarRef
});
</script>

<style scoped>
.auto-scrollbar {
  height: fit-content;
}

/* 可以在这里添加自定义样式 */
</style>
