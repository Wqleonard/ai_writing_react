<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from "vue";
import { useRouter } from "vue-router";
import QuickEditorTopToolbar from "@/vue/components/QuickEditorTopToolbar.vue";
import ScriptTagSelector from "./components/ScriptTagSelector.vue";
import ScriptNovelOutlineChapter from "./components/ScriptNovelOutlineChapter.vue";
import ScriptStorySelector from "./components/ScriptStorySelector.vue";
import ScriptCharacterSelector from "./components/ScriptCharacterSelector.vue";
import ScriptOutlineEditor from "./components/ScriptOutlineEditor.vue";
import ScriptChapterEditor from "./components/ScriptChapterEditor.vue";
import { useEditorStore } from "@/vue/stores/editor.ts";
import { storeToRefs } from "pinia";
import TITLE_LOGO from "@/assets/images/logo.webp";
import { updateWorkInfoReq, updateWorkVersionReq } from "@/api/works";
import { ElMessage, ElMessageBox } from "element-plus";
import type { DocOutlineStorageData, DocChapterStorageData, ScriptNovelOutlineChapterResult, ScriptOutlineStorageData, ScriptSplitOutlineDict, ScriptChapterStorageData } from "@/vue/utils/interfaces";
// 小说纲章图标（2个状态，作为第一个目录项不存在不可选状态）
import novelChapterDefaultIcon from "@/assets/images/quick_creation/novel_chapter_default.svg";
import novelChapterSelectedIcon from "@/assets/images/quick_creation/novel_chapter_selected.svg";
// 故事标签图标（3个状态）
import storyTagDefaultIcon from "@/assets/images/quick_creation/story-tag-default.svg";
import storyTagSelectedIcon from "@/assets/images/quick_creation/story-tag-selected.svg";
import storyTagDisabledIcon from "@/assets/images/quick_creation/story-tag-disabled.svg";
// 故事梗概图标（3个状态）
import storyOutlineDefaultIcon from "@/assets/images/quick_creation/story-outline-default.svg";
import storyOutlineSelectedIcon from "@/assets/images/quick_creation/story-outline-selected.svg";
import storyOutlineDisabledIcon from "@/assets/images/quick_creation/story-outline-disabled.svg";
// 角色设定图标（3个状态）
import characterSettingDefaultIcon from "@/assets/images/quick_creation/character-setting-default.svg";
import characterSettingSelectedIcon from "@/assets/images/quick_creation/character-setting-selected.svg";
import characterSettingDisabledIcon from "@/assets/images/quick_creation/character-setting-disabled.svg";
// 大纲图标（3个状态）
import outlineDefaultIcon from "@/assets/images/quick_creation/outline-default.svg";
import outlineSelectedIcon from "@/assets/images/quick_creation/outline-selected.svg";
import outlineDisabledIcon from "@/assets/images/quick_creation/outline-disabled.svg";
// 正文图标（3个状态）
import mainTextDefaultIcon from "@/assets/images/quick_creation/main-text-default.svg";
import mainTextSelectedIcon from "@/assets/images/quick_creation/main-text-selected.svg";
import mainTextDisabledIcon from "@/assets/images/quick_creation/main-text-disabled.svg";
// 箭头图标（3个状态）
import arrowDefaultIcon from "@/assets/images/quick_creation/arrow-default.svg";
import arrowSelectedIcon from "@/assets/images/quick_creation/arrow-selected.svg";
import arrowDisabledIcon from "@/assets/images/quick_creation/arrow-disabled.svg";
// import { trackingQuickCreationGenerate } from "@/utils/matomoTrackingEvent/clickEvent";

const router = useRouter();
const editorStore = useEditorStore();
const { workId, serverData, workInfo } = storeToRefs(editorStore);
// 进入剧本编辑页时同步清空 serverData，在首屏渲染前执行，避免展示上一作品数据；onMounted 中 initEditorData 会拉取并赋新值
serverData.value = {};
const { initEditorData } = editorStore;
// 默认目录结构
const DEFAULT_DIRECTORIES = {
  "小说纲章.md": "",
  "标签.md": "",
  "故事梗概.md": "",
  "主角设定.md": "",
  "大纲.md": "",
  "正文.md": "", // 添加默认正文目录
};
// 目录列表（按固定顺序排列）
const directories = computed(() => {
  const baseData =
    Object.keys(serverData.value).length > 0 ? serverData.value : DEFAULT_DIRECTORIES;
  const dirs = Object.keys(baseData);

  // 定义固定的目录顺序（使用实际数据中的键名）
  const fixedOrder = ["小说纲章.md", "标签.md", "故事梗概.md", "主角设定.md", "大纲.md"];

  // 分离固定目录和章节目录
  const fixedDirs = dirs.filter((dir) => fixedOrder.includes(dir));
  const chapterDirs = dirs.filter((dir) => isEpisodeOrChapterDir(dir));
  // 排除固定目录、集数/正文章节目录、正文.md 及内部键（大纲分段.md 仅存分段数据，不展示为目录）
  const otherDirs = dirs.filter(
    (dir) =>
      !fixedOrder.includes(dir) &&
      !isEpisodeOrChapterDir(dir) &&
      dir !== "正文.md" &&
      dir !== "大纲分段.md"
  );

  // 按固定顺序排序固定目录
  fixedDirs.sort((a, b) => fixedOrder.indexOf(a) - fixedOrder.indexOf(b));

  // 集数目录按集号排序（第N集.md）
  chapterDirs.sort((a, b) => getChapterIndexFromDir(a) - getChapterIndexFromDir(b));

  // 合并：固定目录 + 章节目录 + 其他目录
  return [...fixedDirs, ...chapterDirs, ...otherDirs];
});

// 是否为集数目录（剧本用「集」：第N集.md，用于 key 创建与存储）
const isEpisodeDir = (dir: string): boolean => /^第\d+集\.md$/.test(dir);

// 是否为集数/正文章节目录（含旧格式 正文-第N章.md），用于侧栏展示：这类目录一律归入「正文」下，不单独出现在主目录
const isEpisodeOrChapterDir = (dir: string): boolean =>
  isEpisodeDir(dir) || /^正文-第\d+章\.md$/.test(dir);

// 从目录名称中提取集数索引（0-based）。支持 第N集.md 与 正文-第N章.md
const getChapterIndexFromDir = (dir: string): number => {
  const epMatch = dir.match(/^第(\d+)集\.md$/);
  if (epMatch) return Math.max(0, parseInt(epMatch[1], 10) - 1);
  const chMatch = dir.match(/^正文-第(\d+)章\.md$/);
  if (chMatch) return Math.max(0, parseInt(chMatch[1], 10) - 1);
  return 0;
};

// 根据集数索引（0-based）返回集目录名，统一为 第N集.md
const getChapterDirByIndex = (index: number): string => {
  return `第${index + 1}集.md`;
};

// 正文之前的步骤（回退到这些步骤时若正文文件夹打开则关闭）
const STEPS_BEFORE_MAIN_TEXT = ["小说纲章.md", "标签.md", "故事梗概.md", "主角设定.md", "大纲.md"];

// 当前选中的目录
const currentDirectory = ref<string>("小说纲章.md");

// 目录锁定状态（已完成的步骤会被锁定）
const lockedDirectories = ref<Set<string>>(new Set());

// 左侧目录是否展开
const isSidebarExpanded = ref(true);

// 当前悬浮的目录
const hoveredDirectory = ref<string | null>(null);

// 章节子目录容器引用
const chapterChildrenContainerRef = ref<HTMLElement | null>(null);
const chapterListRef = ref<HTMLElement | null>(null);
const mainTextFolderScrollRef = ref<HTMLElement | null>(null);
const chapterItemRefs = ref<Map<string, HTMLElement>>(new Map());

// 章节编辑器引用映射（用于调用插入笔记内容方法）
const chapterEditorRefs = ref<Map<string, any>>(new Map());

// 大纲分段（起承转合），用于侧栏分组与大纲模块展示
export interface OutlineSegmentItem {
  start: number;
  end: number;
  label: string;
  /** 后端原样，如 "1-12(起)"，用于展示和生成大纲接口 episodeNumAndPart */
  raw: string;
}
const outlineSegmentList = ref<OutlineSegmentItem[]>([]);

// 将后端 splitOutline 字符串解析为 OutlineSegmentItem（父组件用）
function parseOutlineSegmentsFromRaw(rawArr: string[]): OutlineSegmentItem[] {
  const result: OutlineSegmentItem[] = [];
  for (const s of rawArr) {
    const m = String(s).match(/^(\d+)-(\d+)\((.+)\)$/);
    if (m) {
      result.push({
        start: parseInt(m[1], 10),
        end: parseInt(m[2], 10),
        label: m[3].trim(),
        raw: s,
      });
    }
  }
  return result;
}

// 设置章节项引用
const setChapterItemRef = (el: any, dir: string) => {
  if (el) {
    chapterItemRefs.value.set(dir, el);
  } else {
    chapterItemRefs.value.delete(dir);
  }
};

// 右侧内容区域引用
const rightContentRef = ref<HTMLElement | null>(null);
const contentScrollAreaRef = ref<HTMLElement | null>(null);

// 各个目录内容块的高度映射（用于固定高度的目录）
const sectionHeights = ref<Record<string, number>>({});

// 标签选择器触发生成的标志（当小说纲章更新时触发重新获取默认选中标签）
const tagGenerateTrigger = ref(0);

// 故事梗概触发生成的标志
const storyGenerateTrigger = ref(0);
// 角色设定触发生成的标志
const characterGenerateTrigger = ref(0);
// 大纲触发生成的标志
const outlineGenerateTrigger = ref(0);

// 需要固定高度的目录列表
// 移除固定高度，所有内容区都使用内部滚动
const fixedHeightDirectories: string[] = [];

// 获取内容块元素
const getSectionElement = (dir: string): HTMLElement | null => {
  const sectionId = `section-${getDirectoryName(dir)}`;
  return document.getElementById(sectionId);
};

// 更新特定目录的高度
const updateSectionHeight = (dir: string) => {
  const sectionEl = getSectionElement(dir);
  if (sectionEl && fixedHeightDirectories.includes(dir)) {
    // 先移除固定高度，获取自然高度
    const currentHeight = sectionEl.style.height;
    sectionEl.style.height = "auto";

    nextTick(() => {
      nextTick(() => {
        const height = sectionEl.offsetHeight || sectionEl.scrollHeight || 0;
        if (height > 0) {
          sectionHeights.value[dir] = height;
          sectionEl.style.height = `${height}px`;
        } else if (sectionHeights.value[dir]) {
          // 如果获取失败但已有保存的高度，使用保存的高度
          sectionEl.style.height = `${sectionHeights.value[dir]}px`;
        }
      });
    });
  }
};

// 滚动锁：防止滚动冲突
const scrollLock = ref(false);
const scrollLockTimer = ref<ReturnType<typeof setTimeout> | null>(null);

// 滚动到指定目录的内容块（优化版：使用scrollIntoView）
const scrollToSection = (dir: string) => {
  const sectionEl = getSectionElement(dir);
  if (sectionEl && contentScrollAreaRef.value) {
    console.log(`[🎯 CLICK] scrollToSection called for: ${dir}`);

    // 清除之前的锁定定时器，允许快速切换
    if (scrollLockTimer.value) {
      clearTimeout(scrollLockTimer.value);
      scrollLockTimer.value = null;
      console.log("[DEBUG] Cleared previous scroll lock timer");
    }

    // 清除滚动停止定时器，防止在动画期间触发
    if (scrollStopTimer.value) {
      clearTimeout(scrollStopTimer.value);
      scrollStopTimer.value = null;
      console.log("[DEBUG] Cleared scroll stop timer");
    }

    scrollLock.value = true;
    isScrolling.value = true;
    console.log(`[🔒 LOCK] Set scrollLock=true, isScrolling=true for ${dir}`);

    // 使用scrollIntoView替代手动计算，浏览器原生处理与scroll-snap的配合
    sectionEl.scrollIntoView({
      behavior: "smooth",
      block: "start",
      inline: "nearest",
    });

    // 使用固定的2000ms锁定时间，覆盖任何长距离滚动
    // 关键优化：不需要在锁定结束后更新目录，因为目录已经在点击时设置好了
    // 只需要阻止Observer在滚动期间干扰即可
    scrollLockTimer.value = setTimeout(() => {
      scrollLock.value = false;
      scrollLockTimer.value = null;
      isScrolling.value = false;
      console.log(`[🔓 UNLOCK] Scroll lock released after 2000ms, directory: ${currentDirectory.value}`);
    }, 2000);
  }
};

// 监听窗口大小变化
const handleWindowResize = () => {
  fixedHeightDirectories.forEach((dir) => {
    updateSectionHeight(dir);
  });
};

// 判断一个目录是否可见（已锁定或是下一个未锁定的目录）
const isSectionVisible = (dir: string): boolean => {
  // 已锁定的目录可见
  if (lockedDirectories.value.has(dir)) {
    // console.log(`[VISIBILITY] ${dir} is visible: LOCKED`);
    return true;
  }

  // 对于章节目录，特殊处理：只要章节有值就可见，不需要检查前置条件
  if (isEpisodeOrChapterDir(dir)) {
    const visible = hasChapterValue(dir);
    // console.log(`[VISIBILITY] ${dir} is visible: ${visible} (chapter has value)`);
    return visible;
  }

  // 对于固定目录（标签、故事梗概、角色设定、大纲），检查是否有内容或是下一个目录
  const dirIndex = directories.value.indexOf(dir);

  // 第一个目录总是可见
  if (dirIndex === 0) {
    // console.log(`[VISIBILITY] ${dir} is visible: FIRST`);
    return true;
  }

  // 如果当前目录有内容（但未锁定），也应该显示，允许用户滚动查看
  const hasContent = serverData.value[dir] && serverData.value[dir].trim() !== '';
  if (hasContent) {
    // console.log(`[VISIBILITY] ${dir} is visible: HAS CONTENT (length: ${serverData.value[dir]?.length})`);
    return true;
  }

  // 检查是否是下一个未锁定的目录（前一个目录已锁定）
  if (dirIndex > 0) {
    const prevDir = directories.value[dirIndex - 1];
    const isNext = lockedDirectories.value.has(prevDir);
    if (isNext) {
      console.log(`[VISIBILITY] ${dir} is visible: NEXT (prevDir ${prevDir} is locked)`);
      return true;
    }
  }

  console.log(`[VISIBILITY] ${dir} is NOT visible`);
  return false;
};

