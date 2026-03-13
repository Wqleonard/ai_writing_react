/**
 * @description: tracking point
 */

// init 初始化（依赖 main.ts 中 app.use(VueMatomo, ...) 已执行，从而 window._paq 已存在）
const initMatomoEvent = () => {
  if (!window._paq) {
    console.error(
      '[Matomo] _paq is not initialized. Ensure main.ts calls app.use(VueMatomo, { host, siteId }) and that VueMatomo is not inside a try-block that skips it (e.g. move it out of the same try as VueFullPage).'
    );
    return;
  }

  console.log('[Matomo] Successfully initialized, _paq is available');
  
  // 检测是否有 userInfo，如果有则设置用户id
  const userInfo = localStorage.getItem("userInfo");
  if (userInfo) {
    try {
      const userInfoObj = JSON.parse(userInfo);
      if (userInfoObj.id) {
        setMatomoUser(userInfoObj.id);
        console.log('[Matomo] User ID set:', userInfoObj.id);
      }
    } catch (error) {
      console.error('[Matomo] Error parsing userInfo:', error);
    }
  }
};

// 设置用户id
const setMatomoUser = (userId: string) => {
  window._paq?.push(["setUserId", userId]);
};

// 登出重置用户id
const resetMatomoUser = () => {
  window._paq?.push(["resetUserId"]);
};

export type TrackingEventAction =
  | "Use"
  | "Click"
  | "Generate"
  | "Add"
  | "Create"
  | "Apply"
  | "Step"
  | "Complete"
  | "Success"
  | "Impression"
  | "Save"
  | "Start"
  | "Export";

//通用埋点
const trackEvent = (
  category: string,
  action: TrackingEventAction,
  name?: string,
  value?: number
) => {
  if (!window._paq) {
    console.warn('[Matomo] window._paq is not initialized yet');
    return;
  }
  try {
    window._paq.push(["trackEvent", category, action, name, value]);
  } catch (error) {
    console.error('[Matomo] trackEvent error:', error);
  }
};

export { trackEvent, resetMatomoUser, setMatomoUser, initMatomoEvent };
