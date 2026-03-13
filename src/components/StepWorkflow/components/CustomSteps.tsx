import clsx from "clsx";
import IconFont from "@/components/Iconfont/Iconfont";
import { cn } from "@/lib/utils";

export interface CustomStepsProps {
  /** 当前步骤索引（0-based） */
  active: number;
  steps: string[];
  maxWidth?: number;
  /** 每个步骤是否可点击 */
  stepAccessible?: boolean[];
  onStepClick?: (stepIndex: number) => void;
}

const isStepDisabled = (
  stepIndex: number,
  stepAccessible: boolean[] | undefined,
): boolean => {
  if (stepAccessible && stepAccessible.length > 0) {
    return !stepAccessible[stepIndex];
  }
  return false;
};

const stepStatus = (
  active: number,
  index: number,
): "wait" | "process" | "success" => {
  if (index < active) return "success";
  if (index === active) return "process";
  return "wait";
};

export const CustomSteps = ({
  active,
  steps,
  maxWidth = 330,
  stepAccessible = [],
  onStepClick,
}: CustomStepsProps) => {
  const handleClick = (stepIndex: number) => {
    if (stepAccessible.length > 0 && !stepAccessible[stepIndex]) return;
    onStepClick?.(stepIndex);
  };

  return (
    <div
      className={cn(
        "flex w-full items-center justify-center",
        `max-w-[${maxWidth}px]`
      )}
    >
      {steps.map((title, i) => {
        const status = stepStatus(active, i);
        const disabled = isStepDisabled(i, stepAccessible);

        return (
          <div
            key={i}
            role="button"
            tabIndex={disabled ? -1 : 0}
            onClick={() => handleClick(i)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClick(i);
              }
            }}
            className={cn(
              "relative flex w-[110px] cursor-pointer select-none flex-col items-center",
              disabled && "cursor-not-allowed! ",
            )}
            aria-current={status === "process" ? "step" : undefined}
          >
            {i < steps.length - 1 && (
              <div className={cn(
                "absolute top-5 left-[58%] h-0.5 w-[84%] bg-(--theme-color)",
              )} />
            )}

            <div
              className={cn(
                "flex flex-col items-center",
                disabled && "opacity-60!",
              )}
            >
              <div className="flex w-8 h-8 shrink-0 cursor-inherit items-center justify-center bg-transparent">
                <IconFont
                  unicode={
                    status === "wait"
                      ? "\ue635"
                      : status === "process"
                        ? "\ue634"
                        : "\ue636"
                  }
                  className="text-[32px] leading-8 text-(--theme-color)"
                />
              </div>

              <div className="mt-1 cursor-inherit text-center">
                <div className="font-semibold text-(--theme-color)">
                  {title}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
