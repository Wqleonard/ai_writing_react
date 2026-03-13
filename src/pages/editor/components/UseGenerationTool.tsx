import type { PromptItem } from '@/components/Community/types'
import { useEditorStore } from '@/stores/editorStore'
import {
  Suspense,
  forwardRef,
  lazy,
  useCallback,
  useImperativeHandle,
  useState,
} from 'react'

const IntroductionGenerateDialog = lazy(() =>
  import('@/components/Community/IntroductionGenerateDialog').then((module) => ({
    default: module.IntroductionGenerateDialog,
  }))
)
const CharacterGenerateDialog = lazy(() =>
  import('@/components/Community/CharacterGenerateDialog').then((module) => ({
    default: module.CharacterGenerateDialog,
  }))
)
const WorldGenerateDialog = lazy(() =>
  import('@/components/Community/WorldGenerateDialog').then((module) => ({
    default: module.WorldGenerateDialog,
  }))
)
const OutlineGenerateDialog = lazy(() =>
  import('@/components/Community/OutlineGenerateDialog').then((module) => ({
    default: module.OutlineGenerateDialog,
  }))
)
const ChapterGenerateDialog = lazy(() =>
  import('@/components/Community/ChapterGenerateDialog').then((module) => ({
    default: module.ChapterGenerateDialog,
  }))
)
const PublicGenerateDialog = lazy(() =>
  import('@/components/Community/PublicGenerateDialog').then((module) => ({
    default: module.PublicGenerateDialog,
  }))
)
const PromptsMarketDialog = lazy(() =>
  import('@/components/Community/PromptsMarketDialog').then((module) => ({
    default: module.PromptsMarketDialog,
  }))
)

export interface UseGenerationToolRef {
  handleUse: (prompt: PromptItem) => void
  openMarket: (prompt?: PromptItem | null) => void
}

export const UseGenerationTool = forwardRef<UseGenerationToolRef>(function UseGenerationTool(_, ref) {
  const [introductionDialogOpen, setIntroductionDialogOpen] = useState(false)
  const [characterDialogOpen, setCharacterDialogOpen] = useState(false)
  const [worldDialogOpen, setWorldDialogOpen] = useState(false)
  const [outlineDialogOpen, setOutlineDialogOpen] = useState(false)
  const [chapterDialogOpen, setChapterDialogOpen] = useState(false)
  const [publicDialogOpen, setPublicDialogOpen] = useState(false)
  const [promptsMarketDialogOpen, setPromptsMarketDialogOpen] = useState(false)

  const [selectedPrompt, setSelectedPrompt] = useState<PromptItem | null>(null)
  const [publicPromptData, setPublicPromptData] = useState<PromptItem | null>(null)
  const [selectedCategory, setSelectedCategory] = useState('')

  const workId = useEditorStore((state) => state.workId)
  const initEditorData = useEditorStore((state) => state.initEditorData)

  const closeAllDialogs = useCallback(() => {
    setIntroductionDialogOpen(false)
    setCharacterDialogOpen(false)
    setWorldDialogOpen(false)
    setOutlineDialogOpen(false)
    setChapterDialogOpen(false)
    setPublicDialogOpen(false)
    setPromptsMarketDialogOpen(false)
  }, [])

  const handleSave = useCallback((saveId: string) => {
    if (saveId === workId) {
      initEditorData(saveId)
    }
  }, [initEditorData, workId])

  const handleOpenMarket = useCallback((prompt?: PromptItem | null) => {
    const nextPrompt = prompt ?? selectedPrompt
    if (prompt) setSelectedPrompt(prompt)

    setPromptsMarketDialogOpen(true)
    if (nextPrompt?.categories?.[0]?.id != null) {
      setSelectedCategory(String(nextPrompt.categories[0].id))
    }
  }, [selectedPrompt])

  const handleUse = useCallback((prompt: PromptItem | null) => {
    if (!prompt) {
      return
    }
    const isOfficial = prompt.isOfficial
    const categoryId = prompt?.categories?.[0]?.id
    setPublicPromptData(prompt)
    closeAllDialogs()

    setSelectedPrompt(prompt)
    if (isOfficial) {
      switch (categoryId) {
        case 1:
          setIntroductionDialogOpen(true)
          break
        case 2:
          setOutlineDialogOpen(true)
          break
        case 3:
          setCharacterDialogOpen(true)
          break
        case 4:
          setWorldDialogOpen(true)
          break
        case 5:
          setChapterDialogOpen(true)
          break
        default:
          setIntroductionDialogOpen(true)
          break
      }
      return
    }
    setPublicDialogOpen(true)
  }, [closeAllDialogs])

  useImperativeHandle(ref, () => ({
    handleUse: (prompt) => handleUse(prompt),
    openMarket: (prompt) => handleOpenMarket(prompt),
  }), [handleOpenMarket, handleUse])

  return (
    <Suspense fallback={null}>
      <IntroductionGenerateDialog
        open={introductionDialogOpen}
        onOpenChange={setIntroductionDialogOpen}
        promptData={selectedPrompt}
        onOpenMarket={handleOpenMarket}
        onSave={handleSave}
      />
      <CharacterGenerateDialog
        open={characterDialogOpen}
        onOpenChange={setCharacterDialogOpen}
        promptData={selectedPrompt}
        onOpenMarket={handleOpenMarket}
        onSave={handleSave}
      />
      <WorldGenerateDialog
        open={worldDialogOpen}
        onOpenChange={setWorldDialogOpen}
        promptData={selectedPrompt}
        onOpenMarket={handleOpenMarket}
        onSave={handleSave}
      />
      <OutlineGenerateDialog
        open={outlineDialogOpen}
        onOpenChange={setOutlineDialogOpen}
        promptData={selectedPrompt}
        onOpenMarket={handleOpenMarket}
        onSave={handleSave}
      />
      <ChapterGenerateDialog
        open={chapterDialogOpen}
        onOpenChange={setChapterDialogOpen}
        promptData={selectedPrompt}
        onOpenMarket={handleOpenMarket}
        onSave={handleSave}
      />
      <PublicGenerateDialog
        open={publicDialogOpen}
        onOpenChange={setPublicDialogOpen}
        data={publicPromptData}
        onOpenMarket={handleOpenMarket}
        onSave={handleSave}
      />
      <PromptsMarketDialog
        open={promptsMarketDialogOpen}
        onClose={() => setPromptsMarketDialogOpen(false)}
        selectedCategory={selectedCategory}
        onSelectedCategoryChange={setSelectedCategory}
        onUse={handleUse}
      />
    </Suspense>
  )
})