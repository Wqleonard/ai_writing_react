import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Iconfont } from '@/components/IconFont'
import { SelectConnectedFile } from './SelectConnectedFile'
import type { PromptItem } from './types'
import type { ConnectedFile, FileTreeNode } from './types'
import { AutoScrollArea } from '../AutoScrollArea'
import MarkdownEditor from '../MarkdownEditor'
import { LinkButton } from '../ui/LinkButton'
import { getContentFromPartial } from '@/utils/getWorkFlowPartialData'
import type { PostStreamData } from '@/api'
import {
  introductionPostStream,
  outlinePostStream,
  characterPostStream,
  worldPostStream,
  chapterPostStream,
} from '@/api/editor-header-toolbar'
import { postPublicPromptStream } from '@/api/community-prompt'
import { handleGenerationSave } from '@/utils/handleGenerationSave'
import { toast } from 'sonner'
import { trackEvent } from '@/matomo/trackingMatomoEvent'
import { cn } from '@/lib/utils'

export interface PublicGenerateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: PromptItem | null
  onOpenMarket: (prompt: PromptItem | null) => void
  onSave?: (saveId: string) => void
}

function deduplicateAndFilterFiles(files: FileTreeNode[]): FileTreeNode[] {
  if (!Array.isArray(files) || files.length === 0) return []
  const collectNodes = (node: FileTreeNode): FileTreeNode[] => {
    const collected: FileTreeNode[] = []
    if (node.children?.length) {
      for (const child of node.children) collected.push(...collectNodes(child))
    }
    if (node.fileType === 'md') collected.push(node)
    return collected
  }
  const all = files.flatMap(collectNodes)
  const unique = new Map<string, FileTreeNode>()
  for (const n of all) if (!unique.has(n.id)) unique.set(n.id, n)
  return Array.from(unique.values())
}

