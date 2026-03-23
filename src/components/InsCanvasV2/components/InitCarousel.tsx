import React, { useEffect, useMemo, useRef, useState } from "react";
import canvasCarouselImg from "@/assets/images/canvas_carousel.png";

export interface InitCarouselImage {
  src: string;
  alt?: string;
  /** 文章类型（用于 hover 标签与点击回填） */
  typeLabel?: string;
  theme?: string;
}

export interface InitCarouselProps {
  /** 是否自动滚动（外部用 isLoading 传入即可） */
  isAnimate?: boolean;
  /** 轮播图片列表 */
  images?: InitCarouselImage[];
  /** 自动滚动间隔 */
  intervalMs?: number;
  /** 根容器 className */
  className?: string;
  /** 图片间距 */
  gapPx?: number;
  /** 单张图片宽度 */
  slideWidth?: number;
  /** 单张图片高度 */
  slideHeight?: number;
  /** 点击/当前项放大倍率 */
  zoomScale?: number;
  /** 左右蒙层宽度 */
  sideFadePx?: number;
  /** 点击卡片时回填输入框文本（由组件内部生成文案），并告知触发源 */
  onPickType?: (payload: { source: "img" | "label"; text: string }) => void;
}

const DEFAULT_IMAGES: InitCarouselImage[] = [
  { src: canvasCarouselImg, alt: "情感", typeLabel: "情感", theme: '中元节1' },
  { src: canvasCarouselImg, alt: "科普", typeLabel: "科普", theme: '中元节2' },
  { src: canvasCarouselImg, alt: "攻略", typeLabel: "攻略", theme: '中元节3' },
  { src: canvasCarouselImg, alt: "测评", typeLabel: "测评", theme: '中元节4' },
  { src: canvasCarouselImg, alt: "故事", typeLabel: "故事", theme: '中元节5' },
  { src: canvasCarouselImg, alt: "观点", typeLabel: "观点", theme: '中元节6' },
];

