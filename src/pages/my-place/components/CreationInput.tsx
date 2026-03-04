import * as React from 'react'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useLLM } from '@/hooks/useLLM'
import { useProChatContainer } from '@/components/ProChatContainer'
import { ChevronDown, FileText, Link, Loader2, Trash2, X } from 'lucide-react'
import clsx from 'clsx'
import type { QuickChatInputChannel } from '../types'
import { Button } from '@/components/ui/Button'
import { Iconfont } from '@/components/IconFont'
import { Checkbox } from '@/components/ui/Checkbox'
import { Popover, PopoverContent, PopoverAnchor, PopoverTrigger } from "@/components/ui/Popover.tsx";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/Tooltip";
import { useLoginStore } from "@/stores/loginStore";
import debounce from 'lodash-es/debounce';
import { useMemeWords } from '@/hooks/useMemeWords'
import { useQuickToolComposer } from '@/hooks/useQuickToolComposer'
import { useChatInputStore } from '@/stores/chatInputStore'
import { useChatInputActions } from '@/hooks/useChatInputActions'
import { getWritingStylesListReq } from '@/api/writing-styles'
import {
  buildQuickChannelFullText,
  getQuickChannelInputCount,
} from '@/services/quickChatComposerService'

export type SubmitStatus = 'ready' | 'error' | 'submitted' | 'streaming'

/** 在 ProChatContainer 内使用时，value/onChange/onSubmit/isAnswerOnly/onAnswerOnlyChange 由 context 提供，可不传 */
export interface CreationInputProps {
  value?: string
  onChange?: (value: string) => void
  isAnswerOnly?: boolean
  onAnswerOnlyChange?: (checked: boolean) => void
  onSubmit?: () => void
  placeholder?: string
  status?: SubmitStatus
  onRetry?: () => void
  isButtonDisabled?: boolean
  showToolTags?: boolean
  onSelectTool?: (toolTitle: string) => void
}

const QUICK_CHAT_INPUT_CHANNELS: QuickChatInputChannel[] = [
  {
    title: '我想写',
    icon: '&#xe63f;',
    value: [
      { mold: 'tip', value: '我想写' },
      { mold: 'span', value: '请帮我以' },
      { mold: 'input', value: '输入脑洞、灵感', width: '120px' },
      { mold: 'span', value: '为主题，创作一篇类型为' },
      { mold: 'input', value: '输入题材类型', width: '100px' },
      { mold: 'span', value: '的小说，章节数为' },
      { mold: 'input', value: '输入数字', width: '75px' },
      { mold: 'span', value: '章。' },
    ],
  },
  {
    title: '我想改',
    icon: '&#xe63c;',
    value: [
      { mold: 'tip', value: '我想改' },
      { mold: 'span', value: '帮我把作品小说的' },
      {
        mold: 'input',
        value: '输入具体环节，如大纲、第一章、女角色的名字',
        width: '120px',
      },
      { mold: 'span', value: '内容改一改，改成' },
      { mold: 'input', value: '输入你想具体改动的内容', width: '120px' },
    ],
  },
  {
    title: '我想查',
    icon: '&#xe63e;',
    value: [
      { mold: 'tip', value: '我想查' },
      { mold: 'span', value: '帮我查一下' },
      {
        mold: 'input',
        value: '输入具体查询内容，比如唐朝服饰、福布斯富豪排行',
        width: '120px',
      },
    ],
  },
  {
    title: '我没有想法',
    icon: '&#xe63d;',
    value: [
      { mold: 'tip', value: '我没有想法' },
      { mold: 'span', value: '我没有什么想法，给我个灵感吧~' },
    ],
  },
]

interface MemeWordItemProps {
  memeWord: { name: string; originalIndex: number }
  getNumberClass: (index: number) => string
  onMemeWordClick: (name: string, e: React.MouseEvent) => void
}

const MemeWordItem = ({ memeWord, getNumberClass, onMemeWordClick }: MemeWordItemProps) => (
  <div
    role="button"
    className="flex px-4 h-7 min-w-0 max-w-full cursor-pointer items-center gap-1.5 rounded-[20px] border-none text-sm text-black/50 transition-colors hover:bg-[rgba(239,175,0,0.2)]"
    onClick={e => onMemeWordClick(memeWord.name, e)}
    title={memeWord.name}
  >
    <span
      className={clsx(
        'min-w-5 shrink-0 text-center text-sm font-bold text-black/50',
        getNumberClass(memeWord.originalIndex)
      )}
    >
      {memeWord.originalIndex + 1}
    </span>
    <span className="min-w-0 max-w-full flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-black/50">
      {memeWord.name}
    </span>
  </div>
)

