import { useRef, useCallback, useEffect, useState, useMemo } from "react";
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
import type {
  ChatMessage,
  FileItem as FileItemType,
} from "@/stores/chatStore";
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

const EDITOR_PLACEHOLDER = `请输入内容或在右侧对话区指导AI创作...
tips:
·AI创作时将锁定该区域，读取最新内容创作。
·选中部分内容，可使用AI划词进行局部修改。`;

const getWordCount = (text: string): number => {
  if (!text || typeof text !== "string") return 0;
  return text.replace(/\s/g, "").length;
};

const MarkdownEditorPage = () => {
  const navigate = useNavigate();
  const { workId } = useParams<{ workId: string }>();
  const stepWorkflowRef = useRef<StepWorkflowRef>(null);

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
    <div className="flex h-screen w-full flex-col bg-[var(--bg-primary)]">
      <EditorTopToolbar
        onBackClick={handleBackClick}
        onSaveClick={handleSaveClick}
        onUpdateTitle={handleTitleUpdate}
        onHelpWriteClick={helpWriteClick}
        updatedTime={workInfo.updatedTime}
      />

      <div className="flex flex-1 min-h-0 px-2.5 pb-2.5 pt-0 bg-(--bg-editor)">
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
          onDragStart={() => {}}
          onDrag={() => {}}
          className="shrink-0"
        />

        {/* 右侧聊天面板：与 NuxtUIProChatContainer 一致，chat-dashboard-panel + chat-panel-body 结构 */}
        <div
          className="shrink-0 h-full flex flex-col rounded-[20px] border border-[var(--border-color)] overflow-hidden bg-[var(--bg-primary)]"
          style={{ width: "32.5rem" }}
        >
          <div className="flex-1 min-h-0 p-2 flex flex-col">
            <ProChatContainer
              workId={workId ?? undefined}
              activeTab="chat"
              onSendMessage={() => {}}
              onSaveCurrentSession={() => {}}
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
                        "rounded-lg px-3 py-2 text-sm",
                        msg.role === "user"
                          ? "ml-8 bg-primary text-primary-foreground"
                          : "mr-8 bg-muted"
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarkdownEditorPage;