// 标记是否已完成初始化
const isInitialized = ref(false);
// 标记是否应该触发滚动（用于区分用户点击和Observer自动更新）
const shouldTriggerScroll = ref(false);

// 监听当前目录变化，滚动到对应内容块（优化版：移除延迟，直接滚动）
watch(
  currentDirectory,
  (newDir, oldDir) => {
    // 如果还未完成初始化，不执行滚动（等待 onMounted 完成后再滚动）
    if (!isInitialized.value) {
      return;
    }

    // 如果目录没有变化，不执行滚动
    if (newDir === oldDir) {
      return;
    }

    // 检查是否可以访问该目录
    if (!isSectionVisible(newDir)) {
      return; // 不可见的目录禁止访问
    }

    console.log("[QuickEditor] Switch to directory:", newDir, "shouldTriggerScroll:", shouldTriggerScroll.value);

    // 只有在shouldTriggerScroll为true时才触发滚动（用户点击）
    // Observer自动更新时不应该触发滚动
    if (shouldTriggerScroll.value) {
      // 使用nextTick确保DOM已更新，然后立即滚动
      nextTick(() => {
        scrollToSection(newDir);

        // 对于章节目录，重新计算高度（因为正文内容可能变化）
        if (isEpisodeOrChapterDir(newDir)) {
          nextTick(() => {
            // 触发内容区域高度重新计算
            const sectionEl = getSectionElement(newDir);
            if (sectionEl) {
              // 移除固定高度，让内容自然撑开
              sectionEl.style.height = "auto";
            }
          });
        }
      });

      // 重置标志
      shouldTriggerScroll.value = false;
    }
  },
  { immediate: false }
);

// Intersection Observer 观察器（优化版：替代scroll事件）
const scrollObserver = ref<IntersectionObserver | null>(null);
const observerDebounceTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const scrollStopTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const isScrolling = ref(false);

// 更新当前目录的函数
const updateCurrentDirectory = () => {
  console.log("[DEBUG] updateCurrentDirectory called, scrollLock:", scrollLock.value, "isScrolling:", isScrolling.value);

  if (scrollLock.value) {
    console.log("[DEBUG] updateCurrentDirectory blocked by scrollLock");
    return;
  }

  const sections = contentScrollAreaRef.value?.querySelectorAll('.content-section');
  if (!sections) {
    console.log("[DEBUG] No sections found");
    return;
  }

  let maxRatio = 0;
  let targetDir: string | null = null;
  const visibilityData: Array<{ dir: string, ratio: number }> = [];

  sections.forEach((section) => {
    const rect = section.getBoundingClientRect();
    const containerRect = contentScrollAreaRef.value!.getBoundingClientRect();

    // 计算可见比例
    const visibleTop = Math.max(rect.top, containerRect.top);
    const visibleBottom = Math.min(rect.bottom, containerRect.bottom);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);
    const ratio = visibleHeight / rect.height;

    const dir = section.getAttribute("data-directory");
    if (dir && ratio > 0) {
      visibilityData.push({ dir, ratio: parseFloat(ratio.toFixed(2)) });
    }

    if (ratio > maxRatio) {
      if (dir && isSectionVisible(dir)) {
        // 对于章节目录，检查是否有值
        if (isEpisodeOrChapterDir(dir)) {
          if (!hasChapterValue(dir)) {
            return;
          }
        }
        maxRatio = ratio;
        targetDir = dir;
      }
    }
  });

  console.log("[DEBUG] Visibility data:", visibilityData);
  console.log("[DEBUG] Max visible:", targetDir, "ratio:", maxRatio.toFixed(2), "current:", currentDirectory.value);

  if (targetDir && maxRatio >= 0.2 && targetDir !== currentDirectory.value) {
    console.log(
      "[📊 OBSERVER UPDATE] Directory switch from",
      currentDirectory.value,
      "to",
      targetDir,
      "ratio:",
      maxRatio.toFixed(2),
      "shouldTriggerScroll: false (Observer auto-update, no scroll)"
    );
    // Observer自动更新目录，不触发滚动（shouldTriggerScroll保持false）
    currentDirectory.value = targetDir;
  } else if (targetDir && maxRatio >= 0.2) {
    console.log("[DEBUG] Directory already at target:", targetDir);
  } else if (!targetDir) {
    console.log("[DEBUG] No valid target directory found");
  } else if (maxRatio < 0.2) {
    console.log("[DEBUG] Max ratio too low:", maxRatio.toFixed(2), "threshold: 0.2");
  }
};

// 监听滚动停止
const handleScrollStop = () => {
  // console.log("[DEBUG] handleScrollStop triggered, scrollLock:", scrollLock.value);

  // 如果正在滚动锁定（用户点击目录），不处理滚动停止检测
  if (scrollLock.value) {
    // console.log("[DEBUG] handleScrollStop blocked by scrollLock");
    return;
  }

  if (scrollStopTimer.value) {
    clearTimeout(scrollStopTimer.value);
  }

  isScrolling.value = true;

  scrollStopTimer.value = setTimeout(() => {
    console.log("[DEBUG] Scroll stopped (200ms), triggering update");
    isScrolling.value = false;
    // 滚动停止后，如果没有锁定，才触发更新
    if (!scrollLock.value) {
      if (observerDebounceTimer.value) {
        clearTimeout(observerDebounceTimer.value);
        observerDebounceTimer.value = null;
      }
      updateCurrentDirectory();
    } else {
      console.log("[DEBUG] Scroll stopped but scrollLock is active");
    }
  }, 200);
};

// 设置Intersection Observer来观察section的可见性
const setupScrollObserver = () => {
  // 清理旧的observer
  if (scrollObserver.value) {
    scrollObserver.value.disconnect();
  }

  if (!contentScrollAreaRef.value) {
    return;
  }

  // 添加滚动监听
  contentScrollAreaRef.value.addEventListener('scroll', handleScrollStop, { passive: true });

  // 创建Intersection Observer（主要用于辅助检测）
  scrollObserver.value = new IntersectionObserver(
    (entries) => {
      // console.log("[DEBUG] Observer triggered, entries count:", entries.length, "scrollLock:", scrollLock.value, "isScrolling:", isScrolling.value);

      // 如果正在滚动锁定状态，不处理
      if (scrollLock.value) {
        // console.log("[DEBUG] Observer blocked by scrollLock");
        return;
      }

      // 如果正在滚动，使用防抖；如果已停止，立即更新
      if (isScrolling.value) {
        // 清除之前的防抖定时器
        if (observerDebounceTimer.value) {
          clearTimeout(observerDebounceTimer.value);
        }

        // console.log("[DEBUG] Observer: scrolling, debounce 50ms");
        // 滚动过程中使用较短的防抖（50ms），减少卡顿但保持响应
        observerDebounceTimer.value = setTimeout(() => {
          // console.log("[DEBUG] Observer debounce timeout, updating");
          updateCurrentDirectory();
          observerDebounceTimer.value = null;
        }, 50);
      } else {
        // console.log("[DEBUG] Observer: scroll stopped, immediate update");
        // 滚动已停止，立即更新
        updateCurrentDirectory();
      }
    },
    {
      root: contentScrollAreaRef.value,
      // 使用较少的阈值点，提升性能
      threshold: [0, 0.5, 1],
      // 适中的margin
      rootMargin: "-10% 0px -10% 0px",
    }
  );

  // 观察所有section（不再使用isSectionVisible过滤）
  // 让Observer观察所有section，在updateCurrentDirectory时再过滤
  directories.value.forEach((dir) => {
    const sectionEl = getSectionElement(dir);
    if (sectionEl) {
      // 设置data-directory属性用于识别
      sectionEl.setAttribute("data-directory", dir);
      scrollObserver.value?.observe(sectionEl);
      // console.log(`[QuickEditor] Observing section: ${dir}`);
    }
  });

  // console.log("[QuickEditor] Scroll Observer setup completed, observing", directories.value.length, "directories");
};

// 监听目录列表变化，重新设置Observer（当章节增加或减少时）
watch(
  () => directories.value.length,
  () => {
    // 延迟一下确保DOM已更新
    nextTick(() => {
      setupScrollObserver();
    });
  }
);

// 清理重复的集数目录（第N集.md）
const cleanupDuplicateChapters = () => {
  const chapterKeys = Object.keys(serverData.value).filter(
    (key) => isEpisodeDir(key)
  );
  const seen = new Set<string>();
  chapterKeys.forEach((key) => {
    const numMatch = key.match(/^第(\d+)集\.md$/);
    const id = numMatch ? numMatch[1] : key;
    if (seen.has(id)) {
      console.log(`[QuickEditor] 删除重复的章节目录: ${key}`);
      delete serverData.value[key];
    } else {
      seen.add(id);
    }
  });
};

// 检查章节目录是否有值（不为空字符串）
// 对于 {episodeNote:'',content:''} 这样的空 JSON 对象，也视为有值（因为这是初始化后的状态）
const hasChapterValue = (chapterName: string): boolean => {
  const content = serverData.value[chapterName];
  if (!content || content.trim() === "") {
    return false;
  }

  // 尝试解析为 JSON
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object") {
      // 如果是有效的 JSON 对象（即使是空的 {episodeNote:'',content:''}），也视为有值
      // 这样可以定位到已初始化但还未生成内容的章节
      return true;
    }
  } catch (e) {
    // 不是 JSON 格式，但有内容，视为有值
    return true;
  }

  return false;
};

// 从serverData中提取标签ID（兼容旧格式和新格式）
const getTagIdsFromServerData = (tagData: string): string => {
  if (!tagData) return "";

  // 尝试解析为JSON格式
  try {
    const parsed = JSON.parse(tagData);
    if (parsed && typeof parsed === "object" && parsed.tagIds) {
      return parsed.tagIds;
    }
  } catch (e) {
    // 不是JSON格式，可能是旧格式
  }

  // 旧格式：只有tagIds
  return tagData;
};

// 从serverData中提取一句话梗概
const getSynopsisFromServerData = (tagData: string): string => {
  if (!tagData) return "";

  // 尝试解析为JSON格式
  try {
    const parsed = JSON.parse(tagData);
    if (parsed && typeof parsed === "object" && parsed.synopsis) {
      return parsed.synopsis;
    }
  } catch (e) {
    // 不是JSON格式，可能是旧格式
  }
  // 旧格式：没有synopsis
  return "";
};

// 从 serverData 中提取集数（故事有多少集数，用于大纲/正文参数）
const getEpisodeNumFromServerData = (tagData: string): number => {
  if (!tagData) return 60;
  try {
    const parsed = JSON.parse(tagData);
    if (parsed && typeof parsed === "object" && typeof parsed.episodeNum === "number") {
      return parsed.episodeNum;
    }
  } catch (e) {
    // 忽略
  }
  return 60;
};

// 从 serverData 中提取 description（默认选中标签名称拼接，如「科幻，犯罪，男频」）
const getDescriptionFromServerData = (tagData: string): string => {
  if (!tagData) return "";
  try {
    const parsed = JSON.parse(tagData);
    if (parsed && typeof parsed === "object" && typeof parsed.description === "string") {
      return parsed.description;
    }
  } catch (e) {
    // 忽略
  }
  return "";
};

// 使用 computed 确保响应式更新
const tagSelectorTagIds = computed(() => {
  const tagData = serverData.value["标签.md"];
  const result = getTagIdsFromServerData(tagData);
  console.log("[QuickEditor] tagSelectorTagIds computed:", {
    tagData,
    tagDataType: typeof tagData,
    tagDataLength: tagData?.length,
    result,
    serverDataKeys: Object.keys(serverData.value),
    hasTagKey: "标签.md" in serverData.value
  });
  return result;
});


// 2026-2-12 从 标签.md 中取 description（默认选中标签名称拼接，如「科幻，犯罪，男频」）
const tagSelectorDescription = computed(() => {
  const tagData = serverData.value["标签.md"];
  return getDescriptionFromServerData(tagData);
});

const tagSelectorSynopsis = computed(() => {
  const tagData = serverData.value["标签.md"];
  const result = getSynopsisFromServerData(tagData);
  console.log("[QuickEditor] tagSelectorSynopsis computed:", {
    tagData,
    tagDataType: typeof tagData,
    tagDataLength: tagData?.length,
    result
  });
  return result;
});

const tagSelectorEpisodeNum = computed(() => {
  const tagData = serverData.value["标签.md"];
  return getEpisodeNumFromServerData(tagData);
});

const tagSelectorNovelPlot = computed(() => {
  const novelOutlineData = serverData.value["小说纲章.md"];
  const result = getNovelPlotFromServerData(novelOutlineData);
  console.log("[QuickEditor] tagSelectorNovelPlot computed:", {
    novelOutlineData,
    novelOutlineDataType: typeof novelOutlineData,
    novelOutlineDataLength: novelOutlineData?.length,
    resultLength: result?.length
  });
  return result;
});

// 是否跳过了小说纲章拆解
const novelPlotSkipped = computed(() => {
  const novelOutlineData = serverData.value["小说纲章.md"];
  if (!novelOutlineData) return false;
  try {
    const parsed = JSON.parse(novelOutlineData);
    return parsed?.skipped === true;
  } catch {
    return false;
  }
});

// 从serverData中提取小说纲章内容（作为novelPlot）
const getNovelPlotFromServerData = (novelOutlineData: string): string => {
  if (!novelOutlineData) return "";
  try {
    const parsed = JSON.parse(novelOutlineData);
    if (parsed && typeof parsed === "object") {
      // 返回content字段作为novelPlot
      return parsed.content || "";
    }
  } catch (e) {
    // 如果不是JSON格式，直接返回原字符串
    return novelOutlineData;
  }
  return "";
};

