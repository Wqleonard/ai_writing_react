"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import clsx from "clsx"
import {
  Send,
  Loader2,
  FileText,
  Trash2,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Link,
  X,
} from "lucide-react"
import { Iconfont } from "@/components/IconFont"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover"
import { useChatInputStore } from "@/stores/chatInputStore"
import { useModels } from "@/hooks/useModels"
import { useLLM } from "@/hooks/useLLM"
import type {
  QuickChatInputChannel,
  QuickChatInputChannelValue,
} from "../../types/quickChat"
import { getKeywords } from "@/api/tools-square"
import { handleUploadFile } from "@/api/files"
import type { FileItem } from "@/api/files"
import { showNotesSelectorDialog } from "@/utils/showNotesSelectorDialog"
import { openLoginDialog } from "@/components/LoginDialog"
import { useLoginStore } from "@/stores/loginStore"
import { getWritingStylesListReq } from "@/api/writing-styles"
import { WritingStyleDialog } from "@/components/Community/WritingStyleDialog"

export type QuillChatInputStatus = "ready" | "error" | "submitted" | "streaming"

export interface QuillChatInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
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
    removeAssociationTag,
    removeFile,
    removeSelectedText,
  } = useChatInputStore()

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
  const [writingStyleDialogOpen, setWritingStyleDialogOpen] = useState(false)
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  const [isMemeWordsExpanded, setIsMemeWordsExpanded] = useState(true)
  const [memeWords, setMemeWords] = useState<
    { name: string; description?: string; workReference?: string }[]
  >([])
  const [isLoadingMemeWords, setIsLoadingMemeWords] = useState(false)

  // 富文本容器引用（工具模式下使用 contenteditable + span + input-tag）
  const richTextRef = useRef<HTMLDivElement | null>(null)

  const currentChannel: QuickChatInputChannel | null = selectedTool
    ? quickChatInputChannels.find((c) => c.title === selectedTool) ?? null
    : null

  // 根据当前快捷工具的模板（tip + span）初始化基础文本内容
  useEffect(() => {
    if (!currentChannel) return
    const baseText = currentChannel.value
      .filter((item) => item.mold === "tip" || item.mold === "span")
      .map((item) => item.value || "")
      .join("")
    onChange(baseText)
  }, [currentChannel, onChange])

  const hasTags =
    associationTags.length > 0 ||
    selectedNotes.length > 0 ||
    selectedFiles.length > 0 ||
    selectedTexts.length > 0

  useEffect(() => {
    if (hideAssistUI) return
    let cancelled = false
    setIsLoadingMemeWords(true)
    getKeywords()
      .then((req: unknown) => {
        const r = req as { keywords?: { name: string; description?: string; workReference?: string }[] }
        if (!cancelled && r?.keywords && Array.isArray(r.keywords)) {
          setMemeWords(r.keywords)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingMemeWords(false)
      })
    return () => {
      cancelled = true
    }
  }, [hideAssistUI])

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
    onSubmit()
    if (clearOnSubmit) onChange("")
  }, [disabled, value, onSubmit, clearOnSubmit, onChange])

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

  const closeRichTextMode = useCallback(() => {
    setSelectedTool(null)
    // 清空富文本 DOM
    if (richTextRef.current) {
      richTextRef.current.innerHTML = ""
    }
    onChange("")
  }, [onChange])

  // 点击工具标签：进入/退出富文本模板模式（contenteditable + span + input-tag）
  const handleToolTagClick = useCallback(
    (channelTitle: string) => {
      const channel = quickChatInputChannels.find((c) => c.title === channelTitle)
      if (!channel) return

      if (selectedTool === channelTitle) {
        // 再次点击同一工具：退出富文本模式并清空
        closeRichTextMode()
      } else {
        setSelectedTool(channelTitle)
      }
    },
    [quickChatInputChannels, selectedTool, closeRichTextMode]
  )

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
      onChange(value ? `${value}\n${word.name}` : word.name)
      if (isAnswerOnly) setShowAnswerTip(true)
    },
    [value, onChange, isAnswerOnly, setShowAnswerTip]
  )

  const handleLocalFileSelect = useCallback(() => {
    if (!isLoggedIn) {
      openLoginDialog()
      return
    }
    handleUploadFile((file: FileItem) => addFile(file), {
      onError: (msg) => console.warn(msg),
    })
  }, [isLoggedIn, addFile])

  const handleOpenAssociationSelector = useCallback(() => {
    if (!isLoggedIn) {
      openLoginDialog()
      return
    }
    onOpenAssociationSelector?.()
  }, [isLoggedIn, onOpenAssociationSelector])

  const handleOpenNotesSelector = useCallback(async () => {
    if (!isLoggedIn) {
      openLoginDialog()
      return
    }
    try {
      const { notes, success } = await showNotesSelectorDialog()
      if (success && notes?.length) {
        notes.forEach((n) => addNote(n))
      } else if (success && (!notes || notes.length === 0)) {
        clearSelectedNotes()
      }
    } catch {
      // 用户取消
    }
  }, [isLoggedIn, addNote, clearSelectedNotes])

  const isSubmitting = status !== "ready" && status !== "error"

  // 创作热点：左右两列 + 折叠预览
  const collapsedPreviewCount = 5
  const leftColumnWords = React.useMemo(
    () => {
      const halfCount = Math.ceil(memeWords.length / 2)
      const words = memeWords.slice(0, halfCount)
      return words.map((text, index) => ({
        name: text.name,
        originalIndex: index,
      }))
    },
    [memeWords]
  )

  const rightColumnWords = React.useMemo(
    () => {
      const halfCount = Math.ceil(memeWords.length / 2)
      const words = memeWords.slice(halfCount)
      return words.map((text, index) => ({
        name: text.name,
        originalIndex: index + halfCount,
      }))
    },
    [memeWords]
  )

  const collapsedPreviewWords = React.useMemo(
    () => memeWords.slice(0, collapsedPreviewCount),
    [memeWords]
  )

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
          {/* 选择工具按钮 + 弹窗 */}
        <Popover>
          <PopoverTrigger asChild>
            <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center cursor-pointer hover:bg-muted">
              <Iconfont unicode="&#xe614;" className="text-sm" />
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            {quickChatInputChannels.map((channel) => (
              <div
                key={channel.title}
                className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted"
                onClick={() => {
                  handleToolTagClick(channel.title)
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

        {/* 文件/关联/笔记入口 */}
        <Popover>
          <PopoverTrigger asChild>
            <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center cursor-pointer hover:bg-muted">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <div
              className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted text-sm"
              onClick={handleLocalFileSelect}
            >
              <FileText className="h-4 w-4" />
              从本地文件添加
            </div>
            {!hideAssociationFeature && (
              <div
                className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted text-sm"
                onClick={handleOpenAssociationSelector}
              >
                <Link className="h-4 w-4" />
                关联本书内容
              </div>
            )}
            <div
              className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted text-sm"
              onClick={handleOpenNotesSelector}
            >
              <FileText className="h-4 w-4" />
              使用全局笔记
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
                        if (list.length > 0 && !selectedWritingStyle) {
                          setSelectedWritingStyle(list[0].id)
                        } else if (
                          selectedWritingStyle &&
                          !list.some((s) => s.id === selectedWritingStyle) &&
                          list.length > 0
                        ) {
                          setSelectedWritingStyle(list[0].id)
                        }
                      })
                      .catch(() => {})
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

        {/* 模型选择 */}
        <div className="min-w-[60px]">
          <Select value={modelLLM} onValueChange={setModelLLM}>
            <SelectTrigger className="h-7 text-xs border-0 bg-transparent shadow-none px-0 focus:ring-0 focus:ring-offset-0">
              <SelectValue placeholder="模型" />
            </SelectTrigger>
            <SelectContent>
              {modelsLLM.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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

      <div
        className={clsx(
          "w-8 ml-2 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors",
          value.trim() && !disabled
            ? "bg-primary text-primary-foreground hover:opacity-90"
            : "bg-muted text-muted-foreground cursor-not-allowed"
        )}
        onClick={() => {
          if (value.trim() && !disabled) {
            onSubmit()
            if (clearOnSubmit) onChange("")
          }
        }}
      >
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </div>
    </div>
  )

  return (
    <div
      className={clsx("quill-chat-input", className)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        onDrop?.(e)
      }}
    >
      <div className="todos-input-wrapper space-y-2">
        {/* 悬浮标签区域 - 统一用 flex 布局 */}
        {hasTags && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {associationTags.slice(0, 7).map((tag, index) => (
              <span
                key={`assoc-${tag}-${index}`}
                className="inline-flex items-center gap-1 rounded-md bg-muted/80 px-2 py-0.5 text-xs text-foreground"
                onClick={() => removeAssociationTag(index)}
              >
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[120px]">{tag}</span>
              </span>
            ))}
            {selectedNotes.slice(0, 7).map((note) => (
              <span
                key={`note-${note.id}`}
                className="inline-flex items-center gap-1 rounded-md bg-muted/80 px-2 py-0.5 text-xs text-foreground"
              >
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[120px]">
                  {((note.title ?? note.content) || "").length > 20
                    ? `${((note.title ?? note.content) || "").slice(0, 20)}...`
                    : (note.title ?? note.content) || ""}
                </span>
                <span
                  className="cursor-pointer hover:opacity-80"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeNote(note.id)
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </span>
              </span>
            ))}
            {selectedFiles.slice(0, 7).map((file) => (
              <span
                key={file.id}
                className="inline-flex items-center gap-1 rounded-md bg-muted/80 px-2 py-0.5 text-xs text-foreground"
              >
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[120px]">{file.originalName}</span>
                <span
                  className="cursor-pointer hover:opacity-80"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeFile(file.id)
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </span>
              </span>
            ))}
            {selectedTexts.slice(0, 7).map((text) => (
              <span
                key={text.id}
                className="inline-flex items-center gap-1 rounded-md bg-muted/80 px-2 py-0.5 text-xs text-foreground"
              >
                <span className="truncate max-w-[120px]">
                  {text.content.length > 20 ? `${text.content.slice(0, 20)}...` : text.content}
                </span>
                <span
                  className="cursor-pointer hover:opacity-80"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeSelectedText(text.id)
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </span>
              </span>
            ))}
            {(associationTags.length > 7 ||
              selectedNotes.length > 7 ||
              selectedFiles.length > 7 ||
              selectedTexts.length > 7) && (
              <span className="text-muted-foreground text-xs">...</span>
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

        <div className="input-container-top-normal-container">
          {currentChannel ? (
            <div className="rich-text-container">
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
            <div className="normal-input-container">
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
