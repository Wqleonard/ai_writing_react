import * as React from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogClose, VisuallyHidden } from '@/components/ui/Dialog'
import { Iconfont } from '@/components/Iconfont'
import { Input } from '@/components/ui/Input'
import { useLoginStore } from '@/stores/loginStore'
import { getUserInfoReq, updateUserInfo } from '@/api/users'
import type { UserInfo } from '@/stores/loginStore'
import { toast } from 'sonner'
import { openDialog } from '@/lib/openDialog'
import { Button } from "@/components/ui/Button.tsx";

const MAX_NICKNAME_LENGTH = 20

export interface AccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const AccountDialog = ({ open, onOpenChange }: AccountDialogProps) => {
  const userInfo = useLoginStore((s) => s.userInfo)
  const avatarData = useLoginStore((s) =>
    s.renderAvatarFromData(s.makeRandomAvatar(s.userInfo?.phone ?? 'morenToux'))
  )
  const saveUserInfo = useLoginStore((s) => s.saveUserInfo)

  const [isEditingNickname, setIsEditingNickname] = useState(false)
  const [editingNickname, setEditingNickname] = useState('')

  const closeDialog = useCallback(() => {
    onOpenChange(false)
    setIsEditingNickname(false)
  }, [onOpenChange])

  useEffect(() => {
    if (open) {
      getUserInfoReq()
        .then((res: any) => {
          const info = res as UserInfo
          saveUserInfo(info)
          setEditingNickname(info?.nickName ?? '')
        })
        .catch(() => {})
      setIsEditingNickname(false)
      setEditingNickname(userInfo?.nickName ?? '')
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open && userInfo?.nickName !== undefined) {
      setEditingNickname(userInfo.nickName)
    }
  }, [open, userInfo?.nickName])

  const startEditNickname = useCallback(() => {
    setIsEditingNickname(true)
    setEditingNickname(userInfo?.nickName ?? '')
  }, [userInfo?.nickName])

  const cancelEditNickname = useCallback(() => {
    setIsEditingNickname(false)
    setEditingNickname(userInfo?.nickName ?? '')
  }, [userInfo?.nickName])

  const confirmEditNickname = useCallback(async () => {
    const trimmed = editingNickname.trim()
    if (!trimmed) {
      toast.warning('昵称不能为空')
      return
    }
    if (!userInfo) return
    try {
      const updated = (await updateUserInfo({ nickName: trimmed })) as UserInfo
      saveUserInfo(updated)
      toast.success('昵称修改成功')
      setIsEditingNickname(false)
    } catch {
      toast.error('昵称修改失败')
    }
  }, [editingNickname, userInfo, saveUserInfo])

  const preventClose = useCallback((e: Event) => {
    e.preventDefault()
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="w-[722px] p-0"
        onInteractOutside={preventClose}
        onEscapeKeyDown={preventClose}
      >
        <VisuallyHidden>
          <DialogTitle>账号</DialogTitle>
        </VisuallyHidden>
        <div className="px-8 pt-8 pb-0">
          <div className="flex flex-row justify-between items-start w-full">
            <div
              className="text-[36px] font-semibold bg-linear-to-br from-[#EFAF00] to-[#FF9500] bg-clip-text text-transparent"
              style={{ marginTop: 5 }}
            >
              账号
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-0 px-8 pb-8">
          {/* 头像 */}
          <div className="flex items-center py-5 border-b border-[#e4e7ed]">
            <div className="min-w-[140px] flex flex-col gap-1">
              <div className="text-lg font-normal text-(--text-primary)">头像</div>
            </div>
            <div className="flex-1 flex items-center justify-end min-h-10">
              <div className="h-20 w-20 rounded-full overflow-hidden border border-[#dedede] bg-[#f5f5f5] flex items-center justify-center">
                <img src={avatarData} alt="" className="h-full w-full object-cover" />
              </div>
            </div>
          </div>

          {/* 用户昵称 */}
          <div className="flex items-center py-5 border-b border-[#e4e7ed]">
            <div className="min-w-[140px] flex flex-col gap-1">
              <div className="text-lg font-normal text-(--text-primary)">用户昵称</div>
              <div className="text-sm text-[#909399]">您的个人资料名称</div>
            </div>
            <div className="flex-1 flex items-center justify-end min-h-10">
              {!isEditingNickname ? (
                <div className="flex items-center gap-2.5 min-w-[200px] justify-end">
                  <span className="text-base text-(--text-primary)">
                    {userInfo?.nickName || '未设置'}
                  </span>
                  <div
                    role="button"
                    className="cursor-pointer text-base text-[#909399] hover:text-(--el-color-primary)"
                    onClick={startEditNickname}
                    onKeyDown={(e) => e.key === 'Enter' && startEditNickname()}
                  >
                    <Iconfont unicode="&#xea48;" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 w-full max-w-[500px] justify-end">
                  <div className="flex-1 max-w-[280px] relative">
                    <Input
                      value={editingNickname}
                      onChange={(e) => setEditingNickname(e.target.value.slice(0, MAX_NICKNAME_LENGTH))}
                      placeholder="请输入用户昵称"
                      className="rounded-[10px] pr-14"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#909399] whitespace-nowrap">
                      {editingNickname.length}/{MAX_NICKNAME_LENGTH}
                    </span>
                  </div>
                  <div className="flex items-center shrink-0 gap-2">
                    <Button
                      variant="outline"
                      onClick={cancelEditNickname}
                      onKeyDown={(e) => e.key === 'Enter' && cancelEditNickname()}
                    >
                      取消
                    </Button>
                    <Button
                      variant="default"
                      onClick={confirmEditNickname}
                      onKeyDown={(e) => e.key === 'Enter' && confirmEditNickname()}
                    >
                      确定
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 手机号 */}
          <div className="flex items-center py-5">
            <div className="min-w-[140px] flex flex-col gap-1">
              <div className="text-lg font-normal text-(--text-primary)">手机号</div>
              <div className="text-sm text-[#909399]">您的个人手机号</div>
            </div>
            <div className="flex-1 flex items-center justify-end min-h-10">
              <span className="text-base text-(--text-primary)">
                {userInfo?.phone || '未设置'}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export const openAccountDialog = () => openDialog(AccountDialog)
