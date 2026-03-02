import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import penIcon from '@/assets/landing_image/pen-icon.svg'
import vectorIcon from '@/assets/landing_image/vector.svg'
import bookIcon from '@/assets/landing_image/book-icon.svg'
import scriptIcon from '@/assets/landing_image/script-icon.svg'
import groupIcon from '@/assets/landing_image/group.svg'
import fenge from '@/assets/landing_image/fenge.svg'
import greyBg from '@/assets/landing_image/grey-bg.png'

interface HeroSectionProps {
  isCreatingWork: boolean
  onShortStoryClick: () => void
  onScriptClick: () => void
  onProfessionalClick: () => void
}

export function HeroSection({
  isCreatingWork,
  onShortStoryClick,
  onScriptClick,
  onProfessionalClick,
}: HeroSectionProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [isButtonHovered, setIsButtonHovered] = useState(false)
  const [isProfessionalButtonHovered, setIsProfessionalButtonHovered] = useState(false)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const dropdownContainerRef = useRef<HTMLDivElement>(null)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const isHoveredDropdownRef = useRef(false)

  const clearHoverTimeout = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = undefined
    }
  }

  const handleButtonEnter = () => {
    clearHoverTimeout()
    setIsButtonHovered(true)
  }

  const handleButtonLeave = () => {
    if (showDropdown) {
      hoverTimeoutRef.current = setTimeout(() => {
        if (!isHoveredDropdownRef.current) {
          setShowDropdown(false)
        }
        setIsButtonHovered(false)
      }, 500)
    } else {
      setIsButtonHovered(false)
    }
  }

  const handleMenuEnter = () => {
    clearHoverTimeout()
    isHoveredDropdownRef.current = true
    setIsButtonHovered(false)
  }

  const handleMenuLeave = () => {
    setTimeout(() => { isHoveredDropdownRef.current = false }, 200)
    setShowDropdown(false)
  }

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDropdown(prev => !prev)
  }

  return (
    <div className="relative flex flex-row items-center justify-center w-screen min-h-screen overflow-hidden px-20">
      {/* Left text */}
      <div>
        <img src={penIcon} alt="pen" className="w-29.5 h-27.75 mb-7.5" />
        <h1 className="text-[3.3125rem] font-bold leading-[1.32] text-black m-0 mb-7.5 font-YaHei">
          爆文猫写作 陪你写出<span className="text-[#ff9500]">好故事</span>
        </h1>
        <p className="text-[1.5rem] text-[#464646] m-0 mb-21 leading-[1.32] font-YaHei">
          喂饭级AI辅助写作工具，即刻成立你的写作天团！
        </p>

        {/* CTA buttons */}
        <div className="relative flex w-165.75 flex-row">
          {/* Novice button + dropdown */}
          <div ref={dropdownContainerRef} className="relative flex flex-col">
            <button
              onClick={toggleDropdown}
              onMouseEnter={handleButtonEnter}
              onMouseLeave={handleButtonLeave}
              style={{ transition: 'width 0.3s ease, box-shadow 0.3s ease' }}
              className={cn(
                'flex h-22.25 flex-row items-center justify-center gap-1.5 rounded-[1.609375rem] border-none bg-linear-to-r from-[#efaf00] to-[#ff9500] cursor-pointer relative shrink-0',
                isButtonHovered || showDropdown ? 'w-69.5 shadow-[0px_4px_15px_0px_rgba(255,149,0,0.5)]' : 'w-61.5',
              )}
            >
              <img src={vectorIcon} alt="icon" className="size-11.5 shrink-0 object-contain" />
              <span className="text-2xl font-bold text-white font-YaHei leading-[1.2] whitespace-nowrap">
                我是小白写手
              </span>
              {isButtonHovered && (
                <svg
                  className={cn('w-4.25 h-1.75 shrink-0 transition-transform duration-300', showDropdown && 'rotate-180')}
                  viewBox="0 0 17 7"
                  fill="none"
                >
                  <path d="M1 1L8.5 6L16 1" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>

            {showDropdown && (
              <div
                onMouseEnter={handleMenuEnter}
                onMouseLeave={handleMenuLeave}
                onClick={e => e.stopPropagation()}
                className="absolute top-25.25 -right-13 z-1000 w-40.75 h-29.5 overflow-hidden rounded-[1.25rem] bg-[#f7f7f4] shadow-[0px_0px_10px_0px_rgba(0,0,0,0.25)]"
              >
                {/* Short story item */}
                <div
                  onClick={onShortStoryClick}
                  onMouseEnter={() => setHoveredItem('short')}
                  onMouseLeave={() => setHoveredItem(null)}
                  className="absolute left-3 top-4 w-16 h-22.25 cursor-pointer"
                >
                  <div
                    className={cn(
                      'absolute inset-0 rounded-[0.625rem] bg-[#f8f3df] transition-opacity duration-300',
                      hoveredItem === 'short' ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <img src={bookIcon} alt="短篇" className="absolute z-1 left-0.5 top-0 w-15.5 h-15.5 object-contain" />
                  <span className="absolute z-1 left-2.5 top-15.5 w-11 h-3.75 text-base font-normal text-[#464646] font-YaHei leading-[1.32] text-center whitespace-nowrap">
                    短篇
                  </span>
                </div>

                {/* Script item */}
                <div
                  onClick={onScriptClick}
                  onMouseEnter={() => setHoveredItem('script')}
                  onMouseLeave={() => setHoveredItem(null)}
                  className="absolute left-21.5 top-4 w-16 h-22.25 cursor-pointer"
                >
                  <div
                    className={cn(
                      'absolute inset-0 rounded-[0.625rem] bg-[#f8f3df] transition-opacity duration-300',
                      hoveredItem === 'script' ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <img src={scriptIcon} alt="剧本" className="absolute z-1 left-3.5 top-3 size-9 object-contain" />
                  <span className="absolute z-1 left-1.5 top-15.5 w-13.5 h-3.75 text-base font-normal text-[#464646] font-YaHei leading-[1.32] text-center whitespace-nowrap">
                    剧本
                  </span>
                </div>
              </div>
            )}
            <span className="mt-3 flex-1 text-center text-[1.25rem] text-[#656565] font-YaHei leading-[1.32]">
              零基础快捷写作
            </span>
          </div>

          {/* Divider */}
          <div className="w-10.5 h-22.25 my-0 mx-6.25">
            <img src={fenge} alt="divider" />
          </div>

          {/* Professional button */}
          <div className="relative flex flex-col">
            <button
              onClick={onProfessionalClick}
              disabled={isCreatingWork}
              onMouseEnter={() => !isCreatingWork && setIsProfessionalButtonHovered(true)}
              onMouseLeave={() => setIsProfessionalButtonHovered(false)}
              style={{ transition: 'width 0.3s ease, box-shadow 0.3s ease' }}
              className={cn(
                'flex h-22.25 flex-row items-center justify-center gap-1.5 rounded-[1.609375rem] border-none bg-linear-to-r from-[#efaf00] to-[#ff9500] relative shrink-0',
                isCreatingWork ? 'cursor-not-allowed opacity-80' : 'cursor-pointer',
                isProfessionalButtonHovered && !isCreatingWork ? 'w-69.5 shadow-[0px_4px_15px_0px_rgba(255,149,0,0.5)]' : 'w-61.5',
              )}
            >
              {isCreatingWork
                ? <div className="loading-spinner" />
                : <img src={groupIcon} alt="icon" className="size-11.5 shrink-0 object-contain" />
              }
              <span className="text-2xl font-bold text-white font-YaHei leading-[1.2] whitespace-nowrap">
                {isCreatingWork ? '请稍后...' : '我是专业写手'}
              </span>
            </button>
            <span className="mt-3 flex-1 text-center text-[1.25rem] text-[#656565] font-YaHei leading-[1.32]">
              深度掌控每个细节
            </span>
          </div>
        </div>
      </div>

      {/* Hero image */}
      <div className="relative flex ml-15.5 mt-5.75 items-center justify-center">
        <img
          src={greyBg}
          alt="background"
          className="absolute -top-12.5 right-15 z-0 h-auto w-full max-w-186 object-contain aspect-744/628"
        />
        <img
          src="https://vibe-writing-qa-public.tos-cn-beijing.volces.com/fe07ba9d-3/hero-image.webp"
          alt="Hero"
          className="relative z-1 h-auto w-full max-w-237.5 object-contain rounded-[0.625rem] shadow-[0_4px_4px_rgba(0,0,0,0.25)] aspect-95/49"
        />
      </div>
    </div>
  )
}
