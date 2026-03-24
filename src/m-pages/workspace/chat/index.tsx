'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useMobileChat, type ChatMessage } from '@/hooks/useMobileChat'
import { getContentFromPartial } from '@/utils/getWorkFlowPartialData'
import {
  createNewMobileWork,
  getMobileChatHistory,
  getMobileChatHistoryById,
} from '@/api/m-workspace-chat'
import { getWorksByIdReq } from '@/api/works'
import { addNote } from '@/api/notes'
import type { NoteSourceType } from '@/api/notes'
import MarkdownRenderer from '@/components/MarkdownRenderer/MarkdownRenderer'
import { Drawer, DrawerContent } from '@/components/ui/Drawer'
import BOOM_CAT_ICON from '@/assets/images/boom_cat.png'
import LOGO from '@/assets/images/logo.png'
import { Button } from '@/components/ui/Button';
import { Iconfont } from '@/components/Iconfont';
import { mtoast } from '@/components/ui/toast';
import './index.css'

interface ChatHistory {
  sessionId: string
  createdTime: string
  workId: number
  updatedTime: string
}

// 按日期分组
interface ChatHistoryGroup {
  title: string
  items: ChatHistory[]
}

export default function MChatPage() {
  const noticeText = '移动版仅提供基础功能，访问 baowenmao.com 体验完整版，释放全部创作潜能！'
  const [showChat, setShowChat] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [chatHistoryList, setChatHistoryList] = useState<ChatHistory[]>([])
  const [currentWorkId, setCurrentWorkId] = useState<string | number>('')
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isSendingRef = useRef(false)

  // 生成 sessionId
  const generateSessionId = useCallback(() => {
    return crypto.randomUUID?.().replace(/-/g, '') || Date.now().toString(36)
  }, [])

  // 使用聊天 hook
  const {
    messages,
    isSending,
    streamLoading,
    currentStreamingMessageId,
    trendingTopics,
    updateTrendingTopics,
    sendMessage,
    stopStream,
    clearMessages,
    replaceMessages,
    setSessionId,
    resetSessionId,
  } = useMobileChat({
    workId: currentWorkId || '',
    generateSessionId,
  })

  // 获取或创建 workId
  const getOrCreateWorkId = useCallback(async () => {
    try {
      let historyReq: any = await getMobileChatHistory()

      if (!historyReq) {
        await createNewMobileWork()
        historyReq = await getMobileChatHistory()
      }

      if (!historyReq) {
        throw new Error('创建后也无法获取 workId')
      }

      const id = historyReq?.id || ''
      if (!id) {
        throw new Error('无法获取 workId')
      }

      setCurrentWorkId(id)
      return id
    } catch (e) {
      console.error('获取 workId 失败:', e)
      throw e
    }
  }, [])

  // 更新聊天历史
  const updateChatHistory = useCallback(async () => {
    if (!currentWorkId) return

    try {
      const detailReq: any = await getWorksByIdReq(String(currentWorkId))
      if (!detailReq?.sessions) {
        setChatHistoryList([])
        return
      }

      const list = detailReq.sessions.map((item: any) => ({
        sessionId: item?.sessionId || '',
        createdTime: item?.createdTime || '',
        workId: item?.workId || 0,
        updatedTime: item.updatedTime || '',
      }))

      setChatHistoryList(list)
    } catch (e) {
      console.error('更新聊天历史失败:', e)
    }
  }, [currentWorkId])

  // 初始化
  useEffect(() => {
    // 每次页面初始化都创建一个新的会话 ID
    setSessionId(generateSessionId())

    const init = async () => {
      try {
        await getOrCreateWorkId()
      } catch (e) {
        console.error('初始化失败:', e)
      }
    }
    init()
  }, [generateSessionId, getOrCreateWorkId, setSessionId])

  // 获取到 workId 后加载历史
  useEffect(() => {
    if (currentWorkId) {
      updateChatHistory()
    }
  }, [currentWorkId, updateChatHistory])

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(scrollToBottom, 100)
    }
  }, [messages, scrollToBottom])

  // 发送消息
  const handleSend = useCallback(async () => {
    if (isSendingRef.current || !inputValue.trim()) return

    const query = inputValue
    setInputValue('')
    setShowChat(true)

    await sendMessage(query)
  }, [inputValue, sendMessage])

  // 创建新聊天
  const handleCreateNewChat = useCallback(() => {
    stopStream()
    setShowChat(false)
    setHistoryDrawerOpen(false)
    setInputValue('')
    clearMessages()
    resetSessionId()
  }, [stopStream, clearMessages, resetSessionId])

  useEffect(() => {
    (async() => {
      await updateTrendingTopics()
    })()
  }, [])

  // 加载历史会话
  const handleHistoryItemClick = useCallback(
    async (item: ChatHistory) => {
      try {
        stopStream()
        const res: any = await getMobileChatHistoryById(String(currentWorkId), item.sessionId)

        setSessionId(item.sessionId)

        if (Array.isArray(res)) {
          const historyMessages = res
            .map<ChatMessage>((msg: any) => {
              const role = msg?.role === 'human' ? 'human' : 'ai'
              let content: any = msg?.content ?? ''

              if (role === 'ai' && typeof content === 'string') {
                try {
                  content = JSON.parse(content)
                } catch {
                  // fallback to plain text content
                }
              }

              return {
                role: role as 'human' | 'ai',
                content,
                messageId: String(msg?.id || msg?.messageId || ''),
                attachments: Array.isArray(msg?.attachments) ? msg.attachments : [],
                updatedTime: msg?.updatedTime || msg?.createdTime || new Date().toISOString(),
              }
            })
            .filter((msg) => Boolean(msg.messageId))

          replaceMessages(historyMessages)
        } else {
          replaceMessages([])
        }

        setShowChat(true)
        setHistoryDrawerOpen(false)
      } catch (e) {
        console.error('加载会话历史失败:', e)
        mtoast.error('加载会话历史失败，请稍后重试')
      }
    },
    [currentWorkId, replaceMessages, setSessionId, stopStream]
  )

  // 添加到笔记
  const handleAddToNote = useCallback(
    async (chatItem: ChatMessage) => {
      try {
        const content = getContentFromPartial(chatItem.content)
        if (!content) {
          mtoast.error('内容为空')
          return
        }

        const firstLine = content.split('\n')[0].replace(/^#+\s*/, '')
        const title = firstLine.length > 50 ? firstLine.slice(0, 50) + '...' : firstLine

        const source: NoteSourceType = 'MINI_APP_CHAT'
        await addNote(title, content, source)

        mtoast.success('已添加到笔记')
      } catch (e) {
        console.error('添加到笔记失败:', e)
        mtoast.error('添加失败，请稍后重试')
      }
    },
    []
  )

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }

  // 按日期分组
  const groupedChatHistory = useCallback((): ChatHistoryGroup[] => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

    const groups: ChatHistoryGroup[] = [
      { title: '今天', items: [] },
      { title: '昨天', items: [] },
      { title: '7 天内', items: [] },
      { title: '更早', items: [] },
    ]

    chatHistoryList.forEach((item) => {
      const itemDate = new Date(item.createdTime)
      const itemDay = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate())

      if (itemDay.getTime() >= today.getTime()) {
        groups[0].items.push(item)
      } else if (itemDay.getTime() >= yesterday.getTime()) {
        groups[1].items.push(item)
      } else if (itemDay.getTime() >= sevenDaysAgo.getTime()) {
        groups[2].items.push(item)
      } else {
        groups[3].items.push(item)
      }
    })

    return groups.filter((group) => group.items.length > 0)
  }, [chatHistoryList])

  // 解析消息内容
  const parseMessageContent = (content: any): string => {
    if (typeof content === 'string') {
      return content
    }
    if (Array.isArray(content)) {
      return getContentFromPartial(content)
    }
    return ''
  }

  // 路由离开时中断流式请求
  useEffect(() => {
    return () => {
      stopStream()
    }
  }, [stopStream])

  return (
    <div className="w-full h-full flex flex-col px-9 bg-[#f3f3f3]">
      {/* 顶部导航栏 */}
      <div className="h-22 w-full flex items-center justify-between relative">
        <div className="flex items-center gap-4">
          <div
            className="iconfont text-[36px]! w-14 h-14 leading-14 text-center rounded-md active:bg-[#e5e5e5] cursor-pointer"
            onClick={() => setHistoryDrawerOpen(true)}
          >
            &#xe619;
          </div>
          {messages.length > 0 && (
            <div
              className="iconfont text-[36px]! w-14 h-14 leading-14 text-center rounded-md active:bg-[#e5e5e5] cursor-pointer"
              onClick={handleCreateNewChat}
            >
              &#xe618;
            </div>
          )}
        </div>
        <div className="text-[36px] absolute left-1/2 -translate-x-1/2">爆文猫</div>
        <div />
      </div>

      <div className="relative flex items-center w-[calc(100%+72px)] h-14 bg-[#d9d9d9] -ml-9 overflow-hidden">
        <div className="flex items-center w-max shrink-0 whitespace-nowrap animate-notice-marquee">
          {[0, 1].map((item) => (
            <div key={item} className="flex items-center gap-2 px-5">
              <span className="iconfont text-[28px]! text-[#8d8d8d]">&#xe604;</span>
              <span className="text-[28px]! text-[#8d8d8d] whitespace-nowrap">{noticeText}</span>
            </div>
          ))}
        </div>
      </div>

      {!showChat ? (
        /* 初始状态 - 显示热点和输入框 */
        <div className="flex-1 flex flex-col">
          {/* Logo 区域 */}
          <div className="flex-1 flex flex-col justify-center items-center px-4 pt-4 pb-2">
            <div className="w-40 h-40">
              <img src={LOGO} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="mt-4 text-[44px] font-bold text-[#464646]">爆文猫，写爆文</div>
          </div>

          {/* 创作热点 */}
          <div className="px-6 pt-6 pb-3 bg-white rounded-[24px] text-3xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="iconfont text-[#ffcc00] text-[28px]!">&#xe637;</span>
              <div className="text-[28px] font-semibold text-[#464646]">创作热点</div>
            </div>
            <div className="flex flex-col">
              {trendingTopics.map((topic, index) => (
                <div
                  key={topic.name + index}
                  className="flex items-center  py-2.5 border-b border-gray-200 cursor-pointer last:border-none active:bg-gray-50"
                  onClick={() => setInputValue(topic.name)}
                >
                  <div className="leading-12 text-gray-500">
                    <span
                      className={`font-bold mr-4 ${
                        index === 0
                          ? 'text-[#eaa000]!'
                          : index === 1
                            ? 'text-[#46a5ff]!'
                            : index === 2
                              ? 'text-[#e57a00]!'
                              : ''
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="text-gray-500">{topic.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 输入框 */} 
          <div className="w-full py-18">
            <div className="w-full h-27 px-5 rounded-full bg-white flex items-center gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="请输入你想讨论的内容"
                className="flex-1 text-[32px] outline-none border-none bg-transparent px-4"
              />
              <div
                className={`w-17 h-17 rounded-full flex items-center justify-center bg-[#fa9e00] cursor-pointer active:opacity-90 ${
                  isSending ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                onClick={handleSend}
              >
                <span className="iconfont text-white text-[40px]!">&#xe63a;</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* 聊天状态 */
        <div className="h-[calc(100%-15.75rem)] flex-1 min-h-0 flex flex-col gap-9 text-3xl">
          <div className="flex flex-col pt-14 gap-9 overflow-y-auto">
            {messages.map((chatItem, index) => (
              <div key={index}>
                {chatItem.role === 'human' ? (
                  <div className="w-full flex flex-row-reverse">
                    <div className="max-w-xl text-wrap px-9 py-6 bg-[#efaf00] text-white text-[32px] rounded-[30px] rounded-ee-md! whitespace-pre-wrap break-words">
                      {parseMessageContent(chatItem.content)}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-4">
                      <div className="w-17 h-17" style={{ transform: 'scaleX(-1)' }}>
                        <img src={BOOM_CAT_ICON} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="text-[#464646]">爆文猫</div>
                    </div>
                    <div className="mt-5 bg-white px-9 py-3 rounded-[30px] rounded-ss-md!">
                      <MarkdownRenderer content={parseMessageContent(chatItem.content)} />
                      {chatItem.messageId !== currentStreamingMessageId && (
                        <div className="my-3 flex items-center gap-7 text-[#8a8a8a] text-[20px]">
                          <div
                            className="active:bg-[#e5e5e5] px-2 rounded-lg cursor-pointer"
                            onClick={() => handleAddToNote(chatItem)}
                          >
                            <span className="iconfont text-[24px]! mr-2.5">&#xe644;</span>
                            <span>添加到笔记</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {streamLoading && (
              <div className="streaming-indicator ml-8 w-16 h-14 flex items-center justify-start gap-2">
                <span className="streaming-indicator-dot" />
                <span className="streaming-indicator-dot" />
                <span className="streaming-indicator-dot" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* 底部输入框（聊天状态） */}
      {showChat && (
        <div className="w-full py-18 shrink-0">
          <div className="w-full h-27 px-5 rounded-full bg-white flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="请输入你想讨论的内容"
              className="flex-1 text-[32px] outline-none border-none bg-transparent px-4"
              disabled={isSending}
            />
            <div
              className={`w-17 h-17 rounded-full flex items-center justify-center bg-[#fa9e00] cursor-pointer active:opacity-90 ${
                isSending ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={handleSend}
            >
              <span className="iconfont text-white text-[40px]!">&#xe63a;</span>
            </div>
          </div>
        </div>
      )}

      {/* 历史记录抽屉 */}
      <Drawer direction="left" open={historyDrawerOpen} onOpenChange={setHistoryDrawerOpen}>
        <DrawerContent className="h-full w-[70%]! max-w-[70%]! border-none bg-white p-0">
          <div className="w-full h-22 px-8 flex items-center justify-between">
            <div className="text-[36px] font-bold text-[#464646]">聊天记录</div>
            <Button
              size="icon"
              variant="ghost"
              className="size-12 active:bg-[#e5e5e5] rounded-md"
              onClick={() => setHistoryDrawerOpen(false)}
            >
              <Iconfont unicode="&#xe633;" className="text-[40px] text-[#999]"/>
            </Button>
          </div>
          <div className="p-8 overflow-y-auto h-[calc(100%-5.5rem)]">
            {groupedChatHistory().length > 0 ? (
              groupedChatHistory().map((group) => (
                <div key={group.title} className="mb-8">
                  <div className="text-[28px] text-[#999] mb-4">{group.title}</div>
                  <div className="flex flex-col gap-4">
                    {group.items.map((item) => (
                      <div
                        key={item.sessionId}
                        className="bg-white rounded-[16px] px-6 py-5 active:bg-[#f5f5f5] cursor-pointer"
                        onClick={() => handleHistoryItemClick(item)}
                      >
                        <div className="text-[28px] text-[#1a1a1a] truncate">
                          会话 {item.sessionId.slice(0, 8)}
                        </div>
                        <div className="text-[22px] text-[#999] mt-2">
                          {formatTime(item.createdTime)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-80 text-[#999]">
                <div className="text-[28px]">暂无聊天记录</div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
