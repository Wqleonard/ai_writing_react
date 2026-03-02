import { useRef, useCallback, useEffect, useState, useMemo, type RefObject } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import clsx from "clsx";
import MarkdownEditor from "@/components/MarkdownEditor";
import { StepWorkflow, type StepWorkflowRef } from "@/components/StepWorkflow";
import IconFont from "@/components/IconFont/Iconfont";
import { EditorTopToolbar, EditorTreeSidebar, EditorResizeHandle } from "./components";
import { ProChatContainer, ProChatPanel } from "@/components/ProChatContainer";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { FileMessageDisplay } from "@/components/FileMessageDisplay";
import { SelectedTextDisplay } from "@/components/SelectedTextDisplay";
import { AgentCustomMessageRenderer } from "@/components/AgentCustomMessageRenderer";
import { AssociationSelectorDialog } from "@/components/AssociationSelectorDialog";
import { ChatHeader, type ChatHeaderRef } from "@/components/ChatHeader";
import InsCanvas, { type InsCanvasApi } from "@/components/InsCanvas/InsCanvas";
import { Button } from "@/components/ui/Button";
import { useDualTabChat } from "@/hooks/useDualTabChat";
import { useLangGraphStream } from "@/hooks/useLangGraphStream";
import { useLLM } from "@/hooks/useLLM";
import type {
  ChatMessage,
  FileItem as FileItemType,
} from "@/stores/chatStore";
import type { ChatMessage as DualTabChatMessage } from "@/types/chat";
import { useChatInputStore } from "@/stores/chatInputStore";
import { updateWorkInfoReq } from "@/api/works";
import {
  useEditorStore,
  DEFAULT_EDITING_FILE_KEY,
} from "@/stores/editorStore";
import { serverDataToTree, findNodeLabelById } from "@/stores/editorStore/utils";

/** 根据当前文件路径和新的 label 生成新路径，如 "正文/第一章.md" + "第二章" => "正文/第二章.md" */
const getNewPathFromLabel = (currentPath: string, newLabel: string): string => {
  const parts = currentPath.split("/").filter(Boolean);
  if (parts.length === 0) return newLabel;
  const last = parts[parts.length - 1] ?? "";
  const ext = last.includes(".") ? last.replace(/^.*\./, ".") : "";
  const parentPrefix = parts.length > 1 ? parts.slice(0, -1).join("/") + "/" : "";
  const labelWithExt = newLabel.includes(".") ? newLabel : newLabel + ext;
  return parentPrefix + labelWithExt;
};

const REM_BASE = 16;
const pxToRem = (px: number) => px / REM_BASE;

const LEFT_MIN_REM = pxToRem(200);
const LEFT_MAX_REM = pxToRem(500);
const LEFT_DEFAULT_REM = pxToRem(280);

const RIGHT_DEFAULT_REM = 32.5;
const RIGHT_MIN_REM = pxToRem(280);
const RIGHT_MAX_REM = pxToRem(640);
/** 两侧把手总宽度 (10px * 2)，用于右拖时计算右栏上限 */
const HANDLES_WIDTH_REM = pxToRem(20);
/** 三栏容器水平 padding (px-2.5 左右各 10px)，计算右栏上限时需扣除避免溢出 */
const CONTAINER_PADDING_PX = 20;

const EDITOR_PLACEHOLDER = `请输入内容或在右侧对话区指导AI创作...
tips:
·AI创作时将锁定该区域，读取最新内容创作。
·选中部分内容，可使用AI划词进行局部修改。`;

const getWordCount = (text: string): number => {
  if (!text || typeof text !== "string") return 0;
  return text.replace(/\s/g, "").length;
};

/** 画布 tab 下与 ChatHeader tab 同一排的操作按钮，由 InsCanvas 通过 ref 提供 API */
function CanvasToolbar({ apiRef }: { apiRef: RefObject<InsCanvasApi | null> }) {
  const api = apiRef.current;
  if (!api) return null;
  return (
    <div className="flex h-10 items-center gap-1 px-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={api.isLoading}
        onClick={api.addNewCanvas}
        title={api.isLoading ? "生成选题中，请稍候" : "新增画布"}
        aria-label="新增画布"
      >
        <span className="iconfont !text-xs">&#xe625;</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={api.openHistory}
        title="历史版本"
        aria-label="历史版本"
      >
        <span className="iconfont icon-BtnChatHistory" aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={!api.inspirationDrawId}
        onClick={() => void api.saveCanvas()}
        title={api.inspirationDrawId ? "保存画布" : "请先创建画布"}
        aria-label="保存画布"
      >
        <span className="iconfont">&#xe936;</span>
      </Button>
    </div>
  );
}

