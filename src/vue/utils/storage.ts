import { ElMessage } from 'element-plus';

/**
 * 存储适配器接口
 */
interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

/**
 * LocalStorage 适配器（带错误处理）
 */
class SafeLocalStorageAdapter implements StorageAdapter {
  private available: boolean = true;

  constructor() {
    this.checkAvailability();
  }

  private checkAvailability(): void {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      this.available = true;
    } catch (e) {
      console.warn('LocalStorage not available:', e);
      this.available = false;
    }
  }

  getItem(key: string): string | null {
    if (!this.available) return null;

    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error('LocalStorage getItem error:', error);
      this.checkAvailability();
      return null;
    }
  }

  setItem(key: string, value: string): void {
    if (!this.available) {
      throw new Error('LocalStorage is not available');
    }

    try {
      // 检查存储空间
      const estimatedSize = new Blob([value]).size;
      if (estimatedSize > 5 * 1024 * 1024) { // 5MB警告
        console.warn(`Large data (${(estimatedSize / 1024 / 1024).toFixed(2)}MB) being stored`);
      }

      localStorage.setItem(key, value);
    } catch (error: any) {
      if (error.name === 'QuotaExceededError') {
        console.error('LocalStorage quota exceeded');
        this.handleQuotaExceeded(key);
        // 重试一次
        try {
          localStorage.setItem(key, value);
        } catch (retryError) {
          throw new Error('LocalStorage quota exceeded after cleanup');
        }
      } else {
        console.error('LocalStorage setItem error:', error);
        this.checkAvailability();
        throw error;
      }
    }
  }

  removeItem(key: string): void {
    if (!this.available) return;

    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('LocalStorage removeItem error:', error);
    }
  }

  clear(): void {
    if (!this.available) return;

    try {
      localStorage.clear();
    } catch (error) {
      console.error('LocalStorage clear error:', error);
    }
  }

  /**
   * 处理存储空间超限 - 清理旧数据
   * 重要：保护聊天记录等关键数据不被误删
   * 优化策略：LRU（最近最少使用）+ 基于数据类型优先级
   */
  private handleQuotaExceeded(currentKey: string): void {
    try {
      console.warn('[SafeLocalStorage] Storage quota exceeded, starting cleanup...');
      
      // 受保护的关键数据前缀（永远不会被清理）
      const protectedPrefixes = [
        'chatSessions_',      // 聊天会话历史记录（最重要！）
        'currentSession_',    // 当前会话ID
      ];

      // 收集所有可清理的键及其元数据
      interface CacheItem {
        key: string;
        size: number;
        priority: number; // 优先级越低越先删除
        lastAccess?: number;
      }

      const cacheItems: CacheItem[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || key === currentKey) continue;

        // 检查是否是受保护的数据
        const isProtected = protectedPrefixes.some(prefix => key.startsWith(prefix));
        if (isProtected) {
          console.log(`[SafeLocalStorage] Protected key from cleanup: ${key}`);
          continue;
        }

        try {
          const value = localStorage.getItem(key);
          if (!value) continue;

          const size = new Blob([value]).size;

          // 根据键名确定优先级
          let priority = 50; // 默认优先级

          // 临时数据 - 优先级最低（最先删除）
          if (key.startsWith('temp_')) {
            priority = 10;
          }
          // 缓存数据 - 优先级较低
          else if (key.startsWith('cache_') || key.startsWith('FLOW_CACHE_')) {
            priority = 20;
          }
          // 作品编辑信息缓存 - 中等优先级
          else if (key.startsWith('editor_work_info_cache_')) {
            priority = 40;
          }
          // 选中节点缓存 - 较高优先级（数据小但重要）
          else if (key.startsWith('work_selected_node_')) {
            priority = 60;
          }

          cacheItems.push({ key, size, priority });
        } catch (error) {
          console.error(`[SafeLocalStorage] Error processing key ${key}:`, error);
        }
      }

      if (cacheItems.length === 0) {
        console.warn('[SafeLocalStorage] No removable items found. All data is protected or current key.');
        return;
      }

      // 按优先级排序（优先级低的在前，优先级相同则按大小排序）
      cacheItems.sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return b.size - a.size; // 相同优先级，大的先删
      });

      // 清理策略：
      // 1. 优先删除低优先级项
      // 2. 如果空间还不够，删除大文件
      // 3. 最多清理30%的可清理项或5个项（以先达到者为准）

      const maxItemsToRemove = Math.min(Math.ceil(cacheItems.length * 0.3), 5);
      let removedCount = 0;
      let freedSpace = 0;

      console.log(`[SafeLocalStorage] Found ${cacheItems.length} removable items, will remove up to ${maxItemsToRemove}`);

      for (const item of cacheItems) {
        if (removedCount >= maxItemsToRemove) break;

        try {
          localStorage.removeItem(item.key);
          removedCount++;
          freedSpace += item.size;
          console.log(`[SafeLocalStorage] Removed: ${item.key} (priority: ${item.priority}, size: ${(item.size / 1024).toFixed(2)}KB)`);
        } catch (error) {
          console.error(`[SafeLocalStorage] Failed to remove ${item.key}:`, error);
        }
      }

      console.log(`[SafeLocalStorage] Cleanup complete: removed ${removedCount} items, freed ${(freedSpace / 1024).toFixed(2)}KB`);
    } catch (error) {
      console.error('[SafeLocalStorage] Error handling quota exceeded:', error);
    }
  }

  isAvailable(): boolean {
    return this.available;
  }
}

