import { ElMessage } from "element-plus";
import { EDITOR_WORK_INFO_CACHE_KEY, getWorkInfoCacheKey, SELECTED_NODE_CACHE_PREFIX } from "./constant";
import storageManager from "./storage";

// 复制到剪贴板
const copyToClipboard = async (content: string) => {
  try {
    await navigator.clipboard.writeText(content);
    ElMessage.success("复制成功");
  } catch (err) {
    // 如果现代API不可用，使用传统方法
    try {
      const textArea = document.createElement("textarea");
      textArea.value = content;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      ElMessage.success("复制成功");
    } catch (fallbackErr) {
      console.error("复制失败:", fallbackErr);
      ElMessage.error("复制失败");
    }
  }
};

export { copyToClipboard };

/**
 * 保存作品信息到存储（支持自动降级）
 * @param files - 作品信息对象
 * @param workId - 作品ID（可选）
 * @returns 是否保存成功
 */
export const saveWorkInfoToLocalStorage = (files: Record<string, any>, workId?: string): boolean => {
  const cacheKey = workId ? getWorkInfoCacheKey(workId) : EDITOR_WORK_INFO_CACHE_KEY;

  try {
    return storageManager.setItem(cacheKey, files);
  } catch (error) {
    console.error("保存作品信息失败:", error);
    return false;
  }
};

/**
 * 从存储获取作品信息（支持自动降级）
 * @param workId - 作品ID（可选）
 * @returns 作品信息对象，如果不存在则返回空对象
 */
export const getWorkInfoFromLocalStorage = (workId?: string): Record<string, any> => {
  const cacheKey = workId ? getWorkInfoCacheKey(workId) : EDITOR_WORK_INFO_CACHE_KEY;

  try {
    const result = storageManager.getItem<Record<string, any>>(cacheKey, {});
    return result ?? {};
  } catch (error) {
    console.error("获取作品信息失败:", error);
    return {};
  }
};

/**
 * 清除指定作品的缓存信息
 * @param workId - 作品ID（可选）
 */
export const clearWorkInfoFromLocalStorage = (workId?: string): void => {
  const cacheKey = workId ? getWorkInfoCacheKey(workId) : EDITOR_WORK_INFO_CACHE_KEY;
  storageManager.removeItem(cacheKey);
};

/**
 * 清除指定作品的所有相关缓存
 * 包括：编辑器缓存、选中节点缓存、聊天会话缓存
 * @param workId - 作品ID
 * @returns 清除的缓存数量
 */
export const clearWorkRelatedCaches = (workId: string): number => {
  if (!workId) {
    console.warn('[clearWorkRelatedCaches] workId is required');
    return 0;
  }

  let clearedCount = 0;
  const keysToRemove: string[] = [];

  try {
    // 1. 编辑器作品信息缓存
    const workInfoKey = getWorkInfoCacheKey(workId);
    keysToRemove.push(workInfoKey);

    // 2. 选中节点缓存
    const selectedNodeKey = `${SELECTED_NODE_CACHE_PREFIX}${workId}`;
    keysToRemove.push(selectedNodeKey);

    // 3. 聊天会话相关缓存（faq 和 chat 两种类型）
    const chatSessionsFaqKey = `chatSessions_${workId}_faq`;
    const chatSessionsChatKey = `chatSessions_${workId}_chat`;
    const currentSessionFaqKey = `currentSession_${workId}_faq`;
    const currentSessionChatKey = `currentSession_${workId}_chat`;
    keysToRemove.push(chatSessionsFaqKey, chatSessionsChatKey, currentSessionFaqKey, currentSessionChatKey);

    // 执行清除
    keysToRemove.forEach(key => {
      try {
        const existingValue = localStorage.getItem(key);
        if (existingValue !== null) {
          localStorage.removeItem(key);
          clearedCount++;
          console.log(`[clearWorkRelatedCaches] Removed cache: ${key}`);
        }
      } catch (error) {
        console.error(`[clearWorkRelatedCaches] Failed to remove ${key}:`, error);
      }
    });

    console.log(`[clearWorkRelatedCaches] Cleared ${clearedCount} caches for work ${workId}`);
    return clearedCount;
  } catch (error) {
    console.error('[clearWorkRelatedCaches] Error:', error);
    return clearedCount;
  }
};

/**
 * 批量清除多个作品的所有相关缓存
 * @param workIds - 作品ID数组
 * @returns 清除的缓存总数
 */
