import { useCallback, useEffect, useRef, useState } from "react";

export interface DragResizeOptions {
  direction?: "horizontal" | "vertical" | "both";
  onDragStart?: () => void;
  onDrag?: (size: { width?: number; height?: number }) => void;
  onDragEnd?: () => void;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
}

export function useDragResize(options: DragResizeOptions = {}) {
  const {
    direction = "horizontal",
    onDragStart,
    onDrag,
    onDragEnd,
    minWidth,
    maxWidth,
    minHeight,
    maxHeight,
  } = options;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [isDragging, setIsDragging] = useState(false);
  const listenersRef = useRef<{
    handleMouseMove: (e: MouseEvent) => void;
    handleMouseUp: () => void;
  } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent, targetElement: HTMLElement) => {
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const rect = targetElement.getBoundingClientRect();
    const startWidth = rect.width;
    const startHeight = rect.height;
    const { direction: dir } = optionsRef.current;

    setIsDragging(true);
    optionsRef.current.onDragStart?.();

    const handleMouseMove = (ev: MouseEvent) => {
      const deltaX = ev.clientX - startX;
      const deltaY = ev.clientY - startY;
      const newSize: { width?: number; height?: number } = {};

      if (dir === "horizontal" || dir === "both") {
        let width = startWidth + deltaX;
        if (minWidth !== undefined) {
          width = Math.max(minWidth, width);
        }
        if (maxWidth !== undefined) {
          width = Math.min(maxWidth, width);
        }
        newSize.width = width;
      }

      if (dir === "vertical" || dir === "both") {
        let height = startHeight + deltaY;
        if (minHeight !== undefined) {
          height = Math.max(minHeight, height);
        }
        if (maxHeight !== undefined) {
          height = Math.min(maxHeight, height);
        }
        newSize.height = height;
      }

      optionsRef.current.onDrag?.(newSize);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      optionsRef.current.onDragEnd?.();
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      listenersRef.current = null;
    };

    listenersRef.current = { handleMouseMove, handleMouseUp };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = dir === "horizontal" ? "col-resize" : "row-resize";
  }, [minWidth, maxWidth, minHeight, maxHeight]);

  useEffect(() => {
    return () => {
      const listeners = listenersRef.current;
      if (listeners) {
        document.removeEventListener("mousemove", listeners.handleMouseMove);
        document.removeEventListener("mouseup", listeners.handleMouseUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      }
    };
  }, []);

  return {
    isDragging,
    handleMouseDown,
  };
}
