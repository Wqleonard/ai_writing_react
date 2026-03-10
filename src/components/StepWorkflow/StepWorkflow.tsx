"use client"

import React, { useCallback, useImperativeHandle, useRef, useState, useEffect } from "react"
import { StepCreateDialog, type StepCreateDialogRef } from "./components/StepCreateDialog"
import { CreateRecommendDialog } from "./components/CreateRecommendDialog"
import type { StepSaveData, Mode, CharacterCardData, Template } from "./types"
import customCoverImg from "@/assets/images/step_create/custom-cover.png"
import templateCoverImg from "@/assets/images/step_create/template-cover.png"
import tagCoverImg from "@/assets/images/step_create/tag-cover.png"
import { useEditorStore } from "@/stores/editorStore"
import { createWorkReq, updateWorkInfoReq, updateWorkVersionReq } from "@/api/works"
import { createNewMobileWork } from "@/api/m-workspace-chat"
import { toast } from "sonner";

const CUSTOM_COVER = customCoverImg as string
const TEMPLATE_COVER = templateCoverImg as string
const TAG_COVER = tagCoverImg as string

const MODES = [
  { mode: "custom", title: "自定义短篇创作", desc: "详细制定你的内容方向…", cover: CUSTOM_COVER },
  { mode: "template", title: "使用模板创作", desc: "选择热门模板创作…", cover: TEMPLATE_COVER },
  { mode: "tag", title: "使用标签创作", desc: "选择标签自由获取灵感…", cover: TAG_COVER },
]

const generateRoleSetting = (character: CharacterCardData | null) => {
  if (!character) return ""
  let md = "## 主角信息\n"
  const firstLineArr: string[] = []
  if (character.name) firstLineArr.push(character.name)
  if (character.age) firstLineArr.push(character.age)
  if (character.gender) firstLineArr.push(character.gender)
  if (character.mbti) firstLineArr.push(character.mbti)
  md += `${firstLineArr.join("，")}。\n\n`
  if (character.experiences) md += `${character.experiences}\n\n`
  if (character.personality) md += `${character.personality}\n\n`
  if (character.abilities) md += `${character.abilities}\n\n`
  if (character.identity) md += `${character.identity}\n\n`
  return md
}

export interface StepWorkflowRef {
  /** 打开步骤创建弹窗（对应 Vue 的 setStepCreateDialogShow(true)） */
  openStepCreateDialog: () => void
  /** 外部带模板直达“选择故事”步骤 */
  startTemplateCreate: (template: Template) => boolean
  /** 打开/关闭创作推荐弹窗（对齐 Vue showCreationDialog） */
  showCreationDialog: (show?: boolean) => void
  /** 直接控制步骤创建弹窗显隐（对齐 Vue setStepCreateDialogShow） */
  setStepCreateDialogShow: (show?: boolean) => void
}

