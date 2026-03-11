"use client"

import React, { useCallback, useImperativeHandle, useRef, useState, useEffect, useMemo } from "react"
import { StepCreateDialog, type StepCreateDialogRef } from "./components/StepCreateDialog"
import { CreateRecommendDialog } from "./components/CreateRecommendDialog"
import type { StepSaveData, Mode, CharacterCardData, Template } from "./types"
import type { FileTreeNode } from "@/stores/editorStore/types"
import customCoverImg from "@/assets/images/step_create/custom-cover.png"
import templateCoverImg from "@/assets/images/step_create/template-cover.png"
import tagCoverImg from "@/assets/images/step_create/tag-cover.png"
import { useEditorStore } from "@/stores/editorStore"
import { createWorkReq, updateWorkInfoReq, updateWorkVersionReq } from "@/api/works"
import { toast } from "sonner";
import { trackEvent } from "@/matomo/trackingMatomoEvent.ts";

const CUSTOM_COVER = customCoverImg as string
const TEMPLATE_COVER = templateCoverImg as string
const TAG_COVER = tagCoverImg as string

const MODES = [
  { mode: "custom", title: "自定义短篇创作", desc: "详细制定你的内容方向，并进行导语→故事→角色→章节的完整创作链", cover: CUSTOM_COVER },
  { mode: "template", title: "使用模板创作", desc: "选择热门模板创作，套用核心梗，助力创作爆款小说", cover: TEMPLATE_COVER },
  { mode: "tag", title: "使用标签创作", desc: "选择标签自由获取灵感脑洞，让创作的思维肆意挥洒", cover: TAG_COVER },
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

const calculateTotalMdContentLength = (nodes: FileTreeNode[]): number => {
  let totalLength = 0
  const traverse = (node: FileTreeNode) => {
    if (node.fileType === "md" && node.content) {
      const textContent = node.content.replace(/<[^>]*>/g, "").trim()
      totalLength += textContent.length
    }
    if (node.children?.length) {
      node.children.forEach(traverse)
    }
  }
  nodes.forEach(traverse)
  return totalLength
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
  const [showQuickStart, setShowQuickStart] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const showDelayTimerRef = useRef<number | null>(null)
  const isAnimatingRef = useRef(false)
  const hasInitializedQuickStartRef = useRef(false)
  const initialQuickStartTimerRef = useRef<number | null>(null)
  const throttleTimerRef = useRef<number | null>(null)
  const pendingTotalLengthRef = useRef<number | null>(null)

  const setWorkInfo = useEditorStore((s) => s.setWorkInfo)
  const setServerData = useEditorStore((s) => s.setServerData)
  const setCurrentEditingId = useEditorStore((s) => s.setCurrentEditingId)
  const saveEditorData = useEditorStore((s) => s.saveEditorData)
  const setNewNodeIds = useEditorStore((s) => s.setNewNodeIds)
  const currentEditingId = useEditorStore((s) => s.currentEditingId)
  const treeData = useEditorStore((s) => s.treeData)
  const totalMdContentLength = useMemo(() => calculateTotalMdContentLength(treeData), [treeData])
  const applyQuickStartStatus = useCallback((totalLength: number) => {
    if (isAnimatingRef.current) return
    if (showDelayTimerRef.current) {
      window.clearTimeout(showDelayTimerRef.current)
      showDelayTimerRef.current = null
    }
    if (totalLength === 0) {
      setShowQuickStart(false)
      isAnimatingRef.current = true
      setIsAnimating(true)
      showDelayTimerRef.current = window.setTimeout(() => {
        setShowQuickStart(true)
        showDelayTimerRef.current = null
      }, 200)
      return
    }
    setShowQuickStart(false)
    isAnimatingRef.current = false
    setIsAnimating(false)
  }, [])

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
    trackEvent('Guided Writing', 'Start', 'Tag Write from Popup')
    setRecommendDialogShow(false)
    setStepCreateDialogShow(true)
    requestAnimationFrame(() => {
      stepCreateDialogRef.current?.startMode("tag")
    })
  }, [])

  const handleCreateTemplate = useCallback((template: Template) => {
    trackEvent('Guided Writing', 'Start', 'Template Write from Popup')
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

  useEffect(() => {
    initialQuickStartTimerRef.current = window.setTimeout(() => {
      hasInitializedQuickStartRef.current = true
      applyQuickStartStatus(calculateTotalMdContentLength(useEditorStore.getState().treeData))
      initialQuickStartTimerRef.current = null
    }, 300)
    return () => {
      if (initialQuickStartTimerRef.current) {
        window.clearTimeout(initialQuickStartTimerRef.current)
        initialQuickStartTimerRef.current = null
      }
    }
  }, [applyQuickStartStatus])

  useEffect(() => {
    if (!hasInitializedQuickStartRef.current) return
    if (throttleTimerRef.current === null) {
      applyQuickStartStatus(totalMdContentLength)
      throttleTimerRef.current = window.setTimeout(() => {
        throttleTimerRef.current = null
        if (pendingTotalLengthRef.current === null) return
        const nextTotalLength = pendingTotalLengthRef.current
        pendingTotalLengthRef.current = null
        applyQuickStartStatus(nextTotalLength)
      }, 400)
      return
    }
    pendingTotalLengthRef.current = totalMdContentLength
  }, [currentEditingId, totalMdContentLength, applyQuickStartStatus])

  useEffect(() => {
    return () => {
      if (initialQuickStartTimerRef.current) {
        window.clearTimeout(initialQuickStartTimerRef.current)
        initialQuickStartTimerRef.current = null
      }
      if (throttleTimerRef.current) {
        window.clearTimeout(throttleTimerRef.current)
        throttleTimerRef.current = null
      }
      pendingTotalLengthRef.current = null
      if (showDelayTimerRef.current) {
        window.clearTimeout(showDelayTimerRef.current)
        showDelayTimerRef.current = null
      }
      isAnimatingRef.current = false
      setIsAnimating(false)
    }
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
        setWorkInfo({
          title: titleLine,
          stage: "final",
        })
        setNewNodeIds(['大纲.md','设定/角色设定.md','设定/故事设定.md','正文/第一章.md'])
      }
      await saveEditorData("1")
    } else if (data.saveTarget == 'new') {
      try {
        const newWorkIdReq = await createWorkReq()
        if (!newWorkIdReq.id) {
          toast.error('保存失败')
          return
        }
        const titleLine = data.story?.title || "未命名作品"
        setWorkInfo({
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

  }, [setServerData, setCurrentEditingId, saveEditorData, setWorkInfo, setNewNodeIds])

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

      {showQuickStart ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[230px] overflow-hidden"
          aria-hidden
        >
          <div
            className="flex h-full flex-col-reverse items-center pb-5 pt-2"
          style={{
            contain: "layout style paint",
            willChange: "transform, opacity",
            animation: "quick-start-enter 200ms ease-out forwards",
          }}
          onAnimationEnd={() => {
            isAnimatingRef.current = false
            setIsAnimating(false)
          }}
          >
            <div className="pointer-events-none flex items-center justify-center gap-4">
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
                  className="pointer-events-auto flex w-40 cursor-pointer flex-col items-center justify-center rounded-[10px] border border-[#e6e6e5] bg-white p-4 transition-colors duration-200 hover:border-(--theme-color)"
                >
                  <div className="w-full bg-white">
                    <img src={m.cover} alt="" className="h-12 w-full object-cover" />
                  </div>
                  <div className="mt-2 h-[18px] text-base font-medium">{m.title}</div>
                  <div className="mt-2 text-[8px] text-[#9a9a9a] line-clamp-2">{m.desc}</div>
                </div>
              ))}
            </div>
            <div className="mb-2 w-full text-center text-sm">不知道怎么开始？试试以下快捷创作流程：</div>
            <style>{`
              @keyframes quick-start-enter {
                from { opacity: 0; transform: translateY(50px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>
          </div>
        </div>
      ) : null}
    </>
  )
})
