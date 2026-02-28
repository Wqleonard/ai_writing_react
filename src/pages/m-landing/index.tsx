'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { Button, Toast, showConfirmDialog } from 'vant'
import { useNavigate } from 'react-router-dom'
import { useLoginStore } from '@/stores/loginStore'
import MRoleCarousel from './MRoleCarousel'
import LOGO from '@/assets/images/logo.webp'
import MAIN from '@/assets/images/mlanding/main.webp'
import TEAM from '@/assets/images/mlanding/team.webp'
import WRITING_STYLE from '@/assets/images/mlanding/writing_style.webp'
import EDITOR_IMG from '@/assets/images/mlanding/editor.webp'
import ANALYSIS from '@/assets/images/mlanding/analysis.webp'
import TEACHER from '@/assets/images/mlanding/teacher.webp'
import RANKING from '@/assets/images/mlanding/ranking.webp'
import PEN from '@/assets/images/mlanding/pen.webp'
import WRITE from '@/assets/images/mlanding/write.webp'
import MASK from '@/assets/images/mlanding/mask.webp'
import GONGAN from '@/assets/images/gongan.png'
import ROLE_1 from '@/assets/images/mlanding/role_1.webp'
import ROLE_2 from '@/assets/images/mlanding/role_2.webp'
import ROLE_3 from '@/assets/images/mlanding/role_3.webp'
import ROLE_4 from '@/assets/images/mlanding/role_4.webp'

// 角色数据
const ROLE_DATA = [
  { img: ROLE_1, name: '网文/短篇', description: '更稳定的更新速度，更爽的剧情节奏' },
  { img: ROLE_2, name: '社媒剧情', description: '写同人文，剧情文，人设一致最重要' },
  { img: ROLE_3, name: '原创小说', description: '解决世界观稳定不崩，文风统一' },
  { img: ROLE_4, name: '剧本/漫画', description: '角色关系图 + 多线结构最方便' },
]

// Q&A 数据
const QA_LIST = [
  { title: 'AI 生成的内容会不会泄漏？', answer: '所有内容均加密存储，不会对外公开。' },
  { title: '适合小白吗？', answer: '完全适合，Aink 不仅是专业作家的助手，更是写作新手的良师益友。' },
  { title: '爆文猫生成的内容有版权问题吗？', answer: '你使用爆文猫写作生成的内容版权归你所有，我们不会主张任何权利。但请注意，生成内容可能包含第三方受版权保护的材料，使用时请确保符合相关法律法规。' },
  { title: '如何提高爆文猫写作生成内容的质量？', answer: '提高生成内容质量的关键是提供清晰、具体的提示。尽量详细描述你需要的内容类型、风格、长度、关键点等信息，系统会根据这些信息生成更符合你需求的内容。' },
]