export const StepWorkflow = React.forwardRef<StepWorkflowRef>(function StepWorkflow(
  _props,
  ref
) {
  const [recommendDialogShow, setRecommendDialogShow] = useState(false)
  const [stepCreateDialogShow, setStepCreateDialogShow] = useState(false)
  const stepCreateDialogRef = useRef<StepCreateDialogRef>(null)
  const autoOpenedOnceRef = useRef(false)
  const [isQuickStartMounted, setIsQuickStartMounted] = useState(false)
  const [isQuickStartActive, setIsQuickStartActive] = useState(false)
  const hideTimerRef = useRef<number | null>(null)

  const setWorkInfo = useEditorStore((s) => s.setWorkInfo)
  const setServerData = useEditorStore((s) => s.setServerData)
  const setCurrentEditingId = useEditorStore((s) => s.setCurrentEditingId)
  const saveEditorData = useEditorStore((s) => s.saveEditorData)
  const currentEditingId = useEditorStore((s) => s.currentEditingId)

  const openStepCreateDialogSafely = useCallback(() => {
    setStepCreateDialogShow(true)
  }, [])

  const startTemplateCreateSafely = useCallback((template: Template) => {
    setRecommendDialogShow(false)
    setStepCreateDialogShow(true)
    // 等 Dialog 挂载后再调用内部跳步方法，避免 ref 尚未可用
    requestAnimationFrame(() => {
      stepCreateDialogRef.current?.startTemplateCreate(template)
    })
    return true
  }, [])

  const setStepCreateDialogShowSafely = useCallback((show = true) => {
    if (!show) {
      setStepCreateDialogShow(false)
      return
    }
    setRecommendDialogShow(false)
    setStepCreateDialogShow(true)
  }, [])

  const showCreationDialog = useCallback((show = true) => {
    if (!show) {
      setRecommendDialogShow(false)
      return
    }
    setRecommendDialogShow(true)
  }, [])

  const handleCreateWithTags = useCallback(() => {
    setRecommendDialogShow(false)
    setStepCreateDialogShow(true)
    requestAnimationFrame(() => {
      stepCreateDialogRef.current?.startMode("tag")
    })
  }, [])

  const handleCreateTemplate = useCallback((template: Template) => {
    setRecommendDialogShow(false)
    setStepCreateDialogShow(true)
    requestAnimationFrame(() => {
      stepCreateDialogRef.current?.startTemplateCreate(template)
    })
  }, [])

  useImperativeHandle(ref, () => ({
    openStepCreateDialog: openStepCreateDialogSafely,
    startTemplateCreate: startTemplateCreateSafely,
    showCreationDialog,
    setStepCreateDialogShow: setStepCreateDialogShowSafely,
  }), [openStepCreateDialogSafely, setStepCreateDialogShowSafely, showCreationDialog, startTemplateCreateSafely])

  const handleStartItemClick = useCallback((mode: string) => {
    openStepCreateDialogSafely()
    stepCreateDialogRef.current?.startMode(mode as Mode)
  }, [openStepCreateDialogSafely])

  // 推荐显示
  useEffect(() => {
    // if (hideTimerRef.current) {
    //   window.clearTimeout(hideTimerRef.current)
    //   hideTimerRef.current = null
    // }
    //
    // if (showQuickStart) {
    //   setIsQuickStartMounted(true)
    //   // 双 rAF：确保先应用 enter-from，再平滑过渡到 enter-to
    //   let raf2 = 0
    //   const raf1 = requestAnimationFrame(() => {
    //     raf2 = requestAnimationFrame(() => setIsQuickStartActive(true))
    //   })
    //   return () => {
    //     cancelAnimationFrame(raf1)
    //     if (raf2) cancelAnimationFrame(raf2)
    //   }
    // }
    //
    // // 先做离场动画，再真正隐藏，避免突兀闪断
    // setIsQuickStartActive(false)
    // hideTimerRef.current = window.setTimeout(() => {
    //   setIsQuickStartMounted(false)
    //   hideTimerRef.current = null
    // }, 280)
    //
    // return () => {
    //   if (hideTimerRef.current) {
    //     window.clearTimeout(hideTimerRef.current)
    //     hideTimerRef.current = null
    //   }
    // }
  }, [])

  const handleStepConfirm = useCallback(async (data: StepSaveData, editingId = "大纲.md") => {
    const nextServerData = {
      "大纲.md": data.outline || "",
      "知识库/": "",
      "设定/角色设定.md": generateRoleSetting(data.character),
      "设定/故事设定.md": data.story?.intro ?? "",
      "正文/第一章.md": "",
    }
    if (data.saveTarget == 'current') {   
      setServerData(nextServerData)
      setCurrentEditingId(editingId)
      setStepCreateDialogShow(false)

      const titleLine = data.story?.title || "未命名作品"
      const currentWorkId = useEditorStore.getState().workId
      if (currentWorkId) {
        await updateWorkInfoReq(currentWorkId, {
          title: titleLine,
          stage: "final",
        })
      }
      setWorkInfo({
        title: titleLine,
        stage: "final",
      })
      await saveEditorData("1")
    } else if (data.saveTarget == 'new') {
      try {
        const newWorkIdReq = await createWorkReq()
        if (!newWorkIdReq.id) {
          toast.error('保存失败')
          return
        }
        const titleLine = data.story?.title || "未命名作品"
        const updateReq = await updateWorkInfoReq(newWorkIdReq.id, {
          title: titleLine,
          stage: "final",
        })
        const updateVersionReq = await updateWorkVersionReq(
          newWorkIdReq.id,
          JSON.stringify(nextServerData),
          '0'
        )
        toast.success('保存成功')

      } catch (e) {
        console.error(e)
      }
    }
    setStepCreateDialogShow(false)

  }, [setWorkInfo, setServerData, setCurrentEditingId, saveEditorData])

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

      {/* 始终挂载，用 visibility + opacity/transform 控制显隐与过渡，避免条件渲染导致过渡无法触发 */}
      <div
        className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
        style={{
          contain: "layout style paint",
          willChange: "transform, opacity",
          visibility: isQuickStartMounted ? "visible" : "hidden",
        }}
        aria-hidden={!isQuickStartMounted}
      >
        <div
          className={`
            pointer-events-none flex h-full flex-col-reverse items-center pb-5 pt-2
            transform-gpu
          `}
          style={{
            transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease-out",
            transform: isQuickStartActive ? "translate3d(0, 0, 0)" : "translate3d(0, 28px, 0)",
            opacity: isQuickStartActive ? 1 : 0,
          }}
        >
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
                className="pointer-events-auto flex h-[136px] w-40 cursor-pointer flex-col items-center justify-center rounded-[10px] border border-[#e6e6e5] bg-white p-4 transition-colors duration-200 hover:border-(--theme-color)"
              >
                <div className="h-[50px] w-full bg-white">
                  <img src={m.cover} alt="" className="h-full w-full object-cover"/>
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
