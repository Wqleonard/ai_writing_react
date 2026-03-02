/**
 * NewbieTour 增强版
 * 支持更多配置选项和自定义功能
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import Joyride, { STATUS, ACTIONS, EVENTS } from 'react-joyride-react19-compat'
import type { Step, CallBackProps, Placement } from 'react-joyride-react19-compat'
import { useNavigate } from 'react-router-dom'
import type { TourConfig, TourCallbacks } from './NewbieTour.types.ts'
import { Button } from "@/components/ui/Button.tsx";
import { Iconfont } from "@/components/IconFont";

interface NewbieTourProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config?: TourConfig
  callbacks?: TourCallbacks
  customSteps?: Step[]
}


const CustomTooltip = (props: any) => {
  const { step, index, size } = props
  const { title, content, isLast, onNext, onPrev,onClose } = step

  const showPrev = index !== 0

  const progress = useMemo(() => {
    return ((index + 1) / size) * 100
  }, [index, size])

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
      <div className="mt-5 text-xl text-[#f3a901] font-semibold">
        {title}
      </div>

      {/* 描述 */}
      <div className="mt-3 text-base text-gray-800">
        {content}
      </div>

      {/* 按钮区域 */}
      <div className="mt-6 flex flex-row-reverse gap-2">
        <Button
          className="w-20 h-8 px-3 py-1.5 text-base text-white rounded-full"
          onClick={onNext}
        >
          {isLast ? '完成' : '下一步'}
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
  )
}

