
import { useState, useCallback, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

interface Role {
  img: string
  name: string
  description: string
}

interface RoleCarouselProps {
  roles: Role[]
}

const ITEM_WIDTH_REM = 12.5
const ITEM_SPACING_REM = 5
const ROLE_COPIES = 3

export default function MRoleCarousel({ roles }: RoleCarouselProps) {
  const [virtualIndex, setVirtualIndex] = useState(roles.length)
  const [isDragging, setIsDragging] = useState(false)
  const [offset, setOffset] = useState(0)
  const startX = useRef(0)
  const startTime = useRef(0)
  const autoPlayTimer = useRef<number | null>(null)
  const isUserInteracting = useRef(false)

  const rolesCount = roles.length
  const extendedRoles = Array.from({ length: ROLE_COPIES }, () => roles).flat()

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
  const currentIndex = rolesCount > 0 ? ((virtualIndex % rolesCount) + rolesCount) % rolesCount : 0

  const updateVirtualIndex = useCallback((targetIndex: number) => {
    if (rolesCount <= 0) return

    const normalizedTarget = ((targetIndex % rolesCount) + rolesCount) % rolesCount
    setVirtualIndex((prev) => {
      const candidates = [
        normalizedTarget,
        normalizedTarget + rolesCount,
        normalizedTarget + rolesCount * 2,
      ]
      return candidates.reduce((closest, current) => {
        return Math.abs(current - prev) < Math.abs(closest - prev) ? current : closest
      }, candidates[0])
    })
  }, [rolesCount])

  const currentRole = roles[currentIndex]

  // 自动播放
  const autoPlayNext = useCallback(() => {
    if (rolesCount <= 1 || isUserInteracting.current) return

    setVirtualIndex((prev) => {
      const newIndex = prev + 1
      // 如果超出范围，重置到中间组对应位置
      if (newIndex >= extendedRoles.length) {
        return rolesCount
      }
      return newIndex
    })
  }, [extendedRoles.length, rolesCount])

  const startAutoPlay = useCallback(() => {
    if (rolesCount <= 1) return
    if (autoPlayTimer.current) {
      clearInterval(autoPlayTimer.current)
    }
    autoPlayTimer.current = window.setInterval(() => {
      autoPlayNext()
    }, 3000)
  }, [autoPlayNext, rolesCount])

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

      // 处理循环，始终保持在扩展数组范围内
      if (newVirtualIndex < 0) {
        newVirtualIndex = extendedRoles.length - 1
      } else if (newVirtualIndex >= extendedRoles.length) {
        newVirtualIndex = 0
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
  }, [isDragging, offset, virtualIndex, extendedRoles.length, totalItemWidth, startAutoPlay])

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

  const shouldHide = useCallback((index: number) => {
    const totalLength = extendedRoles.length
    const hideIndex1 = (virtualIndex + 3) % totalLength
    const hideIndex2 = (virtualIndex + 4) % totalLength
    const hideIndex3 = (virtualIndex + 5) % totalLength
    return index === hideIndex1 || index === hideIndex2 || index === hideIndex3
  }, [extendedRoles.length, virtualIndex])

  // 计算角色样式
  const getRoleStyle = (index: number) => {
    if (shouldHide(index)) {
      return {
        opacity: 0,
        visibility: 'hidden' as const,
        pointerEvents: 'none' as const,
        transform: 'translateX(0) scale(0)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      }
    }

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
    <div>
      <div
        className="relative h-[400px] w-full select-none overflow-hidden touch-pan-x cursor-grab active:cursor-grabbing"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <div className="relative flex h-full w-full items-center justify-center">
          {extendedRoles.map((role, index) => {
            const style = getRoleStyle(index)

            return (
              <div
                key={index}
                className="absolute h-[320px] w-[240px] transform-origin-center-bottom will-change-transform"
                style={style}
              >
                <img
                  src={role.img}
                  alt={`角色${(index % rolesCount) + 1}`}
                  className="pointer-events-auto h-full w-full cursor-pointer object-contain filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
                  loading="lazy"
                  onClick={() => {
                    updateVirtualIndex(index % rolesCount)
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* 角色描述信息 */}
      <div className="mt-6 flex min-h-[120px] flex-col items-center gap-2">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center gap-2"
        >
          <div className="text-[32px] font-bold text-[#464646]">
            {currentRole?.name}
          </div>
          <div className="w-55 text-center text-[24px] text-[#999999]">
            {currentRole?.description}
          </div>
        </motion.div>
      </div>

      {/* 进度指示器 */}
      <div className="mx-auto mt-6 flex h-13 w-fit items-center justify-center gap-2 rounded-full bg-[#efefef] px-9">
        {roles.map((_, index) => (
          <div
            key={index}
            className={`h-2 cursor-pointer bg-[#ccc] transition-all duration-300 ease-in-out ${
              index === currentIndex ? 'w-6 rounded-[4px] bg-[#EFAF00]!' : 'w-2 rounded-full'
            }`}
            onClick={() => updateVirtualIndex(index)}
          />
        ))}
      </div>
    </div>
  )
}
