import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import ReactFullpageLib from '@fullpage/react-fullpage'
import { createWorkReq } from '@/api/works'
import { LandingNavbar } from './components/LandingNavbar'
import { HeroSection } from './components/HeroSection'
import { WorkshopSection } from './components/WorkshopSection'
import { AdvantagesSection } from './components/AdvantagesSection'
import { ScenariosSection } from './components/ScenariosSection'
import { FaqSection } from './components/FaqSection'
import { CtaSection } from './components/CtaSection'
import arrowUp from '@/assets/images/arrow_up.svg'
import { useLoginStore } from '@/stores/loginStore'
import { openLoginDialog } from '@/components/LoginDialog'
import './landing.css'
import { trackEvent } from "@/matomo/trackingMatomoEvent.ts";
import { Spinner } from '@/components/ui/Spinner'

// CJS → ESM interop: Vite may wrap the default in an extra object layer for this webpack-bundled package
const ReactFullpage: typeof ReactFullpageLib =
  (ReactFullpageLib as any).default ?? ReactFullpageLib

export default function LandingPage() {
  const navigate = useNavigate()
  const [showScrollToTop, setShowScrollToTop] = useState(false)
  const [isCreatingWork, setIsCreatingWork] = useState(false)
  const fullpageApiRef = useRef<any>(null)

  const isLoggedIn = useLoginStore(state => state.isLoggedIn)
  const requireLogin = useLoginStore(state => state.requireLogin)

  const moveTo = useCallback((anchor: string) => {
    fullpageApiRef.current?.moveTo(anchor)
  }, [])

  const handleShowLogin = useCallback(async () => {
    try {
      await openLoginDialog()
    } catch {
      // 用户关闭登录弹窗时静默忽略
    }
  }, [])

  const addQuickWork = useCallback(async () => {
    if (isCreatingWork) return
    try {
      setIsCreatingWork(true)
      const req = await createWorkReq('doc')
      if (req?.id) {
        navigate(`/quick-editor/${req.id}`, { state: { showTake2: true } })
      }
    } catch {
      toast.error('创建作品失败，请稍后重试')
    } finally {
      setIsCreatingWork(false)
    }
  }, [isCreatingWork, navigate])
  
  const addScriptWork = useCallback(async () => {
    if (isCreatingWork) return
    try {
      setIsCreatingWork(true)
      const req = await createWorkReq("script")
      if (req?.id) {
        navigate(`/script-editor/${req.id}`, { state: { isNew: true } })
      }
    } catch {
      toast.error("创建作品失败，请稍后重试")
    } finally {
      setIsCreatingWork(false)
    }
  },[isCreatingWork, navigate])

  const addWorkEditor = useCallback(async () => {
    if (isCreatingWork) return
    try {
      setIsCreatingWork(true)
      const req = await createWorkReq('editor')
      if (req?.id) {
        navigate(`/editor/${req.id}`, { state: { showTake2: true } })
      }
    } catch {
      toast.error('创建作品失败，请稍后重试')
    } finally {
      setIsCreatingWork(false)
    }
  }, [isCreatingWork, navigate])

  const addShortPlayWorkEditor = useCallback(async () => {
    if (isCreatingWork) return
    try {
      setIsCreatingWork(true)
      const req = await createWorkReq('script_editor')
      if (req?.id) {
        navigate(`/editor/${req.id}`, { state: { editorBizType: "short-play" } })
      }
    } catch {
      toast.error('创建作品失败，请稍后重试')
    } finally {
      setIsCreatingWork(false)
    }
  }, [isCreatingWork, navigate])

  const handleQuickEditorClick = async () => {
    trackEvent('Story Creation', 'Click', 'Quick New from Landing')
    await requireLogin(addQuickWork)
  }

  const handleScriptEditorClick = async () => {
    trackEvent('Story Creation', 'Click', 'Script New from Landing')
    await requireLogin(addScriptWork)
  }

  const handleEditorClick = async () => {
    trackEvent('Story Creation', 'Click', "Common New from Landing")
    await requireLogin(addWorkEditor)
  }

  const handleProfessionalShortPlayClick = async () => {
    trackEvent('Story Creation', 'Click', 'Script New from Landing')
    await requireLogin(addShortPlayWorkEditor)
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#f7f7f4', overflow: 'hidden' }}>
      {/* {isCreatingWork && (
        <div className="landing-loading-overlay">
          <Spinner className="size-10 text-theme" />
        </div>
      )} */}

      <LandingNavbar
        isLoggedIn={isLoggedIn}
        onNavClick={moveTo}
        onShowLogin={handleShowLogin}
      />

      <ReactFullpage
        licenseKey="gplv3-license"
        credits={{ enabled: false }}
        scrollingSpeed={700}
        autoScrolling={true}
        fitToSection={true}
        fitToSectionDelay={600}
        scrollOverflow={true}
        scrollOverflowReset={false}
        keyboardScrolling={true}
        paddingTop="0px"
        paddingBottom="0px"
        navigation={false}
        easingcss3="ease"
        normalScrollElements=".dropdown-menu"
        anchors={['home', 'workshop', 'advantages', 'scenarios', 'faq', 'cta']}
        afterLoad={(_origin: any, destination: any) => {
          setShowScrollToTop(destination.index !== 0)
        }}
        render={({ fullpageApi }: any) => {
          if (fullpageApi) fullpageApiRef.current = fullpageApi
          return (
            <ReactFullpage.Wrapper>
              <div className="section" data-anchor="home">
                <HeroSection
                  isCreatingWork={isCreatingWork}
                  onShortStoryClick={handleQuickEditorClick}
                  onScriptClick={handleScriptEditorClick}
                  onProfessionalClick={handleEditorClick}
                  onProfessionalShortPlayClick={handleProfessionalShortPlayClick}
                />
              </div>

              <div className="section" data-anchor="workshop">
                <WorkshopSection />
              </div>

              <div className="section" data-anchor="advantages">
                <AdvantagesSection />
              </div>

              <div className="section" data-anchor="scenarios">
                <ScenariosSection />
              </div>

              <div className="section" data-anchor="faq">
                <FaqSection />
              </div>

              <div className="section" data-anchor="cta">
                <CtaSection />
              </div>
            </ReactFullpage.Wrapper>
          )
        }}
      />

      {showScrollToTop && (
        <button
          type="button"
          aria-label="回到顶部"
          onClick={() => fullpageApiRef.current?.moveTo('home')}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 100,
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(255,255,255,0.5)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'background 0.2s',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.75)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.5)')}
        >
          <img src={arrowUp} alt="" className="w-5.5 h-5.5" loading="lazy" />
        </button>
      )}
    </div>
  )
}
