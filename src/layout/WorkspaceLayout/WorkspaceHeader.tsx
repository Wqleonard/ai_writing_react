import { useNavigate, useLocation } from 'react-router-dom'
import { Iconfont } from '@/components/IconFont'
import { Button } from '@/components/ui/Button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { useState, useCallback } from 'react'
import { showNotesSelectorDialog } from '@/utils/showNotesSelectorDialog'
import { useChatInputStore } from '@/stores/chatInputStore'
import { useLoginStore, selectIsLoggedIn, selectAvatarDataUrl } from '@/stores/loginStore'
import { InsiteMessage } from '@/components/InsiteMessage'
import { openLoginDialog } from '@/components/LoginDialog'
import { openAccountDialog } from '@/components/AccountDialog'
import { openQuotaDialog } from '@/components/QuotaDialog'
import { UserCenterDialog } from '@/components/UserCenterDialog'
import { toast } from 'sonner'

/**
 * 主顶部 Header 骨架。
 * 对应 Vue 版本的 MainHeader.vue（src/components/MainHeader.vue）。
 *
 * TODO:
 *  - 接入主题切换 themeStore
 */
export function WorkspaceHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const { selectedNotes, removeNote, addNote, clearSelectedNotes } = useChatInputStore()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  // const [showUserCenterDialog, setShowUserCenterDialog] = useState(false)

  const isLoggedIn = useLoginStore(selectIsLoggedIn)
  const logout = useLoginStore((s) => s.logout)
  const avatarData = useLoginStore(selectAvatarDataUrl)

  const handleAccountMenuClick = useCallback(() => {
    setUserMenuOpen(false)
    openAccountDialog()
  }, [])

  const handleQuotaMenuClick = useCallback(() => {
    setUserMenuOpen(false)
    openQuotaDialog()
  }, [])

  const handleNotesClick = useCallback(async () => {
    try {
      const result = await showNotesSelectorDialog()
      if (result.success && result.notes.length > 0) {
        selectedNotes.forEach((note) => removeNote(note.id))
        if (!location.pathname.startsWith('/workspace')) {
          navigate('/workspace/my-place')
          await new Promise((r) => setTimeout(r, 200))
        }
        result.notes.forEach((note) => addNote(note))
      } else if (result.success && result.notes.length === 0) {
        if (!location.pathname.startsWith('/workspace')) {
          navigate('/workspace/my-place')
          await new Promise((r) => setTimeout(r, 200))
        }
        clearSelectedNotes()
      }
    } catch {
      // 用户取消或关闭对话框，不做任何操作
    }
  }, [location.pathname, navigate, selectedNotes, removeNote, addNote, clearSelectedNotes])

  const handleUserClick = useCallback(async () => {
    if (!isLoggedIn) {
      try {
        await openLoginDialog()
        // 登录成功后可在此刷新状态或做后续处理
      } catch {
        // 用户关闭对话框，忽略
      }
    } else {
      setUserMenuOpen((v) => !v)
    }
  }, [isLoggedIn])

  const handleLogoutMenuClick = useCallback(() => {
    setUserMenuOpen(false)
    logout()
    toast.success('退出登录成功')
  }, [logout])

  return (
    <div className="flex items-center gap-1">
      {/* 笔记管理 */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="iconfont text-base flex h-6 w-6 cursor-pointer items-center justify-center overflow-hidden rounded-sm text-center leading-6 hover:bg-[#e4e4e4]"
            onClick={handleNotesClick}
          >
            <Iconfont unicode="&#xe644;" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          笔记管理
        </TooltipContent>
      </Tooltip>

      {/* 分割线 */}
      <div className="mx-1 h-[18px] w-px bg-[#dedede]" />

      {/* 站内消息 */}
      <InsiteMessage />

      {/* 用户头像 / 登录按钮（对应 Vue MainHeader 已登录 el-popover + 账号/额度/退出） */}
      <div className="ml-3">
        {!isLoggedIn ? (
          <div
            role="button"
            title="登录"
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-xl transition-colors hover:opacity-80"
            onClick={handleUserClick}
            onKeyDown={(e) => e.key === 'Enter' && handleUserClick()}
          >
            <Iconfont unicode="&#xe60b;" />
          </div>
        ) : (
          <Popover open={userMenuOpen} onOpenChange={setUserMenuOpen}>
            <PopoverTrigger asChild>
              <div className="flex h-6 w-6 cursor-pointer items-center justify-center overflow-hidden rounded-full outline-1 outline-[#dedede]">
                <img src={avatarData} alt="用户头像" className="h-full w-full object-cover" />
              </div>
            </PopoverTrigger>
            <PopoverContent align="end" side="bottom" className="w-[120px] rounded-md border border-[#e5e5e5] bg-white p-2 shadow-md">
              <div className="flex flex-col">
                <div
                  role="button"
                  className="rounded-sm cursor-pointer outline-none px-4 py-2 text-sm transition-colors hover:bg-[#f5f5f5]"
                  onClick={handleAccountMenuClick}
                  onKeyDown={(e) => e.key === 'Enter' && handleAccountMenuClick()}
                >
                  账号
                </div>
                <div
                  role="button"
                  className="rounded-sm cursor-pointer outline-none px-4 py-2 text-sm transition-colors hover:bg-[#f5f5f5]"
                  onClick={handleQuotaMenuClick}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuotaMenuClick()}
                >
                  额度
                </div>
                <div
                  role="button"
                  className="rounded-sm cursor-pointer outline-none px-4 py-2 text-sm transition-colors text-red-500 hover:bg-red-50"
                  onClick={handleLogoutMenuClick}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogoutMenuClick()}
                >
                  退出登录
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/*<UserCenterDialog*/}
      {/*  open={showUserCenterDialog}*/}
      {/*  onOpenChange={setShowUserCenterDialog}*/}
      {/*  onEditProfile={openAccountDialog}*/}
      {/*  onLogout={handleLogoutMenuClick}*/}
      {/*/>*/}
    </div>
  )
}
