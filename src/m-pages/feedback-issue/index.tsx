'use client'

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Toast } from 'vant'
import { postSuggestsReq } from '@/api/users'

export default function MFeedbackIssuePage() {
  const navigate = useNavigate()
  const [feedbackContent, setFeedbackContent] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleBack = useCallback(() => {
    navigate('/m/m-workspace-mine')
  }, [navigate])

  const handleSubmit = useCallback(async () => {
    if (!feedbackContent.trim()) {
      Toast.show({ message: '请输入反馈内容', type: 'fail', duration: 2000 })
      return
    }

    if (isSubmitting) return

    setIsSubmitting(true)
    try {
      await postSuggestsReq(feedbackContent, contactInfo)
      Toast.show({ message: '反馈成功', type: 'success', duration: 2000 })
      navigate('/m/m-workspace-mine')
    } catch (error) {
      console.error('提交反馈失败:', error)
      Toast.show({ message: '提交失败，请稍后重试', type: 'fail', duration: 2000 })
    } finally {
      setIsSubmitting(false)
    }
  }, [feedbackContent, contactInfo, isSubmitting, navigate])

  return (
    <div className="w-full h-[100dvh] flex flex-col bg-[#f3f3f3] page-feedback-issue">
      {/* 顶部栏 */}
      <div className="h-22 px-9 flex items-center justify-between">
        <div
          className="iconfont text-[40px]! w-10 h-10 leading-10 active:bg-[#e5e5e5] rounded-md cursor-pointer"
          onClick={handleBack}
        >
          &#xeaa2;
        </div>
        <div className="text-[36px] text-[#464646]">反馈问题</div>
        <div />
      </div>

      {/* 表单区域 */}
      <div className="flex flex-col w-full mt-18 px-9">
        {/* 反馈内容 */}
        <div className="bg-white rounded-[20px] overflow-hidden">
          <textarea
            value={feedbackContent}
            onChange={(e) => setFeedbackContent(e.target.value)}
            placeholder="说说你的问题..."
            maxLength={500}
            rows={10}
            className="w-full p-6 text-[32px] outline-none border-none bg-white resize-none"
          />
          <div className="px-6 pb-4 text-[28px] text-[#a6a6a6] text-right">
            {feedbackContent.length}/500
          </div>
        </div>

        {/* 联系方式 */}
        <div className="mt-15 h-27 flex items-center justify-between px-8 bg-white rounded-[20px]">
          <div className="text-[28px] text-[#9a9a9a] text-[32px] shrink-0">
            联系方式（选填）
          </div>
          <input
            type="text"
            value={contactInfo}
            onChange={(e) => setContactInfo(e.target.value)}
            placeholder="请填写"
            maxLength={100}
            className="flex-1 text-[32px] outline-none border-none bg-white text-right"
          />
        </div>

        {/* 提交按钮 */}
        <div
          className={`mx-auto mt-15 w-150 h-22 leading-22 text-white rounded-[20px] text-center text-[36px] cursor-pointer ${
            isSubmitting ? 'bg-[#cccccc]' : 'bg-[#fa9e00] active:bg-[#e18e00]'
          }`}
          onClick={handleSubmit}
        >
          提交反馈
        </div>
      </div>
    </div>
  )
}
