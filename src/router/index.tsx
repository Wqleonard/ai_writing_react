import { createBrowserRouter, Navigate, redirect, type RouteObject } from 'react-router-dom'
import { lazy } from 'react'

// 首屏关键组件保持同步导入
import LandingPage from '@/pages/landing'
import { WorkspaceLayout } from '@/layout'
import { AppRouteGuard } from '@/router/guards/AppRouteGuard'


// 懒加载页面组件
const MarkdownEditorPage = lazy(() => import('@/pages/editor'))
const TrendingListPage = lazy(() => import('@/pages/trending-list'))
const CoursePage = lazy(() => import('@/pages/creation-community/course'))
const CourseDetailsPage = lazy(() => import('@/pages/creation-community/course-details'))
const SharePage = lazy(() => import('@/pages/creation-community/share'))
const ShareDetailsPage = lazy(() => import('@/pages/creation-community/share-details'))
const ShareCreatePage = lazy(() => import('@/pages/creation-community/share-create'))
const PromptPage = lazy(() => import('@/pages/creation-community/prompt'))
const BookAnalysisPage = lazy(() => import('@/pages/ai-expert/book-analysis'))
const WritingStylesPage = lazy(() => import('@/pages/ai-expert/writing-styles'))
const MyPlacePage = lazy(() => import('@/pages/my-place'))
const QuickEditorVueHostPage = lazy(() => import('@/pages/quick-editor-vue-host'))
const ScriptEditorVueHostPage = lazy(() => import('@/pages/script-editor-vue-host'))
const UserServiceAgreementPage = lazy(() => import('@/pages/agreement/user-service-agreement'))
const PrivacyPolicyPage = lazy(() => import('@/pages/agreement/privacy-policy'))
const ChildrenPrivacyProtectionPolicyPage = lazy(() => import('@/pages/agreement/children-privacy-protection-policy'))
// const NotFoundPage = lazy(() => import('@/pages/not-found'))

// Mobile layouts
const MLayout = lazy(() => import('@/layout/MLayout/MLayout.tsx'))
const MWorkSpace = lazy(() => import('@/layout/MWorkSpace'))

// Mobile pages
const MLandingPage = lazy(() => import('@/m-pages/landing'))
const MChatPage = lazy(() => import("@/m-pages/workspace/chat"));
const MNotesPage = lazy(() => import("@/m-pages/workspace/notes"));
const MNotesDetailPage = lazy(() => import("@/m-pages/workspace/notes-detail"));
const MMinePage = lazy(() => import("@/m-pages/workspace/mine"));
const MRulesPage = lazy(() => import("@/m-pages/rules"));
const MFeedbackIssuePage = lazy(() => import("@/m-pages/feedback-issue"));
const MUserAgreementPage = lazy(() => import("@/m-pages/user-agreement"));
const MPrivacyPolicyPage = lazy(() => import("@/m-pages/privacy-policy"));

const editorAuthMiddleware = () => {
  const token = localStorage.getItem('token')
  if (!token) {
    throw redirect('/workspace/my-place')
  }
  return null
}

const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppRouteGuard />,
    children: [
      {
        index: true,
        element: <LandingPage/>,
      },
      {
        path: 'workspace',
        element: <WorkspaceLayout/>,
        children: [
          {
            index: true,
            element: <Navigate to="/workspace/my-place" replace />
          },
          {
            path: 'my-place',
            element: <MyPlacePage/>
          },
          {
            path: 'trending-list',
            element: <TrendingListPage/>
          },
          {
            path: 'creation-community/course',
            element: <CoursePage/>
          },
          {
            path: 'creation-community/course/details/:id',
            element: <CourseDetailsPage/>
          },
          {
            path: 'creation-community/share',
            element: <SharePage/>
          },
          {
            path: 'creation-community/share/details/:id',
            element: <ShareDetailsPage/>
          },
          {
            path: 'creation-community/share/create/:id',
            element: <ShareCreatePage/>
          },
          {
            path: 'creation-community/prompt',
            element: <PromptPage/>
          },
          {
            path: 'ai-expert/book-analysis',
            element: <BookAnalysisPage/>
          },
          {
            path: 'ai-expert/writing-styles',
            element: <WritingStylesPage/>
          },
        ],
      },
      {
        path: '/editor/:workId',
        element: <MarkdownEditorPage/>,
        loader: editorAuthMiddleware,
      },
      {
        path: '/quick-editor/:workId',
        element: <QuickEditorVueHostPage/>,
        loader: editorAuthMiddleware,
      },
      {
        path: '/script-editor/:workId',
        element: <ScriptEditorVueHostPage/>,
        loader: editorAuthMiddleware,
      },
      {
        path: '/m',
        element: <MLayout/>,
        children: [
          {
            index: true,
            element: <MLandingPage/>,
          },
          {
            path: 'workspace',
            element: <MWorkSpace/>,
            children: [
              {
                index: true,
                element: <MChatPage/>,
              },
              {
                path: 'chat',
                element: <MChatPage/>,
              },
              {
                path: 'notes',
                element: <MNotesPage/>,
              },
              {
                path: 'notes/detail',
                element: <MNotesDetailPage/>,
              },
              {
                path: 'mine',
                element: <MMinePage/>,
              },
            ],
          },
          {
            path: 'rules',
            element: <MRulesPage/>,
          },
          {
            path: 'feedback-issue',
            element: <MFeedbackIssuePage/>,
          },
          {
            path: 'user-agreement',
            element: <MUserAgreementPage/>,
          },
          {
            path: 'privacy-policy',
            element: <MPrivacyPolicyPage/>,
          },
        ],
      },
      {
        path: '/user-agreement',
        element: <UserServiceAgreementPage/>,
      },
      {
        path: '/privacy-policy',
        element: <PrivacyPolicyPage/>,
      },
      {
        path: '/children-privacy-protection-policy',
        element: <ChildrenPrivacyProtectionPolicyPage/>,
      },
      {
        path: '*',
        element: <Navigate to="/workspace/my-place" replace />,
      },
    ],
  },
]

export { routes }
export const router = createBrowserRouter(routes)