// 初始化serverData
const initServerData = async () => {
  if (!serverData.value || Object.keys(serverData.value).length === 0) {
    serverData.value = { ...DEFAULT_DIRECTORIES };
  } else {
    // 首先清理可能存在的重复章节目录
    cleanupDuplicateChapters();

    // 处理"故事标签.md"和"标签.md"的重复问题：统一使用"标签.md"
    if ("故事标签.md" in serverData.value && "标签.md" in serverData.value) {
      // 如果两个都存在，保留"标签.md"的内容，删除"故事标签.md"
      delete serverData.value["故事标签.md"];
    } else if ("故事标签.md" in serverData.value && !("标签.md" in serverData.value)) {
      // 如果只有"故事标签.md"，重命名为"标签.md"
      serverData.value["标签.md"] = serverData.value["故事标签.md"];
      delete serverData.value["故事标签.md"];
    }

    // 确保所有默认目录都存在（除了正文，因为标签确认后会变成章节目录）
    const defaultKeys = Object.keys(DEFAULT_DIRECTORIES).filter((key) => key !== "正文.md");
    defaultKeys.forEach((key) => {
      if (!(key in serverData.value)) {
        serverData.value[key] = "";
      }
    });

    // 恢复大纲分段（起承转合），用于侧栏分组与大纲模块
    try {
      const raw = serverData.value["大纲分段.md"];
      if (raw && typeof raw === "string") {
        const parsed = JSON.parse(raw) as OutlineSegmentItem[];
        if (Array.isArray(parsed) && parsed.length > 0) outlineSegmentList.value = parsed;
      }
    } catch (_) {
      // 忽略
    }

    // 如果标签已锁定，处理章节目录
    if (serverData.value["标签.md"] && workInfo.value?.chapterNum) {
      // 获取现有的章节目录
      const existingChapters: string[] = [];
      Object.keys(serverData.value).forEach((key) => {
        if (isEpisodeOrChapterDir(key)) {
          existingChapters.push(key);
        }
      });

      // 检查是否有任何章节目录有值（不为空字符串）
      const hasChapterData = existingChapters.some((chapter) => hasChapterValue(chapter));

      if (hasChapterData) {
        // 如果已有章节目录且有数据，完全保留，不做任何修改
        console.log(
          `[QuickEditor] initServerData 已有 ${existingChapters.length} 个章节目录且有数据，保留现有数据`
        );
      } else if (existingChapters.length > 0) {
        // 如果已有章节目录但都是空的，也保留（可能是用户刚创建但还没生成内容）
        console.log(
          `[QuickEditor] initServerData 已有 ${existingChapters.length} 个章节目录（空），保留现有数据`
        );
      } else {
        // 如果没有章节目录，根据章节数生成新的
        const chapterNum = workInfo.value.chapterNum;
        console.log(
          `[QuickEditor] initServerData 没有章节目录，根据章节数 ${chapterNum} 生成新目录`
        );
        for (let i = 1; i <= chapterNum; i++) {
          serverData.value[`第${i}集.md`] = "";
        }
      }

      // 删除"正文.md"（如果存在）
      if ("正文.md" in serverData.value) {
        delete serverData.value["正文.md"];
      }
    } else {
      // 如果标签未锁定，确保有"正文.md"
      if (!("正文.md" in serverData.value)) {
        serverData.value["正文.md"] = "";
      }
    }

    // 计算总集数，与 workInfo.chapterNum 不一致时覆盖并触发保存
    let totalChapters = 0;
    if (outlineSegmentList.value.length > 0) {
      totalChapters = Math.max(...outlineSegmentList.value.map((s) => s.end));
    } else {
      Object.keys(serverData.value).forEach((key) => {
        const m = key.match(/^第(\d+)集\.md$/);
        if (m) totalChapters = Math.max(totalChapters, parseInt(m[1], 10));
      });
    }
    if (totalChapters > 0 && (workInfo.value?.chapterNum ?? 0) !== totalChapters) {
      try {
        await updateWorkInfoReq(workId.value, { chapterNum: totalChapters });
        await editorStore.updateWorkInfo();
        console.log("[QuickEditor] initServerData 同步 chapterNum:", workInfo.value?.chapterNum, "->", totalChapters);
      } catch (e) {
        console.error("[QuickEditor] initServerData 同步 chapterNum 失败:", e);
      }
    }
  }
};

// 处理小说纲章确认
const handleNovelOutlineConfirm = async (data: ScriptNovelOutlineChapterResult) => {
  console.log("[QuickEditor] handleNovelOutlineConfirm, data:", data);
  // 更新serverData
  serverData.value["小说纲章.md"] = JSON.stringify(data);

  // 保存到服务器
  try {
    const stringifyServerData = JSON.stringify(serverData.value);
    await updateWorkVersionReq(workId.value, stringifyServerData, "1");
    ElMessage.success(data.skipped ? "已跳过" : "小说纲章保存成功");

    // 锁定小说纲章目录
    lockedDirectories.value.add("小说纲章.md");

    // 自动切换到下一个未锁定的目录（标签）
    const nextDir = directories.value.find((dir) => !lockedDirectories.value.has(dir));
    if (nextDir) {
      currentDirectory.value = nextDir;
      shouldTriggerScroll.value = true; // 确认后跳转，需要滚动
      console.log("[QuickEditor] Switch to next directory:", nextDir);

      // 自动滚动到下一个目录
      setTimeout(() => {
        scrollToSection(nextDir);
      }, 100);
    }

    // 更新固定高度
    setTimeout(() => {
      updateSectionHeight("小说纲章.md");
    }, 100);

    // 触发标签选择器重新获取默认选中标签（因为novelPlot已更新）
    tagGenerateTrigger.value += 1;
  } catch (e) {
    console.error("[QuickEditor] 保存小说纲章失败:", e);
    ElMessage.error("保存失败");
  }
};

// 处理小说纲章回退
const handleNovelOutlineRevert = () => {
  console.log("[QuickEditor] handleNovelOutlineRevert");
  // 解锁小说纲章目录
  lockedDirectories.value.delete("小说纲章.md");
  // 清空后续目录的内容
  const novelOutlineIndex = directories.value.indexOf("小说纲章.md");
  directories.value.slice(novelOutlineIndex + 1).forEach((dir) => {
    serverData.value[dir] = "";
    lockedDirectories.value.delete(dir);
  });
};


// 处理标签确认 添加集数、description（默认选中标签名称拼接）
const handleTagConfirm = async (data: { tagIds: string; synopsis: string; episodeNum: number; description: string }) => {
  console.log("[QuickEditor] handleTagConfirm, data:", data);

  // 更新 serverData - 存储标签ID、一句话梗概、集数、description
  // 格式：JSON 对象 { tagIds, synopsis, episodeNum, description }
  serverData.value["标签.md"] = JSON.stringify({
    tagIds: data.tagIds,
    synopsis: data.synopsis,
    episodeNum: data.episodeNum,
    description: data.description ?? "",
  });

  // 保存到服务器
  try {
    const stringifyServerData = JSON.stringify(serverData.value);
    // 触发自动保存
    await updateWorkVersionReq(workId.value, stringifyServerData, "1");
    ElMessage.success("标签保存成功");

    // 锁定标签目录
    lockedDirectories.value.add("标签.md");

    // 用户主动确认：自动切换到下一个未锁定的目录（故事梗概）
    const nextDir = directories.value.find((dir) => !lockedDirectories.value.has(dir));
    if (nextDir) {
      shouldTriggerScroll.value = true; // 确认后跳转，需要滚动
      currentDirectory.value = nextDir;
      console.log("[QuickEditor] User confirmed, switch to next directory:", nextDir);

      // 如果是切换到故事梗概，不管是否有值都触发生成（因为用户可能修改了标签）
      if (nextDir === "故事梗概.md") {
        console.log("[QuickEditor] Tag confirmed, trigger story generate");
        storyGenerateTrigger.value += 1;
      }

      // 自动滚动到故事梗概
      setTimeout(() => {
        scrollToSection(nextDir);
      }, 100);
    }

    // 更新固定高度
    setTimeout(() => {
      updateSectionHeight("标签.md");
    }, 100);
  } catch (e) {
    console.error("[QuickEditor] 保存标签失败:", e);
    ElMessage.error("保存失败");
  }
};

// 处理标签回退
const handleTagRevert = () => {
  console.log("[QuickEditor] handleTagRevert");
  // 解锁标签目录
  lockedDirectories.value.delete("标签.md");
  // 清空后续目录的内容
  const tagIndex = directories.value.indexOf("标签.md");
  directories.value.slice(tagIndex + 1).forEach((dir) => {
    serverData.value[dir] = "";
    lockedDirectories.value.delete(dir);
  });
  shouldTriggerScroll.value = true; // 回退后跳转，需要滚动
};

// 处理故事梗概确认
const handleStoryConfirm = async (storyData: string, title: string) => {
  console.log("[QuickEditor] handleStoryConfirm, storyData:", storyData);
  // 更新serverData
  serverData.value["故事梗概.md"] = storyData;

  // 保存到服务器
  try {
    const stringifyServerData = JSON.stringify(serverData.value);
    //2025-1-10新增 更新作品名
    handleTitleUpdate(title);
    await updateWorkVersionReq(workId.value, stringifyServerData, "1");
    ElMessage.success("故事梗概保存成功");

    // 锁定故事梗概目录
    lockedDirectories.value.add("故事梗概.md");

    // 用户主动确认：自动切换到下一个未锁定的目录（角色设定）
    const nextDir = directories.value.find((dir) => !lockedDirectories.value.has(dir));
    if (nextDir) {
      shouldTriggerScroll.value = true; // 确认后跳转，需要滚动
      currentDirectory.value = nextDir;
      console.log("[QuickEditor] User confirmed, switch to next directory:", nextDir);

      // 如果是切换到角色设定，不管是否有值都触发生成（因为用户可能修改了故事梗概）
      if (nextDir === "主角设定.md") {
        console.log("[QuickEditor] Story confirmed, trigger character generate");
        characterGenerateTrigger.value += 1;
      }

      // 埋点统计（滚动由watch自动处理）
      // trackingQuickCreationGenerate("Character");
    }

    // 更新固定高度
    setTimeout(() => {
      updateSectionHeight("故事梗概.md");
    }, 100);
  } catch (e) {
    console.error("[QuickEditor] 保存故事梗概失败:", e);
    ElMessage.error("保存失败");
  }
};

// 处理故事梗概回退
const handleStoryRevert = async () => {
  console.log("[QuickEditor] handleStoryRevert");
  // 解锁标签目录，允许重新编辑标签（标签内容不清除）
  lockedDirectories.value.delete("标签.md");

  // 清空故事梗概及后续目录的内容（不包括标签）
  const storyIndex = directories.value.indexOf("故事梗概.md");
  directories.value.slice(storyIndex).forEach((dir) => {
    serverData.value[dir] = "";
    lockedDirectories.value.delete(dir);
  });

  // 删除所有集数/正文章节目录，恢复"正文.md"
  Object.keys(serverData.value).forEach((key) => {
    if (isEpisodeOrChapterDir(key)) {
      delete serverData.value[key];
      lockedDirectories.value.delete(key);
    }
  });
  serverData.value["正文.md"] = "";

  // 保存到服务器
  try {
    const stringifyServerData = JSON.stringify(serverData.value);
    await updateWorkVersionReq(workId.value, stringifyServerData, "1");
    ElMessage.success("已回退至标签选择");
  } catch (e) {
    console.error("[QuickEditor] 回退保存失败:", e);
  }

  // 切换到标签目录（滚动由watch自动处理）
  shouldTriggerScroll.value = true; // 回退操作，需要滚动
  currentDirectory.value = "标签.md";
};

// 处理角色确认
const handleCharacterConfirm = async (characterData: string) => {
  console.log("[QuickEditor] handleCharacterConfirm, characterData:", characterData);
  // 更新serverData
  serverData.value["主角设定.md"] = characterData;

  // 保存到服务器
  try {
    const stringifyServerData = JSON.stringify(serverData.value);
    await updateWorkVersionReq(workId.value, stringifyServerData, "1");
    ElMessage.success("角色设定保存成功");

    // 锁定角色目录
    lockedDirectories.value.add("主角设定.md");

    // 用户主动确认：自动切换到下一个未锁定的目录（大纲）
    const nextDir = directories.value.find((dir) => !lockedDirectories.value.has(dir));
    if (nextDir) {
      shouldTriggerScroll.value = true;
      currentDirectory.value = nextDir;
      console.log("[QuickEditor] User confirmed, switch to next directory:", nextDir);

      // 切到大纲时，仅触发大纲模块获取分段（由 ScriptOutlineEditor 调用 getScriptSplitOutline）
      if (nextDir === "大纲.md") {
        outlineGenerateTrigger.value += 1;
      }

      // trackingQuickCreationGenerate("Outline");
    }

    setTimeout(() => {
      updateSectionHeight("主角设定.md");
    }, 100);
  } catch (e) {
    console.error("[QuickEditor] 保存角色设定失败:", e);
    ElMessage.error("保存失败");
  }
};

// 处理角色回退
const handleCharacterRevert = async () => {
  console.log("[QuickEditor] handleCharacterRevert");
  // 解锁故事梗概目录，允许重新编辑故事梗概（故事梗概内容不清除）
  lockedDirectories.value.delete("故事梗概.md");

  // 清空角色及后续目录的内容（不包括故事梗概），以及大纲分段
  const characterIndex = directories.value.indexOf("主角设定.md");
  directories.value.slice(characterIndex).forEach((dir) => {
    serverData.value[dir] = "";
    lockedDirectories.value.delete(dir);
  });
  if (serverData.value["大纲分段.md"]) delete serverData.value["大纲分段.md"];
  outlineSegmentList.value = [];

  // 保存到服务器
  try {
    const stringifyServerData = JSON.stringify(serverData.value);
    await updateWorkVersionReq(workId.value, stringifyServerData, "1");
    ElMessage.success("已回退至故事梗概选择");
  } catch (e) {
    console.error("[QuickEditor] 回退保存失败:", e);
  }

  // 切换到故事梗概目录（滚动由watch自动处理）
  shouldTriggerScroll.value = true; // 回退操作，需要滚动
  currentDirectory.value = "故事梗概.md";
};

