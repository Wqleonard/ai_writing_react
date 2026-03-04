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
import { worldPostStream } from '@/api/editor-header-toolbar'
import { getContentFromPartial } from '@/utils/getWorkFlowPartialData'
import { showGenerationSaveDialog } from '@/utils/showGenerationSaveDialog'
import { createWorkReq, getWorksByIdReq, updateWorkVersionReq } from '@/api/works'
import { toast } from 'sonner'
import clsx from 'clsx'
import { trackEvent } from '@/matomo/trackingMatomoEvent'

type GenerateType = 'current' | 'custom'

interface WorldFormModel {
  generateType: GenerateType
  connectedWork: ConnectedFile
  extra: string
  workType: string
  persona: string
}

const INIT_FORM: WorldFormModel = {
  generateType: 'current',
  connectedWork: { work: null, file: [] },
  extra: '',
  workType: '',
  persona: '',
}

const WORK_TYPE_RECOMMENDS = ['世情文', '爽文', '打脸文', '重生文', '现言虐文', '古言虐文', '甜文', '沙雕文', '脑洞文', '穿越文']
const PERSONA_RECOMMENDS = ['海王', '精英', '颜控', '直率勇敢', '孤僻社恐', '宅女', '吃货', '学霸', '病娇', '绿茶', '天选之人', '生怀绝技']

function deduplicateAndFilterFiles(files: ConnectedFile['file']) {
  if (!Array.isArray(files) || files.length === 0) return []
  const seen = new Set<string>()
  const result: typeof files = []
  const walk = (ns: typeof files) => {
    for (const n of ns) {
      if ((n as any).fileType === 'md') {
        if (!seen.has(n.id)) { seen.add(n.id); result.push(n) }
      }
      if ((n as any).children?.length) walk((n as any).children)
    }
  }
  walk(files)
  return result
}

function stripPrefixBeforeSlash(input: string): string {
  const idx = input.indexOf('/')
  return idx === -1 ? input : input.slice(idx + 1)
}

export interface WorldGenerateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  promptData: PromptItem | null
  onOpenMarket?: (prompt: PromptItem) => void
  onSave?: (saveId: string) => void
}

