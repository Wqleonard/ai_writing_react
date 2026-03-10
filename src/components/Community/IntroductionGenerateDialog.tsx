import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Iconfont } from '@/components/IconFont'
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup'
import { Textarea } from '@/components/ui/Textarea'
import { FormRecommendLabel } from '@/components/ui/FormRecommendLabel'
import { SelectConnectedFile } from './SelectConnectedFile'
import { AutoScrollArea } from '../AutoScrollArea'
import MarkdownEditor from '../MarkdownEditor'
import { LinkButton } from '../ui/LinkButton'
import type { ConnectedFile, PromptItem } from './types'
import type { PostStreamData } from '@/api'
import { introductionPostStream } from '@/api/editor-header-toolbar'
import { getContentFromPartial } from '@/utils/getWorkFlowPartialData'
import { handleGenerationSave } from '@/utils/handleGenerationSave'
import { useOptionsStore } from '@/stores/optionsStore'
import { toast } from 'sonner'
import clsx from 'clsx'
import { trackEvent } from '@/matomo/trackingMatomoEvent'
import { ScrollArea } from '@/components/ui/ScrollArea'

type GenerateType = 'current' | 'custom'

interface IntroductionFormModel {
  generateType: GenerateType
  connectedWork: ConnectedFile
  extra: string
  coreMeme: string
}

const INIT_FORM: IntroductionFormModel = {
  generateType: 'current',
  connectedWork: { work: null, file: [] },
  extra: '',
  coreMeme: '',
}

function deduplicateAndFilterFiles(files: ConnectedFile['file']) {
  if (!Array.isArray(files) || files.length === 0) return []
  const seen = new Set<string>()
  const result: typeof files = []
  const walk = (ns: typeof files) => {
    for (const n of ns) {
      if ((n as any).fileType === 'md') {
        if (!seen.has(n.id)) {
          seen.add(n.id)
          result.push(n)
        }
      }
      if ((n as any).children?.length) walk((n as any).children)
    }
  }
  walk(files)
  return result
}

export interface IntroductionGenerateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  promptData: PromptItem | null
  onOpenMarket?: (prompt: PromptItem) => void
  onSave?: (saveId: string) => void
}