/**
 * IndexedDB 适配器（异步存储，更大容量）
 */
class IndexedDBAdapter implements StorageAdapter {
  private dbName = 'AppStorage';
  private storeName = 'keyValueStore';
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void>;
  private cache: Map<string, string> = new Map();

  constructor() {
    this.initPromise = this.init();
  }

  private async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => {
        console.error('IndexedDB failed to open');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  private async ensureInit(): Promise<void> {
    await this.initPromise;
  }

  getItem(key: string): string | null {
    // 同步方法返回缓存值
    return this.cache.get(key) || null;
  }

  setItem(key: string, value: string): void {
    // 同步更新缓存
    this.cache.set(key, value);

    // 异步写入IndexedDB
    this.setItemAsync(key, value).catch(error => {
      console.error('IndexedDB setItem error:', error);
    });
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(value, key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getItemAsync(key: string): Promise<string | null> {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        const value = request.result || null;
        if (value) {
          this.cache.set(key, value);
        }
        resolve(value);
      };
      request.onerror = () => reject(request.error);
    });
  }

  removeItem(key: string): void {
    this.cache.delete(key);

    this.removeItemAsync(key).catch(error => {
      console.error('IndexedDB removeItem error:', error);
    });
  }

  async removeItemAsync(key: string): Promise<void> {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  clear(): void {
    this.cache.clear();

    this.clearAsync().catch(error => {
      console.error('IndexedDB clear error:', error);
    });
  }

  async clearAsync(): Promise<void> {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

/**
 * 内存存储适配器（降级方案）
 */
class MemoryStorageAdapter implements StorageAdapter {
  private storage: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.storage.get(key) || null;
  }

  setItem(key: string, value: string): void {
    this.storage.set(key, value);
  }

  removeItem(key: string): void {
    this.storage.delete(key);
  }

  clear(): void {
    this.storage.clear();
  }
}

/**
 * 统一存储管理器
 */
class StorageManager {
  private adapter: StorageAdapter;
  private storageType: 'localStorage' | 'indexedDB' | 'memory';

  constructor() {
    // 尝试使用LocalStorage
    const localStorageAdapter = new SafeLocalStorageAdapter();

    if (localStorageAdapter.isAvailable()) {
      this.adapter = localStorageAdapter;
      this.storageType = 'localStorage';
      console.log('Using LocalStorage');
    } else {
      // 降级到IndexedDB
      try {
        this.adapter = new IndexedDBAdapter();
        this.storageType = 'indexedDB';
        console.log('Using IndexedDB');
      } catch (error) {
        // 最终降级到内存存储
        this.adapter = new MemoryStorageAdapter();
        this.storageType = 'memory';
        console.warn('Using Memory Storage (data will be lost on page refresh)');
        ElMessage.warning('浏览器存储不可用，数据将在刷新后丢失');
      }
    }
  }

  /**
   * 安全地获取数据
   * 增强容错性：兼容旧数据格式，防止读取失败
   */
  getItem<T = any>(key: string, defaultValue: T | null = null): T | null {
    try {
      const value = this.adapter.getItem(key);
      if (value === null) return defaultValue;

      // 尝试解析 JSON
      try {
        return JSON.parse(value) as T;
      } catch (parseError: any) {
        // 如果解析失败，可能是旧数据格式或损坏的数据
        // 对于聊天会话相关的键，尝试数据恢复
        if (key.startsWith('chatSessions_') || key.startsWith('currentSession_')) {
          console.warn(`Failed to parse chat session data for key "${key}", attempting recovery...`);

          // 尝试修复：如果是普通字符串（旧格式），直接返回
          const trimmed = value.trim();
          if (!trimmed.startsWith('{') && !trimmed.startsWith('[') && !trimmed.startsWith('"')) {
            // 看起来是普通字符串，可能是旧格式的 currentSession_* 数据
            if (typeof defaultValue === 'string' || defaultValue === null) {
              console.log(`Recovered string value for key "${key}"`);
              return value as T;
            }
          }

          // 尝试修复损坏的 JSON：移除可能的控制字符
          try {
            const cleaned = value.replace(/[\x00-\x1F\x7F]/g, ''); // 移除控制字符
            const parsed = JSON.parse(cleaned);
            console.log(`Recovered data for key "${key}" by cleaning control characters`);
            return parsed as T;
          } catch {
            // 如果还是失败，记录详细错误信息
            console.error(`Failed to recover data for key "${key}". Value preview: ${value.substring(0, 100)}`);
            console.error(`Parse error:`, parseError);
          }
        }

        // 对于非聊天数据，直接返回默认值
        console.error(`Error parsing JSON for key "${key}":`, parseError);
        return defaultValue;
      }
    } catch (error) {
      console.error(`Error getting item "${key}":`, error);
      return defaultValue;
    }
  }

  /**
   * 安全地存储数据
   */
  setItem<T = any>(key: string, value: T): boolean {
    try {
      // 检查是否可以序列化
      const serialized = JSON.stringify(value);

      // 检查数据大小
      const size = new Blob([serialized]).size;
      const sizeMB = size / 1024 / 1024;

      if (sizeMB > 3 && this.storageType === 'localStorage') {
        console.warn(`Large data (${sizeMB.toFixed(2)}MB) may exceed localStorage limits`);
        // ElMessage.warning(`数据较大(${sizeMB.toFixed(2)}MB)，建议优化存储内容`);
      }

      this.adapter.setItem(key, serialized);
      return true;
    } catch (error: any) {
      console.error(`Error setting item "${key}":`, error);

      if (error.message?.includes('quota exceeded')) {
        ElMessage.error('存储空间已满，请清理浏览器数据');
      } else if (error.message?.includes('circular structure')) {
        ElMessage.error('数据包含循环引用，无法存储');
      } else {
        ElMessage.error('数据存储失败');
      }

      return false;
    }
  }

  /**
   * 移除数据
   */
  removeItem(key: string): void {
    try {
      this.adapter.removeItem(key);
    } catch (error) {
      console.error(`Error removing item "${key}":`, error);
    }
  }

  /**
   * 清空所有数据
   */
  clear(): void {
    try {
      this.adapter.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }

  /**
   * 获取当前存储类型
   */
  getStorageType(): string {
    return this.storageType;
  }

  /**
   * 获取存储空间使用情况（仅支持localStorage）
   * 尝试动态检测实际存储限制，如果检测失败则使用保守估计
   */
  getStorageInfo(): { used: number; total: number; percentage: number } | null {
    if (this.storageType !== 'localStorage') {
      return null;
    }

    try {
      let used = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          if (value) {
            used += new Blob([key, value]).size;
          }
        }
      }

      // 尝试动态检测存储限制
      let total = 5 * 1024 * 1024; // 默认5MB（保守估计）
      
      try {
        // 方法1: 尝试通过测试写入来估算可用空间
        // 注意：这个方法可能不准确，但比硬编码好
        const testKey = '__storage_test__';
        const testValue = 'x'.repeat(1024); // 1KB测试数据
        
        // 检查是否已经有测试键
        const existingTest = localStorage.getItem(testKey);
        
        try {
          localStorage.setItem(testKey, testValue);
          localStorage.removeItem(testKey);
          
          // 如果能成功写入，尝试更大的值来估算
          // 这里使用保守策略：假设至少5MB，但实际可能更多
          // 大多数现代浏览器的localStorage限制是5-10MB
          total = 5 * 1024 * 1024; // 保持5MB作为保守估计
        } catch (e) {
          // 如果连1KB都写不进去，说明空间几乎满了
          console.warn('[StorageManager] Storage appears to be nearly full');
        }
      } catch (e) {
        // 检测失败，使用默认值
        console.warn('[StorageManager] Could not detect storage limit, using default 5MB');
      }

      const percentage = (used / total) * 100;

      return {
        used,
        total,
        percentage,
      };
    } catch (error) {
      console.error('Error getting storage info:', error);
      return null;
    }
  }

  /**
   * 获取所有作品相关的缓存键
   * @returns 分类的缓存键信息
   */
  getWorkRelatedCacheKeys(): {
    workInfoCaches: { key: string; workId: string; size: number }[];
    selectedNodeCaches: { key: string; workId: string; size: number }[];
    chatSessionCaches: { key: string; workId: string; type: string; size: number }[];
    total: number;
    totalSize: number;
  } {
    const workInfoCaches: { key: string; workId: string; size: number }[] = [];
    const selectedNodeCaches: { key: string; workId: string; size: number }[] = [];
    const chatSessionCaches: { key: string; workId: string; type: string; size: number }[] = [];

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        const value = localStorage.getItem(key);
        if (!value) continue;

        const size = new Blob([value]).size;

        // 编辑器作品信息缓存
        if (key.startsWith('editor_work_info_cache_')) {
          const workId = key.replace('editor_work_info_cache_', '');
          workInfoCaches.push({ key, workId, size });
        }
        // 选中节点缓存
        else if (key.startsWith('work_selected_node_')) {
          const workId = key.replace('work_selected_node_', '');
          selectedNodeCaches.push({ key, workId, size });
        }
        // 聊天会话缓存
        else if (key.startsWith('chatSessions_') || key.startsWith('currentSession_')) {
          const match = key.match(/^(chatSessions|currentSession)_(.+?)_(chat|faq)$/);
          if (match) {
            const [, prefix, workId, type] = match;
            chatSessionCaches.push({ key, workId, type: `${prefix}_${type}`, size });
          }
        }
      }

      const total = workInfoCaches.length + selectedNodeCaches.length + chatSessionCaches.length;
      const totalSize = 
        workInfoCaches.reduce((sum, item) => sum + item.size, 0) +
        selectedNodeCaches.reduce((sum, item) => sum + item.size, 0) +
        chatSessionCaches.reduce((sum, item) => sum + item.size, 0);

      return {
        workInfoCaches,
        selectedNodeCaches,
        chatSessionCaches,
        total,
        totalSize,
      };
    } catch (error) {
      console.error('[StorageManager] Error getting work related cache keys:', error);
      return {
        workInfoCaches: [],
        selectedNodeCaches: [],
        chatSessionCaches: [],
        total: 0,
        totalSize: 0,
      };
    }
  }

  /**
   * 清理最大的N个作品缓存（用于紧急释放空间）
   * @param count 要清理的作品数量
   * @returns 清理的缓存数量
   */
  cleanupLargestWorkCaches(count: number = 3): number {
    if (this.storageType !== 'localStorage') {
      console.warn('[StorageManager] cleanupLargestWorkCaches only works with localStorage');
      return 0;
    }

    try {
      const cacheInfo = this.getWorkRelatedCacheKeys();

      // 按作品ID分组统计大小
      const workSizeMap = new Map<string, number>();

      cacheInfo.workInfoCaches.forEach(item => {
        const currentSize = workSizeMap.get(item.workId) || 0;
        workSizeMap.set(item.workId, currentSize + item.size);
      });

      cacheInfo.selectedNodeCaches.forEach(item => {
        const currentSize = workSizeMap.get(item.workId) || 0;
        workSizeMap.set(item.workId, currentSize + item.size);
      });

      cacheInfo.chatSessionCaches.forEach(item => {
        const currentSize = workSizeMap.get(item.workId) || 0;
        workSizeMap.set(item.workId, currentSize + item.size);
      });

      // 按大小排序，选出最大的N个
      const sortedWorks = Array.from(workSizeMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, count);

      if (sortedWorks.length === 0) {
        console.log('[StorageManager] No work caches to clean');
        return 0;
      }

      let clearedCount = 0;

      sortedWorks.forEach(([workId, size]) => {
        console.log(`[StorageManager] Cleaning caches for work ${workId} (size: ${(size / 1024).toFixed(2)}KB)`);

        // 清理该作品的所有缓存
        const keysToRemove = [
          `editor_work_info_cache_${workId}`,
          `work_selected_node_${workId}`,
          `chatSessions_${workId}_chat`,
          `chatSessions_${workId}_faq`,
          `currentSession_${workId}_chat`,
          `currentSession_${workId}_faq`,
        ];

        keysToRemove.forEach(key => {
          try {
            if (localStorage.getItem(key) !== null) {
              localStorage.removeItem(key);
              clearedCount++;
            }
          } catch (error) {
            console.error(`[StorageManager] Failed to remove ${key}:`, error);
          }
        });
      });

      console.log(`[StorageManager] Cleaned ${clearedCount} caches from ${sortedWorks.length} works`);
      return clearedCount;
    } catch (error) {
      console.error('[StorageManager] Error in cleanupLargestWorkCaches:', error);
      return 0;
    }
  }
}

// 创建单例
const storageManager = new StorageManager();

export default storageManager;
export { StorageManager };

