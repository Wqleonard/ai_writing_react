import * as React from 'react'
import { useCallback, useEffect, useState, useRef, useMemo } from 'react'
import { Dialog, DialogContent, DialogTitle, VisuallyHidden } from '@/components/ui/Dialog'
import { Iconfont } from '@/components/Iconfont'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { getUserBalanceReq, getInvitationCodeReq } from '@/api/users'
import { getOrderHistory, type Order } from '@/api/order'
import { redeemCodeReq } from '@/api/redemptionCodes'
import { formatLocalTime } from '@/utils/formatLocalTime'
import { toast } from 'sonner'
import { Loader2, Gift } from 'lucide-react'
import {
  aggregateOrdersBySession,
  filterToOrderType,
  formatPoints,
  getDetailText,
  getPointsClass,
} from './utils'

import topUpIcon from '@/assets/images/quota/top_up.svg'
import exchangeIcon from '@/assets/images/quota/exchange.svg'
import invitationIcon from '@/assets/images/quota/invitation.svg'
import separateWhiteIcon from '@/assets/images/quota/separate_white.svg'
import separateYellowIcon from '@/assets/images/quota/separate_yellow.svg'
import quotaBackImg from '@/assets/images/quota/quota_back.png'
import { Input } from '@/components/ui/Input'

export interface QuotaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const USAGE_FILTER_OPTIONS = [
  { id: '0', name: '全部' },
  { id: '1', name: '获取' },
  { id: '2', name: '消耗' },
] as const
const PAGE_SIZE = 20

