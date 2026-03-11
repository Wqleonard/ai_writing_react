"use client"

import { useCallback, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover"
import { Button } from "@/components/ui/Button"
import { createWorkReq } from "@/api/works"
import { cn } from "@/lib/utils"
import { useLoginStore } from "@/stores/loginStore";
import { trackEvent } from "@/matomo/trackingMatomoEvent"


interface WorkType {
  id: string
  label: string
  description?: string
  isQuick?: boolean
}

const WORK_TYPES: WorkType[] = [
  {
    id: "short-story",
    label: "短篇",
    description: "全智能工作台,专业首选",
    isQuick: false,
  },
  {
    id: "short-story-quick",
    label: "短篇(快捷)",
    description: "快捷流程创作,成篇速通",
    isQuick: true,
  },
  {
    id: "short-play-quick",
    label: "短剧(快捷)",
    description: "小说转剧本,从拆书到完集",
    isQuick: true,
  },
]

function useDebouncedCallback<T extends (...args: any[]) => any>(
  fn: T,
  wait: number,
  options: { leading: boolean; trailing: boolean }
) {
  const lastCallRef = useRef<number>(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now()
      if (options.leading && now - lastCallRef.current >= wait) {
        lastCallRef.current = now
        fn(...args)
        return
      }
      if (options.trailing) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = null
          fn(...args)
        }, wait)
      }
    },
    [fn, wait, options.leading, options.trailing]
  )
}

type Side = "top" | "right" | "bottom" | "left"
type  Align = "start" | "center" | "end"

export interface AddNewWorkPopoverProps {
  /** 来源：Sidebar | Workspace，可用于埋点 */
  from?: "Sidebar" | "Workspace"
  popperClass?: string
  offset?: number
  side?: Side
  align?: Align
  isSidebar?: boolean
  /** 自定义触发区域，不传则使用默认「创建新作品 +」按钮 */
  children?: React.ReactNode
}

export const AddNewWorkPopover = (
  {
    popperClass = "",
    offset = 4,
    children,
    side = "top",
    align = 'center',
    isSidebar = false
  }: AddNewWorkPopoverProps) => {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const requireLogin = useLoginStore(s => s.requireLogin)

  const addNewWork = useCallback(async () => {
    try {
      setLoading(true)
      const req = await createWorkReq('editor')
      if (!req?.id) return
      navigate(`/editor/${req.id}`, { state: { isNew: true } })
    } catch {
      toast.error("创建作品失败，请重试")
    } finally {
      setLoading(false)
    }
  }, [navigate])

  const addNewQuickWork = useCallback(async () => {
    try {
      setLoading(true)
      const req = await createWorkReq("doc")
      if (req?.id) {
        await navigate(`/quick-editor/${req.id}`, { state: { isNew: true } })
      }
    } catch {
      toast.error("创建作品失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }, [navigate])

  const addNewScript = useCallback(async () => {
    try {
      setLoading(true)
      const req = await createWorkReq("script")
      if (req?.id) {
        navigate(`/script-editor/${req.id}`, { state: { isNew: true } })
      }
    } catch {
      toast.error("创建作品失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }, [navigate])

  const debouncedAddNewWork = useDebouncedCallback(
    () => requireLogin(addNewWork),
    1000,
    { leading: true, trailing: false }
  )
  const debouncedAddNewQuickWork = useDebouncedCallback(
    () => requireLogin(addNewQuickWork),
    1000,
    { leading: true, trailing: false }
  )
  const debouncedAddNewScript = useDebouncedCallback(
    () => requireLogin(addNewScript),
    1000,
    { leading: true, trailing: false }
  )

  const handleCreate = useCallback(
    (type: WorkType) => {
      switch (type.id) {
        case "short-story":
          if (isSidebar){
            trackEvent('Story Creation', 'Click', 'Common New from Sidebar')
          } else {
            trackEvent('Story Creation', 'Click', 'Common New from Workspace')
          }
          debouncedAddNewWork()
          break
        case "short-story-quick":
          if (isSidebar){
            trackEvent('Story Creation', 'Click', 'Quick New from Sidebar')
          } else {
            trackEvent('Story Creation', 'Click', 'Quick New from Workspace')
          }
          debouncedAddNewQuickWork()
          break
        case "short-play-quick":
          if (isSidebar){
            trackEvent('Story Creation', 'Click', 'Script New from Sidebar')
          } else {
            trackEvent('Story Creation', 'Click', 'Script New from Workspace')
          }
          debouncedAddNewScript()
          break
        default:
          if (isSidebar){
            trackEvent('Story Creation', 'Click', 'Common New from Sidebar')
          } else {
            trackEvent('Story Creation', 'Click', 'Common New from Workspace')
          }
          debouncedAddNewWork()
          break
      }
      setOpen(false)
    },
    [debouncedAddNewQuickWork, debouncedAddNewScript, debouncedAddNewWork, isSidebar]
  )

  const triggerButton = children ?? (
    <Button
      type="button"
      className="bg-[#1f1f1f] border-[#1f1f1f] text-white rounded-lg px-6 py-3 text-sm font-medium hover:bg-[#2d2d2d] hover:border-[#2d2d2d]"
    >
      创建新作品 +
    </Button>
  )

  return (
    <div className="relative">
      {loading && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20"
          aria-hidden
        >
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-[#1f1f1f]/30 border-t-[#1f1f1f]"
            role="status"
            aria-label="加载中"
          />
        </div>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
        <PopoverContent
          align={align}
          side={side}
          sideOffset={offset}
          className={cn(
            "w-[160px] rounded-xl p-0 shadow-[0_4px_12px_rgba(0,0,0,0.15)]",
            popperClass
          )}
        >
          <div className="flex w-full flex-col gap-0.5 p-1">
            {WORK_TYPES.map((workType) => (
              <button
                key={workType.id}
                type="button"
                className="group flex cursor-pointer flex-col rounded-lg p-1.5 transition-colors duration-200 hover:bg-gray-100"
                onClick={() => handleCreate(workType)}
              >
                <div className="flex items-center justify-between text-sm font-medium leading-6 text-[#1f1f1f]">
                  <span>{workType.label}</span>
                  <span className="hidden rounded-full group-hover:inline-block [font-family:iconfont]">
                    &#xe736;
                  </span>
                </div>
                <div className="mt-1 hidden leading-[1.4] text-xs text-[#757575] group-hover:block">
                  {workType.description}
                </div>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