export const PublicGenerateDialog = ({
  open,
  onOpenChange,
  data,
  onOpenMarket,
  onSave,
}: PublicGenerateDialogProps) => {
  const [generateRequire, setGenerateRequire] = useState('')
  const [showRequireWarning, setShowRequireWarning] = useState(false)
  const [connectedFileModel, setConnectedFileModel] = useState<ConnectedFile>({
    work: null,
    file: [],
  })
  const [generateMode, setGenerateMode] = useState(false)
  const [generateLoading, setGenerateLoading] = useState(false)
  const [markdownContent, setMarkdownContent] = useState('')
  const [markdownEditing, setMarkdownEditing] = useState(false)

  const streamAbortControllerRef = useRef<AbortController | null>(null)
  const formModelSnapshotRef = useRef<any>(null)

  const getCurrentFormModel = useCallback((): any => {
    if (!data?.categories?.length) return null
    const categoryId = data.categories[0].id
    const promptId = String(data.id)
    const workId = connectedFileModel.work?.id ? String(connectedFileModel.work.id) : ''
    const description = generateRequire.trim()
    const relatedFiles = deduplicateAndFilterFiles(connectedFileModel.file).map((item) => item.id)

    switch (categoryId) {
      case 1:
        return { promptId, workId, description, relatedFiles }
      case 2:
        return { promptId, workId, theme: description, description, chapterNum: 10, relatedFiles }
      case 3:
        return { promptId, workId, description, roleNumber: 5, relatedFiles }
      case 4:
        return { promptId, workId, description, relatedFiles }
      case 5:
        return { promptId, workId, theme: description, description, relatedFiles }
      default:
        return {
          description,
          systemPrompt: data.description || '',
        }
    }
  }, [data, generateRequire, connectedFileModel])

  const isFormModelChanged = useCallback((): boolean => {
    if (formModelSnapshotRef.current == null) return true
    const current = getCurrentFormModel()
    if (!current) return true
    return (
      JSON.stringify(formModelSnapshotRef.current) !== JSON.stringify(current)
    )
  }, [getCurrentFormModel])

  const handleStreamData = useCallback((streamData: PostStreamData) => {
    switch (streamData.event) {
      case 'messages/partial':
        setMarkdownContent(getContentFromPartial(streamData.data))
        break
      case 'updates': {
        const generate_content = streamData?.data?.generate_content
        if (generate_content?.content && generate_content?.finished === true) {
          setMarkdownContent(generate_content.content)
        }
        break
      }
      case 'end':
        break
    }
  }, [])

  const handleStreamComplete = useCallback(() => {
    setGenerateLoading(false)
    streamAbortControllerRef.current = null
  }, [])

  const handleStreamError = useCallback((error: unknown) => {
    console.error('生成失败:', error)
    setGenerateLoading(false)
    streamAbortControllerRef.current = null
    formModelSnapshotRef.current = null
  }, [])

  const executeStreamGeneration = useCallback(async () => {
    if (!generateRequire.trim() || !data?.categories?.length) {
      toast.warning('请输入需求')
      return
    }

    if (streamAbortControllerRef.current) {
      streamAbortControllerRef.current.abort()
    }

    setMarkdownContent('')
    setGenerateLoading(true)
    setMarkdownEditing(false)

    const categoryId = data.categories[0].id
    streamAbortControllerRef.current = new AbortController()
    const currentFormModel = getCurrentFormModel()
    formModelSnapshotRef.current = JSON.parse(JSON.stringify(currentFormModel))

    const config = { signal: streamAbortControllerRef.current.signal }

    try {
      let streamPromise: Promise<void>
      switch (categoryId) {
        case 1:
          streamPromise = introductionPostStream(
            currentFormModel,
            handleStreamData,
            handleStreamError,
            handleStreamComplete,
            config
          )
          break
        case 2:
          streamPromise = outlinePostStream(
            currentFormModel,
            handleStreamData,
            handleStreamError,
            handleStreamComplete,
            config
          )
          break
        case 3:
          streamPromise = characterPostStream(
            currentFormModel,
            handleStreamData,
            handleStreamError,
            handleStreamComplete,
            config
          )
          break
        case 4:
          streamPromise = worldPostStream(
            currentFormModel,
            handleStreamData,
            handleStreamError,
            handleStreamComplete,
            config
          )
          break
        case 5:
          streamPromise = chapterPostStream(
            currentFormModel,
            handleStreamData,
            handleStreamError,
            handleStreamComplete,
            config
          )
          break
        default:
          streamPromise = postPublicPromptStream(
            currentFormModel,
            handleStreamData,
            handleStreamError,
            handleStreamComplete,
            config
          )
      }
      await streamPromise
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setGenerateLoading(false)
        streamAbortControllerRef.current = null
        return
      }
      console.error('调用流式接口失败:', err)
      setGenerateLoading(false)
      streamAbortControllerRef.current = null
      formModelSnapshotRef.current = null
      toast.error('生成失败，请重试')
    }
  }, [
    generateRequire,
    data,
    getCurrentFormModel,
    handleStreamData,
    handleStreamError,
    handleStreamComplete,
  ])

  useEffect(() => {
    if (!open) return
    return () => {
      if (streamAbortControllerRef.current) {
        streamAbortControllerRef.current.abort()
        streamAbortControllerRef.current = null
      }
      setGenerateRequire('')
      setGenerateMode(false)
      setGenerateLoading(false)
      setMarkdownEditing(false)
      setMarkdownContent('')
      setConnectedFileModel({ work: null, file: [] })
      formModelSnapshotRef.current = null
    }
  }, [open])

  useEffect(() => {
    if (open && data?.categories[0]?.id) {
      let type: 'Outline' | 'Character' | 'Lead' | 'Chapter' | 'Worldview' = 'Lead'
      const categoryId = data?.categories?.[0]?.id
      if (categoryId === 1) {
        type = 'Lead'
      } else if (categoryId === 2) {
        type = 'Outline'
      } else if (categoryId === 3) {
        type = 'Character'
      } else if (categoryId === 4) {
        type = 'Worldview'
      } else if (categoryId === 5) {
        type = 'Chapter'
      }
      trackEvent('AI Tool', 'Click', type)
    }
  }, [open, data?.categories])

  const handleAddToWork = useCallback(async () => {
    try {
      const name = `${data?.categories?.[0]?.name || ''}(来自生成器)`
      const saveId = await handleGenerationSave(name, markdownContent)
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
  }, [data, markdownContent, onSave, onOpenChange])

  const doGenerateTrack = useCallback(() => {
    const categoryId = data?.categories?.[0]?.id
    if (categoryId === 1) {
      trackEvent('AI Tool', 'Generate', 'Lead')
    } else if (categoryId === 2) {
      trackEvent('AI Tool', 'Generate', 'Outline')
    } else if (categoryId === 3) {
      trackEvent('AI Tool', 'Generate', 'Character')
    } else if (categoryId === 4) {
      trackEvent('AI Tool', 'Generate', 'Worldview')
    } else if (categoryId === 5) {
      trackEvent('AI Tool', 'Generate', 'Chapter')
    }
  }, [data?.categories])

  const doResultUseTrack = useCallback(() => {
    const categoryId = data?.categories?.[0]?.id
    if (categoryId === 1) {
      trackEvent('AI Tool', 'Use', 'Lead')
    } else if (categoryId === 2) {
      trackEvent('AI Tool', 'Use', 'Outline')
    } else if (categoryId === 3) {
      trackEvent('AI Tool', 'Use', 'Character')
    } else if (categoryId === 4) {
      trackEvent('AI Tool', 'Use', 'Worldview')
    } else if (categoryId === 5) {
      trackEvent('AI Tool', 'Use', 'Chapter')
    }
  }, [data?.categories])

  const handleGenerateConfirm = useCallback(async () => {
    if (!generateMode) {
      doGenerateTrack()
      setShowRequireWarning(false)
      if (!generateRequire.trim()) {
        setShowRequireWarning(true)
        return
      }
      setGenerateMode(true)
      setMarkdownContent('')
      if (isFormModelChanged()) {
        await executeStreamGeneration()
      } else {
        setGenerateLoading(false)
      }
      return
    }
    if (generateLoading) return
    doResultUseTrack()
    await handleAddToWork()
  }, [
    generateMode,
    generateRequire,
    generateLoading,
    isFormModelChanged,
    executeStreamGeneration,
    handleAddToWork,
    doGenerateTrack,
    doResultUseTrack
  ])

  const handleRegenerate = useCallback(() => {
    executeStreamGeneration()
  }, [executeStreamGeneration])

  const handleClose = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[1020px] max-w-[90vw] overflow-auto py-11 px-[140px] pb-8 sm:max-w-[90vw]"
        showCloseButton
      >
        <DialogHeader className="relative h-9 min-h-0 shrink-0 gap-0 p-0">
          <DialogTitle className="h-9 min-h-0 overflow-hidden text-center text-2xl leading-9">
            {data?.categories?.[0]?.name || ''}生成器
          </DialogTitle>
          {generateMode && (
            <Button
              variant="ghost"
              size="icon-lg"
              className="size-8 absolute left-0 top-1/2 -translate-y-1/2"
              onClick={() => setGenerateMode(false)}
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setGenerateMode(false)}
            >
              <Iconfont unicode="&#xe62a;" />
            </Button>
          )}
        </DialogHeader>
        {data && (
          <div className="h-144 min-w-0 max-w-full w-full">
            {!generateMode ? (
              <>
                <div className="mt-4 flex min-w-0 flex-col gap-4">
                  <div>
                    <div className="text-lg">提示词</div>
                    <div
                      role="button"
                      className="mt-1.5 flex h-20 cursor-pointer items-center justify-between rounded-lg bg-[#f7f7f7] px-4"
                      onClick={() => onOpenMarket(data)}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 overflow-hidden text-ellipsis text-lg">
                            {data.name}
                          </div>
                          {data.categories?.map(c => (
                            <span
                              key={c.id}
                              className="py-1 rounded px-2 text-xs bg-[#dedede] shrink-0"
                            >
                              {c.name}
                            </span>
                          ))}
                        </div>
                        <div className="text-sm text-[#666]">@{data.authorName}</div>
                      </div>
                      <Iconfont unicode="&#xeaa5;" className="text-2xl" />
                    </div>
                  </div>
                  <div className="relative">
                    <div className="text-lg">
                      输入需求 <span className="text-red-500">*</span>
                    </div>
                    <Textarea
                      value={generateRequire}
                      onChange={e => setGenerateRequire(e.target.value)}
                      placeholder={data.userExample || '请输入需求...'}
                      rows={5}
                    />
                    {showRequireWarning && (
                      <div className="absolute left-0 bottom-[-20px] text-xs text-red-500">
                        请输入需求
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-lg">关联作品</div>
                    <div className="mt-1.5">
                      <SelectConnectedFile
                        value={connectedFileModel}
                        onChange={setConnectedFileModel}
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <AutoScrollArea
                  className={cn(
                    'mt-2 h-[500px] rounded-lg bg-[#f6f6f6] p-3',
                    markdownEditing && 'outline-2 outline-(--theme-color)'
                  )}
                  maxHeight="500px"
                  autoScroll
                >
                  <MarkdownEditor
                    value={markdownContent}
                    onChange={e => setMarkdownContent(e)}
                    readonly={!markdownEditing}
                    placeholder="请等待输出..."
                  />
                </AutoScrollArea>
                <div className="mt-4 flex justify-center gap-4">
                  <LinkButton
                    type="button"
                    variant="ghost"
                    disabled={generateLoading}
                    onClick={handleRegenerate}
                    className="text-[#909399] text-sm"
                  >
                    <Iconfont unicode="&#xe66f;" className='mr-1'/>
                    <span>重新生成</span>
                  </LinkButton>
                  <LinkButton
                    type="button"
                    variant="ghost"
                    disabled={generateLoading}
                    onClick={() => setMarkdownEditing(!markdownEditing)}
                    className="text-[#909399] text-sm"
                  >
                    <Iconfont unicode="&#xea48;" className='mr-1'/>
                    <span>{markdownEditing ? '完成' : '编辑'}</span>
                  </LinkButton>
                </div>
              </>
            )}
          </div>
        )}
        <DialogFooter className="flex flex-row-reverse gap-4 border-0 p-0">
          <Button type="button" variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button
            type="button"
            disabled={generateMode && generateLoading}
            onClick={handleGenerateConfirm}
          >
            {generateMode ? '添加到作品' : '生成'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
