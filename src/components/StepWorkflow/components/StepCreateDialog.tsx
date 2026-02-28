"use client"

import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import clsx from "clsx"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  VisuallyHidden,
} from "@/components/ui/Dialog"
import { Button } from "@/components/ui/Button"
import { FormRecommendLabel } from "@/components/ui/FormRecommendLabel"
import { getTemplatesReq, getCharacterSettings, getStoriesReq } from "@/api/generate-dialog"
import { postTemplateStream } from "@/api/writing-templates"
import { useOptionsStore } from "@/stores/options"
import type { PostStreamData } from "@/api"
import { showStepConfirmDialog } from "./showStepConfirmDialog"
import { CustomSteps } from "./CustomSteps"
import { CharacterCard } from "./CharacterCard"
import { TemplateCardItem } from "../TemplateCardItem"
import { MarkdownEditor, type MarkdownEditorRef } from "@/components/MarkdownEditor"
import type {
  Mode,
  Template,
  CharacterCardData,
  StoryStorm,
  StepSaveData,
  Tag,
} from "../types"

/**
 * 模式封面图：用 import 引入，Vite 会打包并输出正确 URL。
 * 请将 Vue 项目 src/assets/images/step_create/ 下的三张图复制到：
 * react-app/src/assets/images/step_create/custom-cover.png
 * react-app/src/assets/images/step_create/template-cover.png
 * react-app/src/assets/images/step_create/tag-cover.png
 */
import customCoverImg from "@/assets/images/step_create/custom-cover.png"
import templateCoverImg from "@/assets/images/step_create/template-cover.png"
import tagCoverImg from "@/assets/images/step_create/tag-cover.png"

const CUSTOM_COVER = customCoverImg as string
const TEMPLATE_COVER = templateCoverImg as string
const TAG_COVER = tagCoverImg as string

const STEPS = ["选择创作方式", "确定内容", "选择故事", "选择主角", "创作大纲"]
const STEPS_CUSTOM = ["选择创作方式", "自定义设定", "选择故事", "选择主角", "创作大纲"]
const STEPS_TEMPLATE = ["选择创作方式", "选择模板", "选择故事", "选择主角", "创作大纲"]
const STEPS_TAG = ["选择创作方式", "选择标签", "选择故事", "选择主角", "创作大纲"]

const EMPTY_STORY: StoryStorm = { title: "", intro: "", theme: "" }
const EMPTY_CHARACTER: CharacterCardData = {
  name: "",
  gender: "",
  age: "",
  bloodType: "",
  mbti: "",
  experiences: "",
  personality: "",
  abilities: "",
  identity: "",
}

// 深拷贝（与 Vue 侧实现一致）
const deepClone = <T,>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj))
}

export interface StepCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm?: (data: StepSaveData) => void
  workId?: string
}

export interface StepCreateDialogRef {
  handleModeClick: (mode: Mode) => void
  handleTemplateClick: (template: Template) => void
  nextStepConfirm: () => void
  /** 用于外部（如创作推荐弹窗）直接进入“选择内容”步骤 */
  startMode: (mode: Mode) => void
  /** 用于外部选择模板后直接进入“选择故事”（stepActive=2） */
  startTemplateCreate: (template: Template) => void
}

const MODES = [
  { mode: "custom" as Mode, title: "自定义短篇创作", desc: "详细制定你的内容方向，并进行导语→故事→角色→章节的完整创作链", cover: CUSTOM_COVER },
  { mode: "template" as Mode, title: "使用模板创作", desc: "选择热门模板创作，套用核心梗，助力创作爆款小说", cover: TEMPLATE_COVER },
  { mode: "tag" as Mode, title: "使用标签创作", desc: "选择标签自由获取灵感脑洞，让创作的思维肆意挥洒", cover: TAG_COVER },
]

/** 将 store 的 string[] 转为 FormRecommendLabel 需要的 { label, value }[] */
const toRecommendItems = (arr: string[]): { label: string; value: string }[] =>
  (arr ?? []).map((s) => ({ label: s, value: s }))

export const StepCreateDialog = React.forwardRef<
  StepCreateDialogRef,
  StepCreateDialogProps
