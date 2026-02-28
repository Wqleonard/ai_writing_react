import { useState, useEffect, useRef } from 'react'
import wheelBg from '@/assets/landing_image/yuanhuan.png'
import wheelIcon1 from '@/assets/landing_image/item_1.svg'
import wheelIcon1Active from '@/assets/landing_image/item_1_active.svg'
import wheelImage1 from '@/assets/landing_image/wheel-1-team.png'
import wheelIcon2 from '@/assets/landing_image/item_2.svg'
import wheelIcon2Active from '@/assets/landing_image/item_2_active.svg'
import wheelImage2 from '@/assets/landing_image/wheel-2-style.png'
import wheelIcon3 from '@/assets/landing_image/item_3.svg'
import wheelIcon3Active from '@/assets/landing_image/item_3_active.svg'
import wheelImage3 from '@/assets/landing_image/wheel-3-edit.png'
import wheelIcon4 from '@/assets/landing_image/item_4.svg'
import wheelIcon4Active from '@/assets/landing_image/item_4_active.svg'
import wheelImage4 from '@/assets/landing_image/wheel-4-analyze.png'
import wheelIcon5 from '@/assets/landing_image/item_5.svg'
import wheelIcon5Active from '@/assets/landing_image/item_5_active.svg'
import wheelImage5 from '@/assets/landing_image/wheel-5-coach.png'
import wheelIcon6 from '@/assets/landing_image/item_6.svg'
import wheelIcon6Active from '@/assets/landing_image/item_6_active.svg'
import wheelImage6 from '@/assets/landing_image/wheel-6-research.png'

const WHEEL_ITEMS = [
  {
    title: 'AI专家写作团队', icon: wheelIcon1, iconActive: wheelIcon1Active, image: wheelImage1,
    originalWidth: 686, originalHeight: 532,
    descriptionParts: [
      { text: '我们拥有一整个专业写作', highlight: false },
      { text: 'AI团队', highlight: true },
      { text: '，包括', highlight: false },
      { text: '设定架构师、文学编辑、创作写手、学术顾问、审稿编辑', highlight: true },
      { text: '，一站式服务让每一个灵感落地成文。', highlight: false },
    ],
  },
  {
    title: '个性化文风', icon: wheelIcon2, iconActive: wheelIcon2Active, image: wheelImage2,
    originalWidth: 753, originalHeight: 647,
    descriptionParts: [
      { text: '稳定生成', highlight: false },
      { text: '指定文风', highlight: true },
      { text: '，整段切换，确保', highlight: false },
      { text: '全文风格一致', highlight: true },
      { text: '，保留', highlight: false },
      { text: '独创性表达', highlight: true },
      { text: '，丰富阅读感受。', highlight: false },
    ],
  },
  {
    title: '精准局部改写', icon: wheelIcon3, iconActive: wheelIcon3Active, image: wheelImage3,
    originalWidth: 887, originalHeight: 640,
    descriptionParts: [
      { text: '从措辞、结构到逻辑，甚至错别字，AI都能', highlight: false },
      { text: '准确校对', highlight: true },
      { text: '并自动修改成你需要的样子，让一词一句都', highlight: false },
      { text: '符合期待', highlight: true },
      { text: '。', highlight: false },
    ],
  },
  {
    title: '爆款内容拆解', icon: wheelIcon4, iconActive: wheelIcon4Active, image: wheelImage4,
    originalWidth: 877, originalHeight: 810,
    descriptionParts: [
      { text: '解析优质', highlight: false },
      { text: '内容公式', highlight: true },
      { text: '，通过', highlight: false },
      { text: '实战练习', highlight: true },
      { text: '，助力小白飞升大神，从入门到精通的进阶之路。', highlight: false },
    ],
  },
  {
    title: 'AI写作教练', icon: wheelIcon5, iconActive: wheelIcon5Active, image: wheelImage5,
    originalWidth: 685, originalHeight: 716,
    descriptionParts: [
      { text: '带你写，', highlight: false },
      { text: '带的是完整流程', highlight: true },
      { text: '，从结构到方向，既能补充细节也能写完全章，让不会写也能写，会', highlight: false },
      { text: '写得更快', highlight: true },
      { text: '。', highlight: false },
    ],
  },
  {
    title: '智能调研助手', icon: wheelIcon6, iconActive: wheelIcon6Active, image: wheelImage6,
    originalWidth: 985, originalHeight: 659,
    descriptionParts: [
      { text: '告别信息苦海！内置', highlight: false },
      { text: '智能搜索', highlight: true },
      { text: '功能，为你收集相关主题的', highlight: false },
      { text: '最新信息和热门观点，帮助你', highlight: true },
      { text: '把握写作方向。', highlight: false },
    ],
  },
]

