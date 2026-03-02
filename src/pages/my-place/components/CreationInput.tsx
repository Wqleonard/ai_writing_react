import * as React from 'react'
import { useState, useEffect, useMemo } from 'react'
import { useLLM } from '@/hooks/useLLM'
import { useProChatContainer } from '@/components/ProChatContainer'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Loader2, RefreshCw, X, ChevronDown, ChevronUp } from 'lucide-react'
import clsx from 'clsx'
import type { QuickChatInputChannel, QuickChatInputChannelValue } from '../types'
import { Button } from '@/components/ui/Button'
import { Iconfont } from '@/components/IconFont'
import { Checkbox } from '@/components/ui/Checkbox'
import { getKeywords } from '@/api/tools-square'

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

interface MemeWordItem {
  name: string
  description?: string
  workReference?: string
}

const SendIcon = () => (
  <svg
    className="size-4 shrink-0"
    width="15"
    height="15"
    viewBox="0 0 15 15"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6.64773 0.307172C7.05682 -0.101919 7.71136 -0.101919 8.07954 0.307172L14.4614 6.64808C14.8705 7.05717 14.8705 7.71172 14.4614 8.0799C14.2568 8.28444 14.0114 8.36626 13.725 8.36626C13.4386 8.36626 13.1932 8.28444 12.9886 8.0799L8.40682 3.49808L8.40682 12.989C8.40682 13.5617 7.95682 14.0117 7.38409 14.0117C6.81136 14.0117 6.36136 13.5617 6.36136 12.989L6.36136 3.49808L1.77954 8.0799C1.575 8.28445 1.32954 8.36626 1.04318 8.36626C0.756818 8.36626 0.511363 8.28445 0.306818 8.0799C-0.102273 7.67081 -0.102273 7.01626 0.306818 6.64808L6.64773 0.307172Z"
      fill="currentColor"
    />
  </svg>
)