>(function StepCreateDialog(
  { open, onOpenChange, onConfirm, workId = "" },
  ref
) {
  const { recommendConfig, updateRecommendConfig } = useOptionsStore()

  const [stepActive, setStepActive] = useState(0)
  const [steps, setSteps] = useState<string[]>(STEPS)
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [selectedTags, setSelectedTags] = useState<Tag[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [stories, setStories] = useState<StoryStorm[]>([EMPTY_STORY, EMPTY_STORY, EMPTY_STORY])
  const [selectedStory, setSelectedStory] = useState<StoryStorm | null>(null)
  const [characters, setCharacters] = useState<CharacterCardData[]>([
    EMPTY_CHARACTER,
    EMPTY_CHARACTER,
    EMPTY_CHARACTER,
  ])
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterCardData | null>(null)
  const [outlineContent, setOutlineContent] = useState("")
  const [isOutlineEditing, setIsOutlineEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  // 自定义表单模型（对齐 Vue formModel）
  const [formModel, setFormModel] = useState({
    prompt: "官方提供-专业短篇小说写作30年",
    coreMeme: "",
    background: "",
    persona: "",
    wordCount: "",
    perspective: "",
  })
  // 流式大纲 AbortController
  const outlineStreamAbortControllerRef = useRef<AbortController | null>(null)
  // 当前步骤快照（与 Vue 的 currentStepStates 对应）
  const [stepSnapshots, setStepSnapshots] = useState<(unknown | null)[]>([null, null, null, null, null])
  // 历史步骤快照（与 Vue 的 historyStepStates 对应）
  const [historyStepSnapshots, setHistoryStepSnapshots] = useState<(unknown | null)[]>([null, null, null, null, null])
  const markdownEditorRef = useRef<MarkdownEditorRef | null>(null)
  const storyAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (selectedMode === "template") setSteps(STEPS_TEMPLATE)
    else if (selectedMode === "tag") setSteps(STEPS_TAG)
    else if (selectedMode === "custom") setSteps(STEPS_CUSTOM)
    else setSteps(STEPS)
  }, [selectedMode])

  // 弹窗打开时拉取推荐配置（与 Vue optionsStore.updateConfig 一致）
  useEffect(() => {
    if (open) void updateRecommendConfig()
  }, [open, updateRecommendConfig])

  const updateStepSnapshot = useCallback((index: number, snapshot: unknown) => {
    setStepSnapshots((prev) => {
      const next = [...prev]
      next[index] = snapshot
      for (let j = index + 1; j < next.length; j++) next[j] = null
      return next
    })
  }, [])

  // 自定义表单变更时更新步骤1快照（与 Vue watch formModel 一致）
  useEffect(() => {
    if (formModel.coreMeme && formModel.background && formModel.persona) {
      updateStepSnapshot(1, formModel)
    } else {
      updateStepSnapshot(1, null)
    }
  }, [formModel.coreMeme, formModel.background, formModel.persona, updateStepSnapshot])

  const isStepAccessible = useCallback((stepIndex: number) => {
    if (stepIndex === 0) return true
    return stepSnapshots[stepIndex - 1] != null
  }, [stepSnapshots])

  const stepAccessibleList = steps.map((_, i) =>
    i <= stepActive ? true : isStepAccessible(i)
  )

  // 进入下一步前：把 current 同步到 history
  const syncHistoryIfChanged = useCallback(() => {
    setHistoryStepSnapshots((prev) => {
      if (prev[stepActive] !== stepSnapshots[stepActive]) {
        return deepClone(stepSnapshots)
      }
      return prev
    })
  }, [stepActive, stepSnapshots])

  // 是否可以进入下一步（完全对齐 Vue 的 nextStepAble）
  const nextStepAble = useMemo(() => {
    const currentStep = stepActive
    if (currentStep === 0) {
      return !!selectedMode
    } else if (currentStep === 1) {
      if (selectedMode === "template") {
        return !!selectedTemplate
      } else if (selectedMode === "tag") {
        return selectedTags.length > 0
      } else if (selectedMode === "custom") {
        return !!(formModel.coreMeme && formModel.background && formModel.persona)
      }
      return false
    } else if (currentStep === 2) {
      return !!selectedStory
    } else if (currentStep === 3) {
      return !!selectedCharacter
    } else if (currentStep === 4) {
      if (loading) return false
      return true
    }
    return true
  }, [stepActive, selectedMode, selectedTemplate, selectedTags, selectedStory, selectedCharacter, loading])

  // 下一步/保存至作品（与 Vue nextStepConfirm 一致，Footer 与 ref 共用）
  const handleNextStepConfirm = useCallback(() => {
    syncHistoryIfChanged()
    if (stepActive === 0 && selectedMode) {
      setStepActive(1)
      return
    }
    if (stepActive === 1) {
      setStepActive(2)
      return
    }
    if (stepActive === 2) {
      setStepActive(3)
      return
    }
    if (stepActive === 3) {
      setStepActive(4)
      return
    }
    if (stepActive === 4) {
      const outline = markdownEditorRef.current?.getMarkdown?.() ?? outlineContent
      const description =
        selectedMode === "template"
          ? selectedTemplate?.description ?? ""
          : selectedMode === "tag"
          ? selectedTags.map((t) => t.name).join(",")
          : selectedMode === "custom"
          ? [formModel.coreMeme, formModel.background, formModel.persona].filter(Boolean).join(";")
          : ""
      onConfirm?.({
        mode: selectedMode,
        template: selectedTemplate,
        tags: selectedTags,
        character: selectedCharacter,
        story: selectedStory,
        outline,
        description,
      })
      onOpenChange(false)
    }
  }, [
    stepActive,
    selectedMode,
    selectedTemplate,
    selectedTags,
    formModel,
    selectedCharacter,
    selectedStory,
    outlineContent,
    onConfirm,
    onOpenChange,
    syncHistoryIfChanged,
  ])

  useImperativeHandle(ref, () => ({
    handleModeClick(mode: Mode) {
      setSelectedMode(mode)
      setStepActive(0)
      updateStepSnapshot(0, mode)
    },
    handleTemplateClick(template: Template) {
      setSelectedTemplate(template)
      updateStepSnapshot(1, template)
    },
    nextStepConfirm() {
      handleNextStepConfirm()
    },
    startMode(mode: Mode) {
      setSelectedMode(mode)
      updateStepSnapshot(0, mode)
      setStepActive(1)
    },
    startTemplateCreate(template: Template) {
      setSelectedMode("template")
      setSelectedTemplate(template)
      updateStepSnapshot(0, "template")
      updateStepSnapshot(1, template)
      setStepActive(2)
    },
  }), [
    handleNextStepConfirm,
    updateStepSnapshot,
  ])

  const handleStepClick = useCallback(
    (stepIndex: number) => {
      if (stepIndex === stepActive) return
      if (stepIndex > stepActive && !isStepAccessible(stepIndex)) return
      // 与 Vue onStepClick 一致：若当前步快照与历史不一致则先同步
      if (stepSnapshots[stepActive] !== historyStepSnapshots[stepActive]) {
        setHistoryStepSnapshots(deepClone(stepSnapshots))
      }
      setStepActive(stepIndex)
    },
    [stepActive, stepSnapshots, historyStepSnapshots, isStepAccessible]
  )

  const handleModeClick = useCallback((mode: Mode) => {
    setSelectedMode(mode)
    updateStepSnapshot(0, mode)
  }, [updateStepSnapshot])

  const handleTemplateClick = useCallback((template: Template) => {
    setSelectedTemplate(template)
    updateStepSnapshot(1, template)
  }, [updateStepSnapshot])

  const handleSelectStory = useCallback((story: StoryStorm) => {
    if (story === selectedStory) return
    if (!story?.title && !story?.intro) return
    setSelectedStory(story)
    updateStepSnapshot(2, story)
  }, [selectedStory, updateStepSnapshot])

  const handleSelectRecommend = useCallback((key: string, value: string) => {
    setFormModel((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleBack = useCallback(() => {
    if (stepActive > 0) setStepActive(stepActive - 1)
  }, [stepActive])

  const handleClose = useCallback(async () => {
    if (selectedStory || selectedCharacter) {
      try {
        const result = await showStepConfirmDialog()
        if (result === "cancel") {
          onOpenChange(false)
          return
        }
        if (result === "saveToCurrent" || result === "saveToNew") {
          const outline =
            markdownEditorRef.current?.getMarkdown?.() ?? outlineContent
          onConfirm?.({
            mode: selectedMode,
            template: selectedTemplate,
            tags: selectedTags,
            character: selectedCharacter,
            story: selectedStory,
            outline,
            description: "",
          })
          onOpenChange(false)
        }
      } catch {
        onOpenChange(false)
      }
    } else {
      onOpenChange(false)
    }
  }, [
    selectedStory,
    selectedCharacter,
    outlineContent,
    selectedMode,
    selectedTemplate,
    selectedTags,
    onOpenChange,
    onConfirm,
  ])

  useEffect(() => {
    if (!open) return
    const load = async () => {
      try {
        const res: any = await getTemplatesReq()
        if (Array.isArray(res?.content)) {
          setTemplates(
            res.content.map((item: any) => ({
              id: String(item.id),
              title: item.title || "",
              description: item.content || "",
              usageCount: item.numberOfUses ?? 0,
              tags: item.tags?.map((t: any) => ({ name: t?.name, id: t?.id, category: t?.category })) ?? [],
            }))
          )
        }
      } catch {}
    }
    load()
  }, [open])

  const updateStories = useCallback(async () => {
    if (storyAbortRef.current) storyAbortRef.current.abort()
    const controller = new AbortController()
    storyAbortRef.current = controller
    setStories([EMPTY_STORY, EMPTY_STORY, EMPTY_STORY])
    setSelectedStory(null)
    setLoading(true)
    let description = ""
    let tagIds: string[] = []
    if (selectedMode === "tag") {
      description = selectedTags.map((t) => t.name).join(",")
      tagIds = selectedTags.map((t) => String(t.id))
    } else if (selectedMode === "template" && selectedTemplate) {
      description = selectedTemplate.description
      // 与 Vue 一致：模板模式下传入模板自带的 tags
      tagIds = (selectedTemplate.tags ?? []).map((t) => String(t.id))
    } else if (selectedMode === "custom") {
      description = [formModel.coreMeme, formModel.background, formModel.persona].filter(Boolean).join(";")
    }
    try {
      const res: any = await getStoriesReq(
        { templateContent: description, tagIds },
        { signal: controller.signal }
      )
      if (controller.signal.aborted) return
      const list = Array.isArray(res) ? res : []
      setStories(
        [0, 1, 2].map((i) => {
          const item = list[i]
          return item
            ? { title: item.title || item.name || "彩蛋", intro: item.story || "这是彩蛋，没有故事设定~", theme: "" }
            : EMPTY_STORY
        })
      )
    } catch (e: any) {
      if (e?.name === "AbortError" || e?.code === "ERR_CANCELED") return
      setStories([EMPTY_STORY, EMPTY_STORY, EMPTY_STORY])
    } finally {
      setLoading(false)
      storyAbortRef.current = null
    }
  }, [selectedMode, selectedTemplate, selectedTags, formModel.coreMeme, formModel.background, formModel.persona])

  useEffect(() => {
    if (!open || stepActive !== 2 || !selectedMode) return
    updateStories()
  }, [open, stepActive, selectedMode, updateStories])

  const updateCharacters = useCallback(async () => {
    if (!selectedStory?.title) return
    setLoading(true)
    setCharacters([EMPTY_CHARACTER, EMPTY_CHARACTER, EMPTY_CHARACTER])
    setSelectedCharacter(null)
    const desc =
      selectedMode === "template"
        ? selectedTemplate?.description ?? ""
        : selectedMode === "tag"
        ? selectedTags.map((t) => t.name).join(",")
        : [formModel.coreMeme, formModel.background, formModel.persona].filter(Boolean).join(";")
    try {
      const req: any = await getCharacterSettings({
        workType: "editor",
        description: desc,
        brainStorm: { title: selectedStory.title, intro: selectedStory.intro },
      })
      const list = Array.isArray(req?.roleCards) ? req.roleCards : []
      setCharacters(
        [0, 1, 2].map((i) => {
          const item = list[i]
          return item
            ? {
                name: item.name ?? "",
                gender: item.gender ?? "",
                age: item.age ?? "",
                bloodType: item.bloodType ?? "",
                mbti: item.mbti ?? "",
                experiences: item.experiences ?? "",
                personality: item.personality ?? "",
                abilities: item.abilities ?? "",
                identity: item.identity ?? "",
              }
            : EMPTY_CHARACTER
        })
      )
    } catch {
      setCharacters([EMPTY_CHARACTER, EMPTY_CHARACTER, EMPTY_CHARACTER])
    } finally {
      setLoading(false)
    }
  }, [selectedStory, selectedMode, selectedTemplate, selectedTags, formModel.coreMeme, formModel.background, formModel.persona])

  useEffect(() => {
    if (!open || stepActive !== 3 || !selectedStory?.title) return
    updateCharacters()
  }, [open, stepActive, selectedStory, updateCharacters])

  const handleCharacterClick = useCallback((c: CharacterCardData) => {
    if (!c.name) return
    setSelectedCharacter(c)
    updateStepSnapshot(3, c)
  }, [updateStepSnapshot])

  const updateOutlineStream = useCallback(() => {
    if (!selectedStory?.title || !selectedCharacter?.name) return
    if (outlineStreamAbortControllerRef.current) outlineStreamAbortControllerRef.current.abort()
    const controller = new AbortController()
    outlineStreamAbortControllerRef.current = controller
    setOutlineContent("")
    setLoading(true)
    const onData = (data: PostStreamData) => {
      if (data.event === "messages/partial" && Array.isArray(data.data) && data.data.length > 0) {
        const first = data.data[0]
        const text = first?.content?.[0]?.text
        if (text != null) setOutlineContent(text)
      }
    }
    postTemplateStream(
      {
        workId: workId || "0",
        targetStage: "outline",
        brainStorm: { title: selectedStory.title, intro: selectedStory.intro },
        roleCard: selectedCharacter,
        chapterNumber: 10,
      },
      onData,
      () => {
        setLoading(false)
        outlineStreamAbortControllerRef.current = null
      },
      () => {
        setLoading(false)
        outlineStreamAbortControllerRef.current = null
      },
      { signal: controller.signal }
    )
  }, [workId, selectedStory, selectedCharacter])

  useEffect(() => {
    if (!open || stepActive !== 4 || !selectedStory?.title || !selectedCharacter?.name) return
    setIsOutlineEditing(false)
    updateOutlineStream()
  }, [open, stepActive, selectedStory, selectedCharacter, updateOutlineStream])

  // 关闭时重置状态（与 Vue initDialog 一致）
  useEffect(() => {
    if (!open) {
      setStepActive(0)
      setSteps(STEPS)
      setSelectedMode(null)
      setSelectedTemplate(null)
      setSelectedTags([])
      setFormModel({
        prompt: "官方提供-专业短篇小说写作30年",
        coreMeme: "",
        background: "",
        persona: "",
        wordCount: "",
        perspective: "",
      })
      setStories([EMPTY_STORY, EMPTY_STORY, EMPTY_STORY])
      setSelectedStory(null)
      setCharacters([EMPTY_CHARACTER, EMPTY_CHARACTER, EMPTY_CHARACTER])
      setSelectedCharacter(null)
      setOutlineContent("")
      setIsOutlineEditing(false)
      setLoading(false)
      setStepSnapshots([null, null, null, null, null])
      setHistoryStepSnapshots([null, null, null, null, null])
      if (storyAbortRef.current) {
        storyAbortRef.current.abort()
        storyAbortRef.current = null
      }
      if (outlineStreamAbortControllerRef.current) {
        outlineStreamAbortControllerRef.current.abort()
        outlineStreamAbortControllerRef.current = null
      }
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={clsx(
          "flex max-h-[80vh] w-full max-w-[95vw] flex-col overflow-hidden rounded-[10px] p-0 sm:w-[1020px] sm:!max-w-[1020px]",
          "left-1/2 top-[10vh] -translate-x-1/2 translate-y-0"
        )}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <VisuallyHidden>
          <DialogTitle>创建作品</DialogTitle>
        </VisuallyHidden>
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header：与 Vue 一致 - 绝对定位的返回/关闭 + 居中步骤条 */}
          <header className="relative flex w-full justify-center px-8 pt-4 pb-0">
            {stepActive !== 0 ? (
              <button
                type="button"
                onClick={handleBack}
                className="absolute left-6 top-5 flex h-8 w-8 cursor-pointer items-center justify-center rounded bg-transparent p-0 transition-colors hover:text-[var(--el-color-primary)]"
                aria-label="返回"
              >
                <span className="text-[28px] text-[var(--el-text-color-secondary)] [font-family:iconfont]">
                  &#xe62a;
                </span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleClose}
              className="absolute right-6 top-5 flex h-8 w-8 cursor-pointer items-center justify-center rounded bg-transparent p-0 transition-colors hover:text-[var(--el-color-primary)]"
              aria-label="关闭"
            >
              <span className="text-[28px] text-[var(--el-text-color-secondary)] [font-family:iconfont]">
                &#xe633;
              </span>
            </button>
            <div className="w-full max-w-[550px]">
              <CustomSteps
                active={stepActive}
                steps={steps}
                stepAccessible={stepAccessibleList}
                maxWidth={550}
                onStepClick={handleStepClick}
              />
            </div>
          </header>

          {/* Body：与 Vue dialog-body-wrapper + el-dialog__body 一致 */}
          <div className="relative flex min-h-0 flex-1 flex-col overflow-auto px-6 pb-3 pt-4">
            {stepActive === 0 && (
              <div className="step-content step-mode flex min-h-[540px] flex-wrap items-center justify-center gap-6">
                {MODES.map((m) => (
                  <button
                    key={m.mode}
                    type="button"
                    onClick={() => handleModeClick(m.mode)}
                    className={clsx(
                      "mode-item flex h-[204px] w-[240px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 p-5 transition-colors",
                      selectedMode === m.mode
                        ? "border-[var(--theme-color)]"
                        : "border-[#e6e6e5] hover:border-[var(--theme-color)]"
                    )}
                  >
                    <div className="mode-cover h-[76px] w-full overflow-hidden rounded bg-white">
                      <img src={m.cover} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="mode-title h-[26px] text-[22px] font-medium leading-none">
                      {m.title}
                    </div>
                    <div className="mode-desc text-xs text-[#9a9a9a]">{m.desc}</div>
                  </button>
                ))}
              </div>
            )}

            {stepActive === 1 && selectedMode === "template" && (
              <div className="step-template step-content min-h-[540px]">
                <div className="h-[50px] flex flex-row-reverse items-center" />
                <div className="template-group grid grid-cols-2 gap-4 overflow-y-auto sm:grid-cols-4">
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleTemplateClick(t)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          handleTemplateClick(t)
                        }
                      }}
                      className={clsx(
                        "grid-item flex h-[190px] cursor-pointer flex-col rounded-[20px] border-2 bg-white p-3 transition",
                        selectedTemplate?.id === t.id
                          ? "border-primary"
                          : "border-gray-200 hover:border-[var(--theme-color)]"
                      )}
                    >
                      <TemplateCardItem data={t} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stepActive === 1 && selectedMode === "custom" && (
              <div className="step-content step-custom min-h-[540px] w-full px-8 py-4">
                <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                  <div>
                    <label className="mb-2 block text-xl text-gray-800">提示词</label>
                    <input
                      className="w-full rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-gray-500"
                      value={formModel.prompt}
                      disabled
                      readOnly
                    />
                  </div>
                  <div>
                    <FormRecommendLabel
                      label="核心梗"
                      required
                      recommends={toRecommendItems(recommendConfig.coreMeme)}
                      fieldKey="coreMeme"
                      onSelect={handleSelectRecommend}
                    />
                    <textarea
                      className="mt-2 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-gray-800 placeholder:text-gray-400"
                      rows={2}
                      maxLength={200}
                      placeholder={'请填写核心冲突，如"为救家族签下替身协议后，发现金主竟是幼时白月光本尊"'}
                      value={formModel.coreMeme}
                      onChange={(e) => setFormModel((p) => ({ ...p, coreMeme: e.target.value }))}
                    />
                  </div>
                  <div>
                    <FormRecommendLabel
                      label="故事背景"
                      required
                      recommends={toRecommendItems(recommendConfig.background)}
                      fieldKey="background"
                      onSelect={handleSelectRecommend}
                    />
                    <textarea
                      className="mt-2 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-gray-800 placeholder:text-gray-400"
                      rows={2}
                      maxLength={200}
                      placeholder="请填写时代背景、故事场景、主要矛盾设定、金手指设定、故事发展阶段等信息"
                      value={formModel.background}
                      onChange={(e) => setFormModel((p) => ({ ...p, background: e.target.value }))}
                    />
                  </div>
                  <div>
                    <FormRecommendLabel
                      label="主角人设"
                      required
                      recommends={toRecommendItems(recommendConfig.persona)}
                      fieldKey="persona"
                      onSelect={handleSelectRecommend}
                    />
                    <input
                      className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-800 placeholder:text-gray-400"
                      maxLength={200}
                      placeholder="请填写男女主角年龄、性别、性格、目标和规划等信息"
                      value={formModel.persona}
                      onChange={(e) => setFormModel((p) => ({ ...p, persona: e.target.value }))}
                    />
                  </div>
                  <div>
                    <FormRecommendLabel
                      label="字数"
                      recommends={toRecommendItems(recommendConfig.wordCount)}
                      fieldKey="wordCount"
                      onSelect={handleSelectRecommend}
                    />
                    <input
                      className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-800 placeholder:text-gray-400"
                      maxLength={10}
                      placeholder="选填，默认10000字左右短篇"
                      value={formModel.wordCount}
                      onChange={(e) => setFormModel((p) => ({ ...p, wordCount: e.target.value }))}
                    />
                  </div>
                  <div>
                    <FormRecommendLabel
                      label="人称"
                      recommends={toRecommendItems(recommendConfig.perspective)}
                      fieldKey="perspective"
                      onSelect={handleSelectRecommend}
                    />
                    <input
                      className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-800 placeholder:text-gray-400"
                      maxLength={10}
                      placeholder="选填，默认第一人称"
                      value={formModel.perspective}
                      onChange={(e) => setFormModel((p) => ({ ...p, perspective: e.target.value }))}
                    />
                  </div>
                </form>
              </div>
            )}

            {stepActive === 1 && selectedMode === "tag" && (
              <div className="step-content tag-select-layout min-h-[540px] px-8 py-4">
                <div className="rounded-md border border-dashed border-gray-300 p-8 text-center text-gray-500">
                  标签选择器（TagSelector）待接入
                </div>
              </div>
            )}

            {stepActive === 2 && (
              <div className="story-step step-content flex min-h-[540px] flex-col gap-6">
                <div className="story-grid grid w-full grid-cols-3 gap-6 px-12">
                  {stories.map((s, i) => (
                    <div
                      key={i}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectStory(s)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          handleSelectStory(s)
                        }
                      }}
                      className={clsx(
                        "story-card flex h-[310px] flex-col gap-3 overflow-hidden rounded-xl bg-[#f9eece] p-5 transition",
                        selectedStory === s ? "outline outline-2 outline-[var(--theme-color)]" : "hover:outline hover:outline-2 hover:outline-[var(--theme-color)]"
                      )}
                    >
                      {(!s.title && !s.intro) || loading ? (
                        <div className="mt-2 flex flex-col gap-3">
                          <div className="h-6 w-3/5 animate-pulse rounded bg-gray-300" />
                          <div className="h-3 w-full animate-pulse rounded bg-gray-200" />
                          <div className="h-3 w-full animate-pulse rounded bg-gray-200" />
                          <div className="h-3 w-4/5 animate-pulse rounded bg-gray-200" />
                        </div>
                      ) : (
                        <>
                          <div className="book-title mt-2 line-clamp-2 text-xl font-semibold leading-tight text-black">
                            书名: 《{s.title || "未命名"}》
                          </div>
                          <div className="book-synopsis line-clamp-6 max-h-[220px] flex-1 overflow-hidden text-sm text-gray-700">
                            {s.intro}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <div className="footer-actions flex w-full justify-center">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={loading ? undefined : updateStories}
                    onKeyDown={(e) => {
                      if (!loading && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault()
                        updateStories()
                      }
                    }}
                    className={clsx(
                      "flex cursor-pointer items-center gap-2 text-[var(--bg-editor-save)]",
                      loading && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <span className={clsx("iconfont", loading && "animate-spin")}>&#xe66f;</span>
                    <span>换一批</span>
                  </div>
                </div>
              </div>
            )}

            {stepActive === 3 && (
              <div className="character-step step-content flex min-h-[540px] flex-col gap-6">
                <div className="character-grid flex w-full justify-center gap-6 px-12">
                  {characters.map((c, i) => (
                    <div
                      key={`${c.name}-${c.mbti}-${i}`}
                      className={clsx(
                        "character-card cursor-pointer",
                        selectedCharacter === c && "outline outline-2 outline-[var(--theme-color)]"
                      )}
                      onClick={() => handleCharacterClick(c)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          handleCharacterClick(c)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <CharacterCard data={c} loading={loading} onClick={() => {}} onEdit={() => {}} />
                    </div>
                  ))}
                </div>
                <div className="footer-actions flex w-full justify-center">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={loading ? undefined : updateCharacters}
                    onKeyDown={(e) => {
                      if (!loading && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault()
                        updateCharacters()
                      }
                    }}
                    className={clsx(
                      "flex cursor-pointer items-center gap-2 text-[var(--bg-editor-save)]",
                      loading && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <span className={clsx("iconfont", loading && "animate-spin")}>&#xe66f;</span>
                    <span>换一批</span>
                  </div>
                </div>
              </div>
            )}

            {stepActive === 4 && (
              <div className="step-outline step-content min-h-[540px] px-12 pt-6">
                <div
                  className={clsx(
                    "editor-layout rounded-lg bg-[#f9eece] pt-2",
                    isOutlineEditing && "outline outline-2 outline-[#ce644c]"
                  )}
                >
                  <div className="header px-2 text-3xl font-semibold leading-10 text-black">大纲</div>
                  <div className="markdown-editor-scrollbar max-h-[420px] overflow-y-auto">
                    <MarkdownEditor
                      ref={markdownEditorRef}
                      value={outlineContent}
                      onChange={setOutlineContent}
                      readonly={!isOutlineEditing || loading}
                      placeholder="正在生成大纲…"
                      loading={loading}
                    />
                  </div>
                </div>
                <div className="footer-actions mt-4 flex h-8 w-full justify-center gap-4">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={loading ? undefined : updateOutlineStream}
                    onKeyDown={(e) => {
                      if (!loading && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault()
                        updateOutlineStream()
                      }
                    }}
                    className={clsx(
                      "flex cursor-pointer items-center gap-2 text-[var(--bg-editor-save)]",
                      loading && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <span className={clsx("iconfont", loading && "animate-spin")}>&#xe66f;</span>
                    <span>重新生成</span>
                  </div>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={loading ? undefined : () => setIsOutlineEditing((v) => !v)}
                    onKeyDown={(e) => {
                      if (!loading && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault()
                        setIsOutlineEditing((v) => !v)
                      }
                    }}
                    className={clsx(
                      "flex cursor-pointer items-center gap-2 text-[var(--bg-editor-save)]",
                      loading && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <span className="iconfont">&#xea48;</span>
                    <span>{isOutlineEditing ? "完成编辑" : "编辑"}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer：与 Vue 一致 - 退出 + 下一步/保存至作品 */}
          <footer className="flex flex-row-reverse items-center gap-3 border-t border-gray-200 px-6 py-4">
            <div
              role="button"
              tabIndex={0}
              onClick={nextStepAble ? handleNextStepConfirm : undefined}
              onKeyDown={(e) => {
                if (nextStepAble && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault()
                  handleNextStepConfirm()
                }
              }}
              className={clsx(
                "inline-flex cursor-pointer items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors",
                nextStepAble
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "cursor-not-allowed bg-gray-200 text-gray-500"
              )}
            >
              {stepActive === 4 ? "保存至作品" : "下一步"}
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={handleClose}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  handleClose()
                }
              }}
              className="inline-flex cursor-pointer items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              退出
            </div>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  )
})
