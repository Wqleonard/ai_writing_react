import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { openDialog } from '@/lib/openDialog'
import clsx from 'clsx'
import { toast } from 'sonner'
import { useOptionsStore } from '@/stores/optionsStore'
import {
  addNewPrompt,
  postTestPromptStream,
  type AddNewPromptData,
  type ToolName,
} from '@/api/community-prompt'
import type { PostStreamData } from '@/api'
import { getContentFromPartial } from '@/utils/getWorkFlowPartialData'
import { AddConnectedFile } from '@/components/Community/AddConnectedFile'
import { Iconfont } from '../IconFont'
import { cn } from "@/lib/utils.ts";

export interface AddNewPromptsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit?: () => void
}

const STEPS = ['基本信息', '编辑提示词', '测试工具', '发布工具']

const getInitialFormData = (defaultIconUrl: string) => ({
  name: '',
  description: '',
  category: '',
  iconUrl: defaultIconUrl,
  systemPrompt: '',
  outputFormat: '',
  userExample: '',
  isPublic: false,
  generateOutput: '',
})

const getToolNameByCategoryId = (categoryId: string | number): ToolName => {
  const id = typeof categoryId === 'string' ? parseInt(categoryId, 10) : categoryId
  switch (id) {
    case 1:
      return 'brain_storm'
    case 2:
      return 'outline'
    case 3:
      return 'character'
    case 4:
      return 'worldview'
    case 5:
      return 'main_content'
    default:
      return 'brain_storm'
  }
}

