"use client"

import React from "react"
import clsx from "clsx"
import IconFont from "@/components/IconFont/Iconfont"

export interface CustomStepsProps {
  /** 当前步骤索引（0-based） */
  active: number
  steps: string[]
  maxWidth?: number
  /** 每个步骤是否可点击 */
  stepAccessible?: boolean[]
  onStepClick?: (stepIndex: number) => void
}

const isStepDisabled = (
  stepIndex: number,
  stepAccessible: boolean[] | undefined
): boolean => {
  if (stepAccessible && stepAccessible.length > 0) {
    return !stepAccessible[stepIndex]
  }
  return false
}

const stepStatus = (
  active: number,
  index: number
): "wait" | "process" | "success" => {
  if (index < active) return "success"
  if (index === active) return "process"
  return "wait"
}

/** 与 Vue CustomSteps 对齐：el-steps 布局、自定义 iconfont、连接线、禁用态 */
export const CustomSteps = ({
  active,
  steps,
  maxWidth = 330,
  stepAccessible = [],
  onStepClick,
}: CustomStepsProps) => {
  const handleClick = (stepIndex: number) => {
    if (stepAccessible.length > 0 && !stepAccessible[stepIndex]) return
    onStepClick?.(stepIndex)
  }

  return (
    <div
      className="custom-steps flex w-full items-center justify-center"
      style={{ maxWidth }}
    >
      {steps.map((title, i) => {
        const status = stepStatus(active, i)
        const disabled = isStepDisabled(i, stepAccessible)

        return (
          <div
            key={i}
            role="button"
            tabIndex={disabled ? -1 : 0}
            onClick={() => handleClick(i)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                handleClick(i)
              }
            }}
            className={clsx(
              // 结构对齐 ElementPlus：.custom-steps.el-steps .el-step { width: 110px; }
              "el-step relative flex w-[110px] cursor-pointer select-none flex-col items-center",
              disabled && "step-disabled cursor-not-allowed opacity-60"
            )}
            aria-current={status === "process" ? "step" : undefined}
          >
            {/* 连接线：完全按 Vue 样式（height 3px, top 16px, width 84%, left 58%） */}
            {i < steps.length - 1 && (
              <div className="el-step__line absolute top-[16px] left-[58%] h-[3px] w-[84%] bg-[var(--theme-color)]" />
            )}

            {/* 图标：24x24 外框，18x18 内层，iconfont 32px */}
            <div className="el-step__head flex h-6 w-6 flex-shrink-0 cursor-inherit items-center justify-center bg-transparent">
              <div className="step-icon-container flex h-[18px] w-[18px] items-center justify-center overflow-hidden">
                <IconFont
                  unicode={status === "wait" ? "\ue635" : status === "process" ? "\ue634" : "\ue636"}
                  className="text-[32px] leading-[18px] text-[var(--theme-color)]"
                />
              </div>
            </div>

            {/* 标题：font-weight 600, color theme */}
            <div className="el-step__main mt-1 cursor-inherit text-center">
              <div className="el-step__title font-semibold text-[var(--theme-color)]">
                {title}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
