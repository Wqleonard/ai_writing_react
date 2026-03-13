"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type WheelEvent,
} from "react";
import { getUserBalanceReq } from "@/api/users";
import { addNote } from "@/api/notes";
import type { NoteSourceType } from "@/api/notes";
import {
  getInspirationCardsImageReq,
  getInspirationCardsReq,
} from "@/api/m-inspiration";
import { mtoast } from "@/components/ui/toast";
import { Button } from "@/components/ui/Button";
import { Iconfont } from "@/components/Iconfont";
import { cn } from "@/lib/utils";

import DEFAULT_CARD_IMAGE from "@/assets/images/m_ins/card_cover.png";
import CAT_HAND from '@/assets/images/m_ins/cat_hand.png';
import "./card.less";

const COST_PER_REROLL = 10;
const SWIPE_THRESHOLD = 28;
const CARD_WIDTH_PX = 380;
// 左右卡片与中间卡片的水平间距（rem）：值越小越紧密
const CAROUSEL_RADIUS_X_REM = 14.8;
// 卡片椭圆轨迹的纵向弧度（rem）
const CAROUSEL_RADIUS_Y_REM = 5.375;
// 左右卡片额外上提量（rem）：值越大，左右卡片越往上
const CAROUSEL_SIDE_LIFT_Y_REM = 3;
// 左右卡片前后景深（rem）
const CAROUSEL_SIDE_Z_LIFT_REM = 1.125;
const CAROUSEL_STEP = 1;
const WHEEL_STEP_COOLDOWN_MS = 120;
const DRAG_PREVIEW_DIVISOR = 150;
const DRAG_PREVIEW_LIMIT = 0.95;
const DRAG_AXIS_LOCK_THRESHOLD = 8;
const SWIPE_VELOCITY_THRESHOLD = 0.45;

type Status = "idle" | "loading" | "ready" | "rerolling";

interface InspirationIdea {
  title: string;
  summary: string;
  tag: string;
  image: string;
}

interface InspirationCardProps {
  data: InspirationIdea;
  style: CSSProperties;
  side3dClassName?: string;
  isActive: boolean;
  onClick: (data: InspirationIdea) => void;
}

import TEST1 from "@/assets/images/m_ins/test1.jpg";
import TEST2 from "@/assets/images/m_ins/test2.jpg";
import TEST3 from "@/assets/images/m_ins/test3.jpg";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { LinkButton } from "@/components/ui/LinkButton";

const EMPTY_CARD_DATA = {
  title: "",
  summary: "",
  tag: "",
  image: "",
};

const INSPIRATION_CARDS: InspirationIdea[] = [
  {
    title: "玻璃海公约",
    summary: "海底城市重启投票前夜，档案员发现被抹去的第零条。",
    tag: "#科幻",
    image: TEST1,
  },
  {
    title: "雾屿邮差",
    summary: "守岛邮差在无名信件里，解锁雾屿沉睡的秘密。",
    tag: "#悬疑",
    image: TEST2,
  },
  {
    title: "雨夜备忘录",
    summary: "旧手机凌晨自动发来未来短信，主角被迫提前破局。",
    tag: "#都市脑洞",
    image: TEST3,
  },
];

const createEmptyCards = () => [
  EMPTY_CARD_DATA,
  EMPTY_CARD_DATA,
  EMPTY_CARD_DATA,
];

const InspirationCard = ({
  data,
  style,
  side3dClassName,
  isActive,
  onClick,
}: InspirationCardProps) => {
  const hasData = Boolean(data.title);

  return (
    <div
      className={cn(
        "inspiration-card absolute left-1/2 top-1/2 w-95 h-150 p-3 rounded-xl bg-white shrink-0 snap-center transition-[transform,opacity,filter] duration-300",
        hasData && "cursor-pointer",
        side3dClassName,
      )}
      style={style}
      role="button"
      tabIndex={0}
      aria-label="抽取灵感卡"
      onClick={() => {
        if (!hasData) return;
        onClick(data);
      }}
      onKeyDown={(event) => {
        if (!hasData) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick(data);
        }
      }}
    >
      <img
        src={!data.image ? DEFAULT_CARD_IMAGE : data.image}
        alt=""
        className="w-full h-full object-cover rounded-lg"
      />
      {data.title && (
        <div className="absolute bottom-0 left-0 right-0 p-5 pb-6 text-white">
          <div className="text-[40px] font-bold">{data.title}</div>
          <div className="mt-5 line-clamp-2 text-2xl">{data.summary}</div>
        </div>
      )}
    </div>
  );
};