// 处理大纲确认
const handleOutlineConfirm = async (outlineData: string) => {
  console.log("[QuickEditor] handleOutlineConfirm, outlineData length:", outlineData.length);
  // 追踪：保存前解析一次，确认 mdContent 段数（排查最后一段丢失）
  try {
    const parsed = JSON.parse(outlineData) as { mdContent?: string[] };
    const arr = parsed.mdContent;
    const n = Array.isArray(arr) ? arr.length : 0;
    const lastLen = n > 0 ? (arr![n - 1] ?? "").length : 0;
    console.log("[QuickEditor] handleOutlineConfirm 保存的 mdContent", {
      segmentCount: n,
      lastSegmentLength: lastLen,
      lastSegmentPreview: n > 0 ? (arr![n - 1] ?? "").slice(0, 80) : "",
    });
  } catch (_) {}
  // 更新serverData
  serverData.value["大纲.md"] = outlineData;

  // 给第一章赋值 {episodeNote:'',content:''}，便于滚动到第一章
  const firstChapter = directories.value.find(
    (dir) => isEpisodeOrChapterDir(dir)
  );
  if (firstChapter) {
    const emptyChapterData = JSON.stringify({ episodeNote: "", content: "" });
    serverData.value[firstChapter] = emptyChapterData;
    console.log("[QuickEditor] Initialized first chapter with empty data:", firstChapter);
  }

  // 保存到服务器
  try {
    const stringifyServerData = JSON.stringify(serverData.value);
    await updateWorkVersionReq(workId.value, stringifyServerData, "1");
    ElMessage.success("大纲保存成功");

    // 锁定大纲目录
    lockedDirectories.value.add("大纲.md");

    // 更新固定高度
    setTimeout(() => {
      updateSectionHeight("大纲.md");
    }, 100);

    // 用户主动确认：跳转到第一章正文
    if (firstChapter) {
      console.log("[QuickEditor] User confirmed, switch to first chapter:", firstChapter);
      shouldTriggerScroll.value = true; // 确认后跳转，需要滚动
      currentDirectory.value = firstChapter;
      // 滚动由watch自动处理
    }
  } catch (e) {
    console.error("[QuickEditor] 保存大纲失败:", e);
    ElMessage.error("保存失败");
  }
};

// 从大纲数据中获取章节信息（支持 ScriptOutlineStorageData：episode/episode_title/episode_note）
const getChapterDataFromOutline = (chapterIndex: number): ScriptSplitOutlineDict | null => {
  const outlineData = serverData.value["大纲.md"];
  if (!outlineData) return null;

  try {
    const parsed = JSON.parse(outlineData) as ScriptOutlineStorageData | DocOutlineStorageData;
    const list = parsed.jsonContent?.outline_dict;
    if (!list || chapterIndex >= list.length) return null;
    const item = list[chapterIndex];
    // 新结构：ScriptSplitOutlineDict
    if (item && "episode" in item) return item as ScriptSplitOutlineDict;
    // 旧结构：DocOutlineDict，转为 ScriptSplitOutlineDict 兼容展示
    const old = item as { chapter?: string; chapter_title?: string; chapter_note?: string };
    return {
      episode: old.chapter ?? `第${chapterIndex + 1}集`,
      episode_title: old.chapter_title ?? "",
      episode_note: old.chapter_note ?? "",
    };
  } catch (e) {
    console.error("[QuickEditor] 解析大纲数据失败:", e);
    return null;
  }
};

// 处理章节确认
const handleChapterConfirm = async (chapterIndex: number, chapterData: string) => {
  const chapterName = getChapterDirByIndex(chapterIndex);
  console.log(
    "[QuickEditor] handleChapterConfirm, chapterIndex:",
    chapterIndex,
    "chapterName:",
    chapterName
  );
  console.log("[QuickEditor] handleChapterConfirm, data length:", chapterData.length);

  // 更新serverData
  serverData.value[chapterName] = chapterData;

  // 章节锁定规则与 initLockedDirectories 一致：有细纲或正文则锁定；刚回退的目录本次不加锁，避免回退后立刻被重新锁定
  // try {
  //   const parsed: DocChapterStorageData = JSON.parse(chapterData);
  //   const hasOutline = parsed.episodeNote && parsed.episodeNote.trim();
  //   const hasContent = parsed.content && parsed.content.trim();
  //   const shouldLock = hasOutline || hasContent;
  //   if (shouldLock && chapterName !== justRevertedDir.value) {
  //     lockedDirectories.value.add(chapterName);
  //     console.log("[QuickEditor] Chapter confirm, locked directory:", chapterName);
  //   }
  // } catch (e) {
  //   console.error("[QuickEditor] Failed to parse chapter data:", e);
  // }
  // 保存到服务器
  try {
    const stringifyServerData = JSON.stringify(serverData.value);
    await updateWorkVersionReq(workId.value, stringifyServerData, "1");
    console.log("[QuickEditor] 章节数据保存成功");
  } catch (e) {
    console.error("[QuickEditor] 保存章节数据失败:", e);
    ElMessage.error("保存失败");
  }
};

// 处理章节故事梗概更新
const handleChapterNoteUpdate = async (chapterIndex: number, chapterNote: string) => {
  console.log("[QuickEditor] handleChapterNoteUpdate, index:", chapterIndex, "note:", chapterNote);

  // 更新大纲数据中对应章节的 chapter_note
  const outlineData = serverData.value["大纲.md"];
  if (!outlineData) {
    console.error("[QuickEditor] 大纲数据不存在");
    return;
  }

  try {
    const parsed = JSON.parse(outlineData) as ScriptOutlineStorageData | DocOutlineStorageData;
    const dict = parsed.jsonContent?.outline_dict;
    if (dict && dict[chapterIndex]) {
      const item = dict[chapterIndex];
      if (item && "episode_note" in item) (item as ScriptSplitOutlineDict).episode_note = chapterNote;
      else if (item && "chapter_note" in item) (item as { chapter_note: string }).chapter_note = chapterNote;
      serverData.value["大纲.md"] = JSON.stringify(parsed);

      // 保存到服务器
      const stringifyServerData = JSON.stringify(serverData.value);
      await updateWorkVersionReq(workId.value, stringifyServerData, "1");
      console.log("[QuickEditor] 章节梗概更新成功");
    }
  } catch (e) {
    console.error("[QuickEditor] 更新章节梗概失败:", e);
    ElMessage.error("保存失败");
  }
};

// 处理章节回退到故事梗概状态（清除细纲和正文，保留章节目录）
const handleChapterRevertToNote = async (chapterIndex: number) => {
  const chapterName = getChapterDirByIndex(chapterIndex);
  console.log("[QuickEditor] handleChapterRevertToNote, chapter:", chapterName);

  // 当前章节保留为 {episodeNote:'',content:''}（清除细纲和正文）
  const emptyChapterData = JSON.stringify({ episodeNote: "", content: "" });
  serverData.value[chapterName] = emptyChapterData;
  lockedDirectories.value.delete(chapterName);

  // 清空当前章节之后的所有章节（置为空字符串）
  const chapterIndexInDirs = directories.value.indexOf(chapterName);
  if (chapterIndexInDirs !== -1) {
    directories.value.slice(chapterIndexInDirs + 1).forEach((dir) => {
      if (isEpisodeOrChapterDir(dir)) {
        serverData.value[dir] = "";
        lockedDirectories.value.delete(dir);
      }
    });
  }

  // 保存到服务器
  try {
    const stringifyServerData = JSON.stringify(serverData.value);
    await updateWorkVersionReq(workId.value, stringifyServerData, "1");
    ElMessage.success("已回退至此步骤");
  } catch (e) {
    console.error("[QuickEditor] 回退保存失败:", e);
  }

  // 定位到当前章节（滚动由watch自动处理）
  shouldTriggerScroll.value = true; // 章节确认/回退，需要滚动
  currentDirectory.value = chapterName;
};

// 处理章节回退到细纲状态（只清除正文，保留细纲）
const handleChapterRevertToOutline = async (chapterIndex: number) => {
  const chapterName = getChapterDirByIndex(chapterIndex);
  console.log("[QuickEditor] handleChapterRevertToOutline, chapter:", chapterName);

  // 获取当前章节数据，只清除content字段，保留episodeNote
  const currentContent = serverData.value[chapterName];
  if (currentContent && currentContent.trim() !== "") {
    try {
      const parsed = JSON.parse(currentContent);
      if (parsed && typeof parsed === "object") {
        // 只清除content，保留episodeNote
        parsed.content = "";
        serverData.value[chapterName] = JSON.stringify(parsed);
        lockedDirectories.value.delete(chapterName);
      }
    } catch (e) {
      console.error("[QuickEditor] 解析章节数据失败:", e);
    }
  }

  // 保存到服务器
  try {
    const stringifyServerData = JSON.stringify(serverData.value);
    await updateWorkVersionReq(workId.value, stringifyServerData, "1");
    ElMessage.success("已回退至细纲");
  } catch (e) {
    console.error("[QuickEditor] 回退保存失败:", e);
  }

  // 定位到当前章节（滚动由watch自动处理）
  shouldTriggerScroll.value = true; // 章节确认/回退，需要滚动
  currentDirectory.value = chapterName;
};

// 处理生成正文事件（不初始化下一章，只有点击继续下一章时才初始化）
const handleChapterGenerateContent = async (chapterIndex: number) => {
  console.log("[QuickEditor] handleChapterGenerateContent, chapterIndex:", chapterIndex);
  // 生成正文后不自动初始化下一章，只有点击继续下一章时才初始化
};

// 处理继续下一章事件
const handleChapterContinueNext = async (chapterIndex: number) => {
  console.log("[QuickEditor] handleChapterContinueNext, chapterIndex:", chapterIndex);

const chapterNum = workInfo.value?.chapterNum ?? 0;
const isLastChapter = chapterNum > 0 && chapterIndex === chapterNum - 1;
const currentChapterName = getChapterDirByIndex(chapterIndex);

if (isLastChapter) {
  // 最后一章点击「完成」：给当前章节数据扩展 isFinished: true，并锁定
  const raw = serverData.value[currentChapterName];
  if (raw && raw.trim() !== "") {
    try {
      const parsed: DocChapterStorageData = JSON.parse(raw);
      const updated = { ...parsed, isFinished: true };
      serverData.value[currentChapterName] = JSON.stringify(updated);
    } catch (e) {
      console.error("[QuickEditor] 解析最后一章数据失败:", e);
    }
  }
  lockedDirectories.value.add(currentChapterName);
  lockedDirectories.value = new Set(lockedDirectories.value);
  try {
    const stringifyServerData = JSON.stringify(serverData.value);
    await updateWorkVersionReq(workId.value, stringifyServerData, "1");
    ElMessage.success("创作完成");
  } catch (e) {
    console.error("[QuickEditor] 保存失败:", e);
    ElMessage.error("保存失败");
  }
  return;
}

// 非最后一章：锁定当前章节，给下一章赋空数据，切换到下一章
const nextChapterIndex = chapterIndex + 1;
const nextChapterName = getChapterDirByIndex(nextChapterIndex);

if (directories.value.includes(nextChapterName)) {
  lockedDirectories.value.add(currentChapterName);
  lockedDirectories.value = new Set(lockedDirectories.value);

  const emptyChapterData = JSON.stringify({ episodeNote: "", content: "" });
  serverData.value[nextChapterName] = emptyChapterData;

  try {
    const stringifyServerData = JSON.stringify(serverData.value);
    await updateWorkVersionReq(workId.value, stringifyServerData, "1");
    shouldTriggerScroll.value = true;
    currentDirectory.value = nextChapterName;
  } catch (e) {
    console.error("[QuickEditor] 继续下一章失败:", e);
    ElMessage.error("操作失败");
  }
} else {
  ElMessage.warning("没有下一章了");
}
};

// 判断是否是最后一个有内容的章节
const isLastChapterWithContent = (chapterIndex: number): boolean => {
  const chapterDirs = directories.value.filter(
    (dir) => isEpisodeOrChapterDir(dir)
  );
  const currentChapterName = getChapterDirByIndex(chapterIndex);
  const currentIndex = chapterDirs.indexOf(currentChapterName);

  // 检查当前章节是否有正文内容
  const currentContent = serverData.value[currentChapterName];
  if (!currentContent || currentContent.trim() === "") {
    return false; // 当前章节没有内容
  }

  try {
    const parsed = JSON.parse(currentContent);
    if (!parsed || typeof parsed !== "object" || !parsed.content || !parsed.content.trim()) {
      return false; // 当前章节没有正文内容
    }
  } catch (e) {
    return false; // 解析失败
  }

  // 检查当前章节之后是否还有有内容的章节（包括空对象的情况）
  for (let i = currentIndex + 1; i < chapterDirs.length; i++) {
    const dir = chapterDirs[i];
    const content = serverData.value[dir];
    // 如果下一章有内容（即使是空对象 {episodeNote:'',content:''}），当前章节就不是最后一个
    if (content && content.trim() !== "") {
      return false; // 后面还有章节（包括空对象）
    }
  }

  return true; // 当前章节有正文，且后面没有章节（包括空对象）
};

// 获取上一个有内容的章节索引
const getPreviousChapterIndex = (chapterIndex: number): number | undefined => {
  const chapterDirs = directories.value.filter(
    (dir) => isEpisodeOrChapterDir(dir)
  );
  const currentChapterName = getChapterDirByIndex(chapterIndex);
  const currentIndex = chapterDirs.indexOf(currentChapterName);

  if (currentIndex === -1) {
    return undefined;
  }

  // 从当前章节往前查找
  for (let i = currentIndex - 1; i >= 0; i--) {
    const dir = chapterDirs[i];
    const content = serverData.value[dir];
    if (content && content.trim() !== "") {
      try {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === "object") {
          // 检查是否有实际内容（episodeNote 或 content 不为空）
          if (
            (parsed.content && parsed.content.trim())
          ) {
            // 从目录名称中提取章节索引
            return getChapterIndexFromDir(dir);
          }
        }
      } catch (e) {
        // 解析失败，跳过
      }
    }
  }

  return undefined; // 没有找到上一章，返回 undefined（表示回退到编辑大纲）
};

