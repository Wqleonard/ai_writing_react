import LOGO from '@/assets/images/my-place/sidebar_logo.png'

interface LandingNavbarProps {
  isLoggedIn: boolean
  onNavClick: (anchor: string) => void
  onShowLogin: () => void
}

export function LandingNavbar({ isLoggedIn, onNavClick, onShowLogin }: LandingNavbarProps) {
  return (
    <nav
      style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        background: '#f7f7f4', padding: '20px 86.92px', zIndex: 9999,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
          <div style={{ width: 28, height: 28, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={LOGO} alt="爆文猫写作" style={{ width: 40, height: 40, maxWidth: 40, maxHeight: 40 }} />
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#80807d', marginLeft: 10 }}>爆文猫写作</span>
          <span style={{
            marginLeft: 8, padding: '0 7px', fontSize: 11, lineHeight: '20px',
            fontWeight: 500, color: '#fff', background: '#9ca3af', borderRadius: 999,
          }}>内测版</span>
        </div>

        {/* Nav links */}
        <div style={{ display: 'flex', gap: 67 }}>
          {[
            { label: '功能', anchor: 'workshop' },
            { label: '优势', anchor: 'advantages' },
            { label: '适用场景', anchor: 'scenarios' },
            { label: '常见问题', anchor: 'faq' },
          ].map(({ label, anchor }) => (
            <a
              key={anchor}
              onClick={(e) => { e.preventDefault(); onNavClick(anchor) }}
              href="#"
              style={{
                color: '#464646', fontSize: 16, textDecoration: 'none',
                fontWeight: 400, transition: 'color 0.3s', lineHeight: '21px', cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#efaf00')}
              onMouseLeave={e => (e.currentTarget.style.color = '#464646')}
            >
              {label}
            </a>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
          <a
            href="/workspace/my-place"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 33, height: 33, transition: 'opacity 0.3s' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <svg width="33" height="33" viewBox="0 0 33 33" fill="none">
              <path
                d="M13.75 27.5V19.25H19.25V27.5M5.5 12.375L16.5 3.4375L27.5 12.375V26.125C27.5 26.6223 27.3025 27.0992 26.9508 27.4508C26.5992 27.8025 26.1223 28 25.625 28H7.375C6.87772 28 6.40081 27.8025 6.04917 27.4508C5.69754 27.0992 5.5 26.6223 5.5 26.125V12.375Z"
                stroke="#666666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
          </a>
          {!isLoggedIn && (
            <button
              onClick={onShowLogin}
              style={{
                background: 'linear-gradient(90deg, #efaf00 0%, #ff9500 100%)',
                color: 'white', border: 'none', padding: 0,
                width: 102, height: 27, borderRadius: 10, fontSize: 16,
                cursor: 'pointer', transition: 'transform 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              注册/登录
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}
