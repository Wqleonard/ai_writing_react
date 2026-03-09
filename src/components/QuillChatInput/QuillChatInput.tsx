"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import clsx from "clsx"
import {
  Loader2,
  FileText,
  Trash2,
  ChevronDown,
  ChevronUp,
  Link,
  Upload,
} from "lucide-react"
import { Iconfont } from "@/components/IconFont"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverAnchor,
} from "@/components/ui/Popover"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/Tooltip"
import { Button } from "@/components/ui/Button"
import { useChatInputStore } from "@/stores/chatInputStore"
import { useModels } from "@/hooks/useModels"
import { useLLM } from "@/hooks/useLLM"
import { useLoginStore } from "@/stores/loginStore"
import { getWritingStylesListReq } from "@/api/writing-styles"
import { WritingStyleDialog } from "@/components/Community/WritingStyleDialog"
import { useMemeWords } from "@/hooks/useMemeWords"
import { useQuickToolComposer } from "@/hooks/useQuickToolComposer"
import { useChatInputActions } from "@/hooks/useChatInputActions"
import { uploadFileReq } from "@/api/files"
import { openLoginDialog } from "@/components/LoginDialog"
import { toast } from "sonner"
import { subscribeChatSubmitBridge } from "@/services/chatSubmitBridge"

export type QuillChatInputStatus = "ready" | "error" | "submitted" | "streaming"

export interface QuillChatInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  /** 流式请求中点击发送按钮时调用，用于取消流式接口 */
  onStopStreaming?: () => void
  placeholder?: string
  status?: QuillChatInputStatus
  disabled?: boolean
  activeTab?: string
  isHomePage?: boolean
  isAnswerOnly?: boolean
  onAnswerOnlyChange?: (value: boolean) => void
  onDrop?: (event: React.DragEvent) => void
  hideAssistUI?: boolean
  clearOnSubmit?: boolean
  hasMessages?: boolean
  hideAssociationFeature?: boolean
  onOpenAssociationSelector?: () => void
  className?: string
}