export default function InitCarousel({
  isAnimate = false,
  images,
  intervalMs = 2600,
  className = "",
  gapPx = 16,
  slideWidth = 176,
  slideHeight = 120,
  zoomScale = 1.12,
  sideFadePx = 64,
  onPickType,
}: InitCarouselProps) {
  const slides = useMemo(() => {
    const normalized = (images ?? []).filter((x) => Boolean(x?.src));
    return normalized.length ? normalized : DEFAULT_IMAGES;
  }, [images]);

  const loopedSlides = useMemo(() => {
    if (slides.length <= 1) return slides;
    return [...slides, ...slides, ...slides];
  }, [slides]);

  const stridePx = useMemo(() => {
    const total = slides.length;
    if (total <= 0) return 0;
    // 这里用 total * (slideWidth + gapPx) 作为“一个循环段”的长度（包含段与段之间的 gap）
    return total * (slideWidth + gapPx);
  }, [gapPx, slideWidth, slides.length]);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const pauseUntilRef = useRef(0);
  const hoverPausedRef = useRef(false);
  const directionRef = useRef<1 | -1>(1);
  const speedMultiplierRef = useRef(1);
  const boostTimeoutRef = useRef<number | null>(null);
  const [canScroll, setCanScroll] = useState(false);

  const updateCanScroll = () => {
    const el = viewportRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScroll(maxScroll > 2);
  };

  useEffect(() => {
    updateCanScroll();
  }, [slides.length, slideWidth, gapPx, className]);

  useEffect(() => {
    if (!viewportRef.current) return;
    const el = viewportRef.current;
    const ro = new ResizeObserver(() => updateCanScroll());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 无限滚动：从中间段开始，避免一开始就碰到边界
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    if (slides.length <= 1) return;
    if (stridePx <= 0) return;
    // next frame，确保 DOM 尺寸就绪
    requestAnimationFrame(() => {
      const v = viewportRef.current;
      if (!v) return;
      v.scrollLeft = stridePx;
    });
  }, [gapPx, slideWidth, slides.length, stridePx]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    if (!isAnimate || !canScroll) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
      return;
    }

    // 用 intervalMs 近似成“每 intervalMs 滑过一张卡片”的速度
    const baseSpeedPxPerSec = Math.max(
      10,
      Math.min(90, (slideWidth + gapPx) / Math.max(0.6, intervalMs / 1000))
    );
    const tick = (ts: number) => {
      rafRef.current = requestAnimationFrame(tick);
      if (!viewportRef.current) return;
      if (hoverPausedRef.current || Date.now() < pauseUntilRef.current) {
        lastTsRef.current = ts;
        return;
      }
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = Math.min(48, ts - lastTsRef.current);
      lastTsRef.current = ts;

      const v = viewportRef.current;
      const maxScroll = Math.max(0, v.scrollWidth - v.clientWidth);
      if (maxScroll <= 1) return;

      // 无限滚动：保持在 [stride, 2*stride) 区间内
      if (stridePx > 0 && slides.length > 1) {
        if (v.scrollLeft >= stridePx * 2) v.scrollLeft -= stridePx;
        if (v.scrollLeft <= 0) v.scrollLeft += stridePx;
      }

      const delta = directionRef.current * baseSpeedPxPerSec * speedMultiplierRef.current * (dt / 1000);
      v.scrollLeft = Math.max(0, Math.min(maxScroll, v.scrollLeft + delta));

      // 再做一次 wrap，避免单帧 delta 跨过阈值造成闪跳
      if (stridePx > 0 && slides.length > 1) {
        if (v.scrollLeft >= stridePx * 2) v.scrollLeft -= stridePx;
        if (v.scrollLeft <= 0) v.scrollLeft += stridePx;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
    };
  }, [canScroll, gapPx, intervalMs, isAnimate, slideWidth, slides.length, stridePx]);

  const setBoost = (dir: 1 | -1, multiplier: number, ms: number) => {
    directionRef.current = dir;
    speedMultiplierRef.current = multiplier;
    if (boostTimeoutRef.current) window.clearTimeout(boostTimeoutRef.current);
    boostTimeoutRef.current = window.setTimeout(() => {
      speedMultiplierRef.current = 1;
      directionRef.current = 1;
      boostTimeoutRef.current = null;
    }, ms);
  };

  const handleBoostStart = (dir: 1 | -1) => {
    directionRef.current = dir;
    speedMultiplierRef.current = 4;
  };

  const handleBoostEnd = () => {
    speedMultiplierRef.current = 1;
    directionRef.current = 1;
  };

  return (
    <div className={`relative mx-auto h-[300px] w-full max-w-[720px] ${className}`}>
      <div className="absolute left-1/2 top-[70px] w-full -translate-x-1/2 px-2">
        <div className="relative w-full rounded-[18px]">
          {/* 左右透明度蒙层 */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-20"
            style={{
              width: sideFadePx,
              background: "linear-gradient(90deg, rgba(241,241,241,1) 0%, rgba(241,241,241,0) 100%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-20"
            style={{
              width: sideFadePx,
              background: "linear-gradient(270deg, rgba(241,241,241,1) 0%, rgba(241,241,241,0) 100%)",
            }}
          />

          {/* 左右加速按钮 */}
          {canScroll && (
            <>
              <button
                type="button"
                className="absolute left-2 top-1/2 z-30 -translate-y-1/2 rounded-full border border-[#e5e7eb] bg-white/80 p-2 text-[#111] shadow-sm backdrop-blur transition hover:bg-white"
                aria-label="向左加速滚动"
                onPointerDown={() => handleBoostStart(1)}
                onPointerUp={handleBoostEnd}
                onPointerLeave={handleBoostEnd}
                onPointerCancel={handleBoostEnd}
                onClick={() => {
                  const el = viewportRef.current;
                  if (el) el.scrollBy({ left: Math.max(120, slideWidth), behavior: "smooth" });
                  setBoost(1, 4, 900);
                }}
              >
                <span className="select-none text-[14px] leading-none">‹</span>
              </button>
              <button
                type="button"
                className="absolute right-2 top-1/2 z-30 -translate-y-1/2 rounded-full border border-[#e5e7eb] bg-white/80 p-2 text-[#111] shadow-sm backdrop-blur transition hover:bg-white"
                aria-label="向右加速滚动"
                onPointerDown={() => handleBoostStart(-1)}
                onPointerUp={handleBoostEnd}
                onPointerLeave={handleBoostEnd}
                onPointerCancel={handleBoostEnd}
                onClick={() => {
                  const el = viewportRef.current;
                  if (el) el.scrollBy({ left: -Math.max(120, slideWidth), behavior: "smooth" });
                  setBoost(-1, 4, 900);
                }}
              >
                <span className="select-none text-[14px] leading-none">›</span>
              </button>
            </>
          )}

          {/* 单方向无限滚动 */}
          <div
            ref={viewportRef}
            className="relative overflow-x-hidden overflow-y-visible rounded-[18px]"
          >
            <div
              className="relative flex items-center py-6"
              style={{
                gap: gapPx,
                paddingLeft: sideFadePx,
                paddingRight: sideFadePx,
              }}
            >
              {loopedSlides.map((img, i) => {
                const label = img.typeLabel ?? img.alt ?? "";
                const theme = img.theme ?? label;
                return (
                  <button
                    key={`${img.src}-${label}-${i}`}
                    type="button"
                    className="group relative shrink-0 rounded-[14px] bg-white transition-transform duration-200 ease-out hover:z-10 hover:shadow-[0px_12px_26px_0px_rgba(0,0,0,0.18)]"
                    style={{
                      width: slideWidth,
                      height: slideHeight,
                      transform: "translateZ(0)",
                    }}
                    onPointerEnter={() => {
                      hoverPausedRef.current = true;
                    }}
                    onPointerLeave={() => {
                      hoverPausedRef.current = false;
                    }}
                    onFocus={() => {
                      hoverPausedRef.current = true;
                    }}
                    onBlur={() => {
                      hoverPausedRef.current = false;
                    }}
                    onClick={() => {
                      pauseUntilRef.current = Date.now() + 1500;
                      if (theme && onPickType)
                        onPickType({ source: "img", text: `请给我生成一些${theme}的选题。` });
                    }}
                  >
                    <div
                      className="h-full w-full overflow-hidden rounded-[14px] transition-transform duration-200 ease-out group-hover:[transform:scale(var(--zoom-scale))]"
                      style={{ transformOrigin: "center", ["--zoom-scale" as any]: zoomScale }}
                    >
                      <img
                        src={img.src}
                        alt={img.alt ?? ""}
                        className="h-full w-full object-cover"
                        draggable={false}
                        loading="lazy"
                      />
                    </div>

                    {!!label && (
                      <div className="absolute left-2 top-2 z-10 opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100">
                        <button
                          type="button"
                          className="rounded-full cursor-pointer bg-[#111]/80 px-2 py-1 text-[11px] leading-none text-white shadow-sm backdrop-blur hover:bg-[#111]/90"
                          onPointerEnter={() => {
                            hoverPausedRef.current = true;
                          }}
                          onPointerLeave={() => {
                            hoverPausedRef.current = false;
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            pauseUntilRef.current = Date.now() + 1500;
                            if (onPickType)
                              onPickType({ source: "label", text: `我想写一个【${label}类型文】` });
                          }}
                        >
                          {label}类型文
                        </button>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