// 处理章节回退到编辑大纲或上一章（清空章节目录）
const handleChapterRevert = async (chapterIndex: number) => {
  const chapterName = getChapterDirByIndex(chapterIndex);
  console.log("[QuickEditor] handleChapterRevert, chapter:", chapterName);

  // 获取上一章索引
  const previousChapterIndex = getPreviousChapterIndex(chapterIndex);

  if (previousChapterIndex !== undefined && previousChapterIndex >= 0) {
    // 有上一章：只清除当前章节及之后的所有章节，保留上一章
    const prevChapterName =
      getChapterDirByIndex(previousChapterIndex);
    const chapterDirs = directories.value.filter(
      (dir) => isEpisodeOrChapterDir(dir)
    );
    const currentIndex = chapterDirs.indexOf(chapterName);

    // 清除当前章节及之后的所有章节
    for (let i = currentIndex; i < chapterDirs.length; i++) {
      const dir = chapterDirs[i];
      serverData.value[dir] = "";
      lockedDirectories.value.delete(dir);
    }

    // 保存到服务器
    try {
      const stringifyServerData = JSON.stringify(serverData.value);
      await updateWorkVersionReq(workId.value, stringifyServerData, "1");
      ElMessage.success(`已回退至第${previousChapterIndex + 1}集`);
    } catch (e) {
      console.error("[QuickEditor] 回退保存失败:", e);
    }

    // 定位到上一章（滚动由watch自动处理）
    currentDirectory.value = prevChapterName;
  } else {
    // 没有上一章：清除所有章节，回退到编辑大纲
    // 解锁大纲目录，允许重新编辑大纲（大纲内容不清除）
    lockedDirectories.value.delete("大纲.md");

    // 清空所有章节的细纲和正文（完全清空章节目录）
    directories.value.forEach((dir) => {
      if (isEpisodeOrChapterDir(dir)) {
        serverData.value[dir] = "";
        lockedDirectories.value.delete(dir);
      }
    });

    // 保存到服务器
    try {
      const stringifyServerData = JSON.stringify(serverData.value);
      await updateWorkVersionReq(workId.value, stringifyServerData, "1");
      ElMessage.success("已回退至编辑大纲");
    } catch (e) {
      console.error("[QuickEditor] 回退保存失败:", e);
    }

    // 定位到大纲目录（滚动由watch自动处理）
    shouldTriggerScroll.value = true; // 回退操作，需要滚动
    currentDirectory.value = "大纲.md";
    // 更新大纲区域的固定高度
    nextTick(() => {
      updateSectionHeight("大纲.md");
    });
  }
};

// 处理大纲回退
const handleOutlineRevert = async () => {
  console.log("[QuickEditor] handleOutlineRevert");
  // 解锁角色目录，允许重新编辑角色（角色内容不清除）
  lockedDirectories.value.delete("主角设定.md");

  // 清空大纲及后续目录的内容（不包括角色）
  const outlineIndex = directories.value.indexOf("大纲.md");
  directories.value.slice(outlineIndex).forEach((dir) => {
    serverData.value[dir] = "";
    lockedDirectories.value.delete(dir);
  });

  // 保存到服务器
  try {
    const stringifyServerData = JSON.stringify(serverData.value);
    await updateWorkVersionReq(workId.value, stringifyServerData, "1");
    ElMessage.success("已回退至角色选择");
  } catch (e) {
    console.error("[QuickEditor] 回退保存失败:", e);
  }

  // 切换到角色目录（滚动由watch自动处理）
  shouldTriggerScroll.value = true; // 回退操作，需要滚动
  currentDirectory.value = "主角设定.md";
};

// 判断当前目录后面是否有可切换的目录
// 条件：当前目录必须已锁定（已确认），且下一个目录可以访问
const hasNextDirectoryContent = (currentDir: string): boolean => {
  // 1. 当前目录必须已锁定（已确认内容）
  if (!lockedDirectories.value.has(currentDir)) {
    return false; // 当前目录未确认，不显示回退按钮
  }

  const currentIndex = directories.value.indexOf(currentDir);
  if (currentIndex === -1 || currentIndex === directories.value.length - 1) {
    return false; // 当前目录不存在或是最后一个
  }

  // 2. 检查下一个目录是否可以访问（可见）
  const nextDir = directories.value[currentIndex + 1];
  if (!nextDir) {
    return false; // 没有下一个目录
  }

  // 使用 isSectionVisible 判断下一个目录是否可访问
  return isSectionVisible(nextDir);
};

// 回退到当前步骤（清除当前目录之后的所有内容）
const handleRevertToCurrentStep = async (currentDir: string, fromError = false) => {
  console.log("[ScriptEditor] handleRevertToCurrentStep, currentDir:", currentDir);

  if (!fromError) {
    try {
      await ElMessageBox.confirm("回退后，该步骤后续内容将被清空不可找回", "是否回退到该步骤？", {
        confirmButtonText: "确认",
        cancelButtonText: "取消",
        type: "warning",
        customClass: "revert-confirm-dialog",
      });
    } catch (e) {
      // 用户取消
      console.log("[ScriptEditor] User cancelled revert");
      return;
    }
  }

  const currentIndex = directories.value.indexOf(currentDir);
  if (currentIndex === -1) {
    console.error("[QuickEditor] Current directory not found:", currentDir);
    return;
  }

  // 解锁当前目录
  lockedDirectories.value.delete(currentDir);

  // 若回退到小说纲章且之前是跳过状态，清除 skipped 标志
  if (currentDir === "小说纲章.md") {
    try {
      const raw = serverData.value["小说纲章.md"];
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.skipped) {
          serverData.value["小说纲章.md"] = "";
        }
      }
    } catch {
      // 非 JSON 格式，不处理
    }
  }

  // 清空当前目录之后的所有内容
  directories.value.slice(currentIndex + 1).forEach((dir) => {
    serverData.value[dir] = "";
    lockedDirectories.value.delete(dir);
  });

  // 回退到主角设定时，同时清空大纲分段数据，避免再进大纲时仍带旧分段与旧内容
  if (currentDir === "主角设定.md") {
    if (serverData.value["大纲分段.md"]) delete serverData.value["大纲分段.md"];
    outlineSegmentList.value = [];
  }

  // 保存到服务器
  try {
    const stringifyServerData = JSON.stringify(serverData.value);
    await updateWorkVersionReq(workId.value, stringifyServerData, "1");

    // 根据当前目录生成回退提示文案
    let revertMessage = "";
    if (currentDir === "小说纲章.md") {
      revertMessage = "已回退至小说纲章";
    } else if (currentDir === "标签.md") {
      revertMessage = "已回退至选择标签";
    } else if (currentDir === "故事梗概.md") {
      revertMessage = "已回退至选择故事梗概";
    } else if (currentDir === "主角设定.md") {
      revertMessage = "已回退至选择角色";
    } else if (currentDir === "大纲.md") {
      revertMessage = "已回退至编辑大纲";
    } else if (isEpisodeOrChapterDir(currentDir)) {
      const chapterIndex = getChapterIndexFromDir(currentDir);
      revertMessage = `已回退至第${chapterIndex + 1}集`;
    } else {
      revertMessage = "已回退";
    }

    ElMessage.success(revertMessage);
  } catch (e) {
    console.error("[QuickEditor] 回退保存失败:", e);
    ElMessage.error("回退保存失败");
  }

  // 切换到当前目录（滚动由watch自动处理）
  shouldTriggerScroll.value = true; // 回退操作，需要滚动
  currentDirectory.value = currentDir;

  // 回退到正文之前的步骤（纲章/标签/梗概/角色/大纲）时，若正文主目录是打开的则关闭
  if (STEPS_BEFORE_MAIN_TEXT.includes(currentDir)) {
    isMainTextExpanded.value = false;
  }
};


let hasThrowError = false;
// 处理错误回退：滚动到目标目录并触发回退事件（优化版）
const handleErrorAndRevert = (targetDir: string) => {
  console.log("[QuickEditor] handleErrorAndRevert, targetDir:", targetDir);
  if(hasThrowError) return;
  hasThrowError = true;

  // 切换到目标目录（滚动由watch自动处理）
  shouldTriggerScroll.value = true; // 错误回退，需要滚动
  currentDirectory.value = targetDir;

  if (STEPS_BEFORE_MAIN_TEXT.includes(targetDir)) {
    isMainTextExpanded.value = false;
  }

  // 等待滚动完成后触发回退
  setTimeout(() => {
    handleRevertToCurrentStep(targetDir, true);
    hasThrowError = false;
  }, 800); // 等待滚动动画完成（600ms滚动锁 + 200ms余量）
};

// 处理关闭状态下文件夹图标的点击
const handleCollapsedFolderClick = (dir: string | undefined, children?: string[]) => {
  if (!dir) return;

  // 展开侧边栏
  isSidebarExpanded.value = true;
  // 展开正文文件夹
  if (dir === "正文.md" && children && children.length > 0) {
    isMainTextExpanded.value = true;
    // 如果有子目录，可以选择第一个可用的子目录
    const firstAvailableChapter = children.find((childDir) => {
      const dirIndex = directories.value.indexOf(childDir);
      return dirIndex !== -1 && !isDirectoryDisabled(childDir, dirIndex);
    });
    if (firstAvailableChapter) {
      // 延迟一下确保DOM已更新
      nextTick(() => {
        handleDirectoryClick(firstAvailableChapter);
      });
    }
  }
};

// 处理目录点击（优化版：移除不必要的延迟）
const handleDirectoryClick = (dir: string) => {
  console.log("[🖱️ USER CLICK] Directory clicked:", dir);

  // 如果目录已锁定，允许切换到已锁定的目录（用于查看）
  if (lockedDirectories.value.has(dir)) {
    shouldTriggerScroll.value = true; // 用户点击，需要滚动
    currentDirectory.value = dir;
    return;
  }

  // 对于章节目录，特殊处理：只要章节有值就可以访问，不需要检查前置条件
  if (isEpisodeOrChapterDir(dir)) {
    if (!hasChapterValue(dir)) {
      // 章节没有值，禁止访问
      console.log("[DEBUG] Chapter has no value, access denied");
      return;
    }
    // 章节有值，允许访问（不检查前置条件）
    shouldTriggerScroll.value = true; // 用户点击，需要滚动
    currentDirectory.value = dir;
    return;
  }

  // 对于固定目录（标签、故事梗概、角色设定、大纲），检查前置条件
  const dirIndex = directories.value.indexOf(dir);
  if (dirIndex > 0) {
    const prevDir = directories.value[dirIndex - 1];
    if (!lockedDirectories.value.has(prevDir)) {
      // 前一个目录未完成，禁止访问固定目录
      console.log("[DEBUG] Previous directory not locked, access denied");
      return;
    }
  }

  // 立即更新目录，由watch触发滚动
  shouldTriggerScroll.value = true; // 用户点击，需要滚动
  currentDirectory.value = dir;
};

// 获取目录显示名称（按照Figma设计稿）
const getDirectoryName = (dir: string) => {
  const nameMap: Record<string, string> = {
    "小说纲章.md": "小说纲章",
    "标签.md": "故事标签",
    "故事梗概.md": "故事梗概",
    "主角设定.md": "角色设定",
    "大纲.md": "大纲",
    "正文.md": "正文",
  };

  // 集数/正文章节目录统一显示为「第N集」
  if (isEpisodeDir(dir)) return dir.replace(".md", "");
  const chMatch = dir.match(/^正文-第(\d+)章\.md$/);
  if (chMatch) return `第${chMatch[1]}集`;

  return nameMap[dir] || dir.replace(".md", "");
};

// 判断正文文件夹的状态
const getMainTextFolderState = (): "default" | "selected" | "disabled" => {
  const chapterDirs = directories.value.filter(
    (d) => isEpisodeOrChapterDir(d)
  );

  if (chapterDirs.length === 0) {
    return "default";
  }

  // 检查是否有任何子章节被选中
  const hasSelectedChapter = chapterDirs.some(
    (chapterDir) => currentDirectory.value === chapterDir
  );
  if (hasSelectedChapter) {
    return "selected";
  }

  // 检查是否所有子章节都不可选
  const allChaptersDisabled = chapterDirs.every((chapterDir) => {
    const dirIndex = directories.value.indexOf(chapterDir);
    return dirIndex !== -1 && isDirectoryDisabled(chapterDir, dirIndex);
  });

  if (allChaptersDisabled) {
    return "disabled";
  }

  return "default";
};

// 获取目录图标（根据状态）
const getDirectoryIcon = (dir: string, state?: "default" | "selected" | "disabled") => {
  // 对于正文.md文件夹，总是根据子章节状态判断
  if (dir === "正文.md") {
    state = getMainTextFolderState();
  } else if (!state) {
    // 如果没有传入state，自动判断
    const isSelected = currentDirectory.value === dir;
    const dirIndex = directories.value.indexOf(dir);
    const isDisabled = dirIndex !== -1 && isDirectoryDisabled(dir, dirIndex);

    if (isSelected) {
      state = "selected";
    } else if (isDisabled) {
      state = "disabled";
    } else {
      state = "default";
    }
  }

  const iconMap: Record<string, Record<string, string>> = {
    "小说纲章.md": {
      default: novelChapterDefaultIcon,
      selected: novelChapterSelectedIcon,
      disabled: novelChapterDefaultIcon, // 作为第一个目录项，不存在不可选状态，使用默认图标
    },
    "标签.md": {
      default: storyTagDefaultIcon,
      selected: storyTagSelectedIcon,
      disabled: storyTagDisabledIcon,
    },
    "故事梗概.md": {
      default: storyOutlineDefaultIcon,
      selected: storyOutlineSelectedIcon,
      disabled: storyOutlineDisabledIcon,
    },
    "主角设定.md": {
      default: characterSettingDefaultIcon,
      selected: characterSettingSelectedIcon,
      disabled: characterSettingDisabledIcon,
    },
    "大纲.md": {
      default: outlineDefaultIcon,
      selected: outlineSelectedIcon,
      disabled: outlineDisabledIcon,
    },
    "正文.md": {
      default: mainTextDefaultIcon,
      selected: mainTextSelectedIcon,
      disabled: mainTextDisabledIcon,
    },
  };

  // 正文章节使用正文图标
  if (isEpisodeOrChapterDir(dir)) {
    const chapterIsSelected = currentDirectory.value === dir;
    const chapterIsDisabled = isDirectoryDisabled(dir, directories.value.indexOf(dir));
    if (chapterIsSelected) {
      return mainTextSelectedIcon;
    } else if (chapterIsDisabled) {
      return mainTextDisabledIcon;
    } else {
      return mainTextDefaultIcon;
    }
  }

  return iconMap[dir]?.[state] || "";
};

// 获取正文文件夹的箭头图标
const getMainTextFolderArrowIcon = (): string => {
  const state = getMainTextFolderState();
  switch (state) {
    case "selected":
      return arrowSelectedIcon;
    case "disabled":
      return arrowDisabledIcon;
    default:
      return arrowDefaultIcon;
  }
};

