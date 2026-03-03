
import { useState, useCallback, useEffect, useRef } from 'react'

interface Role {
  img: string
  name: string
  description: string
}

interface RoleCarouselProps {
  roles: Role[]
  onRoleChange?: (index: number) => void
}

const ITEM_WIDTH_REM = 12.5
const ITEM_SPACING_REM = 5
const VISIBLE_ITEMS = 3 // 中间 + 两侧

export default function MRoleCarousel({ roles, onRoleChange }: RoleCarouselProps) {
  const [virtualIndex, setVirtualIndex] = useState(1) // 从第二个位置开始
  const [isDragging, setIsDragging] = useState(false)
  const [offset, setOffset] = useState(0)
  const startX = useRef(0)
  const startTime = useRef(0)
  const autoPlayTimer = useRef<number | null>(null)
  const isUserInteracting = useRef(false)

  const rolesCount = roles.length
  const extendedRoles = [...roles, ...roles]

  // 获取 rem 基准值
  const getRemBase = useCallback(() => {
    const fontSize = getComputedStyle(document.documentElement).fontSize
    return parseFloat(fontSize) || 16
  }, [])

  const remToPx = useCallback((rem: number) => {
    return rem * getRemBase()
  }, [getRemBase])

  const itemWidthPx = remToPx(ITEM_WIDTH_REM)
  const itemSpacingPx = remToPx(ITEM_SPACING_REM)
  const totalItemWidth = itemWidthPx + itemSpacingPx

  // 当前实际索引（循环后）
  const currentIndex = virtualIndex % rolesCount

  // 通知父组件索引变化
  useEffect(() => {
    onRoleChange?.(currentIndex)
  }, [currentIndex, onRoleChange])

  // 自动播放
  const autoPlayNext = useCallback(() => {
    if (isUserInteracting.current) return

    setVirtualIndex((prev) => {
      const newIndex = prev + 1
      // 如果超出范围，重置到对应位置
      if (newIndex >= rolesCount * 2) {
        return newIndex - rolesCount
      }
      return newIndex
    })
  }, [rolesCount])

  const startAutoPlay = useCallback(() => {
    if (autoPlayTimer.current) {
      clearInterval(autoPlayTimer.current)
    }
    autoPlayTimer.current = window.setInterval(() => {
      autoPlayNext()
    }, 3000)
  }, [autoPlayNext])

  const pauseAutoPlay = useCallback(() => {
    if (autoPlayTimer.current) {
      clearInterval(autoPlayTimer.current)
      autoPlayTimer.current = null
    }
  }, [])

  useEffect(() => {
    startAutoPlay()
    return () => pauseAutoPlay()
  }, [startAutoPlay, pauseAutoPlay])

  // 触摸/鼠标事件处理
  const handleStart = useCallback((clientX: number) => {
    isUserInteracting.current = true
    pauseAutoPlay()
    startX.current = clientX
    startTime.current = Date.now()
    setIsDragging(true)
  }, [pauseAutoPlay])

  const handleMove = useCallback((clientX: number) => {
    if (!isDragging) return
    setOffset(clientX - startX.current)
  }, [isDragging])

  const handleEnd = useCallback(() => {
    if (!isDragging) return

    const threshold = totalItemWidth * 0.3
    const moveDistance = Math.abs(offset)

    // 如果移动距离很小，认为是点击
    if (moveDistance < 10 && Date.now() - startTime.current < 300) {
      setOffset(0)
      setIsDragging(false)
      return
    }

    if (moveDistance > threshold) {
      let newVirtualIndex = virtualIndex

      if (offset > 0) {
        // 向右拖动，显示上一个
        newVirtualIndex--
      } else {
        // 向左拖动，显示下一个
        newVirtualIndex++
      }

      // 处理循环
      if (newVirtualIndex < 0) {
        newVirtualIndex = newVirtualIndex + rolesCount * 2
      } else if (newVirtualIndex >= rolesCount * 2) {
        newVirtualIndex = newVirtualIndex - rolesCount * 2
      }

      setVirtualIndex(newVirtualIndex)
    }

    setOffset(0)
    setIsDragging(false)

    // 延迟恢复自动播放
    setTimeout(() => {
      isUserInteracting.current = false
      startAutoPlay()
    }, 2000)
  }, [offset, virtualIndex, rolesCount, totalItemWidth])

  // 触摸事件
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX)
  }, [handleStart])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX)
  }, [handleMove])

  const handleTouchEnd = useCallback(() => {
    handleEnd()
  }, [handleEnd])

  // 鼠标事件
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    handleStart(e.clientX)
  }, [handleStart])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    handleMove(e.clientX)
  }, [handleMove])

  const handleMouseUp = useCallback(() => {
    handleEnd()
  }, [handleEnd])

  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      handleEnd()
    }
  }, [isDragging, handleEnd])

  // 计算角色样式
  const getRoleStyle = (index: number) => {
    let diff = index - virtualIndex

    // 处理循环距离
    const totalLength = extendedRoles.length
    const directDist = Math.abs(diff)
    let wrapDist: number

    if (diff > 0) {
      wrapDist = totalLength - diff
    } else {
      wrapDist = totalLength + diff
    }

    if (wrapDist < directDist || directDist > rolesCount) {
      diff = diff > 0 ? diff - totalLength : diff + totalLength
    }

    const absDiff = Math.abs(diff)

    // 计算缩放：中间最大 (1.0)，两侧小 (0.7)
    let scale = 0.5
    if (absDiff === 0) {
      scale = 1.0 - Math.abs(offset) / totalItemWidth * 0.3
    } else if (absDiff === 1) {
      scale = 0.7 + Math.abs(offset) / totalItemWidth * 0.3
    }

    // 计算透明度
    let opacity = 0.3
    if (absDiff === 0) {
      opacity = 1.0 - Math.abs(offset) / totalItemWidth * 0.3
    } else if (absDiff === 1) {
      opacity = 0.6 + Math.abs(offset) / totalItemWidth * 0.3
    }

    // z-index
    const zIndex = absDiff === 0 ? 10 : 5 - absDiff

    // 计算位置偏移
    const baseOffset = diff * totalItemWidth
    const dragOffset = offset
    const translateX = baseOffset + dragOffset

    return {
      transform: `translateX(${translateX}px) scale(${scale})`,
      opacity,
      zIndex,
      transition: isDragging ? 'none' : 'transform 0.3s ease, opacity 0.3s ease',
    }
  }

  return (
    <div
      className="relative w-full h-[400px] overflow-hidden select-none touch-pan-x cursor-grab active:cursor-grabbing"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative w-full h-full flex items-center justify-center">
        {extendedRoles.map((role, index) => {
          const style = getRoleStyle(index)
          // 只显示中间和两侧的角色
          const absDiff = Math.abs(index - virtualIndex)
          const shouldShow = absDiff <= 1 || Math.abs(index - virtualIndex) >= rolesCount - 1

          if (!shouldShow && index !== virtualIndex) {
            return null
          }

          return (
            <div
              key={index}
              className="absolute w-[240px] h-[320px] transform-origin-center-bottom will-change-transform"
              style={style}
            >
              <img
                src={role.img}
                alt={`角色${(index % rolesCount) + 1}`}
                className="w-full h-full object-contain filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.15)] pointer-events-auto cursor-pointer"
                loading="lazy"
                onClick={() => {
                  // 点击切换到对应角色
                  const targetIndex = index % rolesCount
                  const dist1 = Math.abs(targetIndex - currentIndex)
                  const dist2 = rolesCount - dist1

                  if (dist1 <= dist2) {
                    setVirtualIndex(virtualIndex + (targetIndex - currentIndex))
                  } else {
                    setVirtualIndex(virtualIndex + (targetIndex - currentIndex > 0 ? -dist2 : dist2))
                  }
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
