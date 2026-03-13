import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { ScrollArea } from '@/components/ui/ScrollArea'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import MarkdownEditor from '@/components/MarkdownEditor'
import {
  createEmptyShare,
  getShareDetail,
  publishShare,
  saveDraft,
  type PublishShareRequest,
  type SaveDraftRequest,
  type ShareDetailResponse,
} from '@/api/share'

const MAX_TITLE_LENGTH = 50

const ShareCreatePage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [shareId, setShareId] = useState('')
  const [loading, setLoading] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [isNewShare, setIsNewShare] = useState(false)

  const titleLength = useMemo(() => title.length, [title])

  const loadShareDetail = useCallback(async (detailId: string) => {
    setLoading(true)
    try {
      const response = (await getShareDetail(detailId)) as ShareDetailResponse
      if (response) {
        setTitle(response.title || '')
        setContent(response.content || '')
        setShareId(String(response.id))
      }
    } catch (error) {
      console.error('加载分享详情失败:', error)
      toast.error('加载分享详情失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [])

  const createShare = useCallback(async () => {
    try {
      const created = await createEmptyShare()
      const createdId =
        typeof created === 'number'
          ? created
          : typeof created === 'string'
            ? Number(created)
            : Number((created as { id?: number | string } | null)?.id)

      if (Number.isFinite(createdId) && createdId > 0) {
        setShareId(String(createdId))
        return String(createdId)
      }
      return ''
    } catch (error) {
      console.error('创建分享失败:', error)
      toast.error('创建分享失败，请稍后重试')
      return ''
    }
  }, [])

  const ensureShareId = useCallback(async () => {
    if (shareId) return shareId
    if (!isNewShare) return ''
    return createShare()
  }, [createShare, isNewShare, shareId])

  const validateForm = useCallback(() => {
    if (!title.trim()) {
      toast.warning('请输入标题')
      return false
    }
    if (!content.trim()) {
      toast.warning('请输入内容')
      return false
    }
    return true
  }, [content, title])

  const handleSaveDraft = useCallback(async () => {
    if (!validateForm()) return

    setSavingDraft(true)
    try {
      const ensuredShareId = await ensureShareId()
      if (!ensuredShareId) return

      const data: SaveDraftRequest = {
        title: title.trim(),
        coverImageUrl: '',
        content: content.trim(),
      }
      await saveDraft(ensuredShareId, data)
      toast.success('保存草稿成功')
    } catch (error) {
      console.error('保存草稿失败:', error)
      toast.error('保存草稿失败，请稍后重试')
    } finally {
      setSavingDraft(false)
    }
  }, [content, ensureShareId, title, validateForm])

  const handlePublish = useCallback(async () => {
    if (!validateForm()) return

    setPublishing(true)
    try {
      const ensuredShareId = await ensureShareId()
      if (!ensuredShareId) return

      const data: PublishShareRequest = {
        title: title.trim(),
        coverImageUrl: '',
        content: content.trim(),
      }
      await publishShare(ensuredShareId, data)
      toast.success('已提交审核')
      setTimeout(() => {
        navigate(-1)
      }, 500)
    } catch (error) {
      console.error('发布失败:', error)
      toast.error('发布失败，请稍后重试')
    } finally {
      setPublishing(false)
    }
  }, [content, ensureShareId, navigate, title, validateForm])

  const goBack = useCallback(() => {
    navigate(-1)
  }, [navigate])

  useEffect(() => {
    if (id && id !== 'new') {
      setIsNewShare(false)
      setShareId(id)
      loadShareDetail(id)
      return
    }
    setIsNewShare(true)
  }, [id, loadShareDetail])

  return (
    <div className="share-create-container flex h-full flex-col items-center px-2">
      <header className="flex h-8 w-265 items-center">
        <Button variant="link" className="text-base text-[#666]" onClick={goBack}>
          <ArrowLeft className="size-5" />
          <span>返回</span>
        </Button>
      </header>

      <div className="mx-auto flex min-h-0 flex-1 w-full">
        <ScrollArea className="h-full w-full">
          <div className="flex w-full flex-col items-center">
            <div className="flex w-265 flex-col items-center">
              <div className="py-4 text-3xl font-bold">创建分享</div>

              <div className="mb-5 flex w-full items-start">
                <div className="mt-1 w-20 shrink-0 text-left text-lg text-[#333]">
                  标题
                  <span className="ml-0.5 text-[#f56c6c]">*</span>
                </div>
                <div className="relative flex-1">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="请输入标题"
                    maxLength={MAX_TITLE_LENGTH}
                    className="h-11 rounded-[10px] pr-20 text-lg bg-white"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#999]">
                    {titleLength}/{MAX_TITLE_LENGTH}
                  </span>
                </div>
              </div>

              <div className="mb-7.5 flex w-full items-start">
                <div className="mt-1 w-20 shrink-0 text-left text-lg text-[#333]">
                  内容
                  <span className="ml-0.5 text-[#f56c6c]">*</span>
                </div>
                <div className="flex-1">
                  <div className="min-h-[500px] overflow-hidden rounded-[10px] border border-[#e5e5e5] bg-white p-4">
                    <MarkdownEditor
                      value={content}
                      onChange={setContent}
                      placeholder="请输入内容"
                      needSelectionToolbar={false}
                      btns={[]}
                      minHeight={500}
                      className="h-full"
                    />
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="mb-5 w-full text-center text-sm text-gray-500">加载中...</div>
              ) : null}

              <div className="flex w-full justify-end gap-3 pb-10">
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={publishing || loading}
                >
                  {savingDraft ? '保存中...' : '保存'}
                </Button>
                <Button
                  variant="default"
                  onClick={handlePublish}
                  disabled={savingDraft || loading}
                >
                  {publishing ? '发布中...' : '发布'}
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

export default ShareCreatePage
