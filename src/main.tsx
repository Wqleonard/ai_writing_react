import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/router'
import '@/stores/themeStore'
import { Spinner } from "@/components/ui/Spinner.tsx";
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense
      fallback={
      <div className="flex items-center justify-center min-h-screen">
       <Spinner className="size-10"/>
      </div>}
    >
      <RouterProvider router={router} />
    </Suspense>
  </StrictMode>,
)
