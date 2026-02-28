import { toast } from "sonner";

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
      const testKey = "__storage_test__";
      localStorage.setItem(testKey, "test");
      localStorage.removeItem(testKey);
      this.available = true;
    } catch (e) {
      console.warn("LocalStorage not available:", e);
      this.available = false;
    }
  }

  getItem(key: string): string | null {
    if (!this.available) return null;
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error("LocalStorage getItem error:", error);
      this.checkAvailability();
      return null;
    }
  }

  setItem(key: string, value: string): void {
    if (!this.available) {
      throw new Error("LocalStorage is not available");
    }
    try {
      const estimatedSize = new Blob([value]).size;
      if (estimatedSize > 5 * 1024 * 1024) {
        console.warn(`Large data (${(estimatedSize / 1024 / 1024).toFixed(2)}MB) being stored`);
      }
      localStorage.setItem(key, value);
    } catch (error: unknown) {
      const err = error as { name?: string };
      if (err.name === "QuotaExceededError") {
        console.error("LocalStorage quota exceeded");
        this.handleQuotaExceeded(key);
        try {
          localStorage.setItem(key, value);
        } catch {
          throw new Error("LocalStorage quota exceeded after cleanup");
        }
      } else {
        console.error("LocalStorage setItem error:", error);
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
      console.error("LocalStorage removeItem error:", error);
    }
  }

  clear(): void {
    if (!this.available) return;
    try {
      localStorage.clear();
    } catch (error) {
      console.error("LocalStorage clear error:", error);
    }
  }

  private handleQuotaExceeded(currentKey: string): void {
    try {
      const protectedPrefixes = ["chatSessions_", "currentSession_"];
      interface CacheItem {
        key: string;
        size: number;
        priority: number;
      }
      const cacheItems: CacheItem[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || key === currentKey) continue;
        if (protectedPrefixes.some((prefix) => key.startsWith(prefix))) continue;
        try {
          const value = localStorage.getItem(key);
          if (!value) continue;
          const size = new Blob([value]).size;
          let priority = 50;
          if (key.startsWith("temp_")) priority = 10;
          else if (key.startsWith("cache_") || key.startsWith("FLOW_CACHE_")) priority = 20;
          else if (key.startsWith("editor_work_info_cache_")) priority = 40;
          else if (key.startsWith("work_selected_node_")) priority = 60;
          cacheItems.push({ key, size, priority });
        } catch {}
      }
      if (cacheItems.length === 0) return;
      cacheItems.sort((a, b) => (a.priority !== b.priority ? a.priority - b.priority : b.size - a.size));
      const maxItemsToRemove = Math.min(Math.ceil(cacheItems.length * 0.3), 5);
      let removed = 0;
      for (const item of cacheItems) {
        if (removed >= maxItemsToRemove) break;
        try {
          localStorage.removeItem(item.key);
          removed++;
        } catch {}
      }
    } catch (error) {
      console.error("[SafeLocalStorage] Error handling quota exceeded:", error);
    }
  }

  isAvailable(): boolean {
    return this.available;
  }
}

/**
 * IndexedDB 适配器
 */
class IndexedDBAdapter implements StorageAdapter {
  private dbName = "AppStorage";
  private storeName = "keyValueStore";
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void>;
  private cache: Map<string, string> = new Map();

  constructor() {
    this.initPromise = this.init();
  }

  private async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (event: Event) => {
        const db = (event.target as IDBOpenDBRequest).result;
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
    return this.cache.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.cache.set(key, value);
    this.setItemAsync(key, value).catch((e) => console.error("IndexedDB setItem error:", e));
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    await this.ensureInit();
    if (!this.db) throw new Error("IndexedDB not initialized");
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([this.storeName], "readwrite");
      const store = tx.objectStore(this.storeName);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  removeItem(key: string): void {
    this.cache.delete(key);
    this.removeItemAsync(key).catch((e) => console.error("IndexedDB removeItem error:", e));
  }

  async removeItemAsync(key: string): Promise<void> {
    await this.ensureInit();
    if (!this.db) throw new Error("IndexedDB not initialized");
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([this.storeName], "readwrite");
      const store = tx.objectStore(this.storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  clear(): void {
    this.cache.clear();
    this.clearAsync().catch((e) => console.error("IndexedDB clear error:", e));
  }

  async clearAsync(): Promise<void> {
    await this.ensureInit();
    if (!this.db) throw new Error("IndexedDB not initialized");
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([this.storeName], "readwrite");
      const store = tx.objectStore(this.storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

/**
 * 内存存储适配器
 */
class MemoryStorageAdapter implements StorageAdapter {
  private storage: Map<string, string> = new Map();
  getItem(key: string): string | null {
    return this.storage.get(key) ?? null;
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
 * 统一存储管理器（React 版，使用 sonner toast）
 */
class StorageManager {
  private adapter: StorageAdapter;
  private storageType: "localStorage" | "indexedDB" | "memory";

  constructor() {
    const localStorageAdapter = new SafeLocalStorageAdapter();
    if (localStorageAdapter.isAvailable()) {
      this.adapter = localStorageAdapter;
      this.storageType = "localStorage";
    } else {
      try {
        this.adapter = new IndexedDBAdapter();
        this.storageType = "indexedDB";
      } catch {
        this.adapter = new MemoryStorageAdapter();
        this.storageType = "memory";
        toast.warning("浏览器存储不可用，数据将在刷新后丢失");
      }
    }
  }

  getItem<T = unknown>(key: string, defaultValue: T | null = null): T | null {
    try {
      const value = this.adapter.getItem(key);
      if (value === null) return defaultValue;
      try {
        return JSON.parse(value) as T;
      } catch (parseError) {
        if (key.startsWith("chatSessions_") || key.startsWith("currentSession_")) {
          const cleaned = value.replace(/[\x00-\x1F\x7F]/g, "");
          try {
            return JSON.parse(cleaned) as T;
          } catch {}
        }
        return defaultValue;
      }
    } catch {
      return defaultValue;
    }
  }

  setItem<T = unknown>(key: string, value: T): boolean {
    try {
      const serialized = JSON.stringify(value);
      this.adapter.setItem(key, serialized);
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "";
      if (msg.includes("quota exceeded")) {
        toast.error("存储空间已满，请清理浏览器数据");
      } else if (msg.includes("circular structure")) {
        toast.error("数据包含循环引用，无法存储");
      } else {
        toast.error("数据存储失败");
      }
      return false;
    }
  }

  removeItem(key: string): void {
    try {
      this.adapter.removeItem(key);
    } catch (error) {
      console.error(`Error removing item "${key}":`, error);
    }
  }

  clear(): void {
    try {
      this.adapter.clear();
    } catch (error) {
      console.error("Error clearing storage:", error);
    }
  }

  getStorageType(): string {
    return this.storageType;
  }

  getStorageInfo(): { used: number; total: number; percentage: number } | null {
    if (this.storageType !== "localStorage") return null;
    try {
      let used = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          if (value) used += new Blob([key, value]).size;
        }
      }
      const total = 5 * 1024 * 1024;
      const percentage = (used / total) * 100;
      return { used, total, percentage };
    } catch {
      return null;
    }
  }
}

const storageManager = new StorageManager();
export default storageManager;
export { StorageManager };
