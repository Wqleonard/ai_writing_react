import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'

/** 满足 openDialog 的组件需具备的 props */
export interface DialogComponentProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const UNMOUNT_DELAY_MS = 300

/**
 * 命令式打开一个 Dialog：创建挂载容器、渲染组件，关闭时在动画结束后销毁容器。
 * @param DialogComponent 必须接受 props: open, onOpenChange
 * @param componentProps 传给 DialogComponent 的其它 props（不含 open / onOpenChange）
 */
export function openDialog<P extends DialogComponentProps>(
  DialogComponent: React.ComponentType<P>,
  componentProps?: Omit<P, 'open' | 'onOpenChange'>
): void {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  const destroy = () => {
    root.unmount()
    if (document.body.contains(container)) {
      document.body.removeChild(container)
    }
  }

  const Wrapper = () => {
    const [open, setOpen] = useState(true)

    const handleOpenChange = (next: boolean) => {
      setOpen(next)
      if (!next) {
        setTimeout(destroy, UNMOUNT_DELAY_MS)
      }
    }

    return (
      <DialogComponent
        {...(componentProps as P)}
        open={open}
        onOpenChange={handleOpenChange}
      />
    )
  }

  root.render(<Wrapper />)
}
