"use client"

import React, { useCallback, useImperativeHandle, useRef, useState } from "react"
import { CreateRecommendDialog } from "./components/CreateRecommendDialog"
import { StepCreateDialog, type StepCreateDialogRef } from "./components/StepCreateDialog"
import type { Template, StepSaveData, Mode } from "./types"
import customCoverImg from "@/assets/images/step_create/custom-cover.png"
import templateCoverImg from "@/assets/images/step_create/template-cover.png"
import tagCoverImg from "@/assets/images/step_create/tag-cover.png"

const CUSTOM_COVER = customCoverImg as string
const TEMPLATE_COVER = templateCoverImg as string
const TAG_COVER = tagCoverImg as string

const MODES = [
  { mode: "custom", title: "自定义短篇创作", desc: "详细制定你的内容方向…", cover: CUSTOM_COVER },
  { mode: "template", title: "使用模板创作", desc: "选择热门模板创作…", cover: TEMPLATE_COVER },
  { mode: "tag", title: "使用标签创作", desc: "选择标签自由获取灵感…", cover: TAG_COVER },
]

export interface StepWorkflowRef {
  /** 打开步骤创建弹窗（对应 Vue 的 setStepCreateDialogShow(true)） */
  openStepCreateDialog: () => void
}

export interface StepWorkflowProps {
  /** 编辑器内容总字数，用于控制快捷入口显隐 */
  totalMdContentLength?: number
  /** 当前编辑中的文件 id，变化时重算快捷入口 */
  currentEditingId?: string | null
  /** 步骤创建完成：保存到当前作品后的回调（React 侧需自行更新 sidebar/editor 等） */
  onStepConfirm?: (data: StepSaveData) => void
}

export const StepWorkflow = React.forwardRef<StepWorkflowRef, StepWorkflowProps>(function StepWorkflow(
  {
    totalMdContentLength = 0,
    currentEditingId,
    onStepConfirm,
  },
  ref
) {
  const [recommendDialogShow, setRecommendDialogShow] = useState(true)
  const [stepCreateDialogShow, setStepCreateDialogShow] = useState(false)
  const [showQuickStart, setShowQuickStart] = useState(false)
  const stepCreateDialogRef = useRef<StepCreateDialogRef>(null)

  useImperativeHandle(ref, () => ({
    openStepCreateDialog: () => setStepCreateDialogShow(true),
  }), [])

  const updateQuickStart = useCallback(() => {
    if (totalMdContentLength === 0) {
      setShowQuickStart(true)
    } else {
      setShowQuickStart(false)
    }
  }, [totalMdContentLength])

  React.useEffect(() => {
    updateQuickStart()
  }, [updateQuickStart, currentEditingId])

  const handleCreateWithTags = useCallback(() => {
    setRecommendDialogShow(false)
    setStepCreateDialogShow(true)
    stepCreateDialogRef.current?.startMode("tag")
  }, [])

  const handleCreateTemplate = useCallback((template: Template) => {
    setRecommendDialogShow(false)
    setStepCreateDialogShow(true)
    stepCreateDialogRef.current?.startTemplateCreate(template)
  }, [])

  const handleStepConfirm = useCallback(
    (data: StepSaveData) => {
      setStepCreateDialogShow(false)
      onStepConfirm?.(data)
    },
    [onStepConfirm]
  )

  const handleStartItemClick = useCallback((mode: string) => {
    setStepCreateDialogShow(true)
    stepCreateDialogRef.current?.startMode(mode as Mode)
  }, [])

  return (
    <>
      <CreateRecommendDialog
        open={recommendDialogShow}
        onOpenChange={setRecommendDialogShow}
        onCreateWithTags={handleCreateWithTags}
        onCreateTemplate={handleCreateTemplate}
      />

      <StepCreateDialog
        ref={stepCreateDialogRef}
        open={stepCreateDialogShow}
        onOpenChange={setStepCreateDialogShow}
        onConfirm={handleStepConfirm}
      />

      <div
        className={`
          absolute inset-0 overflow-hidden transition-all duration-300 ease-in-out
          ${showQuickStart ? "opacity-100 max-h-[420px] translate-y-0" : "opacity-0 max-h-0 -translate-y-4 pointer-events-none"}
        `}
        style={{ contain: "layout style paint", willChange: "transform, opacity, max-height" }}
        aria-hidden={!showQuickStart}
      >
        <div className="pointer-events-none h-full flex flex-col-reverse items-center py-5">
          <div className="flex items-center justify-center gap-4">
            {MODES.map((m) => (
              <div
                key={m.mode}
                role="button"
                tabIndex={0}
                onClick={() => handleStartItemClick(m.mode)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    handleStartItemClick(m.mode)
                  }
                }}
                className="pointer-events-auto flex h-[136px] w-40 cursor-pointer flex-col items-center justify-center rounded-[10px] border border-[#e6e6e5] p-4 hover:border-[var(--theme-color)]"
              >
                <div className="h-[50px] w-full bg-white">
                  <img src={m.cover} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="mt-2.5 h-[18px] text-base font-medium">{m.title}</div>
                <div className="mt-2.5 text-[8px] text-[#9a9a9a]">{m.desc}</div>
              </div>
            ))}
          </div>
          <div className="w-full text-center text-sm">不知道怎么开始？试试以下快捷创作流程：</div>
        </div>
      </div>
    </>
  )
})
