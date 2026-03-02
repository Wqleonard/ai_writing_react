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
    <div className="flex min-h-screen w-screen flex-col items-center justify-center box-border py-25">
      <div className="flex flex-col items-center w-full max-w-[627px] mb-15">
        <h2 className="m-0 mb-4 text-4xl font-bold leading-[1.32] text-[#464646]">
          为什么选择我们？
        </h2>
        <p className="m-0 text-[1.125rem] leading-[1.32] text-[#464646]">
          爆文猫写作不仅是一个写作工具，更是你的码字陪伴者
        </p>
      </div>

      <div className="flex w-full max-w-[1209px] flex-row items-start justify-between mx-[100px]">
        {BENEFITS.map((benefit, index) => (
          <div
            key={index}
            ref={el => { cardsRef.current[index] = el }}
            style={{ transition: 'transform 0.3s ease, box-shadow 0.3s ease' }}
            className="scroll-reveal flex cursor-pointer flex-col items-center justify-start rounded-[1.25rem] px-5 pt-9 pb-5 min-w-[250px] max-w-[318px] w-[26.3%] hover:-translate-y-2 hover:shadow-[0_15px_40px_rgba(0,0,0,0.12)]"
          >
            <div className="flex mb-9.5 h-[clamp(150px,16.54vw,200px)] w-[clamp(150px,16.54vw,200px)] min-h-[150px] min-w-[150px] max-h-[200px] max-w-[200px] items-center justify-center">
              <img src={benefit.icon} alt="icon" className="max-h-full max-w-full object-contain" loading="lazy" />
            </div>
            <h3 className="m-0 mb-[27px] text-[1.75rem] font-bold leading-[1.32] text-[#464646]">
              {benefit.title}
            </h3>
            <p className="m-0 text-center text-xl leading-[1.32] text-[#999]">
              {benefit.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
