import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { createWorkReq } from '@/api/works'
import type { KeywordsDetailData } from './TrendingCard'

export interface KeywordsDetailDialogProps {
  open: boolean
  onClose: () => void
  detailData: KeywordsDetailData
  onDetailDataChange: (data: KeywordsDetailData) => void
  title?: string
}

const isLoggedIn = () => !!localStorage.getItem('token')
const requireLogin = (callback: () => void) => {
  if (isLoggedIn()) callback()
  else window.location.href = '/workspace/my-place'
}

export const KeywordsDetailDialog = ({
  open,
  onClose,
  detailData,
  onDetailDataChange,
  title = '收稿风向',
}: KeywordsDetailDialogProps) => {
  const navigate = useNavigate()
  const [workReference, setWorkReference] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (open && detailData) {
      setWorkReference(detailData.workReference ?? '')
      setDescription(detailData.description ?? '')
    }
  }, [open, detailData])

  const handleCreate = async () => {
    if (!workReference?.trim()) {
      toast.warning('参考作品必填')
      return
    }
    const nextData: KeywordsDetailData = {
      ...detailData,
      workReference: workReference.trim(),
      description: description.trim(),
    }
    onDetailDataChange(nextData)
    onClose()

    const contentParts = [
      title,
      nextData.name,
      '参考作品:',
      nextData.workReference,
      '编辑要求:',
      nextData.description || '无',
    ]
    const content = contentParts.join('\n')
    const message = `读取引用中内容，提取"参考作品"的标题特征，严格按照文件中"编辑要求"，完成一部以${nextData.name}为类型的短篇小说`

    requireLogin(async () => {
      try {
        const req: any = await createWorkReq()
        if (req?.id) {
          sessionStorage.setItem(
            'rankingListTransmission',
            JSON.stringify({ content, message })
          )
          navigate(`/workspace/editor/${req.id}`)
        }
      } catch (e) {
        console.error('创建作品失败:', e)
        toast.error('创建作品失败，请重试')
      }
    })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center" role="dialog">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        className="relative w-[600px] overflow-hidden rounded-[20px] bg-[var(--bg-primary)] shadow-lg"
        style={{ padding: 0 }}
      >
        <div className="flex items-start justify-between px-9 pt-9">
          <h2 className="m-0 text-2xl font-semibold leading-[1.32] text-[var(--text-primary)]">
            收稿风向详情
          </h2>
          <button
            type="button"
            className="flex h-[22px] w-[22px] flex-shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0"
            onClick={onClose}
            aria-label="关闭"
          >
            <span className="text-[28px] font-light leading-none text-black">×</span>
          </button>
        </div>

        <div className="flex flex-col gap-6 px-9 pb-9">
          <div className="category-section flex justify-center align-center mb-2">
            <div className="text-center text-lg font-medium text-[var(--text-primary)]">
              {detailData?.name ?? ''}
            </div>
          </div>

          <div className="form-section flex flex-col gap-3">
            <div className="section-label text-base font-medium text-[var(--text-primary)]">
              参考作品:
            </div>
            <textarea
              value={workReference}
              onChange={(e) => setWorkReference(e.target.value)}
              className="w-full resize-none rounded-lg border-none bg-[#f5f5f5] px-3 py-3 text-sm leading-relaxed text-[var(--text-primary)] outline-none placeholder:text-[#999] focus:bg-[#eeeeee]"
              placeholder="输入参考作品"
              rows={4}
            />
          </div>

          <div className="form-section flex flex-col gap-3">
            <div className="section-label text-base font-medium text-[var(--text-primary)]">
              编辑要求:
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full resize-none rounded-lg border-none bg-[#f5f5f5] px-3 py-3 text-sm leading-relaxed text-[var(--text-primary)] outline-none placeholder:text-[#999] focus:bg-[#eeeeee]"
              placeholder="输入编辑要求"
              rows={6}
            />
          </div>

          <div className="action-section flex justify-center pt-2">
            <button
              type="button"
              className="h-11 w-[200px] cursor-pointer rounded-[22px] border-none bg-[#f5f5f5] text-base font-medium text-[var(--text-primary)] transition-all hover:bg-[#eeeeee] active:scale-[0.98]"
              onClick={handleCreate}
            >
              立即创作
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