export const WorldGenerateDialog = ({
  open,
  onOpenChange,
  promptData,
  onOpenMarket,
  onSave,
}: WorldGenerateDialogProps) => {
  const { workId: routeWorkId } = useParams<{ workId?: string }>()
  const currentWorkId = routeWorkId ?? undefined

  const [formModel, setFormModel] = useState<WorldFormModel>({ ...INIT_FORM })
  const [formConfirmed, setFormConfirmed] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [showIndicator, setShowIndicator] = useState(false)
  const [markdownContent, setMarkdownContent] = useState('')
  const [markdownEditing, setMarkdownEditing] = useState(false)

  const [connectedWorkError, setConnectedWorkError] = useState('')
  const [workTypeError, setWorkTypeError] = useState('')
  const [personaError, setPersonaError] = useState('')

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
    setPersonaError('')
    formModelSnapshotRef.current = null
    setFormModel({ ...INIT_FORM })
  }, [])

  useEffect(() => { resetDialog() }, [open, resetDialog])

  useEffect(() => {
    if (open) {
      trackEvent('AI Tool', 'Click', 'Worldview')
    }
  }, [open])

  const getDescription = useCallback(() => {
    if (formModel.generateType === 'current') return formModel.extra || ''
    let desc = ''
    if (formModel.workType) desc += '文章类型：' + formModel.workType + ';'
    if (formModel.persona) desc += '主角人设：' + formModel.persona + ';'
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
        const gc = data?.data?.generate_content
        if (gc?.content && gc?.finished === true) { setMarkdownContent(gc.content); setShowIndicator(false) }
        break
      }
    }
  }, [])

  const handleStreamComplete = useCallback(() => {
    setStreaming(false); setShowIndicator(false)
    streamAbortControllerRef.current = null
  }, [])

  const handleStreamError = useCallback((error: unknown) => {
    if (error instanceof DOMException && error.name === 'AbortError') return
    console.error('生成失败:', error)
    setStreaming(false); setShowIndicator(false)
    streamAbortControllerRef.current = null
    setFormConfirmed(false)
    formModelSnapshotRef.current = null
  }, [])

  const postStreamHandler = useCallback(async () => {
    if (streamAbortControllerRef.current) streamAbortControllerRef.current.abort()
    setMarkdownContent('')
    setStreaming(true)
    setShowIndicator(true)

    const workIdVal = formModel.connectedWork?.work?.id
    const relatedFiles = deduplicateAndFilterFiles(formModel.connectedWork?.file || []).map(i => i.id)

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
      await worldPostStream(requestData, handleStreamData, handleStreamError, handleStreamComplete, { signal: streamAbortControllerRef.current.signal })
    } catch (err) {
      if (err instanceof DOMException && (err as DOMException).name === 'AbortError') {
        setStreaming(false); setShowIndicator(false)
        streamAbortControllerRef.current = null; return
      }
      console.error('调用流式接口失败:', err)
      setStreaming(false); setShowIndicator(false)
      streamAbortControllerRef.current = null
      setFormConfirmed(false)
      formModelSnapshotRef.current = null
      toast.error('生成失败，请重试')
    }
  }, [formModel, promptData, getDescription, handleStreamData, handleStreamError, handleStreamComplete])

  const validate = useCallback((): boolean => {
    let valid = true
    setConnectedWorkError(''); setWorkTypeError(''); setPersonaError('')
    if (formModel.generateType === 'current') {
      const w = formModel.connectedWork
      if (!w?.work || !Array.isArray(w?.file) || w.file.length === 0) {
        setConnectedWorkError('请选择关联作品并至少选择一个文件'); valid = false
      }
    } else {
      if (!formModel.workType?.trim()) { setWorkTypeError('请输入文章类型'); valid = false }
      if (!formModel.persona?.trim()) { setPersonaError('请输入主角人设'); valid = false }
    }
    return valid
  }, [formModel])

  const handleSave = useCallback(async () => {
    try {
      const result = await showGenerationSaveDialog({ fileNameDefault: '故事设定(来自生成器)', currentWorkId })
      if (!result.selectedPath) return
      let saveId = ''
      if (result.workType === 'new') {
        const createRes: any = await createWorkReq()
        const newWorkFiles = JSON.parse(createRes.latestWorkVersion?.content || '{}')
        const savePath = stripPrefixBeforeSlash(result.selectedPath) + '/' + result.fileName + '.md'
        await updateWorkVersionReq(createRes.id, JSON.stringify({ ...newWorkFiles, [savePath]: markdownContent }), '0')
        saveId = createRes.id
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
      if ((e as Error)?.message !== '用户取消') { console.error(e); toast.error('保存失败') }
    }
  }, [markdownContent, currentWorkId, onSave, onOpenChange])

  const handleConfirm = useCallback(async () => {
    if (!formConfirmed) {
      trackEvent('AI Tool', 'Generate', 'Worldview')
      if (!validate()) return
      setFormConfirmed(true)
      if (isFormModelChanged()) await postStreamHandler()
    } else {
      trackEvent('AI Tool', 'Use', 'Worldview')
      await handleSave()
    }
  }, [formConfirmed, validate, isFormModelChanged, postStreamHandler, handleSave])

  const handleFresh = useCallback(() => { setMarkdownEditing(false); postStreamHandler() }, [postStreamHandler])
  const handleBack = () => setFormConfirmed(false)

  const updateForm = <K extends keyof WorldFormModel>(key: K, value: WorldFormModel[K]) =>
    setFormModel(prev => ({ ...prev, [key]: value }))

  const handleSelectRecommend = (key: string, value: string) => {
    if (key in formModel) updateForm(key as keyof WorldFormModel, value as any)
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onOpenChange(false)}>
      <DialogContent className="w-[1020px] max-w-[90vw] py-11 px-[120px] pb-8 sm:max-w-[90vw]" showCloseButton>
        <DialogHeader className="px-5 relative h-9 min-h-0 shrink-0 gap-0">
          {formConfirmed && (
            <div role="button" className="absolute left-5 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-md hover:bg-accent cursor-pointer" onClick={handleBack}>
              <Iconfont unicode="&#xe62a;" />
            </div>
          )}
          <DialogTitle className="h-9 min-h-0 overflow-hidden text-center text-2xl leading-9">故事设定生成器</DialogTitle>
        </DialogHeader>

        <div className="px-5 w-full min-w-0 h-[576px] flex flex-col">
          {!formConfirmed ? (
            <div className="mt-4 flex flex-col gap-4 overflow-y-auto min-w-0 px-1 -mx-1 py-1 -my-1">
              {promptData && (
                <div className="min-w-0">
                  <div className="text-lg">提示词</div>
                  <div role="button" className="mt-1.5 flex h-20 min-w-0 cursor-pointer items-center justify-between rounded-lg bg-[#f7f7f7] px-4" onClick={() => onOpenMarket?.(promptData)}>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 overflow-hidden text-ellipsis text-lg">{promptData.name}</div>
                        {promptData.categories?.map(c => <span key={c.id} className="rounded px-2 py-1 text-xs bg-[#dedede] shrink-0">{c.name}</span>)}
                      </div>
                      <div className="text-sm text-[#666]">@{promptData.authorName}</div>
                    </div>
                    <Iconfont unicode="&#xeaa5;" className="text-2xl shrink-0" />
                  </div>
                </div>
              )}

              <div className="min-w-0">
                <div className="text-lg">生成类型</div>
                <RadioGroup value={formModel.generateType} onValueChange={v => updateForm('generateType', v as GenerateType)} className="mt-1.5 flex flex-row gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="current" id="world-gen-type-current" />
                    <label htmlFor="world-gen-type-current" className="cursor-pointer text-sm">根据当前作品内容生成</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="custom" id="world-gen-type-custom" />
                    <label htmlFor="world-gen-type-custom" className="cursor-pointer text-sm">根据自定义需求生成</label>
                  </div>
                </RadioGroup>
              </div>

              {formModel.generateType === 'current' ? (
                <>
                  <div className="min-w-0">
                    <div className="text-lg">关联作品 <span className="text-red-500">*</span></div>
                    <div className="mt-1.5 min-w-0">
                      <SelectConnectedFile value={formModel.connectedWork} onChange={v => { updateForm('connectedWork', v); setConnectedWorkError('') }} placeholder="必填项，选中后将参考关联文件生成内容" />
                      {connectedWorkError && <p className="mt-1 text-xs text-red-500">{connectedWorkError}</p>}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg">补充信息</div>
                    <Textarea className="mt-1.5 w-full" value={formModel.extra} onChange={e => updateForm('extra', e.target.value)} maxLength={200} placeholder="非必填项，可填写金手指、仿写要求、背景要求、人称要求等" />
                  </div>
                </>
              ) : (
                <>
                  <div className="min-w-0">
                    <FormRecommendLabel label="文章类型" required recommends={WORK_TYPE_RECOMMENDS.map(v => ({ label: v, value: v }))} fieldKey="workType" onSelect={handleSelectRecommend} className="mb-1.5 min-w-0" />
                    <Textarea className="w-full" value={formModel.workType} onChange={e => { updateForm('workType', e.target.value); setWorkTypeError('') }} maxLength={200} placeholder="请确定故事类型，如玄幻、仙侠、都市、悬疑、穿越等" />
                    {workTypeError && <p className="mt-1 text-xs text-red-500">{workTypeError}</p>}
                  </div>
                  <div className="min-w-0">
                    <FormRecommendLabel label="主角人设" required recommends={PERSONA_RECOMMENDS.map(v => ({ label: v, value: v }))} fieldKey="persona" onSelect={handleSelectRecommend} className="mb-1.5 min-w-0" />
                    <Textarea className="w-full" value={formModel.persona} onChange={e => { updateForm('persona', e.target.value); setPersonaError('') }} maxLength={200} placeholder="请填写主角信息，如主角目标、人物弧光等" />
                    {personaError && <p className="mt-1 text-xs text-red-500">{personaError}</p>}
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg">补充信息</div>
                    <Textarea className="mt-1.5 w-full" value={formModel.extra} onChange={e => updateForm('extra', e.target.value)} maxLength={200} placeholder="非必填项，可填写金手指、仿写要求、背景要求、人称要求等" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg">关联作品</div>
                    <div className="mt-1.5 min-w-0">
                      <SelectConnectedFile value={formModel.connectedWork} onChange={v => updateForm('connectedWork', v)} placeholder="非必填项，选中后将参考关联文件生成内容" />
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="mt-2 flex flex-col gap-1">
              <AutoScrollArea className={clsx('h-[500px] rounded-lg bg-[#f6f6f6] p-3', markdownEditing && 'outline-2 outline-(--theme-color)')} maxHeight="500px" autoScroll>
                <MarkdownEditor value={markdownContent} onChange={v => setMarkdownContent(v)} readonly={!markdownEditing} loading={showIndicator} placeholder="请等待输出..." />
              </AutoScrollArea>
              <div className="mt-2 flex justify-center gap-4">
                <LinkButton type="button" disabled={streaming} onClick={handleFresh} className="text-[#909399] text-sm">
                  <Iconfont unicode="&#xe66f;" className="mr-1" /><span>重新生成</span>
                </LinkButton>
                <LinkButton type="button" disabled={streaming} onClick={() => setMarkdownEditing(v => !v)} className="text-[#909399] text-sm">
                  <Iconfont unicode="&#xea48;" className="mr-1" /><span>{markdownEditing ? '完成' : '编辑'}</span>
                </LinkButton>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-row-reverse gap-4 border-0 p-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>退出</Button>
          <Button type="button" disabled={formConfirmed && streaming} onClick={handleConfirm}>
            {formConfirmed ? '添加到作品' : '生成'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
