import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { createWorkReq } from '@/api/works'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import type { SocialDetailData } from './TrendingCard'

export interface SocialDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  detailData: SocialDetailData
  onDetailDataChange: (data: SocialDetailData) => void
  title?: string
}

const HINT_TAGS = ['言情', '情感', '悬疑', '惊悚', '科幻', '武侠', '脑洞', '电竞', '体育']

const isLoggedIn = () => !!localStorage.getItem('token')
const requireLogin = (callback: () => void) => {
  if (isLoggedIn()) callback()
  else window.location.href = '/workspace/my-place'
}

export const SocialDetailDialog = ({
  open,
  onOpenChange,
  detailData,
  onDetailDataChange,
  title = '灵感素材',
}: SocialDetailDialogProps) => {
  const navigate = useNavigate()
  const [mainSubject, setMainSubject] = useState('')
  const [tags, setTags] = useState('')
  const [moreSettings, setMoreSettings] = useState('')

  const handleTagClick = (tag: string) => {
    const current = tags.trim()
    if (current) {
      const tagList = current.split('、').map((t) => t.trim())
      if (!tagList.includes(tag)) setTags(current + '、' + tag)
    } else {
      setTags(tag)
    }
  }

  const handleCreate = async () => {
    if (!mainSubject?.trim()) {
      toast.warning('核心梗必填')
      return
    }
    const nextData: SocialDetailData = {
      ...detailData,
      mainSubject: mainSubject.trim(),
      tags: tags.trim() || undefined,
      moreSettings: moreSettings.trim() || undefined,
    }
    onDetailDataChange(nextData)
    onOpenChange(false)

    const contentParts = [title, nextData.name, '核心梗:', nextData.mainSubject]
    if (nextData.tags) contentParts.push('标签:', nextData.tags)
    if (nextData.moreSettings) contentParts.push('更多设定:', nextData.moreSettings)
    const content = contentParts.join('\n')
    const tagsText = nextData.tags || '无'
    const settingsText = nextData.moreSettings || '无'
    const message = `读取引用中的内容，参考灵感"${nextData.name}"，以"${nextData.mainSubject}"为核心梗提炼出更多适合短篇小说创作的元素，以标签为"${tagsText}"，以设定为"${settingsText}"，创作一篇完整短篇小说`

    requireLogin(async () => {
      try {
        const req: any = await createWorkReq()
        if (req?.id) {
          sessionStorage.setItem(
            'rankingListTransmission',
            JSON.stringify({ content, message })
          )
          navigate(`/editor/${req.id}`)
        }
      } catch (e) {
        console.error('创建作品失败:', e)
        toast.error('创建作品失败，请重试')
      }
    })
  }

  useEffect(() => {
    if (open && detailData) {
      setMainSubject(detailData.mainSubject ?? '')
      setTags(detailData.tags ?? '')
      setMoreSettings(detailData.moreSettings ?? '')
    }
  }, [open, detailData])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[600px] max-w-none rounded-[20px] p-0">
        <DialogHeader className="px-9 pt-9">
          <DialogTitle className="text-2xl font-semibold leading-[1.32] text-[var(--text-primary)]">
            灵感素材详情
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6 px-9 pb-9">
          <div className="category-section flex justify-center align-center mb-2">
            <div className="text-center text-lg font-medium text-[var(--text-primary)]">
              {detailData?.name ?? ''}
            </div>
          </div>

          <div className="form-section flex flex-col gap-3">
            <div className="section-label text-base font-medium text-[var(--text-primary)]">
              核心梗:
            </div>
            <textarea
              value={mainSubject}
              onChange={(e) => setMainSubject(e.target.value)}
              className="w-full resize-none rounded-lg border-none bg-[#f5f5f5] px-3 py-3 text-sm leading-relaxed text-[var(--text-primary)] outline-none placeholder:text-[#999] focus:bg-[#eeeeee]"
              placeholder="输入核心梗，如：时空重叠 + 倒计时等"
              rows={4}
            />
          </div>

          <div className="form-section flex flex-col gap-3">
            <div className="tag-container flex flex-row">
              <div className="section-label text-base font-medium text-[var(--text-primary)]">
                标签:
              </div>
              <div className="ml-2.5 flex flex-wrap gap-2">
                {HINT_TAGS.map((tag) => (
                  <span
                    key={tag}
                    className="cursor-pointer select-none rounded-xl px-2 py-1 text-xs text-[var(--text-primary)] transition-all hover:opacity-80 hover:scale-105 active:scale-95"
                    style={{ background: 'var(--bg-editor-save)' }}
                    onClick={() => handleTagClick(tag)}
                    role="button"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <textarea
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full resize-none rounded-lg border-none bg-[#f5f5f5] px-3 py-3 text-sm leading-relaxed text-[var(--text-primary)] outline-none placeholder:text-[#999] focus:bg-[#eeeeee]"
              placeholder="填入题材、情节等标签信息，以、间隔"
              rows={3}
            />
          </div>

          <div className="form-section flex flex-col gap-3">
            <div className="section-label text-base font-medium text-[var(--text-primary)]">
              更多设定:
            </div>
            <textarea
              value={moreSettings}
              onChange={(e) => setMoreSettings(e.target.value)}
              className="w-full resize-none rounded-lg border-none bg-[#f5f5f5] px-3 py-3 text-sm leading-relaxed text-[var(--text-primary)] outline-none placeholder:text-[#999] focus:bg-[#eeeeee]"
              placeholder="输入更多设定，如世界观、主角人设、金手指等"
              rows={4}
            />
          </div>

          <div className="action-section flex justify-center pt-2">
            <div
              className="h-11 w-[200px] cursor-pointer rounded-[22px] border-none bg-[#f5f5f5] text-base font-medium text-[var(--text-primary)] transition-all hover:bg-[#eeeeee] active:scale-[0.98] text-center leading-[44px]"
              onClick={handleCreate}
            >
              立即创作
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
