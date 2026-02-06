import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { WorkspaceLayout } from '@/layout'
import { About } from '@/pages/About'
import { WorkspaceIndex } from '@/pages/Workspace/WorkspaceIndex'
import { WorkspaceProjects } from '@/pages/Workspace/WorkspaceProjects'
import { WorkspaceTiptap } from '@/pages/Workspace/tiptap'

const routes: RouteObject[] = [
  {
    path: '/',
    element: <div>Landing Page</div>,
  },
  {
    path: 'workspace',
    element: <WorkspaceLayout />,
    children: [
      { index: true, element: <WorkspaceIndex /> },
      { path: 'projects', element: <WorkspaceProjects /> },
      { path: 'tiptap', element: <WorkspaceTiptap /> },
    ],
  },
  {
    path: '/about',
    element: <About />,
  }
]

export const router = createBrowserRouter(routes)
