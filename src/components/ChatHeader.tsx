import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { Trash2, Pencil, Check, Plus } from "lucide-react";
import type { ChatSession, ChatTabType } from "@/types/chat";
import type {
  CueWordStage,
  RuntimePromptsFormData,
} from "@/types/runtimePrompts";
import { useDualTabChat } from "@/hooks/useDualTabChat";
import { useRuntimePrompts } from "@/hooks/useRuntimePrompts";
import { Button } from "@/components/ui/Button";

export interface ChatHeaderProps {
  activeTab: ChatTabType;
  currentSessionId: string;
  workId?: string | null;
  checkStreamingStatusAndConfirm?: () => Promise<boolean>;
  onTabChange: (tab: ChatTabType) => void;
  onNewChat: () => void;
  onSwitchSession: (sessionId: string) => void;
  onSaveCurrentSession: () => void;
}

export interface ChatHeaderRef {
  updateSessions: (sessions: ChatSession[]) => void;
  loadSessionsFromStorage: () => Promise<void>;
  getRuntimePrompts: () => import("@/types/runtimePrompts").CueWord[];
}

const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 60 * 1000) return "刚刚";
  if (diff < 60 * 60 * 1000)
    return `${Math.floor(diff / (60 * 1000))}分钟前`;
  if (diff < 24 * 60 * 60 * 1000)
    return `${Math.floor(diff / (60 * 60 * 1000))}小时前`;
  if (diff < 30 * 24 * 60 * 60 * 1000)
    return `${Math.floor(diff / (24 * 60 * 60 * 1000))}天前`;
  return `${Math.floor(diff / (30 * 24 * 60 * 60 * 1000))}个月前`;
};