const MInspirationPage = () => {
  const [status, setStatus] = useState<Status>("idle");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageReady, setImageReady] = useState(false);
  const [balance, setBalance] = useState(500);
  const [ideaInput, setIdeaInput] = useState("");

  const [openInsDetail, setOpenInsDetail] = useState(false);
  const [insDetailData, setInsDetailData] = useState<InspirationIdea | null>(
    null,
  );
  const [hasGenerated, setHasGenerated] = useState(false);

  const loadingTimer = useRef<number | null>(null);
  const imageTimer = useRef<number | null>(null);
  const pawTimer = useRef<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [showPaw, setShowPaw] = useState(false);
  const [pawHit, setPawHit] = useState(false);
  const [buttonHit, setButtonHit] = useState(false);
  const [lastInspirationWord, setLastInspirationWord] = useState("");

  const [InspirationCardData, setInspirationCardData] =
    useState<InspirationIdea[]>(createEmptyCards);
  const [carouselOffset, setCarouselOffset] = useState(1);
  const [dragPreviewOffset, setDragPreviewOffset] = useState(0);

  const headline = useMemo(() => {
    if (status === "loading") return "加载中...";
    if (status === "rerolling") return "不满意？拍一下！";
    if (status === "ready") return "灵感池已就绪";
    return "没有灵感？抽张卡试试！";
  }, [status]);

  const clearTimers = useCallback(() => {
    if (loadingTimer.current) window.clearTimeout(loadingTimer.current);
    if (imageTimer.current) window.clearTimeout(imageTimer.current);
    if (pawTimer.current) window.clearTimeout(pawTimer.current);
  }, []);

  const wheelTickRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const pointerStartXRef = useRef<number>(0);
  const pointerStartYRef = useRef<number>(0);
  const pointerStartAtRef = useRef<number>(0);
  const pointerAxisRef = useRef<"undecided" | "x" | "y">("undecided");
  const suppressCardClickRef = useRef(false);
  const snapTimerRef = useRef<number | null>(null);

  const normalizeCarouselOffset = useCallback(
    (value: number) => {
      const total = InspirationCardData.length;
      if (total <= 0) return 0;
      return ((value % total) + total) % total;
    },
    [InspirationCardData.length],
  );

  const rotateCarousel = useCallback(
    (delta: number) => {
      setCarouselOffset((prev) => normalizeCarouselOffset(prev + delta));
    },
    [normalizeCarouselOffset],
  );

  const clearSnapTimer = useCallback(() => {
    if (snapTimerRef.current) {
      window.clearTimeout(snapTimerRef.current);
      snapTimerRef.current = null;
    }
  }, []);

  const snapCarouselToNearest = useCallback(() => {
    setCarouselOffset((prev) => normalizeCarouselOffset(Math.round(prev)));
  }, [normalizeCarouselOffset]);

  const scheduleCarouselSnap = useCallback(() => {
    clearSnapTimer();
    snapTimerRef.current = window.setTimeout(() => {
      snapTimerRef.current = null;
      snapCarouselToNearest();
    }, 120);
  }, [clearSnapTimer, snapCarouselToNearest]);

  const handleCarouselWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      const dominantDelta =
        Math.abs(event.deltaY) > Math.abs(event.deltaX)
          ? event.deltaY
          : event.deltaX;
      if (Math.abs(dominantDelta) < 6) return;
      const now = performance.now();
      if (now - wheelTickRef.current < WHEEL_STEP_COOLDOWN_MS) return;
      wheelTickRef.current = now;
      rotateCarousel(dominantDelta > 0 ? CAROUSEL_STEP : -CAROUSEL_STEP);
      scheduleCarouselSnap();
    },
    [rotateCarousel, scheduleCarouselSnap],
  );

  const handleCarouselPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      clearSnapTimer();
      if (event.currentTarget.hasPointerCapture(event.pointerId) === false) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      pointerIdRef.current = event.pointerId;
      pointerStartXRef.current = event.clientX;
      pointerStartYRef.current = event.clientY;
      pointerStartAtRef.current = performance.now();
      pointerAxisRef.current = "undecided";
      suppressCardClickRef.current = false;
      setDragPreviewOffset(0);
    },
    [clearSnapTimer],
  );

  const handleCarouselPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (pointerIdRef.current !== event.pointerId) return;

      const deltaX = event.clientX - pointerStartXRef.current;
      const deltaY = event.clientY - pointerStartYRef.current;

      if (pointerAxisRef.current === "undecided") {
        if (
          Math.abs(deltaX) < DRAG_AXIS_LOCK_THRESHOLD &&
          Math.abs(deltaY) < DRAG_AXIS_LOCK_THRESHOLD
        ) {
          return;
        }
        pointerAxisRef.current = Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y";
      }

      if (pointerAxisRef.current !== "x") return;

      event.preventDefault();
      suppressCardClickRef.current = true;
      const rawOffset = -deltaX / DRAG_PREVIEW_DIVISOR;
      const clampedOffset = Math.max(
        -DRAG_PREVIEW_LIMIT,
        Math.min(DRAG_PREVIEW_LIMIT, rawOffset),
      );
      setDragPreviewOffset(clampedOffset);
    },
    [],
  );

  const finishPointerGesture = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (pointerIdRef.current !== event.pointerId) return;

      const deltaX = event.clientX - pointerStartXRef.current;
      const elapsedMs = Math.max(1, performance.now() - pointerStartAtRef.current);
      const velocityX = deltaX / elapsedMs;
      const shouldSlide =
        pointerAxisRef.current === "x" &&
        (Math.abs(deltaX) >= SWIPE_THRESHOLD ||
          Math.abs(velocityX) >= SWIPE_VELOCITY_THRESHOLD);

      if (shouldSlide) {
        rotateCarousel(deltaX < 0 ? CAROUSEL_STEP : -CAROUSEL_STEP);
      }

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      pointerIdRef.current = null;
      pointerAxisRef.current = "undecided";
      setDragPreviewOffset(0);
      scheduleCarouselSnap();
    },
    [rotateCarousel, scheduleCarouselSnap],
  );

  const handleCarouselPointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      finishPointerGesture(event);
    },
    [finishPointerGesture],
  );

  const handleCarouselPointerCancel = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      finishPointerGesture(event);
    },
    [finishPointerGesture],
  );

  useEffect(() => {
    return clearSnapTimer;
  }, [clearSnapTimer]);

  const cardTransforms = useMemo(() => {
    const total = InspirationCardData.length;
    if (!total) return [];

    const angleStep = (Math.PI * 2) / total;
    return InspirationCardData.map((_, index) => {
      const angle = (index - (carouselOffset + dragPreviewOffset)) * angleStep;
      const sin = Math.sin(angle);
      const depth = (Math.cos(angle) + 1) / 2;
      const sideStrength = Math.min(1, Math.abs(sin));
      const x = sin * CAROUSEL_RADIUS_X_REM;
      const y = (1 - depth) * CAROUSEL_RADIUS_Y_REM - sideStrength * CAROUSEL_SIDE_LIFT_Y_REM;
      const scale = 0.76 + depth * 0.24;
      const rotateY = -sin * 58;
      const zLift = sideStrength * CAROUSEL_SIDE_Z_LIFT_REM;
      const side3dClassName =
        sin < -0.06
          ? "inspiration-card--first3d"
          : sin > 0.06
            ? "inspiration-card--third3d"
            : "";

      return {
        depth,
        side3dClassName,
        style: {
          transform: `translate3d(calc(-50% + ${x.toFixed(4)}rem), calc(-50% + ${y.toFixed(4)}rem), 0px) rotateY(${rotateY.toFixed(2)}deg) translateZ(${zLift.toFixed(4)}rem) scale(${scale.toFixed(3)})`,
          opacity: Number((0.52 + depth * 0.48).toFixed(3)),
          zIndex: 100 + Math.round(depth * 900),
          filter: `saturate(${(0.84 + depth * 0.26).toFixed(3)})`,
        } satisfies CSSProperties,
      };
    });
  }, [InspirationCardData, carouselOffset, dragPreviewOffset]);

  const activeCardIndex = useMemo(() => {
    const total = InspirationCardData.length;
    if (!total) return 0;

    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < total; index += 1) {
      const diff = Math.abs(index - carouselOffset);
      const distance = Math.min(diff, total - diff);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    return bestIndex;
  }, [InspirationCardData.length, carouselOffset]);

  useEffect(() => {
    if (!InspirationCardData.length) {
      setCarouselOffset(0);
      return;
    }
    setCarouselOffset(Math.floor(InspirationCardData.length / 2));
  }, [InspirationCardData.length]);

  // useEffect(() => {
  //   (async () => {
  //     try {
  //       const req: any = await getUserBalanceReq();
  //       const points = Number(req?.token ?? req?.dailyFreeToken ?? 0);
  //       if (Number.isFinite(points) && points > 0) {
  //         setBalance(Math.floor(points / 1000));
  //       }
  //     } catch (error) {
  //       console.error("获取灵感余额失败:", error);
  //     }
  //   })();
  //   return clearTimers;
  // }, [clearTimers]);

  const pickNextIndex = useCallback((base: number) => {
    if (INSPIRATION_CARDS.length <= 1) return 0;
    let next = base;
    while (next === base) {
      next = Math.floor(Math.random() * INSPIRATION_CARDS.length);
    }
    return next;
  }, []);

  const revealCard = useCallback((nextIndex: number) => {
    setCurrentIndex(nextIndex);
    setImageReady(false);
    imageTimer.current = window.setTimeout(() => {
      setImageReady(true);
    }, 420);
    setStatus("ready");
  }, []);

  const fetchInspirationCards = useCallback(async (seed: string) => {
    try {
      const req: any = await getInspirationCardsReq(seed);
      const inspirations = Array.isArray(req?.inspirations)
        ? req.inspirations
        : [];
      const inspirationWord = req?.inspirationWord || seed;

      if (!inspirations.length) {
        setInspirationCardData(createEmptyCards());
        setStatus("idle");
        mtoast.error("暂未获取到灵感内容");
        return false;
      }

      const cards: InspirationIdea[] = inspirations
        .slice(0, 3)
        .map((item: any) => ({
          title: item?.inspirationTheme || "",
          summary: item?.referenceStyle || "",
          tag: "",
          image: "",
        }));

      while (cards.length < 3) {
        cards.push({ ...EMPTY_CARD_DATA });
      }

      const imageReq: any = await getInspirationCardsImageReq(
        inspirationWord,
        inspirations,
      );
      const imageList = Array.isArray(imageReq) ? imageReq : [];

      const imageByIndex = new Map<number, string>();
      imageList.forEach((item: any) => {
        const idx = Number(item?.index);
        if (Number.isInteger(idx) && idx >= 0) {
          imageByIndex.set(idx, item?.imageUrl || "");
        }
      });

      const cardsWithImages = cards.map((item, index) => ({
        ...item,
        image: imageByIndex.get(index) || item.image,
      }));

      setLastInspirationWord(inspirationWord);
      setInspirationCardData(cardsWithImages);
      setStatus("ready");
      return true;
    } catch (error) {
      console.error("获取灵感卡片失败:", error);
      mtoast.error("获取灵感失败，请稍后重试");
      setStatus("idle");
      setInspirationCardData(createEmptyCards());
      return false;
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setHasGenerated(true);
    setStatus("loading");

    try {
      await fetchInspirationCards(ideaInput.trim());
    } finally {
      setLoading(false);
    }
  }, [fetchInspirationCards, ideaInput, loading]);

  const handleReroll = useCallback(async () => {
    if (loading || status === "loading" || status === "rerolling") return;
    if (balance < COST_PER_REROLL) {
      mtoast.error("灵感余额不足");
      return;
    }

    const seed = ideaInput.trim() || lastInspirationWord;
    if (!seed) {
      mtoast.error("请先输入想法并生成灵感");
      return;
    }

    setBalance((prev) => Math.max(prev - COST_PER_REROLL, 0));
    setStatus("rerolling");
    setShowPaw(true);
    setPawHit(false);
    setButtonHit(false);
    window.requestAnimationFrame(() => {
      setPawHit(true);
    });
    window.setTimeout(() => {
      setButtonHit(true);
      window.setTimeout(() => setButtonHit(false), 120);
    }, 130);

    pawTimer.current = window.setTimeout(async () => {
      setShowPaw(false);
      setLoading(true);
      setStatus("loading");
      try {
        await fetchInspirationCards(seed);
      } finally {
        setLoading(false);
      }
    }, 260);
  }, [balance, fetchInspirationCards, ideaInput, lastInspirationWord, loading, status]);

  const handleCardClick = useCallback(
    (cardData: InspirationIdea) => {
      if (suppressCardClickRef.current) {
        suppressCardClickRef.current = false;
        return;
      }
      if (!cardData.title) return;
      if (loading) return;
      setInsDetailData(cardData);
      setOpenInsDetail(true);
    },
    [loading],
  );

  const handleAddToNote = useCallback(async () => {
    if (noteSaving) return;
    if (!insDetailData?.title) {
      mtoast.error("暂无可添加的灵感内容");
      return;
    }

    const title = insDetailData.title.trim();
    const summary = insDetailData.summary.trim();
    const content = [
      `灵感主题：${title}`,
      `参考风格：${summary}`,
      `主角信息：${summary}`,
      `主要事件：${summary}`,
      `角色设定：${summary}`,
      `世界观设定：${summary}`,
    ].join("\n");

    try {
      setNoteSaving(true);
      const source: NoteSourceType = "MINI_APP_INSPIRATION";
      await addNote(title, content, source);
      mtoast.success("已添加到笔记");
      setOpenInsDetail(false);
    } catch (error) {
      console.error("添加灵感到笔记失败:", error);
      mtoast.error("添加失败，请稍后重试");
    } finally {
      setNoteSaving(false);
    }
  }, [insDetailData, noteSaving]);

  return (
    <div className="w-full flex flex-col overflow-x-hidden h-full overflow-y-auto bg-[#f3f3f3]">
      <div className="flex-1 min-h-0 px-9 flex flex-col">
        <div className="w-full text-center flex-1 flex items-center justify-center text-[48px] font-bold text-[#c2c2c2]">
          {headline}
        </div>
        <div className="h-200 flex items-center justify-center">
          <div
            className="inspiration-carousel relative w-full h-150 select-none"
            style={{ touchAction: "pan-y" }}
            onWheel={handleCarouselWheel}
            onPointerDown={handleCarouselPointerDown}
            onPointerMove={handleCarouselPointerMove}
            onPointerUp={handleCarouselPointerUp}
            onPointerCancel={handleCarouselPointerCancel}
          >
            {InspirationCardData.map((item, index) => (
              <InspirationCard
                key={item.title + index}
                data={item}
                style={cardTransforms[index]?.style ?? {}}
                side3dClassName={cardTransforms[index]?.side3dClassName}
                isActive={index === activeCardIndex}
                onClick={handleCardClick}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="px-10 py-12 pb-20 h-[460px] flex items-center justify-center">
        {(!hasGenerated && !loading) && (
          <div className="mt-14 rounded-[53px] w-full bg-white shadow-[0px_2px_8px_0px_rgba(0,0,0,0.05)] px-8 py-8 min-h-[220px]">
            <textarea
              value={ideaInput}
              onChange={(event) => setIdeaInput(event.target.value)}
              placeholder="请输入你的想法生成灵感,或抽取随机灵感卡"
              className="w-full bg-transparent text-[32px] leading-normal text-[#464646] placeholder:text-[#dedede] outline-none border-none"
            />
            <div className="mt-7 flex items-center justify-end gap-8">
              <Button
                className="size-14 p-0 rounded-full overflow-hidden text-center leading-14 disabled:opacity-50"
                onClick={handleGenerate}
                disabled={loading || !ideaInput.trim()}
              >
                <Iconfont
                  unicode="&#xe601;"
                  className="text-[32px] text-white"
                />
              </Button>
            </div>
          </div>
        )}

        {/* 重置灵感按钮 */}
        {(hasGenerated && !loading) && (
          <button
            type="button"
            className={cn(
              "relative size-[308px] p-5 rounded-full overflow-hidden bg-[linear-gradient(135deg,#ffbb00,#ffa001)] transition-transform duration-150",
              buttonHit ? "scale-[0.96]" : "scale-100",
            )}
            onClick={handleReroll}
            aria-label="重置灵感"
            disabled={loading || status === "rerolling"}
          >
            <div className="rounded-full flex items-center justify-center size-full bg-[linear-gradient(135deg,#ff9701,#ffb801)]">
              <div className="flex flex-col items-center text-white">
                <div className="size-25 leading-25 text-center">
                  <Iconfont unicode="&#xe66f;" className="text-[96px]" />
                </div>
                <div className="">
                  <Iconfont unicode="&#xe60c;" className="text-[28px] mr-2" />
                  <span className="text-[28px]">{COST_PER_REROLL}/{balance}</span>
                </div>
              </div>
            </div>
            <img
              src={CAT_HAND}
              alt=""
              aria-hidden="true"
              className={cn(
                "absolute left-1/2 -translate-x-1/2 bottom-[-350px] w-120 pointer-events-none select-none transition-all duration-300 ease-out",
                showPaw
                  ? pawHit
                    ? "-translate-y-[250px] -rotate-6 opacity-100"
                    : "translate-y-0 rotate-6 opacity-100"
                  : "translate-y-6 rotate-6 opacity-0",
              )}
            />
          </button>
        )}
      </div>

      <Dialog
        open={openInsDetail && Boolean(insDetailData)}
        onOpenChange={setOpenInsDetail}
      >
        <DialogContent
          showCloseButton={false}
          className="w-[calc(100vw-80px)] h-[calc(100vh-400px)] p-0 rounded-[36px] overflow-hidden"
        >
          <div className="flex flex-col h-[calc(100vh-400px)]">
            <ScrollArea className="flex-1 min-h-0">
              <div>
                <div className="relative h-fit">
                  <img
                    src={insDetailData?.image}
                    alt=""
                    className="w-full h-auto min-h-80 object-cover"
                  />
                  {insDetailData?.title && (
                    <div className="absolute bottom-0 left-0 right-0 p-5 pb-6 text-white">
                      <div className="text-[40px] font-bold">
                        {insDetailData.title}
                      </div>
                      <div className="mt-5 line-clamp-2 text-2xl">
                        {insDetailData.summary}
                      </div>
                    </div>
                  )}
                </div>
                <div className="px-10 py-12 text-[32px] text-[#464646] flex flex-col gap-7">
                  <div>
                    <span className="font-bold">主角信息：</span>
                    {insDetailData?.summary}
                  </div>
                  <div>
                    <span className="font-bold">主要事件：</span>
                    {insDetailData?.summary}
                  </div>
                  <div>
                    <span className="font-bold">角色设定：</span>
                    {insDetailData?.summary}
                  </div>
                  <div>
                    <span className="font-bold">世界观设定：</span>
                    {insDetailData?.summary}
                  </div>
                </div>
              </div>
            </ScrollArea>
            <div className="py-10 flex flex-col items-center justify-center text-[32px]">
              <Button
                className="w-106 h-26 text-[40px] font-bold text-white rounded-full disabled:opacity-50"
                onClick={handleAddToNote}
                disabled={noteSaving || !insDetailData?.title}
              >
                <Iconfont unicode="&#xe64c;" className="text-[32px] mr-2" />
                <span>{noteSaving ? "添加中..." : "添加到笔记"}</span>
              </Button>
              <LinkButton className="mt-8 text-[#a6a6a6]">
                <Iconfont unicode="&#xe66f;" className="text-[32px] mr-2" />
                <span>重新生成</span>
              </LinkButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MInspirationPage;
