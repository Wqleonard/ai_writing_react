"use client";

import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  useLoginStore,
  selectUserInfo,
  selectAvatarDataUrl,
  selectDailyBalance,
  selectDailyBalanceLimit,
  selectFixedBalance,
} from "@/stores/loginStore";
import USER_INFO_BG from "@/assets/images/m-workspace-mine/mine_bg.png";
import { mtoast } from "@/components/ui/toast";
import { MConfirmDialog } from "@/components/ui/MConfirmDialog";

export default function MMinePage() {
  const navigate = useNavigate();
  const userInfo = useLoginStore(selectUserInfo);
  const avatarDataUrl = useLoginStore(selectAvatarDataUrl);
  const { logout } = useLoginStore();
  const userBalance = useLoginStore(selectDailyBalance);
  const dailyBalanceLimit = useLoginStore(selectDailyBalanceLimit);
  const fixedToken = useLoginStore(selectFixedBalance);
  const refreshBalance = useLoginStore((s) => s.refreshBalance);

  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  // 跳转到规则
  const handleJumpToRules = useCallback(() => {
    navigate("/m/rules");
  }, [navigate]);

  // 跳转到反馈
  const handleJumpToFeedback = useCallback(() => {
    navigate("/m/feedback-issue");
  }, [navigate]);

  // 退出登录
  const handleLogout = useCallback(() => {
    setLogoutDialogOpen(true);
  }, []);

  const handleConfirmLogout = useCallback(() => {
    setLogoutDialogOpen(false);
    logout();
    navigate("/m");
  }, [logout, navigate]);

  // 充值
  const handleCharge = useCallback(() => {
    mtoast.error("功能暂未开放，敬请期待");
  }, []);

  // 兑换
  const handleExchange = useCallback(() => {
    mtoast.error("功能暂未开放，敬请期待");
  }, []);

  return (
    <div className="w-full h-full flex flex-col bg-[#f3f3f3]">
      {/* 用户信息区域 */}
      <div className="px-9 mt-30 h-105 w-full relative">
        <div className="w-160 h-75 mx-auto bg-white rounded-[20px] relative">
          <div className="absolute text-[24px] leading-8 right-5 top-2 text-[#f0ae00]">
            <span className="iconfont text-[24px]! leading-8 mr-1">
              &#xea91;
            </span>
            <span className="font-semibold">内测版</span>
          </div>
        </div>

        <div className="absolute -top-1.5 left-9 w-[calc(100%-4.5rem)]">
          <img src={USER_INFO_BG} alt="" className="w-full" />
        </div>

        <div className="absolute -top-10.5 z-4 px-8 flex flex-col w-169.5">
          <div className="flex gap-9 w-full">
            <div className="w-36 h-36 rounded-full border-2 border-[#fd9801] bg-white shrink-0 overflow-hidden">
              {avatarDataUrl ? (
                <img
                  src={avatarDataUrl}
                  alt=""
                  className="w-full h-full rounded-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[40px] text-gray-400">
                  &#xe60b;
                </div>
              )}
            </div>
            <div className="text-white flex-1 min-w-0 pr-30">
              <div className="mt-14 text-[32px] leading-9 font-semibold truncate">
                {userInfo?.nickName || "用户"}
              </div>
              <div className="mt-4 text-[22px]">{userInfo?.phone || ""}</div>
            </div>
          </div>

          <div className="mt-11 flex items-center text-white">
            <div className="flex flex-col justify-center flex-1">
              <div className="text-center text-nowrap">
                <span className="text-[48px]">{userBalance}</span>
                <span className="text-[24px]"> / {dailyBalanceLimit}</span>
              </div>
              <div className="text-center text-[24px] opacity-80">
                (内测每日积分)
              </div>
            </div>
            <div className="w-0.5 h-12 bg-[#fbd07f] rounded-full" />
            <div className="flex flex-col justify-center flex-1">
              <div className="text-center">
                <span className="text-[48px]">{fixedToken}</span>
              </div>
              <div className="text-center text-[24px] opacity-80">
                (固定额度)
              </div>
            </div>
          </div>
        </div>

        <div className="-mt-10 pt-5 w-full h-30 rounded-[20px] flex items-center bg-white overflow-hidden">
          <div
            className="h-full flex-1 active:bg-[#e5e5e5] text-center leading-30 text-[28px] text-[#9a9a9a] cursor-pointer"
            onClick={handleCharge}
          >
            <span>充值</span>
          </div>
          <div className="w-0.5 h-30 bg-[#e9e9e9]" />
          <div
            className="h-full flex-1 active:bg-[#e5e5e5] text-center leading-30 text-[28px] text-[#9a9a9a] cursor-pointer"
            onClick={handleExchange}
          >
            <span>兑换</span>
          </div>
        </div>
      </div>

      {/* 设置列表 */}
      <div className="flex flex-col w-full mt-4">
        <div
          className="h-27 px-9 flex justify-between items-center bg-white active:bg-[#e5e5e5] border-b border-[#e9e9e9] cursor-pointer"
          onClick={handleJumpToRules}
        >
          <div className="text-[32px] text-[#464646]">
            <span className="iconfont mr-4 text-[32px]!">&#xe62f;</span>
            <span>用户协议</span>
          </div>
          <span className="iconfont text-[#d9d9d9] text-[44px]!">&#xeaa5;</span>
        </div>
        <div
          className="h-27 px-9 flex justify-between items-center bg-white active:bg-[#e5e5e5] cursor-pointer"
          onClick={handleJumpToFeedback}
        >
          <div className="text-[32px] text-[#464646]">
            <span className="iconfont mr-4 text-[32px]!">&#xe63f;</span>
            <span>用户反馈</span>
          </div>
          <span className="iconfont text-[#d9d9d9] text-[44px]!">&#xeaa5;</span>
        </div>
        <div
          className="mt-7 h-27 px-9 flex justify-between items-center bg-white active:bg-[#e5e5e5] cursor-pointer"
          onClick={handleLogout}
        >
          <div className="text-[32px] text-[#464646]">
            <span className="iconfont mr-4 text-[32px]!">&#xe62e;</span>
            <span>退出登录</span>
          </div>
          <span className="iconfont text-[#d9d9d9] text-[44px]!">&#xeaa5;</span>
        </div>
      </div>

      <MConfirmDialog
        open={logoutDialogOpen}
        onOpenChange={setLogoutDialogOpen}
        title="提示"
        message="确定要退出登录吗？"
        cancelText="取消"
        confirmText="确定"
        onConfirm={handleConfirmLogout}
      />
    </div>
  );
}
