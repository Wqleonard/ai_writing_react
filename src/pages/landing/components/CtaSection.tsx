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
    <div style={{
      width: '100%', height: '100%', minHeight: '100vh',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      overflow: 'hidden', boxSizing: 'border-box',
    }}>
      {/* CTA Banner */}
      <div style={{ flexShrink: 0, width: '100%', maxWidth: '100vw', display: 'flex', paddingBottom: 80, flexDirection: 'row', justifyContent: 'center' }}>
        <div style={{
          width: '67vw', height: '32vh', display: 'flex', alignItems: 'center',
          justifyContent: 'center', borderRadius: 20, position: 'relative',
          overflow: 'hidden', background: 'linear-gradient(88deg, #efaf00 0%, #ff9500 100%)',
        }}>
          <img src={ctaBg} alt="bg" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} />
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <h2 style={{ fontSize: '2.5vw', fontWeight: 700, color: 'white', margin: 0, lineHeight: 1.32, textAlign: 'center', marginBottom: '2vh' }}>开始你的智能创作之旅</h2>
            <p style={{ fontSize: '1.3vw', fontWeight: 400, color: 'white', margin: 0, lineHeight: 1.32, textAlign: 'center', marginBottom: '2.5vh' }}>
              立即注册爆文猫写作，体验AI驱动的智能写作工具，让创作变得更加高效和有趣。
            </p>
            <a
              href="/workspace/my-place"
              style={{
                width: '10.7vw', height: '6.2vh', display: 'flex', alignItems: 'center',
                justifyContent: 'center', background: 'white', border: '2px solid white',
                borderRadius: 20, color: '#464646', fontSize: '1.4vw', fontWeight: 700,
                lineHeight: 1.32, textDecoration: 'none', transition: 'transform 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              了解更多
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ flexShrink: 0, width: '100%', maxWidth: '100vw', display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
        <div style={{ display: 'flex', width: 1170, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          {/* Left */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: 80, marginTop: -6 }}>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <img src={LOGO} alt="爆文猫写作" style={{ width: 36, height: 36 }} />
              <span style={{ color: '#000', fontSize: 16, fontWeight: 700, lineHeight: 1.32, fontFamily: 'YaHei, sans-serif' }}>爆文猫写作</span>
            </div>
            <p style={{ fontSize: 14, color: '#999', lineHeight: 1.6, margin: '0 0 18px', fontFamily: 'YaHei, sans-serif' }}>
              从灵感到完稿<br />一站式智能创<br />作平台
            </p>
            <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
              <a href="https://space.bilibili.com/3691002105695041" target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.3s' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                <img src={socialBili} alt="bilibili" style={{ width: 18, height: 18, objectFit: 'contain' }} />
              </a>
              <a href="https://www.xiaohongshu.com/user/profile/6944ad0f00000000380380a8" target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.3s' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                <img src={socialRb} alt="小红书" style={{ width: 21, height: 18, objectFit: 'contain' }} />
              </a>
              <span
                ref={wechatRef}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', transition: 'transform 0.3s' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                onClick={() => setShowQrCode(v => !v)}
                aria-label="微信公众号"
              >
                <img src={socialWechat} alt="微信公众号" style={{ width: 18, height: 18, objectFit: 'contain' }} />
                {showQrCode && (
                  <div className="wechat-popover">
                    <img src={qcode} alt="微信公众号" style={{ display: 'block', width: 180, height: 'auto' }} />
                  </div>
                )}
              </span>
            </div>
          </div>

          {/* Footer links */}
          <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 116 }}>
              <h4 style={{ fontSize: 16, fontWeight: 700, color: '#464646', margin: '0 0 16px', lineHeight: 1.32, fontFamily: 'YaHei, sans-serif' }}>使用说明</h4>
              {[
                { label: '新手教程', href: 'https://icnkb9ipguth.feishu.cn/wiki/UcjdwuyKOiqhhLkcKZvcN5X4n7f', target: '_blank' },
                { label: '写作进阶技巧', href: '/workspace/creation-community/course' },
                { label: '真实用户分享', href: '/workspace/creation-community/share' },
              ].map(link => (
                <a key={link.label} href={link.href} target={link.target} rel={link.target ? 'noreferrer' : undefined}
                  style={{ display: 'block', fontSize: 14, color: '#999', textDecoration: 'none', marginBottom: 10, lineHeight: 1.32, transition: 'color 0.3s', fontFamily: 'YaHei, sans-serif' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#464646')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#999')}
                >
                  {link.label}
                </a>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 144 }}>
              <h4 style={{ fontSize: 16, fontWeight: 700, color: '#464646', margin: '0 0 16px', lineHeight: 1.32, fontFamily: 'YaHei, sans-serif' }}>联系我们</h4>
              <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#999', margin: '0 0 10px', lineHeight: 1.32 }}>
                <img src={contactMail} alt="Email" style={{ flexShrink: 0, objectFit: 'contain' }} />
                <span>baowenmaoai@126.com</span>
              </p>
              <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#999', margin: 0, lineHeight: 1.32 }}>
                <img src={contactLocation} alt="Location" style={{ flexShrink: 0, objectFit: 'contain' }} />
                <span>上海浦东新区</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Privacy section */}
      <div style={{ flexShrink: 0, width: '100%', maxWidth: '100vw', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 40 }}>
        <div style={{ width: 1170, height: 0.5, backgroundColor: '#ccc' }} />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', marginTop: 47 }}>
          <p style={{ fontSize: 14, color: '#999', lineHeight: 1.32, margin: 0, fontFamily: 'YaHei, sans-serif' }}>
            © 2025 数龙信息技术（浙江）有限公司 保留所有权利。
          </p>
          <div style={{ display: 'flex', flexDirection: 'row', gap: 0, alignItems: 'center' }}>
            {[
              { label: '隐私政策', href: privacyPolicyUrl },
              { label: '服务政策', href: userAgreementUrl },
            ].map(link => (
              <a key={link.label} href={link.href} target="_blank" rel="noreferrer"
                style={{ marginTop: 10, fontSize: 14, color: '#999', textDecoration: 'none', lineHeight: 1.32, marginRight: 20, transition: 'color 0.3s', whiteSpace: 'nowrap' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#efaf00'; e.currentTarget.style.textDecoration = 'underline' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#999'; e.currentTarget.style.textDecoration = 'none' }}
              >
                {link.label}
              </a>
            ))}
          </div>
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer"
            style={{ fontSize: 14, color: '#999', lineHeight: 1.32, marginTop: 10, textDecoration: 'none', transition: 'color 0.3s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#efaf00')}
            onMouseLeave={e => (e.currentTarget.style.color = '#999')}
          >
            浙ICP备17039406号-19
          </a>
          <a
            href="https://beian.mps.gov.cn/#/query/webSearch?code=33060402002057"
            rel="noreferrer" target="_blank"
            style={{ fontSize: 14, color: '#999', lineHeight: 1.32, marginTop: 10, textDecoration: 'none', display: 'flex', alignItems: 'center', transition: 'color 0.3s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#efaf00')}
            onMouseLeave={e => (e.currentTarget.style.color = '#999')}
          >
            <img src={GONGAN} alt="" style={{ width: 16, height: 16, objectFit: 'cover', marginRight: 8 }} />
            <span>浙公网安备33060402002057号</span>
          </a>
        </div>
      </div>
    </div>
  )
}