// 判断是否是正文文件夹
const isMainTextFolder = (dir: string) => {
  return dir === "正文.md" || isEpisodeOrChapterDir(dir);
};

// 正文文件夹是否展开
const isMainTextExpanded = ref(false);
// 起承转合各分段是否展开（仅当有 outlineSegmentList 时使用）
const segmentExpanded = ref<Record<string, boolean>>({});

// 监听当前目录变化,如果是章节目录则自动展开正文文件夹及所在起承转合分段
watch(
  currentDirectory,
  (newDir) => {
    if (newDir && isEpisodeOrChapterDir(newDir)) {
      isMainTextExpanded.value = true;
      const chapterIndex = getChapterIndexFromDir(newDir) + 1; // 1-based
      outlineSegmentList.value.forEach((seg) => {
        if (chapterIndex >= seg.start && chapterIndex <= seg.end) {
          segmentExpanded.value = { ...segmentExpanded.value, [seg.label]: true };
        }
      });
      nextTick(() => {
        setTimeout(() => {
          scrollToSelectedChapter(newDir);
          updateChapterLineHeight();
        }, 150);
      });
    }
  },
  { immediate: true }
);

// 当有分段数据时，默认展开第一个分段
watch(
  () => outlineSegmentList.value.length,
  (len) => {
    if (len > 0 && outlineSegmentList.value[0]) {
      segmentExpanded.value = { ...segmentExpanded.value, [outlineSegmentList.value[0].label]: true };
    }
  }
);

// 由大纲模块获取到分段后，父组件负责保存分段并生成章节目录（入参为后端 splitOutline 字符串数组）
const handleOutlineSplitReady = async (rawSegments: string[]) => {
  const segments = parseOutlineSegmentsFromRaw(Array.isArray(rawSegments) ? rawSegments : []);
  outlineSegmentList.value = segments;
  const totalChapters = segments.length > 0 ? Math.max(...segments.map((s) => s.end)) : 0;
  if (totalChapters <= 0) return;

  // 删除旧的章节目录
  Object.keys(serverData.value).forEach((key) => {
    if (isEpisodeOrChapterDir(key)) delete serverData.value[key];
  });

  // 生成新的集数目录（第N集.md）
  for (let i = 1; i <= totalChapters; i++) {
    serverData.value[`第${i}集.md`] = "";
  }

  // 删除正文占位目录
  if ("正文.md" in serverData.value) delete serverData.value["正文.md"];

  // 持久化分段信息
  serverData.value["大纲分段.md"] = JSON.stringify(segments);

  try {
    await updateWorkInfoReq(workId.value, { chapterNum: totalChapters });
    await updateWorkVersionReq(workId.value, JSON.stringify(serverData.value), "1");
    await editorStore.updateWorkInfo();
    // 防止集数不统一
    workInfo.value.chapterNum = totalChapters;
    console.log("[QuickEditor] handleOutlineSplitReady, segments:", segments, "totalChapters:", totalChapters);
  } catch (e) {
    console.error("[QuickEditor] 保存分段与章节目录失败:", e);
    ElMessage.error("保存分段信息失败");
  }
};

// 监听正文文件夹展开状态，展开时滚动到选中的章节
watch(isMainTextExpanded, (expanded) => {
  if (
    expanded &&
    currentDirectory.value &&
    isEpisodeOrChapterDir(currentDirectory.value)
  ) {
    nextTick(() => {
      setTimeout(() => {
        scrollToSelectedChapter(currentDirectory.value);
      }, 100);
    });
  }
});

// 获取显示的目录列表(处理正文文件夹折叠；有分段时按起承转合分组)
const displayDirectories = computed(() => {
  const result: Array<{
    type: "item" | "folder";
    dir?: string;
    children?: string[];
    segmentGroups?: { label: string; children: string[] }[];
  }> = [];
  const chapterDirs: string[] = [];
  const otherDirs: string[] = [];

  for (const dir of directories.value) {
    if (isEpisodeOrChapterDir(dir)) {
      chapterDirs.push(dir);
    } else if (dir !== "正文.md") {
      otherDirs.push(dir);
    }
  }

  for (const dir of otherDirs) {
    result.push({ type: "item", dir });
  }

  if (chapterDirs.length > 0) {
    // 起承转合子目录：每个分段的 children 为实际存在的目录 key（与 serverData 一致），保证点击正确
    const segmentGroups =
      outlineSegmentList.value.length > 0
        ? outlineSegmentList.value.map((seg) => {
            const startIdx = seg.start - 1;
            const endIdx = seg.end - 1;
            const children = chapterDirs
              .filter((d) => {
                const idx = getChapterIndexFromDir(d);
                return idx >= startIdx && idx <= endIdx;
              })
              .sort((a, b) => getChapterIndexFromDir(a) - getChapterIndexFromDir(b));
            return { label: seg.label, children };
          })
        : undefined;
    result.push({
      type: "folder",
      dir: "正文.md",
      children: chapterDirs,
      segmentGroups,
    });
  }

  return result;
});

// 切换某一起承转合分段的展开/收起
const toggleSegment = (label: string) => {
  segmentExpanded.value = {
    ...segmentExpanded.value,
    [label]: !segmentExpanded.value[label],
  };
};

// 监听章节列表变化和展开状态，更新线的高度（需要在 displayDirectories 定义之后）
watch(
  [
    () =>
      displayDirectories.value.find((item) => item.type === "folder" && item.dir === "正文.md")
        ?.children?.length,
    isMainTextExpanded,
  ],
  () => {
    if (isMainTextExpanded.value) {
      nextTick(() => {
        updateChapterLineHeight();
      });
    }
  }
);

// 更新章节线的高度
const updateChapterLineHeight = () => {
  if (!chapterListRef.value || !chapterChildrenContainerRef.value) {
    return;
  }

  // 检查 ref 是否是 DOM 元素
  const container = chapterChildrenContainerRef.value;
  if (!(container instanceof HTMLElement)) {
    return;
  }

  const folderItem = displayDirectories.value.find(
    (item) => item.type === "folder" && item.dir === "正文.md"
  );
  if (!folderItem || !folderItem.children || folderItem.children.length === 0) {
    return;
  }

  const chapterCount = folderItem.children.length;
  // 线的高度 = 章节数量 * (40px + 10px gap) - 10px (最后一个不需要gap)
  const lineHeight = chapterCount * 50 - 10;

  const lineElement = container.querySelector(".chapter-line") as HTMLElement;
  if (lineElement) {
    lineElement.style.height = `${lineHeight}px`;
  }

  // 同时更新容器高度，确保线能完整显示
  if (container instanceof HTMLElement) {
    const containerHeight = Math.max(50, lineHeight + 10);
    container.style.minHeight = `${containerHeight}px`;
  }
};