const StreamingIcon = () => (
  <svg
    className="size-5 shrink-0"
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="4" y="4" width="12" height="12" rx="0.5" fill="currentColor" />
  </svg>
)

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
  const onChange = ctx ? (v: string) => ctx.setInputValue(v) : (onChangeProp ?? (() => {}))
  const isAnswerOnly = ctx ? ctx.isAnswerOnly : (isAnswerOnlyProp ?? true)
  const onAnswerOnlyChange = ctx ? ctx.onAnswerOnlyChange : (onAnswerOnlyChangeProp ?? (() => {}))
  const onSubmit = ctx ? ctx.onSubmit : (onSubmitProp ?? (() => {}))

  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  /** 富文本模式下每个 mold===input 的当前值，与 Vue 中 input-tag-input 的 value 对应 */
  const [richInputValues, setRichInputValues] = useState<string[]>([])
  /** 创作热点梗词，与 Vue memeWords 一致 */
  const [memeWords, setMemeWords] = useState<MemeWordItem[]>([])
  /** 创作热点是否展开，首页可折叠 */
  const [isMemeWordsExpanded, setIsMemeWordsExpanded] = useState(true)

  const {
    modelLLM,
    setModelLLM,
    selectedWritingStyle,
    setSelectedWritingStyle,
    modelsLLM,
    writingStyles,
  } = useLLM()

  const writingStyleOptions =
    writingStyles.length > 0 ? writingStyles : [{ id: selectedWritingStyle, name: '默认' }]

  const handleSubmitClick = () => {
    if (status === 'error' && onRetry) {
      onRetry()
    } else {
      onSubmit?.()
    }
  }

  const disabled = isButtonDisabled || status === 'submitted' || status === 'streaming'

  const currentChannel = selectedTool
    ? QUICK_CHAT_INPUT_CHANNELS.find(c => c.title === selectedTool)
    : null

  /** 根据模板 + 当前 input 值拼接成提交用纯文本（与 Vue updateRichTextContent 的 fullText 一致） */
  const buildFullTextFromRich = (channel: QuickChatInputChannel, inputValues: string[]): string => {
    let inputIndex = 0
    return channel.value
      .map((item: QuickChatInputChannelValue) => {
        if (item.mold === 'tip' || item.mold === 'span') return item.value
        if (item.mold === 'input') return inputValues[inputIndex++] ?? ''
        return ''
      })
      .join('')
  }

  const syncRichToValue = (channel: QuickChatInputChannel, inputValues: string[]) => {
    onChange?.(buildFullTextFromRich(channel, inputValues))
  }

  const closeRichTextMode = () => {
    setSelectedTool(null)
    setRichInputValues([])
    onChange?.('')
  }

  const handleToolTagClick = (toolTitle: string) => {
    if (selectedTool === toolTitle) {
      closeRichTextMode()
      return
    }
    const channel = QUICK_CHAT_INPUT_CHANNELS.find(c => c.title === toolTitle)
    if (!channel) return
    const inputCount = channel.value.filter(i => i.mold === 'input').length
    setSelectedTool(toolTitle)
    setRichInputValues(Array.from({ length: inputCount }, () => ''))
    syncRichToValue(
      channel,
      Array.from({ length: inputCount }, () => '')
    )
    onSelectTool?.(toolTitle)
  }

  const setRichInputAt = (index: number, next: string) => {
    setRichInputValues(prev => {
      const nextArr = [...prev]
      nextArr[index] = next
      if (currentChannel) syncRichToValue(currentChannel, nextArr)
      return nextArr
    })
  }

  const handleRichKeyDown = (e: React.KeyboardEvent, inputIndex: number) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!disabled) handleSubmitClick()
    }
  }

  /** 获取创作热点数据，与 Vue fetchMemeWords 一致 */
  useEffect(() => {
    const fetchMemeWords = async () => {
      try {
        const req: any = await getKeywords()
        if (req && Array.isArray(req.keywords)) {
          setMemeWords(req.keywords)
        }
      } catch (err) {
        console.error('获取梗词失败:', err)
      }
    }
    fetchMemeWords()
  }, [])

  const COLLAPSED_PREVIEW_COUNT = 3
  const collapsedPreviewWords = useMemo(
    () => memeWords.slice(0, COLLAPSED_PREVIEW_COUNT),
    [memeWords]
  )
  const leftColumnWords = useMemo(() => {
    const half = Math.ceil(memeWords.length / 2)
    return memeWords.slice(0, half).map((item, i) => ({ name: item.name, originalIndex: i }))
  }, [memeWords])
  const rightColumnWords = useMemo(() => {
    const half = Math.ceil(memeWords.length / 2)
    return memeWords.slice(half).map((item, i) => ({ name: item.name, originalIndex: half + i }))
  }, [memeWords])

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
    closeRichTextMode()
    onChange(`请为我生成一篇主题为${memeWord}的小说`)
  }

  return (
    <div className="relative z-1 flex w-full flex-1 flex-col">
      <div id="newbiew-tour-step-2" className="z-1 ">
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
          className="flex flex-col w-full h-35 rounded-[20px] overflow-hidden px-4 pb-1.5 bg-white shadow-[0px_0px_10px_#0000001a]"
          id='newbiew-tour-step-1'
        >
          <div className="flex-1 overflow-y-auto min-h-0 py-4 text-sm">
            {currentChannel ? (
              /* 富文本区域：与 Vue rich-text-content 一致，tip + span + 内联 input */
              <div
                className="outline-none transition-all duration-300 flex flex-wrap items-baseline gap-0 wrap-break-word text-(--text-primary)"
                contentEditable="true"
                key={currentChannel.title + Math.random()}
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
                          closeRichTextMode()
                        }}
                        title="切换回普通输入模式"
                        aria-label="关闭并切换回普通输入"
                      >
                        <X className="size-2.5" strokeWidth={2.5} />
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
                      <span key={index} className="input-tag mx-0.5 inline-block align-middle">
                      <input
                        type="text"
                        className="input-tag-input inline-block min-w-[80px] max-w-[430px] overflow-hidden text-ellipsis whitespace-nowrap rounded-md border border-[#e5e5e5] bg-white px-1.5 py-0.5 text-sm leading-tight text-(--text-muted) outline-none transition placeholder:opacity-80 focus:border-[#ff9500] focus:bg-white focus:text-(--text-primary) focus:ring-2 focus:ring-[#ff9500]/20"
                        style={{ width: inputWidth }}
                        placeholder={item.value}
                        value={richInputValues[inputIndex] ?? ''}
                        onChange={e => setRichInputAt(inputIndex, e.target.value)}
                        onKeyDown={e => handleRichKeyDown(e, inputIndex)}
                      />
                    </span>
                    )
                  }
                  return null
                })}
              </div>
            ) : (
              <textarea
                className="w-full resize-none text-(--text-secondary) transition-all duration-300 placeholder:text-(--text-muted) outline-none border-none focus:outline-none focus:ring-0"
                placeholder={placeholder}
                value={value}
                onChange={e => onChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (!disabled) handleSubmitClick()
                  }
                }}
              />
            )}
          </div>

          {/* 底部控制栏 */}
          <div className="h-8 shrink-0 flex items-center justify-between gap-4">
            <div className="action-buttons flex gap-2" />
            <div className="control-right flex h-full items-center gap-3">
              {/* 文风选择器 */}
              <div className="answer-only-wrap relative">
                <Select
                  value={selectedWritingStyle}
                  onValueChange={setSelectedWritingStyle}
                  disabled={isAnswerOnly}
                >
                  <SelectTrigger className="h-8 min-w-[80px] border-0 text-sm text-(--text-secondary)">
                    <SelectValue placeholder="文风" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {writingStyleOptions.map(opt => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 模型选择器 */}
              <Select value={modelLLM} onValueChange={setModelLLM}>
                <SelectTrigger className="h-8 min-w-[100px] border-0 text-sm text-(--text-secondary)">
                  <SelectValue placeholder="模型" />
                </SelectTrigger>
                <SelectContent align="end">
                  {modelsLLM.map(opt => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

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
                onClick={handleSubmitClick}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !disabled) handleSubmitClick()
                }}
                className="w-7.5 h-7.5 rounded-full"
              >
                <Iconfont unicode="&#xe615;" className="text-lg" />
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
                  <Iconfont unicode="&#xe63b;" className="text-[#ff5801]!" />
                  <span>创作热点</span>
                </div>
                <div
                  role="button"
                  className="meme-words-toggle flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded px-1.5 py-1.5 transition-colors hover:bg-(--bg-hover)"
                  onClick={toggleMemeWordsExpanded}
                  aria-label="折叠创作热点"
                >
                  <Iconfont unicode="&#xeaa6;" className="text-xl text-[#898989]" />
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
                <div className="w-px self-stretch bg-black/10 mx-3 shrink-0" aria-hidden />
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
              <div className="meme-words-title-collapsed flex shrink-0 items-center gap-1 text-base font-bold text-black">
                <Iconfont unicode="&#xe63b;" className="text-[#ff5801]! ml-3" />
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
                      <div className="meme-words-preview-separator h-4 w-px shrink-0 bg-black/10" />
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
                <Iconfont unicode="&#xeaa1;" className="text-xl text-[#898989]" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
