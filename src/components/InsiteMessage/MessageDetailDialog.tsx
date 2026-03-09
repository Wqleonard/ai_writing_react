import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { ScrollArea } from '@/components/ui/ScrollArea'
import type { Message } from '@/stores/loginStore'

export interface MessageDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  message: Message | null
}

export const MessageDetailDialog = ({
  open,
  onOpenChange,
  message,
}: MessageDetailDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="message-detail-dialog w-200">
        <DialogHeader>
          <DialogTitle>{message?.title ?? '消息详情'}</DialogTitle>
        </DialogHeader>
        <div className="h-120">
          {message && (
            <div className="message-detail-content">
              <div className="border-b border-border pb-2">
              <span className="text-sm text-muted-foreground">
                {message.timestamp}
              </span>
              </div>
              <ScrollArea className="h-full">
                <div className="min-h-[100px] py-2">
                  {message.content?.trim() ? (
                    <div
                      className="message-content-text text-sm leading-relaxed text-foreground"
                      dangerouslySetInnerHTML={{ __html: message.content }}
                    />
                  ) : (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      暂无内容
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
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
