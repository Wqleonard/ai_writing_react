/**
 * 动态 rem 适配工具
 *
 * PC 端：
 * - 设计稿尺寸：1920px
 * - 当屏幕宽度为 1920px 时，font-size 为 16px
 * - 适配规则：
 *   - 1440px <= clientWidth <= 1920px: font-size 保持 16px 不变
 *   - clientWidth < 1440px: 以 1440px 为基准等比缩小
 *   - clientWidth > 1920px: 以 1920px 为基准等比放大
 *
 * 移动端：
 * - 设计稿尺寸：750px
 * - 当屏幕宽度为 750px 时，font-size 为 16px
 * - 适配规则：以 750px 为基准等比缩放
 */

/**
 * 检测是否为移动设备（包括 iPad）
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;

  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

  // 检测移动设备 User-Agent（Android、iPhone、iPod 等）
  const mobileRegex = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i;

  // 检测 iPad
  // iPadOS 13+ 的 User-Agent 可能包含 "Macintosh"，但会有触摸支持且没有鼠标
  const isIPad = /iPad/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) &&
     'ontouchend' in document &&
     navigator.maxTouchPoints > 0 &&
     !(window as any).matchMedia('(pointer: fine)').matches);

  // 检测屏幕宽度（移动设备通常小于 1024px，但 iPad 可能更大）
  const isSmallScreen = window.innerWidth <= 1024;

  // 检测触摸支持
  const hasTouchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // 综合判断：移动设备 User-Agent 或 iPad 或（小屏幕 + 触摸支持）
  return mobileRegex.test(userAgent) || isIPad || (isSmallScreen && hasTouchSupport);
}

/**
 * 设置根节点 font-size，实现 rem 适配
 * 自动根据设备类型选择 PC 端或移动端配置
 *
 * @param forceMobile 强制使用移动端配置（可选）
 */
export function setRem(forceMobile?: boolean) {
  const isMobile = forceMobile !== undefined ? forceMobile : isMobileDevice();

  // PC 端配置
  const pcConfig = {
    designWidth: 1920,
    baseFontSize: 16,
    minFontSize: 4,
    maxFontSize: 32,
    minFixedWidth: 1440,
    maxFixedWidth: 1920,
  };

  // 移动端配置
  const mobileConfig = {
    designWidth: 750,
    baseFontSize: 16,
    minFontSize: 4,
    maxFontSize: 32,
  };

  // 根据设备类型选择配置
  const config = isMobile ? mobileConfig : pcConfig;

  /**
   * 设置根节点字体大小
   */
  function setRootFontSize() {
    const clientWidth = document.documentElement.clientWidth || document.body.clientWidth;

    let fontSize: number;

    if (isMobile) {
      // 移动端：以设计稿宽度为基准等比缩放
      fontSize = config.baseFontSize * (clientWidth / config.designWidth);
    } else {
      // PC 端：根据屏幕宽度范围计算
      if (clientWidth >= pcConfig.minFixedWidth && clientWidth <= pcConfig.maxFixedWidth) {
        // 1440px - 1920px 之间：保持 16px 不变
        fontSize = config.baseFontSize;
      } else if (clientWidth < pcConfig.minFixedWidth) {
        // 小于 1440px：以 1440px 为基准等比缩小
        fontSize = config.baseFontSize * (clientWidth / pcConfig.minFixedWidth);
      } else {
        // 大于 1920px：以 1920px 为基准等比放大
        fontSize = config.baseFontSize * (clientWidth / pcConfig.maxFixedWidth);
      }
    }

    // 限制在最小和最大值之间
    fontSize = Math.max(config.minFontSize, Math.min(config.maxFontSize, fontSize));

    // 设置根节点字体大小
    document.documentElement.style.fontSize = `${fontSize}px`;
  }

  // 初始化设置
  setRootFontSize();

  // 防抖处理，避免频繁计算
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;

  // 监听窗口大小变化
  window.addEventListener('resize', () => {
    if (resizeTimer) {
      clearTimeout(resizeTimer);
    }
    resizeTimer = setTimeout(setRootFontSize, 100);
  });

  // 监听屏幕旋转
  window.addEventListener('orientationchange', () => {
    setTimeout(setRootFontSize, 100);
  });
}

/**
 * 设置移动端 rem 适配（向后兼容）
 * @deprecated 请使用 setRem(true) 代替
 */
export function setMobileRem() {
  setRem(true);
}
