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
    <div className="flex min-h-screen w-screen flex-col items-center pt-25 pb-0 px-50">
      <div className="flex flex-col items-center mb-15">
        <h2 className="m-0 mb-4 text-4xl font-bold leading-[1.32] text-[#464646]">
          适合什么样的创作者？
        </h2>
        <p className="m-0 text-[1.125rem] leading-[1.32] text-[#464646]">
          无论你是哪种类型，爆文猫写作都能为你提供全方位的智能写作支持
        </p>
      </div>

      <div className="relative flex flex-col items-center">
        {/* People images row */}
        <div
          className="relative z-2 flex flex-1 w-full flex-row items-end justify-center overflow-hidden"
          style={{
            backgroundImage: `url(${bgImage})`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center top',
            backgroundSize: '100% auto',
          }}
        >
          {SCENARIOS.map((scenario, index) => {
            const personStyle = getPersonStyle(index)
            return (
              <div
                key={index}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  ...personStyle,
                  marginLeft: index === 3 ? '40px' : index === 2 ? '10px' : personStyle.marginLeft,
                  transform: hoveredIndex === index ? 'translateY(-5px)' : 'translateY(0)',
                }}
                className="relative z-2 flex cursor-pointer shrink-0 items-end transition-transform duration-300 ease-in-out"
              >
                <img
                  src={hoveredIndex === index ? scenario.hoverImage : scenario.image}
                  alt={scenario.title}
                  className="block h-full w-full object-contain transition-opacity duration-300 ease-in-out"
                  loading="lazy"
                />
              </div>
            )
          })}
        </div>

        {/* Text labels */}
        <div className="mt-[53px] flex w-[calc(100vw-720px)] flex-row items-start justify-center gap-0 p-0">
          {SCENARIOS.map((scenario, index) => (
            <div key={index} className="flex min-w-0 flex-1 flex-col items-center">
              <h3 className="m-0 mb-[18px] overflow-hidden text-center text-[1.75rem] font-bold leading-[1.32] text-[#464646] whitespace-nowrap text-ellipsis">
                {scenario.title}
              </h3>
              <p className="m-0 max-w-[144px] overflow-hidden text-center text-[23px] leading-[1.32] text-[#999] line-clamp-3">
                {scenario.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