export const AddNewPromptsDialog = ({
  open,
  onOpenChange,
  onSubmit,
}: AddNewPromptsDialogProps) => {
  const promptCategories = useOptionsStore((s) => s.promptCategories)
  const promptIconOptions = useOptionsStore((s) => s.promptIconOptions)
  const defaultIconUrl =
    (promptIconOptions[0]?.value != null ? String(promptIconOptions[0].value) : '') || ''

  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState(() => getInitialFormData(defaultIconUrl))
  const [isGenerating, setIsGenerating] = useState(false)
  const [mockUserDemo, setMockUserDemo] = useState('')
  const streamAbortControllerRef = useRef<AbortController | null>(null)

  const filteredPromptCategories = useMemo(
    () =>
      promptCategories.filter(
        (item, index) =>
          !(index === 0 && item.label === '全部' && (item.value === '' || item.value === undefined))
      ),
    [promptCategories]
  )

  const resetForm = useCallback(() => {
    if (streamAbortControllerRef.current) {
      streamAbortControllerRef.current.abort()
      streamAbortControllerRef.current = null
    }
    setIsGenerating(false)
    setFormData(getInitialFormData(defaultIconUrl))
    setCurrentStep(0)
    setMockUserDemo('')
  }, [defaultIconUrl])

  useEffect(() => {
    if (!open) resetForm()
  }, [open, resetForm])

  useEffect(() => {
    setFormData((d) => ({ ...d, iconUrl: defaultIconUrl }))
  }, [defaultIconUrl])

  /** 与 Vue canGoNext 一致 */
  const canGoNext = useMemo(() => {
    if (currentStep === 0) {
      return !!(
        formData.name.trim() &&
        formData.description.trim() &&
        formData.category
      )
    }
    if (currentStep === 1) {
      return !!formData.systemPrompt.trim()
    }
    return true
  }, [currentStep, formData.name, formData.description, formData.category, formData.systemPrompt])

  const isUserExampleSaved =
    formData.userExample === mockUserDemo && formData.userExample !== ''

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1)
  }

  const handleSubmit = useCallback(async () => {
    try {
      const params: AddNewPromptData = {
        name: formData.name,
        description: formData.description,
        iconUrl: formData.iconUrl + '',
        systemPrompt: formData.systemPrompt,
        outputFormat: formData.outputFormat,
        userExample: formData.userExample,
        isPublic: formData.isPublic,
        categoryIds: [formData.category],
      }
      await addNewPrompt(params)
      toast.success('创建成功')
      onOpenChange(false)
      onSubmit?.()
    } catch (err) {
      console.error('提交表单失败:', err)
      toast.error('创建失败')
    }
  }, [formData, onOpenChange, onSubmit])

  const handleSaveUserDemo = () => {
    setFormData((d) => ({ ...d, userExample: mockUserDemo }))
    toast.success('用户示例保存成功')
  }

  const handleStreamData = useCallback((data: PostStreamData) => {
    if (data.event === 'messages/partial' && data.data) {
      const content = getContentFromPartial(data.data)
      setFormData((d) => ({ ...d, generateOutput: content }))
    }
  }, [])

  const handleGenerateTest = useCallback(async () => {
    if (!formData.systemPrompt.trim()) {
      toast.warning('请输入系统提示词')
      return
    }
    if (!mockUserDemo.trim()) {
      toast.warning('请输入用户示例')
      return
    }
    if (!formData.category) {
      toast.warning('请选择提示词工具分类')
      return
    }
    if (streamAbortControllerRef.current) {
      streamAbortControllerRef.current.abort()
    }
    setFormData((d) => ({ ...d, generateOutput: '' }))
    setIsGenerating(true)
    streamAbortControllerRef.current = new AbortController()
    const signal = streamAbortControllerRef.current.signal
    const toolName = getToolNameByCategoryId(formData.category)
    try {
      await postTestPromptStream(
        {
          toolName,
          description: mockUserDemo,
          systemPrompt: formData.systemPrompt,
        },
        handleStreamData,
        (err) => {
          console.error('生成失败:', err)
          setIsGenerating(false)
          streamAbortControllerRef.current = null
          toast.error('生成失败，请重试')
        },
        () => {
          setIsGenerating(false)
          streamAbortControllerRef.current = null
        },
        { signal }
      )
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setIsGenerating(false)
        streamAbortControllerRef.current = null
        return
      }
      setIsGenerating(false)
      streamAbortControllerRef.current = null
      toast.error('生成失败，请重试')
    }
  }, [formData.systemPrompt, formData.category, mockUserDemo, handleStreamData])

  const handleCancelGenerate = () => {
    if (streamAbortControllerRef.current) {
      streamAbortControllerRef.current.abort()
      streamAbortControllerRef.current = null
      setIsGenerating(false)
      toast.info('已取消生成')
    }
  }

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1)
    } else {
      void handleSubmit()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] w-[1020px] overflow-auto py-8 sm:max-w-[90vw] px-34"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle className="text-center text-3xl">创建提示词工具</DialogTitle>
        </DialogHeader>

        <div className="mt-4 flex justify-center items-center gap-6 p-0">
          {STEPS.map((step, i) => (
            <div
              key={step}
              className={cn(
                'relative flex h-11 cursor-default items-center justify-center gap-1 rounded-lg border px-3 py-1 text-lg text-black transition-all duration-300',
                'border-(--bg-editor-panel,#f5f7fa) bg-(--bg-editor-panel,#f5f7fa)',
                i < STEPS.length - 1 &&
                  "after:absolute after:top-1/2 after:right-[-25px] after:block after:h-px after:w-6 after:-translate-y-1/2 after:bg-[#e4e7ed] after:content-[''] after:z-0",
                currentStep === i &&
                  'border-(--theme-color)! bg-(--dialog-bg,#fff)',
                i < currentStep &&
                  'border-(--el-color-primary-light-5,var(--primary-light-5,#f4d080)) bg-(--el-color-primary-light-5,var(--primary-light-5,#f4d080))'
              )}
            >
              <span>{i + 1}</span>
              <span>{step}</span>
            </div>
          ))}
        </div>

        <div className="min-h-[480px] mt-5">
          {currentStep === 0 && (
            <div className="space-y-3">
              <label className="block text-xl font-medium">提示词工具名称<span className="ml-1">*</span></label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, name: e.target.value.slice(0, 50) }))
                }
                placeholder="如: 文言文大纲生成器"
                maxLength={50}
                showWordLimit
              />
              <label className="block pt-2 text-xl font-medium">
                提示词工具介绍
                <span className="ml-1">*</span>
              </label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData((d) => ({
                    ...d,
                    description: e.target.value.slice(0, 500),
                  }))
                }
                placeholder="详细描述功能和用途"
                rows={5}
                maxLength={500}
                showWordLimit
              />
              <label className="block pt-2 text-xl font-medium">
                提示词工具分类
                <span className="ml-1">*</span>
              </label>
              <Select
                value={formData.category ?? ''}
                onValueChange={(v) =>
                  setFormData((d) => ({ ...d, category: v ?? '' }))
                }
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="请选择分类" />
                </SelectTrigger>
                <SelectContent>
                  {filteredPromptCategories.map((cat) => (
                    <SelectItem key={String(cat.value)} value={String(cat.value)}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="block pt-2 text-xl font-medium">
                提示词工具图标
                <span className="ml-1">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {promptIconOptions.map((opt, index) => (
                  <div
                    key={index}
                    role="button"
                    className={clsx(
                      'flex size-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-[#e4e7ed] bg-[#f5f7fa] transition-all duration-300',
                      'hover:border-[#f9a825] hover:scale-105',
                      formData.iconUrl === String(opt.value)
                        ? 'border-[3px] border-[#f9a825] shadow-[0_0_0_2px_rgba(249,168,37,0.2)]'
                        : ''
                    )}
                    onClick={() =>
                      setFormData((d) => ({ ...d, iconUrl: String(opt.value) }))
                    }
                  >
                    <img
                      src={String(opt.value)}
                      alt={String(opt.label)}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-3">
              <label className="block text-sm font-medium">系统提示词</label>
              <Textarea
                value={formData.systemPrompt}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, systemPrompt: e.target.value }))
                }
                placeholder="控制生成内容质量"
                rows={10}
              />
              <label className="block pt-2 text-sm font-medium">
                输出格式（选填）
              </label>
              <Textarea
                value={formData.outputFormat}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, outputFormat: e.target.value }))
                }
                rows={5}
              />
            </div>
          )}

          {currentStep === 2 && (
            <div className="flex flex-row gap-4 text-black">
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="shrink-0 text-xl leading-6">模拟用户输入</span>
                  <AddConnectedFile />
                </div>
                <div className="mt-3 flex h-100 w-full flex-col rounded-lg border border-[#d9d9d9] p-3">
                  <Textarea
                    value={mockUserDemo}
                    onChange={(e) => setMockUserDemo(e.target.value)}
                    placeholder="请填写用户示例..."
                    className="flex-1"
                    areaClassName="h-full border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    maxLength={500}
                    showWordLimit
                  />
                  <div className="flex flex-row justify-between gap-4">
                    <Button
                      type="button"
                      variant={isUserExampleSaved ? 'secondary' : 'default'}
                      className="flex-1"
                      disabled={isUserExampleSaved || isGenerating}
                      onClick={handleSaveUserDemo}
                    >
                      {isUserExampleSaved ? '用户示例已保存' : '保存为用户示例'}
                    </Button>
                    {!isGenerating ? (
                      <Button
                        type="button"
                        className="flex-1"
                        onClick={() => void handleGenerateTest()}
                      >
                        生成测试结果
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={handleCancelGenerate}
                      >
                        取消生成
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <div className="text-xl leading-6">生成结果</div>
                <div className="mt-3 h-100 overflow-auto rounded-lg border border-[#d9d9d9] p-3">
                  <Textarea
                    value={formData.generateOutput}
                    readOnly
                    className="min-h-[80px] resize-none border-0 bg-transparent focus-visible:ring-0"
                    placeholder="生成结果将显示在这里..."
                    areaClassName="border-0 bg-transparent focus-visible:ring-0"
                    rows={12}
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="text-base font-medium text-black">提示词工具信息</div>
              <div className="min-h-[calc(24px+24px*5)] rounded-lg border border-[#d9d9d9] bg-[#f7f7f7] p-3 text-base leading-6">
                <div>名称: {formData.name}</div>
                <div>描述：{formData.description}</div>
                <div>
                  分类：
                  {filteredPromptCategories.find(
                    (c) => String(c.value) === String(formData.category)
                  )?.label ?? formData.category}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">可见性设置</label>
                <Select
                  value={formData.isPublic ? 'public' : 'private'}
                  onValueChange={(v) =>
                    setFormData((d) => ({ ...d, isPublic: v === 'public' }))
                  }
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="请选择可见性" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">仅自己可见（私密）</SelectItem>
                    <SelectItem value="public">全部可见（公开）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 rounded-lg bg-[#fffae8] px-4 py-3">
                <Iconfont unicode="&#xe604;" className="text-2xl!" />
                <div className="text-base leading-5">
                  提交审核后，工具将进入待审核状态。管理员审核通过后，工具可使用或分享，公开可见的工具将上架在社区中。
                  <span className="font-semibold">
                    注：已上架的公开工具无法转为私密
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6 flex justify-center gap-5 sm:justify-center">
          <Button
            type="button"
            variant="outline"
            disabled={currentStep === 0 || isGenerating}
            onClick={handlePrev}
          >
            上一步
          </Button>
          <Button
            type="button"
            disabled={!canGoNext || isGenerating}
            onClick={handleNext}
          >
            {currentStep === STEPS.length - 1 ? '提交审核' : '下一步'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const openAddNewPromptsDialog = (onSubmit?: () => void) => openDialog(AddNewPromptsDialog, { onSubmit })
