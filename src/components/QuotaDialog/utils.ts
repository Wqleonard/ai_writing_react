import type { Order, OrderTypeFilter } from '@/api/order'
import { ORDER_CODE_VALUE } from '@/utils/constant'

type OrderWithSession = Order & { sessionId?: string | null }

const getSessionId = (order: Order): string => {
  const raw = (order as OrderWithSession).sessionId
  if (typeof raw !== 'string') return ''
  return raw.trim()
}

const getFunctionKey = (order: Order): string => {
  const fn = typeof order.function === 'string' ? order.function.trim() : ''
  return fn || '__NO_FUNCTION__'
}

const toTimestamp = (time: string): number => {
  const ts = Date.parse(time)
  return Number.isFinite(ts) ? ts : -Infinity
}

const getSignedCost = (order: Order): number => {
  const raw = Math.abs(Number(order.totalCost ?? 0))
  if (order.orderType === 'DECREASE') return -raw
  if (order.orderType === 'INCREASE') return raw
  return Number(order.totalCost ?? 0)
}

export const filterToOrderType = (id: string): OrderTypeFilter => {
  if (id === '1') return 'INCREASE'
  if (id === '2') return 'DECREASE'
  return 'ALL'
}

export const aggregateOrdersBySession = (orders: Order[]): Order[] => {
  const aggregated: Order[] = []
  const groupedIndexMap = new Map<string, number>()

  for (const order of orders) {
    const sessionId = getSessionId(order)
    if (!sessionId) {
      aggregated.push(order)
      continue
    }

    // 同一 sessionId 下按 function 分类聚合，避免不同功能的消费被错误合并
    const groupKey = `${sessionId}::${getFunctionKey(order)}`
    const existingIndex = groupedIndexMap.get(groupKey)
    if (existingIndex == null) {
      aggregated.push(order)
      groupedIndexMap.set(groupKey, aggregated.length - 1)
      continue
    }

    const existing = aggregated[existingIndex]
    const mergedSignedCost = getSignedCost(existing) + getSignedCost(order)
    const latest = toTimestamp(order.createdTime) > toTimestamp(existing.createdTime) ? order : existing

    aggregated[existingIndex] = {
      ...latest,
      totalCost: Math.abs(mergedSignedCost),
      orderType:
        mergedSignedCost > 0
          ? 'INCREASE'
          : mergedSignedCost < 0
            ? 'DECREASE'
            : latest.orderType,
    }
  }

  return aggregated
}

export const getDetailText = (order: Order): string => {
  if (order.function && ORDER_CODE_VALUE[order.function]) return ORDER_CODE_VALUE[order.function]
  return order.function || order.orderType || '—'
}

export const formatPoints = (order: Order): string => {
  return parseFloat(Number(order.totalCost) / 1000 + '').toFixed(2)
}

export const getPointsClass = (order: Order): string => {
  const val = Math.abs(order.totalCost ?? 0)
  if (val === 0) return ''
  if (order.orderType === 'DECREASE') return 'text-[#f56c6c]'
  return 'text-[#67c23a]'
}