// 滚动到选中的章节（统一滚动容器内使用 scrollIntoView，避免多容器滚动冲突）
const scrollToSelectedChapter = (selectedDir: string) => {
  const selectedElement = chapterItemRefs.value.get(selectedDir);
  if (selectedElement && selectedElement instanceof HTMLElement) {
    selectedElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return;
  }
  // 若 ref 尚未绑定（如刚展开），从统一滚动容器内查找；ref 在 v-for 下可能为数组，需取真实 DOM
  const rawRef = mainTextFolderScrollRef.value;
  const scrollEl = Array.isArray(rawRef) ? rawRef[0] : rawRef;
  if (scrollEl && typeof scrollEl.querySelector === "function") {
    const el = scrollEl.querySelector(`[data-chapter-dir="${selectedDir}"]`) as HTMLElement;
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
};

// 监听章节列表变化和展开状态，更新线的高度（需要在 displayDirectories 定义之后）
watch(
  [
    () =>
      displayDirectories.value.find((item) => item.type === "folder" && item.dir === "正文.md")
        ?.children?.length,
    isMainTextExpanded,
  ],
  () => {
    if (isMainTextExpanded.value) {
      nextTick(() => {
        updateChapterLineHeight();
      });
    }
  }
);

// 判断目录是否应该被禁用
const isDirectoryDisabled = (dir: string, index: number): boolean => {
  // 对于章节目录，如果没有值，禁用
  if (isEpisodeOrChapterDir(dir)) {
    return !hasChapterValue(dir);
  }
  // 其他目录：如果未锁定且前一个目录未锁定，禁用
  return (
    !lockedDirectories.value.has(dir) &&
    (index === 0 ? false : !lockedDirectories.value.has(directories.value[index - 1]))
  );
};

// 处理返回按钮点击
const handleBackClick = async () => {
  window.location.replace("/workspace/my-place");
};

// 处理保存按钮点击
const handleClickToSave = async () => {
  try {
    const stringifyServerData = JSON.stringify(serverData.value);
    await updateWorkVersionReq(workId.value, stringifyServerData, "0");
    ElMessage.success("保存成功");
  } catch (e) {
    console.error(e);
    ElMessage.error("保存失败");
  }
};

// 处理标题更新
const handleTitleUpdate = async (newTitle: string) => {
  if (!newTitle || newTitle === workInfo.value?.title) return;
  const _title = `《${newTitle}》`;
  workInfo.value = {
    ...workInfo.value,
    title: _title,
  };
  await updateWorkInfoReq(workId.value, { title: _title });
};

// 处理笔记确认事件
const handleNotesConfirm = async (notes: any[]) => {
  // 找到当前激活的正文章节目录
  const currentDir = currentDirectory.value;

  // 检查是否是正文章节
  if (!isEpisodeOrChapterDir(currentDir)) {
    ElMessage.warning('需要先将光标定位到您想插入笔记的正文位置');
    return;
  }

  // 检查正文目录是否锁定（是否已生成正文）
  if (!lockedDirectories.value.has(currentDir)) {
    ElMessage.warning('需要先将光标定位到您想插入笔记的正文位置');
    return;
  }

  // 获取当前章节的编辑器引用
  const chapterEditor = chapterEditorRefs.value.get(currentDir);
  if (!chapterEditor) {
    ElMessage.error('无法找到当前章节编辑器');
    return;
  }

  // 调用插入笔记内容方法
  const result = chapterEditor.insertNoteContent(notes);

  if (result.success) {
    ElMessage.success(result.message);
    // 保存章节数据
    const chapterIndex = getChapterIndexFromDir(currentDir);
    // 触发保存，通过触发编辑器的保存逻辑
    // 这里需要手动触发保存，因为插入内容后需要更新 serverData
    await nextTick();
    // 通过触发 confirm 事件来保存
    // 但我们需要先获取当前章节数据
    // 暂时先提示成功，实际保存会在用户手动保存或自动保存时触发
  } else {
    ElMessage.warning(result.message);
  }
};

// 初始化锁定状态（根据serverData中是否有内容）
const initLockedDirectories = () => {
  directories.value.forEach((dir) => {
    const content = serverData.value[dir];
    if (!content || content.trim() === "") {
      return;
    }

    // 对于章节目录，需要检查是否有细纲或正文
    if (isEpisodeOrChapterDir(dir)) {
      try {
        const parsed: ScriptChapterStorageData = JSON.parse(content);
        // 如果有细纲或正文，则锁定；但「最后一个有内容的章节」不锁定（刷新后仍显示重新生成、继续下一章）
        if (

          parsed.content && parsed.content.trim()
        ) {
          const chapterIndex = getChapterIndexFromDir(dir);
          const chapterNum = workInfo.value?.chapterNum ?? 0;
          const isLastChapterOfBook = chapterNum > 0 && chapterIndex === chapterNum - 1;
          // 最后一章是否锁定由 isFinished 决定；非最后一章按「最后一个有内容的章节不锁定」规则
          if (isLastChapterOfBook) {
            if (parsed.isFinished === true) {
              lockedDirectories.value.add(dir);
              console.log(`[QuickEditor] Locked chapter directory (last, isFinished): ${dir}`);
            } else {
              console.log(`[QuickEditor] Skip locking last chapter (no isFinished): ${dir}`);
            }
          } else {
            const shouldSkipLock = isLastChapterWithContent(chapterIndex);
            if (!shouldSkipLock) {
              lockedDirectories.value.add(dir);
              console.log(`[QuickEditor] Locked chapter directory: ${dir}`);
            } else {
              console.log(`[QuickEditor] Skip locking last chapter with content: ${dir}`);
            }
          }
        }
      } catch (e) {
        // 解析失败，如果内容不为空，也锁定（可能是旧格式）；最后一章不根据 isFinished 判断则不加锁
        const chapterIndex = getChapterIndexFromDir(dir);
        const chapterNum = workInfo.value?.chapterNum ?? 0;
        const isLastChapterOfBook = chapterNum > 0 && chapterIndex === chapterNum - 1;
        if (isLastChapterOfBook) {
          // 解析失败时最后一章不锁定（无法读取 isFinished）
          console.log(`[QuickEditor] Skip locking last chapter (parse failed): ${dir}`);
        } else {
          const shouldSkipLock = isLastChapterWithContent(chapterIndex);
          if (!shouldSkipLock) {
            lockedDirectories.value.add(dir);
            console.log(`[QuickEditor] Locked chapter directory (parse failed): ${dir}`);
          }
        }
      }
    } else {
      // 其他目录，有内容就锁定
      lockedDirectories.value.add(dir);
    }
  });
};

onMounted(async () => {
  // 初始化作品信息
  await initEditorData();

  // 初始化serverData
  await initServerData();

  // 初始化锁定状态
  initLockedDirectories();

  // 设置当前目录：重新打开页面时，定位到最后一个已锁定的步骤或最后一个有内容的章节
  let targetDir: string | null = null;

  // 策略：找到最后一个已锁定的目录（不包括章节目录）
  const fixedDirs = ["小说纲章.md", "标签.md", "故事梗概.md", "主角设定.md", "大纲.md"];
  let lastLockedDir: string | null = null;

  for (const dir of fixedDirs) {
    if (lockedDirectories.value.has(dir)) {
      lastLockedDir = dir;
    } else {
      // 遇到第一个未锁定的目录，停止
      break;
    }
  }

  // 如果有锁定的目录，先暂定为定位到最后一个锁定的目录
  if (lastLockedDir) {
    targetDir = lastLockedDir;
    console.log("[QuickEditor] Page reopened, last locked directory:", lastLockedDir);
  } else {
    // 如果没有锁定的目录，定位到第一个目录
    targetDir = directories.value[0];
    console.log("[QuickEditor] No locked directories, navigate to first directory:", targetDir);
  }

  // 特殊情况：如果最后锁定的是大纲，检查是否有章节有内容
  if (lastLockedDir === "大纲.md") {
    const chapterDirs = directories.value.filter(
      (dir) => isEpisodeOrChapterDir(dir)
    );
    console.log("[QuickEditor] Checking chapters for values, total chapters:", chapterDirs.length);

    // 找最后一个有值的章节
    for (let i = chapterDirs.length - 1; i >= 0; i--) {
      const dir = chapterDirs[i];
      const hasValue = hasChapterValue(dir);
      // console.log(`[QuickEditor] Chapter ${dir}: hasValue=${hasValue}`);
      if (hasValue) {
        // 如果有章节有内容，定位到该章节，大纲保持锁定状态（不解锁）
        targetDir = dir;
        // console.log("[QuickEditor] Found last chapter with value, keep outline locked:", dir);
        break;
      }
    }
  }

  // 只有当最终定位的目录是最后锁定的目录本身时，才解锁它
  // 如果定位到了章节，说明用户已经往下走了，前面的步骤应该保持锁定
  if (lastLockedDir && targetDir === lastLockedDir) {
    // 解锁最后一个锁定的目录，让用户可以修改或继续
    lockedDirectories.value.delete(lastLockedDir);
    console.log("[QuickEditor] Unlock last locked directory for editing:", lastLockedDir);
  }

  if (targetDir) {
    console.log("[QuickEditor] Initial directory set to:", targetDir);

    // 立即设置滚动锁定，防止Observer在初始化期间干扰
    scrollLock.value = true;

    // 先设置目录（不触发滚动，因为isInitialized还是false）
    currentDirectory.value = targetDir;

    // 等待DOM完全渲染
    nextTick(() => {
      setTimeout(() => {
        // 标记初始化完成
        isInitialized.value = true;

        // 手动触发初始滚动
        if (isSectionVisible(targetDir)) {
          // 执行滚动
          const sectionEl = getSectionElement(targetDir);
          if (sectionEl) {
            console.log("[QuickEditor] Scrolling to initial position:", targetDir);
            sectionEl.scrollIntoView({
              behavior: "smooth",
              block: "start",
              inline: "nearest",
            });
          }

          // 初始化滚动使用更长的锁定时间（1200ms），确保滚动动画完成
          if (scrollLockTimer.value) {
            clearTimeout(scrollLockTimer.value);
          }
          scrollLockTimer.value = setTimeout(() => {
            scrollLock.value = false;
            scrollLockTimer.value = null;
            console.log("[QuickEditor] Initial scroll lock released");
          }, 1200);
        } else {
          // 如果section不可见，直接释放锁定
          scrollLock.value = false;
        }
      }, 500); // 延迟500ms，确保DOM和Observer都准备就绪
    });
  } else {
    // 即使没有找到目标目录，也标记为已初始化
    isInitialized.value = true;
  }

  // 监听窗口大小变化
  window.addEventListener("resize", handleWindowResize);

  // 初始化时更新固定高度的目录
  setTimeout(() => {
    fixedHeightDirectories.forEach((dir) => {
      updateSectionHeight(dir);
    });
  }, 300);

  // 使用Intersection Observer替代scroll事件监听（优化版）
  nextTick(() => {
    setupScrollObserver();
  });
});

onUnmounted(() => {
  // 清理窗口大小监听
  window.removeEventListener("resize", handleWindowResize);

  // 清理滚动监听
  if (contentScrollAreaRef.value) {
    contentScrollAreaRef.value.removeEventListener('scroll', handleScrollStop);
  }

  // 清理Intersection Observer（优化版）
  if (scrollObserver.value) {
    scrollObserver.value.disconnect();
    scrollObserver.value = null;
  }

  // 清理滚动锁定时器
  if (scrollLockTimer.value) {
    clearTimeout(scrollLockTimer.value);
    scrollLockTimer.value = null;
  }

  // 清理Observer防抖定时器
  if (observerDebounceTimer.value) {
    clearTimeout(observerDebounceTimer.value);
    observerDebounceTimer.value = null;
  }

  // 清理滚动停止定时器
  if (scrollStopTimer.value) {
    clearTimeout(scrollStopTimer.value);
    scrollStopTimer.value = null;
  }
});
</script>

<template>
  <div class="page-quick-editor">
    <QuickEditorTopToolbar :hide-feedback="true" :is-script="true" @back-click="handleBackClick" @save-click="handleClickToSave"
      @update-title="handleTitleUpdate" @notes-confirm="handleNotesConfirm" />

    <div class="quick-editor-container">
      <!-- 左侧目录 -->
      <div class="left-sidebar" :class="{ collapsed: !isSidebarExpanded }"
        @click="isSidebarExpanded = !isSidebarExpanded">
        <!-- 展开状态 -->
        <div v-if="isSidebarExpanded" class="sidebar-content">
          <div class="sidebar-header">
            <div class="menu-header-icon">
              <img :src="TITLE_LOGO" alt="菜单栏" class="w-7 h-7 object-cover" />
            </div>
          </div>
          <div class="directory-list" @click.stop>
            <template v-for="(item, index) in displayDirectories" :key="item.dir || `folder-${index}`">
              <!-- 文件夹类型(正文)：仅展开时占满剩余空间，收起时不占底部空白 -->
              <div v-if="item.type === 'folder'" class="directory-folder" :class="{ 'directory-folder--main-text-expanded': item.dir === '正文.md' && isMainTextExpanded }">
                <div class="directory-folder-header" :class="{
                  active:
                    getMainTextFolderState() === 'selected' &&
                    item.children?.some((child) => currentDirectory === child),
                  disabled: getMainTextFolderState() === 'disabled',
                }" @click.stop="
                  getMainTextFolderState() !== 'disabled' &&
                  (isMainTextExpanded = !isMainTextExpanded)
                  " @mouseenter="hoveredDirectory = item.dir!" @mouseleave="hoveredDirectory = null">
                  <img :src="getDirectoryIcon(item.dir!)" alt="" class="directory-icon" />
                  <span class="directory-name">{{ getDirectoryName(item.dir!) }}</span>
                  <img :src="getMainTextFolderArrowIcon()" alt="" class="folder-arrow"
                    :class="{ expanded: isMainTextExpanded }" />
                </div>
                <div v-if="isMainTextExpanded && item.children" class="directory-folder-children">
                  <!-- 正文下所有子目录（起承转合 + 第N集）统一在一个滚动容器内滚动 -->
                  <div ref="mainTextFolderScrollRef" class="directory-folder-children-scroll">
                    <!-- 起承转合分段展示：每个分段都有自己的线和章节列表 -->
                    <template v-if="item.segmentGroups?.length">
                      <div v-for="group in item.segmentGroups" :key="group.label" class="segment-group">
                        <div class="segment-header" @click.stop="toggleSegment(group.label)">
                          <span class="segment-label">{{ group.label }}</span>
                          <img
                            :src="arrowDefaultIcon"
                            alt=""
                            class="folder-arrow segment-arrow"
                            :class="{ expanded: segmentExpanded[group.label] }"
                          />
                        </div>
                        <div v-show="segmentExpanded[group.label]" class="chapter-children-container segment-children">
                          <div class="chapter-line"></div>
                          <div class="chapter-list">
                            <div
                              v-for="childDir in group.children"
                              :key="childDir"
                              class="chapter-item"
                              :data-chapter-dir="childDir"
                              :class="{
                                active: currentDirectory === childDir,
                                disabled: isDirectoryDisabled(childDir, directories.indexOf(childDir)),
                              }"
                              :ref="(el) => setChapterItemRef(el, childDir)"
                              @click.stop="handleDirectoryClick(childDir)"
                            >
                              <span class="chapter-dot" :class="{ active: currentDirectory === childDir }"></span>
                              <span class="chapter-name">{{ getDirectoryName(childDir) }}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </template>
                    <!-- 无分段时平铺章节（单条线） -->
                    <div v-else class="chapter-children-container" ref="chapterChildrenContainerRef">
                      <div class="chapter-line"></div>
                      <div class="chapter-list" ref="chapterListRef">
                        <div
                          v-for="(childDir, childIndex) in item.children"
                          :key="childDir"
                          class="chapter-item"
                          :data-chapter-dir="childDir"
                          :class="{
                            active: currentDirectory === childDir,
                            disabled: isDirectoryDisabled(childDir, directories.indexOf(childDir)),
                          }"
                          :ref="(el) => setChapterItemRef(el, childDir)"
                          @click.stop="handleDirectoryClick(childDir)"
                        >
                          <span class="chapter-dot" :class="{ active: currentDirectory === childDir }"></span>
                          <span class="chapter-name">{{ getDirectoryName(childDir) }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <!-- 普通目录项 -->
              <div v-else-if="item.type === 'item' && item.dir" class="directory-item" :class="{
                active: currentDirectory === item.dir,
                disabled: isDirectoryDisabled(item.dir, directories.indexOf(item.dir)),
              }" @click.stop="handleDirectoryClick(item.dir)" @mouseenter="hoveredDirectory = item.dir"
                @mouseleave="hoveredDirectory = null">
                <img :src="getDirectoryIcon(
                  item.dir,
                  currentDirectory === item.dir
                    ? 'selected'
                    : isDirectoryDisabled(item.dir, directories.indexOf(item.dir))
                      ? 'disabled'
                      : 'default'
                )
                  " alt="" class="directory-icon" />
                <span class="directory-name">{{ getDirectoryName(item.dir) }}</span>
              </div>
            </template>
          </div>
        </div>
        <!-- 关闭状态 -->
        <div v-else class="sidebar-collapsed">
          <div class="collapsed-icon-list" @click.stop>
            <div class="collapsed-menu-icon-wrapper" @click.stop="isSidebarExpanded = true">
              <div class="menu-header-icon">
                <img :src="TITLE_LOGO" alt="菜单栏" class="w-7 h-7 object-cover" />
            </div>
            </div>
            <template v-for="(item, index) in displayDirectories" :key="item.dir || `folder-${index}`">
              <!-- 文件夹类型(正文) -->
              <div v-if="item.type === 'folder'" class="collapsed-folder" :class="{
                active: item.children?.some((child) => currentDirectory === child),
              }" @click.stop="handleCollapsedFolderClick(item.dir!, item.children)">
                <img :src="getDirectoryIcon(item.dir!)" alt="" class="collapsed-icon" />
              </div>
              <!-- 普通目录项 -->
              <div v-else-if="item.type === 'item' && item.dir" class="collapsed-icon-item" :class="{
                active: currentDirectory === item.dir,
              }" @click.stop="handleDirectoryClick(item.dir)">
                <img :src="getDirectoryIcon(item.dir)" alt="" class="collapsed-icon" />
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- 右侧内容区域 -->
      <div class="right-content" ref="rightContentRef">
        <div class="content-scroll-area" ref="contentScrollAreaRef">
          <!-- 显示所有目录的内容块 -->
          <div v-for="dir in directories" :key="dir" class="content-section" :id="`section-${getDirectoryName(dir)}`"
            :class="{
              'section-active': currentDirectory === dir,
              'section-fixed-height': fixedHeightDirectories.includes(dir),
              'section-visible': isSectionVisible(dir),
              'section-chapter-outer': isEpisodeOrChapterDir(dir),
            }">
            <!-- 小说纲章 -->
            <div v-if="dir === '小说纲章.md'" class="section-content">
              <ScriptNovelOutlineChapter :novel-content="serverData['小说纲章.md'] || ''"
                :locked="lockedDirectories.has('小说纲章.md')" :has-next-content="hasNextDirectoryContent('小说纲章.md')"
                @confirm="handleNovelOutlineConfirm" @revert="handleNovelOutlineRevert"
                @revert-to-current="() => handleRevertToCurrentStep('小说纲章.md')" />
            </div>
            <!-- 标签选择 -->
            <div v-else-if="dir === '标签.md'" class="section-content">
              <ScriptTagSelector :selected-tag-ids="tagSelectorTagIds" :synopsis="tagSelectorSynopsis"
                :description="tagSelectorDescription" :novel-plot="tagSelectorNovelPlot" :trigger-generate="tagGenerateTrigger"
                :locked="lockedDirectories.has('标签.md')" :has-next-content="hasNextDirectoryContent('标签.md')"
                @confirm="handleTagConfirm" @revert="handleTagRevert"
                @revert-to-current="() => handleRevertToCurrentStep('标签.md')" />
            </div>

            <!-- 故事梗概选择 -->
            <div v-else-if="dir === '故事梗概.md'" class="section-content">
              <ScriptStorySelector
              :novel-plot="tagSelectorNovelPlot" :description="tagSelectorDescription"
                :novel-plot-skipped="novelPlotSkipped"
                :story-content="serverData['故事梗概.md'] || ''" :locked="lockedDirectories.has('故事梗概.md')"
                :has-next-content="hasNextDirectoryContent('故事梗概.md')" :trigger-generate="storyGenerateTrigger"
                @confirm="handleStoryConfirm" @revert="handleStoryRevert"
                @revert-to-current="() => handleRevertToCurrentStep('故事梗概.md')"
                @error-and-revert="handleErrorAndRevert" />
            </div>

            <!-- 主角设定选择 -->
            <div v-else-if="dir === '主角设定.md'"

            class="section-content">
              <ScriptCharacterSelector :selected-tag-ids="serverData['标签.md'] || ''"
              :novel-plot="tagSelectorNovelPlot" :description="tagSelectorDescription"
                :story-content="serverData['故事梗概.md'] || ''" :character-content="serverData['主角设定.md'] || ''"
                :locked="lockedDirectories.has('主角设定.md')" :has-next-content="hasNextDirectoryContent('主角设定.md')"
                :trigger-generate="characterGenerateTrigger" @confirm="handleCharacterConfirm"
                @revert="handleCharacterRevert" @revert-to-current="() => handleRevertToCurrentStep('主角设定.md')"
                @error-and-revert="handleErrorAndRevert" />
            </div>

            <!-- 大纲编辑 -->
            <div v-else-if="dir === '大纲.md'" class="section-content">
              <ScriptOutlineEditor
                :story-content="serverData['故事梗概.md'] || ''"
                :character-content="serverData['主角设定.md'] || ''"
                :outline-content="serverData['大纲.md'] || ''"
                :outline-segments="outlineSegmentList"
                :novel-plot="tagSelectorNovelPlot"
                :description="tagSelectorDescription"
                :episode-num="tagSelectorEpisodeNum"
                :locked="lockedDirectories.has('大纲.md')"
                :has-next-content="hasNextDirectoryContent('大纲.md')"
                :trigger-generate="outlineGenerateTrigger"
                @split-ready="handleOutlineSplitReady"
                @confirm="handleOutlineConfirm"
                @revert="handleOutlineRevert"
                @revert-to-current="() => handleRevertToCurrentStep('大纲.md')"
                @error-and-revert="handleErrorAndRevert"
              />
            </div>

            <!-- 章节内容编辑 -->
            <div v-else-if="isEpisodeOrChapterDir(dir)" class="section-content section-chapter">
              <ScriptChapterEditor :key="dir" :ref="(el: any) => {
                if (el) {
                  chapterEditorRefs.set(dir, el);
                } else {
                  chapterEditorRefs.delete(dir);
                }
              }" :chapter-index="getChapterIndexFromDir(dir)"
                :chapter-data="getChapterDataFromOutline(getChapterIndexFromDir(dir))"
                :chapter-content="serverData[dir] || ''" :episode-num="tagSelectorEpisodeNum"
                :locked="lockedDirectories.has(dir)"
                :is-last-chapter-with-content="isLastChapterWithContent(getChapterIndexFromDir(dir))
                  " :previous-chapter-index="getPreviousChapterIndex(getChapterIndexFromDir(dir))"
                :has-next-content="hasNextDirectoryContent(dir)" :work-title="workInfo?.title || ''" @confirm="
                  (data) => {
                    const index = getChapterIndexFromDir(dir);
                    console.log(
                      '[QuickEditor] confirm event from dir:',
                      dir,
                      'chapterIndex:',
                      index
                    );
                    handleChapterConfirm(index, data);
                  }
                " @revert="() => handleChapterRevert(getChapterIndexFromDir(dir))"
                @revert-to-note="() => handleChapterRevertToNote(getChapterIndexFromDir(dir))"
                @update-chapter-note="
                  (note) => handleChapterNoteUpdate(getChapterIndexFromDir(dir), note)
                " @generate-content="() => handleChapterGenerateContent(getChapterIndexFromDir(dir))"
                @continue-next-chapter="
                  () => handleChapterContinueNext(getChapterIndexFromDir(dir))
                " @revert-to-current="() => handleRevertToCurrentStep(dir)" />
            </div>

            <!-- 其他目录的内容占位 -->
            <div v-else class="placeholder-content">
              <p>{{ getDirectoryName(dir) }} 内容待实现</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.page-quick-editor {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-editor);
  color: var(--text-primary);
  overflow: hidden;

  .quick-editor-container {
    flex: 1;
    display: flex;
    flex-direction: row;
    overflow: hidden;
    height: calc(100vh - 56px);
    background: var(--bg-editor);
    position: relative;
  }

  // 左侧目录
  .left-sidebar {
    width: 352px;
    background: var(--bg-editor);
    display: flex;
    flex-direction: column;
    transition: all 0.3s ease;
    position: relative;

    // &.collapsed {
    //   width: 184px;
    // }

    .sidebar-content {
      display: flex;
      flex-direction: column;
      margin-left: 49px;
      margin-top: 87px;
      width: 258px;
      // 移除固定 min-height，让容器根据内容和视口完全自适应
      max-height: calc(100vh - 87px - 56px - 40px); // 限制最大高度，自适应视口
      background: #f3f3f3;
      border-radius: 45px;
      padding: 24px 0 22px 0;
      box-sizing: border-box;
      overflow: hidden; // 外层不滚动
    }

    .sidebar-header {
      display: flex;

      width: 100%;
      height: 48px;
      margin-bottom: 22px;
      padding: 0 17px;
      box-sizing: border-box;

      .menu-header-icon {
        width: 48px;
        height: 48px;
        margin-left: 5px;
        object-fit: contain;
      }
    }

    .directory-list {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      width: 220px;
      margin: 0 auto;
      padding: 0;
      overflow: hidden; // 外层主目录不滚动，仅正文子目录区域可滚动
    }

    .directory-folder {
      margin-bottom: 10px;
      width: 100%;

      /* 正文文件夹仅在展开时占满剩余空间，收起时只占标题一行 */
      &.directory-folder--main-text-expanded {
        flex: 1 1 0;
        min-height: 240px; // 保证展开后至少有一定高度，正文可见且可滚动
        display: flex;
        flex-direction: column;
        margin-bottom: 0;

        .directory-folder-header {
          flex-shrink: 0;
        }
      }

      .directory-folder-header {
        display: flex;
        align-items: center;
        padding: 0 8px;
        height: 40px;
        cursor: pointer;
        border-radius: 5px;
        transition: all 0.2s ease;
        position: relative;

        .directory-icon {
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          margin-right: 10px;
        }

        .directory-name {
          flex: 1;
          font-size: 18px;
          font-weight: 400;
          color: #464646;
          white-space: nowrap;
          transition: all 0.2s ease;
        }

        .folder-arrow {
          width: 15px;
          height: 7px;
          flex-shrink: 0;
          object-fit: contain;
          transform: rotate(0deg);
          transition: transform 0.2s ease;
          margin-left: 10px;
        }

        .folder-arrow.expanded {
          transform: rotate(180deg);
        }

        &:hover:not(.disabled) {
          background-color: #f8f3df;
        }

        &.active:not(.disabled) {
          background-color: #f8f3df;

          .directory-name {
            background: linear-gradient(90deg, rgba(239, 175, 0, 1) 0%, rgba(255, 149, 0, 1) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            font-weight: 700;
            font-size: 20px;
          }
        }

        &.disabled {
          cursor: not-allowed;

          .directory-icon {
            opacity: 1;
          }

          .directory-name {
            color: #999999;
          }

          .folder-arrow {
            opacity: 1;
          }

          &:hover {
            background-color: transparent;
            cursor: not-allowed;
          }
        }
      }

      .directory-folder-children {
        padding: 0;
        width: 100%;
        flex: 1 1 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }

      /* 正文展开后，下方子目录（起承转合 + 第N集）占满剩余空间、仅此区域可滚动，可滚到底部 */
      .directory-folder-children-scroll {
        padding: 5px 10px 24px 14px;
        flex: 1 1 0;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        -ms-overflow-style: none;
        &::-webkit-scrollbar {
          display: none;
        }
      }

      .segment-group {
        margin-bottom: 4px;
      }

      .segment-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 4px 0 6px 8px;
        cursor: pointer;
        user-select: none;
        color: #666;
        font-size: 13px;

        &:hover {
          color: #333;
        }
      }

      .segment-label {
        font-weight: 500;
      }

      .segment-arrow {
        width: 12px;
        height: 12px;
        transition: transform 0.2s;

        &.expanded {
          transform: rotate(180deg);
        }
      }

      .segment-children {
        padding-left: 0;
      }

      .chapter-children-container {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        width: 100%;
        min-height: 50px;
        // 不再单独限制高度与滚动，由外层 .directory-folder-children-scroll 统一滚动
      }

      .chapter-line {
        width: 1px;
        background-color: #e2e2e2;
        margin: 10px 0 14px 13px; // 底部留小间距即可，避免与下一段（承转合）空一大块
        pointer-events: none;
        align-self: stretch;
        z-index: 0;
      }

      .chapter-list {
        display: flex;
        flex-direction: column;
        flex: 1;
        box-sizing: border-box;
        padding-left: 5px;
        margin-left: -5px;
        padding-bottom: 8px; // 段内底部留白，避免与下一段空一大块
        // 不再单独设置 max-height 与 overflow，由外层统一滚动容器滚动
      }

      .chapter-item {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: flex-start;
        width: 100%;
        height: 21px;
        margin-bottom: 10px;
        cursor: pointer;
        overflow: visible;
        position: relative;
        box-sizing: border-box;

        // 移除最后一个章节的 margin-bottom，避免多余的滚动空间
        &:last-child {
          margin-bottom: 0px;
        }

        .chapter-dot {
          transform: translateX(-4.5px);
          width: 8px;
          height: 8px;
          border-radius: 50%;
          z-index: 100;
          flex-shrink: 0;
        }

        .chapter-dot.active {
          background-color: #ffc227;
        }

        .chapter-name {
          font-size: 16px;
          margin-left: 22px;
          font-weight: 400;
          line-height: 1.31982421875em;
          text-align: left;
          white-space: nowrap;
          transition: all 0.2s ease;
          width: 100%;
        }

        &.active {
          .chapter-name {
            color: #ffc227;
            font-weight: 700;
          }
        }

        &.disabled {
          cursor: not-allowed;

          .chapter-name {
            color: #e2e2e2;
          }

          &:hover {
            cursor: not-allowed;
          }
        }

        &:not(.disabled):not(.active) {
          .chapter-name {
            color: #999999;
          }
        }
      }
    }

    .directory-item {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      padding: 0 8px;
      height: 40px;
      margin-bottom: 22px;
      cursor: pointer;
      border-radius: 5px;
      transition: all 0.2s ease;
      position: relative;

      .directory-icon {
        width: 40px;
        height: 40px;
        flex-shrink: 0;
        margin-right: 10px;
      }

      .directory-name {
        flex: 1;
        font-size: 18px;
        font-weight: 400;
        color: #464646;
        white-space: nowrap;
        transition: all 0.2s ease;
      }

      // 悬浮效果
      &:hover:not(.disabled) {
        background-color: #f8f3df;
      }

      // 选中效果
      &.active:not(.disabled) {
        background-color: #f8f3df;

        .directory-name {
          background: linear-gradient(90deg, rgba(239, 175, 0, 1) 0%, rgba(255, 149, 0, 1) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-weight: 700;
          font-size: 20px;
        }
      }

      &.disabled {
        opacity: 0.5;
        cursor: not-allowed;

        &:hover {
          background-color: transparent;
        }
      }

      &.directory-child {
        padding-left: 48px;
        margin-bottom: 0;
      }
    }

    // 关闭状态
    .sidebar-collapsed {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 90px;
      height: 431px;
      margin-left: 49px;
      margin-top: 127px;
      padding: 24px 0;
      background: #f3f3f3;
      border-radius: 45px;
      box-sizing: border-box;

      .collapsed-icon-list {
        display: flex;
        width: 56px;
        height: 358px;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
      }

      .collapsed-menu-icon-wrapper {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .collapsed-menu-icon {
        width: 48px;
        height: 48px;
        object-fit: contain;
      }

      .collapsed-icon-item,
      .collapsed-folder {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        border-radius: 5px;
        transition: all 0.2s ease;

        &:hover {
          background-color: #f8f3df;
        }

        &.active {
          background-color: #f8f3df;
        }

        .collapsed-icon {
          width: 40px;
          height: 40px;
          object-fit: contain;
          display: block;
        }
      }
    }
  }

  // 右侧内容区域
  .right-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg-editor);

    .content-scroll-area {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      min-height: 100%;

      // 保持auto让原生滚轮流畅，JS调用时单独指定smooth
      scroll-behavior: auto;

      // 使用proximity让吸附更柔和，在滚动停止时自然吸附
      scroll-snap-type: y proximity;

      // 优化滚动性能
      -webkit-overflow-scrolling: touch; // iOS平滑滚动
      overscroll-behavior-y: contain; // 防止滚动传播

      // 添加滚动平滑过渡（仅影响吸附效果，不影响滚轮响应）
      scroll-padding-top: 0px;
    }

    .content-section {
      display: none; // 默认隐藏
      flex-direction: column;
      height: calc(100vh - 56px); // 减去顶部工具栏高度
      flex-shrink: 0;
      scroll-snap-align: start;
      scroll-snap-stop: normal; // 允许快速滚动跳过多个section

      // 性能优化：减少重绘
      contain: layout style paint;

      // 只显示已锁定的目录和下一个未锁定的目录
      &.section-visible {
        display: flex;
      }

      &.section-fixed-height {
        // 固定高度的内容块，高度由JS动态设置
        overflow: hidden;
      }

      // 章节编辑器外层：最小高度保证吸附，但允许内容扩展
      &.section-chapter-outer {
        height: auto !important; // 覆盖基类的固定高度
        min-height: calc(100vh - 56px); // 改为min-height，内容超出时不截断
        overflow: visible; // visible，让内容自然展开
        position: relative;
      }

      .section-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        width: 100%;
        overflow: hidden; // hidden，让内部组件的滚动区域正常工作

        // 章节编辑器特殊处理：高度自适应，完整展示所有内容
        &.section-chapter {
          height: auto; // auto，让内容完整显示
          min-height: calc(100vh - 56px); // 最小高度保证吸附点
          overflow: visible; // visible，不截断章节内容
        }
      }
    }

    .placeholder-content {
      padding: 40px;
      text-align: center;
      color: var(--text-secondary);
      min-height: 100vh;
    }
  }
}
</style>

