import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import storageManager from "@/utils/storage";
import { StorageHealthMonitor } from "@/utils/storage-example";

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
};

export const StorageMonitor = () => {
  const [storageType, setStorageType] = useState("");
  const [storageInfo, setStorageInfo] = useState<{
    used: number;
    total: number;
    percentage: number;
  } | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [testForm, setTestForm] = useState({
    key: "test_key",
    value: `{"name": "测试数据", "timestamp": "${new Date().toISOString()}"}`,
  });
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const updateStorageInfo = useCallback(() => {
    setStorageType(storageManager.getStorageType());
    setStorageInfo(storageManager.getStorageInfo());
  }, []);

  useEffect(() => {
    updateStorageInfo();
    const intervalId = setInterval(updateStorageInfo, 5000);
    return () => {
      clearInterval(intervalId);
      if (isMonitoring) StorageHealthMonitor.stopMonitoring();
    };
  }, [updateStorageInfo, isMonitoring]);

  const toggleMonitoring = () => {
    if (isMonitoring) {
      StorageHealthMonitor.stopMonitoring();
      setIsMonitoring(false);
      toast.info("已停止监控");
    } else {
      StorageHealthMonitor.startMonitoring();
      setIsMonitoring(true);
      toast.success("开始监控存储状态");
    }
  };

  const saveTestData = () => {
    try {
      const data = JSON.parse(testForm.value);
      const success = storageManager.setItem(testForm.key, data);
      if (success) {
        toast.success("保存成功");
        setTestResult("保存成功");
        updateStorageInfo();
      } else {
        toast.error("保存失败");
        setTestResult("保存失败");
      }
    } catch (error) {
      toast.error("JSON 格式错误");
      setTestResult(`错误: ${error}`);
    }
  };

  const loadTestData = () => {
    const data = storageManager.getItem(testForm.key);
    if (data != null) {
      setTestResult(JSON.stringify(data, null, 2));
      toast.success("读取成功");
    } else {
      setTestResult("未找到数据");
      toast.warning("未找到数据");
    }
  };

  const deleteTestData = () => {
    storageManager.removeItem(testForm.key);
    setTestResult("已删除");
    toast.success("删除成功");
    updateStorageInfo();
  };

  const showReport = () => {
    const report = StorageHealthMonitor.getHealthReport();
    console.group("📊 存储健康报告");
    console.log("存储类型:", report.type);
    console.log("是否健康:", report.isHealthy ? "✅ 是" : "❌ 否");
    if (report.usage) {
      console.log("使用情况:", {
        used: formatBytes(report.usage.used),
        total: formatBytes(report.usage.total),
        percentage: report.usage.percentage.toFixed(2) + "%",
      });
    }
    console.log("优化建议:", report.recommendations);
    console.groupEnd();
    toast.success("报告已在控制台输出");
  };

  const clearAllStorage = () => {
    storageManager.clear();
    updateStorageInfo();
    setClearConfirmOpen(false);
    toast.success("已清空所有存储");
  };

  const storageTypeColor =
    storageType === "localStorage"
      ? "success"
      : storageType === "indexedDB"
        ? "warning"
        : storageType === "memory"
          ? "destructive"
          : "secondary";

  const healthStatus = !storageInfo
    ? { type: "success" as const, text: "健康" }
    : storageInfo.percentage < 50
      ? { type: "success" as const, text: "健康" }
      : storageInfo.percentage < 75
        ? { type: "warning" as const, text: "良好" }
        : storageInfo.percentage < 90
          ? { type: "warning" as const, text: "警告" }
          : { type: "destructive" as const, text: "严重" };

  const progressColor = !storageInfo
    ? "#409eff"
    : storageInfo.percentage < 50
      ? "#67c23a"
      : storageInfo.percentage < 75
        ? "#e6a23c"
        : "#f56c6c";

  const recommendations = StorageHealthMonitor.getHealthReport().recommendations;

  return (
    <div className="p-5">
      {/* Card */}
      <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-none items-center justify-between gap-4 border-b border-border p-4">
          <span className="text-base font-medium">存储监控面板</span>
          <Button
            variant={isMonitoring ? "destructive" : "default"}
            size="sm"
            onClick={toggleMonitoring}
          >
            {isMonitoring ? "停止监控" : "开始监控"}
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {/* Descriptions */}
          <div className="grid grid-cols-2 gap-4 rounded border border-border p-3 text-sm">
            <div>
              <span className="text-muted-foreground">存储类型</span>
              <div className="mt-1">
                <span
                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                    storageTypeColor === "success"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : storageTypeColor === "warning"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                        : storageTypeColor === "destructive"
                          ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-muted text-muted-foreground"
                  }`}
                >
                  {storageType || "—"}
                </span>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">健康状态</span>
              <div className="mt-1">
                <span
                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                    healthStatus.type === "success"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : healthStatus.type === "warning"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                  }`}
                >
                  {healthStatus.text}
                </span>
              </div>
            </div>
          </div>

          {/* Storage info */}
          {storageInfo && (
            <div className="rounded-md bg-muted/50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>已用空间:</span>
                <span className="font-medium text-primary">{formatBytes(storageInfo.used)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>总空间:</span>
                <span className="font-medium text-primary">{formatBytes(storageInfo.total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>使用率:</span>
                <span className="font-medium text-primary">{storageInfo.percentage.toFixed(2)}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(storageInfo.percentage, 100)}%`,
                    backgroundColor: progressColor,
                  }}
                />
              </div>
            </div>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="rounded-md border-l-4 border-amber-500 bg-amber-50 p-4 dark:bg-amber-950/20">
              <h4 className="mb-2 text-sm font-medium text-amber-800 dark:text-amber-200">优化建议</h4>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                {recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setTestDialogOpen(true)}>
              测试存储
            </Button>
            <Button size="sm" variant="secondary" onClick={showReport}>
              查看报告
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setClearConfirmOpen(true)}
            >
              清空存储
            </Button>
          </div>
        </div>
      </div>

      {/* Test dialog */}
      {testDialogOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setTestDialogOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-lg border border-border bg-card p-4 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold">存储测试</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">键名</label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={testForm.key}
                  onChange={(e) => setTestForm((f) => ({ ...f, key: e.target.value }))}
                  placeholder="test_key"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">值</label>
                <Textarea
                  rows={4}
                  className="resize-none"
                  value={testForm.value}
                  onChange={(e) => setTestForm((f) => ({ ...f, value: e.target.value }))}
                  placeholder='{"name": "测试数据"}'
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveTestData}>
                  保存
                </Button>
                <Button size="sm" variant="outline" onClick={loadTestData}>
                  读取
                </Button>
                <Button size="sm" variant="destructive" onClick={deleteTestData}>
                  删除
                </Button>
              </div>
              {testResult && (
                <div>
                  <label className="mb-1 block text-sm font-medium">结果</label>
                  <Textarea rows={4} readOnly value={testResult} className="resize-none bg-muted" />
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setTestDialogOpen(false)}>
                关闭
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Clear confirm */}
      {clearConfirmOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setClearConfirmOpen(false)}
          />
          <div className="relative max-w-sm rounded-lg border border-border bg-card p-4 shadow-lg">
            <p className="mb-4 text-sm">确定要清空所有存储吗？</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setClearConfirmOpen(false)}>
                取消
              </Button>
              <Button variant="destructive" size="sm" onClick={clearAllStorage}>
                确定
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
