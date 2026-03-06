/**
 * NewbieTour 增强版
 * 支持更多配置选项和自定义功能
 */

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import Joyride, { STATUS, ACTIONS, EVENTS } from "react-joyride-react19-compat";
import type {
  Step,
  CallBackProps,
} from "react-joyride-react19-compat";
import { useNavigate } from "react-router-dom";
import type { TourConfig, TourCallbacks } from "./types.ts";
import { Button } from "@/components/ui/Button.tsx";
import { Iconfont } from "@/components/IconFont";

interface SendIdeaTourProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: TourConfig;
  callbacks?: TourCallbacks;
  customSteps?: Step[];
}

const CustomTooltip = (props: any) => {
  console.log(props);
  const { step, index, size } = props;
  const { title, content, onNext, onPrev, onClose } = step;

  const showPrev = index !== 0;
  const isLast = index == size - 1;

  const progress = useMemo(() => {
    return ((index + 1) / size) * 100;
  }, [index, size]);

  return (
    <div className="w-80 p-4 bg-white rounded-lg shadow-sm">
      {/* 进度条和关闭按钮 */}
      <div className="flex items-center justify-between w-full">
        <div className="w-[224px] h-1 rounded-full bg-[#d9d9d9] relative overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-[#f3a901] transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <Button
          variant="ghost"
          className="size-5"
          size="icon-xs"
          aria-label="关闭引导"
          onClick={onClose}
        >
          <Iconfont unicode="&#xe633;" />
        </Button>
      </div>

      {/* 标题 */}
      <div className="mt-5 text-xl text-[#f3a901] font-semibold">{title}</div>

      {/* 描述 */}
      <div className="mt-3 text-base text-gray-800">{content}</div>

      {/* 按钮区域 */}
      <div className="mt-6 flex flex-row-reverse gap-2">
        <Button
          className="w-20 h-8 px-3 py-1.5 text-base text-white rounded-full"
          onClick={onNext}
        >
          {isLast ? "完成" : "下一步"}
        </Button>
        {showPrev && (
          <Button
            variant="outline"
            className="w-20 h-8 px-3 py-1.5 text-base rounded-full"
            onClick={onPrev}
          >
            上一步
          </Button>
        )}
      </div>
    </div>
  );
};

export const SendIdeaTour = ({
  open,
  onOpenChange,
  callbacks = {},
  customSteps,
}: SendIdeaTourProps) => {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const joyrideRef = useRef<any>(null);
  const TOTAL_STEPS = 3;

  const { onStart, onFinish, onSkip, onStepChange } = callbacks;

  const scrollToPageTop = useCallback(() => {
    // my-place 页面滚动发生在 ScrollArea viewport，而非 window
    const viewport = document.querySelector(
      '.workspace-scrollbar [data-slot="scroll-area-viewport"]'
    ) as HTMLElement | null;
    if (viewport) {
      viewport.scrollTo({ top: 0, left: 0, behavior: "auto" });
      viewport.scrollTop = 0;
    }

    // 兜底：页面级滚动容器
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    if (document.scrollingElement) {
      document.scrollingElement.scrollTop = 0;
    }
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  // 计算进度百分比
  // const progressPercent = useMemo(() => {
  //   return ((stepIndex + 1) / TOTAL_STEPS) * 100
  // }, [stepIndex])

  // 处理上一步
  const handlePrev = useCallback(() => {
    const newIndex = Math.max(0, stepIndex - 1);
    setStepIndex(newIndex);
    onStepChange?.(newIndex);
  }, [stepIndex, onStepChange]);

  // 处理下一步
  const handleNext = useCallback(() => {
    if (stepIndex === TOTAL_STEPS - 1) {
      scrollToPageTop();
      onFinish?.();
      onOpenChange(false);
    } else {
      const newIndex = Math.min(TOTAL_STEPS - 1, stepIndex + 1);
      setStepIndex(newIndex);
      onStepChange?.(newIndex);
    }
  }, [stepIndex, onOpenChange, onFinish, onStepChange, scrollToPageTop]);

  // 处理跳过
  const handleSkip = useCallback(() => {
    onSkip?.();
    onOpenChange(false);
  }, [onOpenChange, onSkip]);

  const steps: Step[] = useMemo(
    () => [
      {
        target: "#newbiew-tour-step-1",
        title: "发送创作想法",
        content: (
          <>
            发送你的<span className="text-[#f3a901]">创作想法</span>
            或选择相关工具，立即创建新作品
          </>
        ),
        placement: "left-start",
        onClose: handleSkip,
        onNext: handleNext,
        onPrev: handlePrev,
        disableBeacon: true,
      },
      {
        target: "#newbiew-tour-step-2",
        title: "快捷写作命令",
        content: (
          <>
            取消勾选仅回答，点击上方"我想写"，可使用
            <span className="text-[#f3a901]">快捷提示词</span>发送。
          </>
        ),
        placement: "right-start",
        onClose: handleSkip,
        onNext: handleNext,
        onPrev: handlePrev,
        disableBeacon: true,
      },
      {
        target: "#newbiew-tour-step-3",
        title: "使用热点创作",
        content: (
          <>
            使用<span className="text-[#f3a901]">当前热点</span>
            进行创作，可直接填充提示词到对话框中。
          </>
        ),
        placement: "left",
        onClose: handleSkip,
        onNext: handleNext,
        onPrev: handlePrev,
        disableBeacon: true,
      },
    ],
    [handleSkip, handleNext, handlePrev],
  );

  // 处理引导回调
  const handleJoyrideCallback = useCallback(
    async (data: CallBackProps) => {
      const { action, index, status, type } = data;

      // 处理关闭
      if (status === STATUS.FINISHED) {
        onFinish?.();
        onOpenChange(false);
        scrollToPageTop();
        return;
      }

      if (status === STATUS.SKIPPED) {
        onSkip?.();
        onOpenChange(false);
        return;
      }

      // 处理步骤变化 - 在步骤开始前进行导航，确保目标元素已挂载
      if (type === EVENTS.STEP_BEFORE) {
        // 处理需要导航的步骤（下一步）
        if (action === ACTIONS.NEXT) {
          switch (index) {
            case 4:
              await navigate("/workspace/ai-expert/book-analysis");
              break;
            case 5:
              await navigate("/workspace/ai-expert/writing-styles");
              break;
            case 6:
              await navigate("/workspace/creation-community/course");
              break;
          }
        }
        // 处理需要导航的步骤（上一步）
        else if (action === ACTIONS.PREV) {
          switch (index) {
            case 3:
              await navigate("/workspace/my-place");
              break;
            case 4:
              await navigate("/workspace/ai-expert/book-analysis");
              break;
            case 5:
              await navigate("/workspace/ai-expert/writing-styles");
              break;
          }
        }
      }
    },
    [navigate, onOpenChange, onFinish, onSkip, scrollToPageTop],
  );

  // 监听 open 变化
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStepIndex(0);
    }
  }, [open, onStart]);

  return (
    <Joyride
      run={open}
      steps={steps}
      ref={joyrideRef}
      stepIndex={stepIndex}
      continuous
      disableCloseOnEsc={true}
      disableOverlayClose={true}
      callback={handleJoyrideCallback}
      tooltipComponent={CustomTooltip}
      styles={{
        options: {
          zIndex: 10000,
          width: "20rem",
        },
        overlay: {
          backgroundColor: "rgba(0, 0, 0, 0.5)",
        },
      }}
      floaterProps={{
        disableAnimation: false,
      }}
    />
  );
};
