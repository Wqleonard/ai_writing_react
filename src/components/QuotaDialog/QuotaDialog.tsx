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
import {
  createBillingOrderReq,
  getBillingOrderDetailReq,
  getBillingOrdersReq,
  getOrderHistory,
  getProductsReq,
  type BillingOrderDetail,
  type BillingOrderListItem,
  type Order,
  type Product,
} from '@/api/order'
import { redeemCodeReq } from '@/api/redemptionCodes'
import { formatLocalTime } from '@/utils/formatLocalTime'
import { toast } from 'sonner'
import { Loader2, Gift, CreditCard, ReceiptText, ExternalLink } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import Empty from '@/components/ui/Empty'

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

type DialogView = 'quota' | 'usage' | 'bill'
type Locale = 'zh' | 'en'

const STATUS_TEXT_MAP: Record<string, Record<Locale, string>> = {
  PENDING: { zh: '待支付', en: 'Pending' },
  PAID: { zh: '已支付', en: 'Paid' },
  CANCELLED: { zh: '已取消', en: 'Cancelled' },
  REFUNDED: { zh: '已退款', en: 'Refunded' },
}

export const QuotaDialog = ({ open, onOpenChange }: QuotaDialogProps) => {
  const [view, setView] = useState<DialogView>('quota')
  const [dailyFreeUsed, setDailyFreeUsed] = useState(0)
  const [dailyFreeTotal] = useState(1000000 / 1000)
  const [fixedQuota, setFixedQuota] = useState(0)
  const [bonusPoints, setBonusPoints] = useState(0)
  const [inviteeCount, setInviteeCount] = useState(0)
  const [invitationLink, setInvitationLink] = useState('https://baowenmao.com')

  const [exchangeRedeemOpen, setExchangeRedeemOpen] = useState(false)
  const [redeemCode, setRedeemCode] = useState('')
  const [redeemLoading, setRedeemLoading] = useState(false)

  const [topUpOpen, setTopUpOpen] = useState(false)
  const [productLoading, setProductLoading] = useState(false)
  const [productList, setProductList] = useState<Product[]>([])
  const [selectedSkuId, setSelectedSkuId] = useState<number | null>(null)
  const [createOrderLoading, setCreateOrderLoading] = useState(false)

  const [usageFilterType, setUsageFilterType] = useState('0')
  const [ordersList, setOrdersList] = useState<Order[]>([])
  const [isLoadingUsage, setIsLoadingUsage] = useState(false)
  const [isLoadingMoreUsage, setIsLoadingMoreUsage] = useState(false)
  const [hasMoreUsage, setHasMoreUsage] = useState(true)
  const usagePageRef = useRef(-1)
  const usageContentRef = useRef<HTMLDivElement>(null)
  const usageScrollTickingRef = useRef(false)

  const [billingOrders, setBillingOrders] = useState<BillingOrderListItem[]>([])
  const [isLoadingBill, setIsLoadingBill] = useState(false)
  const [isLoadingMoreBill, setIsLoadingMoreBill] = useState(false)
  const [hasMoreBill, setHasMoreBill] = useState(true)
  const billPageRef = useRef(-1)
  const billContentRef = useRef<HTMLDivElement>(null)
  const billScrollTickingRef = useRef(false)

  const [orderDetailOpen, setOrderDetailOpen] = useState(false)
  const [orderDetailLoading, setOrderDetailLoading] = useState(false)
  const [billingOrderDetail, setBillingOrderDetail] = useState<BillingOrderDetail | null>(null)

  const locale: Locale = useMemo(() => {
    if (typeof navigator === 'undefined') return 'zh'
    return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
  }, [])
  const t = useCallback((zh: string, en: string) => (locale === 'zh' ? zh : en), [locale])

  const usageFilterOptions = useMemo(
    () => [
      { ...USAGE_FILTER_OPTIONS[0], name: t('全部', 'All') },
      { ...USAGE_FILTER_OPTIONS[1], name: t('获取', 'Increase') },
      { ...USAGE_FILTER_OPTIONS[2], name: t('消耗', 'Decrease') },
    ],
    [t]
  )

  const topUpSkuList = useMemo(
    () =>
      productList.flatMap(product =>
        (product.skus || []).map(sku => ({
          ...sku,
          productName: product.name,
          productDescription: product.description,
          productType: product.type,
        }))
      ),
    [productList]
  )

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
      void updateQuota()
      void updateInvitation()
    }
  }, [open, updateQuota, updateInvitation])

  const formatCurrency = useCallback((amount?: number, currency?: string) => {
    const val = Number(amount ?? 0)
    const symbol = currency === 'USD' ? '$' : '¥'
    return `${symbol}${Number.isFinite(val) ? val.toFixed(2) : '0.00'}`
  }, [])

  const getStatusText = useCallback(
    (status?: string) => {
      if (!status) return '-'
      const mapped = STATUS_TEXT_MAP[status]
      if (!mapped) return status
      return mapped[locale]
    },
    [locale]
  )

  const getStatusClass = useCallback((status?: string) => {
    if (status === 'PAID') return 'text-[#67c23a]'
    if (status === 'PENDING') return 'text-[#e6a23c]'
    if (status === 'REFUNDED') return 'text-[#909399]'
    if (status === 'CANCELLED') return 'text-[#f56c6c]'
    return 'text-[#909399]'
  }, [])

  const getOrderNo = useCallback((bill: BillingOrderListItem) => {
    const raw = bill.billingNo ?? bill.orderNo ?? bill.id
    return raw != null ? String(raw) : ''
  }, [])

  const loadProducts = useCallback(async () => {
    setProductLoading(true)
    try {
      const data = await getProductsReq()
      setProductList(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      toast.error(t('商品列表加载失败', 'Failed to load products'))
    } finally {
      setProductLoading(false)
    }
  }, [t])

  const handleTopUp = useCallback(() => {
    setSelectedSkuId(null)
    setTopUpOpen(true)
    void loadProducts()
  }, [loadProducts])

  const handleTopUpClose = useCallback(() => {
    if (createOrderLoading) return
    setTopUpOpen(false)
    setSelectedSkuId(null)
  }, [createOrderLoading])

  const closeAllQuotaDialogs = useCallback(() => {
    setTopUpOpen(false)
    setExchangeRedeemOpen(false)
    setOrderDetailOpen(false)
    setView('quota')
    onOpenChange(false)
  }, [onOpenChange])

  const handleCreateBillingOrder = useCallback(async () => {
    if (!selectedSkuId) {
      toast.warning(t('请选择充值商品', 'Please select an item'))
      return
    }
    setCreateOrderLoading(true)
    try {
      const res = await createBillingOrderReq(selectedSkuId)
      if (res?.cashierUrl) {
        const opened = window.open(res.cashierUrl, '_blank', 'noopener,noreferrer')
        // if (!opened) toast.warning(t('请允许浏览器打开新窗口', 'Please allow popups for this site'))
        // if (opened) {
         
        // }
        toast.success(t('订单已创建，请完成支付', 'Order created. Please complete payment'))
      }
      setSelectedSkuId(null)
      closeAllQuotaDialogs()
    } catch (err) {
      console.error(err)
    } finally {
      setCreateOrderLoading(false)
    }
  }, [selectedSkuId, t, closeAllQuotaDialogs])

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
      toast.warning(t('请填入兑换码', 'Please enter redeem code'))
      return
    }
    setRedeemLoading(true)
    try {
      await redeemCodeReq(code)
      toast.success(t('兑换成功', 'Redeemed successfully'))
      handleRedeemClose()
      await updateQuota()
    } catch (err: any) {
      console.error(err)
    } finally {
      setRedeemLoading(false)
    }
  }, [redeemCode, handleRedeemClose, updateQuota, t])

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

  const loadMoreBilling = useCallback(async () => {
    if (isLoadingMoreBill || isLoadingBill) return
    if (!hasMoreBill) return
    const nextPage = billPageRef.current + 1
    if (nextPage === 0) setIsLoadingBill(true)
    else setIsLoadingMoreBill(true)
    try {
      const data = await getBillingOrdersReq({
        page: nextPage,
        size: PAGE_SIZE,
      })
      console.log('[QuotaDialog] billing list response', data)
      const list = Array.isArray(data?.content) ? data.content : []
      if (!Array.isArray(data?.content)) {
        setHasMoreBill(false)
        return
      }
      if (list.length > 0) {
        setBillingOrders(prev => [...prev, ...list])
        billPageRef.current = nextPage
      }
      const noMore =
        list.length < PAGE_SIZE ||
        (data.totalPages != null && nextPage >= data.totalPages - 1)
      if (noMore) setHasMoreBill(false)
    } catch (err) {
      console.error(err)
      setHasMoreBill(false)
    } finally {
      setIsLoadingBill(false)
      setIsLoadingMoreBill(false)
    }
  }, [isLoadingMoreBill, isLoadingBill, hasMoreBill])

  const resetAndLoadBilling = useCallback(async () => {
    setBillingOrders([])
    billPageRef.current = -1
    setHasMoreBill(true)
    setIsLoadingBill(true)
    setIsLoadingMoreBill(false)
    try {
      const data = await getBillingOrdersReq({
        page: 0,
        size: PAGE_SIZE,
      })
      console.log('[QuotaDialog] billing list response', data)
      const list = Array.isArray(data?.content) ? data.content : []
      setBillingOrders(list)
      billPageRef.current = 0
      const noMore =
        list.length < PAGE_SIZE ||
        (data.totalPages != null && 0 >= data.totalPages - 1)
      if (noMore) setHasMoreBill(false)
    } catch (err) {
      console.error(err)
      setHasMoreBill(false)
    } finally {
      setIsLoadingBill(false)
    }
  }, [])

  const handleUsageScroll = useCallback(() => {
    if (usageScrollTickingRef.current) return
    usageScrollTickingRef.current = true
    requestAnimationFrame(() => {
      const el = usageContentRef.current
      if (el) {
        const { scrollTop, scrollHeight, clientHeight } = el
        if (scrollHeight - scrollTop - clientHeight < 50) void loadMoreUsage()
      }
      usageScrollTickingRef.current = false
    })
  }, [loadMoreUsage])

  const handleBillScroll = useCallback(() => {
    if (billScrollTickingRef.current) return
    billScrollTickingRef.current = true
    requestAnimationFrame(() => {
      const el = billContentRef.current
      if (el) {
        const { scrollTop, scrollHeight, clientHeight } = el
        if (scrollHeight - scrollTop - clientHeight < 50) void loadMoreBilling()
      }
      billScrollTickingRef.current = false
    })
  }, [loadMoreBilling])

  const handleOpenUsageDetails = useCallback(() => {
    setView('usage')
    setOrdersList([])
    usagePageRef.current = -1
    setHasMoreUsage(true)
    setUsageFilterType('0')
  }, [])

  const handleOpenBillDetails = useCallback(() => {
    setView('bill')
    setBillingOrders([])
    billPageRef.current = -1
    setHasMoreBill(true)
  }, [])

  const handleUsageReturn = useCallback(() => {
    setView('quota')
  }, [])

  const handleDialogOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setView('quota')
      }
      onOpenChange(next)
    },
    [onOpenChange]
  )

  const usageRows = useMemo(
    () =>
      ordersList.map(order => ({
        id: order.id,
        detailText: getDetailText(order),
        createdTimeText: formatLocalTime(order.createdTime),
        pointsText: formatPoints(order),
        pointsClass: getPointsClass(order),
      })),
    [ordersList]
  )

  const billingRows = useMemo(
    () =>
      billingOrders.map((bill, index) => ({
        id: getOrderNo(bill) || `${bill.createdTime || ''}-${index}`,
        orderNo: getOrderNo(bill),
        detailText: String(bill.skuName || bill.name || '-'),
        createdTimeText: bill.createdTime ? formatLocalTime(String(bill.createdTime)) : '-',
        amountText: formatCurrency(
          Number(bill.amount ?? bill.skuPrice ?? 0),
          String(bill.currency || bill.skuCurrency || 'CNY')
        ),
        statusText: getStatusText(String(bill.status || '')),
        statusClass: getStatusClass(String(bill.status || '')),
      })),
    [billingOrders, formatCurrency, getOrderNo, getStatusClass, getStatusText]
  )

  const handleOpenOrderDetail = useCallback(async (orderNo: string) => {
    if (!orderNo) return
    setOrderDetailOpen(true)
    setOrderDetailLoading(true)
    setBillingOrderDetail(null)
    try {
      const data = await getBillingOrderDetailReq(orderNo)
      console.log('[QuotaDialog] billing detail response', data)
      setBillingOrderDetail(data)
    } catch (err) {
      console.error(err)
      setOrderDetailOpen(false)
    } finally {
      setOrderDetailLoading(false)
    }
  }, [])

  const handleOpenPayLinkAndClose = useCallback(
    (url: string) => {
      const opened = window.open(url, '_blank', 'noopener,noreferrer')
      // if (!opened) {
      //   toast.warning(t('请允许浏览器打开新窗口', 'Please allow popups for this site'))
      // }
      closeAllQuotaDialogs()
    },
    [closeAllQuotaDialogs]
  )

  useEffect(() => {
    if (view === 'usage') {
      void resetAndLoadUsage()
    }
  }, [view, usageFilterType, resetAndLoadUsage])

  useEffect(() => {
    if (view === 'bill') {
      void resetAndLoadBilling()
    }
  }, [view, resetAndLoadBilling])

  const handleCopyLink = useCallback(async () => {
    const copyText =
      locale === 'zh'
        ? `我最近在用【爆文猫】AI写作工具，宝藏功能有：AI教练、拆书仿写、切换文风、小说转剧本……\n${invitationLink} \n快帮我点点邀请链接，登录就能薅百万token！`
        : `I am using BoomCat AI writing tool with powerful features.\n${invitationLink}\nSign in from my invitation link and get free tokens!`

    const fallbackCopy = (text: string) => {
      const textarea = document.createElement('textarea')
      textarea.value = text
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
        toast.success(t('邀请链接已复制到剪贴板', 'Invitation link copied'))
        return
      } catch {
        // fallback
      }
    }

    if (fallbackCopy(copyText)) {
      toast.success(t('邀请链接已复制到剪贴板', 'Invitation link copied'))
      return
    }

    toast.error(t('复制失败，请手动复制', 'Copy failed, please copy manually'))
  }, [invitationLink, locale, t])

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
            <DialogTitle>
              {view === 'usage'
                ? t('使用情况', 'Usage')
                : view === 'bill'
                  ? t('账单', 'Billing')
                  : t('额度', 'Quota')}
            </DialogTitle>
          </VisuallyHidden>

          {view === 'usage' && (
            <>
              <div className="px-8 pt-8 pb-0">
                <div className="h-17 flex items-center justify-between w-full">
                  <div className="flex items-center justify-between">
                    <div
                      role="button"
                      className="flex h-10 w-10 items-center justify-center mr-1.5 p-0 border-none bg-transparent cursor-pointer text-[34px] text-[#8c8c8c] hover:text-[#ff9500]"
                      onClick={handleUsageReturn}
                      onKeyDown={e => e.key === 'Enter' && handleUsageReturn()}
                      aria-label={t('返回', 'Back')}
                    >
                      <Iconfont unicode="&#xeaa2;" />
                    </div>
                    <h2 className="m-0 flex-1 text-[36px] font-bold leading-[1.32] text-transparent bg-linear-to-r from-[#efaf00] to-[#ff9500] bg-clip-text">
                      {t('使用情况', 'Usage')}
                    </h2>
                  </div>
                  <Select value={usageFilterType} onValueChange={setUsageFilterType}>
                    <SelectTrigger className="min-w-[100px] h-[30px] rounded-[20px] border-[#d8d8d8] px-3.5 text-[15px] text-[#8c8c8c]">
                      <SelectValue placeholder={t('请选择', 'Please select')} />
                    </SelectTrigger>
                    <SelectContent align="end">
                      {usageFilterOptions.map(opt => (
                        <SelectItem key={opt.id} value={opt.id} className="cursor-pointer">
                          {opt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="min-h-[480px] max-h-[660px] h-[660px] flex flex-col overflow-hidden px-[35px] pt-6 pb-[35px]">
                <div className="flex-1 min-h-0 flex flex-col border rounded-[20px] overflow-hidden bg-white border-[#e5e5e5] focus-visible:border-[#e5e5e5]">
                  <div className="shrink-0 flex items-center px-5 py-3.5 text-[15px] font-semibold text-[#8c8c8c] bg-[#e8e8e8] border-b border-[#e0e0e0]">
                    <div className="flex-1 min-w-0 text-left">{t('详情', 'Detail')}</div>
                    <div className="w-[200px] shrink-0 text-left">{t('日期', 'Date')}</div>
                    <div className="w-[110px] shrink-0 text-left">{t('积分变更', 'Points')}</div>
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
                        <span>{t('加载中...', 'Loading...')}</span>
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
                            <div className="w-[200px] shrink-0 text-left">{row.createdTimeText}</div>
                            <div className={`w-[110px] shrink-0 text-left font-medium ${row.pointsClass}`}>
                              {row.pointsText}
                            </div>
                          </div>
                        ))}
                        {usageRows.length === 0 && (
                          <Empty
                            className="py-[60px]"
                            description={t('暂无使用记录', 'No usage records')}
                          />
                        )}
                        {isLoadingMoreUsage && (
                          <div className="flex items-center justify-center gap-2 py-6 text-sm text-[#8c8c8c]">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>{t('加载中...', 'Loading...')}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {view === 'bill' && (
            <>
              <div className="px-8 pt-8 pb-0">
                <div className="h-17 flex items-center justify-between w-full">
                  <div className="flex items-center justify-between">
                    <div
                      role="button"
                      className="flex h-10 w-10 items-center justify-center mr-1.5 p-0 border-none bg-transparent cursor-pointer text-[34px] text-[#8c8c8c] hover:text-[#ff9500]"
                      onClick={handleUsageReturn}
                      onKeyDown={e => e.key === 'Enter' && handleUsageReturn()}
                      aria-label={t('返回', 'Back')}
                    >
                      <Iconfont unicode="&#xeaa2;" />
                    </div>
                    <h2 className="m-0 flex-1 text-[36px] font-bold leading-[1.32] text-transparent bg-linear-to-r from-[#efaf00] to-[#ff9500] bg-clip-text">
                      {t('账单', 'Billing')}
                    </h2>
                  </div>
                </div>
              </div>
              <div className="min-h-[480px] max-h-[660px] h-[660px] flex flex-col overflow-hidden px-[35px] pt-6 pb-[35px]">
                <div className="flex-1 min-h-0 flex flex-col border rounded-[20px] overflow-hidden bg-white border-[#e5e5e5] focus-visible:border-[#e5e5e5]">
                  <div className="shrink-0 flex items-center px-5 py-3.5 text-[15px] font-semibold text-[#8c8c8c] bg-[#e8e8e8] border-b border-[#e0e0e0]">
                    <div className="w-[200px] shrink-0 text-left">{t('日期', 'Date')}</div>
                    <div className="flex-1 min-w-0 text-left">{t('商品', 'Item')}</div>
                    <div className="w-[110px] shrink-0 text-left">{t('金额', 'Amount')}</div>
                    <div className="w-[110px] shrink-0 text-left">{t('状态', 'Status')}</div>
                  </div>
                  <div
                    ref={billContentRef}
                    className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0"
                    onScroll={handleBillScroll}
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {isLoadingBill && billingRows.length === 0 ? (
                      <div className="flex items-center justify-center gap-2 py-6 text-sm text-[#8c8c8c]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{t('加载中...', 'Loading...')}</span>
                      </div>
                    ) : (
                      <>
                        {billingRows.map((row, index) => (
                          <div
                            key={row.id}
                            role="button"
                            tabIndex={0}
                            className={`flex items-center px-5 py-3.5 text-sm text-[#666] border-b border-[#f0f0f0] cursor-pointer hover:bg-[#fff8e5] ${index % 2 === 0 ? 'bg-[#ebebeb]' : 'bg-white'}`}
                            onClick={() => void handleOpenOrderDetail(row.orderNo)}
                            onKeyDown={e => e.key === 'Enter' && void handleOpenOrderDetail(row.orderNo)}
                          >
                            <div className="w-[200px] shrink-0 text-left truncate" title={row.createdTimeText}>
                              {row.createdTimeText}
                            </div>
                            <div className="flex-1 min-w-0 text-left truncate" title={row.detailText}>
                              {row.detailText}
                            </div>
                            <div className="w-[110px] shrink-0 text-left">{row.amountText}</div>
                            <div className={cn('w-[110px] shrink-0 text-left font-medium', row.statusClass)}>
                              {row.statusText}
                            </div>
                          </div>
                        ))}
                        {billingRows.length === 0 && (
                          <div className="h-full min-h-[380px] flex items-center justify-center">
                            <Empty
                              description={
                                <span className="text-sm text-[#999]">
                                  {t('暂无账单记录', 'No billing records')}
                                </span>
                              }
                            />
                          </div>
                        )}
                        {isLoadingMoreBill && (
                          <div className="flex items-center justify-center gap-2 py-6 text-sm text-[#8c8c8c]">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>{t('加载中...', 'Loading...')}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {view === 'quota' && (
            <>
              <div className="px-8 pt-8 pb-0">
                <h2 className="h-17 px-5 text-[36px] leading-17 text-2xl font-bold text-transparent bg-linear-to-r from-[#efaf00] to-[#ff9500] bg-clip-text">
                  {t('额度', 'Quota')}
                </h2>
              </div>
              <div className="flex flex-col items-center w-full px-[69px] pb-5 h-[660px]">
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
                        {t('（内测每日积分）', '(Daily beta points)')}
                      </div>
                    </div>
                    <img
                      src={separateWhiteIcon}
                      alt=""
                      className="w-[2px] h-[67px] shrink-0 mx-6 self-center"
                      aria-hidden
                    />
                    <div className="flex-1 flex flex-col items-center text-center mt-[15px]">
                      <div className="text-[40px] font-bold text-white leading-[1.32]">{fixedQuota}</div>
                      <div className="text-base text-white/80 leading-[1.32] mt-[10px]">
                        {t('（固定积分）', '(Fixed points)')}
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
                      <span>{t('充值', 'Top up')}</span>
                    </div>
                    <img src={separateYellowIcon} alt="" className="w-px h-[39px]" />
                    <div
                      role="button"
                      className="flex flex-1 flex-row items-center justify-center gap-1.5 cursor-pointer text-[20px] font-normal text-[#9a9a9a] leading-[1.32] border-none bg-transparent p-0"
                      onClick={handleOpenExchange}
                      onKeyDown={e => e.key === 'Enter' && handleOpenExchange()}
                    >
                      <img src={exchangeIcon} alt="" className="h-[24px] w-[26px]" />
                      <span>{t('兑换', 'Redeem')}</span>
                    </div>
                  </div>
                </div>

                <div className="w-full bg-[#dadada] opacity-50 h-px my-5" />

                <div className="w-full pl-1.5">
                  <div className="flex items-center gap-4 mb-4">
                    <img src={invitationIcon} alt="" className="h-[26px] w-[24px]" />
                    <span className="text-[20px] font-bold text-transparent bg-linear-to-r from-[#efaf00] to-[#ff9500] bg-clip-text">
                      {t('邀请记录', 'Invitations')}
                    </span>
                  </div>
                  <div className="mb-4 h-[122px] w-full rounded-[20px] bg-linear-to-r from-[#efaf00] to-[#ff9500] p-px">
                    <div className="flex h-full w-full items-center justify-center rounded-[19px] bg-linear-to-b from-[#fff8e5] to-white">
                      <div className="flex flex-1 flex-col items-center text-center">
                        <div className="text-2xl font-normal text-[#464646] leading-[1.32]">{bonusPoints}</div>
                        <div className="text-[13px] text-[#999] mt-[11px] leading-[1.32]">
                          {t('（累计获赠积分）', '(Total bonus points)')}
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
                          <span className="text-[15px]">{t('人', '')}</span>
                        </div>
                        <div className="text-[13px] text-[#999] mt-[11px] leading-[1.32]">
                          {t('（邀请人数）', '(Invitees)')}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-[#999] leading-[1.32] mb-3">
                    {t(
                      '分享邀请链接，新用户注册每人可获得200积分',
                      'Share your invitation link. Each new signup grants 200 points.'
                    )}
                  </div>
                  <div className="flex items-center gap-5 h-[43px] mb-4">
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
                      {t('复制', 'Copy')}
                    </div>
                  </div>
                  <div className="h-px w-full bg-[#dadada] opacity-50 mb-4" />
                  <div
                    role="button"
                    className="flex items-center gap-2 cursor-pointer text-base font-normal text-[#9a9a9a] leading-[1.32] hover:text-[#ff9500]"
                    onClick={handleOpenUsageDetails}
                    onKeyDown={e => e.key === 'Enter' && handleOpenUsageDetails()}
                  >
                    <span className="iconfont text-xl text-[#9a9a9a] hover:text-[#ff9500]">
                      <Iconfont unicode="&#xe619;" />
                    </span>
                    <span>{t('使用情况', 'Usage')}</span>
                  </div>
                  <div className="mt-3" />
                  <div
                    role="button"
                    className="group flex items-center gap-2 cursor-pointer text-base font-normal text-[#9a9a9a] leading-[1.32] hover:text-[#ff9500]"
                    onClick={handleOpenBillDetails}
                    onKeyDown={e => e.key === 'Enter' && handleOpenBillDetails()}
                  >
                    <span className="text-xl text-[#9a9a9a] group-hover:text-[#ff9500]">
                      <ReceiptText className="h-5 w-5" />
                    </span>
                    <span>{t('账单', 'Billing')}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={exchangeRedeemOpen} onOpenChange={next => !next && handleRedeemClose()}>
        <DialogContent
          showCloseButton
          className="w-[440px] p-8 rounded-2xl"
          onInteractOutside={e => e.preventDefault()}
          onEscapeKeyDown={e => {
            if (!redeemLoading) handleRedeemClose()
            else e.preventDefault()
          }}
        >
          <div className="flex flex-col items-center">
            <Gift className="h-14 w-14 text-[#ff9500] mb-4" strokeWidth={1.5} />
            <h3 className="text-lg font-medium text-[#333] mb-6 text-center">
              {t('使用兑换码换取生文额度', 'Redeem code for writing credits')}
            </h3>
            <div className="w-full flex gap-3">
              <Input
                value={redeemCode}
                onChange={e => setRedeemCode(e.target.value)}
                placeholder={t('请填入您的兑换码', 'Please enter your redeem code')}
                className="flex-1 h-11 rounded-xl border-[#e5e5e5] bg-[#f5f5f5] text-base"
                disabled={redeemLoading}
                onKeyDown={e => e.key === 'Enter' && void handleRedeemSubmit()}
              />
              <button
                type="button"
                disabled={redeemLoading || !redeemCode.trim()}
                onClick={() => void handleRedeemSubmit()}
                className="shrink-0 h-11 px-6 rounded-xl font-medium text-white bg-linear-to-r from-[#efaf00] to-[#ff9500] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {redeemLoading ? t('兑换中...', 'Redeeming...') : t('兑换', 'Redeem')}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={topUpOpen} onOpenChange={next => !next && handleTopUpClose()}>
        <DialogContent
          showCloseButton
          className="w-[560px] p-8 rounded-2xl"
          onInteractOutside={e => {
            if (createOrderLoading) e.preventDefault()
          }}
          onEscapeKeyDown={e => {
            if (createOrderLoading) e.preventDefault()
          }}
        >
          <div className="flex flex-col">
            <div className="flex items-center justify-center gap-2 mb-6">
              <CreditCard className="h-6 w-6 text-[#ff9500]" />
              <h3 className="text-xl font-semibold text-[#333]">
                {t('选择充值商品', 'Select product')}
              </h3>
            </div>
            <div className="max-h-[360px] overflow-y-auto pr-1 space-y-3">
              {productLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#8c8c8c]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t('加载中...', 'Loading...')}</span>
                </div>
              ) : topUpSkuList.length === 0 ? (
                <Empty className="py-8" description={t('暂无可购买商品', 'No products available')} />
              ) : (
                topUpSkuList.map(sku => {
                  const selected = selectedSkuId === sku.id
                  return (
                    <div
                      key={sku.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedSkuId(sku.id)}
                      onKeyDown={e => e.key === 'Enter' && setSelectedSkuId(sku.id)}
                      className={cn(
                        'rounded-xl border px-4 py-3 cursor-pointer transition-colors',
                        selected
                          ? 'border-[#efaf00] bg-[#fff8e5]'
                          : 'border-[#e5e5e5] bg-white hover:border-[#ffcf5a]'
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-base font-medium text-[#333]">{sku.productName}</div>
                          <div className="text-sm text-[#8c8c8c] mt-1">
                            {sku.productDescription || '-'}
                          </div>
                        </div>
                        <div className="text-lg font-semibold text-[#ff9500]">
                          {formatCurrency(sku.price, sku.currency)}
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-[#999] flex items-center gap-3">
                        <span>
                          {t('有效期', 'Valid days')}: {sku.validDays}
                          {t('天', 'd')}
                        </span>
                        <span>
                          {t('每日赠送积分', 'Daily bonus')}: {sku.dailyBonusCredits}
                        </span>
                        <span>
                          {t('积分上限', 'Max points')}: {sku.maxCredits}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            <button
              type="button"
              disabled={!selectedSkuId || createOrderLoading}
              onClick={() => void handleCreateBillingOrder()}
              className="mt-6 h-11 rounded-xl font-medium text-white bg-linear-to-r from-[#efaf00] to-[#ff9500] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {createOrderLoading ? t('创建订单中...', 'Creating order...') : t('确认支付', 'Pay now')}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={orderDetailOpen}
        onOpenChange={next => {
          if (!orderDetailLoading) setOrderDetailOpen(next)
        }}
      >
        <DialogContent
          showCloseButton
          className="w-[520px] p-8 rounded-2xl"
          onInteractOutside={e => {
            if (orderDetailLoading) e.preventDefault()
          }}
          onEscapeKeyDown={e => {
            if (orderDetailLoading) e.preventDefault()
          }}
        >
          <div className="flex flex-col">
            <h3 className="text-xl font-semibold text-[#333] mb-6">{t('订单详情', 'Order Detail')}</h3>
            {orderDetailLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#8c8c8c]">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t('加载中...', 'Loading...')}</span>
              </div>
            ) : billingOrderDetail ? (
              <div className="space-y-3 text-sm text-[#666]">
                <div className="flex justify-between gap-4">
                  <span>{t('订单号', 'Order No.')}</span>
                  <span className="text-right">{billingOrderDetail.billingNo}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>{t('状态', 'Status')}</span>
                  <span className={cn('font-medium', getStatusClass(billingOrderDetail.status))}>
                    {getStatusText(billingOrderDetail.status)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>{t('支付金额', 'Amount')}</span>
                  <span>
                    {formatCurrency(billingOrderDetail.amount, billingOrderDetail.skuCurrency)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>{t('支付渠道', 'Pay channel')}</span>
                  <span>{billingOrderDetail.payChannel || '-'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>{t('支付时间', 'Paid time')}</span>
                  <span>
                    {billingOrderDetail.paidTime ? formatLocalTime(billingOrderDetail.paidTime) : '-'}
                  </span>
                </div>
                <div className="h-px bg-[#efefef] my-2" />
                <div className="flex justify-between gap-4">
                  <span>{t('商品', 'SKU')}</span>
                  <span>{billingOrderDetail.skuName || '-'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>{t('商品价格', 'SKU price')}</span>
                  <span>
                    {formatCurrency(billingOrderDetail.skuPrice, billingOrderDetail.skuCurrency)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>{t('固定积分', 'SKU credits')}</span>
                  <span>{billingOrderDetail.skuCredits ?? 0}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>{t('每日赠送积分', 'Daily bonus')}</span>
                  <span>{billingOrderDetail.skuDailyBonusCredits ?? 0}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>{t('积分上限', 'Max credits')}</span>
                  <span>{billingOrderDetail.skuMaxCredits ?? 0}</span>
                </div>

                {billingOrderDetail.payUrl && (
                  <button
                    type="button"
                    onClick={() => handleOpenPayLinkAndClose(billingOrderDetail.payUrl)}
                    className="mt-4 w-full h-10 rounded-xl border border-[#efaf00] text-[#efaf00] hover:bg-[#fff8e5] transition-colors flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t('打开支付链接', 'Open pay link')}
                  </button>
                )}
              </div>
            ) : (
              <Empty className="py-8" description={t('未获取到订单详情', 'No detail data')} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
