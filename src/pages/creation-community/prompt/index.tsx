import { useEffect, useState } from 'react'
import { PromptsArea } from './components/PromptsArea'
import { PAGE_TYPE_OPTIONS } from './types'
import { useOptionsStore } from '@/stores/optionsStore'
import clsx from 'clsx'

type PageType = 'public' | 'my' | 'favorite'

const PromptPage = () => {
  const [pageType, setPageType] = useState<PageType>('public')
  const updateCategories = useOptionsStore((s) => s.updateCategories)

  useEffect(() => {
    updateCategories()
  }, [])

  return (
    <div className="page-community-prompt flex h-full w-full flex-col px-2">
      <div className="page-community-prompt-top w-265 mx-auto">
        <div className="text-2xl font-medium">提示词</div>
        <div className="radio-group-type mt-4 flex">
          {PAGE_TYPE_OPTIONS.map((opt) => (
            <div
              key={String(opt.value)}
              className={clsx(
                'text-base mr-3 cursor-pointer px-0.5',
                pageType === opt.value ? 'text-theme' : '',
              )}
              onClick={() => setPageType(opt.value as PageType)}
            >
              {opt.label}
            </div>
          ))}
        </div>
      </div>

      {pageType === 'public' && (
        <PromptsArea
          type="public"
          emptyLabel="暂无提示词"
          className="prompts-area h-[calc(100%-80px)]"
        />
      )}
      {pageType === 'my' && (
        <PromptsArea
          type="my"
          emptyLabel="暂无提示词"
          showStatus
          className="prompts-area h-[calc(100%-80px)]"
        />
      )}
      {pageType === 'favorite' && (
        <PromptsArea
          type="favorite"
          emptyLabel="暂无收藏的提示词"
          className="prompts-area h-[calc(100%-80px)]"
        />
      )}
    </div>
  )
}

export default PromptPage