<style lang="less">
// 全局样式：回退确认弹窗
.revert-confirm-dialog {
  width: min(420px, calc(100vw - 32px));
  border-radius: 8px;
  padding: 24px;

  .el-message-box__header {
    padding: 0;
  }

  .el-message-box__title {
    font-size: 18px;
    font-weight: 600;
    line-height: 1;
  }

  .el-message-box__content {
    padding: 0;
    margin-top: 16px;
  }

  .el-message-box__message {
    font-size: 14px;
    text-align: left;
    line-height: 1.5;
  }

  .el-message-box__message p {
    margin: 0;
    color: var(--text-secondary);
  }

  .el-message-box__btns .el-button--primary {
    background-color: var(--theme-color);
    border-color: var(--theme-color);
    color: #fff;

    &:hover {
      background-color: var(--theme-color);
      border-color: var(--theme-color);
      opacity: 0.9;
    }
  }

  .el-message-box__btns {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 0;
    margin-top: 16px;
  }

  .el-message-box__btns .el-button {
    min-width: 64px;
    height: 36px;
    margin-left: 0;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
  }

  .el-message-box__btns .el-button:not(.el-button--primary) {
    border-color: var(--border-color);
    color: var(--text-primary);
    background: var(--bg-color);
  }
}
</style>
