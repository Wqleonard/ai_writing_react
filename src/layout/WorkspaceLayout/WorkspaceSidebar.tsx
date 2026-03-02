import { useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import LOGO from '@/assets/images/logo.webp'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip'
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/Popover'
import { clsx } from 'clsx'
import { AddNewWorkPopover } from '@/components/AddNewWorkPopover'
import { Iconfont } from '@/components/IconFont'
import { useOptionsStore } from '@/stores/optionsStore'
import { openFeedbackDialog } from '@/components/FeedbackDialog'

interface MenuChild {
  title: string
  route: string
  routeName: string
}

interface MenuItem {
  title: string
  route: string
  routeName: string
  /** iconfont unicode，如 '\ue607' */
  icon: string
  children?: MenuChild[]
}

const menuData: MenuItem[] = [
  {
    title: '我的空间',
    route: '/workspace/my-place',
    routeName: 'my-place',
    icon: '\ue607',
  },
  {
    title: '创作榜单',
    route: '/workspace/trending-list',
    routeName: 'trending-list',
    icon: '\ue608',
  },
  {
    title: 'AI专家',
    route: '/workspace/ai-expert',
    routeName: 'ai-expert',
    icon: '\ue606',
    children: [
      {
        title: '拆书仿写',
        route: '/workspace/ai-expert/book-analysis',
        routeName: 'book-analysis',
      },
      {
        title: '文风提炼',
        route: '/workspace/ai-expert/writing-styles',
        routeName: 'writing-styles',
      },
    ],
  },
  {
    title: '灵感工坊',
    route: '/workspace/creation-community',
    routeName: 'creation-community',
    icon: '\ue609',
    children: [
      { title: '课程', route: '/workspace/creation-community/course', routeName: 'course' },
      { title: '分享', route: '/workspace/creation-community/share', routeName: 'share' },
      { title: '提示词', route: '/workspace/creation-community/prompt', routeName: 'prompt' },
    ],
  },
]

function getActiveRoute(pathname: string): string {
  for (const item of menuData) {
    if (item.children?.length) {
      for (const child of item.children) {
        if (pathname.startsWith(child.route)) return child.route
      }
    } else {
      if (item.route === '/workspace/my-place' && pathname === '/workspace/my-place')
        return item.route
      if (item.route !== '/' && pathname.startsWith(item.route)) return item.route
    }
  }
  return pathname
}

/** 关于我们 Popover 内容 */
function AboutUsContent({ onClose }: { onClose: () => void }) {
  const userAgreementUrl = `${window.location.origin}/user-agreement`
  const privacyPolicyUrl = `${window.location.origin}/privacy-policy`

  return (
    <div className="relative">
      {/* 关闭按钮 */}
      <button
        className="iconfont absolute text-(--text-primary) right-4 top-4 flex h-6 w-6 cursor-pointer items-center justify-center rounded p-1 text-[12px] transition-colors hover:bg-(--bg-hover)"
        onClick={onClose}
        dangerouslySetInnerHTML={{ __html: '&#xe633;' }}
      />

      {/* 标题 */}
      <div className="flex items-center px-5 py-4">
        <h3 className="m-0 text-base font-semibold text-(--text-primary)">关于我们</h3>
      </div>

      {/* 正文 */}
      <div className="px-5 pb-5">
        <p className="mb-3 text-[13px] leading-relaxed text-(--text-secondary)">
          爆文猫写作是一款专为文字创作者打造的智能写作平台。
        </p>
        <p className="mb-3 text-[13px] leading-relaxed text-(--text-secondary)">
          爆文猫写作使用自研全流程写作智能体系统。该系统贯穿写作前、中、后全阶段，形成专属工作流，前期建立基本心理预设，中期辅助解决技术文力，后期辅助内容优化修章。
        </p>
        <p className="mb-5 text-[13px] leading-relaxed text-(--text-secondary)">
          爆文猫写作致力于做最懂写作的写作助手。
        </p>

        {/* 隐私安全 */}
        <div className="mt-5 border-t pt-4 border-(--border-color)">
          <h4 className="mb-3 text-sm font-semibold text-(--text-primary)">隐私安全</h4>
          <div className="mb-2 flex gap-4">
            <a
              href={privacyPolicyUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] no-underline transition-colors hover:underline! text-(--text-secondary)"
            >
              隐私协议
            </a>
            <a
              href={userAgreementUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] no-underline transition-colors hover:underline! text-(--text-secondary)"
            >
              用户协议
            </a>
          </div>
          <div className="mb-2">
            <a
              href="https://beian.miit.gov.cn/"
              target="_blank"
              rel="noreferrer"
              className="text-[13px] no-underline transition-colors hover:underline! text-(--text-secondary)"
            >
              浙ICP备17039406号-19
            </a>
          </div>
          <div>
            <a
              href="https://beian.mps.gov.cn/#/query/webSearch?code=33060402002057"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-[13px] no-underline transition-colors hover:underline! text-(--text-secondary)"
            >
              浙公网安备33060402002057号
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

/** 加入社群 Popover 内容 */
const JoinGroupContent = ({
  onClose,
  qrCode,
  desc,
}: {
  onClose: () => void
  qrCode?: string
  desc?: string
}) => {
  return (
    <div className="relative flex flex-col items-center px-6 pb-7 pt-9">
      {/* 关闭按钮 */}
      <button
        className="iconfont absolute right-4 top-4 text-(--text-primary) flex h-6 w-6 cursor-pointer items-center justify-center rounded p-1 text-[12px] transition-colors hover:bg-(--bg-hover)"
        onClick={onClose}
        dangerouslySetInnerHTML={{ __html: '&#xe633;' }}
      />

      {desc && <p className="mb-3 text-sm font-semibold text-(--text-primary)">{desc}</p>}

      {/* 二维码 */}
      {qrCode ? (
        <div className="flex items-center justify-center rounded bg-white p-3">
          <img
            src={qrCode}
            alt="产品内测群二维码"
            className="h-[108px] w-[108px] rounded object-contain"
          />
        </div>
      ) : (
        <div className="flex h-[108px] w-[108px] items-center justify-center rounded bg-gray-100 text-xs text-gray-400">
          二维码加载中
        </div>
      )}
    </div>
  )
}

/**
 * Workspace 侧边栏。
 * 对应 Vue 版本的 MainSidebar.vue。
 * 底部工具栏使用 shadcn/ui Tooltip + Popover 实现。
 */
export function WorkspaceSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const activeRoute = getActiveRoute(location.pathname)

  const [expandedMenus, setExpandedMenus] = useState<string[]>(() =>
    menuData
      .filter(item => item.children?.some(c => location.pathname.startsWith(c.route)))
      .map(i => i.route)
  )

  const [aboutOpen, setAboutOpen] = useState(false)
  const [joinGroupOpen, setJoinGroupOpen] = useState(false)

  const optionsStore = useOptionsStore()

  // 监听路由变化，自动展开对应的父菜单
  useEffect(() => {
    const parentMenusToExpand = menuData
      .filter(item => item.children?.some(c => location.pathname.startsWith(c.route)))
      .map(i => i.route)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpandedMenus(parentMenusToExpand)
  }, [location.pathname])

  const toggleExpand = (route: string) => {
    setExpandedMenus(prev =>
      prev.includes(route) ? prev.filter(r => r !== route) : [...prev, route]
    )
  }

  const handleMenuClick = (item: MenuItem | MenuChild) => {
    navigate(item.route)
  }

  return (
    <aside className="flex h-full w-[210px] bg-(--bg-secondary) shrink-0 flex-col justify-between rounded-tr-[20px] rounded-br-[20px] px-3 py-5">
      {/* 顶部区域 */}
      <div>
        {/* Logo */}
        <div className="flex w-full cursor-pointer items-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full">
            <img src={LOGO} alt="" className="h-7 w-7" />
          </div>
          <span className="font-bold text-black">爆文猫写作</span>
          <span className="ml-[5px] rounded-full bg-[#9ca3af] px-[7px] text-[11px] font-medium leading-5 text-white">
            内测版
          </span>
        </div>

        {/* 创建新作品按钮（与 Vue MainSidebar 用法一致） */}
        <AddNewWorkPopover
          from="Sidebar"
          popperClass="add-new-work-popover-sidebar"
          offset={2}
          placement="bottom-end"
        >
          <div className="mt-3 flex h-10 w-full bg-[#EFAF00] cursor-pointer items-center justify-center gap-2 rounded-lg text-base font-semibold text-black">
            <span>创建新作品</span>
            <span>+</span>
          </div>
        </AddNewWorkPopover>

        {/* 菜单导航 */}
        <nav className="workspace-layout-sidebar mt-3 flex flex-col">
          {menuData.map(item => {
            const isParentActive = item.children?.some(c => c.route === activeRoute) ?? false
            const isExpanded = expandedMenus.includes(item.route)

            return (
              <div key={item.route}>
                {item.children?.length ? (
                  <>
                    <div
                      onClick={() => toggleExpand(item.route)}
                      className={clsx({
                        'workspace-layout-sidebar-item mb-4 flex h-10 w-full cursor-pointer items-center gap-1 rounded-lg px-5 text-base transition-colors text-(--text-primary)': true,
                        // 'font-semibold': isParentActive,
                        'hover:bg-[#CDCDCD]': !isParentActive,
                        [item.routeName]: true,
                      })}
                    >
                      <span className="iconfont mr-1 text-xl">{item.icon}</span>
                      <span className="flex-1 text-left">{item.title}</span>
                      <span
                        className={clsx(
                          'inline-block transition-transform duration-200 ease-out',
                          isExpanded && 'rotate-180'
                        )}
                      >
                        <Iconfont unicode="&#xeaa1;" className="text-xs" />
                      </span>
                    </div>

                    <div
                      className="grid transition-[grid-template-rows] duration-200 ease-out"
                      style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <div className="relative ml-8 flex flex-col before:absolute before:left-[-4px] before:top-[-8px] before:h-[95%] before:w-px before:bg-[#d9d9d9]">
                          {item.children.map(child => {
                            const isChildActive = child.route === activeRoute
                            return (
                              <div
                                key={child.route}
                                onClick={() => handleMenuClick(child)}
                                className={clsx({
                                  'workspace-layout-sidebar-item-child mb-4 h-10 leading-10 cursor-pointer rounded-lg pl-3.5 text-left text-base transition-colors text-(--text-primary)': true,
                                  'bg-[#EED09F] font-semibold hover:bg-[#EED09F]': isChildActive,
                                  'hover:bg-[#CDCDCD]': !isChildActive,
                                  [child.routeName]: true,
                                })}
                              >
                                {child.title}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div
                    onClick={() => handleMenuClick(item)}
                    className={clsx({
                      'workspace-layout-sidebar-item mb-4 flex h-10 w-full items-center gap-1 rounded-lg px-5 text-base transition-colors text-(--text-primary) cursor-pointer': true,
                      'bg-[#EED09F] font-semibold hover:bg-[#EED09F]': activeRoute === item.route,
                      'hover:bg-[#CDCDCD]': activeRoute !== item.route,
                      [item.routeName]: true,
                    })}
                  >
                    <span className="iconfont mr-1 text-xl">{item.icon}</span>
                    {item.title}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </div>

      {/* 底部工具栏 */}
      <div className="flex items-center gap-[6px] pl-3">
        {/* 关于我们 */}
        <Popover open={aboutOpen} onOpenChange={setAboutOpen}>
          <Tooltip>
            <PopoverAnchor asChild>
              <TooltipTrigger asChild>
                <div
                  className="iconfont flex h-7 w-7 cursor-pointer items-center justify-center rounded-[8px] text-xl! transition-colors hover:bg-(--bg-tertiary)"
                  style={{ color: '#757575' }}
                  onClick={() => setAboutOpen(v => !v)}
                  dangerouslySetInnerHTML={{ __html: '&#xe604;' }}
                />
              </TooltipTrigger>
            </PopoverAnchor>
            <TooltipContent side="top">关于我们</TooltipContent>
          </Tooltip>
          <PopoverContent side="right" align="end" sideOffset={8} className="w-[260px] p-0">
            <AboutUsContent onClose={() => setAboutOpen(false)} />
          </PopoverContent>
        </Popover>

        {/* 加入社群 */}
        <Popover open={joinGroupOpen} onOpenChange={setJoinGroupOpen}>
          <Tooltip>
            <PopoverAnchor asChild>
              <TooltipTrigger asChild>
                <div
                  className="iconfont flex h-7 w-7 cursor-pointer items-center justify-center rounded-[8px] text-xl! transition-colors hover:bg-(--bg-tertiary)"
                  style={{ color: '#757575' }}
                  onClick={() => setJoinGroupOpen(v => !v)}
                  dangerouslySetInnerHTML={{ __html: '&#xe60a;' }}
                />
              </TooltipTrigger>
            </PopoverAnchor>
            <TooltipContent side="top">加入社群</TooltipContent>
          </Tooltip>
          <PopoverContent side="right" align="end" sideOffset={8} className="w-[280px] p-0">
            <JoinGroupContent
              onClose={() => setJoinGroupOpen(false)}
              desc={optionsStore.joinUsDesc || undefined}
              qrCode={optionsStore.joinUsQrCode || undefined}
            />
          </PopoverContent>
        </Popover>

        {/* 问题反馈 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="iconfont flex h-7 w-7 text-[#757575]! cursor-pointer items-center justify-center rounded-[8px] transition-colors hover:bg-(--bg-tertiary)"
              onClick={() => {
                openFeedbackDialog()
              }}
            >
              &#xe64e;
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">问题反馈</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  )
}
