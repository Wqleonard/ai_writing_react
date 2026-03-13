/**
 * 存储健康监控（React 版，供 StorageMonitor 使用）
 */
import storageManager from "./storage";

export class StorageHealthMonitor {
  private static readonly CHECK_INTERVAL = 60000;
  private static intervalId: ReturnType<typeof setInterval> | null = null;

  static startMonitoring(): void {
    if (this.intervalId !== null) return;
    this.intervalId = setInterval(() => this.checkHealth(), this.CHECK_INTERVAL);
  }

  static stopMonitoring(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private static checkHealth(): void {
    const storageType = storageManager.getStorageType();
    const info = storageManager.getStorageInfo();
    console.group("存储健康检查");
    console.log("存储类型:", storageType);
    if (info) {
      console.log("已用空间:", (info.used / 1024).toFixed(2), "KB");
      console.log("总空间:", (info.total / 1024).toFixed(2), "KB");
      console.log("使用率:", info.percentage.toFixed(2), "%");
    }
    console.groupEnd();
  }

  static getHealthReport(): {
    type: string;
    isHealthy: boolean;
    usage: ReturnType<typeof storageManager.getStorageInfo>;
    recommendations: string[];
  } {
    const type = storageManager.getStorageType();
    const usage = storageManager.getStorageInfo();
    const isHealthy = usage ? usage.percentage < 75 : true;
    const recommendations = this.getRecommendations(usage);
    return { type, isHealthy, usage, recommendations };
  }

  private static getRecommendations(
    info: ReturnType<typeof storageManager.getStorageInfo>
  ): string[] {
    const recommendations: string[] = [];
    if (!info) {
      recommendations.push("当前使用非 localStorage，无需优化");
      return recommendations;
    }
    if (info.percentage > 90) {
      recommendations.push("⚠️ 立即清理旧数据");
      recommendations.push("⚠️ 考虑删除不需要的作品缓存");
      recommendations.push("⚠️ 检查是否有大文件被存储");
    } else if (info.percentage > 75) {
      recommendations.push("建议定期清理旧缓存");
      recommendations.push("考虑压缩存储数据");
    } else if (info.percentage > 50) {
      recommendations.push("存储使用正常，保持监控");
    } else {
      recommendations.push("✅ 存储状态良好");
    }
    return recommendations;
  }
}
