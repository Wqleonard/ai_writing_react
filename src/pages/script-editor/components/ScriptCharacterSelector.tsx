import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Iconfont } from '@/components/IconFont'
import MALE from '@/assets/images/quick_creation/character_man_sex.svg'
import confirmScSvg from '@/assets/images/quick_creation/confirm_sc.svg'
import { getScriptCharacterSettings } from '@/api/generate-quick'
import { ScriptCharacterCard, type ScriptCharacterCardData } from './ScriptCharacterCard'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ScriptStorySynopsisResult {
  title?: string
  synopsis?: string
  background?: string
  highlight?: string
  informationGap?: string
}

interface ScriptCharacterData extends ScriptCharacterCardData {
  isCustom?: boolean
}

export interface ScriptCharacterSelectorProps {
  selectedTagIds?: string
  novelPlot?: string
  description?: string
  storyContent?: string
  characterContent?: string
  locked?: boolean
  hasNextContent?: boolean
  triggerGenerate?: number
  onConfirm?: (characterData: string) => void
  onRevertToCurrent?: () => void
  onErrorAndRevert?: (targetDir: string) => void
}

const EMPTY_SCRIPT_CHARACTER: ScriptCharacterData = {
  name: '',
  definition: '',
  age: '',
  personality: '',
  biography: '',
}

const DEFINITION_OPTIONS = ['男主', '女主', '男配', '女配']
const MAX_NAME_LENGTH = 5
const MAX_EXPERIENCE_LENGTH = 300
const MAX_PERSONALITY_LENGTH = 50
const CONFIRM_STAMP_ANIMATION_MS = 800
const EDIT_PANEL_TOTAL_GAP = 48

