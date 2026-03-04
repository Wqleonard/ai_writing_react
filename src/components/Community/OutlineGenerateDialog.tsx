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
import { Input } from '@/components/ui/Input'
import { SelectConnectedFile } from './SelectConnectedFile'
import { AutoScrollArea } from '../AutoScrollArea'
import MarkdownEditor from '../MarkdownEditor'
import { LinkButton } from '../ui/LinkButton'
import type { ConnectedFile, PromptItem } from './types'
import type { PostStreamData } from '@/api'
import { outlinePostStream } from '@/api/editor-header-toolbar'
import { getContentFromPartial } from '@/utils/getWorkFlowPartialData'
import { showGenerationSaveDialog } from '@/utils/showGenerationSaveDialog'
import { createWorkReq, getWorksByIdReq, updateWorkVersionReq } from '@/api/works'
import { useOptionsStore } from '@/stores/optionsStore'
import { toast } from 'sonner'
import clsx from 'clsx'
import { trackEvent } from '@/matomo/trackingMatomoEvent'

type GenerateType = 'current' | 'custom'

interface OutlineFormModel {
  generateType: GenerateType
  connectedWork: ConnectedFile
  extra: string
  workType: string
  coreMeme: string
  chapterNum: string
}

const INIT_FORM: OutlineFormModel = {
  generateType: 'current',
  connectedWork: { work: null, file: [] },
  extra: '',
  workType: '',
  coreMeme: '',
  chapterNum: '',
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

function stripPrefixBeforeSlash(input: string): string {
  const idx = input.indexOf('/')
  if (idx === -1) return input
  return input.slice(idx + 1)
}

export interface OutlineGenerateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  promptData: PromptItem | null
  onOpenMarket?: (prompt: PromptItem) => void
  onSave?: (saveId: string) => void
}

