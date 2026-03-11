import { createBrowserRouter, Navigate, redirect, type RouteObject } from 'react-router-dom'
import { lazy } from 'react'

// 首屏关键组件保持同步导入
import LandingPage from '@/pages/landing'
import { WorkspaceLayout } from '@/layout'
import { AppRouteGuard } from '@/router/guards/AppRouteGuard'
import TestPage from '@/pages/test'


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
        handle: { title: '落地页' },
      },
      {
        path: 'workspace',
        element: <WorkspaceLayout/>,
        children: [
          {
            index: true,
            element: <Navigate to="/workspace/my-place" replace />,
            handle: { title: '我的空间' },
          },
          {
            path: 'my-place',
            element: <MyPlacePage/>,
            handle: { title: '我的空间' },
          },
          {
            path: 'trending-list',
            element: <TrendingListPage/>,
            handle: { title: '创作榜单' },
          },
          {
            path: 'creation-community/course',
            element: <CoursePage/>,
            handle: { title: '课程' },
          },
          {
            path: 'creation-community/course/details/:id',
            element: <CourseDetailsPage/>,
            handle: { title: '课程详情' },
          },
          {
            path: 'creation-community/share',
            element: <SharePage/>,
            handle: { title: '分享' },
          },
          {
            path: 'creation-community/share/details/:id',
            element: <ShareDetailsPage/>,
            handle: { title: '分享详情' },
          },
          {
            path: 'creation-community/share/create/:id',
            element: <ShareCreatePage/>
          },
          {
            path: 'creation-community/prompt',
            element: <PromptPage/>,
            handle: { title: '提示词' },
          },
          {
            path: 'ai-expert/book-analysis',
            element: <BookAnalysisPage/>,
            handle: { title: '拆书仿写' },
          },
          {
            path: 'ai-expert/writing-styles',
            element: <WritingStylesPage/>,
            handle: { title: '文风提炼' },
          },
        ],
      },
      {
        path: '/editor/:workId',
        element: <MarkdownEditorPage/>,
        loader: editorAuthMiddleware,
        handle: { title: '编辑器 / 通用创作短篇' },
      },
      {
        path: '/quick-editor/:workId',
        element: <QuickEditorVueHostPage/>,
        loader: editorAuthMiddleware,
        handle: { title: '编辑器 / 快捷创作短篇' },
      },
      {
        path: '/script-editor/:workId',
        element: <ScriptEditorVueHostPage/>,
        loader: editorAuthMiddleware,
        handle: { title: '编辑器 / 剧本创作短篇' },
      },
      {
        path: '/user-agreement',
        element: <UserServiceAgreementPage/>,
        handle: { title: '用户服务协议' },
      },
      {
        path: '/privacy-policy',
        element: <PrivacyPolicyPage/>,
        handle: { title: '隐私政策' },
      },
      {
        path: '/children-privacy-protection-policy',
        element: <ChildrenPrivacyProtectionPolicyPage/>,
        handle: { title: '儿童隐私保护政策' },
      },
      // {
      //   path: '/test',
      //   element: <TestPage/>,
      // },
      {
        path: '/m',
        element: <MLayout/>,
        handle: { title: '移动端' },
        children: [
          {
            index: true,
            element: <MLandingPage/>,
            handle: { title: '移动端落地页' },
          },
          {
            path: 'workspace',
            element: <MWorkSpace/>,
            handle: { title: '移动端工作空间' },
            children: [
              {
                index: true,
                element: <MChatPage/>,
                handle: { title: '移动端对话' },
              },
              {
                path: 'chat',
                element: <MChatPage/>,
                handle: { title: '移动端对话' },
              },
              {
                path: 'notes',
                element: <MNotesPage/>,
                handle: { title: '移动端笔记' },
              },
              {
                path: 'notes/detail',
                element: <MNotesDetailPage/>,
                handle: { title: '移动端笔记详情' },
              },
              {
                path: 'mine',
                element: <MMinePage/>,
                handle: { title: '移动端我的' },
              },
            ],
          },
          {
            path: 'rules',
            element: <MRulesPage/>,
            handle: { title: '移动端条款与规则' },
          },
          {
            path: 'feedback-issue',
            element: <MFeedbackIssuePage/>,
            handle: { title: '移动端反馈问题' },
          },
          {
            path: 'user-agreement',
            element: <MUserAgreementPage/>,
            handle: { title: '移动端用户服务协议' },
          },
          {
            path: 'privacy-policy',
            element: <MPrivacyPolicyPage/>,
            handle: { title: '移动端隐私政策' },
          },
        ],
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