const QuillChatInput: React.FC<QuillChatInputProps> = (props) => {
  const {
    value,
    onChange,
    onSubmit,
    onStopStreaming,
    placeholder = "输入消息...",
    status = "ready",
    disabled = false,
    isHomePage = false,
    isAnswerOnly = true,
    onAnswerOnlyChange,
    onDrop,
    hideAssistUI = false,
    clearOnSubmit = true,
    hasMessages = false,
    hideAssociationFeature = false,
    onOpenAssociationSelector,
    className,
  } = props

  const { userInfo } = useLoginStore()
  const isLoggedIn = Boolean(userInfo?.id)

  const {
    associationTags,
    selectedNotes,
    selectedFiles,
    selectedTexts,
    isShowAnswerTip,
    isShowWritingStyleTip,
    setShowAnswerTip,
    setShowWritingStyleTip,
    addFile,
    addNote,
    removeNote,
    clearSelectedNotes,
    clearSelectedFiles,
    removeAssociationTag,
    removeFile,
    removeSelectedText,
  } = useChatInputStore()

  const writingStylePopoverRequest = useChatInputStore((s) => s.writingStylePopoverRequest)
  const requestedWritingStyleId = useChatInputStore((s) => s.requestedWritingStyleId)
  const clearWritingStylePopoverRequest = useChatInputStore((s) => s.clearWritingStylePopoverRequest)

  const { quickChatInputChannels } = useModels()
  const {
    modelsLLM,
    modelLLM,
    setModelLLM,
    writingStyles,
    selectedWritingStyle,
    setSelectedWritingStyle,
    setWritingStyles,
  } = useLLM()

  const [writingStylePopoverOpen, setWritingStylePopoverOpen] = useState(false)
  const [modelPopoverOpen, setModelPopoverOpen] = useState(false)
  const [writingStyleDialogOpen, setWritingStyleDialogOpen] = useState(false)
  const [toolPopoverOpen, setToolPopoverOpen] = useState(false)
  const [filePopoverOpen, setFilePopoverOpen] = useState(false)

  const openToolPopover = useCallback(() => setToolPopoverOpen(true), [])
  const openFilePopover = useCallback(() => setFilePopoverOpen(true), [])
  const [isMemeWordsExpanded, setIsMemeWordsExpanded] = useState(true)
  const { memeWords, leftColumnWords, rightColumnWords, collapsedPreviewWords } = useMemeWords({
    disabled: hideAssistUI,
    collapsedPreviewCount: 5,
  })
  const [hoveredDeleteIndex, setHoveredDeleteIndex] = useState<number | null>(null)
  const [hoveredNoteDeleteIndex, setHoveredNoteDeleteIndex] = useState<number | null>(null)
  const [hoveredFileDeleteIndex, setHoveredFileDeleteIndex] = useState<number | null>(null)
  const [hoveredSelectedTextDeleteIndex, setHoveredSelectedTextDeleteIndex] = useState<string | null>(null)
  const [isDeleteIconHovered, setIsDeleteIconHovered] = useState(false)
  const [isNoteDeleteIconHovered, setIsNoteDeleteIconHovered] = useState(false)
  const [isFileDeleteIconHovered, setIsFileDeleteIconHovered] = useState(false)
  const [isSelectedTextDeleteIconHovered, setIsSelectedTextDeleteIconHovered] = useState(false)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [dragCounter, setDragCounter] = useState(0)
  const [isDropUploading, setIsDropUploading] = useState(false)

  const [hovered, setHovered] = useState(false)
  const valueRef = useRef(value)
  const pendingBridgeSubmitTextRef = useRef<string | null>(null)
  const lastWritingStylePopoverRequestRef = useRef<number>(0)

  useEffect(() => {
    valueRef.current = value
  }, [value])

  // 外部（如：创建文风后跳转 my-place）请求打开“文风选择弹窗”
  useEffect(() => {
    if (!writingStylePopoverRequest) return
    if (lastWritingStylePopoverRequestRef.current === writingStylePopoverRequest) return
    lastWritingStylePopoverRequestRef.current = writingStylePopoverRequest

    // 对齐 Vue：只展示提示气泡，不自动展开下拉
    if (isAnswerOnly) setShowAnswerTip(true)

    if (requestedWritingStyleId) {
      setSelectedWritingStyle(String(requestedWritingStyleId))
    }
    setShowWritingStyleTip(true)
    clearWritingStylePopoverRequest()
  }, [
    writingStylePopoverRequest,
    requestedWritingStyleId,
    clearWritingStylePopoverRequest,
    isAnswerOnly,
    setShowAnswerTip,
    setShowWritingStyleTip,
    setSelectedWritingStyle,
  ])

  const isExternalFileDrag = useCallback((e: React.DragEvent) => {
    const transfer = e.dataTransfer
    if (!transfer) return false
    if (transfer.files && transfer.files.length > 0) return true
    return Array.from(transfer.types || []).includes("Files")
  }, [])

  const validateDragFileType = useCallback((file: File) => {
    const allowedTypes = [
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ]
    const allowedExtensions = [".doc", ".docx", ".txt"]
    if (allowedTypes.includes(file.type)) return true
    const lowerName = file.name.toLowerCase()
    return allowedExtensions.some((ext) => lowerName.endsWith(ext))
  }, [])

  const handleDroppedFile = useCallback(
    async (file: File) => {
      if (!isLoggedIn) {
        await openLoginDialog()
        return
      }
      if (!validateDragFileType(file)) {
        toast.error("不支持的文件格式，请选择 doc、docx 或 txt 文件")
        return
      }
      const maxSize = 10 * 1024 * 1024
      if (file.size > maxSize) {
        toast.error("文件大小不能超过10MB")
        return
      }
      try {
        setIsDropUploading(true)
        const result = await uploadFileReq(file)
        addFile({
          id: `file_${Date.now()}`,
          originalName: file.name,
          serverFileName: result.fileName,
          putFilePath: result.putFilePath,
          displayUrl: result.putFilePath,
          type: file.type,
          size: file.size,
          extension: file.name.split(".").pop() || "",
        })
        toast.success(`文件 "${file.name}" 上传成功`)
      } catch {
        toast.error("文件上传失败，请重试")
      } finally {
        setIsDropUploading(false)
      }
    },
    [addFile, isLoggedIn, validateDragFileType]
  )

  const canMove = value.trim() && !disabled
  /** 流式时可点击按钮取消；非流式时仅在有内容且未禁用时可点击发送 */
  const isButtonClickable = status === "streaming" ? !!onStopStreaming : canMove
  // 富文本容器引用（工具模式下使用 contenteditable + span + input-tag）
  const richTextRef = useRef<HTMLDivElement | null>(null)
  const clearRichTextDom = useCallback(() => {
    if (richTextRef.current) {
      richTextRef.current.innerHTML = ""
    }
  }, [])
  const {
    selectedTool,
    currentChannel,
    closeToolMode: closeRichTextMode,
    handleToolTagClick,
  } = useQuickToolComposer({
    channels: quickChatInputChannels,
    onChange,
    onCloseMode: clearRichTextDom,
  })

  const hasTags =
    associationTags.length > 0 ||
    selectedNotes.length > 0 ||
    selectedFiles.length > 0 ||
    selectedTexts.length > 0

  useEffect(() => {
    if (!hasTags || !isAnswerOnly) return
    setShowAnswerTip(true)
  }, [hasTags, isAnswerOnly, setShowAnswerTip])

  useEffect(() => {
    if (!isShowAnswerTip) return
    const close = () => setShowAnswerTip(false)
    document.addEventListener("click", close)
    return () => document.removeEventListener("click", close)
  }, [isShowAnswerTip, setShowAnswerTip])

  useEffect(() => {
    if (!isShowWritingStyleTip) return
    const close = () => setShowWritingStyleTip(false)
    document.addEventListener("click", close)
    return () => document.removeEventListener("click", close)
  }, [isShowWritingStyleTip, setShowWritingStyleTip])

  const handleSubmitClick = useCallback(() => {
    if (disabled) return
    const text = value.trim()
    if (!text) return
    clearSelectedNotes()
    clearSelectedFiles()
    onSubmit()
    if (clearOnSubmit) onChange("")
  }, [disabled, value, clearSelectedNotes, clearSelectedFiles, onSubmit, clearOnSubmit, onChange])

  useEffect(() => {
    const unsubscribe = subscribeChatSubmitBridge((payload) => {
      if (payload.source !== "creation-input") return
      const nextText = payload.text.trim()
      if (!nextText) return
      pendingBridgeSubmitTextRef.current = nextText
      if (valueRef.current.trim() === nextText) return
      onChange(nextText)
    })
    return unsubscribe
  }, [onChange])

  useEffect(() => {
    const pendingText = pendingBridgeSubmitTextRef.current
    if (!pendingText) return
    if (value.trim() !== pendingText) return
    if (disabled || status === "submitted" || status === "streaming") return
    pendingBridgeSubmitTextRef.current = null
    handleSubmitClick()
  }, [value, disabled, status, handleSubmitClick])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSubmitClick()
      }
    },
    [handleSubmitClick]
  )

  /** 根据 DOM（tip/text/input-tag/free text）构建纯文本，并通过 onChange 同步到父层 */
  const updateRichTextContent = useCallback(() => {
    const root = richTextRef.current
    if (!root) return

    let fullText = ""

    const traverse = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        fullText += node.textContent ?? ""
        return
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return
      const el = node as HTMLElement

      if (el.classList?.contains("input-tag")) {
        const input = el.querySelector(".input-tag-input") as HTMLInputElement | null
        if (input) {
          fullText += input.value ?? ""
        }
        return
      }

      if (
        el.classList?.contains("text-part") ||
        el.classList?.contains("tip-text")
      ) {
        fullText += el.textContent ?? ""
        return
      }

      // 其它元素，递归子节点
      el.childNodes.forEach(traverse)
    }

    root.childNodes.forEach(traverse)
    onChange(fullText)
  }, [onChange])

  const handleRichTextInput = useCallback(() => {
    updateRichTextContent()
  }, [updateRichTextContent])

  const handleRichTextKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        updateRichTextContent()
        handleSubmitClick()
      }
    },
    [updateRichTextContent, handleSubmitClick]
  )

  const handleMemeWordClick = useCallback(
    (word: { name: string }) => {
      onChange(`请为我生成一篇主题为${word.name}的小说`)
      if (isAnswerOnly) setShowAnswerTip(true)
    },
    [value, onChange, isAnswerOnly, setShowAnswerTip]
  )

  const {
    handleLocalFileSelect,
    handleOpenAssociationSelector,
    handleOpenNotesSelector,
  } = useChatInputActions({
    isLoggedIn,
    addFile,
    addNote,
    clearSelectedNotes,
    onOpenAssociationSelector,
  })

  const isSubmitting = status !== "ready" && status !== "error"
  const currentModelName =
    modelsLLM.find((m) => m.id === modelLLM)?.name || "模型"

  const getMemeNumberClass = (index: number) => {
    if (index === 0) return "number-gold"
    if (index === 1) return "number-blue"
    if (index === 2) return "number-bronze"
    return ""
  }

  const renderBottomControls = () => (
    <div className="input-controls">
      <div className="flex items-center gap-2 w-full justify-between flex-wrap">
        <div className="flex items-center gap-2">
          {/* 选择工具按钮 + 弹窗 - 与 CreationInput 结构一致 */}
          <Popover open={toolPopoverOpen} onOpenChange={setToolPopoverOpen}>
            <Tooltip>
              <PopoverAnchor asChild>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="size-8 rounded-full"
                    onClick={openToolPopover}
                  >
                    <Iconfont unicode="&#xe614;" className="text-sm" />
                  </Button>
                </TooltipTrigger>
              </PopoverAnchor>
              <TooltipContent side="top">选择工具</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-56 p-2" align="center" side="top" sideOffset={8}>
              {quickChatInputChannels.map((channel) => (
                <div
                  key={channel.title}
                  className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted text-sm"
                  onClick={() => {
                    handleToolTagClick(channel.title)
                    setToolPopoverOpen(false)
                  }}
                >
                  {channel.icon && (
                    <span
                      className="iconfont text-sm"
                      dangerouslySetInnerHTML={{ __html: channel.icon }}
                    />
                  )}
                  <span className="text-sm">{channel.title}</span>
                </div>
              ))}
            </PopoverContent>
          </Popover>

          {/* 文件/关联/笔记入口 - 与 CreationInput 结构一致 */}
          <Popover open={filePopoverOpen} onOpenChange={setFilePopoverOpen}>
            <Tooltip>
              <PopoverAnchor asChild>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="size-8 rounded-full"
                    onClick={openFilePopover}
                  >
                    <Iconfont unicode="&#xe613;" className="text-sm" />
                  </Button>
                </TooltipTrigger>
              </PopoverAnchor>
              <TooltipContent side="top">关联文件或更多内容</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-48 p-2" align="center" side="top" sideOffset={8}>
              <div
                className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted text-sm"
                onClick={() => {
                  handleLocalFileSelect()
                  setFilePopoverOpen(false)
                }}
              >
                <Iconfont unicode="&#xe643;" className="size-4 leading-4" />
                <span>从本地文件添加</span>
              </div>
              {!hideAssociationFeature && (
                <div
                  className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted text-sm"
                  onClick={() => {
                    handleOpenAssociationSelector?.()
                    setFilePopoverOpen(false)
                  }}
                >
                  <Link className="h-4 w-4" />
                  关联本书内容
                </div>
              )}
              <div
                className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted text-sm"
                onClick={() => {
                  handleOpenNotesSelector()
                  setFilePopoverOpen(false)
                }}
              >
                <Iconfont unicode="&#xe644;" className="size-4 leading-4" />
                <span>使用全局笔记</span>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-center gap-2 justify-end flex-1">
          {/* 文风选择器 - 参照 Vue WritingStylePopup */}
          {!hideAssistUI && (
            <div className="answer-only-wrap relative">
              {isShowWritingStyleTip && (
                <div className="answer-tip-box">
                  <div className="answer-tip-content">
                    <div className="answer-tip-line1">保存的文风在这</div>
                    <div className="answer-tip-line2">里使用哦！</div>
                  </div>
                </div>
              )}
              <Popover
                open={writingStylePopoverOpen}
                onOpenChange={(open) => {
                  setWritingStylePopoverOpen(open)
                  if (open) {
                    getWritingStylesListReq()
                      .then((res: unknown) => {
                        const list = Array.isArray(res)
                          ? res.map((item: { id?: string; name?: string; isPublic?: boolean }) => ({
                            id: String(item?.id ?? ""),
                            name: String(item?.name ?? ""),
                            isPublic: item?.isPublic !== false,
                          }))
                          : []
                        setWritingStyles(list)
                        // 优先：如果外部请求指定了文风，并且列表里存在，则选中它
                        if (requestedWritingStyleId && list.some((s) => s.id === requestedWritingStyleId)) {
                          setSelectedWritingStyle(requestedWritingStyleId)
                        } else if (list.length > 0 && !selectedWritingStyle) {
                          setSelectedWritingStyle(list[0].id)
                        }
                      })
                      .catch(() => { })
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={isAnswerOnly}
                    className={clsx(
                      "writing-style-trigger inline-flex items-center gap-1 rounded-md outline-none transition-[transform,opacity]",
                      "text-xs text-[var(--text-primary,#333)]",
                      "cursor-pointer hover:opacity-80",
                      "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:opacity-50"
                    )}
                  >
                    <span>
                      {writingStyles.find((s) => s.id === selectedWritingStyle)?.name || "默认文风"}
                    </span>
                    <ChevronDown
                      className={clsx("h-3.5 w-3.5 text-muted-foreground transition-transform duration-200", writingStylePopoverOpen && "rotate-180")}
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  side="top"
                  sideOffset={8}
                  className="w-[200px] p-1 rounded-lg border bg-[var(--bg-primary-overlay,white)] shadow-md"
                >
                  <div className="writing-style-content flex flex-col max-h-[220px]">
                    <div className="style-options overflow-y-auto flex-1 min-h-0 max-h-[180px] py-0.5">
                      {writingStyles.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          className={clsx(
                            "style-option w-full h-9 rounded-lg flex items-center justify-between gap-2 px-3 text-left text-sm transition-colors",
                            opt.id === selectedWritingStyle
                              ? "bg-[var(--bg-hover,#f5f5f5)]"
                              : "hover:bg-[var(--bg-hover,#f5f5f5)]"
                          )}
                          onClick={() => {
                            setSelectedWritingStyle(opt.id)
                            setWritingStylePopoverOpen(false)
                          }}
                        >
                          <span className="option-label text-[var(--text-primary,#303133)] truncate">
                            {opt.name || "未命名"}
                          </span>
                          {(opt as { isPublic?: boolean }).isPublic && (
                            <span className="option-tag shrink-0 text-xs text-muted-foreground">官方</span>
                          )}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="create-writing-style-btn mt-1 h-8 flex items-center justify-center w-full rounded border border-border text-xs hover:bg-muted/80 transition-colors"
                      onClick={() => {
                        setWritingStylePopoverOpen(false)
                        setWritingStyleDialogOpen(true)
                      }}
                    >
                      <span className="mr-1">+</span>
                      <span>创建专属文风</span>
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* 模型选择（对齐 Vue SimpleSelect 结构） */}
          <Popover open={modelPopoverOpen} onOpenChange={setModelPopoverOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="simple-select-trigger inline-flex items-center gap-1 cursor-pointer select-none">
                <span className="text-xs text-[#333333]">{currentModelName}</span>
                <ChevronDown
                  className={clsx(
                    "trigger-arrow h-3.5 w-3.5 text-[#909399] transition-transform duration-300",
                    modelPopoverOpen && "rotate-180"
                  )}
                />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              side="top"
              sideOffset={8}
              className="simple-select-popover w-[200px] p-1 border-0 bg-[var(--bg-primary-overlay,white)] shadow-md"
            >
              <div className="simple-select-content flex flex-col max-h-[220px]">
                <div className="select-options overflow-y-auto flex-1 min-h-0 max-h-[180px]">
                  {modelsLLM.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={clsx(
                        "select-option w-full h-9 rounded-lg overflow-hidden flex items-center justify-between px-3 cursor-pointer transition-colors",
                        m.id === modelLLM
                          ? "is-selected bg-[var(--bg-editor-save)] text-white"
                          : "hover:bg-[var(--bg-hover,#f5f5f5)]"
                      )}
                      onClick={() => {
                        setModelLLM(m.id)
                        setModelPopoverOpen(false)
                      }}
                    >
                      <span className={clsx("option-label text-sm", m.id === modelLLM ? "text-white" : "text-[var(--text-primary,#303133)]")}>
                        {m.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* 仅回答 */}
          {onAnswerOnlyChange && (
            <div className="answer-only-wrap">
              {isShowAnswerTip && (
                <div className="answer-tip-box">
                  <div className="answer-tip-content">
                    <div className="answer-tip-line1">直接成文需要</div>
                    <div className="answer-tip-line2">关闭仅回答哦！</div>
                  </div>
                </div>
              )}
              <label className="answer-only-checkbox flex items-center gap-1.5 cursor-pointer text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={isAnswerOnly}
                  onChange={(e) => onAnswerOnlyChange(e.target.checked)}
                />
                <span>仅回答</span>
              </label>
            </div>
          )}
        </div>
      </div>

      <Button
        className={clsx(
          "w-8 ml-2 h-8 rounded-full flex items-center justify-center",
          isButtonClickable
            ? "cursor-pointer bg-[var(--bg-editor-save)] text-white"
            : "cursor-not-allowed bg-[#e5e5e5] text-[#b7b7b7]"
        )}
        style={{
          transform: hovered && isButtonClickable ? "translateY(-2px)" : "translateY(0px)",
          transition: "transform 150ms ease-out",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => {
          if (status === "streaming") {
            onStopStreaming?.()
          } else if (canMove) {
            handleSubmitClick()
          }
        }}
        disabled={!isButtonClickable}
        title={status === "streaming" ? "停止生成" : undefined}
      >
        {status === "streaming" ? (
          <svg
            className="h-4 w-4 [color:inherit]"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <rect x="4" y="4" width="12" height="12" rx="0.5" fill="currentColor" />
          </svg>
        ) : status === "submitted" ? (
          <Loader2 className="h-4 w-4 animate-spin [color:inherit]" />
        ) : (
          <Iconfont unicode="&#xe615;" className="text-lg [color:inherit]" />
        )}
      </Button>
    </div>
  )

  return (
    <div
      className={clsx("quill-chat-input", className)}
    >
      <div className="todos-input-wrapper space-y-2">
        {/* 悬浮标签区域：与 Vue 对齐，按关联/笔记/文件/划词分组展示 */}
        {hasTags && (
          <div className="floating-tags-container mb-2 space-y-1.5">
            {associationTags.length > 0 && (
              <div className="association-hints-inline">
                <div className="association-hints-content flex flex-wrap gap-1.5">
                  {associationTags.slice(0, 7).map((tag, index) => (
                    <span
                      key={`assoc-${tag}-${index}`}
                      className={clsx(
                        "association-tag inline-flex cursor-pointer items-center gap-1 rounded-[12px] border px-2 py-0.5 text-xs text-[var(--text-primary)] transition-colors",
                        hoveredDeleteIndex === index
                          ? "bg-[var(--bg-hover)] border-[var(--border-hover)]"
                          : "bg-white border-[var(--border-color)]"
                      )}
                      onMouseEnter={() => setHoveredDeleteIndex(index)}
                      onMouseLeave={() => {
                        setHoveredDeleteIndex(null)
                        setIsDeleteIconHovered(false)
                      }}
                    >
                      <span
                        className={clsx(
                          "tag-icon cursor-pointer inline-flex h-4 w-4 items-center justify-center rounded transition-colors",
                          hoveredDeleteIndex === index && "text-red-500",
                          isDeleteIconHovered && hoveredDeleteIndex === index && "brightness-95"
                        )}
                        onClick={() => hoveredDeleteIndex === index ? removeAssociationTag(index) : null}
                        onMouseEnter={() => hoveredDeleteIndex === index ? setIsDeleteIconHovered(true) : null}
                        onMouseLeave={() => hoveredDeleteIndex === index ? setIsDeleteIconHovered(false) : null}
                      >
                        {hoveredDeleteIndex === index ? (
                          <Trash2 className="h-3 w-3 shrink-0" />
                        ) : (
                          <FileText className="h-3 w-3 shrink-0" />
                        )}
                      </span>
                      <span className="tag-text truncate max-w-[120px]">{tag}</span>
                    </span>
                  ))}
                  {associationTags.length > 7 && (
                    <span className="association-ellipsis text-muted-foreground text-xs">...</span>
                  )}
                </div>
              </div>
            )}

            {selectedNotes.length > 0 && (
              <div className="notes-hints-inline">
                <div className="notes-hints-content flex flex-wrap gap-1.5">
                  {selectedNotes.slice(0, 7).map((note) => (
                    <span
                      key={`note-${note.id}`}
                      className={clsx(
                        "note-tag inline-flex cursor-pointer items-center gap-1 rounded-[.75rem] border px-2 py-0.5 text-xs transition-colors",
                        hoveredNoteDeleteIndex === note.id
                          ? "bg-[#fde68a] border-[#d97706] text-[#92400e]"
                          : "bg-[#fef3c7] border-[#f59e0b] text-[#92400e]"
                      )}
                      onMouseEnter={() => setHoveredNoteDeleteIndex(note.id)}
                      onMouseLeave={() => {
                        setHoveredNoteDeleteIndex(null)
                        setIsNoteDeleteIconHovered(false)
                      }}
                    >
                      <span
                        className={clsx(
                          "tag-icon cursor-pointer inline-flex h-4 w-4 items-center justify-center rounded transition-colors",
                          hoveredNoteDeleteIndex === note.id && "text-red-500",
                          isNoteDeleteIconHovered && hoveredNoteDeleteIndex === note.id && "brightness-95"
                        )}
                        onClick={() => hoveredNoteDeleteIndex === note.id ? removeNote(note.id) : null}
                        onMouseEnter={() => hoveredNoteDeleteIndex === note.id ? setIsNoteDeleteIconHovered(true) : null}
                        onMouseLeave={() => hoveredNoteDeleteIndex === note.id ? setIsNoteDeleteIconHovered(false) : null}
                      >
                        {hoveredNoteDeleteIndex === note.id ? (
                          <Trash2 className="h-3 w-3 shrink-0" />
                        ) : (
                          <FileText className="h-3 w-3 shrink-0" />
                        )}
                      </span>
                      <span className="tag-text truncate max-w-[120px]">
                        {((note.title ?? note.content) || "").length > 20
                          ? `${((note.title ?? note.content) || "").slice(0, 20)}...`
                          : (note.title ?? note.content) || ""}
                      </span>
                    </span>
                  ))}
                  {selectedNotes.length > 7 && (
                    <span className="notes-ellipsis text-muted-foreground text-xs">...</span>
                  )}
                </div>
              </div>
            )}

            {selectedFiles.length > 0 && (
              <div className="files-hints-inline">
                <div className="files-hints-content flex flex-wrap gap-1.5">
                  {selectedFiles.slice(0, 7).map((file, index) => (
                    <span
                      key={file.id}
                      className={clsx(
                        "file-tag inline-flex items-center cursor-pointer gap-1 rounded-[12px] border px-2 py-0.5 text-xs transition-colors",
                        hoveredFileDeleteIndex === index
                          ? "bg-[#bae6fd] border-[#0284c7]"
                          : "bg-[#e0f2fe] border-[#0891b2]",
                        "text-[#0c4a6e]"
                      )}
                      onMouseEnter={() => setHoveredFileDeleteIndex(index)}
                      onMouseLeave={() => {
                        setHoveredFileDeleteIndex(null)
                        setIsFileDeleteIconHovered(false)
                      }}
                    >
                      <span
                        className={clsx(
                          "tag-icon cursor-pointer inline-flex h-4 w-4 items-center justify-center rounded transition-colors",
                          hoveredFileDeleteIndex === index && "text-red-500",
                          isFileDeleteIconHovered &&
                          hoveredFileDeleteIndex === index &&
                          "brightness-95"
                        )}
                        onClick={() =>
                          hoveredFileDeleteIndex === index ? removeFile(file.id) : null
                        }
                        onMouseEnter={() =>
                          hoveredFileDeleteIndex === index ? setIsFileDeleteIconHovered(true) : null
                        }
                        onMouseLeave={() =>
                          hoveredFileDeleteIndex === index ? setIsFileDeleteIconHovered(false) : null
                        }
                      >
                        {hoveredFileDeleteIndex === index ? (
                          <Trash2 className="h-3 w-3 shrink-0" />
                        ) : (
                          <FileText className="h-3 w-3 shrink-0" />
                        )}
                      </span>
                      <span className="tag-text truncate max-w-[120px]">{file.originalName}</span>
                    </span>
                  ))}
                  {selectedFiles.length > 7 && (
                    <span className="files-ellipsis text-muted-foreground text-xs">...</span>
                  )}
                </div>
              </div>
            )}

            {selectedTexts.length > 0 && (
              <div className="selected-texts-hints-inline">
                <div className="selected-texts-hints-content flex flex-wrap gap-1.5">
                  {selectedTexts.slice(0, 7).map((text) => (
                    <span
                      key={text.id}
                      className={clsx(
                        "selected-text-tag inline-flex cursor-pointer max-w-[200px] items-center gap-1 rounded-[12px] border px-2 py-0.5 text-xs transition-colors",
                        hoveredSelectedTextDeleteIndex === text.id
                          ? "bg-[#bae6fd] border-[#0284c7]"
                          : "bg-[#e0f2fe] border-[#0891b2]",
                        "text-[#0c4a6e]"
                      )}
                      onMouseEnter={() => setHoveredSelectedTextDeleteIndex(text.id)}
                      onMouseLeave={() => {
                        setHoveredSelectedTextDeleteIndex(null)
                        setIsSelectedTextDeleteIconHovered(false)
                      }}
                    >
                      <span
                        className={clsx(
                          "tag-icon cursor-pointer inline-flex h-4 w-4 items-center justify-center rounded transition-colors",
                          hoveredSelectedTextDeleteIndex === text.id && "text-red-500",
                          isSelectedTextDeleteIconHovered &&
                          hoveredSelectedTextDeleteIndex === text.id &&
                          "brightness-95"
                        )}
                        onClick={() =>
                          hoveredSelectedTextDeleteIndex === text.id
                            ? removeSelectedText(text.id)
                            : null
                        }
                        onMouseEnter={() =>
                          hoveredSelectedTextDeleteIndex === text.id
                            ? setIsSelectedTextDeleteIconHovered(true)
                            : null
                        }
                        onMouseLeave={() =>
                          hoveredSelectedTextDeleteIndex === text.id
                            ? setIsSelectedTextDeleteIconHovered(false)
                            : null
                        }
                      >
                        {hoveredSelectedTextDeleteIndex === text.id ? (
                          <Trash2 className="h-3 w-3 shrink-0" />
                        ) : (
                          <FileText className="h-3 w-3 shrink-0" />
                        )}
                      </span>
                      <span className="tag-text truncate max-w-[160px]">
                        {text.content.length > 20 ? `${text.content.slice(0, 20)}...` : text.content}
                      </span>
                    </span>
                  ))}
                  {selectedTexts.length > 7 && (
                    <span className="selected-texts-ellipsis text-muted-foreground text-xs">...</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 工具标签（快捷入口） */}
        {!hideAssistUI && (
          <div className="tool-tags-container-top">
            {quickChatInputChannels.map((channel) => (
              <div
                key={channel.title}
                className={clsx("tool-tag-top", {
                  active: selectedTool === channel.title && !!currentChannel,
                })}
                title={
                  selectedTool === channel.title && !!currentChannel
                    ? "再次点击切换回普通输入模式"
                    : "点击使用此工具"
                }
                onClick={() => handleToolTagClick(channel.title)}
              >
                {channel.title}
              </div>
            ))}
          </div>
        )}

        <div
          className="input-container-top-normal-container relative"
          onDragEnter={(e) => {
            if (!isExternalFileDrag(e)) return
            e.preventDefault()
            e.stopPropagation()
            setDragCounter((prev) => prev + 1)
            setIsDraggingOver(true)
          }}
          onDragOver={(e) => {
            if (!isExternalFileDrag(e)) return
            e.preventDefault()
            e.stopPropagation()
            e.dataTransfer.dropEffect = "copy"
          }}
          onDragLeave={(e) => {
            if (!isDraggingOver) return
            e.preventDefault()
            e.stopPropagation()
            setDragCounter((prev) => {
              const next = prev - 1
              if (next <= 0) {
                setIsDraggingOver(false)
                return 0
              }
              return next
            })
          }}
          onDrop={async (e) => {
            if (isExternalFileDrag(e)) {
              e.preventDefault()
              e.stopPropagation()
              setIsDraggingOver(false)
              setDragCounter(0)
              const files = e.dataTransfer.files
              const file = files?.[0]
              if (!file) return
              if (isDropUploading) return
              await handleDroppedFile(file)
              return
            }
            e.preventDefault()
            onDrop?.(e)
          }}>
          {currentChannel ? (
            <div className={clsx("rich-text-container", isDraggingOver && "drag-over")}>
              {isDraggingOver && (
                <div className="drag-overlay">
                  <div className="drag-hint">
                    <Upload className="drag-icon h-12 w-12" />
                    <p className="drag-text">释放以上传文件</p>
                    <p className="drag-subtext">支持 doc、docx、txt 格式，最大 10MB</p>
                  </div>
                </div>
              )}
              <div className="rich-input-wrapper">
                <div className={clsx("custom-rich-editor", { "has-error": status === "error" })}>
                  <div
                    ref={richTextRef}
                    className="rich-text-content"
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleRichTextInput}
                    onKeyDown={handleRichTextKeyDown}
                  >
                    {currentChannel.value && currentChannel.value.length > 0 ? (
                      currentChannel.value.map((item, index) => {
                        if (item.mold === "tip") {
                          return (
                            <span key={`tip-${index}`} className="tip-text-wrapper">
                              <span className="tip-text">{item.value}</span>
                              <div
                                className="tip-close-icon"
                                title="切换回普通输入模式"
                                aria-label="关闭并切换回普通输入"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  closeRichTextMode()
                                }}
                              >
                                ×
                              </div>
                            </span>
                          )
                        }

                        if (item.mold === "span") {
                          return (
                            <span key={`span-${index}`} className="text-part">
                              {item.value}
                            </span>
                          )
                        }

                        if (item.mold === "input") {
                          return (
                            <span key={`input-${index}`} className="input-tag" contentEditable={false}>
                              <input
                                type="text"
                                className="input-tag-input"
                                placeholder={item.value}
                                style={{ width: item.width ?? "120px" }}
                              />
                            </span>
                          )
                        }

                        return null
                      })
                    ) : (
                      <span className="text-part">请选择一个工具开始创作</span>
                    )}
                  </div>
                </div>
              </div>

              {renderBottomControls()}
            </div>
          ) : (
            <div className={clsx("normal-input-container", isDraggingOver && "drag-over")}>
              {isDraggingOver && (
                <div className="drag-overlay">
                  <div className="drag-hint">
                    <Upload className="drag-icon h-12 w-12" />
                    <p className="drag-text">释放以上传文件</p>
                    <p className="drag-subtext">支持 doc、docx、txt 格式，最大 10MB</p>
                  </div>
                </div>
              )}
              <div className="input-wrapper">
                <textarea
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  disabled={disabled}
                  rows={3}
                  className={clsx("chat-textarea", { "has-error": status === "error" })}
                />
              </div>

              {renderBottomControls()}
            </div>
          )}
        </div>

        {/* 创作热点（梗词）- 未发送 query 时展示，发送后不展示，与 Vue 一致 */}
        {!hideAssistUI && memeWords.length > 0 && !hasMessages && (
          <div
            className={clsx(
              "meme-words-container-bottom",
              isHomePage && "is-home-page",
              isHomePage && !isMemeWordsExpanded && "is-folded"
            )}
          >
            {(isMemeWordsExpanded || !isHomePage) && (
              <div className="meme-words-container-bottom-content">
                <div className="meme-words-header">
                  <div className="meme-words-title">
                    <Iconfont unicode="&#xe63b;" className="text-[#ff5801] hot-point-icon" />
                    <span>创作热点</span>
                  </div>
                  {isHomePage && (
                    <div
                      className="meme-words-toggle"
                      onClick={() => setIsMemeWordsExpanded((v) => !v)}
                    >
                      {isMemeWordsExpanded ? (
                        <ChevronUp className="toggle-icon" />
                      ) : (
                        <ChevronDown className="toggle-icon" />
                      )}
                    </div>
                  )}
                </div>

                <div className="meme-words-content-grid">
                  <div className="meme-words-column">
                    {leftColumnWords.map((word) => (
                      <div
                        key={`left-${word.name}-${word.originalIndex}`}
                        className="meme-word-item-grid"
                        onClick={() => handleMemeWordClick(word)}
                      >
                        <span
                          className={clsx(
                            "meme-word-number",
                            getMemeNumberClass(word.originalIndex)
                          )}
                        >
                          {word.originalIndex + 1}
                        </span>
                        <span className="meme-word-text" title={word.name}>
                          {word.name}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="meme-words-column">
                    {rightColumnWords.map((word) => (
                      <div
                        key={`right-${word.name}-${word.originalIndex}`}
                        className="meme-word-item-grid"
                        onClick={() => handleMemeWordClick(word)}
                      >
                        <span
                          className={clsx(
                            "meme-word-number",
                            getMemeNumberClass(word.originalIndex)
                          )}
                        >
                          {word.originalIndex + 1}
                        </span>
                        <span className="meme-word-text" title={word.name}>
                          {word.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {isHomePage && !isMemeWordsExpanded && collapsedPreviewWords.length > 0 && (
              <div className="meme-words-preview-row">
                <div className="meme-words-title-collapsed">
                  <Iconfont unicode="&#xe63b;" className="text-[#ff5801] hot-point-icon" />
                  <span>创作热点</span>
                </div>
                <div className="meme-words-preview-tags">
                  {collapsedPreviewWords.map((w, index) => (
                    <React.Fragment key={`${w.name}-${index}`}>
                      <div
                        className="meme-word-preview-item"
                        onClick={() => handleMemeWordClick(w)}
                      >
                        {w.name}
                      </div>
                      {index < collapsedPreviewWords.length - 1 && (
                        <div className="meme-word-preview-separator" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
                <div
                  className="meme-words-toggle"
                  onClick={() => setIsMemeWordsExpanded((v) => !v)}
                >
                  <ChevronDown className="toggle-icon" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <WritingStyleDialog
        open={writingStyleDialogOpen}
        onClose={() => setWritingStyleDialogOpen(false)}
        onAdd={async () => {
          try {
            const res = await getWritingStylesListReq()
            const raw = Array.isArray(res) ? res : []
            const list = raw.map((item: unknown) => {
              const o = item as { id?: string; name?: string; isPublic?: boolean }
              return {
                id: String(o?.id ?? ""),
                name: String(o?.name ?? ""),
                isPublic: o?.isPublic !== false,
              }
            })
            setWritingStyles(list)
            if (list.length > 0) setSelectedWritingStyle(list[list.length - 1].id)
            setShowWritingStyleTip(true)
          } catch {
            // ignore
          }
        }}
      />
    </div>
  )
}

export default QuillChatInput
