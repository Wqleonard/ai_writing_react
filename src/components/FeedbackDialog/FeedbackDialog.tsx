import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { useOptionsStore } from '@/stores/optionsStore'
import { postSuggestsReq } from '@/api/users'
import clsx from 'clsx'

export interface FeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const FeedbackDialog = ({ open, onOpenChange }: FeedbackDialogProps) => {
  const [content, setContent] = useState('')
  const [showQrCode, setShowQrCode] = useState(false)
  const [loading, setLoading] = useState(false)
  const joinUsQrCode = useOptionsStore((s) => s.joinUsQrCode)

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
  }

  const handleSubmit = async () => {
    const suggest = content.trim()
    if (!suggest) {
      toast.warning('请先输入反馈内容')
      return
    }
    setLoading(true)
    try {
      const req: any = await postSuggestsReq(suggest)
      if (req?.content != null) {
        setShowQrCode(true)
        setContent('')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton
        className={clsx(
          'feedback-dialog w-[332px] min-h-[260px] max-w-[332px] gap-0 p-0',
          'sm:rounded-lg'
        )}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-4 pt-4 pb-0 pr-10">
          <DialogTitle className="text-base font-medium">问题反馈</DialogTitle>
        </DialogHeader>

        <div className="px-4 py-2">
          {!showQrCode ? (
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              placeholder="请详细描述您遇到的问题..."
              className={clsx(
                'resize-none rounded-[10px] border-2 px-3 py-3 text-sm leading-relaxed',
                'border-(--theme-color) focus-visible:border-(--theme-color)',
                'focus-visible:ring-0 focus-visible:ring-offset-0'
              )}
            />
          ) : (
            <div className="flex flex-col items-center gap-3">
              <p className="text-center text-sm leading-relaxed text-(--text-secondary)">
                感谢您的反馈,欢迎加入我们的产品内测群
                <br />
                联系工作人员及时获取产品优化信息及反馈奖励
              </p>
              <div className="flex h-[108px] w-[108px] items-center justify-center overflow-hidden rounded">
                {joinUsQrCode ? (
                  <img
                    src={String(joinUsQrCode)}
                    alt="产品内测群二维码"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">暂无二维码</span>
                )}
              </div>
            </div>
          )}
        </div>

        {!showQrCode && (
          <DialogFooter className="flex-row justify-end gap-2 border-border px-4 py-4">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={loading}>
              {loading ? '提交中...' : '提交'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
