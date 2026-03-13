"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getUserBalanceReq } from "@/api/users";
import { mtoast } from "@/components/ui/toast";
import DIAMOND_ICON_URL from "@/assets/images/m_ins/diamond_icon.png";
import { Button } from "@/components/ui/Button";
import { Iconfont } from "@/components/Iconfont";
import { cn } from "@/lib/utils";

import DEFAULT_CARD_IMAGE from "@/assets/images/m_ins/card_cover.png";

const COST_PER_REROLL = 10;
const SWIPE_THRESHOLD = 56;
const CARD_WIDTH_PX = 380;
const SIDE_ROTATE_DEG = 60;
const CARD_OVERLAP_PX = 40;
const SIDE_PROJECTED_WIDTH_PX = Math.round(
  CARD_WIDTH_PX * Math.cos((SIDE_ROTATE_DEG * Math.PI) / 180),
);
const CARD_SHIFT_PX = Math.round(
  (CARD_WIDTH_PX + SIDE_PROJECTED_WIDTH_PX) / 2 - CARD_OVERLAP_PX,
);

type Status = "idle" | "loading" | "ready" | "rerolling";

interface InspirationIdea {
  title: string;
  summary: string;
  tag: string;
  image: string;
}

interface InspirationCardProps {
  data: InspirationIdea;
  index: number;
}

import TEST1 from "@/assets/images/m_ins/test1.jpg";
import TEST2 from "@/assets/images/m_ins/test2.jpg";
import TEST3 from "@/assets/images/m_ins/test3.jpg";

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

const InspirationCard = ({ data, index }: InspirationCardProps) => {
  return (
    <div
      className={cn(
        "w-95 h-150 p-3 relative rounded-xl bg-white shrink-0 snap-center transform-3d transition-transform duration-300",
        index === 0 &&
          "transform-3d origin-[left_center] transform-[rotateY(60deg)_translateZ(18px)] -mr-50",
        index === 1 && "z-99",
        index === 2 &&
          "transform-3d origin-[right_center] transform-[rotateY(-60deg)_translateZ(18px)] -ml-50",
      )}
      role="button"
      tabIndex={0}
      aria-label="抽取灵感卡"
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
  const [swipeDirection, setSwipeDirection] = useState<-1 | 0 | 1>(0);
  const [showPaw, setShowPaw] = useState(false);

  const loadingTimer = useRef<number | null>(null);
  const imageTimer = useRef<number | null>(null);
  const pawTimer = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const hasGenerated = status === "ready" || status === "rerolling";

  const [loading, setLoading] = useState(false);

  const [InspirationCardData, setInspirationCardData] = useState<
    InspirationIdea[]
  >([...INSPIRATION_CARDS]);

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

  useEffect(() => {
    (async () => {
      try {
        const req: any = await getUserBalanceReq();
        const points = Number(req?.token ?? req?.dailyFreeToken ?? 0);
        if (Number.isFinite(points) && points > 0) {
          setBalance(Math.floor(points / 1000));
        }
      } catch (error) {
        console.error("获取灵感余额失败:", error);
      }
    })();
    return clearTimers;
  }, [clearTimers]);

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

  const handleGenerate = useCallback(() => {
    if (status === "loading" || status === "rerolling") return;
    setStatus("loading");
    setSwipeDirection(0);
    loadingTimer.current = window.setTimeout(() => {
      const next = pickNextIndex(currentIndex);
      revealCard(next);
    }, 1200);
  }, [currentIndex, pickNextIndex, revealCard, status]);

  const handleReroll = useCallback(() => {
    if (status !== "ready") return;
    if (balance < COST_PER_REROLL) {
      mtoast.error("灵感余额不足");
      return;
    }

    setBalance((prev) => Math.max(prev - COST_PER_REROLL, 0));
    setStatus("rerolling");
    setShowPaw(true);

    pawTimer.current = window.setTimeout(() => {
      setShowPaw(false);
      setStatus("loading");
      loadingTimer.current = window.setTimeout(() => {
        const next = pickNextIndex(currentIndex);
        revealCard(next);
      }, 900);
    }, 520);
  }, [balance, currentIndex, pickNextIndex, revealCard, status]);

  return (
    <div className="w-full flex flex-col overflow-x-hidden h-full overflow-y-auto bg-[#f3f3f3]">
      <div className="flex-1 min-h-0 px-9 flex flex-col">
        <div className="w-full text-center flex-1 flex items-center justify-center text-[48px] font-bold text-[#c2c2c2]">
          {headline}
        </div>
        <div className="h-200 flex items-center justify-center">
          <div className="w-full flex h-150 perspective-distant perspective-origin-[center_center]">
            {InspirationCardData.map((item, index) => (
              <InspirationCard
                key={item.title + index}
                data={item}
                index={index}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="pb-15 px-10">
        {!hasGenerated && (
          <div className="mt-14 rounded-[53px] bg-white shadow-[0px_2px_8px_0px_rgba(0,0,0,0.05)] px-8 py-8 min-h-[220px]">
            <textarea
              value={ideaInput}
              onChange={(event) => setIdeaInput(event.target.value)}
              placeholder="请输入你的想法生成灵感,或抽取随机灵感卡"
              className="w-full bg-transparent text-[32px] leading-normal text-[#464646] placeholder:text-[#dedede] outline-none border-none"
            />
            <div className="mt-7 flex items-center justify-end gap-8">
              <Button className="size-14 p-0 rounded-full overflow-hidden text-center leading-14">
                <Iconfont
                  unicode="&#xe601;"
                  className="text-[32px] text-white"
                />
              </Button>
            </div>
          </div>
        )}

        {hasGenerated && (
          <button
            type="button"
            className="relative mt-14 mx-auto block w-[308px] h-[308px] active:scale-[0.98] transition-transform"
            onClick={handleReroll}
            aria-label="重置灵感"
          >
            <img alt="" className="absolute inset-0 size-full object-contain" />
            <div className="absolute left-1/2 top-[70%] -translate-x-1/2 text-white text-[30px] font-bold tracking-[1px]">
              {COST_PER_REROLL}/{balance}
            </div>
            <img
              src={DIAMOND_ICON_URL}
              alt=""
              className="absolute left-[92px] top-[216px] size-8 object-contain"
            />
          </button>
        )}
      </div>
    </div>
  );
};

export default MInspirationPage;
