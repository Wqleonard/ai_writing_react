import { useRef, useState } from 'react'
import ctaBg from '@/assets/landing_image/cta-bg.svg'
import socialBili from '@/assets/landing_image/social-icon-bili.svg'
import socialRb from '@/assets/landing_image/social-icon-rb.svg'
import socialWechat from '@/assets/landing_image/social-icon-wechat.svg'
import qcode from '@/assets/landing_image/qcode.png'
import contactMail from '@/assets/landing_image/contact-icon-mail.svg'
import contactLocation from '@/assets/landing_image/contact-icon-location.svg'
import LOGO from '@/assets/images/my-place/sidebar_logo.png'
import GONGAN from '@/assets/images/gongan.png'

export function CtaSection() {
  const [showQrCode, setShowQrCode] = useState(false)
  const wechatRef = useRef<HTMLSpanElement>(null)

  const privacyPolicyUrl = `${window.location.origin}/privacy-policy`
  const userAgreementUrl = `${window.location.origin}/user-agreement`

  return (
    <div className="flex h-full min-h-screen w-full flex-col justify-end overflow-hidden box-border">
      {/* CTA Banner */}
      <div className="flex shrink-0 w-full max-w-screen flex-row justify-center pb-20">
        <div className="relative flex h-[32vh] w-[67vw] items-center justify-center overflow-hidden rounded-[1.25rem] bg-[linear-gradient(88deg,#efaf00_0%,#ff9500_100%)]">
          <img src={ctaBg} alt="bg" className="absolute top-0 left-0 z-0 h-full w-full object-cover" loading="lazy" />
          <div className="relative z-1 flex flex-col items-center justify-center">
            <h2 className="m-0 mb-[2vh] text-center text-[2.5vw] font-bold leading-[1.32] text-white">
              开始你的智能创作之旅
            </h2>
            <p className="m-0 mb-[2.5vh] text-center text-[1.3vw] font-normal leading-[1.32] text-white">
              立即注册爆文猫写作，体验AI驱动的智能写作工具，让创作变得更加高效和有趣。
            </p>
            <a
              href="/workspace/my-place"
              className="flex h-[6.2vh] w-[10.7vw] items-center justify-center rounded-[1.25rem] border-2 border-white bg-white text-[1.4vw] font-bold leading-[1.32] text-[#464646] no-underline transition-transform duration-200 hover:-translate-y-0.5"
            >
              了解更多
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex shrink-0 w-full max-w-screen justify-center mb-10">
        <div className="flex w-[1170px] max-w-[calc(100vw-2rem)] flex-row items-start justify-between">
          {/* Left */}
          <div className="flex flex-col items-center mr-20 -mt-1.5">
            <div className="flex flex-row items-center justify-center mb-3">
              <img src={LOGO} alt="爆文猫写作" className="size-9" loading="lazy" />
              <span className="font-YaHei text-base font-bold leading-[1.32] text-black">爆文猫写作</span>
            </div>
            <p className="font-YaHei m-0 mb-[18px] text-sm leading-[1.6] text-[#999]">
              从灵感到完稿<br />一站式智能创<br />作平台
            </p>
            <div className="flex gap-[15px] items-center">
              <a
                href="https://space.bilibili.com/3691002105695041"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center transition-transform duration-300 hover:-translate-y-0.5"
              >
                <img src={socialBili} alt="bilibili" className="size-[18px] object-contain" loading="lazy" />
              </a>
              <a
                href="https://www.xiaohongshu.com/user/profile/6944ad0f00000000380380a8"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center transition-transform duration-300 hover:-translate-y-0.5"
              >
                <img src={socialRb} alt="小红书" className="h-[18px] w-[21px] object-contain" loading="lazy" />
              </a>
              <span
                ref={wechatRef}
                className="relative flex cursor-pointer items-center justify-center transition-transform duration-300 hover:-translate-y-0.5"
                onClick={() => setShowQrCode(v => !v)}
                aria-label="微信公众号"
              >
                <img src={socialWechat} alt="微信公众号" className="size-[18px] object-contain" loading="lazy" />
                {showQrCode && (
                  <div className="wechat-popover">
                    <img src={qcode} alt="微信公众号" className="block h-auto w-[180px]" loading="lazy" />
                  </div>
                )}
              </span>
            </div>
          </div>

          {/* Footer links */}
          <div className="flex flex-1 flex-row justify-end">
            <div className="flex min-w-[116px] flex-col">
              <h4 className="font-YaHei m-0 mb-4 text-base font-bold leading-[1.32] text-[#464646]">使用说明</h4>
              {[
                { label: '新手教程', href: 'https://icnkb9ipguth.feishu.cn/wiki/UcjdwuyKOiqhhLkcKZvcN5X4n7f', target: '_blank' },
                { label: '写作进阶技巧', href: '/workspace/creation-community/course' },
                { label: '真实用户分享', href: '/workspace/creation-community/share' },
              ].map(link => (
                <a
                  key={link.label}
                  href={link.href}
                  target={link.target}
                  rel={link.target ? 'noreferrer' : undefined}
                  className="font-YaHei block mb-2.5 text-sm leading-[1.32] text-[#999] no-underline transition-colors duration-300 hover:text-[#464646]"
                >
                  {link.label}
                </a>
              ))}
            </div>
            <div className="flex min-w-[144px] flex-col">
              <h4 className="font-YaHei m-0 mb-4 text-base font-bold leading-[1.32] text-[#464646]">联系我们</h4>
              <p className="flex m-0 mb-2.5 items-center gap-2 text-sm leading-[1.32] text-[#999]">
                <img src={contactMail} alt="Email" className="shrink-0 object-contain" loading="lazy" />
                <span>baowenmaoai@126.com</span>
              </p>
              <p className="flex m-0 items-center gap-2 text-sm leading-[1.32] text-[#999]">
                <img src={contactLocation} alt="Location" className="shrink-0 object-contain" loading="lazy" />
                <span>上海浦东新区</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Privacy section */}
      <div className="flex shrink-0 w-full max-w-screen flex-col items-center pb-10">
        <div className="h-0.5 w-[1170px] max-w-[calc(100vw-2rem)] bg-[#ccc]" />
        <div className="flex flex-col items-center justify-center mt-[47px]">
          <p className="font-YaHei m-0 text-sm leading-[1.32] text-[#999]">
            © 2025 数龙信息技术（浙江）有限公司 保留所有权利。
          </p>
          <div className="flex flex-row items-center gap-0">
            {[
              { label: '隐私政策', href: privacyPolicyUrl },
              { label: '服务政策', href: userAgreementUrl },
            ].map(link => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="mt-2.5 mr-5 whitespace-nowrap text-sm leading-[1.32] text-[#999] no-underline transition-colors duration-300 hover:text-[#efaf00] hover:underline"
              >
                {link.label}
              </a>
            ))}
          </div>
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noreferrer"
            className="mt-2.5 text-sm leading-[1.32] text-[#999] no-underline transition-colors duration-300 hover:text-[#efaf00]"
          >
            浙ICP备17039406号-19
          </a>
          <a
            href="https://beian.mps.gov.cn/#/query/webSearch?code=33060402002057"
            rel="noreferrer"
            target="_blank"
            className="mt-2.5 flex items-center text-sm leading-[1.32] text-[#999] no-underline transition-colors duration-300 hover:text-[#efaf00]"
          >
            <img src={GONGAN} alt="" className="mr-2 size-4 object-cover" loading="lazy" />
            <span>浙公网安备33060402002057号</span>
          </a>
        </div>
      </div>
    </div>
  )
}
