import * as React from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogClose, VisuallyHidden } from '@/components/ui/Dialog'
import { useLoginStore, selectAvatarDataUrl } from '@/stores/loginStore'
import { getUserInfoReq, getInvitationCodeReq } from '@/api/users'
import { toast } from 'sonner'

import closeIcon from '@/assets/images/quota/close.svg'
import userInfoIcon from '@/assets/images/quota/user_info.svg'
import userLogoutIcon from '@/assets/images/quota/user_logout.svg'
import userTopUpIcon from '@/assets/images/quota/user_top_up.svg'
import giftIcon from '@/assets/images/quota/gift.svg'
import invitationIcon from '@/assets/images/quota/invitation.svg'
import innerSideIcon from '@/assets/images/quota/inner_side.svg'
import separateYellowIcon from '@/assets/images/quota/separate_yellow.svg'
import quotaBackImg from '@/assets/images/quota/quota_back.png'

export interface UserCenterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onEditProfile?: () => void
  onLogout?: () => void
}

export const UserCenterDialog = ({
  open,
  onOpenChange,
  onEditProfile,
  onLogout,
}: UserCenterDialogProps) => {
  const userInfo = useLoginStore((s) => s.userInfo)
  const avatarData = useLoginStore(selectAvatarDataUrl)

  const [bonusPoints, setBonusPoints] = useState(500)
  const [inviteeCount, setInviteeCount] = useState(5)
  const [invitationLink, setInvitationLink] = useState('https://baowenmao.com')

  const nickname = userInfo?.nickName || '用户昵称'
  const phone = userInfo?.phone || ''

  const closeDialog = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  useEffect(() => {
    if (open) {
      getUserInfoReq()
        .then((res: any) => {
          if (res?.bonusPoints != null) setBonusPoints(res.bonusPoints)
          if (res?.inviteeCount != null) setInviteeCount(res.inviteeCount)
        })
        .catch(() => {})
      getInvitationCodeReq()
        .then((res: any) => {
          if (res?.code) setInvitationLink(`${window.location.origin}?invitationCode=${res.code}`)
        })
        .catch(() => {})
    }
  }, [open])

  const handleTopUp = useCallback(() => {
    toast.info('暂未开放')
  }, [])

  const handleOpenExchange = useCallback(() => {
    toast.info('兑换功能暂未开放')
  }, [])

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(invitationLink)
      toast.success('邀请链接已复制到剪贴板')
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = invitationLink
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
        toast.success('邀请链接已复制到剪贴板')
      } catch {
        toast.error('复制失败，请手动复制')
      }
      document.body.removeChild(textarea)
    }
  }, [invitationLink])

  const handleEditProfile = useCallback(() => {
    onEditProfile?.()
    closeDialog()
  }, [onEditProfile, closeDialog])

  const handleLogout = useCallback(() => {
    onLogout?.()
    closeDialog()
  }, [onLogout, closeDialog])

  const preventClose = useCallback((e: Event) => {
    e.preventDefault()
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[426px] rounded-[20px] p-0 overflow-visible shadow-[0_4px_15px_0_rgba(244,238,223,1)]"
        onInteractOutside={preventClose}
        onEscapeKeyDown={preventClose}
      >
        <VisuallyHidden>
          <DialogTitle>用户中心</DialogTitle>
        </VisuallyHidden>
        <div className="px-6 pt-6 pb-0">
          <div className="flex items-start justify-between w-full">
            <h2 className="m-0 text-2xl font-bold leading-[1.32] text-transparent bg-linear-to-r from-[#efaf00] to-[#ff9500] bg-clip-text">
              用户中心
            </h2>
            <DialogClose asChild>
              <div
                role="button"
                tabIndex={0}
                className="flex h-[22px] w-[22px] shrink-0 cursor-pointer items-center justify-center p-0 border-none bg-transparent"
                onKeyDown={(e) => e.key === 'Enter' && closeDialog()}
              >
                <img src={closeIcon} alt="关闭" className="h-[22px] w-[22px] opacity-80" />
              </div>
            </DialogClose>
          </div>
        </div>

        <div className="flex flex-col items-center w-full px-6 pb-6">
          <div className="relative mt-0 w-full min-h-[220px]">
            <div className="absolute top-2 right-3 z-3 flex items-center justify-center py-1 px-2.5 rounded-[10px] bg-white border border-[#ff9500]">
              <div className="flex items-center gap-1.5">
                <img src={innerSideIcon} alt="" className="h-4 w-4" />
                <span className="text-[15px] font-bold text-transparent bg-linear-to-r from-[#efaf00] to-[#ff9500] bg-clip-text">
                  内测版
                </span>
              </div>
            </div>
            <img
              src={quotaBackImg}
              alt=""
              className="absolute left-0 top-0 w-full h-[220px] object-cover z-1 rounded-t-[20px]"
              aria-hidden
            />
            <div className="w-full h-[220px]" />
            <div className="absolute left-0 top-0 w-full h-[220px] px-6 py-6 box-border flex flex-row items-center gap-5 z-2">
              <img
                src={avatarData}
                alt=""
                className="h-[94px] w-[94px] rounded-full object-cover shrink-0"
              />
              <div className="flex-1 min-w-0 flex flex-col gap-2 justify-center">
                <div className="text-[21px] font-bold text-white leading-[1.32]">{nickname}</div>
                <div className="text-sm font-normal text-white/90 leading-[1.32]">{phone || '178XXXX3376'}</div>
                <div className="flex gap-3 mt-1">
                  <div
                    role="button"
                    tabIndex={0}
                    className="py-1.5 px-4 rounded-lg bg-white/95 text-sm font-medium text-[#ff9500] cursor-pointer border-none"
                    onClick={handleOpenExchange}
                    onKeyDown={(e) => e.key === 'Enter' && handleOpenExchange()}
                  >
                    兑换
                  </div>
                  <div
                    role="button"
                    tabIndex={0}
                    className="py-1.5 px-4 rounded-lg bg-white/95 text-sm font-medium text-[#ff9500] cursor-pointer border-none"
                    onClick={handleCopyLink}
                    onKeyDown={(e) => e.key === 'Enter' && handleCopyLink()}
                  >
                    复制
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full pt-5 bg-[#fff7ed]">
            <div className="flex items-center gap-4 mb-3">
              <img src={giftIcon} alt="" className="h-6 w-6 object-contain" />
              <span className="text-[20px] font-bold text-transparent bg-linear-to-r from-[#efaf00] to-[#ff9500] bg-clip-text">
                兑换码
              </span>
            </div>
            <div className="flex items-center gap-2.5 h-[43px]">
              <input
                type="text"
                placeholder="请输入验证码"
                className="flex-1 h-[43px] px-3 rounded-[10px] border-none bg-[#f5f5f5] text-base text-[#464646] outline-none"
              />
              <div
                role="button"
                tabIndex={0}
                className="shrink-0 w-[68px] h-[37px] flex items-center justify-center rounded-[10px] bg-linear-to-r from-[#efaf00] to-[#ff9500] text-lg font-normal text-white cursor-pointer"
                onClick={handleOpenExchange}
                onKeyDown={(e) => e.key === 'Enter' && handleOpenExchange()}
              >
                兑换
              </div>
            </div>
          </div>

          <div className="h-px w-full bg-[#dadada] my-4" />

          <div className="w-full bg-[#fff7ed] pb-2">
            <div className="flex items-center gap-4 mb-3">
              <img src={invitationIcon} alt="" className="h-[26px] w-[24px]" />
              <span className="text-[20px] font-bold text-transparent bg-linear-to-r from-[#efaf00] to-[#ff9500] bg-clip-text">
                邀请记录
              </span>
            </div>
            <div className="flex items-center justify-center mb-3 py-5 px-6 rounded-[20px] border border-transparent bg-linear-to-b from-[#fff8e5] to-white relative">
              <div className="absolute inset-0 rounded-[20px] p-px bg-linear-to-r from-[#efaf00] to-[#ff9500] mask-exclude [mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)]" />
              <div className="flex-1 flex flex-col items-center text-center">
                <div className="text-2xl font-normal text-[#464646] leading-[1.32]">
                  {bonusPoints}<span className="text-[15px]">万</span>
                </div>
                <div className="text-[13px] text-[#999] mt-2 leading-[1.32]">（累计获赠积分）</div>
              </div>
              <img src={separateYellowIcon} alt="" className="w-px h-12 shrink-0" aria-hidden />
              <div className="flex-1 flex flex-col items-center text-center">
                <div className="text-2xl font-normal text-[#464646] leading-[1.32]">
                  {inviteeCount}<span className="text-[15px]">人</span>
                </div>
                <div className="text-[13px] text-[#999] mt-2 leading-[1.32]">（邀请人数）</div>
              </div>
            </div>
            <div className="text-sm text-[#999] leading-[1.32] mb-2.5">分享一下邀请链接，每人可获得100次</div>
            <div className="flex items-center gap-2.5 h-[43px]">
              <input
                type="text"
                readOnly
                value={invitationLink}
                className="flex-1 h-[43px] px-3 rounded-[10px] border-none bg-[#f5f5f5] text-xs text-[#999] outline-none cursor-default"
              />
              <div
                role="button"
                tabIndex={0}
                className="shrink-0 w-[68px] h-[37px] flex items-center justify-center rounded-[10px] bg-linear-to-r from-[#efaf00] to-[#ff9500] text-lg font-normal text-white cursor-pointer"
                onClick={handleCopyLink}
                onKeyDown={(e) => e.key === 'Enter' && handleCopyLink()}
              >
                复制
              </div>
            </div>
          </div>

          <div className="w-full flex flex-col items-start gap-6 mt-7 px-2">
            <div
              role="button"
              tabIndex={0}
              className="flex items-center gap-[18px] cursor-pointer text-base font-normal text-[#464646] hover:text-[#ff9500] transition-colors"
              onClick={handleEditProfile}
              onKeyDown={(e) => e.key === 'Enter' && handleEditProfile()}
            >
              <img src={userInfoIcon} alt="" className="h-[23px] w-[23px] shrink-0" />
              <span>修改个人资料</span>
            </div>
            <div
              role="button"
              tabIndex={0}
              className="flex items-center gap-[18px] cursor-pointer text-base font-normal text-[#464646] hover:text-[#ff9500] transition-colors"
              onClick={handleTopUp}
              onKeyDown={(e) => e.key === 'Enter' && handleTopUp()}
            >
              <img src={userTopUpIcon} alt="" className="h-[21px] w-[21px] shrink-0" />
              <span>充值</span>
            </div>
            <div
              role="button"
              tabIndex={0}
              className="flex items-center gap-[18px] cursor-pointer text-base font-normal text-[#464646] hover:text-[#ef4444] transition-colors"
              onClick={handleLogout}
              onKeyDown={(e) => e.key === 'Enter' && handleLogout()}
            >
              <img src={userLogoutIcon} alt="" className="h-[23px] w-[23px] shrink-0" />
              <span>退出登录</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
