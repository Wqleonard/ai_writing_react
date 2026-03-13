/**
 * NewbieTour 类型定义
 */

export interface TourConfig {
  /**
   * 首次访问时自动显示引导
   * @default false
   */
  autoShowOnFirstVisit?: boolean
  /**
   * localStorage 的 key
   * @default 'hasSeenNewbieTour'
   */
  storageKey?: string
  /**
   * 允许 ESC 键关闭
   * @default false
   */
  allowEscClose?: boolean
  /**
   * 允许点击遮罩关闭
   * @default false
   */
  allowOverlayClose?: boolean
  /**
   * 允许点击目标元素
   * @default false
   */
  allowTargetClick?: boolean
}

export interface TourCallbacks {
  /**
   * 引导开始时的回调
   */
  onStart?: () => void
  /**
   * 引导完成时的回调
   */
  onFinish?: () => void
  /**
   * 跳过引导时的回调
   */
  onSkip?: () => void
  /**
   * 步骤变化时的回调
   * @param stepIndex 当前步骤索引
   */
  onStepChange?: (stepIndex: number) => void
}