export const clearMultipleWorksRelatedCaches = (workIds: string[]): number => {
  if (!Array.isArray(workIds) || workIds.length === 0) {
    console.warn('[clearMultipleWorksRelatedCaches] workIds array is required');
    return 0;
  }

  let totalCleared = 0;
  workIds.forEach(workId => {
    if (workId) {
      totalCleared += clearWorkRelatedCaches(workId);
    }
  });

  console.log(`[clearMultipleWorksRelatedCaches] Total cleared ${totalCleared} caches for ${workIds.length} works`);
  return totalCleared;
};

/**
 * 清理除了指定作品ID列表之外的所有作品相关缓存
 * 用于在首次加载作品列表时，只保留第一页可见作品的缓存，清理其他所有作品的缓存
 * @param keepWorkIds - 需要保留的作品ID数组（字符串数组）
 * @returns 清除的缓存总数
 */
export const clearWorksCachesExcept = (keepWorkIds: string[]): number => {
  if (!Array.isArray(keepWorkIds)) {
    console.warn('[clearWorksCachesExcept] keepWorkIds must be an array');
    return 0;
  }

  // 将保留的ID转换为Set以便快速查找
  const keepWorkIdsSet = new Set(keepWorkIds.map(id => String(id)));

  let totalCleared = 0;
  const keysToRemove: string[] = [];

  try {
    // 遍历所有localStorage键，找出作品相关的缓存
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      let workId: string | null = null;

      // 检查是否是作品信息缓存
      if (key.startsWith('editor_work_info_cache_')) {
        workId = key.replace('editor_work_info_cache_', '');
      }
      // 检查是否是选中节点缓存
      else if (key.startsWith('work_selected_node_')) {
        workId = key.replace('work_selected_node_', '');
      }
      // 检查是否是聊天会话缓存
      else if (key.startsWith('chatSessions_') || key.startsWith('currentSession_')) {
        // 匹配格式：chatSessions_{workId}_chat 或 currentSession_{workId}_faq
        const match = key.match(/^(chatSessions|currentSession)_(.+?)_(chat|faq)$/);
        if (match) {
          workId = match[2];
        }
      }

      // 如果找到了作品ID，且不在保留列表中，则标记为删除
      if (workId && !keepWorkIdsSet.has(workId)) {
        keysToRemove.push(key);
      }
    }

    // 执行删除
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
        totalCleared++;
      } catch (error) {
        console.error(`[clearWorksCachesExcept] Failed to remove ${key}:`, error);
      }
    });

    console.log(
      `[clearWorksCachesExcept] Cleared ${totalCleared} caches, ` +
      `kept ${keepWorkIds.length} works (${keepWorkIds.join(', ')})`
    );

    return totalCleared;
  } catch (error) {
    console.error('[clearWorksCachesExcept] Error:', error);
    return totalCleared;
  }
};

/**
 * 清理所有旧的会话缓存（chatSessions 和 currentSession）
 * 由于已改为从接口获取会话数据，localStorage中的会话缓存已过期
 * 此函数用于一次性清理所有旧的会话缓存数据
 * @returns 清除的缓存数量
 */
export const clearAllLegacySessionCaches = (): number => {
  let clearedCount = 0;
  const keysToRemove: string[] = [];

  try {
    // 遍历所有localStorage键，找出会话相关的缓存
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      // 匹配所有会话相关的缓存键
      if (key.startsWith('chatSessions_') || key.startsWith('currentSession_')) {
        keysToRemove.push(key);
      }
    }

    // 执行清除
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
        clearedCount++;
        console.log(`[clearAllLegacySessionCaches] Removed: ${key}`);
      } catch (error) {
        console.error(`[clearAllLegacySessionCaches] Failed to remove ${key}:`, error);
      }
    });

    if (clearedCount > 0) {
      console.log(`[clearAllLegacySessionCaches] ✅ Cleared ${clearedCount} legacy session caches`);
    } else {
      console.log('[clearAllLegacySessionCaches] No legacy session caches found');
    }

    return clearedCount;
  } catch (error) {
    console.error('[clearAllLegacySessionCaches] Error:', error);
    return clearedCount;
  }
};

