import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { WorkspaceLayout } from '@/layout'
import { About } from '@/pages/About'
import { WorkspaceIndex } from '@/pages/Workspace/WorkspaceIndex'
import { WorkspaceProjects } from '@/pages/Workspace/WorkspaceProjects'
import DemoPage from '@/pages/Demo/index'
import InsCanvas from '@/components/InsCanvas/InsCanvas'

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
      { path: 'tiptap', element: <DemoPage /> },
      { path: 'ins-canvas', element: <InsCanvas  workId={'test'}
      onCreateHere={(files, chain) => {console.log(files, chain)}}
      onCreateNew={(files, chain) => {console.log(files, chain)}} /> },
    ],
  },
  {
    path: '/about',
    element: <About />,
  }
]

export const router = createBrowserRouter(routes)
