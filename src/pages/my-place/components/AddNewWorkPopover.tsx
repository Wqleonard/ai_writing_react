import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { createWorkReq } from '@/api/works'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/Popover'
import { ChevronRight } from 'lucide-react'
import { useLoginStore } from "@/stores/loginStore";
import { trackEvent } from "@/matomo/trackingMatomoEvent.ts";

type From = 'Sidebar' | 'Workspace'
type Placement = 'top' | 'bottom' | 'left' | 'right'

interface WorkTypeItem {
  id: string
  label: string
  description?: string
  isQuick?: boolean
}

const WORK_TYPES: WorkTypeItem[] = [
  { id: 'short-story', label: '短篇', description: '全智能工作台,专业首选', isQuick: false },
  { id: 'short-story-quick', label: '短篇(快捷)', description: '快捷流程创作,成篇速通', isQuick: true },
  { id: 'short-play-quick', label: '短剧(快捷)', description: '小说转剧本,从拆书到完集', isQuick: true },
]

export interface AddNewWorkPopoverProps {
  from?: From
  placement?: Placement
  offset?: number
  /** 触发区域，如“创建新作品”卡片 */
  children: React.ReactNode
}

export const AddNewWorkPopover = ({
  from = 'Workspace',
  placement = 'bottom',
  offset = 2,
  children,
}: AddNewWorkPopoverProps) => {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const requireLogin = useLoginStore(s=>s.requireLogin)

  const addNewWork = useCallback(async () => {
    setLoading(true)
    try {
      const req: any = await createWorkReq()
      if (!req?.id) {
        setLoading(false)
        return
      }
      navigate(`/workspace/editor/${req.id}`, { state: { isNew: true } })
    } catch {
      toast.error('创建作品失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [navigate])

  const addNewQuickWork = useCallback(async () => {
    setLoading(true)
    try {
      const req: any = await createWorkReq('doc' as any)
      if (req?.id) {
        navigate(`/workspace/editor/${req.id}`, { state: { isNew: true } })
      }
    } catch {
      toast.error('创建作品失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [navigate])

  const addNewScript = useCallback(() => {
    toast.info('功能开发中，敬请期待！')
  }, [])

  const handleCreate = useCallback(
    async (type: WorkTypeItem) => {
      switch (type.id) {
        case 'short-story':
          trackEvent('Story Creation', 'Click', 'Common New from Workspace')
          await requireLogin(addNewWork)
          break
        case 'short-story-quick':
          toast.info('敬请期待')
          // requireLogin(addNewQuickWork)
          break
        case 'short-play-quick':
          toast.info('敬请期待')
          // requireLogin(addNewScript)
          break
        default:
          requireLogin(addNewWork)
      }
      setOpen(false)
    },
    [addNewWork, requireLogin]
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="cursor-pointer">{children}</div>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side={placement}
        sideOffset={offset}
        className="w-40 rounded-xl border-0 p-1 shadow-lg"
      >
        <div className="flex flex-col gap-0.5">
          {WORK_TYPES.map((workType) => (
            <div
              key={workType.id}
              className="group flex cursor-pointer flex-col rounded-lg px-1.5 py-1.5 transition-colors hover:bg-gray-100"
              onClick={() => handleCreate(workType)}
            >
              <div className="flex items-center justify-between text-sm font-medium leading-6 text-[#1f1f1f]">
                <span>{workType.label}</span>
                <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100" />
              </div>
              {workType.description ? (
                <div className="mt-1 hidden text-xs leading-snug text-[#757575] group-hover:block">
                  {workType.description}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </PopoverContent>
      {loading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" />
      ) : null}
    </Popover>
  )
}
