import { useEffect, useRef } from 'react'

const FAQS = [
  { question: 'AI 生成的内容会不会泄漏？', answer: '所有内容均加密存储，不会对外公开。' },
  { question: '内容会不会重复？', answer: '爆文猫写作采用先进的自然语言处理技术，生成内容独特且可控。' },
  { question: '适合小白吗？', answer: '完全适合，爆文猫写作不仅是专业作家的助手，更是写作新手的良师益友。' },
  {
    question: '爆文猫写作生成的内容有版权问题吗？',
    answer: '你使用爆文猫写作生成的内容版权归你所有，我们不会主张任何权利。但请注意，生成内容可能包含第三方受版权保护的材料，使用时请确保符合相关法律法规。',
  },
  {
    question: '如何提高爆文猫写作生成内容的质量？',
    answer: '提高生成内容质量的关键是提供清晰、具体的提示。尽量详细描述你需要的内容类型、风格、长度、关键点等信息，系统会根据这些信息生成更符合你需求的内容。',
  },
]

export function FaqSection() {
  const itemsRef = useRef<(HTMLDivElement | null)[]>([])

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
    itemsRef.current.forEach(el => { if (el) observer.observe(el) })
    return () => observer.disconnect()
  }, [])

  return (
    <div className="flex h-screen min-h-screen w-full max-w-screen flex-col items-center overflow-hidden box-border pt-[2.5vh] pb-[2vh]">
      <div className="flex shrink-0 flex-col items-center mt-[7vh] mb-[3vh] mx-15 w-full max-w-[627px]">
        <h2 className="m-0 mb-1.5 text-[1.625rem] font-bold leading-[1.32] text-[#464646]">
          常见问题
        </h2>
        <p className="m-0 text-[1.125rem] leading-[1.32] text-[#464646]">
          解答你关于爆文猫写作的疑惑
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 mx-[100px] w-full max-w-[871px]">
        {FAQS.map((faq, index) => (
          <div
            key={index}
            ref={el => { itemsRef.current[index] = el }}
            className="scroll-reveal flex min-h-0 cursor-pointer flex-col justify-start rounded-[1.25rem] bg-white p-4.5 transition-[box-shadow_0.3s_ease,opacity_0.8s_ease,transform_0.8s_ease] hover:shadow-[0_10px_20px_rgba(0,0,0,0.08)]"
            style={{ transitionDelay: `${index * 0.1}s` }}
          >
            <h3 className="m-0 mb-4 text-[1.375rem] font-bold leading-[1.32] text-[#464646]">
              {faq.question}
            </h3>
            <p className="m-0 text-base font-normal leading-[1.3] text-[#999]">
              {faq.answer}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