export const OutlineGenerateDialog = ({
  open,
  onOpenChange,
  promptData,
  onOpenMarket,
  onSave,
}: OutlineGenerateDialogProps) => {
  const { workId: routeWorkId } = useParams<{ workId?: string }>()
  const currentWorkId = routeWorkId ?? undefined

  const recommendConfig = useOptionsStore(s => s.recommendConfig)

  const [formModel, setFormModel] = useState<OutlineFormModel>({ ...INIT_FORM })
  const [formConfirmed, setFormConfirmed] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [showIndicator, setShowIndicator] = useState(false)
  const [markdownContent, setMarkdownContent] = useState('')
  const [markdownEditing, setMarkdownEditing] = useState(false)

  const [connectedWorkError, setConnectedWorkError] = useState('')
  const [workTypeError, setWorkTypeError] = useState('')
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
    setWorkTypeError('')
    setCoreMemeError('')
    formModelSnapshotRef.current = null
    setFormModel({ ...INIT_FORM })
  }, [])

  useEffect(() => {
    resetDialog()
  }, [open, resetDialog])

  useEffect(() => {
    if (open) {
      trackEvent('AI Tool', 'Click', 'Outline')
    }
  }, [open])

  const getDescription = useCallback(() => {
    if (formModel.generateType === 'current') {
      return formModel.extra || ''
    }
    let desc = ''
    if (formModel.coreMeme) desc += '核心梗：' + formModel.coreMeme + ';'
    if (formModel.extra) desc += '补充信息：' + formModel.extra + ';'
    return desc
  }, [formModel])

  const isFormModelChanged = useCallback((): boolean => {
    if (!formModelSnapshotRef.current) return true
    const workIdVal = formModel.connectedWork?.work?.id
    const relatedFiles = deduplicateAndFilterFiles(formModel.connectedWork?.file || []).map(i => i.id)
    const current = JSON.stringify({
      generateType: formModel.generateType,
      workId: workIdVal ? String(workIdVal) : '',
      relatedFiles,
      theme: formModel.workType || '',
      description: getDescription(),
      chapterNum: Number(formModel.chapterNum) || 0,
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
    if (error instanceof DOMException && error.name === 'AbortError') return
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
    const relatedFiles = deduplicateAndFilterFiles(formModel.connectedWork?.file || []).map(i => i.id)
    const chapterNum = Number(formModel.chapterNum) || 0

    const requestData = {
      promptId: String(promptData?.id ?? ''),
      workId: workIdVal ? String(workIdVal) : '',
      relatedFiles,
      theme: formModel.workType || '',
      description: getDescription(),
      chapterNum,
    }

    formModelSnapshotRef.current = JSON.stringify({
      generateType: formModel.generateType,
      workId: workIdVal ? String(workIdVal) : '',
      relatedFiles,
      theme: formModel.workType || '',
      description: getDescription(),
      chapterNum,
    })

    streamAbortControllerRef.current = new AbortController()

    try {
      await outlinePostStream(
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
    setWorkTypeError('')
    setCoreMemeError('')

    if (formModel.generateType === 'current') {
      const w = formModel.connectedWork
      if (!w?.work || !Array.isArray(w?.file) || w.file.length === 0) {
        setConnectedWorkError('请选择关联作品并至少选择一个文件')
        valid = false
      }
    } else {
      if (!formModel.workType?.trim()) {
        setWorkTypeError('请输入文章类型')
        valid = false
      }
      if (!formModel.coreMeme?.trim()) {
        setCoreMemeError('请输入核心梗')
        valid = false
      }
    }
    return valid
  }, [formModel])

  const handleSave = useCallback(async () => {
    try {
      const result = await showGenerationSaveDialog({
        fileNameDefault: '大纲(来自生成器)',
        currentWorkId,
      })
      if (!result.selectedPath) return
      let saveId = ''
      if (result.workType === 'new') {
        const createRes: any = await createWorkReq()
        const newWorkId = createRes.id
        const newWorkFiles = JSON.parse(createRes.latestWorkVersion?.content || '{}')
        const savePath = stripPrefixBeforeSlash(result.selectedPath) + '/' + result.fileName + '.md'
        await updateWorkVersionReq(newWorkId, JSON.stringify({ ...newWorkFiles, [savePath]: markdownContent }), '0')
        saveId = newWorkId
      } else {
        const workId = String(result.selectedWork?.id)
        const work: any = await getWorksByIdReq(workId)
        const workFiles = JSON.parse(work?.latestWorkVersion?.content || '{}')
        const savePath = stripPrefixBeforeSlash(result.selectedPath) + '/' + result.fileName + '.md'
        await updateWorkVersionReq(workId, JSON.stringify({ ...workFiles, [savePath]: markdownContent }), '0')
        saveId = workId
      }
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
      trackEvent('AI Tool', 'Generate', 'Outline')
      if (!validate()) return
      setFormConfirmed(true)
      if (isFormModelChanged()) {
        await postStreamHandler()
      }
    } else {
      trackEvent('AI Tool', 'Use', 'Outline')
      await handleSave()
    }
  }, [formConfirmed, validate, isFormModelChanged, postStreamHandler, handleSave])

  const handleFresh = useCallback(() => {
    setMarkdownEditing(false)
    postStreamHandler()
  }, [postStreamHandler])

  const handleBack = () => setFormConfirmed(false)

  const updateForm = <K extends keyof OutlineFormModel>(key: K, value: OutlineFormModel[K]) => {
    setFormModel(prev => ({ ...prev, [key]: value }))
  }

  const handleSelectRecommend = (key: string, value: string) => {
    if (key in formModel) {
      updateForm(key as keyof OutlineFormModel, value as any)
    }
  }

  const handleChapterNumInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (raw === '') { updateForm('chapterNum', ''); return }
    const num = Number(raw)
    if (isNaN(num)) return
    const clamped = Math.min(10, Math.max(1, Math.floor(num)))
    updateForm('chapterNum', String(clamped))
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onOpenChange(false)}>
      <DialogContent
        className="w-[1020px] max-w-[90vw] py-11 px-[120px] pb-8 sm:max-w-[90vw]"
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
            大纲生成器
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 w-full min-w-0 h-[576px] flex flex-col">
          {!formConfirmed ? (
            <div className="mt-4 flex flex-col gap-4 overflow-y-auto min-w-0 px-1 -mx-1 py-1 -my-1">
              {/* 提示词 */}
              {promptData && (
                <div className="min-w-0">
                  <div className="text-lg">提示词</div>
                  <div
                    role="button"
                    className="mt-1.5 flex h-20 min-w-0 cursor-pointer items-center justify-between rounded-lg bg-[#f7f7f7] px-4"
                    onClick={() => onOpenMarket?.(promptData)}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 overflow-hidden text-ellipsis text-lg">{promptData.name}</div>
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
                    <RadioGroupItem value="current" id="outline-gen-type-current" />
                    <label htmlFor="outline-gen-type-current" className="cursor-pointer text-sm">根据当前作品内容生成</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="custom" id="outline-gen-type-custom" />
                    <label htmlFor="outline-gen-type-custom" className="cursor-pointer text-sm">根据自定义需求生成</label>
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
                      placeholder="非必填项，可填写使用关联内容的指定生成要求、基于关联内容进行指定改动等"
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* 文章类型（必填） */}
                  <div className="min-w-0">
                    <FormRecommendLabel
                      label="文章类型"
                      required
                      recommends={(recommendConfig.workType || []).map(v => ({ label: v, value: v }))}
                      fieldKey="workType"
                      onSelect={handleSelectRecommend}
                      className="mb-1.5 min-w-0"
                    />
                    <Textarea
                      className="w-full"
                      value={formModel.workType}
                      onChange={e => { updateForm('workType', e.target.value); setWorkTypeError('') }}
                      maxLength={200}
                      placeholder="必填项，填写故事类型，如世情文、死人文学、复活、追妻火葬场等"
                    />
                    {workTypeError && (
                      <p className="mt-1 text-xs text-red-500">{workTypeError}</p>
                    )}
                  </div>

                  {/* 核心梗（必填） */}
                  <div className="min-w-0">
                    <FormRecommendLabel
                      label="核心梗"
                      required
                      recommends={(recommendConfig.coreMeme || []).map(v => ({ label: v, value: v }))}
                      fieldKey="coreMeme"
                      onSelect={handleSelectRecommend}
                      className="mb-1.5 min-w-0"
                    />
                    <Textarea
                      className="w-full"
                      value={formModel.coreMeme}
                      onChange={e => { updateForm('coreMeme', e.target.value); setCoreMemeError('') }}
                      maxLength={200}
                      placeholder='必填项，填写核心冲突，如"为救家族签下替身协议后，发现金主竟是幼时白月光本尊"'
                    />
                    {coreMemeError && (
                      <p className="mt-1 text-xs text-red-500">{coreMemeError}</p>
                    )}
                  </div>

                  {/* 章节数量 */}
                  <div className="min-w-0">
                    <div className="text-lg">章节数量</div>
                    <Input
                      className="mt-1.5"
                      type="number"
                      min={1}
                      max={10}
                      step={1}
                      value={formModel.chapterNum}
                      onChange={handleChapterNumInput}
                      placeholder="非必填，默认10章节"
                    />
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
                        placeholder="非必填项，选中后将参考关联文件生成内容"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="mt-2 flex flex-col gap-1">
              <AutoScrollArea
                className={clsx(
                  'h-[500px] rounded-lg bg-[#f6f6f6] p-3',
                  markdownEditing && 'outline-2 outline-(--theme-color)'
                )}
                maxHeight="500px"
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

        <DialogFooter className="flex flex-row-reverse gap-4 border-0 p-0">
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
