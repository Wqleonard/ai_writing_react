import { useRef, useState } from 'react'
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
    <div style={{
      position: 'relative', display: 'flex', flexDirection: 'row',
      alignItems: 'center', justifyContent: 'center',
      padding: '0 80px', width: '100vw', minHeight: '100vh', overflow: 'hidden',
    }}>
      {/* Left text */}
      <div>
        <img src={penIcon} alt="pen" style={{ width: 118, height: 111, marginBottom: 30 }} />
        <h1 style={{
          fontSize: 53, fontWeight: 700, lineHeight: 1.32, color: '#000',
          margin: '0 0 30px', fontFamily: 'YaHei, sans-serif',
        }}>
          爆文猫写作 陪你写出<span style={{ color: '#ff9500' }}>好故事</span>
        </h1>
        <p style={{
          fontSize: 24, color: '#464646', margin: '0 0 84px',
          lineHeight: 1.32, fontFamily: 'YaHei, sans-serif',
        }}>
          喂饭级AI辅助写作工具，即刻成立你的写作天团！
        </p>

        {/* CTA buttons */}
        <div style={{ position: 'relative', display: 'flex', width: 663, flexDirection: 'row' }}>
          {/* Novice button + dropdown */}
          <div ref={dropdownContainerRef} style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <button
              onClick={toggleDropdown}
              onMouseEnter={handleButtonEnter}
              onMouseLeave={handleButtonLeave}
              style={{
                width: isButtonHovered || showDropdown ? 278 : 246,
                height: 89, display: 'flex', flexDirection: 'row',
                alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(90deg, #efaf00 0%, #ff9500 100%)',
                border: 'none', borderRadius: 25.75, cursor: 'pointer',
                transition: 'width 0.3s, box-shadow 0.3s', position: 'relative', gap: 6,
                boxShadow: isButtonHovered || showDropdown ? '0px 4px 15px 0px rgba(255,149,0,0.5)' : 'none',
              }}
            >
              <img src={vectorIcon} alt="icon" style={{ width: 46, height: 46, flexShrink: 0, objectFit: 'contain' }} />
              <span style={{ fontSize: 24, fontWeight: 700, color: 'white', fontFamily: 'YaHei, sans-serif', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                我是小白写手
              </span>
              {isButtonHovered && (
                <svg
                  style={{ width: 17, height: 7, flexShrink: 0, transition: 'transform 0.3s', transform: showDropdown ? 'rotate(180deg)' : 'none' }}
                  viewBox="0 0 17 7" fill="none"
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
                style={{
                  position: 'absolute', top: 101, right: -52,
                  width: 163, height: 118, background: '#f7f7f4',
                  borderRadius: 20, boxShadow: '0px 0px 10px 0px rgba(0,0,0,0.25)',
                  zIndex: 1000, overflow: 'hidden',
                }}
              >
                {/* Short story item */}
                <div
                  onClick={onShortStoryClick}
                  onMouseEnter={() => setHoveredItem('short')}
                  onMouseLeave={() => setHoveredItem(null)}
                  style={{ position: 'absolute', left: 12, top: 16, width: 64, height: 89, cursor: 'pointer' }}
                >
                  <div style={{
                    position: 'absolute', inset: 0, background: '#f8f3df', borderRadius: 10,
                    opacity: hoveredItem === 'short' ? 1 : 0, transition: 'opacity 0.3s',
                  }} />
                  <img src={bookIcon} alt="短篇" style={{ position: 'absolute', zIndex: 1, left: 2, top: 0, width: 62, height: 62, objectFit: 'contain' }} />
                  <span style={{ position: 'absolute', zIndex: 1, left: 10, top: 62, width: 44, height: 15, fontSize: 16, fontWeight: 400, color: '#464646', fontFamily: 'YaHei, sans-serif', lineHeight: 1.32, textAlign: 'center', whiteSpace: 'nowrap' }}>短篇</span>
                </div>

                {/* Script item */}
                <div
                  onClick={onScriptClick}
                  onMouseEnter={() => setHoveredItem('script')}
                  onMouseLeave={() => setHoveredItem(null)}
                  style={{ position: 'absolute', left: 86, top: 16, width: 64, height: 89, cursor: 'pointer' }}
                >
                  <div style={{
                    position: 'absolute', inset: 0, background: '#f8f3df', borderRadius: 10,
                    opacity: hoveredItem === 'script' ? 1 : 0, transition: 'opacity 0.3s',
                  }} />
                  <img src={scriptIcon} alt="剧本" style={{ position: 'absolute', zIndex: 1, left: 14, top: 12, width: 36, height: 36, objectFit: 'contain' }} />
                  <span style={{ position: 'absolute', zIndex: 1, left: 5, top: 62, width: 54, height: 15, fontSize: 16, fontWeight: 400, color: '#464646', fontFamily: 'YaHei, sans-serif', lineHeight: 1.32, textAlign: 'center', whiteSpace: 'nowrap' }}>剧本</span>
                </div>
              </div>
            )}
            <span style={{ fontSize: 20, color: '#656565', fontFamily: 'YaHei, sans-serif', lineHeight: 1.32, marginTop: 12, flex: 1, textAlign: 'center' }}>
              零基础快捷写作
            </span>
          </div>

          {/* Divider */}
          <div style={{ width: 42, height: 89, margin: '0 25px' }}>
            <img src={fenge} alt="divider" />
          </div>

          {/* Professional button */}
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <button
              onClick={onProfessionalClick}
              disabled={isCreatingWork}
              style={{
                width: 246, height: 89, display: 'flex', flexDirection: 'row',
                alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(90deg, #efaf00 0%, #ff9500 100%)',
                border: 'none', borderRadius: 25.75, cursor: isCreatingWork ? 'not-allowed' : 'pointer',
                opacity: isCreatingWork ? 0.8 : 1, gap: 6,
              }}
            >
              {isCreatingWork
                ? <div className="loading-spinner" />
                : <img src={groupIcon} alt="icon" style={{ width: 46, height: 46, flexShrink: 0, objectFit: 'contain' }} />
              }
              <span style={{ fontSize: 24, fontWeight: 700, color: 'white', fontFamily: 'YaHei, sans-serif', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                {isCreatingWork ? '请稍后...' : '我是专业写手'}
              </span>
            </button>
            <span style={{ fontSize: 20, color: '#656565', fontFamily: 'YaHei, sans-serif', lineHeight: 1.32, marginTop: 12, flex: 1, textAlign: 'center' }}>
              深度掌控每个细节
            </span>
          </div>
        </div>
      </div>

      {/* Hero image */}
      <div style={{ position: 'relative', display: 'flex', marginLeft: 62, marginTop: 23, alignItems: 'center', justifyContent: 'center' }}>
        <img
          src={greyBg}
          alt="background"
          style={{ position: 'absolute', width: '100%', maxWidth: 744, height: 'auto', aspectRatio: '744/628', zIndex: 0, top: -50, right: 60, objectFit: 'contain' }}
        />
        <img
          src="https://vibe-writing-qa-public.tos-cn-beijing.volces.com/fe07ba9d-3/hero-image.webp"
          alt="Hero"
          style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 950, height: 'auto', aspectRatio: '95/49', objectFit: 'contain', borderRadius: 10, boxShadow: '0 4px 4px rgba(0,0,0,0.25)' }}
        />
      </div>
    </div>
  )
}