/**
 * 检查localStorage使用情况并在必要时自动清理
 * @param threshold - 触发清理的使用率阈值（默认80%）
 * @param cleanupCount - 每次清理的最大作品缓存数量（默认3个）
 * @param logPrefix - 日志前缀（默认'[checkAndCleanupStorage]'）
 * @param maxIterations - 最大清理迭代次数，防止无限循环（默认5次）
 * @returns 是否执行了清理操作
 */
export const checkAndCleanupStorage = (
  threshold: number = 80,
  cleanupCount: number = 3,
  logPrefix: string = '[checkAndCleanupStorage]',
  maxIterations: number = 5
): boolean => {
  try {
    let iteration = 0;
    let hasCleaned = false;

    while (iteration < maxIterations) {
      const storageInfo = storageManager.getStorageInfo();

      if (!storageInfo) {
        console.warn(`${logPrefix} Storage info not available`);
        return hasCleaned;
      }

      const usagePercentage = storageInfo.percentage;

      // 只在第一次迭代时打印详细信息
      if (iteration === 0) {
        console.log(
          `${logPrefix} localStorage usage: ${usagePercentage.toFixed(2)}% ` +
          `(${(storageInfo.used / 1024 / 1024).toFixed(2)}MB / ${(storageInfo.total / 1024 / 1024).toFixed(2)}MB)`
        );
      }

      // 如果使用率超过阈值，主动清理最大的作品缓存
      if (usagePercentage > threshold) {
        console.warn(
          `${logPrefix} localStorage usage is high (${usagePercentage.toFixed(2)}%), ` +
          `cleaning up (iteration ${iteration + 1}/${maxIterations})...`
        );

        const clearedCount = storageManager.cleanupLargestWorkCaches(cleanupCount);
        hasCleaned = true;

        if (clearedCount === 0) {
          console.warn(`${logPrefix} No more caches to clean, stopping cleanup`);
          break;
        }

        console.log(`${logPrefix} Cleaned up ${clearedCount} caches to free space`);

        // 再次检查使用情况
        const newStorageInfo = storageManager.getStorageInfo();
        if (newStorageInfo) {
          const newPercentage = newStorageInfo.percentage;
          console.log(
            `${logPrefix} After cleanup: ${newPercentage.toFixed(2)}% ` +
            `(${(newStorageInfo.used / 1024 / 1024).toFixed(2)}MB)`
          );

          // 如果清理后仍然超过阈值，继续清理
          if (newPercentage <= threshold) {
            console.log(`${logPrefix} Storage usage is now below threshold, cleanup complete`);
            break;
          }
        }

        iteration++;
      } else {
        // 使用率正常，退出循环
        if (iteration > 0) {
          console.log(`${logPrefix} Storage usage is now below threshold after cleanup`);
        }
        break;
      }
    }

    if (iteration >= maxIterations) {
      console.warn(
        `${logPrefix} Reached max iterations (${maxIterations}), ` +
        `storage may still be above threshold. Consider manual cleanup.`
      );
    }

    return hasCleaned;
  } catch (error) {
    console.error(`${logPrefix} Failed to check storage usage:`, error);
    return false;
  }
};

/**
 * 获取存储使用情况
 */
export const getStorageUsage = () => {
  const info = storageManager.getStorageInfo();
  const storageType = storageManager.getStorageType();

  return {
    type: storageType,
    info,
  };
};

/**
 * 将转义字符转换为实际字符
 * 适用于：处理包含转义字符的文本（如 \\\n, \\t, \\r, \\\\）
 *
 * @param text - 包含转义字符的文本
 * @returns 转换后的文本（转义字符转换为实际字符）
 *
 * @example
 * unescapeCharacters('文本1\\n文本2') // '文本1\n文本2'
 */
