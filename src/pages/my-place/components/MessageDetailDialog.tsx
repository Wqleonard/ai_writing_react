import {
  Dialog,
  DialogContent, DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { ScrollArea } from '@/components/ui/ScrollArea'
import type { MessageDetail } from '../types'
import RichTextRender from '@/components/RichTextRender'

export interface MessageDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  message: MessageDetail | null
}

export const MessageDetailDialog = ({
  open,
  onOpenChange,
  message,
}: MessageDetailDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="w-200">
        <DialogHeader className="w-full min-w-0 max-w-[calc(100%-32px)]">
          <DialogTitle className="w-full min-w-0 max-w-full truncate">
            {message?.title || '消息详情'}
          </DialogTitle>
        </DialogHeader>
        <div className="h-120">
          {message ? (
            <div className="message-detail-content">
              <div className="border-b border-gray-200 pb-2">
                {message.timestamp ? (
                  <span className="text-sm text-gray-500">{message.timestamp}</span>
                ) : null}
              </div>
              <ScrollArea className="h-110 py-2">
                <div className="pr-2">
                  {message.content?.trim() ? (
                    <RichTextRender
                      content={message.content}
                      className="message-content-text whitespace-pre-wrap text-sm"
                    />
                  ) : (
                    <div className="text-gray-500">暂无内容</div>
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : null}
        </div>
        <DialogFooter className="flex-row justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
