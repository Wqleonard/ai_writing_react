'use client'

import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

export default function MRulesPage() {
  const navigate = useNavigate()

  const handleBack = useCallback(() => {
    navigate('/m/m-workspace-mine')
  }, [navigate])

  const handleJumpToServiceAgreement = useCallback(() => {
    navigate('/m/m-user-agreement')
  }, [navigate])

  const handleJumpToPrivacy = useCallback(() => {
    navigate('/m/m-privacy-policy')
  }, [navigate])

  return (
    <div className="w-full h-[100dvh] flex flex-col bg-[#f3f3f3]">
      {/* 顶部栏 */}
      <div className="h-22 px-9 flex items-center justify-between">
        <div
          className="iconfont text-[40px]! w-10 h-10 leading-10 active:bg-[#e5e5e5] rounded-md cursor-pointer"
          onClick={handleBack}
        >
          &#xeaa2;
        </div>
        <div className="text-[36px] text-[#464646]">条款与规则</div>
        <div />
      </div>

      {/* 设置列表 */}
      <div className="flex flex-col w-full mt-18">
        <div
          className="h-27 px-9 flex justify-between items-center bg-white active:bg-[#e5e5e5] border-b border-[#e9e9e9] cursor-pointer"
          onClick={handleJumpToServiceAgreement}
        >
          <div className="text-[32px] text-[#464646]">
            <span className="iconfont mr-4 text-[32px]!">&#xe62f;</span>
            <span>用户服务协议</span>
          </div>
          <span className="iconfont text-[#d9d9d9] text-[44px]!">&#xeaa5;</span>
        </div>
        <div
          className="h-27 px-9 flex justify-between items-center bg-white active:bg-[#e5e5e5] cursor-pointer"
          onClick={handleJumpToPrivacy}
        >
          <div className="text-[32px] text-[#464646]">
            <span className="iconfont mr-4 text-[32px]!">&#xe63f;</span>
            <span>产品隐私政策</span>
          </div>
          <span className="iconfont text-[#d9d9d9] text-[44px]!">&#xeaa5;</span>
        </div>
      </div>
    </div>
  )
}
