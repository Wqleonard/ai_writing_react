import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createNewUserReq, loginReq, verifyTicket, getNewbieMission, type GuideTask, completeNewbieMissionReq } from '@/api/users.ts'
import { useRouter } from 'vue-router'
import { resetMatomoUser, setMatomoUser } from '@/utils/matomoTrackingEvent/trackingMatomoEvent'
import { trackingUserLogin, trackingUserRegister } from '@/utils/matomoTrackingEvent/accEvent'
import { getInsiteNotification, type NotificationItem } from '@/api/insite-notification'
import { getNewInvitationCode } from '@/utils/invitationCode'

export type LoginType = "account" | "sms" | "register";

export interface LoginForm {
  phone: string;
  password: string;
  smsCode: string;
  confirmPassword: string;
  invitationCode: string;
  nickName: string;
}

export interface UserInfo {
  id: string;
  createdTime?: string;
  phone: string;
  nickName: string;
  limitStatus?: number;
}

// 头像数据类型
export interface AvatarData {
  color: {
    r: number;
    g: number;
    b: number;
  };
  hash: number;
}

// 消息数据类型
export interface Message {
  id: string | number;
  title: string;
  desc: string;
  content: string;
  timestamp: string;
  isReaded: boolean;
}

// 被拦截的操作类型：可以是一个函数或返回 Promise 的函数
// 支持无参数和带参数的函数
export type InterceptedAction = (...args: any[]) => void | Promise<void>;

