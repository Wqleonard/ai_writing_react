"use client";

import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  useLoginStore,
  selectUserInfo,
  selectAvatarDataUrl,
} from "@/stores/loginStore";
import { getUserBalanceReq } from "@/api/users";
import USER_INFO_BG from "@/assets/images/m-workspace-mine/mine_bg.png";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { mtoast } from "@/components/ui/toast";
import { Button } from "@/components/ui/Button";

export default function MMinePage() {
  const navigate = useNavigate();
  const userInfo = useLoginStore(selectUserInfo);
  const avatarDataUrl = useLoginStore(selectAvatarDataUrl);
  const { logout } = useLoginStore();

  const [userBalance, setUserBalance] = useState("1000");
  const [fixedToken, setFixedToken] = useState("0");
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  // 获取用户余额
  const updateToken = useCallback(async () => {
    try {
      const req: any = await getUserBalanceReq();
      if (req.dailyFreeToken) {
        setUserBalance(
          parseFloat(String(req.dailyFreeToken / 1000)).toFixed(0),
        );
      }
      if (req.token) {
        setFixedToken(parseFloat(String(req.token / 1000)).toFixed(0));
      }
    } catch (e) {
      console.error("获取余额失败:", e);
    }
  }, []);

  useEffect(() => {
    updateToken();
  }, [updateToken]);

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
                <span className="text-[24px]"> / 1000</span>
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

      <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <DialogContent
          showCloseButton={false}
          className="w-120 max-w-[calc(100%-2rem)] rounded-2xl p-0"
        >
          <DialogHeader className="px-8 pt-8 text-center">
            <DialogTitle className="text-[2rem] leading-[1.2] font-semibold text-[#333]">
              提示
            </DialogTitle>
          </DialogHeader>

          <div className="px-8 pt-5 pb-7 text-center text-[1.625rem] leading-[1.4] text-[#666]">
            确定要退出登录吗？
          </div>

          <DialogFooter className="flex h-20 flex-row gap-0 border-t border-[#ebebeb] p-0">
            <Button
              variant="ghost"
              className="outline-0 rounded-0 h-full flex-1 text-[1.75rem] text-[#999] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-transparent focus-visible:border-transparent active:bg-[#f5f5f5]"
              onClick={() => setLogoutDialogOpen(false)}
            >
              取消
            </Button>
            <div className="h-full w-px bg-[#ebebeb]" />
            <Button
              variant="ghost"
              className="outline-0 rounded-0 h-full flex-1 text-[1.75rem] font-semibold text-[#f0ae00] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-transparent focus-visible:border-transparent active:bg-[#fff7e6]"
              onClick={handleConfirmLogout}
            >
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
