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
    <div style={{
      width: '100%', maxWidth: '100vw', height: '100vh', minHeight: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '2.5vh 0 2vh', boxSizing: 'border-box', overflow: 'hidden',
    }}>
      <div style={{
        flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
        marginTop: '7vh', width: 'min(627px, calc(100% - 120px))', maxWidth: 627, marginBottom: '3vh',
      }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: '#464646', margin: '0 0 6px', lineHeight: 1.32 }}>常见问题</h2>
        <p style={{ fontSize: 18, color: '#464646', margin: 0, lineHeight: 1.32 }}>解答你关于爆文猫写作的疑惑</p>
      </div>

      <div style={{
        flex: 1, minHeight: 0,
        width: 'min(871px, calc(100vw - 200px))', maxWidth: 871,
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        {FAQS.map((faq, index) => (
          <div
            key={index}
            ref={el => { itemsRef.current[index] = el }}
            className="scroll-reveal"
            style={{
              transitionDelay: `${index * 0.1}s`,
              minHeight: 0, background: 'white', borderRadius: 20,
              padding: 18, display: 'flex', flexDirection: 'column',
              justifyContent: 'flex-start', cursor: 'pointer',
              transition: 'box-shadow 0.3s ease, opacity 0.8s ease, transform 0.8s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
          >
            <h3 style={{ fontSize: 22, fontWeight: 700, color: '#464646', margin: '0 0 16px', lineHeight: 1.32 }}>
              {faq.question}
            </h3>
            <p style={{ fontSize: 16, fontWeight: 400, color: '#999', lineHeight: 1.3, margin: 0 }}>
              {faq.answer}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