const MarkdownEditorPage = () => {
  const navigate = useNavigate();
  const { workId } = useParams<{ workId: string }>();
  const stepWorkflowRef = useRef<StepWorkflowRef>(null);

  // chatheader 相关
  const [
    activeTab,
    setActiveTab,
  ] = useState<"chat" | "faq" | "canvas">("chat");
  const {
    currentWorkId,
    chatCurrentSession,
    faqCurrentSession,
    chatMessages,
    setWorkId,
    createNewSession,
    loadSession,
    saveCurrentSession,
    addMessage: addMessageToDualTab,
  } = useDualTabChat();

  const currentSessionId =
    activeTab === "chat"
      ? chatCurrentSession?.id ?? ""
      : activeTab === "faq"
        ? faqCurrentSession?.id ?? ""
        : "";

  const { modelLLM, selectedWritingStyle } = useLLM();
  const streamingMessageRef = useRef<ChatMessage | null>(null);
  const streamingMessageIdRef = useRef<string>("");
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
  const langGraphStream = useLangGraphStream({
    onMessagesUpdate: (messages) => {
      setStreamingMessage((prev) => {
        const id = (prev?.id ?? streamingMessageIdRef.current) || `assistant_${Date.now()}`;
        if (!streamingMessageIdRef.current) streamingMessageIdRef.current = id;
        const msg: ChatMessage = {
          id,
          role: "assistant",
          content: "",
          createdAt: prev?.createdAt ?? new Date(),
          messageType: "normal",
          mode: "chat",
          customMessage: messages,
        };
        streamingMessageRef.current = msg;
        return msg;
      });
    },
    onComplete: () => {
      if (streamingMessageRef.current) {
        addMessageToDualTab("chat", streamingMessageRef.current as DualTabChatMessage);
      }
      setStreamingMessage(null);
      streamingMessageRef.current = null;
      streamingMessageIdRef.current = "";
    },
    onError: (err, needSendErrorMsg) => {
      if (needSendErrorMsg) toast.error(err.message);
      setStreamingMessage(null);
      streamingMessageRef.current = null;
      streamingMessageIdRef.current = "";
    },
  });

  const chatHeaderRef = useRef<ChatHeaderRef>(null);
  const insCanvasRef = useRef<InsCanvasApi | null>(null);
  const [, setCanvasReadyKey] = useState(0);
  const onCanvasReady = useCallback(() => setCanvasReadyKey((k) => k + 1), []);

  // editor 相关
  const workInfo = useEditorStore((s) => s.workInfo);
  const serverData = useEditorStore((s) => s.serverData);
  const currentEditingId = useEditorStore((s) => s.currentEditingId);
  const initEditorData = useEditorStore((s) => s.initEditorData);
  const saveEditorData = useEditorStore((s) => s.saveEditorData);
  const setServerDataFile = useEditorStore((s) => s.setServerDataFile);
  const setWorkInfo = useEditorStore((s) => s.setWorkInfo);
  const renameServerDataPath = useEditorStore((s) => s.renameServerDataPath);

  const [leftPanelWidthRem, setLeftPanelWidthRem] = useState(LEFT_DEFAULT_REM);
  const dragStartLeftRem = useRef(LEFT_DEFAULT_REM);
  const [rightPanelWidthRem, setRightPanelWidthRem] = useState(RIGHT_DEFAULT_REM);
  const dragStartRightRem = useRef(RIGHT_DEFAULT_REM);
  const resizeContainerRef = useRef<HTMLDivElement>(null);
  const [showAssociationSelector, setShowAssociationSelector] = useState(false);
  const [isAnswerOnly, setIsAnswerOnly] = useState(true);

  const associationTags = useChatInputStore((s) => s.associationTags);
  const setAssociationTags = useChatInputStore((s) => s.setAssociationTags);
  const sidebarTreeData = useMemo(
    () => serverDataToTree(serverData),
    [serverData]
  );

  // 避免在 React StrictMode 下重复请求作品详情
  const lastInitWorkIdRef = useRef<string | null>(null);

  // 标题（当前文件名）编辑：与 Vue startEditingLabel / saveLabelEdit / cancelLabelEdit 对齐
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editingLabelValue, setEditingLabelValue] = useState("");
  const isSavingLabelRef = useRef(false);
  const labelInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!workId) return;
    if (lastInitWorkIdRef.current === workId) return;
    lastInitWorkIdRef.current = workId;
    void initEditorData(workId);
  }, [workId, initEditorData]);

  // 进入编辑器后，默认选中「第一章」：优先选正文目录下的首个 .md 文件
  useEffect(() => {
    // serverData 还未加载完成
    if (!serverData || Object.keys(serverData).length === 0) return;
    // 用户已经有当前编辑文件且存在于 serverData，则不干预
    if (currentEditingId && serverData[currentEditingId] !== undefined) return;

    const allMdKeys = Object.keys(serverData).filter((k) => k.endsWith(".md"));
    if (allMdKeys.length === 0) return;

    // 优先正文目录下的章节，例如 "正文/第一章.md"
    const chapterCandidates = allMdKeys
      .filter((k) => k.startsWith("正文/"))
      .sort();

    const targetKey =
      chapterCandidates[0] ??
      allMdKeys.sort()[0] ??
      DEFAULT_EDITING_FILE_KEY;

    const setCurrentEditingId = useEditorStore.getState().setCurrentEditingId;
    setCurrentEditingId(targetKey);
  }, [serverData, currentEditingId]);

  const handleBackClick = useCallback(() => {
    navigate("/workspace/my-place", { replace: true });
  }, [navigate]);

  const handleSaveClick = useCallback(async () => {
    await saveEditorData("0", true);
  }, [saveEditorData]);

  const handleTitleUpdate = useCallback(
    async (newTitle: string) => {
      if (!workId || !newTitle?.trim()) return;
      await updateWorkInfoReq(workId, { title: newTitle.trim() });
      setWorkInfo({ title: newTitle.trim() });
    },
    [workId, setWorkInfo]
  );

  const notAbleClick = useCallback(() => {
    toast.info("暂未开放，敬请期待");
  }, []);

  const helpWriteClick = useCallback(() => {
    stepWorkflowRef.current?.openStepCreateDialog();
  }, []);

  const onLeftResizeStart = useCallback(() => {
    dragStartLeftRem.current = leftPanelWidthRem;
  }, [leftPanelWidthRem]);

  const onLeftResize = useCallback((deltaX: number) => {
    const deltaRem = pxToRem(deltaX);
    const newWidth = Math.max(
      LEFT_MIN_REM,
      Math.min(LEFT_MAX_REM, dragStartLeftRem.current + deltaRem)
    );
    setLeftPanelWidthRem(newWidth);
  }, []);

  const onRightResizeStart = useCallback(() => {
    dragStartRightRem.current = rightPanelWidthRem;
  }, [rightPanelWidthRem]);

  const onRightResize = useCallback((adjustedDeltaX: number) => {
    // position="right" 时组件传入 -deltaX；右栏上限=内容区宽-左栏-把手，扣除容器 padding 避免出现横向滚动条
    const deltaRem = pxToRem(adjustedDeltaX);
    const el = resizeContainerRef.current;
    const contentWidthPx = el ? el.clientWidth - CONTAINER_PADDING_PX : 0;
    const totalRem = contentWidthPx > 0 ? contentWidthPx / REM_BASE : 0;
    const maxRight =
      totalRem > 0
        ? totalRem - leftPanelWidthRem - HANDLES_WIDTH_REM
        : Number.POSITIVE_INFINITY;
    const raw = dragStartRightRem.current + deltaRem;
    const newWidth = Math.max(
      RIGHT_MIN_REM,
      Math.min(maxRight, raw)
    );
    setRightPanelWidthRem(newWidth);
  }, [leftPanelWidthRem]);

  const fileKey = currentEditingId || DEFAULT_EDITING_FILE_KEY;
  // 仅当 serverData 的 key 列表变化时重建树，避免每次输入都跑 serverDataToTree
  const serverDataKeysSig = useMemo(
    () => Object.keys(serverData ?? {}).sort().join(","),
    [serverData]
  );
  const treeData = useMemo(() => serverDataToTree(serverData ?? {}), [
    // 仅随路径列表变化重建树；serverData 在 serverDataKeysSig 变化的那次渲染中已为最新
    serverDataKeysSig,
  ]);
  const currentLabel = useMemo(
    () => (currentEditingId ? findNodeLabelById(treeData, currentEditingId) : ""),
    [treeData, currentEditingId]
  );
  const currentContent = serverData[fileKey] ?? "";
  const wordCount = useMemo(() => getWordCount(currentContent), [currentContent]);

  // 点击标题进入编辑（与 Vue startEditingLabel 一致）
  const startEditingLabel = useCallback((label: string) => {
    setEditingLabelValue(label);
    setIsEditingLabel(true);
    isSavingLabelRef.current = false;
  }, []);

  // 失焦或 Enter 保存（与 Vue saveLabelEdit 一致）
  const saveLabelEdit = useCallback(() => {
    if (isSavingLabelRef.current) return;
    isSavingLabelRef.current = true;

    const trimmed = editingLabelValue.trim();
    if (!trimmed) {
      toast.warning("文件名不能为空");
      isSavingLabelRef.current = false;
      return;
    }
    if (!currentEditingId) {
      isSavingLabelRef.current = false;
      return;
    }
    if (trimmed === currentLabel) {
      setIsEditingLabel(false);
      isSavingLabelRef.current = false;
      return;
    }

    const newPath = getNewPathFromLabel(currentEditingId, trimmed);
    renameServerDataPath(currentEditingId, newPath);
    toast.success("文件名已更新");
    setIsEditingLabel(false);
    isSavingLabelRef.current = false;
  }, [editingLabelValue, currentEditingId, currentLabel, renameServerDataPath]);

  // Esc 取消编辑（与 Vue cancelLabelEdit 一致）
  const cancelLabelEdit = useCallback(() => {
    setIsEditingLabel(false);
    setEditingLabelValue("");
    isSavingLabelRef.current = false;
  }, []);

  // 进入编辑态后聚焦并选中输入框
  useEffect(() => {
    if (!isEditingLabel) return;
    const t = setTimeout(() => {
      labelInputRef.current?.focus();
      labelInputRef.current?.select();
    }, 0);
    return () => clearTimeout(t);
  }, [isEditingLabel]);

  // 切换当前文件时退出标题编辑态
  useEffect(() => {
    if (!currentEditingId) setIsEditingLabel(false);
  }, [currentEditingId]);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[var(--bg-primary)]">
      <EditorTopToolbar
        onBackClick={handleBackClick}
        onSaveClick={handleSaveClick}
        onUpdateTitle={handleTitleUpdate}
        onHelpWriteClick={helpWriteClick}
        updatedTime={workInfo.updatedTime}
      />

      <div
        ref={resizeContainerRef}
        className="flex flex-1 min-h-0 min-w-0 overflow-hidden px-2.5 pb-2.5 pt-0 bg-(--bg-editor)"
      >
        {/* 左侧面板 */}
        <div
          className="shrink-0 h-full rounded-[20px] border border-[var(--border-color)] overflow-hidden bg-[var(--bg-primary)] p-2"
          style={{ width: `${leftPanelWidthRem}rem` }}
        >
          <EditorTreeSidebar className="h-full" />
        </div>

        <EditorResizeHandle
          position="left"
          onDragStart={onLeftResizeStart}
          onDrag={onLeftResize}
          className="shrink-0"
        />

        {/* 中间编辑面板 */}
        <div className="flex-1 min-w-0 flex flex-col h-full rounded-[20px] border border-[var(--border-color)] overflow-hidden bg-[var(--bg-editor)]">
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
            {/* 字数栏 */}
            <div className="flex flex-row-reverse h-[38px] px-6 items-center shrink-0">
              <div className="flex h-full items-center gap-0">
                <span className="text-sm text-(--text-primary)">字数: {wordCount}</span>
                <div className="w-px h-[14px] bg-[#9a9a9a] mx-2.5" />
                <div
                  role="button"
                  tabIndex={0}
                  className="p-0 text-base hover:bg-[#d0d0d0] rounded flex items-center justify-center w-8 h-8"
                  title="撤销 (Ctrl+Z)"
                  onClick={notAbleClick}
                >
                  <IconFont unicode="\ue61b" className="text-base" />
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  className="p-0 text-base hover:bg-[#d0d0d0] rounded flex items-center justify-center w-8 h-8"
                  title="反撤销 (Ctrl+Y)"
                  onClick={notAbleClick}
                >
                  <IconFont unicode="\ue61c" className="text-base" />
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  className="p-0 text-base hover:bg-[#d0d0d0] rounded flex items-center justify-center w-8 h-8"
                  title="查找替换"
                  onClick={notAbleClick}
                >
                  <IconFont unicode="\ue61e" className="text-base" />
                </div>
                <div className="w-px h-[14px] bg-[#9a9a9a] mx-2.5" />
                <div
                  role="button"
                  tabIndex={0}
                  className="p-0 text-base hover:bg-[#d0d0d0] rounded flex items-center justify-center w-8 h-8"
                  title="时光机"
                  onClick={notAbleClick}
                >
                  <IconFont unicode="\ue61d" className="text-base" />
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  className="p-0 text-base hover:bg-[#d0d0d0] rounded flex items-center justify-center w-8 h-8"
                  title="设置"
                  onClick={notAbleClick}
                >
                  <IconFont unicode="\ue61a" className="text-base" />
                </div>
              </div>
            </div>

            {/* 编辑区主体 */}
            <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative px-[40px]">
                <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  <div className="flex flex-col flex-1 min-h-0">
                    {currentEditingId ? (
                      isEditingLabel ? (
                        <input
                          ref={labelInputRef}
                          type="text"
                          className="px-2 py-1 h-9 w-full leading-9 text-[30px] text-[var(--text-primary)] truncate shrink-0 border border-transparent rounded bg-transparent outline-none focus:border-[var(--primary)]"
                          value={editingLabelValue}
                          onChange={(e) => setEditingLabelValue(e.target.value)}
                          onBlur={saveLabelEdit}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              saveLabelEdit();
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              cancelLabelEdit();
                            }
                          }}
                        />
                      ) : (
                        <div
                          role="button"
                          tabIndex={0}
                          className="h-9 leading-9 text-[30px] text-[var(--text-primary)] truncate shrink-0 cursor-pointer"
                          onClick={() => startEditingLabel(currentLabel)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              startEditingLabel(currentLabel);
                            }
                          }}
                        >
                          {currentLabel}
                        </div>
                      )
                    ) : (
                      <div className="h-9 leading-9 text-[30px] text-[var(--text-primary)] truncate shrink-0">
                        {currentLabel}
                      </div>
                    )}
                    <div className="flex-1 min-h-[200px] flex flex-col">
                      <MarkdownEditor
                        value={currentContent}
                        onChange={(markdown) => setServerDataFile(fileKey, markdown)}
                        placeholder={EDITOR_PLACEHOLDER}
                      />
                    </div>
                  </div>
                  <StepWorkflow ref={stepWorkflowRef} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <EditorResizeHandle
          position="right"
          onDragStart={onRightResizeStart}
          onDrag={onRightResize}
          className="shrink-0"
        />

        {/* 右侧聊天面板：与 Vue 一致，chat-content 内仅消息区滚动、输入框固定在底部 */}
        <div
          className="shrink-0 h-full flex flex-col rounded-[20px] border border-[var(--border-color)] overflow-hidden bg-[var(--bg-primary)] isolate"
          style={{ width: `${rightPanelWidthRem}rem` }}
        >
          <ChatHeader
            ref={chatHeaderRef}
            activeTab={activeTab}
            currentSessionId={currentSessionId}
            workId={workId}
            onTabChange={setActiveTab}
            onNewChat={() => createNewSession(activeTab)}
            onSwitchSession={(id) => loadSession(activeTab, id)}
            onSaveCurrentSession={() => saveCurrentSession(activeTab)}
            checkStreamingStatusAndConfirm={async () => true}
            canvasActionsSlot={
              activeTab === "canvas" ? (
                <CanvasToolbar apiRef={insCanvasRef} />
              ) : null
            }
          />
          <div className="flex-1 min-h-0 p-2 flex flex-col overflow-hidden">
            {activeTab === "canvas" ? (
              workId ? (
                <InsCanvas
                  ref={insCanvasRef}
                  workId={workId}
                  onMessage={(type, msg) => {
                    if (type === "success") toast.success(msg);
                    else if (type === "error") toast.error(msg);
                    else toast(msg);
                  }}
                  onCanvasReady={onCanvasReady}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  请先选择或创建作品
                </div>
              )
            ) : (
              <>
                <ProChatContainer
                  workId={workId ?? undefined}
                  activeTab="chat"
                  messages={
                    streamingMessage
                      ? [...chatMessages, streamingMessage]
                      : chatMessages
                  }
                  sessionId={chatCurrentSession?.id ?? ""}
                  onSendMessage={(msg: ChatMessage) => {
                    let sessionId = chatCurrentSession?.id ?? "";
                    if (!chatCurrentSession) {
                      const session = createNewSession("chat");
                      sessionId = session.id;
                    }
                    addMessageToDualTab("chat", msg as DualTabChatMessage);
                    if (workId && sessionId) {
                      const placeholderId = `assistant_${Date.now()}`;
                      streamingMessageIdRef.current = placeholderId;
                      const placeholder: ChatMessage = {
                        id: placeholderId,
                        role: "assistant",
                        content: "",
                        createdAt: new Date(),
                        messageType: "normal",
                        mode: "chat",
                        customMessage: [],
                      };
                      streamingMessageRef.current = placeholder;
                      setStreamingMessage(placeholder);
                      langGraphStream.submit(
                        msg.content ?? "",
                        sessionId,
                        workId,
                        isAnswerOnly ? "agent" : "chat",
                        undefined,
                        undefined,
                        undefined,
                        undefined,
                        modelLLM,
                        selectedWritingStyle
                      );
                    }
                  }}
                  onSaveCurrentSession={() => saveCurrentSession("chat")}
                  checkStreamingStatusAndConfirm={async () => true}
                  isHomePage={false}
                  hideAssociationFeature={false}
                  onOpenAssociationSelector={() => setShowAssociationSelector(true)}
                  isAnswerOnly={isAnswerOnly}
                  onAnswerOnlyChange={setIsAnswerOnly}
                  slots={{
                    renderMessage: (msg: ChatMessage) => {
                      const hasCustomMessage =
                        msg.customMessage &&
                        Array.isArray(msg.customMessage) &&
                        msg.customMessage.length > 0;
                      const hasFiles =
                        msg.files && Array.isArray(msg.files) && msg.files.length > 0;
                      const hasSelectedTexts =
                        msg.selectedTexts &&
                        Array.isArray(msg.selectedTexts) &&
                        msg.selectedTexts.length > 0;
                      const hasFilesOrSelected = hasFiles || hasSelectedTexts;

                      return (
                        <div
                          className={clsx(
                            "w-full flex text-sm",
                            msg.role === "user" ? "justify-end" : "justify-start"
                          )}
                        >
                          <div
                            className={clsx(
                              "rounded-lg px-3 py-2 max-w-[85%]",
                              msg.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            )}
                          >
                          {hasCustomMessage ? (
                            <AgentCustomMessageRenderer
                              customMessage={msg.customMessage!}
                              activeTab="chat"
                              isLastMessage={false}
                              onFileNameClick={(_fileName: string) => {
                                // TODO: 与编辑器联动定位到文件
                              }}
                            />
                          ) : (
                            <>
                              {hasFilesOrSelected && (
                                <div className="message-with-files space-y-1">
                                  {hasSelectedTexts && (
                                    <SelectedTextDisplay
                                      texts={msg.selectedTexts!}
                                    />
                                  )}
                                  {hasFiles && (
                                    <FileMessageDisplay
                                      files={msg.files as FileItemType[]}
                                      onFileClick={() => {}}
                                    />
                                  )}
                                  <div className="message-content-wrapper text-right">
                                    <MarkdownRenderer
                                      content={msg.content || ""}
                                      onFileNameClick={() => {}}
                                    />
                                  </div>
                                </div>
                              )}
                              {!hasFilesOrSelected && (
                                <div className="message-content-wrapper whitespace-pre-wrap break-words">
                                  <MarkdownRenderer
                                    content={msg.content || "(无文本)"}
                                    onFileNameClick={() => {}}
                                  />
                                </div>
                              )}
                            </>
                          )}
                          </div>
                        </div>
                      );
                    },
                    footer: (
                      <div className="text-center py-2 px-4 text-[11px] text-[#ccc] w-full">
                        AI 生成内容仅供参考
                      </div>
                    ),
                  }}
                >
                  <ProChatPanel />
                </ProChatContainer>
                <AssociationSelectorDialog
                  open={showAssociationSelector}
                  onOpenChange={setShowAssociationSelector}
                  treeData={sidebarTreeData}
                  selectedIds={associationTags}
                  onConfirm={(ids) => {
                    const filtered = ids.filter(
                      (id) =>
                        !ids.some(
                          (other) =>
                            other !== id && (id.startsWith(`${other}/`) || id === `${other}/`)
                        )
                    );
                    setAssociationTags(filtered);
                  }}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarkdownEditorPage;