const WHEEL_POSITIONS = [
  { top: '11%', left: '38%' },
  { top: '25%', left: '24%' },
  { top: '40.4%', left: '16%' },
  { top: '54.5%', left: '16.1%' },
  { top: '69%', left: '24%' },
  { top: '82.1%', left: '38.4%' },
]

export function WorkshopSection() {
  const [currentWheel, setCurrentWheel] = useState(0)
  const [animKey, setAnimKey] = useState(0)
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const getImageStyle = (index: number): React.CSSProperties => {
    const item = WHEEL_ITEMS[index]
    const containerWidth = 985
    const containerHeight = window.innerHeight - 176
    const availableHeight = containerHeight - 270
    const aspectRatio = item.originalWidth / item.originalHeight
    let height = availableHeight
    let width = height * aspectRatio
    if (width > containerWidth) {
      width = containerWidth
      height = width / aspectRatio
    }
    return { width: `${width}px`, height: `${height}px` }
  }

  const handleWheelClick = (index: number) => {
    setCurrentWheel(index)
    setAnimKey(k => k + 1)
    if (autoPlayRef.current) clearInterval(autoPlayRef.current)
  }

  useEffect(() => {
    autoPlayRef.current = setInterval(() => {
      setCurrentWheel(prev => (prev + 1) % WHEEL_ITEMS.length)
      setAnimKey(k => k + 1)
    }, 3000)
    return () => { if (autoPlayRef.current) clearInterval(autoPlayRef.current) }
  }, [])

  const item = WHEEL_ITEMS[currentWheel]

  return (
    <div style={{
      width: '100vw', display: 'flex', flexDirection: 'column',
      justifyContent: 'flex-start', alignItems: 'center',
      paddingTop: 84, minHeight: '100vh', position: 'relative',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h2 style={{ fontSize: 36, fontWeight: 700, color: '#464646', margin: '0 0 15px', lineHeight: 1.32 }}>一人工作室，全链路护航写作</h2>
        <p style={{ fontSize: 18, color: '#464646', margin: 0, lineHeight: 1.32 }}>爆文猫写作提供全方位智能写作辅助，技能点满！</p>
      </div>

      {/* Carousel wheel */}
      <div style={{
        position: 'absolute', left: 200, bottom: 0,
        width: 'calc(100vh - 176px)', height: 'calc(100vh - 176px)',
        display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
      }}>
        <div style={{ position: 'absolute', width: '100%', height: '100%' }}>
          <img src={wheelBg} alt="wheel background" style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, objectFit: 'cover' }} />
          {WHEEL_ITEMS.map((wItem, index) => (
            <div
              key={index}
              onClick={() => handleWheelClick(index)}
              style={{
                position: 'absolute', display: 'flex', alignItems: 'center', gap: 20,
                cursor: 'pointer', transition: 'all 0.3s', zIndex: 10,
                top: WHEEL_POSITIONS[index].top, left: WHEEL_POSITIONS[index].left,
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateX(-5px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateX(0)')}
            >
              <img
                src={currentWheel === index ? wItem.iconActive : wItem.icon}
                alt={wItem.title}
                style={{ width: 60, height: 60 }}
              />
              <span style={{
                fontSize: 24, fontFamily: 'YaHei, sans-serif', fontWeight: 700,
                color: currentWheel === index ? '#464646' : '#8e8e8e',
                whiteSpace: 'nowrap', transition: 'all 0.3s',
              }}>
                {wItem.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Right content */}
      <div style={{ position: 'absolute', bottom: 0, right: 200, zIndex: 5 }}>
        <div
          key={animKey}
          style={{
            display: 'flex', height: 'calc(100vh - 176px)', maxWidth: 985,
            flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
            boxSizing: 'border-box', overflow: 'hidden',
            animation: 'slideIn 0.5s ease',
          }}
        >
          <style>{`@keyframes slideIn { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }`}</style>
          <img src={item.image} alt={item.title} style={{ ...getImageStyle(currentWheel), width: 'auto', height: 'auto', objectFit: 'contain', flexShrink: 0 }} />
          <p style={{
            position: 'relative', width: 474, fontSize: 24, color: '#696969',
            lineHeight: 1.32, textAlign: 'center', fontFamily: 'YaHei, sans-serif',
            fontWeight: 700, marginTop: 40, flexShrink: 0,
          }}>
            <span style={{
              display: 'block', width: 8, height: 8, background: '#efaf00',
              borderRadius: '50%', position: 'absolute', top: 12, left: -20,
            }} />
            {item.descriptionParts.map((part, i) => (
              <span key={i} style={{ color: part.highlight ? '#efaf00' : undefined }}>{part.text}</span>
            ))}
          </p>
        </div>
      </div>
    </div>
  )
}
