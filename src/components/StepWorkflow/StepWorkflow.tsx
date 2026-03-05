"use client"

import React, { useCallback, useImperativeHandle, useRef, useState, useEffect } from "react"
import { StepCreateDialog, type StepCreateDialogRef } from "./components/StepCreateDialog"
import type { StepSaveData, Mode, CharacterCardData } from "./types"
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
}

export interface StepWorkflowProps {
  /** 兼容历史参数（当前展示判断已切换为基于 serverData） */
  totalMdContentLength?: number
  /** 兼容历史参数（当前展示判断已切换为基于 serverData） */
  isEditorEmpty?: boolean
  /** 当前编辑中的文件 id，变化时重算快捷入口 */
  currentEditingId?: string | null
  /** 步骤创建完成：保存到当前作品后的回调（React 侧需自行更新 sidebar/editor 等） */
  onStepConfirm?: (data: StepSaveData) => void
}

export const StepWorkflow = React.forwardRef<StepWorkflowRef, StepWorkflowProps>(function StepWorkflow(
  {
    totalMdContentLength: _totalMdContentLength = 0,
    isEditorEmpty: _isEditorEmpty,
    currentEditingId,
    onStepConfirm,
  },
  ref
) {
  const [stepCreateDialogShow, setStepCreateDialogShow] = useState(false)
  const stepCreateDialogRef = useRef<StepCreateDialogRef>(null)
  const [enterActive, setEnterActive] = useState(false)
  const [enterSeed, setEnterSeed] = useState(0)

  const serverData = useEditorStore((s) => s.serverData)
  const setWorkInfo = useEditorStore((s) => s.setWorkInfo)
  const setServerData = useEditorStore((s) => s.setServerData)
  const setCurrentEditingId = useEditorStore((s) => s.setCurrentEditingId)
  const saveEditorData = useEditorStore((s) => s.saveEditorData)
  const hasContentOutsideKnowledgeBase = (key: string, value: string) => {
    if (!value || value.trim().length === 0) return false
    return !key.startsWith("知识库/")
  }
  const showQuickStart = !Object.entries(serverData).some(([key, value]) =>
    hasContentOutsideKnowledgeBase(key, value)
  )

  useImperativeHandle(ref, () => ({
    openStepCreateDialog: () => setStepCreateDialogShow(true),
  }), [])

  const handleStartItemClick = useCallback((mode: string) => {
    setStepCreateDialogShow(true)
    stepCreateDialogRef.current?.startMode(mode as Mode)
  }, [])

  useEffect(() => {
    if (showQuickStart) {
      setEnterActive(false)
      // 双 rAF：确保浏览器先绘制 enter-from（opacity-0 translate-y-50），再切到 enter-to，过渡才会生效
      let raf2 = 0
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setEnterActive(true))
      })
      return () => {
        cancelAnimationFrame(raf1)
        if (raf2) cancelAnimationFrame(raf2)
      }
    }
    setEnterActive(false)
  }, [showQuickStart, enterSeed])

  // 与 Vue 版本行为保持一致：切换编辑目标且内容为空时，重触发一次进入动画
  useEffect(() => {
    if (showQuickStart) setEnterSeed((v) => v + 1)
  }, [currentEditingId, showQuickStart])

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
          visibility: showQuickStart ? "visible" : "hidden",
        }}
        aria-hidden={!showQuickStart}
      >
        <div
          className={`
            pointer-events-none flex h-full flex-col-reverse items-center pb-5 pt-2
            transform-gpu
          `}
          style={{
            transition: "transform 240ms ease-out, opacity 160ms ease-out",
            transform: showQuickStart && enterActive ? "translate3d(0, 0, 0)" : "translate3d(0, 56px, 0)",
            opacity: showQuickStart ? 1 : 0,
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