export default function MLandingPage() {
  const navigate = useNavigate()
  const { requireLogin } = useLoginStore()
  const [currentRoleIndex, setCurrentRoleIndex] = useState(0)
  const isSendingRef = useRef(false)

  // 生成协议链接
  const userAgreementUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/m/user-agreement`
    : '/m/user-agreement'

  const privacyPolicyUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/m/privacy-policy`
    : '/m/privacy-policy'

  // 跳转到工作区
  const goToWorkspace = useCallback(async () => {
    if (isSendingRef.current) return
    isSendingRef.current = true

    try {
      await requireLogin(() => {
        navigate('/m/m-workspace-chat')
      })
    } catch (e) {
      // 需要登录，会弹出登录框
    } finally {
      setTimeout(() => {
        isSendingRef.current = false
      }, 1000)
    }
  }, [navigate, requireLogin])

  // 复制网址
  const copyWebsite = useCallback(async () => {
    const website = 'www.baowenmao.com'
    try {
      await navigator.clipboard.writeText(website)
      Toast.show({
        message: '网址已复制到剪贴板',
        type: 'success',
        duration: 2000,
      })
    } catch (err) {
      // 降级方案
      const textArea = document.createElement('textarea')
      textArea.value = website
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        Toast.show({
          message: '网址已复制到剪贴板',
          type: 'success',
          duration: 2000,
        })
      } catch (error) {
        Toast.show({
          message: '复制失败，请手动复制',
          type: 'fail',
          duration: 2000,
        })
      } finally {
        document.body.removeChild(textArea)
      }
    }
  }, [])

  // 角色轮播变化回调
  const handleRoleChange = useCallback((index: number) => {
    setCurrentRoleIndex(index)
  }, [])

  const currentRole = ROLE_DATA[currentRoleIndex]

  return (
    <div className="overflow-y-auto h-screen overflow-x-hidden hide-scrollbar bg-[#f7f7f4]">
      {/* 顶部导航 */}
      <div className="h-20 w-full flex justify-between items-center px-9 fixed top-0 left-0 z-99 bg-[#f7f7f4]">
        <div className="h-full flex items-center gap-4">
          <img src={LOGO} alt="logo" className="w-14 h-14 object-cover" loading="eager" />
          <div className="font-bold text-4xl">爆文猫</div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex flex-col items-center pt-20">
        {/* 首屏 */}
        <div className="h-[100dvh] flex flex-col w-full">
          {/* 图片区域 */}
          <div className="mt-20 relative flex-1 w-full min-h-0">
            <div className="absolute top-28 left-75 rounded-[30px] overflow-hidden h-[90%] w-200 bg-[#dfdfdf] rotate-[5deg]" />
            <img
              src={MAIN}
              alt="editor"
              className="absolute top-48 left-30 h-[75%]! w-auto max-w-none!"
              loading="eager"
            />
          </div>

          {/* 标题和按钮 */}
          <div className="flex-shrink-0 pt-15 pb-20 px-19">
            <div className="text-[46px] font-bold">
              爆文猫写作 陪你写出<span className="text-[#fb9d01]">好故事</span>
            </div>
            <div className="text-base text-[#464646] text-[28px] mt-2">
              喂饭级 AI 辅助写作工具，即刻成立你的写作天团！
            </div>
            <div className="mt-6 flex w-full items-center justify-start gap-8">
              <div
                className="rounded-full h-19 w-60 bg-[#eaa801] flex items-center justify-center gap-2 active:opacity-90 cursor-pointer"
                onClick={goToWorkspace}
              >
                <span className="text-[28px] text-white leading-10">立即试用</span>
                <span className="iconfont text-[28px]! text-white leading-10">&#xe642;</span>
              </div>
              <div
                className="rounded-full h-19 w-60 bg-[#eaa801] flex items-center justify-center gap-2 active:opacity-90 cursor-pointer"
                onClick={copyWebsite}
              >
                <span className="text-[28px] text-white leading-10">网页版试用</span>
                <span className="iconfont text-[28px]! text-white leading-10">&#xe613;</span>
              </div>
            </div>
          </div>
        </div>

        {/* 工作室 */}
        <section className="mt-20 text-center">
          <div className="text-[42px] font-bold text-[#464646]">一人工作室，全链路护航写作</div>
          <div className="text-[24px] text-[#464646] mt-2">Aink 提供全方位智能写作辅助，技能点满！</div>
          <div className="mt-9">
            <img src={TEAM} alt="team" className="ml-25 w-200 h-156 max-w-none! max-h-none!" loading="lazy" />
          </div>
          <div className="mt-6 text-2xl px-25 text-[#464646]">
            <span className="w-2 h-2 rounded-full bg-[#696969] mx-3 inline-block overflow-hidden -translate-y-1" />
            <span>我们拥有一整个专业写作</span>
            <span className="text-[#eaa801]">AI 团队</span>
            <span>，包括</span>
            <span className="text-[#eaa801]">设定架构师</span>、
            <span className="text-[#eaa801]">文学编辑</span>、
            <span className="text-[#eaa801]">创作写手</span>、
            <span className="text-[#eaa801]">学术顾问</span>、
            <span className="text-[#eaa801]">审稿编辑</span>
            <span>，一站式服务让每一个灵感落地成文</span>
          </div>
        </section>

        {/* 编辑器风格 */}
        <section className="mt-20 w-full">
          <div className="w-198 h-160 -ml-24 rounded-[24px] bg-gradient-to-r from-[#EFAF00] to-[#ff9500]" />
          <img
            src={WRITING_STYLE}
            alt="writing style"
            className="-mt-142 -ml-4 w-163 h-150! rounded-r-[24px] max-h-none! object-none"
            loading="lazy"
          />
          <div className="mt-12 text-2xl px-25 text-[#464646]">
            <span className="w-2 h-2 rounded-full bg-[#696969] mx-3 inline-block overflow-hidden -translate-y-1" />
            <span>稳定生成</span>
            <span className="text-[#eaa801]">指定文风</span>
            <span>，整段切换，确保</span>
            <span className="text-[#eaa801]">确保全文风格一致</span>
            <span>保留，</span>
            <span className="text-[#eaa801]">独创性表达</span>
            <span>，丰富阅读感受。</span>
          </div>
        </section>

        {/* 编辑器 */}
        <section className="mt-30 w-full">
          <div className="ml-19 w-140 h-140 rounded-full bg-gradient-to-r from-[#EFAF00] to-[#ff9500]" />
          <img
            src={EDITOR_IMG}
            alt="editor"
            className="w-244 h-135 ml-41 -mt-104 max-h-none! max-w-none! rounded-l-[24px]"
            loading="lazy"
          />
          <div className="mt-12 text-2xl px-25 text-center text-[#464646]">
            <span className="w-2 h-2 rounded-full bg-[#696969] mx-3 inline-block overflow-hidden -translate-y-1" />
            <span>从措辞、结构到逻辑，甚至错别字，AI 都能</span>
            <span className="text-[#eaa801]">准确校对</span>
            <span>并自动修改成你需要的样子，让一词一句都</span>
            <span className="text-[#eaa801]">符合期待</span>
            <span>。</span>
          </div>
        </section>

        {/* 分析 */}
        <section className="mt-30 w-full">
          <img src={ANALYSIS} alt="analysis" className="w-145 h-137 ml-24" loading="lazy" />
          <div className="mt-12 text-2xl px-25 text-center text-[#464646]">
            <span className="w-2 h-2 rounded-full bg-[#696969] mx-3 inline-block overflow-hidden -translate-y-1" />
            <span>解析优质</span>
            <span className="text-[#eaa801]">内容公式</span>
            <span>，通过</span>
            <span className="text-[#eaa801]">实战练习</span>
            <span>，助力小白飞升大神，从入门到精通的进阶之路。</span>
          </div>
        </section>

        {/* 教师 */}
        <section className="mt-30 w-full">
          <img src={TEACHER} alt="teacher" className="w-153 h-160 ml-39" loading="lazy" />
          <div className="mt-12 text-2xl px-25 text-center text-[#464646]">
            <span className="w-2 h-2 rounded-full bg-[#696969] mx-3 inline-block overflow-hidden -translate-y-1" />
            <span className="text-[#eaa801]">带你写</span>
            <span>，带的是完整流程，从结构到方向，既能补充细节也能写完全章，让不会写也能写，会写的</span>
            <span className="text-[#eaa801]">写得更快</span>
            <span>。</span>
          </div>
        </section>

        {/* 排名 */}
        <section className="mt-30 w-full flex justify-center">
          <img src={RANKING} alt="ranking" className="w-155 h-103" loading="lazy" />
          <div className="mt-12 text-2xl px-25 text-center text-[#464646]">
            <span className="w-2 h-2 rounded-full bg-[#696969] mx-3 inline-block overflow-hidden -translate-y-1" />
            <span>告别信息苦海！内置</span>
            <span className="text-[#eaa801]">智能搜索</span>
            <span>功能，为你</span>
            <span className="text-[#eaa801]">收集相关主题</span>
            <span>的最新信息和热门观点，帮助你</span>
            <span className="text-[#eaa801]">把握写作方向</span>
            <span>。</span>
          </div>
        </section>

        {/* 为什么选择我们 */}
        <section className="mt-39 text-center">
          <div className="text-[42px] font-bold text-[#464646]">为什么选择我们？</div>
          <div className="text-2xl text-[#464646] mt-2">Aink 不仅是一个写作工具，更是你的码字陪伴者</div>
        </section>

        {/* 特点 */}
        <section className="mt-24 flex flex-col items-center gap-4">
          <img src={PEN} alt="pen" loading="lazy" />
          <div className="text-[#464646] text-[28px] font-bold">灵感不枯竭</div>
          <div className="text-2xl text-[#999999] text-center w-90">
            随时生成创意，再也不用盯着空白稿纸发呆，热点榜单灵感提炼，助力更多脑洞涌现。
          </div>
        </section>

        <section className="mt-18 flex flex-col items-center gap-4">
          <img src={WRITE} alt="write" loading="lazy" />
          <div className="text-[#464646] text-[28px] font-bold">写作效率翻倍</div>
          <div className="text-2xl text-[#999999] text-center w-90">
            自动推进剧情，从大纲到正文，AI 直接生成可选剧情，你选择方向，AI 帮你写到位。
          </div>
        </section>

        <section className="mt-18 flex flex-col items-center gap-4">
          <img src={MASK} alt="mask" loading="lazy" />
          <div className="text-[#464646] text-[28px] font-bold">文风精确控制</div>
          <div className="text-2xl text-[#999999] text-center w-90">
            写出你想要的味道喜欢病娇？想要疯批？要甜宠？要古言？切换整段文风风格不在话下。
          </div>
        </section>

        {/* 适合什么样的创作者 */}
        <section className="mt-38 text-center">
          <div className="text-[42px] font-bold text-[#464646]">适合什么样的创作者？</div>
          <div className="text-2xl text-[#464646] mt-2">
            无论你是哪种类型，Aink 都能为你提供全方位的智能写作支持
          </div>
        </section>

        {/* 角色轮播图 */}
        <section className="mt-20 w-full px-25">
          <MRoleCarousel roles={ROLE_DATA} onRoleChange={handleRoleChange} />

          {/* 角色描述信息 */}
          <div className="mt-6 flex flex-col items-center gap-2 min-h-[120px]">
            <motion.div
              key={currentRoleIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-2"
            >
              <div className="text-[32px] font-bold text-[#464646]">
                {currentRole?.name}
              </div>
              <div className="text-[24px] text-[#999999] w-55 text-center">
                {currentRole?.description}
              </div>
            </motion.div>
          </div>

          {/* 进度指示器 */}
          <div className="h-13 px-9 mx-auto rounded-full w-fit bg-[#efefef] mt-6 flex items-center justify-center gap-2">
            {ROLE_DATA.map((_, index) => (
              <div
                key={index}
                className={`indicator-dot ${index === currentRoleIndex ? 'active' : ''}`}
                onClick={() => {
                  // 点击指示器切换角色
                }}
              />
            ))}
          </div>
        </section>

        {/* 常见问题 */}
        <section className="mt-20 w-full px-25 flex flex-col items-center">
          <div className="text-[42px] font-bold text-[#464646]">常见问题</div>
          <div className="text-2xl text-[#464646] mt-2">爆文猫常见问题解答</div>
        </section>

        <section className="mt-5 flex flex-col gap-6 px-9 w-full">
          {QA_LIST.map((item) => (
            <div
              key={item.title}
              className="bg-white overflow-hidden rounded-xl p-6"
            >
              <div className="text-[20px] font-bold text-[#464646]">{item.title}</div>
              <div className="mt-3 text-[18px] text-[#999999]">{item.answer}</div>
            </div>
          ))}
        </section>

        {/* 底部信息 */}
        <footer className="mt-44 px-13 w-full text-[28px] text-[#464646]">
          <div className="flex">
            <div className="flex-1">
              <div className="text-[#999999]">产品介绍</div>
              <div className="mt-7">智能生成</div>
              <div className="mt-7">内容扩写</div>
              <div className="mt-7">AI 写作教练</div>
              <div className="mt-7">定价方案</div>
              <div className="mt-25 text-[#999999]">帮助中心</div>
              <div className="mt-25 text-[#999999]">内容安全</div>
              <div className="mt-25 text-[#999999]">联系我们</div>
              <div className="mt-7 text-[#999999]">
                <span className="iconfont text-[28px]! mr-2">&#xe616;</span>
                baowenmao@126.com
              </div>
              <div className="mt-7 text-[#999999]">
                <span className="iconfont text-[28px]! mr-2">&#xe63c;</span>
                上海浦东新区
              </div>
            </div>
            <div className="flex-1 pl-27">
              <div className="text-[#999999]">使用说明</div>
              <div className="mt-7">写手教程</div>
              <div className="mt-7">进阶技巧</div>
              <div className="mt-7">常见问题</div>
              <div className="mt-7">更新日志</div>
              <div className="mt-25 text-[#999999]">创作社区</div>
            </div>
          </div>
        </footer>

        {/* 底部版权信息 */}
        <div className="mt-22 flex flex-col gap-2 items-center text-[#999999] text-2xl pb-40">
          <div className="w-150 h-[1px] bg-[#999999]" />
          <div className="mt-18">
            © 2025 数龙信息技术（浙江）有限公司 保留所有权利。
          </div>
          <div className="flex items-center justify-center gap-4 mt-4">
            <a href={privacyPolicyUrl} className="text-[#999999]">隐私政策</a>
            <a href={userAgreementUrl} className="text-[#999999]">服务政策</a>
          </div>
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" className="text-[#999999]">
            浙 ICP 备 17039406 号 -19
          </a>
          <a
            href="https://beian.mps.gov.cn/#/query/webSearch?code=33060402002057"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center text-[#999999]"
          >
            <img src={GONGAN} alt="" className="w-4 h-4 object-cover mr-2" loading="lazy" />
            <span>浙公网安备 33060402002057 号</span>
          </a>
        </div>
      </div>
    </div>
  )
}
