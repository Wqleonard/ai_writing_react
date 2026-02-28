import { useEffect, useRef } from 'react'
import benefitIcon1 from '@/assets/landing_image/benefit-icon-1.svg'
import benefitIcon2 from '@/assets/landing_image/benefit-icon-2.svg'
import benefitIcon3 from '@/assets/landing_image/benefit-icon-3.svg'

const BENEFITS = [
  {
    icon: benefitIcon1,
    title: '灵感不枯竭',
    desc: '随时生成创意，再也不用盯着空白稿纸发呆，热点榜单灵感提炼，助力更多脑洞涌现。',
  },
  {
    icon: benefitIcon2,
    title: '写作效率翻倍',
    desc: '自动推进剧情，从大纲到正文，AI 直接生成可选剧情，你选择方向，AI 帮你写到位。',
  },
  {
    icon: benefitIcon3,
    title: '文风精确控制',
    desc: '写出你想要的味道喜欢病娇？想要疯批？要甜宠？要古言？切换整段文风风格不在话下。',
  },
]

export function AdvantagesSection() {
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('active')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0, rootMargin: '0px 0px -15% 0px' }
    )
    cardsRef.current.forEach(el => { if (el) observer.observe(el) })
    return () => observer.disconnect()
  }, [])

  return (
    <div style={{
      width: '100vw', minHeight: '100vh', display: 'flex',
      flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
      padding: '100px 0', boxSizing: 'border-box',
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        width: 'min(627px, calc((627 / 1209) * 100%))',
        maxWidth: 627, marginBottom: 60,
      }}>
        <h2 style={{ fontSize: 36, fontWeight: 700, color: '#464646', margin: '0 0 15px', lineHeight: 1.32 }}>为什么选择我们？</h2>
        <p style={{ fontSize: 18, color: '#464646', margin: 0, lineHeight: 1.32 }}>爆文猫写作不仅是一个写作工具，更是你的码字陪伴者</p>
      </div>

      <div style={{
        width: 'min(1209px, calc(100vw - 200px))', maxWidth: 1209,
        display: 'flex', flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        {BENEFITS.map((benefit, index) => (
          <div
            key={index}
            ref={el => { cardsRef.current[index] = el }}
            className="scroll-reveal"
            style={{
              borderRadius: 20, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'flex-start',
              transition: 'all 0.3s ease, opacity 0.8s ease, transform 0.8s ease',
              cursor: 'pointer', padding: '37px 20px 20px',
              width: 'clamp(250px, calc((318 / 1209) * 100%), 318px)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-8px)'
              e.currentTarget.style.boxShadow = '0 15px 40px rgba(0,0,0,0.12)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = e.currentTarget.classList.contains('active') ? 'translateY(0)' : 'translateY(30px)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{
              width: 'clamp(150px, calc((200 / 1209) * 100vw), 200px)',
              height: 'clamp(150px, calc((200 / 1209) * 100vw), 200px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 38,
            }}>
              <img src={benefit.icon} alt="icon" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>
            <h3 style={{ fontSize: 28, fontWeight: 700, color: '#464646', margin: '0 0 27px', lineHeight: 1.32 }}>
              {benefit.title}
            </h3>
            <p style={{ fontSize: 20, color: '#999', lineHeight: 1.32, margin: 0, textAlign: 'center' }}>
              {benefit.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
