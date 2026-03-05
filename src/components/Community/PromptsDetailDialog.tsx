import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  VisuallyHidden,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import type { PromptItem } from './types'

export interface PromptsDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: PromptItem | null
  onUse: (item: PromptItem | null) => void
}

const formatDate = (str: string) => {
  try {
    const d = new Date(str)
    return isNaN(d.getTime())
      ? str
      : d.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
  } catch {
    return str
  }
}

export const PromptsDetailDialog = ({
  open,
  onOpenChange,
  data,
  onUse,
}: PromptsDetailDialogProps) => {
  const handleUse = () => {
    onUse(data)
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[712px] w-[1020px] max-w-[90vw] overflow-auto py-11 px-[60px] pb-8 sm:max-w-[90vw]"
        showCloseButton
      >
        {!data && (
          <VisuallyHidden>
            <DialogTitle>提示词详情</DialogTitle>
          </VisuallyHidden>
        )}
        {data && (
          <div className="w-full h-140 overflow-y-auto flex flex-col">
            <div className="h-10 flex min-w-0 items-center gap-4 pb-2">
              <DialogTitle className="min-w-0 flex-1 truncate text-3xl">
                {data.isOfficial && '【官方】'}{data.name}
              </DialogTitle>
              {data.categories?.map(category => (
                <span
                  key={category.id}
                  className="rounded px-2 py-1 text-sm bg-[#f3f4f6]"
                >
                  {category.name}
                </span>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center">
                <div
                  className="size-5 shrink-0 overflow-hidden rounded-full bg-[#c4c4c4]"
                />
                <div className="ml-1 max-w-[200px] overflow-hidden text-ellipsis">
                  {data.authorName}
                </div>
                <div className="ml-4">{formatDate(data.createdTime)}</div>
              </div>
            </div>
            <div className="flex-1 min-h-0 mt-4 max-h-[472px] overflow-auto whitespace-pre-wrap wrap-break-word rounded-lg p-3 bg-[#f1f1f1]">
              {data.description}
            </div>
          </div>
        )}
        <DialogFooter className="mt-6 flex flex-row-reverse gap-4 border-0 p-0">
          <Button type="button" variant="outline" onClick={handleClose}>
            返回
          </Button>
          <Button type="button" onClick={handleUse}>
            确定使用
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