export const CreationInput = (props: CreationInputProps) => {
  const {
    value: valueProp,
    onChange: onChangeProp,
    isAnswerOnly: isAnswerOnlyProp,
    onAnswerOnlyChange: onAnswerOnlyChangeProp,
    onSubmit: onSubmitProp,
    placeholder = '发送你的创作想法或选择相关工具,立即创建新作品',
    status = 'ready',
    onRetry,
    isButtonDisabled = false,
    showToolTags = true,
    onSelectTool,
  } = props

  const ctx = useProChatContainer()
  const value = ctx ? ctx.inputValue : (valueProp ?? '')
  const onChange = ctx ? (v: string) => ctx.setInputValue(v) : (onChangeProp ?? (() => {
  }))
  const isAnswerOnly = ctx ? ctx.isAnswerOnly : (isAnswerOnlyProp ?? true)
  const onAnswerOnlyChange = ctx ? ctx.onAnswerOnlyChange : (onAnswerOnlyChangeProp ?? (() => {
  }))
  const onSubmit = ctx ? ctx.onSubmit : (onSubmitProp ?? (() => {
  }))
  const hideAssociationFeature = ctx?.hideAssociationFeature ?? true
  const onOpenAssociationSelector = ctx?.onOpenAssociationSelector

  /** 富文本模式下每个 mold===input 的当前值，与 Vue 中 input-tag-input 的 value 对应 */
  const [richInputValues, setRichInputValues] = useState<string[]>([])
  /** 创作热点是否展开，首页可折叠 */
  const [isMemeWordsExpanded, setIsMemeWordsExpanded] = useState(true)
  const { memeWords, collapsedPreviewWords, leftColumnWords, rightColumnWords } = useMemeWords({
    collapsedPreviewCount: 3,
  })
  const [hoveredDeleteIndex, setHoveredDeleteIndex] = useState<number | null>(null)
  const [hoveredNoteDeleteIndex, setHoveredNoteDeleteIndex] = useState<number | null>(null)
  const [hoveredFileDeleteIndex, setHoveredFileDeleteIndex] = useState<string | null>(null)
  const [hoveredSelectedTextDeleteIndex, setHoveredSelectedTextDeleteIndex] = useState<string | null>(null)
  const [isDeleteIconHovered, setIsDeleteIconHovered] = useState(false)
  const [isNoteDeleteIconHovered, setIsNoteDeleteIconHovered] = useState(false)
  const [isFileDeleteIconHovered, setIsFileDeleteIconHovered] = useState(false)
  const [isSelectedTextDeleteIconHovered, setIsSelectedTextDeleteIconHovered] = useState(false)

  const [toolPopoverOpen, setToolPopoverOpen] = useState(false)
  const [filePopoverOpen, setFilePopoverOpen] = useState(false)
  const [writingStylePopoverOpen, setWritingStylePopoverOpen] = useState(false)
  const [modelPopoverOpen, setModelPopoverOpen] = useState(false)

  const openToolPopover = useCallback(() => {
    setToolPopoverOpen(true)
  }, [setToolPopoverOpen])

  const openFilePopover = useCallback(() => {
    setFilePopoverOpen(true)
  }, [setFilePopoverOpen])

  const {
    modelLLM,
    setModelLLM,
    selectedWritingStyle,
    setSelectedWritingStyle,
    modelsLLM,
    writingStyles,
    setWritingStyles,
  } = useLLM()

  const {
    associationTags,
    selectedNotes,
    selectedFiles,
    selectedTexts,
    addFile,
    addNote,
    clearSelectedNotes,
    isShowWritingStyleTip,
    setShowWritingStyleTip,
    removeAssociationTag,
    removeNote,
    removeFile,
    removeSelectedText,
  } = useChatInputStore()

  const writingStyleOptions =
    writingStyles.length > 0 ? writingStyles : [{ id: selectedWritingStyle, name: '默认' }]
  const currentModelName = modelsLLM.find((m) => m.id === modelLLM)?.name || '模型'

  const completeNewbieMissionByCode = useLoginStore(s => s.completeNewbieMissionByCode)
  const userInfo = useLoginStore(s => s.userInfo)
  const isLoggedIn = Boolean(userInfo?.id)
  const onSubmitRef = useRef(onSubmit)
  const onRetryRef = useRef(onRetry)
  const statusRef = useRef(status)

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

  useEffect(() => {
    onSubmitRef.current = onSubmit
    onRetryRef.current = onRetry
    statusRef.current = status
  }, [onSubmit, onRetry, status])

  const handleSubmit = useMemo(
    () =>
      debounce(async () => {
        if (statusRef.current === 'error' && onRetryRef.current) {
          onRetryRef.current()
        } else {
          await completeNewbieMissionByCode('SEND_CREATIVE_IDEA')
          onSubmitRef.current?.()
        }
      }, 2000, { leading: true, trailing: false }),
    [completeNewbieMissionByCode]
  )

  useEffect(() => {
    return () => {
      handleSubmit.cancel()
    }
  }, [handleSubmit])

  const disabled = isButtonDisabled || status === 'submitted' || status === 'streaming'
  const canMove = value.trim() && !disabled
  const isButtonClickable = !!canMove
  const hasTags =
    associationTags.length > 0 ||
    selectedNotes.length > 0 ||
    selectedFiles.length > 0 ||
    selectedTexts.length > 0

  const {
    selectedTool,
    currentChannel,
    closeToolMode,
    handleToolTagClick,
  } = useQuickToolComposer({
    channels: QUICK_CHAT_INPUT_CHANNELS,
    onChange,
    onSelectTool,
    onCloseMode: () => setRichInputValues([]),
  })

  const syncRichToValue = (channel: QuickChatInputChannel, inputValues: string[]) => {
    onChange?.(buildQuickChannelFullText(channel, inputValues))
  }

  useEffect(() => {
    if (!currentChannel) return
    const inputCount = getQuickChannelInputCount(currentChannel)
    setRichInputValues(Array.from({ length: inputCount }, () => ""))
  }, [currentChannel])

  const setRichInputAt = (index: number, next: string) => {
    setRichInputValues(prev => {
      const nextArr = [...prev]
      nextArr[index] = next
      if (currentChannel) syncRichToValue(currentChannel, nextArr)
      return nextArr
    })
  }

  const handleRichKeyDown = useMemo(
    () =>
      debounce((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          if (!disabled) handleSubmit()
        }
      }, 2000, { leading: true, trailing: false }),
    [disabled, handleSubmit]
  )

  useEffect(() => {
    return () => {
      handleRichKeyDown.cancel()
    }
  }, [handleRichKeyDown])

  const getNumberClass = (index: number) => {
    if (index === 0) return 'text-[#fbbf24]! font-bold!'
    if (index === 1) return 'text-[#3b82f6]! font-bold!'
    if (index === 2) return 'text-[#c96a38]! font-bold!'
    return ''
  }

  const toggleMemeWordsExpanded = () => {
    setIsMemeWordsExpanded(prev => !prev)
  }

  const handleMemeWordClick = (memeWord: string, e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    closeToolMode()
    onChange(`请为我生成一篇主题为${memeWord}的小说`)
  }

  const loadWritingStyles = useCallback(async () => {
    try {
      const res = await getWritingStylesListReq()
      const list = Array.isArray(res)
        ? res.map((item: { id?: string; name?: string; isPublic?: boolean }) => ({
          id: String(item?.id ?? ''),
          name: String(item?.name ?? ''),
          isPublic: item?.isPublic !== false,
        }))
        : []
      setWritingStyles(list)
      if (list.length > 0 && !list.some((s) => s.id === selectedWritingStyle)) {
        setSelectedWritingStyle(list[0].id)
      }
    } catch {
      // ignore
    }
  }, [selectedWritingStyle, setSelectedWritingStyle, setWritingStyles])

  useEffect(() => {
    if (!isShowWritingStyleTip) return
    const close = () => setShowWritingStyleTip(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [isShowWritingStyleTip, setShowWritingStyleTip])

  return (
    <div className="relative z-1 flex w-full flex-1 flex-col px-4">
      <div id="newbiew-tour-step-2" className="z-1 ">
        {hasTags && (
          <div className="floating-tags-container mb-2 space-y-1.5">
            {associationTags.length > 0 && (
              <div className="association-hints-inline">
                <div className="association-hints-content flex flex-wrap gap-1.5">
                  {associationTags.slice(0, 7).map((tag, index) => (
                    <span
                      key={`assoc-${tag}-${index}`}
                      className="association-tag inline-flex items-center gap-1 rounded-md bg-muted/80 px-2 py-0.5 text-xs text-foreground"
                      onMouseEnter={() => setHoveredDeleteIndex(index)}
                      onMouseLeave={() => {
                        setHoveredDeleteIndex(null)
                        setIsDeleteIconHovered(false)
                      }}
                    >
                      <span
                        className={clsx(
                          "tag-icon cursor-pointer",
                          hoveredDeleteIndex === index && "delete-mode",
                          isDeleteIconHovered && hoveredDeleteIndex === index && "delete-hover"
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
                      className="note-tag inline-flex items-center gap-1 rounded-md bg-muted/80 px-2 py-0.5 text-xs text-foreground"
                      onMouseEnter={() => setHoveredNoteDeleteIndex(note.id)}
                      onMouseLeave={() => {
                        setHoveredNoteDeleteIndex(null)
                        setIsNoteDeleteIconHovered(false)
                      }}
                    >
                      <span
                        className={clsx(
                          "tag-icon cursor-pointer",
                          hoveredNoteDeleteIndex === note.id && "delete-mode",
                          isNoteDeleteIconHovered && hoveredNoteDeleteIndex === note.id && "delete-hover"
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
                  {selectedFiles.slice(0, 7).map((file) => (
                    <span
                      key={file.id}
                      className="file-tag inline-flex items-center gap-1 rounded-md bg-muted/80 px-2 py-0.5 text-xs text-foreground"
                      onMouseEnter={() => setHoveredFileDeleteIndex(file.id)}
                      onMouseLeave={() => {
                        setHoveredFileDeleteIndex(null)
                        setIsFileDeleteIconHovered(false)
                      }}
                    >
                      <span
                        className={clsx(
                          "tag-icon cursor-pointer",
                          hoveredFileDeleteIndex === file.id && "delete-mode",
                          isFileDeleteIconHovered && hoveredFileDeleteIndex === file.id && "delete-hover"
                        )}
                        onClick={() => hoveredFileDeleteIndex === file.id ? removeFile(file.id) : null}
                        onMouseEnter={() => hoveredFileDeleteIndex === file.id ? setIsFileDeleteIconHovered(true) : null}
                        onMouseLeave={() => hoveredFileDeleteIndex === file.id ? setIsFileDeleteIconHovered(false) : null}
                      >
                        {hoveredFileDeleteIndex === file.id ? (
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
                      className="selected-text-tag inline-flex items-center gap-1 rounded-md bg-muted/80 px-2 py-0.5 text-xs text-foreground"
                      onMouseEnter={() => setHoveredSelectedTextDeleteIndex(text.id)}
                      onMouseLeave={() => {
                        setHoveredSelectedTextDeleteIndex(null)
                        setIsSelectedTextDeleteIconHovered(false)
                      }}
                    >
                      <span
                        className={clsx(
                          "tag-icon cursor-pointer",
                          hoveredSelectedTextDeleteIndex === text.id && "delete-mode",
                          isSelectedTextDeleteIconHovered &&
                            hoveredSelectedTextDeleteIndex === text.id &&
                            "delete-hover"
                        )}
                        onClick={() =>
                          hoveredSelectedTextDeleteIndex === text.id ? removeSelectedText(text.id) : null
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
                      <span className="tag-text truncate max-w-[120px]">
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

        {/* 顶部工具标签 - 对应 Vue tool-tags-container-top / tool-tag-top */}
        {showToolTags && (
          <div className="tool-tags-container-top mb-3 flex flex-wrap gap-1.5">
            {QUICK_CHAT_INPUT_CHANNELS.map(channel => {
              const isActive = selectedTool === channel.title
              return (
                <div
                  key={channel.title}
                  role="button"
                  tabIndex={0}
                  className={clsx(
                    'tool-tag-top cursor-pointer whitespace-nowrap rounded-[10px] border border-[#e5e5e5] bg-white px-2 py-1 text-xs font-normal text-[#333] transition-all duration-200',
                    'hover:border-[#efc04e] hover:bg-[#efc04e] hover:text-white',
                    isActive && 'bg-[#efc04e]! text-white!'
                  )}
                  title={isActive ? '再次点击切换回普通输入模式' : '点击使用此工具'}
                  onClick={() => handleToolTagClick(channel.title)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleToolTagClick(channel.title)
                    }
                  }}
                >
                  {channel.title}
                </div>
              )
            })}
          </div>
        )}
        <div
          className={clsx(
            "z-1 flex flex-col w-full h-35 rounded-[20px] overflow-hidden px-4 pb-1.5 bg-white shadow-[0px_0px_0.5rem_#0000001a] transition-shadow duration-200",
          )}
          id='newbiew-tour-step-1'
        >
          <div className="flex-1 overflow-y-auto min-h-0 py-4 text-sm">
            {currentChannel ? (
              /* 富文本区域：与 Vue rich-text-content 一致，tip + span + 内联 input */
              <div
                className="outline-none transition-all duration-300 flex flex-wrap items-baseline gap-0 wrap-break-word text-(--text-primary)"
                contentEditable="true"
                key={currentChannel.title}
                suppressContentEditableWarning
                style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
                onInput={(e) => {
                  const el = e.currentTarget
                  // 移除所有子元素的格式标签，只保留 text 节点和 span
                  const walk = (node: Node) => {
                    if (node.nodeType === 1) {
                      const element = node as Element
                      if (element.tagName === 'FONT' || element.tagName === 'B' || element.tagName === 'STRONG') {
                        const parent = element.parentNode!
                        while (element.firstChild) {
                          parent.insertBefore(element.firstChild, element)
                        }
                        parent.removeChild(element)
                        return
                      }
                      Array.from(element.childNodes).forEach(walk)
                    }
                  }
                  Array.from(el.childNodes).forEach(walk)
                }}
                onKeyDown={e => handleRichKeyDown(e)}
              >
                {currentChannel.value.map((item, index) => {
                  if (item.mold === 'tip') {
                    return (
                      <span key={index} className="tip-text-wrapper relative mr-2 inline-block">
                      <span className="tip-text inline text-sm font-semibold text-(--bg-editor-save)">
                        {item.value}
                      </span>
                      <div
                        role="button"
                        className="tip-close-icon absolute -right-0.5 top-0.5 flex h-2.5 w-2.5 cursor-pointer items-center justify-center rounded-full bg-(--bg-quaternary) text-(--bg-secondary) transition-all hover:scale-110 hover:bg-[#333]"
                        onClick={e => {
                          e.stopPropagation()
                          closeToolMode()
                        }}
                        title="切换回普通输入模式"
                        aria-label="关闭并切换回普通输入"
                      >
                        <X className="size-2.5" strokeWidth={2.5}/>
                      </div>
                    </span>
                    )
                  }
                  if (item.mold === 'span') {
                    return (
                      <span key={index} className="text-part inline">
                      {item.value}
                    </span>
                    )
                  }
                  if (item.mold === 'input') {
                    const inputIndex = currentChannel.value
                      .slice(0, index)
                      .filter(i => i.mold === 'input').length
                    const inputWidth = item.width ?? '120px'
                    return (
                      <span
                        key={index}
                        className="input-tag mx-0.5 inline-block align-middle"
                        contentEditable={false}
                      >
                      <input
                        type="text"
                        className="input-tag-input inline-block min-w-[80px] max-w-[430px] overflow-hidden text-ellipsis whitespace-nowrap rounded-md border border-[#e5e5e5] bg-white px-1.5 py-0.5 text-sm leading-tight text-(--text-muted) outline-none transition placeholder:opacity-80 focus:border-[#ff9500] focus:bg-white focus:text-(--text-primary) focus:ring-2 focus:ring-[#ff9500]/20"
                        style={{ width: inputWidth }}
                        placeholder={item.value}
                        value={richInputValues[inputIndex] ?? ''}
                        onChange={e => setRichInputAt(inputIndex, e.target.value)}
                      />
                    </span>
                    )
                  }
                  return null
                })}
              </div>
            ) : (
              <textarea
                className="w-full resize-none text-(--text-secondary) transition-all duration-300 placeholder:text-(--text-muted) outline-none border-none"
                placeholder={placeholder}
                value={value}
                onChange={e => onChange(e.target.value)}
              />
            )}
          </div>

          {/* 底部控制栏 */}
          <div className="h-8 shrink-0 flex items-center justify-between gap-4">
            <div className="flex gap-2">
              {/* 选择工具按钮 + 弹窗 */}
              <Popover open={toolPopoverOpen} onOpenChange={setToolPopoverOpen}>
                <Tooltip>
                  <PopoverAnchor asChild>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant='outline'
                        size="icon-sm"
                        className="size-8 rounded-full"
                        onClick={openToolPopover}
                      >
                        <Iconfont unicode="&#xe614;" className="text-sm"/>
                      </Button>
                    </TooltipTrigger>
                  </PopoverAnchor>
                  <TooltipContent side="top">选择工具</TooltipContent>
                </Tooltip>
                <PopoverContent className="w-56 p-2" align="center" side='top' sideOffset={8}>
                  {QUICK_CHAT_INPUT_CHANNELS.map((channel) => (
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

              {/* 文件/关联/笔记入口 */}
              <Popover open={filePopoverOpen} onOpenChange={setFilePopoverOpen}>
                <Tooltip>
                  <PopoverAnchor asChild>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant='outline'
                        size="icon-sm"
                        className="size-8 rounded-full"
                        onClick={openFilePopover}
                      >
                        <Iconfont unicode="&#xe613;" className="text-sm"/>
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
                    <Iconfont unicode="&#xe643;" className="size-4 leading-4"/>
                    <span>从本地文件添加</span>
                  </div>
                  {!hideAssociationFeature && (
                    <div
                      className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted text-sm"
                      onClick={() => {
                        handleOpenAssociationSelector()
                        setFilePopoverOpen(false)
                      }}
                    >
                      <Link className="size-4" />
                      <span>关联本书内容</span>
                    </div>
                  )}
                  {/* <div
                    className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted text-sm"
                    onClick={() => {
                      void handleOpenNotesSelector()
                      setFilePopoverOpen(false)
                    }}
                  >
                    <Iconfont unicode="&#xe644;" className="size-4 leading-4"/>
                    <span>使用全局笔记</span>
                  </div> */}
                </PopoverContent>
              </Popover>
            </div>
            <div className="control-right flex h-full items-center gap-3">
              {/* 文风选择器 */}
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
                    if (open) void loadWritingStyles()
                  }}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={isAnswerOnly}
                      title={isAnswerOnly ? "关闭仅回答后可选择文风" : "选择文风"}
                      className={clsx(
                        "writing-style-trigger inline-flex items-center gap-1 rounded-md outline-none transition-[transform,opacity]",
                        "text-xs text-[var(--text-primary,#333)]",
                        "cursor-pointer hover:opacity-80",
                        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:opacity-50"
                      )}
                    >
                      <span className="max-w-[90px] truncate text-left">
                        {writingStyleOptions.find((s) => s.id === selectedWritingStyle)?.name || "默认文风"}
                      </span>
                      <ChevronDown className={clsx("h-3.5 w-3.5 text-muted-foreground transition-transform duration-200", writingStylePopoverOpen && "rotate-180")} />
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
                        {writingStyleOptions.map((opt) => (
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
                        }}
                      >
                        <span className="mr-1">+</span>
                        <span>创建专属文风</span>
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* 模型选择器 */}
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

              {/* 仅回答 + 提示 */}
              <div className="answer-only-wrap flex items-center" title="直接成文需要关闭仅回答哦！">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-(--text-secondary)">
                  <Checkbox
                    checked={isAnswerOnly}
                    onCheckedChange={checked => onAnswerOnlyChange?.(checked === true)}
                    className="rounded-full text-white!"
                  />
                  <span>仅回答</span>
                </label>
              </div>

              {/* 发送按钮 - 多状态图标 */}
              <Button
                role="button"
                onClick={handleSubmit}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !disabled) handleSubmit()
                }}
                disabled={!isButtonClickable}
                className={clsx(
                  "w-8 h-8 rounded-full",
                  isButtonClickable
                    ? "cursor-pointer bg-[var(--bg-editor-save)] text-white"
                    : "cursor-not-allowed bg-[#e5e5e5] text-[#b7b7b7]"
                )}
              >
                {status === 'submitted' || status === 'streaming' ? (
                  <Loader2 className="h-4 w-4 animate-spin [color:inherit]" />
                ) : (
                  <Iconfont unicode="&#xe615;" className="text-lg [color:inherit]"/>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 创作热点 - 与 Vue meme-words-container-bottom 一致，可折叠 + meme-fade-slide 过渡 */}
      {memeWords.length > 0 && (
        <div
          className={clsx(
            'meme-words-container-bottom -mt-8 overflow-hidden rounded-b-[20px] bg-white px-2 pb-3 pt-8 transition-[max-height,background-color] duration-300 ease',
            !isMemeWordsExpanded && 'bg-[#e8e8e8]!'
          )}
          id="newbiew-tour-step-3"
        >
          {isMemeWordsExpanded ? (
            <div className="meme-words-container-bottom-content">
              <div className="h-[30px] mt-3 flex items-center justify-between">
                <div className="meme-words-title ml-3 flex items-center gap-1 text-base font-bold text-black">
                  <Iconfont unicode="&#xe63b;" className="text-[#ff5801]!"/>
                  <span>创作热点</span>
                </div>
                <div
                  role="button"
                  className="meme-words-toggle flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded px-1.5 py-1.5 transition-colors hover:bg-(--bg-hover)"
                  onClick={toggleMemeWordsExpanded}
                  aria-label="折叠创作热点"
                >
                  <Iconfont unicode="&#xeaa6;" className="text-xl text-[#898989]"/>
                </div>
              </div>
              <div className="flex gap-0 pt-3">
                <div className="w-1/2 min-w-0 flex-1 flex-col items-start">
                  {leftColumnWords.map(memeWord => (
                    <MemeWordItem
                      key={`left-${memeWord.originalIndex}`}
                      memeWord={memeWord}
                      getNumberClass={getNumberClass}
                      onMemeWordClick={handleMemeWordClick}
                    />
                  ))}
                </div>
                <div className="w-px self-stretch bg-black/10 mx-3 shrink-0" aria-hidden/>
                <div className="w-1/2 min-w-0 flex-1 flex-col items-start pl-3.2">
                  {rightColumnWords.map(memeWord => (
                    <MemeWordItem
                      key={`right-${memeWord.originalIndex}`}
                      memeWord={memeWord}
                      getNumberClass={getNumberClass}
                      onMemeWordClick={handleMemeWordClick}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[30px] mt-3 flex items-center gap-3 rounded-[20px]">
              <div
                className="meme-words-title-collapsed flex shrink-0 items-center gap-1 text-base font-bold text-black">
                <Iconfont unicode="&#xe63b;" className="text-[#ff5801]! ml-3"/>
                <span>创作热点</span>
              </div>
              <div className="meme-words-preview-tags flex min-w-0 flex-1 flex-nowrap items-center">
                {collapsedPreviewWords.map((memeWord, index) => (
                  <React.Fragment key={memeWord.name}>
                    <div
                      role="button"
                      className="meme-word-preview-item max-w-[calc(33.333%-11px)] min-w-0 flex-1 cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap rounded-[20px] border-none bg-transparent px-3 py-1 text-sm leading-normal text-black/50 transition-colors"
                      style={{ flex: '0 1 calc(33.333% - 11px)' }}
                      onClick={e => handleMemeWordClick(memeWord.name, e)}
                      title={memeWord.name}
                    >
                      {memeWord.name}
                    </div>
                    {index < collapsedPreviewWords.length - 1 && (
                      <div className="meme-words-preview-separator h-4 w-px shrink-0 bg-black/10"/>
                    )}
                  </React.Fragment>
                ))}
              </div>
              <div
                role="button"
                className="meme-words-toggle flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded px-1.5 py-1.5 transition-colors hover:bg-(--bg-hover)"
                onClick={toggleMemeWordsExpanded}
                aria-label="展开创作热点"
              >
                <Iconfont unicode="&#xeaa1;" className="text-xl text-[#898989]"/>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
