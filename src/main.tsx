import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/router'
import { setRem } from '@/utils/rem'
import { Spinner } from "@/components/ui/Spinner";
import { Toaster } from "@/components/ui/Sonner";
import { initMatomo } from "@certible/use-matomo";
import { setMatomoTracker } from '@/matomo/trackingMatomoEvent'
import { useLoginStore } from '@/stores/loginStore'
import { initInvitationCode } from '@/utils/invitationCode'
import '@/stores/themeStore'
import './index.css'

// 初始化 rem 适配
setRem()

// matomo埋点接入
try {
  const mode = import.meta.env.MODE || "dev";
  const siteId = mode === "prd" ? "3" : "2";
  const tracker = initMatomo({
    host: "https://observer.baowenmao.com/",
    siteId: siteId,
  });
  setMatomoTracker(tracker)
} catch (error) {
  console.error("[Matomo] Initialization error:", error);
}

useLoginStore.getState().initUserInfo()
void initInvitationCode()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Spinner className="size-10 text-(--theme-color)"/>
        </div>}
    >
      <RouterProvider router={router}/>
      <Toaster position="top-center" richColors icons={{
        error: null
      }}/>
    </Suspense>
  </StrictMode>,
)
