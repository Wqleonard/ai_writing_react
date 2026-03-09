import type { ReactNode } from 'react'

import EMPTY_IMAGE from '@/assets/images/empty.webp'
import { cn } from '@/lib/utils'

export interface EmptyProps {
  image?: ReactNode | string
  description?: ReactNode
  className?: string
  imageClassName?: string
}

export const Empty = ({ image = EMPTY_IMAGE, description, className, imageClassName }: EmptyProps) => {
  const imageNode =
    typeof image === 'string' ? (
      <img src={image} alt="empty" className={cn('w-25 h-auto object-contain',imageClassName)} />
    ) : (
      image
    )

  return (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      {imageNode}
      {description ? (
        <p className={cn('text-sm text-gray-500', imageNode && 'mt-2')}>{description}</p>
      ) : null}
    </div>
  )
}

export default Empty
