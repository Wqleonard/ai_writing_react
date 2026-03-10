import storageManager from "./storage";

// 缓存 key
const INVITATION_CODE_NEW_KEY = "invitation_code_new";
const INVITATION_CODE_OLD_KEY = "invitation_code_old";

/**
 * 从 URL 中获取 invitationCode 参数
 */
export const getInvitationCodeFromUrl = (): string | null => {
  if (typeof window === "undefined") return null;

  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("invitationCode");
};

/**
 * 获取新邀请码（从缓存）
 */
export const getNewInvitationCode = (): string | null => {
  try {
    return storageManager.getItem<string>(INVITATION_CODE_NEW_KEY, null);
  } catch (error) {
    return null;
  }
};

/**
 * 保存新邀请码到缓存
 */
export const saveNewInvitationCode = (code: string): void => {
  storageManager.setItem(INVITATION_CODE_NEW_KEY, code);
};

/**
 * 清除新邀请码缓存
 */
export const clearNewInvitationCode = (): void => {
  storageManager.removeItem(INVITATION_CODE_NEW_KEY);
};

/**
 * 获取旧邀请码（从缓存）
 */
export const getOldInvitationCode = (): string | null => {
  return storageManager.getItem<string>(INVITATION_CODE_OLD_KEY, null);
};

/**
 * 保存旧邀请码到缓存
 */
export const saveOldInvitationCode = (code: string): void => {
  storageManager.setItem(INVITATION_CODE_OLD_KEY, code);
};

/**
 * 使用邀请码进行兑换（无感知，不提示用户）
 * 逻辑：
 * 1. 获取新值和旧值
 * 2. 如果没有旧值，直接使用新值兑换
 * 3. 如果有旧值，比对新值和旧值是否相同
 * 4. 如果不同，使用新值兑换
 * 5. 兑换成功：清除新值，保存旧值
 * 6. 兑换失败：不处理新旧值，也不提醒用户
 */
export const redeemInvitationCode = async (): Promise<void> => {
  const newCode = getNewInvitationCode();
  try {
    // 如果没有新值，直接返回
    if (!newCode) {
      return;
    }

    // 获取旧值
    const oldCode = getOldInvitationCode();

    // 如果有旧值且与新值相同，不需要兑换
    if (oldCode && oldCode === newCode) {
      return;
    }

    // 调用兑换接口
    // await useInvitationCodeReq(newCode);
  } catch (error) {
    // 兑换失败：不处理新旧值，也不提醒用户，等待下次触发
    console.log("[redeemInvitationCode] 兑换失败，等待下次触发:", error);
  }
  // 兑换成功：清除新值，保存旧值
  clearNewInvitationCode();
  saveOldInvitationCode(newCode || "");
};

/**
 * 初始化邀请码处理
 * 在应用启动时调用，检查 URL 中是否有 invitationCode
 * 如果有，存储到缓存，并检查用户是否登录
 * 如果已登录，立即调用兑换接口
 */
export const initInvitationCode = async (): Promise<void> => {
  try {
    const codeFromUrl = getInvitationCodeFromUrl();

    // 如果 URL 中没有邀请码，直接返回
    if (!codeFromUrl) {
      return;
    }

    // 保存新邀请码到缓存
    saveNewInvitationCode(codeFromUrl);

    // 检查用户是否登录
    // const loginStore = useLoginStore();
    // if (loginStore.isLoggedIn) {
    //   // 如果已登录，立即调用兑换接口
    //   await redeemInvitationCode();
    // }
    // 如果未登录，等待登录成功后再调用（在 LoginDialog 中处理）
  } catch (error) {
    console.error("[initInvitationCode] 初始化邀请码失败:", error);
  }
};