export const ChatHeader = React.forwardRef<ChatHeaderRef, ChatHeaderProps>(
  (
    {
      activeTab,
      currentSessionId,
      workId,
      checkStreamingStatusAndConfirm,
      onTabChange,
      onNewChat,
      onSwitchSession,
      onSaveCurrentSession,
    },
    ref
  ) => {
    const [isHistoryVisible, setIsHistoryVisible] = useState(false);
    const [allSessions, setAllSessions] = useState<ChatSession[]>([]);
    const [isExperienceDialogVisible, setIsExperienceDialogVisible] =
      useState(false);

    const {
      setWorkId,
      getTabSessions,
      deleteSession,
      markNeedRefreshSessions,
    } = useDualTabChat();

    const {
      runtimePromptsFormData,
      setRuntimePromptsFormData,
      addRuntimePromptsToFormData,
      deleteRuntimePromptsFromFormData,
      correctionRuntimePrompts,
      getCurrentRuntimePrompts,
      cueWordStageList,
      categoryList,
    } = useRuntimePrompts();

    const loadSessionsFromStorage = useCallback(async () => {
      if (workId) {
        setWorkId(workId);
        const sessions = await getTabSessions(activeTab);
        setAllSessions(sessions);
      } else {
        setAllSessions([]);
      }
    }, [workId, activeTab, setWorkId, getTabSessions]);

    useEffect(() => {
      loadSessionsFromStorage();
    }, [loadSessionsFromStorage]);

    useImperativeHandle(
      ref,
      () => ({
        updateSessions: (sessions: ChatSession[]) => setAllSessions(sessions),
        loadSessionsFromStorage,
        getRuntimePrompts: getCurrentRuntimePrompts,
      }),
      [loadSessionsFromStorage, getCurrentRuntimePrompts]
    );

    const getFilteredSessions = useCallback(() => {
      return allSessions.filter((s) => s.type === activeTab);
    }, [allSessions, activeTab]);

    const todaySessions = useMemo(() => {
      const today = new Date();
      const todayStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      ).getTime();
      return getFilteredSessions()
        .filter((s) => s.updatedAt >= todayStart)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    }, [getFilteredSessions]);

    const weekSessions = useMemo(() => {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const today = new Date();
      const todayStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      ).getTime();
      return getFilteredSessions()
        .filter((s) => s.updatedAt >= weekAgo && s.updatedAt < todayStart)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    }, [getFilteredSessions]);

    const monthSessions = useMemo(() => {
      const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return getFilteredSessions()
        .filter((s) => s.updatedAt >= monthAgo && s.updatedAt < weekAgo)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    }, [getFilteredSessions]);

    const hasAnySessions =
      todaySessions.length > 0 ||
      weekSessions.length > 0 ||
      monthSessions.length > 0;

    const handleNewChat = useCallback(() => {
      if (activeTab !== "canvas") {
        markNeedRefreshSessions();
        onNewChat();
      }
    }, [activeTab, markNeedRefreshSessions, onNewChat]);

    const showHistory = useCallback(async () => {
      if (activeTab !== "canvas") {
        setIsHistoryVisible(true);
        await loadSessionsFromStorage();
      }
    }, [activeTab, loadSessionsFromStorage]);

    const hideHistory = useCallback(() => setIsHistoryVisible(false), []);

    const handleCloseExperienceDialog = useCallback(() => {
      correctionRuntimePrompts();
      setIsExperienceDialogVisible(false);
    }, [correctionRuntimePrompts]);

    const handleAddExperience = useCallback(() => {
      if (runtimePromptsFormData.length > 0) {
        const last = runtimePromptsFormData[runtimePromptsFormData.length - 1];
        if (last.editStatus) {
          setRuntimePromptsFormData((prev) =>
            prev.map((item) =>
              item.id === last.id ? { ...item, editStatus: false } : item
            )
          );
          correctionRuntimePrompts();
        }
      }
      addRuntimePromptsToFormData();
    }, [
      runtimePromptsFormData,
      setRuntimePromptsFormData,
      correctionRuntimePrompts,
      addRuntimePromptsToFormData,
    ]);

    const handleEditItem = useCallback(
      (item: RuntimePromptsFormData) => {
        setRuntimePromptsFormData((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, editStatus: true } : i
          )
        );
      },
      [setRuntimePromptsFormData]
    );

    const handleSaveItem = useCallback(
      (item: RuntimePromptsFormData) => {
        setRuntimePromptsFormData((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, editStatus: false } : i
          )
        );
        correctionRuntimePrompts();
      },
      [setRuntimePromptsFormData, correctionRuntimePrompts]
    );

    const switchToSession = useCallback(
      async (sessionId: string) => {
        if (checkStreamingStatusAndConfirm) {
          const canProceed = await checkStreamingStatusAndConfirm();
          if (!canProceed) return;
        }
        onSaveCurrentSession();
        onSwitchSession(sessionId);
        hideHistory();
      },
      [
        checkStreamingStatusAndConfirm,
        onSaveCurrentSession,
        onSwitchSession,
        hideHistory,
      ]
    );

    const handleDeleteSession = useCallback(
      async (sessionId: string) => {
        const ok = window.confirm("确定要删除这个会话吗？");
        if (!ok) return;
        if (workId) {
          setWorkId(workId);
          await deleteSession(activeTab, sessionId);
          setAllSessions((prev) => prev.filter((s) => s.id !== sessionId));
        }
        if (currentSessionId === sessionId) onNewChat();
      },
      [
        workId,
        activeTab,
        currentSessionId,
        setWorkId,
        deleteSession,
        onNewChat,
      ]
    );

    const updateItem = useCallback(
      (id: string, patch: Partial<RuntimePromptsFormData>) => {
        setRuntimePromptsFormData((prev) =>
          prev.map((i) => (i.id === id ? { ...i, ...patch } : i))
        );
      },
      [setRuntimePromptsFormData]
    );

    const renderSessionList = (sessions: ChatSession[], typeLabel: string) => (
      <div className="history-list flex flex-col gap-2">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`history-item relative cursor-pointer rounded-md border border-transparent p-3 transition-all hover:bg-[var(--bg-secondary)] hover:border-[var(--border-color)] ${currentSessionId === session.id ? "bg-[var(--accent-color)] border-[var(--accent-color)]" : ""}`}
            onClick={() => switchToSession(session.id)}
          >
            <div className="session-title mb-1 text-sm font-medium text-[var(--text-primary)]">
              {session.title}
            </div>
            <div className="session-meta flex gap-3 text-xs text-[var(--text-muted)]">
              <span>{formatTimeAgo(session.updatedAt)}</span>
              <span>{session.type === "faq" ? "问答" : "写作"}</span>
            </div>
            {session.id !== currentSessionId && (
              <button
                type="button"
                className="delete-btn absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 opacity-0 transition-opacity hover:bg-[var(--bg-quaternary)]"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteSession(session.id);
                }}
                title="删除会话"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    );

    return (
      <div className="chat-header flex h-10 min-h-10 items-center justify-between overflow-hidden px-5 box-border">
        <div className="tab-container flex items-center gap-0 rounded-full bg-[var(--bg-secondary)] p-[3px]">
          <div
            className={`tab flex h-6 shrink-0 cursor-pointer items-center rounded-full px-3 text-xs font-medium transition-colors ${activeTab === "chat" ? "bg-[var(--bg-editor-save)] text-white" : "bg-transparent text-[var(--text-secondary)] hover:bg-transparent hover:text-[var(--text-primary)]"}`}
            onClick={() => onTabChange("chat")}
          >
            写作
          </div>
          <div
            className={`canvas-tab tab relative flex h-6 shrink-0 cursor-pointer items-center rounded-full px-3 text-xs font-medium transition-colors ${activeTab === "canvas" ? "bg-[var(--bg-editor-save)] text-white" : "bg-transparent text-[var(--text-secondary)] hover:bg-transparent hover:text-[var(--text-primary)]"}`}
            onClick={() => onTabChange("canvas")}
          >
            画布创作
            <span className="beta-badge absolute -right-2.5 -top-1 whitespace-nowrap rounded bg-[#f56c6c] px-1 py-0.5 text-[9px] font-semibold leading-tight text-white">
              Beta
            </span>
          </div>
        </div>

        <div className="header-actions flex gap-3">
          {activeTab !== "canvas" && (
            <>
              <div
                className="action-item flex cursor-pointer items-center justify-center rounded-md p-0.5 transition-colors hover:bg-[var(--bg-quaternary)]"
                onClick={showHistory}
                role="button"
                title="历史记录"
              >
                <span className="action-icon text-base" style={{ fontFamily: "iconfont" }}>&#xe619;</span>
              </div>
              <div
                className="action-item flex cursor-pointer items-center justify-center rounded-md p-0.5 transition-colors hover:bg-[var(--bg-quaternary)]"
                onClick={handleNewChat}
                role="button"
                title="新建聊天"
              >
                <span className="action-icon text-base" style={{ fontFamily: "iconfont" }}>&#xe618;</span>
              </div>
            </>
          )}
        </div>

        {/* 创作经验弹层 */}
        {isExperienceDialogVisible && (
          <>
            <div
              className="fixed inset-0 z-[2000] flex items-center justify-center"
              role="dialog"
            >
              <div
                className="absolute inset-0 bg-black/50"
                onClick={handleCloseExperienceDialog}
              />
              <div className="relative w-[1000px] max-w-[95vw] max-h-[90vh] overflow-auto rounded-lg border border-border bg-card shadow-lg">
                <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card p-4">
                  <h2 className="text-lg font-semibold">创作经验</h2>
                  <button
                    type="button"
                    className="rounded p-1 hover:bg-muted"
                    onClick={handleCloseExperienceDialog}
                  >
                    ×
                  </button>
                </div>
                <div className="p-4">
                  <p className="experience-description mb-5 text-left text-sm text-[#333]">
                    创作经验可以使智能体了解您的个人偏好和特定任务的最佳实践
                  </p>
                  <div className="experience-form">
                    <div className="form-top-container mb-3 flex flex-row items-center border-b border-[#e4e7ed] pb-2.5">
                      <div className="form-column stage-column flex-1 text-left text-sm font-medium text-[#333]">
                        &nbsp;&nbsp;创作阶段<span className="text-[#f56c6c]">*</span>
                      </div>
                      <div className="form-column content-column flex-2 text-left text-sm font-medium text-[#333]">
                        &nbsp;&nbsp;内容<span className="text-[#f56c6c]">*</span>
                      </div>
                      <div className="form-column tag-column flex-1 text-left text-sm font-medium text-[#333]">
                        &nbsp;&nbsp;标签
                      </div>
                      <div className="form-column status-column flex-1 text-left text-sm font-medium text-[#333]">
                        &nbsp;&nbsp;状态
                      </div>
                      <div className="form-column action-column flex-1 text-left text-sm font-medium text-[#333]">
                        &nbsp;&nbsp;操作
                      </div>
                    </div>
                    <div className="form-content flex flex-col gap-2">
                      {runtimePromptsFormData.map((item) => (
                        <div
                          key={item.id}
                          className="form-row flex items-center gap-3 py-2.5"
                        >
                          <div className="form-column stage-column min-w-0 flex-1">
                            <select
                              value={item.stage}
                              disabled={!item.editStatus}
                              className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
                              onChange={(e) =>
                                updateItem(item.id, {
                                  stage: e.target.value as CueWordStage,
                                })
                              }
                            >
                              {cueWordStageList.map((stage) => (
                                <option key={stage.id} value={stage.id}>
                                  {stage.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="form-column content-column min-w-0 flex-2">
                            <textarea
                              value={item.content}
                              disabled={!item.editStatus}
                              rows={1}
                              placeholder="例:默认10个章节,女主不要有精神病"
                              className="w-full resize-none rounded border border-input bg-background px-2 py-1.5 text-sm"
                              onChange={(e) =>
                                updateItem(item.id, { content: e.target.value })
                              }
                            />
                          </div>
                          <div className="form-column tag-column min-w-0 flex-1">
                            <select
                              value={item.category}
                              disabled={!item.editStatus}
                              className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
                              onChange={(e) =>
                                updateItem(item.id, { category: e.target.value })
                              }
                            >
                              <option value="">例:世情文</option>
                              {categoryList.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="form-column status-column min-w-0 flex-1">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={item.selected}
                                disabled={!item.editStatus}
                                className="h-4 w-4"
                                onChange={(e) =>
                                  updateItem(item.id, {
                                    selected: e.target.checked,
                                  })
                                }
                              />
                              <span className="text-sm">
                                {item.selected ? "启用" : "未启用"}
                              </span>
                            </label>
                          </div>
                          <div className="form-column action-column min-w-0 flex-1">
                            <div className="action-buttons flex gap-1.5 justify-start">
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                className="rounded-full p-0 w-8 h-8"
                                onClick={() =>
                                  deleteRuntimePromptsFromFormData(item.id)
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              {item.editStatus ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  className="rounded-full p-0 w-8 h-8"
                                  onClick={() => handleSaveItem(item)}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="rounded-full p-0 w-8 h-8"
                                  onClick={() => handleEditItem(item)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="add-button-container mt-5 text-center">
                      <Button
                        type="button"
                        size="icon"
                        className="rounded-full"
                        onClick={handleAddExperience}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* 历史记录侧边栏 */}
        {isHistoryVisible && (
          <>
            <div
              className="overlay fixed inset-0 z-[999] bg-black/30"
              onClick={hideHistory}
              aria-hidden
            />
            <div className="history-sidebar fixed top-0 right-0 z-[1000] h-screen w-[400px] overflow-y-auto bg-[var(--bg-primary)] shadow-[var(--shadow-color)]" style={{ boxShadow: "-2px 0 10px var(--shadow-color)" }}>
              <div className="history-header flex items-center justify-between border-b border-[var(--border-color)] p-5">
                <h3 className="m-0 text-lg text-[var(--text-primary)]">
                  历史记录
                </h3>
                <button
                  type="button"
                  className="close-btn flex h-8 w-8 items-center justify-center rounded border-none bg-transparent p-0 text-2xl text-[var(--text-secondary)] hover:bg-[var(--bg-quaternary)]"
                  onClick={hideHistory}
                >
                  ×
                </button>
              </div>
              <div className="history-content p-5">
                <div className="history-section mb-6">
                  <h4 className="mb-3 m-0 text-sm font-medium text-[var(--text-secondary)]">
                    今天
                  </h4>
                  {renderSessionList(todaySessions, "写作")}
                </div>
                <div className="history-section mb-6">
                  <h4 className="mb-3 m-0 text-sm font-medium text-[var(--text-secondary)]">
                    7天内
                  </h4>
                  {renderSessionList(weekSessions, "创作")}
                </div>
                <div className="history-section mb-6">
                  <h4 className="mb-3 m-0 text-sm font-medium text-[var(--text-secondary)]">
                    30天内
                  </h4>
                  {renderSessionList(monthSessions, "创作")}
                </div>
                {!hasAnySessions && (
                  <div className="no-history py-10 text-center text-sm text-[var(--text-muted)]">
                    暂无最近聊天
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }
);

ChatHeader.displayName = "ChatHeader";
