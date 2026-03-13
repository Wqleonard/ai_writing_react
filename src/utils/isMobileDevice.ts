/**
 * 检测是否为移动设备（与 Vue 版 src/utils/utils.ts isMobileDevice 对齐）
 */
export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false

  const userAgent = navigator.userAgent || navigator.vendor || (window as Window & { opera?: string }).opera || ''

  const mobileRegex = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i

  const isIPad =
    /iPad/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) &&
      'ontouchend' in document &&
      navigator.maxTouchPoints > 0 &&
      !(window as Window).matchMedia('(pointer: fine)').matches)

  const isSmallScreen = window.innerWidth <= 1024
  const hasTouchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  return mobileRegex.test(userAgent) || isIPad || (isSmallScreen && hasTouchSupport)
}
