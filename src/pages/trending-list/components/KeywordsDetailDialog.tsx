import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { createWorkReq } from '@/api/works'
import { Dialog, DialogContent, DialogHeader, type DialogProps, DialogTitle } from '@/components/ui/Dialog'
import type { KeywordsDetailData } from './TrendingCard'

export interface KeywordsDetailDialogProps extends DialogProps {
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
  onOpenChange,
  detailData,
  onDetailDataChange,
  title = '收稿风向',
}: KeywordsDetailDialogProps) => {
  const navigate = useNavigate()
  const [workReference, setWorkReference] = useState(detailData?.workReference ?? '')
  const [description, setDescription] = useState(detailData.description ?? '')

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen)
  }

  const handleClose = () => {
    handleOpenChange(false)
  }

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
    handleClose()

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
          navigate(`/editor/${req.id}`)
        }
      } catch (e) {
        console.error('创建作品失败:', e)
        toast.error('创建作品失败，请重试')
      }
    })
  }

  useEffect(() => {
    if (detailData) {
      setWorkReference(detailData.workReference ?? '')
      setDescription(detailData.description ?? '')
    }
  }, [detailData.workReference, detailData.description, detailData])

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
    >
      <DialogContent className="w-[600px] max-w-none rounded-[20px] p-0">
        <DialogHeader className="px-9 pt-9">
          <DialogTitle className="text-2xl font-semibold leading-[1.32] text-[var(--text-primary)]">
            收稿风向详情
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