export function NewbieTour({
                             open,
                             onOpenChange,
                             config = {},
                             callbacks = {},
                             customSteps,
                           }: NewbieTourProps) {
  const navigate = useNavigate()
  const [stepIndex, setStepIndex] = useState(0)
  const joyrideRef = useRef<any>(null)
  const hasShownRef = useRef(false)

  const DEFAULT_STORAGE_KEY = 'hasOpenNewbieTour'
  const TOTAL_STEPS = 7

  const {
    autoShowOnFirstVisit = false,
    storageKey = DEFAULT_STORAGE_KEY,
    allowEscClose = false,
    allowOverlayClose = false,
  } = config

  const {
    onStart,
    onFinish,
    onSkip,
    onStepChange,
  } = callbacks

  // 计算进度百分比
  // const progressPercent = useMemo(() => {
  //   return ((stepIndex + 1) / TOTAL_STEPS) * 100
  // }, [stepIndex])

  // 处理上一步
  const handlePrev = useCallback(() => {
    const newIndex = Math.max(0, stepIndex - 1)
    setStepIndex(newIndex)
    onStepChange?.(newIndex)
  }, [stepIndex, onStepChange])

  // 处理下一步
  const handleNext = useCallback(() => {
    if (stepIndex === TOTAL_STEPS - 1) {
      onFinish?.()
      onOpenChange(false)
      // 标记用户已完成引导
      localStorage.setItem(storageKey, 'true')
    } else {
      const newIndex = Math.min(TOTAL_STEPS - 1, stepIndex + 1)
      setStepIndex(newIndex)
      onStepChange?.(newIndex)
    }
  }, [stepIndex, onOpenChange, onFinish, onStepChange, storageKey])

  // 处理跳过
  const handleSkip = useCallback(() => {
    onSkip?.()
    onOpenChange(false)
    localStorage.setItem(storageKey, 'true')
  }, [onOpenChange, onSkip, storageKey])

  const defaultSteps: Step[] = useMemo(() => [
    {
      target: '#newbiew-tour-step-1',
      title: '发送创作想法',
      content: (
        <>
          发送你的<span className="text-[#f3a901]">创作想法</span>或选择相关工具，立即创建新作品
        </>
      ),
      placement: 'left-start',
      onClose: handleSkip,
      onNext: handleNext,
      onPrev: handlePrev,
      disableBeacon: true,
    },
    {
      target: '#newbiew-tour-step-2',
      title:'快捷写作命令',
      content: (
        <>
          取消勾选仅回答，点击上方"我想写"，可使用<span className="text-[#f3a901]">快捷提示词</span>发送。
        </>
      ),
      onClose: handleSkip,
      onNext: handleNext,
      onPrev: handlePrev,
      placement: 'right-start',
    },
    {
      target: '#newbiew-tour-step-3',
      content: (
        <>
          使用<span className="text-[#f3a901]">当前热点</span>进行创作，可直接填充提示词到对话框中。
        </>
      ),
      onClose: handleSkip,
      onNext: handleNext,
      onPrev: handlePrev,
      placement: 'left',
    },
    {
      target: '.el-menu-item.workspace-menu-item',
      content: (
        <>
          查看创作热榜，了解当前小说<span className="text-[#f3a901]">热门主题</span>，进行仿写
        </>
      ),
      placement: 'right' as Placement,
      disableBeacon: true,
      onClose: handleSkip,
      onNext: handleNext,
      onPrev: handlePrev,
      showPrev: true,
    },
    {
      target: '.el-menu-item.book-analysis-menu-item',
      content: (
        <>
          上传文本进行分析，快速
          <span className="text-[#f3a901]">提炼核心冲突、文本结构</span>
          等，用于仿写学习
        </>
      ),
      placement: 'right' as Placement,
      disableBeacon: true,
      onClose: handleSkip,
      onNext: handleNext,
      onPrev: handlePrev,
      showPrev: true,
    },
    {
      target: '.el-menu-item.writing-styles-menu-item',
      content: (
        <>
          对您上传的文本进行分析提炼，方便总结<span className="text-[#f3a901]">个人创作文风</span>直接用于AI创作
        </>
      ),
      placement: 'right' as Placement,
      disableBeacon: true,
      onClose: handleSkip,
      onNext: handleNext,
      onPrev: handlePrev,
      showPrev: true,
    },
    {
      target: '.el-menu-item.course-menu-item',
      content: (
        <>
          加入社区，了解更多<span className="text-[#f3a901]">写作技巧</span>，创建专属自己的写作工具。
        </>
      ),
      placement: 'right' as Placement,
      disableBeacon: true,
      onClose: handleSkip,
      onNext: handleNext,
      onPrev: handlePrev,
      showPrev: true,
    },
  ], [handleSkip, handleNext, handlePrev])


  const steps = customSteps || defaultSteps

  // 处理引导回调
  const handleJoyrideCallback = useCallback(async (data: CallBackProps) => {
    const { action, index, status, type, lifecycle } = data

    // 处理关闭
    if (status === STATUS.FINISHED) {
      onFinish?.()
      onOpenChange(false)
      localStorage.setItem(storageKey, 'true')
      return
    }

    if (status === STATUS.SKIPPED) {
      onSkip?.()
      onOpenChange(false)
      localStorage.setItem(storageKey, 'skipped')
      return
    }

    // 处理步骤变化 - 在步骤完成后进行导航
    if (type === EVENTS.STEP_AFTER && lifecycle === 'complete') {
      // 处理需要导航的步骤（下一步）
      if (action === ACTIONS.NEXT) {
        switch (index) {
          case 3:
            await navigate('/book-analysis')
            break
          case 4:
            await navigate('/writing-styles')
            break
          case 5:
            await navigate('/course')
            break
        }
      }
      // 处理需要导航的步骤（上一步）
      else if (action === ACTIONS.PREV) {
        switch (index) {
          case 4:
            await navigate('/workspace')
            break
          case 5:
            await navigate('/book-analysis')
            break
          case 6:
            await navigate('/writing-styles')
            break
        }
      }
    }
  }, [navigate, onOpenChange, onFinish, onSkip, storageKey])

  // 监听 open 变化
  useEffect(() => {
    if (open) {
      setStepIndex(0)
      hasShownRef.current = true
      onStart?.()
    }
  }, [open, onStart])

  // 首次访问自动显示
  useEffect(() => {
    if (autoShowOnFirstVisit && !hasShownRef.current) {
      const hasSeenTour = localStorage.getItem(storageKey)
      if (!hasSeenTour) {
        onStart?.()
      }
    }
  }, [autoShowOnFirstVisit, storageKey, onStart])

  if (!open) return null

  return (
    <Joyride
      run={open}
      steps={steps}
      ref={joyrideRef}
      stepIndex={stepIndex}
      continuous
      disableCloseOnEsc={!allowEscClose}
      disableOverlayClose={!allowOverlayClose}
      callback={handleJoyrideCallback}
      tooltipComponent={CustomTooltip}
      styles={{
        options: {
          zIndex: 10000,
          width: '20rem',
        },
        overlay: {
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        },
      }}
      floaterProps={{
        disableAnimation: false,
      }}
    />
  )
}