export const unescapeCharacters = (text: string): string => {
  return text
    // 先处理转义字符（必须在处理Markdown符号之前）
    // 将字面的转义序列转换为实际字符
    // 注意：必须先处理较长的序列（如 \\\n），再处理较短的序列（如 \\）
    // ✅ 修复：处理各种转义字符组合，注意顺序很重要
    // 1. 先处理 \\\n（字面的两个反斜杠加n，在字符串中是 \\n）
    .replace(/\\\\n/g, '\n')  // 转义的换行符 \\\n -> \n（匹配字面的两个反斜杠加n）
    // 2. 再处理 \\（字面的两个反斜杠，在字符串中是 \）
    .replace(/\\\\/g, '\\')   // 转义的反斜杠 \\\\ -> \（匹配字面的两个反斜杠）
    // 3. 最后处理单个转义字符（\n, \t, \r等）
    .replace(/\\n/g, '\n')     // 转义的换行符 \n -> \n（匹配字面的一个反斜杠加n）
    .replace(/\\t/g, '\t')     // 转义的制表符 \t -> 制表符
    .replace(/\\r/g, '\r');    // 转义的回车符 \r -> 回车符
};

   // 辅助函数：去除所有 Markdown 符号，得到纯文本
 export  const removeAllMarkdownSymbols = (text: string): string => {
    // 首先处理转义字符（如果是从 JSON 字符串字面量中来的）
    let processed = unescapeCharacters(text);

    // ✅ 优先处理 Markdown 硬换行符（反斜杠 + 换行符 或 行末的单个反斜杠）
    // 在 Markdown 中，行末的反斜杠表示硬换行，在编辑器中会被转换为换行符或被移除
    // 注意：这里处理的是实际的反斜杠字符，而不是转义序列
    processed = processed
      .replace(/\\(\r?\n)/g, '$1')  // 反斜杠+换行 -> 换行（移除反斜杠，保留换行）
      .replace(/\\$/gm, '')         // 行末的单独反斜杠 -> 空（移除行末反斜杠）
      // 移除标题标记
      .replace(/^#{1,6}\s+/gm, '')
      // 移除粗体和斜体标记
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      // 移除代码块标记，保留内容
      .replace(/```[\w]*\n([\s\S]*?)```/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      // 移除链接，保留文本
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // 移除图片
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
      // 移除列表标记
      .replace(/^[\s]*[-*+]\s+/gm, '')
      .replace(/^[\s]*\d+\.\s+/gm, '')
      // 移除引用标记
      .replace(/^>\s*/gm, '')
      // 移除水平线
      .replace(/^[-*_]{3,}$/gm, '')
      // 移除删除线
      .replace(/~~(.*?)~~/g, '$1')
      // 规范化空白字符（多个空白字符替换为单个空格，但保留换行符）
      .replace(/[ \t]+/g, ' ')
      .trim();

    return processed;
  };

/**
 * 移除 Markdown 符号并压缩连续换行符（用于面板显示）
 * 与 removeAllMarkdownSymbols 的区别：会将多个连续换行符压缩成一个，避免空行过大
 * @param text - 原始文本
 * @returns 处理后的文本
 */
export const removeMarkdownSymbolsForPanel = (text: string): string => {
  // 先使用原函数移除 markdown 符号
  let processed = removeAllMarkdownSymbols(text);

  // ✅ 将多个连续换行符（2个或更多）压缩成一个换行符，避免空行过大
  // 保留单个换行符，但将多个连续换行符压缩成一个
  processed = processed.replace(/\n{2,}/g, '\n');

  return processed;
};

/**
 * 文本格式统一处理工具函数集合
 * 用于在不同场景下统一处理文本格式，确保匹配准确性
 */

/**
 * 将HTML标签转换为换行符，用于匹配编辑器内容
 * 适用于：originContent、old_string等包含HTML标签的内容
 *
 * @param text - 包含HTML标签的文本
 * @returns 转换后的纯文本（HTML标签转换为换行符）
 *
 * @example
 * normalizeHtmlToNewlines('<p>段落1</p><p>段落2</p>') // '段落1\n段落2'
 */
export const normalizeHtmlToNewlines = (text: string): string => {
  return text
    .replace(/<\/p>\s*<p>/g, '\n\n')  // </p><p> -> \n\n（段落分隔）
    .replace(/<\/p>/g, '\n')          // </p> -> \n（段落结束）
    .replace(/<p>/g, '')               // <p> -> 空（段落开始不需要额外换行）
    .replace(/<br\s*\/?>/gi, '\n')     // <br> -> \n（换行标签）
    .replace(/<\/?[^>]+(>|$)/g, "");   // 清理其他HTML标签
};

/**
 * 去除HTML标签，保留纯文本
 * 适用于：new_string、old_string等需要去除HTML标签的场景
 *
 * @param text - 可能包含HTML标签的文本
 * @returns 去除HTML标签后的纯文本
 *
 * @example
 * removeHtmlTags('<p>文本</p>') // '文本'
 */
export const removeHtmlTags = (text: string): string => {
  return text.replace(/<\/?[^>]+(>|$)/g, "").trim();
};

/**
 * 去除HTML标签并trim
 * 适用于：需要清理文本并去除首尾空白的场景
 *
 * @param text - 可能包含HTML标签的文本
 * @returns 清理后的文本
 */
export const cleanText = (text: string): string => {
  return removeHtmlTags(text);
};

/**
 * 统一换行符处理：将换行符转换为空格
 * 适用于：面板匹配验证、内容比较等需要忽略换行符差异的场景
 *
 * @param text - 可能包含换行符的文本
 * @returns 换行符转换为空格后的文本
 *
 * @example
 * normalizeNewlinesToSpaces('文本1\n文本2') // '文本1 文本2'
 */
export const normalizeNewlinesToSpaces = (text: string): string => {
  return text.replace(/\n/g, " ").trim();
};

/**
 * 去除所有换行符
 * 适用于：内容比较时需要完全忽略换行符的场景
 *
 * @param text - 可能包含换行符的文本
 * @returns 去除所有换行符后的文本
 *
 * @example
 * removeNewlines('文本1\n文本2') // '文本1文本2'
 */
export const removeNewlines = (text: string): string => {
  return text.replace(/\n/g, "");
};

/**
 * 去除所有换行符和回车符
 * 适用于：需要同时去除 \n 和 \r 的场景
 *
 * @param text - 可能包含换行符和回车符的文本
 * @returns 去除所有换行符和回车符后的文本
 *
 * @example
 * removeNewlinesAndCarriageReturns('文本1\n文本2\r文本3') // '文本1文本2文本3'
 */
export const removeNewlinesAndCarriageReturns = (text: string): string => {
  return text.replace(/[\n\r]/g, "");
};

/**
 * 将文本转换为正则表达式，允许换行符匹配空格或空格序列
 * 适用于：在编辑器文本中搜索时，允许换行符和空格的灵活匹配
 *
 * @param text - 要转换的文本
 * @returns 转换后的正则表达式字符串（需要配合 new RegExp() 使用）
 *
 * @example
 * const regexStr = textToFlexibleRegex('文本1\n文本2');
 * const regex = new RegExp(regexStr);
 * // 可以匹配 '文本1 文本2' 或 '文本1\n文本2' 等
 */
export const textToFlexibleRegex = (text: string): string => {
  const PLACEHOLDER = '___NEWLINE_PLACEHOLDER___';
  return text
    .replace(/\n/g, PLACEHOLDER)  // 先用占位符替换换行符
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')  // 转义所有正则特殊字符
    .replace(new RegExp(PLACEHOLDER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[\\n\\s]+');  // 将占位符替换为 [\n\s]+（匹配一个或多个换行符或空格）
};

/**
 * 规范化originContent：将HTML标签转换为换行符，处理Markdown转义换行符
 * 适用于：在originContent中查找start_string和end_string时
 *
 * @param originContent - 原始文件内容（包含HTML标签或Markdown格式）
 * @returns 规范化后的内容（HTML标签转换为换行符，Markdown转义换行符处理）
 */
export const normalizeOriginContent = (originContent: string): string => {
  // 先处理Markdown的转义换行符（\）后跟换行符的情况
  // Markdown中 \ 用于创建硬换行，但在匹配时应该忽略
  let normalized = originContent.replace(/\\\n/g, '\n');  // \n -> \n（移除转义符）
  normalized = normalized.replace(/\\$/gm, '');  // 行末的 \ -> 空（移除行末转义符）

  // 然后处理HTML标签转换为换行符
  normalized = normalizeHtmlToNewlines(normalized);

  return normalized;
};

/**
 * 规范化old_string：将HTML标签转换为换行符
 * 适用于：在编辑器中查找old_string时
 *
 * @param oldString - old_string（可能包含HTML标签）
 * @returns 规范化后的old_string（HTML标签转换为换行符）
 */
export const normalizeOldString = (oldString: string): string => {
  return normalizeHtmlToNewlines(oldString);
};

/**
 * 规范化new_string：去除HTML标签
 * 适用于：在编辑器中查找new_string时
 *
 * @param newString - new_string（可能包含HTML标签）
 * @returns 规范化后的new_string（去除HTML标签）
 */
export const normalizeNewString = (newString: string): string => {
  return removeHtmlTags(newString);
};

/**
 * 规范化用于匹配比较的文本
 * 适用于：面板匹配验证、内容比较等场景
 * 处理步骤：1. 去除HTML标签 2. 换行符转换为空格 3. trim
 *
 * @param text - 要规范化的文本
 * @returns 规范化后的文本
 */
export const normalizeForMatch = (text: string): string => {
  return text
    .replace(/<\/?[^>]+(>|$)/g, "")  // 去除HTML标签
    .replace(/\n/g, " ")              // 换行符转换为空格
    .trim();
};

/**
 * 规范化用于内容验证的文本（去除换行符）
 * 适用于：内容匹配验证时需要完全忽略换行符的场景
 * 处理步骤：1. 去除换行符
 *
 * @param text - 要规范化的文本
 * @returns 规范化后的文本（去除换行符）
 */
export const normalizeForContentValidation = (text: string): string => {
  return removeNewlines(text);
};

// 统一引号类型：将中文引号转换为英文引号，用于内容比较时忽略引号类型差异
export const normalizeQuotes = (text: string): string => {
  return text
    .replace(/"/g, '"')  // 中文左引号 -> 英文左引号
    .replace(/"/g, '"')  // 中文右引号 -> 英文右引号
    .replace(/'/g, "'")  // 中文左单引号 -> 英文左单引号
    .replace(/'/g, "'"); // 中文右单引号 -> 英文右单引号
};

/**
 * 数字转中文数字（只返回中文数字部分，不包含"第"和"章"）
 * @param num - 要转换的数字
 * @returns 中文数字字符串
 *
 * @example
 * numberToChinese(1) // '一'
 * numberToChinese(10) // '十'
 * numberToChinese(11) // '十一'
 * numberToChinese(20) // '二十'
 * numberToChinese(21) // '二十一'
 */
export const numberToChinese = (num: number): string => {
  if (num < 1) return "一";
  if (num > 9999) return num.toString(); // 超过9999直接用数字

  const digits = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  const units = ["", "十", "百", "千"];

  const numStr = num.toString();
  const len = numStr.length;
  let result = "";

  for (let i = 0; i < len; i++) {
    const digit = parseInt(numStr[i]);
    const unitIndex = len - i - 1;

    if (digit === 0) {
      // 处理零的情况
      // 如果不是最后一位，且结果还没有零，且下一位不是零，则添加零
      if (i < len - 1 && !result.endsWith("零") && parseInt(numStr[i + 1]) !== 0) {
        result += "零";
      }
    } else {
      // 特殊处理：十位是1且是两位数时，省略"一"
      if (unitIndex === 1 && digit === 1 && len === 2) {
        result += units[unitIndex];
      } else {
        result += digits[digit] + units[unitIndex];
      }
    }
  }

  // 移除末尾可能的零
  result = result.replace(/零+$/, "");

  return result;
};

export const isMobileDevice = (): boolean => {
  if (typeof window === "undefined") return false;

  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

  // 检测移动设备 User-Agent（Android、iPhone、iPod 等）
  const mobileRegex = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i;

  // 检测 iPad
  // iPadOS 13+ 的 User-Agent 可能包含 "Macintosh"，但会有触摸支持且没有鼠标
  const isIPad =
    /iPad/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) &&
      "ontouchend" in document &&
      navigator.maxTouchPoints > 0 &&
      !(window as any).matchMedia("(pointer: fine)").matches);

  // 检测屏幕宽度（移动设备通常小于 1024px，但 iPad 可能更大）
  const isSmallScreen = window.innerWidth <= 1024;

  // 检测触摸支持
  const hasTouchSupport = "ontouchstart" in window || navigator.maxTouchPoints > 0;

  // 综合判断：移动设备 User-Agent 或 iPad 或（小屏幕 + 触摸支持）
  return mobileRegex.test(userAgent) || isIPad || (isSmallScreen && hasTouchSupport);
};

export const convertToLocalTime = (utcTime: string | undefined): Date | null => {
  if (!utcTime) return null;
  const utcDate = new Date(utcTime);
  // return utcDate;
  // 加8小时转换为本地时间（UTC+8）
  return new Date(utcDate.getTime() + 8 * 60 * 60 * 1000);
};

// 格式化时间为本地时间字符串
export const formatLocalTime = (utcTime: string | undefined): string => {
  const localDate = convertToLocalTime(utcTime);
  if (!localDate) return new Date().toLocaleString("zh-CN");
  return localDate.toLocaleString("zh-CN");
};