export const QuotaDialog = ({ open, onOpenChange }: QuotaDialogProps) => {
  const [view, setView] = useState<'quota' | 'usage'>('quota')
  const [dailyFreeUsed, setDailyFreeUsed] = useState(0)
  const [dailyFreeTotal] = useState(1000000 / 1000)
  const [fixedQuota, setFixedQuota] = useState(0)
  const [bonusPoints, setBonusPoints] = useState(0)
  const [inviteeCount, setInviteeCount] = useState(0)
  const [invitationLink, setInvitationLink] = useState('https://baowenmao.com')

  const [exchangeRedeemOpen, setExchangeRedeemOpen] = useState(false)
  const [redeemCode, setRedeemCode] = useState('')
  const [redeemLoading, setRedeemLoading] = useState(false)
  const [usageFilterType, setUsageFilterType] = useState('0')
  const [ordersList, setOrdersList] = useState<Order[]>([])
  const [isLoadingUsage, setIsLoadingUsage] = useState(false)
  const [isLoadingMoreUsage, setIsLoadingMoreUsage] = useState(false)
  const [hasMoreUsage, setHasMoreUsage] = useState(true)
  const usagePageRef = useRef(-1)
  const usageContentRef = useRef<HTMLDivElement>(null)
  const usageScrollTickingRef = useRef(false)

  const updateQuota = useCallback(async () => {
    try {
      const res: any = await getUserBalanceReq()
      if (
        res?.dailyFreeToken != null &&
        typeof res.dailyFreeToken === 'number' &&
        !isNaN(res.dailyFreeToken)
      ) {
        setDailyFreeUsed(parseFloat((res.dailyFreeToken / 1000).toFixed(0)))
      }
      if (res?.token != null && typeof res.token === 'number' && !isNaN(res.token)) {
        setFixedQuota(parseFloat((res.token / 1000).toFixed(0)))
      }
    } catch {
      // keep default
    }
  }, [])

  const updateInvitation = useCallback(async () => {
    try {
      const res: any = await getInvitationCodeReq()
      if (res?.code) {
        setInvitationLink(`${window.location.origin}?invitationCode=${res.code}`)
      }
      if (
        res?.invitationNumber != null &&
        typeof res.invitationNumber === 'number' &&
        !isNaN(res.invitationNumber)
      ) {
        setInviteeCount(res.invitationNumber)
      }
      if (res?.token != null && typeof res.token === 'number' && !isNaN(res.token)) {
        setBonusPoints(parseFloat((res.token / 1000).toFixed(0)))
      }
    } catch {
      // keep default
    }
  }, [])

  useEffect(() => {
    if (open) {
      updateQuota()
      updateInvitation()
    }
  }, [open, updateQuota, updateInvitation])

  const handleTopUp = useCallback(() => {
    toast.info('暂未开放')
  }, [])

  const handleOpenExchange = useCallback(() => {
    setRedeemCode('')
    setExchangeRedeemOpen(true)
  }, [])

  const handleRedeemClose = useCallback(() => {
    setExchangeRedeemOpen(false)
    setRedeemCode('')
  }, [])

  const handleRedeemSubmit = useCallback(async () => {
    const code = redeemCode.trim()
    if (!code) {
      toast.warning('请填入兑换码')
      return
    }
    setRedeemLoading(true)
    try {
      await redeemCodeReq(code)
      toast.success('兑换成功')
      handleRedeemClose()
      await updateQuota()
    } catch (err: any) {
      console.error(err)
    } finally {
      setRedeemLoading(false)
    }
  }, [redeemCode, handleRedeemClose, updateQuota])

  const loadMoreUsage = useCallback(async () => {
    if (isLoadingMoreUsage || isLoadingUsage) return
    if (!hasMoreUsage) return
    const nextPage = usagePageRef.current + 1
    if (nextPage === 0) setIsLoadingUsage(true)
    else setIsLoadingMoreUsage(true)
    try {
      const data = await getOrderHistory({
        page: nextPage,
        size: PAGE_SIZE,
        orderType: filterToOrderType(usageFilterType),
      })
      if (!data?.content || !Array.isArray(data.content)) {
        setHasMoreUsage(false)
        return
      }
      const list = data.content
      if (list.length > 0) {
        setOrdersList(prev => aggregateOrdersBySession([...prev, ...list]))
        usagePageRef.current = nextPage
      }
      const noMore =
        list.length < PAGE_SIZE ||
        (data.totalPages != null && nextPage >= data.totalPages - 1)
      if (noMore) setHasMoreUsage(false)
    } catch {
      setHasMoreUsage(false)
    } finally {
      setIsLoadingUsage(false)
      setIsLoadingMoreUsage(false)
    }
  }, [usageFilterType, isLoadingUsage, isLoadingMoreUsage, hasMoreUsage])

  const resetAndLoadUsage = useCallback(async () => {
    setOrdersList([])
    usagePageRef.current = -1
    setHasMoreUsage(true)
    setIsLoadingUsage(true)
    setIsLoadingMoreUsage(false)
    try {
      const data = await getOrderHistory({
        page: 0,
        size: PAGE_SIZE,
        orderType: filterToOrderType(usageFilterType),
      })
      if (!data?.content || !Array.isArray(data.content)) {
        setHasMoreUsage(false)
        return
      }
      setOrdersList(aggregateOrdersBySession(data.content))
      usagePageRef.current = 0
      const noMore =
        data.content.length < PAGE_SIZE ||
        (data.totalPages != null && 0 >= data.totalPages - 1)
      if (noMore) setHasMoreUsage(false)
    } catch {
      setHasMoreUsage(false)
    } finally {
      setIsLoadingUsage(false)
    }
  }, [usageFilterType])

  const handleUsageScroll = useCallback(() => {
    if (usageScrollTickingRef.current) return
    usageScrollTickingRef.current = true
    requestAnimationFrame(() => {
      const el = usageContentRef.current
      if (el) {
        const { scrollTop, scrollHeight, clientHeight } = el
        if (scrollHeight - scrollTop - clientHeight < 50) loadMoreUsage()
      }
      usageScrollTickingRef.current = false
    })
  }, [loadMoreUsage])

  const handleOpenUsageDetails = useCallback(() => {
    setView('usage')
    setOrdersList([])
    usagePageRef.current = -1
    setHasMoreUsage(true)
    setUsageFilterType('0')
  }, [])

  const handleUsageReturn = useCallback(() => {
    setView('quota')
    setOrdersList([])
    usagePageRef.current = -1
  }, [])

  const handleUsageCloseAll = useCallback(() => {
    setView('quota')
    onOpenChange(false)
    setOrdersList([])
    usagePageRef.current = -1
  }, [onOpenChange])

  const handleDialogOpenChange = useCallback(
    (next: boolean) => {
      if (!next) setView('quota')
      onOpenChange(next)
    },
    [onOpenChange]
  )

  const usageRows = useMemo(
    () =>
      ordersList.map((order) => ({
        id: order.id,
        detailText: getDetailText(order),
        createdTimeText: formatLocalTime(order.createdTime),
        pointsText: formatPoints(order),
        pointsClass: getPointsClass(order),
      })),
    [ordersList]
  )

  useEffect(() => {
    if (view === 'usage') {
      void resetAndLoadUsage()
    }
  }, [view, usageFilterType, resetAndLoadUsage])

  const handleCopyLink = useCallback(async () => {
    const copyText = `我最近在用【爆文猫】AI写作工具，宝藏功能有：AI教练、拆书仿写、切换文风、小说转剧本……\n${invitationLink} \n快帮我点点邀请链接，登录就能薅百万token！`

    const fallbackCopy = (text: string) => {
      const textarea = document.createElement('textarea')
      textarea.value = text
      // iOS/部分浏览器在 readonly 时可能无法正确选中，改为可编辑并隐藏
      textarea.setAttribute('aria-hidden', 'true')
      textarea.style.position = 'fixed'
      textarea.style.top = '-9999px'
      textarea.style.left = '-9999px'
      textarea.style.opacity = '0'
      textarea.style.pointerEvents = 'none'
      textarea.style.zIndex = '-1'
      document.body.appendChild(textarea)

      const selection = window.getSelection()
      const prevRange =
        selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null

      textarea.focus({ preventScroll: true })
      textarea.select()
      textarea.setSelectionRange(0, text.length)
      let success = false
      try {
        success = document.execCommand('copy')
      } catch {
        success = false
      } finally {
        // 还原用户原有选区，避免复制后光标/选区状态异常
        if (selection) {
          selection.removeAllRanges()
          if (prevRange) selection.addRange(prevRange)
        }
        document.body.removeChild(textarea)
      }
      return success
    }

    const canUseClipboardApi =
      typeof window !== 'undefined' &&
      window.isSecureContext &&
      typeof navigator !== 'undefined' &&
      !!navigator.clipboard?.writeText

    if (canUseClipboardApi) {
      try {
        await navigator.clipboard.writeText(copyText)
        toast.success('邀请链接已复制到剪贴板')
        return
      } catch {
        // 继续走兼容 fallback
      }
    }

    if (fallbackCopy(copyText)) {
      toast.success('邀请链接已复制到剪贴板')
      return
    }

    toast.error('复制失败，请手动复制')
  }, [invitationLink])

  const preventClose = useCallback((e: Event) => {
    e.preventDefault()
  }, [])

  return (
    <>
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        showCloseButton
        className="w-[722px] p-0"
        onInteractOutside={preventClose}
        onEscapeKeyDown={preventClose}
      >
        <VisuallyHidden>
          <DialogTitle>{view === 'usage' ? '使用情况' : '额度'}</DialogTitle>
        </VisuallyHidden>
        {view === 'usage' ? (
          <>
            <div className="px-8 pt-8 pb-0">
              <div className="h-17 flex items-center justify-between w-full">
                <div className="flex items-center justify-between">
                  <div
                    role="button"
                    className="flex h-10 w-10 items-center justify-center mr-1.5 p-0 border-none bg-transparent cursor-pointer text-[34px] text-[#8c8c8c] hover:text-[#ff9500]"
                    onClick={handleUsageReturn}
                    onKeyDown={e => e.key === 'Enter' && handleUsageReturn()}
                    aria-label="返回"
                  >
                    <Iconfont unicode="&#xeaa2;" />
                  </div>
                  <h2 className="m-0 flex-1 text-[36px] font-bold leading-[1.32] text-transparent bg-linear-to-r from-[#efaf00] to-[#ff9500] bg-clip-text">
                    使用情况
                  </h2>
                </div>
                <Select value={usageFilterType} onValueChange={setUsageFilterType}>
                  <SelectTrigger className="min-w-[100px] h-[30px] rounded-[20px] border-[#d8d8d8] px-3.5 text-[15px] text-[#8c8c8c]">
                    <SelectValue placeholder="请选择" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {USAGE_FILTER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id} className='cursor-pointer'>
                        {opt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="min-h-[480px] max-h-[660px] h-[660px] flex flex-col overflow-hidden px-[35px] pt-6 pb-[35px]">
              <div
                className="flex-1 min-h-0 flex flex-col border rounded-[20px] overflow-hidden bg-white border-[#e5e5e5] bg-white focus-visible:border-[#e5e5e5]"
              >
                <div className="shrink-0 flex items-center px-5 py-3.5 text-[15px] font-semibold text-[#8c8c8c] bg-[#e8e8e8] border-b border-[#e0e0e0]">
                  <div className="flex-1 min-w-0 text-left">详情</div>
                  <div className="w-[200px] shrink-0 text-left">日期</div>
                  <div className="w-[110px] shrink-0 text-left">积分变更</div>
                </div>
                <div
                  ref={usageContentRef}
                  className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0"
                  onScroll={handleUsageScroll}
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {isLoadingUsage && usageRows.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-sm text-[#8c8c8c]">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>加载中...</span>
                    </div>
                  ) : (
                    <>
                      {usageRows.map((row, index) => (
                        <div
                          key={row.id}
                          className={`flex items-center px-5 py-3.5 text-sm text-[#666] border-b border-[#f0f0f0] ${index % 2 === 0 ? 'bg-[#ebebeb]' : 'bg-white'}`}
                        >
                          <div
                            className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-left"
                            title={row.detailText}
                          >
                            {row.detailText}
                          </div>
                          <div className="w-[200px] shrink-0 text-left">
                            {row.createdTimeText}
                          </div>
                          <div
                            className={`w-[110px] shrink-0 text-left font-medium ${row.pointsClass}`}
                          >
                            {row.pointsText}
                          </div>
                        </div>
                      ))}
                      {usageRows.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-[60px] px-5 text-[#8c8c8c] text-sm">
                          暂无使用记录
                        </div>
                      )}
                      {isLoadingMoreUsage && (
                        <div className="flex items-center justify-center gap-2 py-6 text-sm text-[#8c8c8c]">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>加载中...</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="px-8 pt-8 pb-0">
              <h2 className="h-17 px-5 text-[36px] leading-17 text-2xl font-bold text-transparent bg-linear-to-r from-[#efaf00] to-[#ff9500] bg-clip-text">
                额度
              </h2>
            </div>

            <div className="flex flex-col items-center w-full px-[69px] pb-8 h-[660px]">
              <div className="relative mt-[9px] w-full">
                <img
                  src={quotaBackImg}
                  alt=""
                  className="absolute left-0 top-0 w-full z-1 aspect-195/62 object-cover"
                  aria-hidden
                />
                <div className="w-full aspect-195/62" />
                <div className="absolute left-0 top-0 w-full aspect-195/62 flex flex-row items-center justify-center z-2">
                  <div className="flex-1 flex flex-col items-center text-center mt-[15px]">
                    <div className="text-[40px] font-bold text-white leading-[1.32]">
                      {dailyFreeUsed}/{dailyFreeTotal}
                    </div>
                    <div className="text-base text-white/80 leading-[1.32] mt-[10px]">
                      （内测每日积分）
                    </div>
                  </div>
                  <img
                    src={separateWhiteIcon}
                    alt=""
                    className="w-[2px] h-[67px] shrink-0 mx-6 self-center"
                    aria-hidden
                  />
                  <div className="flex-1 flex flex-col items-center text-center mt-[15px]">
                    <div className="text-[40px] font-bold text-white leading-[1.32]">
                      {fixedQuota}
                    </div>
                    <div className="text-base text-white/80 leading-[1.32] mt-[10px]">
                      （固定积分）
                    </div>
                  </div>
                </div>
                <div className="flex h-[54px] w-full flex-row items-center justify-center border-b border-l border-r border-[#EFAF00] rounded-b-[20px]">
                  <div
                    role="button"
                    className="flex flex-1 flex-row items-center justify-center gap-1.5 cursor-pointer text-[20px] font-normal text-[#9a9a9a] leading-[1.32] border-none bg-transparent p-0"
                    onClick={handleTopUp}
                    onKeyDown={e => e.key === 'Enter' && handleTopUp()}
                  >
                    <img src={topUpIcon} alt="" className="h-[21px] w-[21px]" />
                    <span>充值</span>
                  </div>
                  <img src={separateYellowIcon} alt="" className="w-px h-[39px]" />
                  <div
                    role="button"
                    className="flex flex-1 flex-row items-center justify-center gap-1.5 cursor-pointer text-[20px] font-normal text-[#9a9a9a] leading-[1.32] border-none bg-transparent p-0"
                    onClick={handleOpenExchange}
                    onKeyDown={e => e.key === 'Enter' && handleOpenExchange()}
                  >
                    <img src={exchangeIcon} alt="" className="h-[24px] w-[26px]" />
                    <span>兑换</span>
                  </div>
                </div>
              </div>

              <div className="w-full bg-[#dadada] opacity-50 h-px my-5" />

              <div className="w-full pl-1.5">
                <div className="flex items-center gap-4 mb-5">
                  <img src={invitationIcon} alt="" className="h-[26px] w-[24px]" />
                  <span className="text-[20px] font-bold text-transparent bg-linear-to-r from-[#efaf00] to-[#ff9500] bg-clip-text">
                    邀请记录
                  </span>
                </div>
                <div className="mb-5 h-[122px] w-full rounded-[20px] bg-linear-to-r from-[#efaf00] to-[#ff9500] p-px">
                  <div className="flex h-full w-full items-center justify-center rounded-[19px] bg-linear-to-b from-[#fff8e5] to-white">
                    <div className="flex flex-1 flex-col items-center text-center">
                      <div className="text-2xl font-normal text-[#464646] leading-[1.32]">
                        {bonusPoints}
                      </div>
                      <div className="text-[13px] text-[#999] mt-[11px] leading-[1.32]">
                        （累计获赠积分）
                      </div>
                    </div>
                    <img
                      src={separateYellowIcon}
                      alt=""
                      className="h-12 w-px shrink-0"
                      aria-hidden
                    />
                    <div className="flex flex-1 flex-col items-center text-center">
                      <div className="text-2xl font-normal text-[#464646] leading-[1.32]">
                        {inviteeCount}
                        <span className="text-[15px]">人</span>
                      </div>
                      <div className="text-[13px] text-[#999] mt-[11px] leading-[1.32]">
                        （邀请人数）
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-sm text-[#999] leading-[1.32] mb-3.5">
                  分享邀请链接，新用户注册每人可获得200积分
                </div>
                <div className="flex items-center gap-5 h-[43px] mb-5">
                  <input
                    type="text"
                    readOnly
                    value={invitationLink}
                    className="flex-1 h-[43px] px-3 rounded-[10px] border-none bg-[#f5f5f5] text-base text-[#999] outline-none cursor-default"
                  />
                  <div
                    className="shrink-0 w-[68px] h-[37px] flex items-center justify-center rounded-[10px] bg-linear-to-r from-[#efaf00] to-[#ff9500] text-lg font-normal text-white cursor-pointer leading-[1.32] hover:brightness-110 active:brightness-90"
                    onClick={handleCopyLink}
                    onKeyDown={e => e.key === 'Enter' && handleCopyLink()}
                  >
                    复制
                  </div>
                </div>
                <div className="h-px w-full bg-[#dadada] opacity-50 mb-5" />
                <div
                  role="button"
                  className="flex items-center gap-2 cursor-pointer text-base font-normal text-[#9a9a9a] leading-[1.32] hover:text-[#ff9500]"
                  onClick={handleOpenUsageDetails}
                  onKeyDown={e => e.key === 'Enter' && handleOpenUsageDetails()}
                >
                  <span className="iconfont text-xl text-[#9a9a9a] hover:text-[#ff9500]">
                    <Iconfont unicode="&#xe619;" />
                  </span>
                  <span>使用情况</span>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>

    <Dialog open={exchangeRedeemOpen} onOpenChange={(open) => !open && handleRedeemClose()}>
      <DialogContent
        showCloseButton
        className="w-[440px] p-8 rounded-2xl"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          if (!redeemLoading) handleRedeemClose()
          else e.preventDefault()
        }}
      >
        <div className="flex flex-col items-center">
          <Gift className="h-14 w-14 text-[#ff9500] mb-4" strokeWidth={1.5} />
          <h3 className="text-lg font-medium text-[#333] mb-6 text-center">
            使用兑换码换取生文额度
          </h3>
          <div className="w-full flex gap-3">
            <Input
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value)}
              placeholder="请填入您的兑换码"
              className="flex-1 h-11 rounded-xl border-[#e5e5e5] bg-[#f5f5f5] text-base"
              disabled={redeemLoading}
              onKeyDown={(e) => e.key === 'Enter' && handleRedeemSubmit()}
            />
            <button
              type="button"
              disabled={redeemLoading || !redeemCode.trim()}
              onClick={() => void handleRedeemSubmit()}
              className="shrink-0 h-11 px-6 rounded-xl font-medium text-white bg-linear-to-r from-[#efaf00] to-[#ff9500] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {redeemLoading ? '兑换中...' : '兑换'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </>
  )
}
