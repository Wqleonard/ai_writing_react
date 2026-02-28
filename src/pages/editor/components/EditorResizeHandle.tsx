"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import clsx from "clsx"

export type ResizePosition = "left" | "right"

interface EditorResizeHandleProps {
  position: ResizePosition
  onDrag: (deltaX: number) => void
  onDragStart?: () => void
  onDragEnd?: () => void
  className?: string
}

export const EditorResizeHandle = ({
  position,
  onDrag,
  onDragStart,
  onDragEnd,
  className,
}: EditorResizeHandleProps) => {
  const [isDragging, setIsDragging] = useState(false)
  const startXRef = useRef(0)

  const onDragRef = useRef(onDrag)
  const onDragEndRef = useRef(onDragEnd)
  onDragRef.current = onDrag
  onDragEndRef.current = onDragEnd

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const deltaX = e.clientX - startXRef.current
    const adjusted = position === "right" ? -deltaX : deltaX
    onDragRef.current(adjusted)
  }, [position])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    onDragEndRef.current?.()
    document.body.style.userSelect = ""
    document.body.style.cursor = ""
    document.removeEventListener("mousemove", handleMouseMove)
    document.removeEventListener("mouseup", handleMouseUp)
  }, [handleMouseMove])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      startXRef.current = e.clientX
      setIsDragging(true)
      onDragStart?.()
      document.body.style.userSelect = "none"
      document.body.style.cursor = "col-resize"
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    },
    [onDragStart, handleMouseMove, handleMouseUp]
  )

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      className={clsx(
        "shrink-0 w-[10px] cursor-col-resize flex items-center justify-center h-full relative",
        isDragging && "select-none",
        className
      )}
      onMouseDown={handleMouseDown}
    >
      <div
        className={clsx(
          "w-[3px] h-full bg-[var(--theme-color)] transition-opacity",
          (isDragging ? "opacity-100" : "opacity-0 hover:opacity-100")
        )}
      />
    </div>
  )
}
