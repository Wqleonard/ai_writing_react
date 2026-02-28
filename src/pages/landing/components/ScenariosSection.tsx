import { useState } from 'react'
import scenarioImage1 from '@/assets/landing_image/people/1.png'
import scenarioHoverImage1 from '@/assets/landing_image/people/1_hover.png'
import scenarioImage2 from '@/assets/landing_image/people/2.png'
import scenarioHoverImage2 from '@/assets/landing_image/people/2_hover.png'
import scenarioImage3 from '@/assets/landing_image/people/3.png'
import scenarioHoverImage3 from '@/assets/landing_image/people/3_hover.png'
import scenarioImage4 from '@/assets/landing_image/people/4.png'
import scenarioHoverImage4 from '@/assets/landing_image/people/4_hover.png'
import bgImage from '@/assets/landing_image/people/bg.png'

const SCENARIOS = [
  { title: '网文/短篇', desc: '更稳定的更新速度，更爽的剧情节奏', image: scenarioImage1, hoverImage: scenarioHoverImage1, originalWidth: 926, originalHeight: 1234 },
  { title: '社媒剧情', desc: '写同人文，剧情文，人设一致最重要', image: scenarioImage2, hoverImage: scenarioHoverImage2, originalWidth: 926, originalHeight: 1234 },
  { title: '原创小说', desc: '解决世界观稳定不崩，文风统一', image: scenarioImage3, hoverImage: scenarioHoverImage3, originalWidth: 926, originalHeight: 1234 },
  { title: '剧本/漫画', desc: '角色关系图+多线结构最方便', image: scenarioImage4, hoverImage: scenarioHoverImage4, originalWidth: 926, originalHeight: 1234 },
]

function getPersonStyle(index: number): React.CSSProperties {
  const originalWidth = 926
  const originalHeight = 1234
  const containerWidth = window.innerWidth - 720
  const containerHeight = window.innerHeight - 357
  const imageAspectRatio = originalWidth / originalHeight
  const availableHeight = Math.max(containerHeight - 150, 200)
  let scaledHeight = availableHeight
  let scaledWidth = scaledHeight * imageAspectRatio
  const totalWidth = scaledWidth * 4 + 45 * 3
  if (totalWidth > containerWidth) {
    scaledWidth = Math.max((containerWidth - 45 * 3) / 4, 100)
    scaledHeight = scaledWidth / imageAspectRatio
  }
  const marginLeft = index > 0 ? `${45 * (scaledWidth / originalWidth)}px` : '0'
  return { width: `${scaledWidth}px`, height: `${scaledHeight}px`, marginLeft, flexShrink: 0 }
}

export function ScenariosSection() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <div style={{
      width: '100vw', display: 'flex', minHeight: '100vh',
      flexDirection: 'column', alignItems: 'center',
      padding: '100px 200px 0 200px',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 60 }}>
        <h2 style={{ fontSize: 36, fontWeight: 700, color: '#464646', margin: '0 0 15px', lineHeight: 1.32 }}>适合什么样的创作者？</h2>
        <p style={{ fontSize: 18, color: '#464646', margin: 0, lineHeight: 1.32 }}>无论你是哪种类型，爆文猫写作都能为你提供全方位的智能写作支持</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
        {/* People images row */}
        <div style={{
          display: 'flex', flexDirection: 'row', justifyContent: 'center',
          alignItems: 'flex-end', flex: 1, width: '100%', position: 'relative', zIndex: 2,
          backgroundImage: `url(${bgImage})`, backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center top', backgroundSize: '100% auto', overflow: 'hidden',
        }}>
          {SCENARIOS.map((scenario, index) => (
            <div
              key={index}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{
                ...getPersonStyle(index),
                cursor: 'pointer',
                transition: 'transform 0.3s ease-in-out',
                transform: hoveredIndex === index ? 'translateY(-5px)' : 'translateY(0)',
                display: 'flex', alignItems: 'flex-end', position: 'relative', zIndex: 2,
                marginLeft: index === 3 ? '40px' : index === 2 ? '10px' : getPersonStyle(index).marginLeft,
              }}
            >
              <img
                src={hoveredIndex === index ? scenario.hoverImage : scenario.image}
                alt={scenario.title}
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', transition: 'opacity 0.3s ease-in-out' }}
              />
            </div>
          ))}
        </div>

        {/* Text labels */}
        <div style={{
          display: 'flex', flexDirection: 'row', justifyContent: 'center',
          alignItems: 'flex-start', width: 'calc(100vw - 720px)',
          padding: 0, marginTop: 53, gap: 0,
        }}>
          {SCENARIOS.map((scenario, index) => (
            <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 0 }}>
              <h3 style={{ fontSize: 28, fontWeight: 700, color: '#464646', margin: '0 0 18px', lineHeight: 1.32, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {scenario.title}
              </h3>
              <p style={{ fontSize: 23, color: '#999', lineHeight: 1.32, margin: 0, textAlign: 'center', maxWidth: 144, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {scenario.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