export const ScriptCharacterSelector = ({
  novelPlot = '',
  description = '',
  storyContent = '',
  characterContent = '',
  locked = false,
  hasNextContent = false,
  triggerGenerate = 0,
  onConfirm,
  onRevertToCurrent,
  onErrorAndRevert,
}: ScriptCharacterSelectorProps) => {
  const [characters, setCharacters] = useState<ScriptCharacterData[]>([])
  const [loading, setLoading] = useState(false)

  const [showEditPanel, setShowEditPanel] = useState(false)
  const [isCustomMode, setIsCustomMode] = useState(false)
  const [customCharacter, setCustomCharacter] = useState<ScriptCharacterData>({ ...EMPTY_SCRIPT_CHARACTER })
  const [editingCharacterIndex, setEditingCharacterIndex] = useState<number | null>(null)
  const [editPanelViewOnly, setEditPanelViewOnly] = useState(true)
  const [initialEditSnapshot, setInitialEditSnapshot] = useState('')

  const [confirmStampPlaying, setConfirmStampPlaying] = useState(false)
  const [confirmStampKey, setConfirmStampKey] = useState(0)

  const [scriptCardRowHeightPx, setScriptCardRowHeightPx] = useState('340px')
  const [editPanelCardRowHeightPx, setEditPanelCardRowHeightPx] = useState('200px')
  const [isAnimating, setIsAnimating] = useState(false)
  const [editPanelStyle, setEditPanelStyle] = useState<React.CSSProperties>({})

  const characterGridRef = useRef<HTMLDivElement | null>(null)
  const characterScrollWrapRef = useRef<HTMLDivElement | null>(null)
  const editPanelCardListRef = useRef<HTMLDivElement | null>(null)
  const triggerGenerateRef = useRef(triggerGenerate)

  const { confirm, confirmDialog } = useConfirmDialog()

  const canGoNext = useMemo(
    () => characters.some((c) => c.name && c.name.trim() !== ''),
    [characters]
  )

  const displayCharacters = useMemo(() => {
    const withName = characters.filter((char) => char.name && char.name.trim())
    return locked ? withName : [...withName, null]
  }, [characters, locked])

  const isEditDirty = useMemo(
    () => initialEditSnapshot !== '' && JSON.stringify(customCharacter) !== initialEditSnapshot,
    [customCharacter, initialEditSnapshot]
  )

  const closeEditPanel = useCallback(() => {
    setShowEditPanel(false)
    setCustomCharacter({ ...EMPTY_SCRIPT_CHARACTER })
    setEditingCharacterIndex(null)
    setIsCustomMode(false)
    setIsAnimating(false)
    setInitialEditSnapshot('')
  }, [])

  const updateScriptCardRowHeight = useCallback(() => {
    const el = characterScrollWrapRef.current
    if (!el) return
    const rowHeight = Math.max(220, (el.clientHeight - 57) / 2)
    setScriptCardRowHeightPx(`${Math.round(rowHeight)}px`)
  }, [])

  const updateEditPanelCardRowHeight = useCallback(() => {
    const el = editPanelCardListRef.current
    if (!el || !showEditPanel) return
    const rowHeight = Math.max(100, (el.clientHeight - EDIT_PANEL_TOTAL_GAP) / 3)
    setEditPanelCardRowHeightPx(`${Math.round(rowHeight)}px`)
  }, [showEditPanel])

  const initFromProps = useCallback(() => {
    if (!characterContent) return
    try {
      const data = JSON.parse(characterContent)
      if (Array.isArray(data.generatedCards) && data.generatedCards.length > 0) {
        const cards = data.generatedCards.map((c: Record<string, unknown>) => ({
          name: String(c.name ?? ''),
          definition: String(c.definition ?? ''),
          age: String(c.age ?? ''),
          personality: String(c.personality ?? ''),
          biography: String(c.biography ?? ''),
          isCustom: !!c.isCustom,
        }))
        setCharacters(cards)
      } else if (data.name) {
        setCharacters([{
          name: String(data.name ?? ''),
          definition: String(data.definition ?? data.identity ?? ''),
          age: String(data.age ?? ''),
          personality: String(data.personality ?? data.mbti ?? ''),
          biography: String(data.biography ?? data.experiences ?? ''),
        }])
      }
    } catch (e) {
      console.error('[ScriptCharacterSelector] Failed to parse characterContent:', e)
    }
  }, [characterContent])

  useEffect(() => {
    initFromProps()
  }, [initFromProps])

  useEffect(() => {
    const oldVal = triggerGenerateRef.current
    if (triggerGenerate > oldVal && triggerGenerate > 0) {
      if (storyContent.trim() && !locked) {
        setCharacters([])
        setTimeout(() => {
          void generateCharacters()
        }, 100)
      }
    }
    triggerGenerateRef.current = triggerGenerate
  }, [triggerGenerate, storyContent, locked])

  useEffect(() => {
    const el = characterScrollWrapRef.current
    if (!el) return
    updateScriptCardRowHeight()
    const observer = new ResizeObserver(() => updateScriptCardRowHeight())
    observer.observe(el)
    return () => observer.disconnect()
  }, [updateScriptCardRowHeight])

  useEffect(() => {
    const el = editPanelCardListRef.current
    if (!showEditPanel || !el) return
    updateEditPanelCardRowHeight()
    const observer = new ResizeObserver(() => updateEditPanelCardRowHeight())
    observer.observe(el)
    return () => observer.disconnect()
  }, [showEditPanel, updateEditPanelCardRowHeight])

  const animateFromCard = async (cardElement: HTMLElement) => {
    const container = characterGridRef.current
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    const cardRect = cardElement.getBoundingClientRect()
    setEditPanelStyle({
      left: `${cardRect.left - containerRect.left}px`,
      top: `${cardRect.top - containerRect.top}px`,
      width: `${cardRect.width}px`,
      height: `${cardRect.height}px`,
      transformOrigin: 'top left',
    })
    setIsAnimating(true)
    setShowEditPanel(true)
    setEditPanelViewOnly(true)

    requestAnimationFrame(() => {
      setTimeout(() => {
        setEditPanelStyle({
          left: '0px',
          top: '0px',
          width: '100%',
          height: '100%',
          transformOrigin: 'top left',
        })
      }, 50)
      setTimeout(() => setIsAnimating(false), 650)
    })
  }

  const generateCharacters = async () => {
    if (loading) return
    if (!storyContent.trim()) {
      toast.warning('请先完成故事梗概')
      return
    }

    setLoading(true)
    setCharacters([])
    try {
      let res: { roleCards?: Array<Record<string, unknown>> }
      const storyDataWrapper = JSON.parse(storyContent || '{}')
      const selectedTab = storyDataWrapper.selectedTab
      const selectedData = storyDataWrapper.selectedData || {}

      if (selectedTab === 'original') {
        res = await getScriptCharacterSettings(novelPlot || '', undefined, undefined)
      } else {
        const brainStorm: ScriptStorySynopsisResult = {
          title: selectedData.title,
          synopsis: selectedData.synopsis,
          background: selectedData.background,
          highlight: selectedData.highlight,
          informationGap: selectedData.informationGap,
        }
        res = await getScriptCharacterSettings('', description || '', brainStorm)
      }

      const list = Array.isArray(res?.roleCards) ? res.roleCards : []
      setCharacters(
        list.map((item) => ({
          name: String(item.name ?? ''),
          definition: String(item.definition ?? ''),
          age: String(item.age ?? ''),
          personality: String(item.personality ?? ''),
          biography: String(item.biography ?? ''),
        }))
      )
    } catch (e) {
      console.error('[ScriptCharacterSelector] 获取角色失败:', e)
      setCharacters([])
      onErrorAndRevert?.('故事梗概.md')
    } finally {
      setLoading(false)
    }
  }

  const saveCurrentCharacterWithoutClose = () => {
    const name = customCharacter.name?.trim() ?? ''
    if (!name) {
      toast.warning('请至少填写角色名字')
      return false
    }
    const currentIndex = editingCharacterIndex
    const lowerName = name.toLowerCase()
    const nameExists = (item: ScriptCharacterData) => item.name?.trim().toLowerCase() === lowerName

    if (currentIndex !== null) {
      const duplicateIdx = characters.findIndex((c, i) => i !== currentIndex && nameExists(c))
      if (duplicateIdx !== -1) {
        toast.warning('该角色名已存在')
        return false
      }
    } else if (characters.some(nameExists)) {
      toast.warning('该角色名已存在')
      return false
    }

    const updated = { ...customCharacter }
    if (currentIndex !== null) {
      if (characters[currentIndex]?.isCustom) updated.isCustom = true
      const next = [...characters]
      next[currentIndex] = updated
      setCharacters(next)
    } else {
      updated.isCustom = true
      const sameNameIndex = characters.findIndex((c) => c.name?.trim() === name && c.isCustom)
      if (sameNameIndex !== -1) {
        const next = [...characters]
        next[sameNameIndex] = updated
        setCharacters(next)
        setEditingCharacterIndex(sameNameIndex)
        setIsCustomMode(false)
      } else {
        const next = [...characters, updated]
        const newIndex = next.length - 1
        setCharacters(next)
        setEditingCharacterIndex(newIndex)
        setIsCustomMode(false)
      }
    }
    setInitialEditSnapshot(JSON.stringify(updated))
    return true
  }

  const handleShowCustomDialog = async (event?: React.MouseEvent) => {
    if (locked || loading) return
    setCustomCharacter({ ...EMPTY_SCRIPT_CHARACTER })
    setEditingCharacterIndex(null)
    setIsCustomMode(true)
    const target = event?.currentTarget as HTMLElement | null
    if (target) await animateFromCard(target)
    else setShowEditPanel(true)
    setEditPanelViewOnly(false)
    setInitialEditSnapshot(JSON.stringify(EMPTY_SCRIPT_CHARACTER))
  }

  const handleEditCharacter = async (
    character: ScriptCharacterData,
    index: number,
    event?: React.MouseEvent
  ) => {
    setCustomCharacter({ ...character })
    setEditingCharacterIndex(index)
    setIsCustomMode(false)
    const target = ((event?.currentTarget as HTMLElement | undefined)?.closest(
      '.character-card-wrapper'
    ) ?? null) as HTMLElement | null
    if (target) await animateFromCard(target)
    else setShowEditPanel(true)
    setEditPanelViewOnly(true)
    setInitialEditSnapshot(JSON.stringify(character))
  }

  const handleDeleteCharacter = async (character: ScriptCharacterData, index: number) => {
    const ok = await confirm({
      title: '删除角色',
      message: `确定删除角色「${character.name || ''}」吗？删除后不可恢复。`,
      confirmText: '确定删除',
      cancelText: '取消',
      confirmVariant: 'destructive',
    })
    if (!ok) return

    setCharacters((prev) => {
      const idx = prev.findIndex((c) => c === character)
      if (idx === -1) return prev
      const next = [...prev]
      next.splice(idx, 1)

      if (showEditPanel && editingCharacterIndex === index) {
        const withName = next.filter((c) => c.name && c.name.trim())
        if (withName.length === 0) {
          setCustomCharacter({ ...EMPTY_SCRIPT_CHARACTER })
          setEditingCharacterIndex(null)
          setIsCustomMode(true)
          setEditPanelViewOnly(false)
        } else {
          const nextIndex = Math.min(index, withName.length - 1)
          setEditingCharacterIndex(nextIndex)
          setCustomCharacter({ ...withName[nextIndex] })
          setIsCustomMode(false)
          setEditPanelViewOnly(true)
        }
        setInitialEditSnapshot(JSON.stringify(customCharacter))
      } else if (showEditPanel && editingCharacterIndex !== null && editingCharacterIndex > index) {
        setEditingCharacterIndex((v) => (v === null ? null : v - 1))
      }
      return next
    })
  }

  const handleSwitchCharacterInEdit = async (character: ScriptCharacterData | null, index: number) => {
    const isCurrent = character ? editingCharacterIndex === index : isCustomMode
    if (isCurrent) return

    if (isEditDirty) {
      const save = await confirm({
        title: '编辑的内容还未保存',
        message: '您已对内容进行修改，直接退出将会删除修改内容。',
        confirmText: '保存',
        cancelText: '直接退出',
      })
      if (save) {
        if (!saveCurrentCharacterWithoutClose()) return
      }
    }

    if (character === null) {
      setCustomCharacter({ ...EMPTY_SCRIPT_CHARACTER })
      setEditingCharacterIndex(null)
      setIsCustomMode(true)
      setEditPanelViewOnly(false)
      setInitialEditSnapshot(JSON.stringify(EMPTY_SCRIPT_CHARACTER))
      return
    }

    setCustomCharacter({ ...character })
    setEditingCharacterIndex(index)
    setIsCustomMode(false)
    setEditPanelViewOnly(true)
    setInitialEditSnapshot(JSON.stringify(character))
  }

  const handleReturnFromEdit = async () => {
    if (!isEditDirty) {
      closeEditPanel()
      return
    }
    const save = await confirm({
      title: '编辑的内容还未保存',
      message: '您已对内容进行修改，直接退出将会删除修改内容。',
      confirmText: '保存',
      cancelText: '直接退出',
    })
    if (save) {
      if (!saveCurrentCharacterWithoutClose()) return
    }
    closeEditPanel()
  }

  const handleCancelEdit = async () => {
    if (!isEditDirty) {
      setEditPanelViewOnly(true)
      return
    }
    const save = await confirm({
      title: '编辑的内容还未保存',
      message: '您已对内容进行修改，直接退出将会删除修改内容。',
      confirmText: '保存',
      cancelText: '直接退出',
    })
    if (save) {
      if (!saveCurrentCharacterWithoutClose()) return
    } else {
      try {
        setCustomCharacter(JSON.parse(initialEditSnapshot || '{}'))
      } catch {
        setCustomCharacter({ ...EMPTY_SCRIPT_CHARACTER })
      }
    }
    setEditPanelViewOnly(true)
  }

  const handleConfirm = () => {
    const generatedCards = characters.filter((c) => c.name && c.name.trim() !== '')
    if (generatedCards.length === 0) {
      toast.warning('请先生成或添加角色')
      return
    }
    const characterData = JSON.stringify({ generatedCards })
    if (confirmStampPlaying) return
    setConfirmStampKey((k) => k + 1)
    setConfirmStampPlaying(true)
    setTimeout(() => {
      onConfirm?.(characterData)
      setTimeout(() => setConfirmStampPlaying(false), 500)
    }, CONFIRM_STAMP_ANIMATION_MS)
  }

  return (
    <div className="flex h-full max-h-full flex-col overflow-hidden box-border pr-[260px] py-[50px]">
      <div className={cn('relative flex min-h-0 flex-1 flex-col overflow-hidden', showEditPanel && 'edit-mode')}>
        <div className="mb-10 flex shrink-0 items-center justify-between">
          <div className="text-2xl leading-[1.32] text-black">请确认角色设定</div>
          {!locked && !showEditPanel ? (
            <Button
              variant="link"
              className="px-0 text-sm text-[#9a9a9a] hover:text-(--theme-color)"
              disabled={loading}
              onClick={() => void generateCharacters()}
            >
              <Iconfont unicode="&#xe66f;" className="mr-1 text-xl" />
              <span>重新生成</span>
            </Button>
          ) : null}
        </div>

        <div className="relative flex flex-1 overflow-hidden">
          <div ref={characterGridRef} className="relative flex min-h-0 flex-1 flex-col p-[5px_2px_2px_2px]">
            <div
              ref={characterScrollWrapRef}
              className={cn('flex-1 overflow-x-hidden px-[5px]', showEditPanel ? 'overflow-hidden' : 'overflow-y-auto')}
              style={{ ['--script-card-row-height' as string]: scriptCardRowHeightPx }}
            >
              <div className={cn('mt-[5px] mb-8 grid grid-cols-5 gap-x-4 gap-y-5', showEditPanel && 'pointer-events-none opacity-30')} style={{ gridAutoRows: 'var(--script-card-row-height)' }}>
                {loading ? Array.from({ length: 10 }).map((_, i) => (
                  <div key={`skeleton-${i}`} className="character-card-wrapper min-h-0" style={{ height: 'var(--script-card-row-height)' }}>
                    <ScriptCharacterCard loading />
                  </div>
                )) : displayCharacters.map((character, index) => (
                  <div
                    key={character ? `${character.name}-${index}` : `custom-${index}`}
                    className="character-card-wrapper min-h-0"
                    style={{ height: 'var(--script-card-row-height)' }}
                  >
                    {character ? (
                      <ScriptCharacterCard
                        data={character}
                        showDelete={!locked && !!character.name}
                        showEdit={!locked && !!character.name && !showEditPanel}
                        onClick={(e) => void handleEditCharacter(character, index, e)}
                        onEdit={(e) => void handleEditCharacter(character, index, e)}
                        onDelete={() => void handleDeleteCharacter(character, index)}
                      />
                    ) : (
                      <ScriptCharacterCard isCustom onClick={(e) => void handleShowCustomDialog(e)} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {showEditPanel ? (
            <div
              className={cn('absolute inset-0 z-50 flex overflow-hidden rounded-[10px] bg-white transition-all duration-500', isAnimating && 'duration-500')}
              style={editPanelStyle}
            >
              <div className="flex h-full min-h-0 w-full p-2">
                <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-auto rounded-[8px] border-2 border-[#ff9500] bg-[#fff8e5] px-[50px] pt-[30px] pb-5">
                  <div className="sticky top-0 z-10 ml-auto mt-[-20px] translate-x-[25px] translate-y-[-25px] flex items-center gap-4">
                    {!locked && editPanelViewOnly ? (
                      <Button variant="quick-ghost" className="text-sm text-[#999999]" onClick={() => setEditPanelViewOnly(false)}>
                        编辑
                      </Button>
                    ) : null}
                    <Button variant="quick-ghost" className="text-sm text-[#999999]" onClick={() => void handleReturnFromEdit()}>
                      返回
                    </Button>
                  </div>

                  <div className="pointer-events-none absolute right-0 bottom-0 z-0 h-[365px] w-[346px]">
                    <img src={MALE} alt="" className="size-full object-contain" />
                  </div>

                  {editPanelViewOnly ? (
                    <div className="relative z-10 flex flex-col gap-[22px]">
                      {[
                        ['姓名：', customCharacter.name || '—'],
                        ['定位：', customCharacter.definition || '—'],
                        ['年龄：', customCharacter.age || '—'],
                        ['人物标签：', customCharacter.personality || '—'],
                        ['人物小传：', customCharacter.biography || '—'],
                      ].map(([label, value], idx) => (
                        <div key={label} className="flex items-start gap-[50px]">
                          <label className="w-[124px] shrink-0 pt-[15px] text-2xl leading-[1.32] text-[#464646]">{label}</label>
                          <div className={cn('min-h-[58px] flex-1 rounded-[10px] bg-[rgba(255,245,205,0.5)] px-8 py-[13px] text-2xl leading-[1.32] text-[#464646]', idx === 4 && 'min-h-[150px] whitespace-pre-wrap py-[15px] leading-[1.5]')}>
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="relative z-10 flex flex-col gap-[22px]">
                      <div className="flex items-start gap-[50px]">
                        <label className="w-[124px] shrink-0 pt-[15px] text-2xl text-[#464646]">姓名：</label>
                        <div className="w-[min(327px,100%)] max-w-[327px] min-w-0">
                          <Input
                            value={customCharacter.name ?? ''}
                            onChange={(e) => setCustomCharacter((p) => ({ ...p, name: e.target.value }))}
                            maxLength={MAX_NAME_LENGTH}
                            className="h-[58px] rounded-[10px] border-0 bg-[rgba(255,245,205,0.5)] px-8 text-2xl"
                          />
                          <div className="mt-1 text-right text-xs text-[#9a9a9a]">{(customCharacter.name || '').length}/{MAX_NAME_LENGTH}</div>
                        </div>
                      </div>

                      <div className="flex items-start gap-[50px]">
                        <label className="w-[124px] shrink-0 pt-[15px] text-2xl text-[#464646]">定位：</label>
                        <div className="w-[min(327px,100%)] max-w-[327px] min-w-0">
                          <Select
                            value={customCharacter.definition || undefined}
                            onValueChange={(value) => setCustomCharacter((p) => ({ ...p, definition: value }))}
                          >
                            <SelectTrigger className="h-[58px] w-full rounded-[10px] border-0 bg-[rgba(255,245,205,0.5)] px-8 text-2xl">
                              <SelectValue placeholder="请选择" />
                            </SelectTrigger>
                            <SelectContent>
                              {DEFINITION_OPTIONS.map((opt) => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex items-start gap-[50px]">
                        <label className="w-[124px] shrink-0 pt-[15px] text-2xl text-[#464646]">年龄：</label>
                        <div className="w-[min(327px,100%)] max-w-[327px] min-w-0">
                          <Input
                            value={customCharacter.age ?? ''}
                            onChange={(e) => setCustomCharacter((p) => ({ ...p, age: e.target.value }))}
                            maxLength={20}
                            className="h-[58px] rounded-[10px] border-0 bg-[rgba(255,245,205,0.5)] px-8 text-2xl"
                            placeholder="如：19岁"
                          />
                        </div>
                      </div>

                      <div className="flex items-start gap-[50px]">
                        <label className="w-[124px] shrink-0 pt-[15px] text-2xl text-[#464646]">人物标签：</label>
                        <div className="min-w-0 flex-1">
                          <Input
                            value={customCharacter.personality ?? ''}
                            onChange={(e) => setCustomCharacter((p) => ({ ...p, personality: e.target.value }))}
                            maxLength={MAX_PERSONALITY_LENGTH}
                            className="h-[58px] rounded-[10px] border-0 bg-[rgba(255,245,205,0.5)] px-8 text-2xl"
                            placeholder="如：ISFP、内敛（按、分割）"
                          />
                          <div className="mt-1 text-right text-xs text-[#9a9a9a]">{(customCharacter.personality || '').length}/{MAX_PERSONALITY_LENGTH}</div>
                        </div>
                      </div>

                      <div className="flex items-start gap-[50px]">
                        <label className="w-[124px] shrink-0 pt-[15px] text-2xl text-[#464646]">人物小传：</label>
                        <div className="min-w-0 flex-1">
                          <Textarea
                            value={customCharacter.biography ?? ''}
                            onChange={(e) => setCustomCharacter((p) => ({ ...p, biography: e.target.value }))}
                            maxLength={MAX_EXPERIENCE_LENGTH}
                            className="h-[160px] rounded-[10px] border-0 bg-[rgba(255,245,205,0.5)] px-8 py-4"
                            areaClassName="text-2xl leading-[1.5]"
                            placeholder="填写角色的背景，过往经历、重要事件等"
                          />
                          <div className="mt-1 text-right text-xs text-[#9a9a9a]">{(customCharacter.biography || '').length}/{MAX_EXPERIENCE_LENGTH}</div>
                        </div>
                      </div>

                      <div className="relative z-10 mt-4 mb-4 flex min-h-[52px] shrink-0 justify-center gap-[25px]">
                        <Button variant="quick-revert" size="quick-revert-size" className="w-[131px] text-2xl text-[#464646]" onClick={() => void handleCancelEdit()}>
                          取消
                        </Button>
                        <Button variant="quick-primary" size="quick-confirm" className="w-[129px] text-2xl" onClick={() => { if (!saveCurrentCharacterWithoutClose()) return; setEditPanelViewOnly(true) }}>
                          确定
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div
                  ref={editPanelCardListRef}
                  className="h-full w-[380px] shrink-0 overflow-y-auto overflow-x-hidden rounded-[8px] border-l border-black/6 bg-white p-[12px_16px_12px_12px]"
                  style={{ ['--edit-card-row-height' as string]: editPanelCardRowHeightPx }}
                >
                  <div className="grid grid-cols-2 gap-3" style={{ gridAutoRows: 'var(--edit-card-row-height, 200px)' }}>
                    {displayCharacters.map((item, idx) => (
                      <div
                        key={item ? `${item.name}-${idx}` : `custom-${idx}`}
                        className={cn('min-h-0', (item ? editingCharacterIndex === idx : isCustomMode) && '[&_.quick-character-card]:shadow-[0_0_0_2px_var(--theme-color)]')}
                        style={{ height: 'var(--edit-card-row-height, 200px)' }}
                      >
                        {item ? (
                          <ScriptCharacterCard
                            data={item}
                            showEdit={false}
                            showDelete={!locked && !!item.name}
                            compactTags
                            isSelected={editingCharacterIndex === idx}
                            onClick={() => void handleSwitchCharacterInEdit(item, idx)}
                            onDelete={() => void handleDeleteCharacter(item, idx)}
                          />
                        ) : (
                          <ScriptCharacterCard isCustom onClick={() => void handleSwitchCharacterInEdit(null, idx)} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {(locked || confirmStampPlaying) ? (
            <div className="pointer-events-none absolute right-[120px] bottom-[100px] z-10 overflow-visible">
              {confirmStampPlaying ? (
                <img
                  key={`stamp-${confirmStampKey}`}
                  src={confirmScSvg}
                  alt=""
                  className="block h-auto w-[240px] animate-[stamp-drop_0.6s_cubic-bezier(0.22,1,0.36,1)_forwards]"
                />
              ) : locked ? (
                <img
                  src={confirmScSvg}
                  alt=""
                  className="block h-auto w-[240px]"
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {!showEditPanel && !locked ? (
        <div className="flex shrink-0 items-center justify-end">
          <Button
            variant="quick-primary"
            size="quick-confirm"
            disabled={!canGoNext || confirmStampPlaying}
            onClick={handleConfirm}
          >
            下一步
          </Button>
        </div>
      ) : null}

      {hasNextContent ? (
        <div className="mt-4 flex shrink-0 justify-end">
          <Button variant="quick-revert" size="quick-revert-size" onClick={() => onRevertToCurrent?.()}>
            回退至选择角色
          </Button>
        </div>
      ) : null}

      <style>{`
        @keyframes stamp-drop {
          0% { transform: translateY(-140%) scale(1.5); opacity: 0.9; }
          75% { transform: translateY(2%) scale(1.02); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
      {confirmDialog}
    </div>
  )
}