export const useLoginStore = defineStore("login", () => {
  // 状态
  const isLoggedIn = ref(false);
  const userInfo = ref<UserInfo | null>(null);
  const loginType = ref<LoginType>("account");
  const isLoading = ref(false);
  const smsCountdown = ref(0);
  const messages = ref<Message[]>([]);
  // 已读消息ID列表
  const readedMessageIds = ref<string[]>([]);
  // 分页状态
  const messagePage = ref(0);
  const messagePageSize = ref(20);
  const hasMoreMessages = ref(true);
  const isLoadingMessages = ref(false);

  const NEWBIE_TOUR_STORAGE_KEY = 'hasNewbieTourShowed'
  const hasNewbieTourShowed = ref<boolean>(
    localStorage.getItem(NEWBIE_TOUR_STORAGE_KEY) === 'true'
  )
  const setNewbieTourShowed = () => {
    hasNewbieTourShowed.value = true
    localStorage.setItem(NEWBIE_TOUR_STORAGE_KEY, 'true')
  }

  const sendIdeaTourShow = ref(false)

  // 新手任务：展示用每组为 [父任务, ...子任务]，无子任务时为 [任务]
  const missionGroup = ref<GuideTask[]>([])
  const updateNewbieMission = async () => {
    if (!isLoggedIn.value) return
    try {
      const res = await getNewbieMission()
      const tasks = res?.tasks
      if (Array.isArray(tasks)) {
        missionGroup.value = res?.tasks
      }
    } catch (error) {
      console.error(error)
    }
  }
  /**
   * 递归统计任务数量（包括子任务）
   * @param tasks 任务列表
   * @returns { total: 总任务数, done: 已完成任务数 }
   */
  const countTasks = (tasks: GuideTask[]): { total: number; done: number } => {
    let total = 0
    let done = 0

    tasks.forEach((task) => {
      // 统计当前任务
      total++
      if (task.status === 1) {
        done++
      }

      // 递归统计子任务
      if (task.children && task.children.length > 0) {
        const childStats = countTasks(task.children)
        total += childStats.total
        done += childStats.done
      }
    })

    return { total, done }
  }

  const newbieMissionProgressPercent = computed(() => {
    const tasks = missionGroup.value
    if (!tasks || tasks.length === 0) return '0%'

    // 递归统计所有任务（包括子任务）
    const { total, done } = countTasks(tasks)

    if (total === 0) return '0%'

    const percent = Math.round((done / total) * 100)
    console.log(`[新手任务] 进度: ${done}/${total} = ${percent}%`)

    return `${percent}%`
  })

  const completeNewbieMission = async (taskId: number) => {
    try {
      if(!taskId) return
      if(!isLoggedIn.value) return
      if(!missionGroup.value.length){
        await updateNewbieMission()
      }
      const res = await completeNewbieMissionReq(taskId)
      await updateNewbieMission()
      console.log(res)
    } catch (error) {
      console.error(error)
    }
  }

  /**
   * 通过任务 code 完成新手任务
   * @param code 任务代码（如 'START_CREAT_WROK', 'USE_WRITING_EDITOR' 等）
   * @returns Promise<boolean> 是否成功完成任务
   */
  const completeNewbieMissionByCode = async (code: string): Promise<boolean> => {
    try {
      if (!code) {
        console.warn('[新手任务] code 为空')
        return false
      }

      if (!isLoggedIn.value) {
        console.warn('[新手任务] 用户未登录')
        return false
      }

      // 如果任务列表为空，先更新
      if (!missionGroup.value.length) {
        await updateNewbieMission()
      }

      // 拍平任务列表（包括所有子任务）
      const flattenTasks = (tasks: GuideTask[]): GuideTask[] => {
        const result: GuideTask[] = []

        tasks.forEach((task) => {
          result.push(task)

          // 递归拍平子任务
          if (task.children && task.children.length > 0) {
            result.push(...flattenTasks(task.children))
          }
        })

        return result
      }

      const allTasks = flattenTasks(missionGroup.value)

      // 通过 code 查找任务
      const targetTask = allTasks.find((task) => task.code === code)

      if (!targetTask) {
        console.warn(`[新手任务] 未找到 code 为 "${code}" 的任务`)
        return false
      }

      // 检查任务是否已完成
      if (targetTask.status === 1) {
        console.log(`[新手任务] 任务 "${targetTask.name}" (${code}) 已完成，跳过`)
        return true
      }

      console.log(`[新手任务] 开始完成任务: ${targetTask.name} (taskId: ${targetTask.taskId}, code: ${code})`)

      // 调用接口完成任务
      const res = await completeNewbieMissionReq(targetTask.taskId)

      // 更新任务列表
      await updateNewbieMission()

      console.log(`[新手任务] 任务 "${targetTask.name}" 完成成功 ✅`)

      return true
    } catch (error) {
      console.error('[新手任务] 完成任务失败:', error)
      return false
    }
  }

  // 格式化时间戳（相对时间）
  const formatTimestamp = (createdAt: string): string => {
    if (!createdAt) return "刚刚";

    const now = new Date();
    const date = new Date(createdAt);
    const diffMs = now.getTime() - date.getTime();

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return "刚刚";
    if (diffMinutes < 60) return `${diffMinutes}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;

    return date.toLocaleDateString("zh-CN");
  };

  // 从 HTML 内容中提取第一个 p/h1/h2/h3/h4 标签的内容作为描述
  const extractDescFromContent = (content: string): string => {
    if (!content || typeof content !== "string") {
      return "";
    }

    // 匹配第一个 p/h1/h2/h3/h4 标签及其内容
    // 使用非贪婪匹配，匹配第一个闭合的标签
    const tagPattern = /<(p|h1|h2|h3|h4)[^>]*>([\s\S]*?)<\/\1>/i;
    const match = content.match(tagPattern);

    if (match && match[2]) {
      // 提取标签内的文本内容，去除 HTML 标签和实体
      let textContent = match[2]
        .replace(/<[^>]+>/g, "") // 移除所有 HTML 标签
        .replace(/&nbsp;/g, " ") // 替换 &nbsp; 为空格
        .replace(/&lt;/g, "<") // 替换 &lt; 为 <
        .replace(/&gt;/g, ">") // 替换 &gt; 为 >
        .replace(/&amp;/g, "&") // 替换 &amp; 为 &
        .replace(/&quot;/g, '"') // 替换 &quot; 为 "
        .replace(/&#39;/g, "'") // 替换 &#39; 为 '
        .replace(/&[a-z0-9]+;/gi, "") // 移除其他 HTML 实体
        .replace(/\s+/g, " ") // 将多个空白字符替换为单个空格
        .trim(); // 去除首尾空白

      return textContent || "...";
    }

    return "...";
  };

  // 将 NotificationItem 转换为 Message
  const convertNotificationToMessage = (notification: NotificationItem): Message => {
    const messageIdStr = notification.id.toString();
    const isReaded = readedMessageIds.value.includes(messageIdStr) || false;

    return {
      id: notification.id,
      title: notification.title,
      desc: extractDescFromContent(notification.content),
      content: notification.content,
      timestamp: formatTimestamp(notification.createdAt),
      isReaded: isReaded,
    };
  };

  // 是否有未读消息
  const hasUnreadMessages = computed(() => {
    // 如果消息列表为空，返回 false
    if (messages.value.length === 0) {
      return false;
    }
    // 遍历消息，如果有 isReaded = false 的项，立刻返回 true
    for (const message of messages.value) {
      if (message.isReaded === false) {
        return true;
      }
    }
    return false;
  });

  // 保存已读消息ID到 localStorage
  const saveReadedMessageIds = (ids: string[]) => {
    try {
      const jsonStr = JSON.stringify(ids);
      localStorage.setItem("readedMessageIds", jsonStr);
      readedMessageIds.value = ids;
    } catch (error) {
      console.error("保存已读消息ID失败:", error);
    }
  };

  // 从 localStorage 加载已读消息ID
  const loadReadedMessageIds = (): string[] => {
    try {
      const saved = localStorage.getItem("readedMessageIds");
      if (saved) {
        const parsed = JSON.parse(saved);
        readedMessageIds.value = Array.isArray(parsed) ? parsed : [];
        return readedMessageIds.value;
      }
    } catch (error) {
      console.error("解析已读消息ID失败:", error);
      localStorage.removeItem("readedMessageIds");
      readedMessageIds.value = [];
    }
    return [];
  };

  loadReadedMessageIds();

  // 标记消息为已读
  const markMessageAsRead = (messageId: string | number) => {
    const idStr = messageId.toString();
    if (!readedMessageIds.value.includes(idStr)) {
      const updatedIds = [...readedMessageIds.value, idStr];
      saveReadedMessageIds(updatedIds);

      // 同时更新消息的 isReaded 属性
      const message = messages.value.find((msg) => msg.id.toString() === idStr);
      if (message) {
        message.isReaded = true;
      }
    }
  };

  // 更新消息列表（从第一页开始加载）
  const updateMessages = async () => {
    if (isLoadingMessages.value) return;
    loadReadedMessageIds();

    try {
      isLoadingMessages.value = true;
      messagePage.value = 0;
      hasMoreMessages.value = true;

      const response = await getInsiteNotification(0, messagePageSize.value);
      if (response?.content) {
        const convertedMessages = response?.content.map(convertNotificationToMessage);
        messages.value = convertedMessages;

        // 更新分页状态
        hasMoreMessages.value = !response?.last;
        messagePage.value = 0;
      } else {
        messages.value = [];
        hasMoreMessages.value = false;
      }

      return messages.value;
    } catch (error) {
      console.error("更新消息列表失败:", error);
      messages.value = [];
      hasMoreMessages.value = false;
      throw error;
    } finally {
      isLoadingMessages.value = false;
    }
  };

  // 加载更多消息（瀑布流）
  const loadMoreMessages = async () => {
    if (isLoadingMessages.value || !hasMoreMessages.value) return;

    try {
      isLoadingMessages.value = true;
      const nextPage = messagePage.value + 1;

      const response = await getInsiteNotification(nextPage, messagePageSize.value);

      if (response?.content && response.content.length > 0) {
        const convertedMessages = response.content.map(convertNotificationToMessage);
        messages.value = [...messages.value, ...convertedMessages];

        // 更新分页状态
        hasMoreMessages.value = !response.last;
        messagePage.value = nextPage;
      } else {
        hasMoreMessages.value = false;
      }
    } catch (error) {
      console.error("加载更多消息失败:", error);
      hasMoreMessages.value = false;
    } finally {
      isLoadingMessages.value = false;
    }
  };

  // 初始化时加载已读消息ID

  const avatarData = computed(() => {
    return renderAvatarFromData(makeRandomAvatar(userInfo.value?.phone + "" || "morenToux"));
  });

  // 被拦截的操作队列
  const interceptedActions = ref<InterceptedAction[]>([]);

  // 表单数据
  const loginForm = ref<LoginForm>({
    phone: "",
    password: "",
    smsCode: "",
    confirmPassword: "",
    invitationCode: "",
    nickName: "",
  });

  // 计算属性
  const isAccountLogin = computed(() => loginType.value === "account");
  const isSmsLogin = computed(() => loginType.value === "sms");
  const isRegister = computed(() => loginType.value === "register");
  const canSendSms = computed(
    () => smsCountdown.value === 0 && loginForm.value.phone.length === 11,
  );
  const smsButtonText = computed(() =>
    smsCountdown.value > 0 ? `${smsCountdown.value}s后重发` : "获取验证码",
  );

  // 更新登录状态
  const updateLoginStatus = () => {
    const token = localStorage.getItem("token");
    isLoggedIn.value = !!token;
  };

  // 封装 userInfo 的持久化方法
  const saveUserInfo = (info: UserInfo | null) => {
    console.log("saveUserInfo 被调用，info:", info);
    if (info) {
      const jsonStr = JSON.stringify(info);
      localStorage.setItem("userInfo", jsonStr);
      if (info.id) {
        setMatomoUser(info.id);
      }
      userInfo.value = info;
      console.log("已保存 userInfo 到 localStorage 和 store");
      console.log("localStorage 中的值:", localStorage.getItem("userInfo"));
      console.log("store 中的值:", userInfo.value);
    } else {
      localStorage.removeItem("userInfo");
      resetMatomoUser();
      userInfo.value = null;
      console.log("已清除 userInfo");
    }
  };

  // 从 localStorage 加载 userInfo
  const loadUserInfo = (): UserInfo | null => {
    try {
      const saved = localStorage.getItem("userInfo");
      if (saved) {
        const parsed = JSON.parse(saved);
        userInfo.value = parsed;
        return parsed;
      }
    } catch (error) {
      console.error("解析用户信息失败:", error);
      localStorage.removeItem("userInfo");
      userInfo.value = null;
    }
    return null;
  };

  // 初始化时从 localStorage 加载 userInfo
  loadUserInfo();

  // 执行被拦截的操作队列
  const executeInterceptedActions = async () => {
    if (interceptedActions.value.length === 0) {
      return;
    }

    // 复制队列并清空，避免在执行过程中有新操作加入导致重复执行
    const actionsToExecute = [...interceptedActions.value];
    interceptedActions.value = [];
    // 按顺序执行所有操作
    for (const action of actionsToExecute) {
      try {
        const result = action();
        // 如果是 Promise，等待其完成
        if (result instanceof Promise) {
          await result;
        }
      } catch (error) {
        console.error("执行被拦截的操作时出错:", error);
        // 继续执行后续操作，不因单个操作失败而中断
      }
    }
  };

  // 需要登录的操作拦截器
  // 如果用户已登录，直接执行操作；如果未登录，将操作加入队列并显示登录对话框
  // 支持带参数的函数调用
  const requireLogin = async <T extends any[]>(
    action: (...args: T) => void | Promise<void>,
    ...args: T
  ) => {
    if (isLoggedIn.value) {
      // 已登录，直接执行，传递参数
      const result = action(...args);
      // 如果是 Promise，返回它以便调用者可以 await
      return result instanceof Promise ? result : Promise.resolve();
    } else {
      // 未登录，将操作和参数一起加入队列（使用闭包保存参数）
      interceptedActions.value.push(() => action(...args));
      // 使用 showLoginDialog 显示登录对话框
      try {
        const { default: showLoginDialog } = await import('@/components/LoginDialog/showLoginDialog.ts')
        await showLoginDialog()
        // 执行被拦截的操作
        await executeInterceptedActions();
      } catch (error) {
        // 用户取消或关闭对话框，清空被拦截的操作队列
        clearInterceptedActions();
        // 返回一个被拒绝的 Promise，表示操作被拦截
        return Promise.reject(new Error("需要登录"));
      }
    }
  };

  // 清空被拦截的操作队列
  const clearInterceptedActions = () => {
    interceptedActions.value = [];
  };

  // 切换登录类型
  const setLoginType = (type: LoginType) => {
    loginType.value = type;
    // 清空表单
    loginForm.value = {
      phone: "",
      password: "",
      smsCode: "",
      confirmPassword: "",
      invitationCode: "",
      nickName: "",
    };
  };

  // 更新表单数据
  const updateForm = (field: keyof LoginForm, value: string) => {
    loginForm.value[field] = value;
  };

  // 发送短信验证码
  const sendSmsCode = async () => {
    if (!canSendSms.value) return;

    try {
      isLoading.value = true;
      // 模拟API调用
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 开始倒计时
      smsCountdown.value = 60;
      const timer = setInterval(() => {
        smsCountdown.value--;
        if (smsCountdown.value <= 0) {
          clearInterval(timer);
        }
      }, 1000);

      console.log("短信验证码已发送到:", loginForm.value.phone);
      return { success: true, message: "验证码已发送" };
    } catch (error) {
      console.error("发送验证码失败:", error);
      return { success: false, message: "发送失败，请重试" };
    } finally {
      isLoading.value = false;
    }
  };

  // 账号密码登录
  const loginWithPassword = async () => {
    try {
      isLoading.value = true;
      const req = await loginReq({
        phone: loginForm.value.phone,
        password: loginForm.value.password,
      });
      if (req?.token) {
        localStorage.setItem("token", req.token);
      }
      // 更新用户信息
      if (req?.user) {
        saveUserInfo(req.user);
      } else {
        // 如果没有返回用户信息，创建一个基本的用户信息
        const basicUserInfo: UserInfo = {
          id: req.userId || "",
          phone: loginForm.value.phone,
          nickName: "用户" + loginForm.value.phone.slice(-4),
        };
        saveUserInfo(basicUserInfo);
      }

      // 更新登录状态
      updateLoginStatus();

      // 账号密码登录埋点
      trackingUserLogin();
      return { success: true, message: "登录成功" };
    } catch (error: any) {
      console.error("登录失败:", error);
      return { success: false, message: error?.response?.data?.message || "登录失败" };
    } finally {
      isLoading.value = false;
    }
  };

  // 短信验证码登录
  const loginWithSms = async () => {
    return { success: false, message: "验证码登录功能暂未开发，敬请期待" };
  };

  const loginWithTicket = async (ticket: string) => {
    try {
      isLoading.value = true
      const invitationCode = getNewInvitationCode();
      const req = await verifyTicket(ticket, invitationCode || '')
      if (req?.token) {
        localStorage.setItem('token', req.token)
      }
      if (req?.user) {
        saveUserInfo(req.user)
      }
      updateLoginStatus()
      return { success: true, message: '登录成功' }
    } catch (error: any) {
      isLoading.value = false
      return { success: false, message: error?.response?.data?.message || '登录失败' }
    }
  }

  // 注册
  const register = async () => {
    try {
      isLoading.value = true;

      const registerInfo = {
        phone: loginForm.value.phone,
        password: loginForm.value.password,
        invitationCode: loginForm.value.invitationCode,
        nickName: loginForm.value.nickName,
      };

      const req = await createNewUserReq({
        phone: loginForm.value.phone,
        password: loginForm.value.password,
        invitationCode: loginForm.value.invitationCode,
        nickName: loginForm.value.nickName,
      });
      const lgReq = await loginReq(registerInfo);
      if (lgReq?.token) {
        localStorage.setItem("token", lgReq.token);
      }

      if (lgReq?.user) {
        saveUserInfo(lgReq.user);
      } else {
        // 如果没有返回用户信息，创建一个基本的用户信息
        const basicUserInfo: UserInfo = {
          id: lgReq.userId || "1",
          phone: registerInfo.phone,
          nickName: "用户" + lgReq.phone.slice(-4),
        };
        saveUserInfo(basicUserInfo);
      }
      // 更新登录状态
      updateLoginStatus();

      // 邀请码注册埋点
      if (userInfo.value) {
        trackingUserRegister();
      }
      return { success: true, message: "注册成功" };
    } catch (error: any) {
      console.log(error);
      console.error("注册失败:", error);
      return { success: false, message: error?.response?.data?.message || "注册失败" };
    } finally {
      isLoading.value = false;
    }
  };
  const router = useRouter();
  // 退出登录

  const logout = () => {
    saveUserInfo(null);
    localStorage.removeItem("token");
    // 清除激活缓存(埋点相关)
    localStorage.removeItem("___first_in_editor___");
    // 更新登录状态
    updateLoginStatus();
    // 清空被拦截的操作队列（用户退出后，之前的操作不应该继续执行）
    clearInterceptedActions();
    router.replace({ path: "/" });
  };

  // 初始化用户信息
  const initUserInfo = async() => {
    loadUserInfo();
    // 初始化登录状态
    updateLoginStatus();
    // 初始化新手任务
    await updateNewbieMission();
  };

  // 处理token过期
  const handleTokenExpired = () => {
    // 清除token和用户信息
    localStorage.removeItem("token");
    localStorage.removeItem("userInfo");
    userInfo.value = null;
    isLoggedIn.value = false;

    setLoginType("account");
  };

  const updateUserInfo = (info: UserInfo) => {
    userInfo.value = info;
    localStorage.setItem("userInfo", JSON.stringify(userInfo));
  };

  // 前端生成hash头像
  // 生成头像数据（不渲染，只返回数据）
  const makeRandomAvatar = (token: string): AvatarData => {
    const codes = token.split("").map((char) => char.charCodeAt(0));

    // 计算颜色值
    let r = 0,
      g = 0,
      b = 0;
    for (let i = 0; i < codes.length; i++) {
      r = (r + codes[i] * 1) % 256;
      g = (g + codes[i] * 2) % 256;
      b = (b + codes[i] * 3) % 256;
    }

    // 计算 hash 值
    let hash = 0;
    if (token.length > 0) {
      for (let i = 0; i < token.length; i++) {
        hash = (hash << 5) - hash + token.charCodeAt(i);
        hash |= 0;
      }
    }

    return {
      color: { r, g, b },
      hash: hash,
    };
  };

  // 根据头像数据渲染头像
  const renderAvatarFromData = (
    avatarData: AvatarData,
    pixelSize: number = 50,
    size: number = 250,
  ): string => {
    const canvas = document.createElement("canvas");
    canvas.height = size;
    canvas.width = size;

    const ctx = canvas.getContext("2d", { willReadFrequently: false });
    if (!ctx) {
      throw new Error("无法获取canvas context");
    }

    // 禁用图像平滑，确保像素艺术效果清晰
    ctx.imageSmoothingEnabled = false;

    const { color, hash } = avatarData;
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2;

    // 创建圆形裁剪路径
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.clip();

    // 计算图案尺寸（70%）
    const patternSize = size * 0.7;
    const patternWidth = pixelSize * 5;
    const patternHeight = pixelSize * 5;
    const scale = patternSize / patternWidth;
    const scaledPixelSize = pixelSize * scale;

    // 计算居中偏移（使用整数坐标，避免亚像素渲染）
    const offsetX = Math.round((size - patternSize) / 2);
    const offsetY = Math.round((size - patternSize) / 2);

    // 设置图案颜色
    ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;

    // 绘制像素图案（使用整数坐标确保像素块紧密贴合）
    for (let i = 0; i < 15; ++i) {
      const col = Math.floor(i / 5);
      const row = i % 5;
      const bit = (hash >> i) & 1;
      if (bit) {
        // 左侧像素（使用 Math.round 确保整数坐标）
        const x1 = Math.round(offsetX + col * scaledPixelSize);
        const y1 = Math.round(offsetY + row * scaledPixelSize);
        const pixelSizeInt = Math.ceil(scaledPixelSize);
        ctx.fillRect(x1, y1, pixelSizeInt, pixelSizeInt);

        // 右侧对称像素（仅前10个）
        if (i < 10) {
          const x2 = Math.round(offsetX + (4 - col) * scaledPixelSize);
          ctx.fillRect(x2, y1, pixelSizeInt, pixelSizeInt);
        }
      }
    }

    const dataUrl = canvas.toDataURL("image/png");
    return dataUrl;
  };

  return {
    // 状态
    isLoggedIn,
    userInfo,
    loginType,
    isLoading,
    smsCountdown,
    loginForm,
    messages,
    hasNewbieTourShowed,
    missionGroup,
    newbieMissionProgressPercent,
    sendIdeaTourShow,

    // 计算属性
    isAccountLogin,
    isSmsLogin,
    isRegister,
    canSendSms,
    smsButtonText,
    avatarData,
    hasUnreadMessages,

    // 方法
    setLoginType,
    updateForm,
    sendSmsCode,
    loginWithPassword,
    loginWithSms,
    loginWithTicket,
    register,
    logout,
    initUserInfo,
    handleTokenExpired,
    requireLogin,
    clearInterceptedActions,
    executeInterceptedActions,
    updateUserInfo,
    saveUserInfo,
    makeRandomAvatar,
    renderAvatarFromData,
    completeNewbieMission,
    completeNewbieMissionByCode,
    updateNewbieMission,
    setNewbieTourShowed,
    // 持久化方法
    loadUserInfo,
    // 消息相关方法
    markMessageAsRead,
    updateMessages,
    loadMoreMessages,
    // 消息分页状态
    hasMoreMessages,
    isLoadingMessages,
  };
});
