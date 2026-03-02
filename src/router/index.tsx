import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { WorkspaceLayout } from '@/layout'
import MarkdownEditorPage from '@/pages/editor'
import TrendingListPage from '@/pages/trending-list'
import CoursePage from '@/pages/creation-community/course'
import CourseDetailsPage from '@/pages/creation-community/course-details'
import SharePage from '@/pages/creation-community/share'
import ShareDetailsPage from '@/pages/creation-community/share-details'
import ShareCreatePage from '@/pages/creation-community/share-create'
import PromptPage from '@/pages/creation-community/prompt'
import BookAnalysisPage from '@/pages/ai-expert/book-analysis'
import WritingStylesPage from '@/pages/ai-expert/writing-styles'
import MyPlacePage from '@/pages/my-place'

import LandingPage from '@/pages/landing'

// Mobile layouts
import MLayout from '@/layout/MLayout/MLayout.tsx'
import MWorkSpace from '@/layout/MWorkSpace'

// Mobile pages
import MLandingPage from '@/pages/m-landing'
import MChatPage from '@/pages/m-workspace/chat'
import MNotesPage from '@/pages/m-workspace/notes'
import MNotesDetailPage from '@/pages/m-workspace/notes-detail'
import MMinePage from '@/pages/m-workspace/mine'
import MRulesPage from '@/pages/m-rules'
import MFeedbackIssuePage from '@/pages/m-feedback-issue'
import MUserAgreementPage from '@/pages/m-user-agreement'
import MPrivacyPolicyPage from '@/pages/m-privacy-policy'

const routes: RouteObject[] = [
  {
    path: '/',
    element: <LandingPage/>,
  },
  {
    path: 'workspace',
    element: <WorkspaceLayout/>,
    children: [
      {
        index: true,
        element: <MyPlacePage/>
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
        path: 'm-landing',
        element: <MLandingPage/>,
      },
      {
        path: 'm-workspace',
        element: <MWorkSpace/>,
        children: [
          {
            index: true,
            element: <MChatPage/>,
          },
          {
            path: 'm-workspace-chat',
            element: <MChatPage/>,
          },
          {
            path: 'm-workspace-notes',
            element: <MNotesPage/>,
          },
          {
            path: 'm-workspace-notes-detail',
            element: <MNotesDetailPage/>,
          },
          {
            path: 'm-workspace-mine',
            element: <MMinePage/>,
          },
        ],
      },
      {
        path: 'm-rules',
        element: <MRulesPage/>,
      },
      {
        path: 'm-feedback-issue',
        element: <MFeedbackIssuePage/>,
      },
      {
        path: 'm-user-agreement',
        element: <MUserAgreementPage/>,
      },
      {
        path: 'm-privacy-policy',
        element: <MPrivacyPolicyPage/>,
      },
    ],
  },
]

export { routes }
export const router = createBrowserRouter(routes)
