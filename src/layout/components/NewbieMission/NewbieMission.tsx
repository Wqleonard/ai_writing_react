import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/Popover'
import IconFont from '@/components/IconFont/Iconfont'
import { useLoginStore } from '@/stores/loginStore'
import type { GuideTask } from '@/api/users'
import { createWorkReq } from '@/api/works'
import { cn } from '@/lib/utils'
import HOVER_BOOM_CAT from '@/assets/images/my-place/hover.gif'
import DEFAULT_BOOM_CAT from '@/assets/images/my-place/default.gif'
import PANEL_OPEN_BOOM_CAT from '@/assets/images/my-place/click.gif'

export const NewbieMission = () => {
  const [open, setOpen] = useState(false)
  const [isCatHover, setIsCatHover] = useState(false)
  const [expandedGroupIndices, setExpandedGroupIndices] = useState<Set<number>>(new Set())
  const catHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const navigate = useNavigate()
  const isLoggedIn = useLoginStore((s) => s.isLoggedIn)
  const missionGroup = useLoginStore((s) => s.missionGroup)
  const updateNewbieMission = useLoginStore((s) => s.updateNewbieMission)
  const getNewbieMissionProgressPercent = useLoginStore((s) => s.getNewbieMissionProgressPercent)
  const setSendIdeaTourShow = useLoginStore((s) => s.setSendIdeaTourShow)

  const newbieMissionProgressPercent = getNewbieMissionProgressPercent()

  const handleCatMouseEnter = () => {
    if (catHoverTimerRef.current) {
      clearTimeout(catHoverTimerRef.current)
      catHoverTimerRef.current = null
    }
    setIsCatHover(true)
    catHoverTimerRef.current = setTimeout(() => {
      setIsCatHover(false)
      catHoverTimerRef.current = null
    }, 200)
  }

  const handleCatMouseLeave = () => {
    if (catHoverTimerRef.current) {
      clearTimeout(catHoverTimerRef.current)
      catHoverTimerRef.current = null
    }
    setIsCatHover(false)
  }

  const handleClose = () => {
    setOpen(false)
  }

  const isGroupExpanded = (groupIndex: number) => expandedGroupIndices.has(groupIndex)

  const toggleGroup = (groupIndex: number) => {
    const next = new Set(expandedGroupIndices)
    if (next.has(groupIndex)) {
      next.delete(groupIndex)
    } else {
      next.add(groupIndex)
    }
    setExpandedGroupIndices(next)
  }

  useEffect(() => {
    if (open) {
      updateNewbieMission()
    }
  }, [open, updateNewbieMission])

  const handleMissionClick = async (mission: GuideTask) => {
    if (mission.children.length && mission.children.length > 0) {
      return
    }

    if (mission.status === 1) {
      return
    }

    // 特殊逻辑
    if (mission.code === 'SEND_CREATIVE_IDEA') {
      setOpen(false)
      navigate('/workspace/my-place')
      setSendIdeaTourShow(true)
      return
    }

    if (mission.code === 'USE_WRITING_EDITOR') {
      try {
        const work = await createWorkReq()
        if (work?.id) {
          navigate(`/editor/${work.id}`, { state: { isNew: true } })
          setOpen(false)
          return
        } else {
          console.error('创建作品失败')
        }
      } catch (error) {
        console.error('创建作品失败:', error)
      }
    }

    if (mission?.linkUrl) {
      navigate(mission.linkUrl)
    }
  }

  if (!isLoggedIn) {
    return (
      <div
        className="fixed -bottom-4 right-28 h-24 w-24"
        onMouseEnter={handleCatMouseEnter}
        onMouseLeave={handleCatMouseLeave}
      >
        <img
          src={open ? PANEL_OPEN_BOOM_CAT : isCatHover ? HOVER_BOOM_CAT : DEFAULT_BOOM_CAT}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className="fixed -bottom-4 right-28 h-24 w-24 cursor-pointer"
          onMouseEnter={handleCatMouseEnter}
          onMouseLeave={handleCatMouseLeave}
        >
          <img
            src={open ? PANEL_OPEN_BOOM_CAT : isCatHover ? HOVER_BOOM_CAT : DEFAULT_BOOM_CAT}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[340px] rounded-[10px] p-4"
        align="end"
        side="top"
        sideOffset={8}
      >
        <div className="flex w-full flex-col">
          <div className="flex items-center justify-between">
            <div className="text-base font-semibold text-[#f8a001]">新手指南</div>
            <div
              className="h-5 w-5 cursor-pointer rounded-sm text-center text-base leading-5 hover:bg-gray-200"
              onClick={handleClose}
            >
              <IconFont unicode="&#xe633;" />
            </div>
          </div>

          <div className="mt-2.5 text-[#999999]">完成剩余任务，即可获得全额新手奖励</div>
          <div
            className="relative mt-2 h-1 w-full overflow-hidden rounded-full bg-[#d9d9d9] after:absolute after:left-0 after:top-0 after:h-full after:rounded-full after:bg-[#f3a901] after:transition-[width] after:duration-300 after:content-['']"
            style={{ '--progress': newbieMissionProgressPercent } as React.CSSProperties & { '--progress': string }}
          >
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-[#f3a901] transition-[width] duration-300"
              style={{ width: newbieMissionProgressPercent }}
            />
          </div>

          {/* 任务区域 */}
          <div className="mt-5 flex flex-col gap-2.5">
            {missionGroup.map((group, groupIndex) => (
              <div
                key={group.taskId ?? groupIndex}
                className="flex flex-col gap-2 rounded-[10px] border border-[#ebebeb] py-2 px-1"
                onClick={() => handleMissionClick(group)}
              >
                {/* 第一条始终展示 */}
                <div 
                  className="flex h-5 w-full items-center justify-between px-1 rounded-sm hover:bg-gray-200 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleGroup(groupIndex)
                  }}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-1">
                    {group?.status === 1 ? (
                      <div className="h-3.5 w-3.5 shrink-0 rounded-full bg-[#f8a001] text-center text-[8px] leading-3.5 text-white">
                        <IconFont unicode="&#xe610;" />
                      </div>
                    ) : (
                      <div className="h-3.5 w-3.5 rounded-full border border-[#ebebeb]" />
                    )}
                    <div
                      className={cn(
                        'truncate text-sm text-[#999999]',
                        group?.status === 1 && 'line-through',
                        group?.children.length === 0 &&
                          group.linkUrl &&
                          group?.status === 0 &&
                          'cursor-pointer hover:underline'
                      )}
                    >
                      {group.name}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <div
                      className={cn(
                        'text-sm',
                        group?.status === 0 ? 'text-[#999999]' : 'text-[#f8a001]'
                      )}
                    >
                      +{Math.floor((group?.rewardPoints || 0) / 1000)}
                    </div>
                    <div className="w-4">
                      {group.children.length > 1 && (
                        <div
                          className={cn(
                            'w-full cursor-pointer select-none text-center text-gray-500 transition-transform duration-300 ease-in-out',
                            isGroupExpanded(groupIndex) && 'rotate-180'
                          )}
                        >
                          <IconFont unicode="&#xeaa1;"/>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 其余条用展开/收起 */}
                {(group.children.length > 1 && isGroupExpanded(groupIndex)) && (
                  <div
                    className={cn(
                      'grid transition-all duration-300 ease-in-out',
                      isGroupExpanded(groupIndex)
                        ? 'grid-rows-[1fr] opacity-100'
                        : 'grid-rows-[0fr] opacity-0'
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="flex flex-col gap-2">
                        {group.children.map((mission, missionIndex) => (
                          <div
                            key={`${groupIndex}-${missionIndex}-${mission.taskId}`}
                            className={
                              cn(
                                "relative px-1 flex items-center justify-between after:absolute after:bottom-[-9px] after:left-[6px] after:h-[10px] after:w-px after:bg-[#cfcfcf] after:content-[''] last:after:hidden",
                                "rounded-sm hover:bg-gray-200 cursor-pointer"
                              )
                            }
                            onClick={(e) => {
                              e.stopPropagation()
                              handleMissionClick(mission)
                            }}
                          >
                            <div className="flex h-5 w-full items-center justify-between">
                              <div className="flex min-w-0 flex-1 items-center gap-1">
                                {mission.status === 1 ? (
                                  <div className="h-3.5 w-3.5 shrink-0 rounded-full bg-[#f8a001] text-center text-[8px] leading-3.5 text-white">
                                    <IconFont unicode="&#xe610;" />
                                  </div>
                                ) : (
                                  <div className="h-3.5 w-3.5 rounded-full border border-[#ebebeb]" />
                                )}
                                <div
                                  className={cn(
                                    'truncate text-sm text-[#999999]',
                                    mission.status === 1 && 'line-through',
                                    mission.linkUrl &&
                                      mission.status === 0 &&
                                      'cursor-pointer hover:underline'
                                  )}
                                >
                                  {mission.name}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <div
                                  className={cn(
                                    'text-sm',
                                    mission.status === 0 ? 'text-[#999999]' : 'text-[#f8a001]'
                                  )}
                                >
                                  +{Math.floor((mission?.rewardPoints || 0) / 1000)}
                                </div>
                                <div className="w-4" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