export const IntroductionGenerateDialog = ({
  open,
  onOpenChange,
  promptData,
  onOpenMarket,
  onSave,
}: IntroductionGenerateDialogProps) => {
  const { workId: routeWorkId } = useParams<{ workId?: string }>()
  const currentWorkId = routeWorkId ?? undefined

  const recommendConfig = useOptionsStore(s => s.recommendConfig)

  const [formModel, setFormModel] = useState<IntroductionFormModel>({ ...INIT_FORM, connectedWork: { work: null, file: [] } })
  const [formConfirmed, setFormConfirmed] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [showIndicator, setShowIndicator] = useState(false)
  const [markdownContent, setMarkdownContent] = useState('')
  const [markdownEditing, setMarkdownEditing] = useState(false)

  // validation
  const [connectedWorkError, setConnectedWorkError] = useState('')
  const [coreMemeError, setCoreMemeError] = useState('')

  const streamAbortControllerRef = useRef<AbortController | null>(null)
  const formModelSnapshotRef = useRef<string | null>(null)

  const resetDialog = useCallback(() => {
    if (streamAbortControllerRef.current) {
      streamAbortControllerRef.current.abort()
      streamAbortControllerRef.current = null
    }
    setFormConfirmed(false)
    setMarkdownContent('')
    setMarkdownEditing(false)
    setStreaming(false)
    setShowIndicator(false)
    setConnectedWorkError('')
    setCoreMemeError('')
    formModelSnapshotRef.current = null
    setFormModel({ ...INIT_FORM, connectedWork: { work: null, file: [] } })
  }, [])

  useEffect(() => {
    resetDialog()
  }, [open, resetDialog])

  useEffect(() => {
    if (open) {
      trackEvent('AI Tool', 'Click', 'Lead')
    }
  }, [open])

  const getDescription = useCallback(() => {
    if (formModel.generateType === 'current') {
      return formModel.extra || ''
    }
    let desc = formModel.coreMeme || ''
    if (formModel.extra) desc += '；补充信息为：' + formModel.extra
    return desc
  }, [formModel])

  const isFormModelChanged = useCallback((): boolean => {
    if (!formModelSnapshotRef.current) return true
    const workIdVal = formModel.connectedWork?.work?.id
    const relatedFiles = deduplicateAndFilterFiles(formModel.connectedWork?.file || []).map(item => item.id)
    const current = JSON.stringify({
      generateType: formModel.generateType,
      workId: workIdVal ? String(workIdVal) : '',
      relatedFiles,
      description: getDescription(),
    })
    return current !== formModelSnapshotRef.current
  }, [formModel, getDescription])

  const handleStreamData = useCallback((data: PostStreamData) => {
    switch (data.event) {
      case 'messages/partial': {
        const content = getContentFromPartial(data.data)
        setMarkdownContent(content)
        if (content) setShowIndicator(false)
        break
      }
      case 'updates': {
        const generate_content = data?.data?.generate_content
        if (generate_content?.content && generate_content?.finished === true) {
          setMarkdownContent(generate_content.content)
          setShowIndicator(false)
        }
        break
      }
      case 'end':
        break
    }
  }, [])

  const handleStreamComplete = useCallback(() => {
    setStreaming(false)
    setShowIndicator(false)
    streamAbortControllerRef.current = null
  }, [])

  const handleStreamError = useCallback((error: unknown) => {
    if (error instanceof DOMException && (error as DOMException).name === 'AbortError') return
    console.error('生成失败:', error)
    setStreaming(false)
    setShowIndicator(false)
    streamAbortControllerRef.current = null
    setFormConfirmed(false)
    formModelSnapshotRef.current = null
  }, [])

  const postStreamHandler = useCallback(async () => {
    if (streamAbortControllerRef.current) {
      streamAbortControllerRef.current.abort()
    }

    setMarkdownContent('')
    setStreaming(true)
    setShowIndicator(true)

    const workIdVal = formModel.connectedWork?.work?.id
    const relatedFiles = deduplicateAndFilterFiles(formModel.connectedWork?.file || []).map(item => item.id)

    const requestData = {
      promptId: String(promptData?.id ?? ''),
      workId: workIdVal ? String(workIdVal) : '',
      relatedFiles,
      description: getDescription(),
    }

    formModelSnapshotRef.current = JSON.stringify({
      generateType: formModel.generateType,
      workId: workIdVal ? String(workIdVal) : '',
      relatedFiles,
      description: getDescription(),
    })

    streamAbortControllerRef.current = new AbortController()

    try {
      await introductionPostStream(
        requestData,
        handleStreamData,
        handleStreamError,
        handleStreamComplete,
        { signal: streamAbortControllerRef.current.signal }
      )
    } catch (err) {
      if (err instanceof DOMException && (err as DOMException).name === 'AbortError') {
        setStreaming(false)
        setShowIndicator(false)
        streamAbortControllerRef.current = null
        return
      }
      console.error('调用流式接口失败:', err)
      setStreaming(false)
      setShowIndicator(false)
      streamAbortControllerRef.current = null
      setFormConfirmed(false)
      formModelSnapshotRef.current = null
      toast.error('生成失败，请重试')
    }
  }, [formModel, promptData, getDescription, handleStreamData, handleStreamError, handleStreamComplete])

  const validate = useCallback((): boolean => {
    let valid = true
    setConnectedWorkError('')
    setCoreMemeError('')

    if (formModel.generateType === 'current') {
      const w = formModel.connectedWork
      if (!w?.work || !Array.isArray(w?.file) || w.file.length === 0) {
        setConnectedWorkError('请选择关联作品并至少选择一个文件')
        valid = false
      }
    } else {
      if (!formModel.coreMeme?.trim()) {
        setCoreMemeError('请输入核心梗')
        valid = false
      }
    }
    return valid
  }, [formModel])

  const handleSave = useCallback(async () => {
    try {
      const saveId = await handleGenerationSave('导语(来自生成器)', markdownContent, currentWorkId)
      if (!saveId) return
      toast.success('保存成功')
      onSave?.(saveId)
      onOpenChange(false)
    } catch (e) {
      if ((e as Error)?.message !== '用户取消') {
        console.error(e)
        toast.error('保存失败')
      }
    }
  }, [markdownContent, currentWorkId, onSave, onOpenChange])

  const handleConfirm = useCallback(async () => {
    if (!formConfirmed) {
      trackEvent('AI Tool', 'Generate', 'Lead')
      if (!validate()) return
      setFormConfirmed(true)
      if (isFormModelChanged()) {
        await postStreamHandler()
      }
    } else {
      trackEvent('AI Tool', 'Use', 'Lead')
      await handleSave()
    }
  }, [formConfirmed, validate, isFormModelChanged, postStreamHandler, handleSave])

  const handleFresh = useCallback(() => {
    setMarkdownEditing(false)
    postStreamHandler()
  }, [postStreamHandler])

  const handleBack = () => setFormConfirmed(false)

  const updateForm = <K extends keyof IntroductionFormModel>(key: K, value: IntroductionFormModel[K]) => {
    setFormModel(prev => ({ ...prev, [key]: value }))
  }

  const handleSelectRecommend = (key: string, value: string) => {
    if (key in formModel) {
      updateForm(key as keyof IntroductionFormModel, value as any)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onOpenChange(false)}>
      <DialogContent
        className="w-[1020px] max-w-[90vw] py-11 px-25 pb-8 sm:max-w-[90vw]"
        showCloseButton
      >
        <DialogHeader className="px-5 relative h-9 min-h-0 shrink-0 gap-0">
          {formConfirmed && (
            <div
              role="button"
              className="absolute left-5 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-md hover:bg-accent cursor-pointer"
              onClick={handleBack}
            >
              <Iconfont unicode="&#xe62a;" />
            </div>
          )}
          <DialogTitle className="h-9 min-h-0 overflow-hidden text-center text-2xl leading-9">
            导语生成器
          </DialogTitle>
        </DialogHeader>

        <div className="w-[820px] h-[576px] flex flex-col ">
          {!formConfirmed ? (
            <ScrollArea className='h-full w-full'>
              <div className="w-[820px] px-5  flex flex-col gap-4">
              {/* 提示词 */}
              {promptData && (
                <div className="w-full">
                  <div className="text-lg">提示词</div>
                  <div
                    role="button"
                    className="mt-1.5 flex h-20 w-full cursor-pointer items-center justify-between rounded-lg bg-[#f7f7f7] px-4"
                    onClick={() => onOpenMarket?.(promptData)}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 text-ellipsis text-lg">{promptData.name}</div>
                        {promptData.categories?.map(c => (
                          <span key={c.id} className="rounded px-2 py-1 text-xs bg-[#dedede] shrink-0">
                            {c.name}
                          </span>
                        ))}
                      </div>
                      <div className="text-sm text-[#666]">@{promptData.authorName}</div>
                    </div>
                    <Iconfont unicode="&#xeaa5;" className="text-2xl shrink-0" />
                  </div>
                </div>
              )}

              {/* 生成类型 */}
              <div className="min-w-0">
                <div className="text-lg">生成类型</div>
                <RadioGroup
                  value={formModel.generateType}
                  onValueChange={v => updateForm('generateType', v as GenerateType)}
                  className="mt-1.5 flex flex-row gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="current" id="gen-type-current" />
                    <label htmlFor="gen-type-current" className="cursor-pointer text-sm">根据当前作品内容生成</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="custom" id="gen-type-custom" />
                    <label htmlFor="gen-type-custom" className="cursor-pointer text-sm">根据自定义需求生成</label>
                  </div>
                </RadioGroup>
              </div>

              {formModel.generateType === 'current' ? (
                <>
                  {/* 关联作品（必填） */}
                  <div className="min-w-0">
                    <div className="text-lg">
                      关联作品 <span className="text-red-500">*</span>
                    </div>
                    <div className="mt-1.5 min-w-0">
                      <SelectConnectedFile
                        value={formModel.connectedWork}
                        onChange={v => { updateForm('connectedWork', v); setConnectedWorkError('') }}
                        placeholder="必填项，选中后将参考关联文件生成内容"
                      />
                      {connectedWorkError && (
                        <p className="mt-1 text-xs text-red-500">{connectedWorkError}</p>
                      )}
                    </div>
                  </div>

                  {/* 补充信息 */}
                  <div className="min-w-0">
                    <div className="text-lg">补充信息</div>
                    <Textarea
                      className="mt-1.5 w-full"
                      value={formModel.extra}
                      onChange={e => updateForm('extra', e.target.value)}
                      maxLength={200}
                      placeholder="非必填项，可填写金手指、仿写要求、背景要求、人称要求等"
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* 核心梗（必填） */}
                  <div className="w-full">
                    <FormRecommendLabel
                      label="核心梗"
                      required
                      recommends={(recommendConfig.coreMeme || []).map(v => ({ label: v, value: v }))}
                      fieldKey="coreMeme"
                      onSelect={handleSelectRecommend}
                      className="mb-1.5 w-full max-w-full min-w-0 overflow-hidden"
                    />
                    <Textarea
                      className="w-full"
                      value={formModel.coreMeme}
                      onChange={e => { updateForm('coreMeme', e.target.value); setCoreMemeError('') }}
                      maxLength={200}
                      placeholder="请输入核心梗"
                    />
                    {coreMemeError && (
                      <p className="mt-1 text-xs text-red-500">{coreMemeError}</p>
                    )}
                  </div>

                  {/* 补充信息 */}
                  <div className="min-w-0">
                    <div className="text-lg">补充信息</div>
                    <Textarea
                      className="mt-1.5 w-full"
                      value={formModel.extra}
                      onChange={e => updateForm('extra', e.target.value)}
                      maxLength={200}
                      placeholder="非必填项，可填写金手指、仿写要求、背景要求、人称要求等"
                    />
                  </div>

                  {/* 关联作品（非必填） */}
                  <div className="min-w-0">
                    <div className="text-lg">关联作品</div>
                    <div className="mt-1.5 min-w-0">
                      <SelectConnectedFile
                        value={formModel.connectedWork}
                        onChange={v => updateForm('connectedWork', v)}
                        placeholder="非必填项,选中后将参考关联文件生成内容"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
            </ScrollArea>
          ) : (
            <div className="mt-2 px-5 flex flex-col gap-1 h-full">
              <AutoScrollArea
                className={clsx(
                  'flex-1 min-h-0 rounded-lg bg-[#f6f6f6]',
                  markdownEditing && 'outline-2 outline-(--theme-color)'
                )}
                autoScroll
              >
                <MarkdownEditor
                  value={markdownContent}
                  onChange={v => setMarkdownContent(v)}
                  readonly={!markdownEditing}
                  loading={showIndicator}
                  placeholder="请等待输出..."
                />
              </AutoScrollArea>

              <div className="mt-2 flex justify-center gap-4">
                <LinkButton
                  type="button"
                  disabled={streaming}
                  onClick={handleFresh}
                  className="text-[#909399] text-sm"
                >
                  <Iconfont unicode="&#xe66f;" className="mr-1" />
                  <span>重新生成</span>
                </LinkButton>
                <LinkButton
                  type="button"
                  disabled={streaming}
                  onClick={() => setMarkdownEditing(v => !v)}
                  className="text-[#909399] text-sm"
                >
                  <Iconfont unicode="&#xea48;" className="mr-1" />
                  <span>{markdownEditing ? '完成' : '编辑'}</span>
                </LinkButton>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-row-reverse gap-4 border-0 py-0 px-5">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            退出
          </Button>
          <Button
            type="button"
            disabled={formConfirmed && streaming}
            onClick={handleConfirm}
          >
            {formConfirmed ? '添加到作品' : '生成'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
