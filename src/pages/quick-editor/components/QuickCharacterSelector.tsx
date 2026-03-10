import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getQuickCharacterSettings } from "@/api/generate-quick";
import QuickCharacterCard, { type QuickCharacterCardData } from "./QuickCharacterCard";
import { useEditorStore } from "@/stores/editorStore";
import { LinkButton } from "@/components/ui/LinkButton";
import IconFont from "@/components/IconFont/Iconfont";
import Iconfont from "@/components/IconFont/Iconfont";

interface CharacterCardData extends QuickCharacterCardData {
  isCustom?: boolean;
}

type Props = {
  selectedTagIds?: string;
  storyContent?: string;
  characterContent?: string;
  locked?: boolean;
  hasNextContent?: boolean;
  triggerGenerate?: number;
  onConfirm: (characterData: string) => void;
  onRevert: () => void;
  onRevertToCurrent: () => void;
  onErrorAndRevert: (targetDir: string) => void;
};

const EMPTY_CHARACTER: CharacterCardData = {
  name: "",
  gender: "",
  age: "",
  bloodType: "",
  mbti: "",
  experiences: "",
  personality: "",
  abilities: "",
  identity: "",
};

const EMPTY_CHARACTERS: CharacterCardData[] = [
  { ...EMPTY_CHARACTER },
  { ...EMPTY_CHARACTER },
  { ...EMPTY_CHARACTER },
];

const MAX_NAME_LENGTH = 5;
const MAX_EXPERIENCE_LENGTH = 300;
const MAX_ABILITIES_LENGTH = 100;
const MAX_IDENTITY_LENGTH = 50;

const QuickCharacterSelector = ({
  selectedTagIds = "",
  storyContent = "",
  characterContent = "",
  locked = false,
  hasNextContent = false,
  triggerGenerate = 0,
  onConfirm,
  onRevert,
  onRevertToCurrent,
  onErrorAndRevert,
}: Props) => {
  const [characters, setCharacters] = useState<CharacterCardData[]>([...EMPTY_CHARACTERS]);
  const [selectedCharacterIndex, setSelectedCharacterIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const [showEditPanel, setShowEditPanel] = useState(false);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customCharacter, setCustomCharacter] = useState<CharacterCardData>({ ...EMPTY_CHARACTER });
  const [editingCharacterIndex, setEditingCharacterIndex] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [editPanelStyle, setEditPanelStyle] = useState<React.CSSProperties>({
    left: "0px",
    top: "0px",
    width: "0px",
    height: "0px",
    transformOrigin: "top left",
  });
  const characterGridRef = useRef<HTMLDivElement | null>(null);
  const prevTriggerRef = useRef(0);
  const latestTriggerParamsRef = useRef({
    selectedTagIds,
    storyContent,
    locked,
  });
  const workInfo = useEditorStore((s) => s.workInfo);

  useEffect(() => {
    latestTriggerParamsRef.current = {
      selectedTagIds,
      storyContent,
      locked,
    };
  }, [selectedTagIds, storyContent, locked]);

  const hasSelectedCharacter = selectedCharacterIndex !== null && !!characters[selectedCharacterIndex]?.name;
  const displayCharacters = useMemo(() => (locked ? characters.filter((char) => char.name) : [...characters, null] as Array<CharacterCardData | null>), [characters, locked]);

  const animateFromCard = useCallback(async (cardElement: HTMLElement) => {
    if (!characterGridRef.current) return;
    const containerRect = characterGridRef.current.getBoundingClientRect();
    const cardRect = cardElement.getBoundingClientRect();
    setEditPanelStyle({
      left: `${cardRect.left - containerRect.left}px`,
      top: `${cardRect.top - containerRect.top}px`,
      width: `${cardRect.width}px`,
      height: `${cardRect.height}px`,
      transformOrigin: "top left",
    });
    setIsAnimating(true);
    setShowEditPanel(true);
    setTimeout(() => {
      setEditPanelStyle({
        left: "0px",
        top: "0px",
        width: "100%",
        bottom: "40px",
        transformOrigin: "top left",
      });
      setTimeout(() => setIsAnimating(false), 650);
    }, 50);
  }, []);

  const generateCharacters = useCallback(async () => {
    if (loading) return;
    if (!selectedTagIds) {
      toast.warning("请先完成前面的步骤");
      return;
    }
    setLoading(true);
    setCharacters([...EMPTY_CHARACTERS]);
    setSelectedCharacterIndex(null);
    try {
      const description = (workInfo?.workTags ?? []).map((tag) => tag.name).join(",");
      const storyDataWrapper = JSON.parse(storyContent || "{}");
      const storyData = storyDataWrapper.selectedData || storyDataWrapper;
      const brainStorm = {
        title: storyData.title || "",
        intro: storyData.intro || "",
      };
      const res: any = await getQuickCharacterSettings("1", description, "doc", brainStorm);
      const characterList = Array.isArray(res?.roleCards) ? res.roleCards : [];
      const next = [...EMPTY_CHARACTERS];
      for (let i = 0; i < 3; i++) {
        if (i >= characterList.length) continue;
        const item = characterList[i];
        next[i] = {
          name: item.name || "",
          gender: item.gender || "",
          age: item.age || "",
          bloodType: item.bloodType || "",
          mbti: item.mbti || "",
          experiences: item.experiences || "",
          personality: item.personality || "",
          abilities: item.abilities || "",
          identity: item.identity || "",
        };
      }
      setCharacters(next);
    } catch (error) {
      console.error("[QuickCharacterSelector] 获取角色失败:", error);
      setCharacters([...EMPTY_CHARACTERS]);
      onErrorAndRevert("故事梗概.md");
    } finally {
      setLoading(false);
    }
  }, [loading, onErrorAndRevert, selectedTagIds, storyContent, workInfo]);

  const handleSelectCharacter = useCallback(
    (character: CharacterCardData | null, index: number) => {
      if (loading || !character?.name || locked) return;
      setSelectedCharacterIndex(index);
    },
    [loading, locked],
  );

  const handleShowCustomDialog = useCallback(
    async (event: React.MouseEvent) => {
      if (locked || loading) return;
      setCustomCharacter({ ...EMPTY_CHARACTER, gender: "男" });
      setEditingCharacterIndex(null);
      setIsCustomMode(true);
      const target = event.currentTarget as HTMLElement;
      await animateFromCard(target);
    },
    [animateFromCard, loading, locked],
  );

  const handleEditCharacter = useCallback(
    async (character: CharacterCardData, index: number, event: React.MouseEvent) => {
      if (locked) return;
      setCustomCharacter({ ...character });
      setEditingCharacterIndex(index);
      setIsCustomMode(false);
      const target = (event.currentTarget as HTMLElement).closest(".character-card-wrapper") as HTMLElement | null;
      if (target) await animateFromCard(target);
    },
    [animateFromCard, locked],
  );

  const closeEditPanel = useCallback(() => {
    setShowEditPanel(false);
    setCustomCharacter({ ...EMPTY_CHARACTER });
    setEditingCharacterIndex(null);
    setIsCustomMode(false);
    setIsAnimating(false);
  }, []);

  const handleSaveCustomCharacter = useCallback(() => {
    const name = customCharacter.name.trim();
    if (!name) {
      toast.warning("请至少填写角色名字");
      return;
    }
    setCharacters((prev) => {
      const next = [...prev];
      if (editingCharacterIndex !== null) {
        const updated = { ...customCharacter };
        if (next[editingCharacterIndex]?.isCustom) updated.isCustom = true;
        next[editingCharacterIndex] = updated;
        setSelectedCharacterIndex(editingCharacterIndex);
      } else {
        const newCharacter: CharacterCardData = { ...customCharacter, isCustom: true };
        const sameNameIndex = next.findIndex((c) => c.name && c.name.trim() === name && c.isCustom);
        if (sameNameIndex !== -1) {
          next[sameNameIndex] = newCharacter;
          setSelectedCharacterIndex(sameNameIndex);
        } else {
          const insertIndex = Math.max(0, next.length);
          next.splice(insertIndex, 0, newCharacter);
          setSelectedCharacterIndex(insertIndex);
        }
      }
      return next;
    });
    closeEditPanel();
  }, [closeEditPanel, customCharacter, editingCharacterIndex]);

  const handleConfirm = useCallback(() => {
    if (selectedCharacterIndex === null) {
      toast.warning("请先选择一个角色");
      return;
    }
    const selectedCharacter = characters[selectedCharacterIndex];
    const generatedCards = characters.filter((c) => c.name && c.name.trim() !== "");
    const fullData = {
      selectedData: selectedCharacter,
      generatedCards: generatedCards.length > 0 ? generatedCards : undefined,
    };
    onConfirm(JSON.stringify(fullData));
  }, [characters, onConfirm, selectedCharacterIndex]);

  const initFromProps = useCallback(() => {
    if (!characterContent) return;
    try {
      const data = JSON.parse(characterContent);
      if (data.selectedData && data.generatedCards) {
        const cards = data.generatedCards as CharacterCardData[];
        setCharacters(cards);
        const selectedIndex = cards.findIndex(
          (c) => c.name === data.selectedData.name && c.mbti === data.selectedData.mbti,
        );
        setSelectedCharacterIndex(selectedIndex !== -1 ? selectedIndex : 0);
      } else {
        setCharacters([data]);
        setSelectedCharacterIndex(0);
      }
    } catch (error) {
      console.error("[QuickCharacterSelector] Failed to parse characterContent:", error);
    }
  }, [characterContent]);

  useEffect(() => {
    if (!characterContent) {
      setCharacters([...EMPTY_CHARACTERS]);
      setSelectedCharacterIndex(null);
      return;
    }
    initFromProps();
  }, [characterContent, initFromProps]);

  useEffect(() => {
    if (triggerGenerate > prevTriggerRef.current && triggerGenerate > 0) {
      setTimeout(() => {
        const latest = latestTriggerParamsRef.current;
        if (!latest.storyContent?.trim() || !latest.selectedTagIds || latest.locked) return;
        setCharacters([...EMPTY_CHARACTERS]);
        setSelectedCharacterIndex(null);
        void generateCharacters();
      }, 100);
    }
    prevTriggerRef.current = triggerGenerate;
  }, [generateCharacters, triggerGenerate]);

  return (
    <div className="flex h-full max-h-full flex-col overflow-hidden pt-[50px] pr-[120px] pb-[50px]">
      <div className={`relative flex min-h-0 flex-1 flex-col overflow-hidden ${showEditPanel ? "edit-mode" : ""}`}>
        <div className="mb-5 shrink-0 text-2xl px-4 font-normal text-black">请选择心仪的男/女主角设定</div>

        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <div
            ref={characterGridRef}
            className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pt-[5px] pr-[2px] pb-[2px] pl-[2px] [scrollbar-width:thin] [scrollbar-color:rgba(0,0,0,0.1)_transparent] [&::-webkit-scrollbar]:w-[2px] [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-[rgba(0,0,0,0.1)]"
          >
            <div className={`relative mb-8 flex shrink-0 flex-row flex-wrap gap-7 p-4 justify-between ${showEditPanel ? "pointer-events-none opacity-30" : ""}`}>
              {displayCharacters.map((character, index) => {
                const key = character ? `${character.name}-${character.mbti}-${index}` : `custom-${index}`;
                const selected = !!character?.name && selectedCharacterIndex === index;
                return (
                  <div
                    key={key}
                    className={`character-card-wrapper rounded-[10px] flex h-[380px] min-h-[380px] max-h-[380px] basis-[calc(25%-30px)] flex-row ${
                      character ? "max-w-[calc(25%-30px)]" : "custom-wrapper max-w-[calc(25%-30px)]"
                    } ${selected ? "outline-2 outline-(--theme-color)" : ""}`}
                  >
                    {character ? (
                      <QuickCharacterCard
                        data={character}
                        showEdit={!locked && !!character.name && !showEditPanel}
                        loading={loading}
                        isSelected={selectedCharacterIndex === index}
                        onClick={() => handleSelectCharacter(character, index)}
                        onEdit={(e) => void handleEditCharacter(character, index, e)}
                      />
                    ) : (
                      <QuickCharacterCard
                        isCustom
                        loading={loading}
                        onClick={(e) => {
                          if (!e) return;
                          void handleShowCustomDialog(e);
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {!locked && !showEditPanel && (
              <div className="flex h-8 shrink-0 items-center justify-center">
                <LinkButton
                  disabled={loading}
                  className="flex items-center gap-3 text-2xl leading-[1.32em] font-normal text-[#999]"
                  onClick={() => void generateCharacters()}
                >
                  <Iconfont unicode="&#xe66f;" className="mr-[10px] inline-block text-[30px]"/>
                  <span>换一批</span>
                </LinkButton>
              </div>
            )}
          </div>

          {showEditPanel && (
            <div
              className={`absolute z-100 flex flex-col overflow-hidden rounded-[10px] border-2 border-[#ff9500] bg-[#fff8e5] transition-all duration-600 ${isAnimating ? "" : ""}`}
              style={editPanelStyle}
            >
              <div className="relative flex h-full flex-col overflow-y-auto px-[50px] pt-[30px] pb-[clamp(30px,5vh,50px)]">
                <div className="pointer-events-none absolute right-0 bottom-0 z-0 h-[365px] w-[346px] opacity-10">
                  <div className="flex h-full w-full items-end justify-center text-[220px]">
                    {customCharacter.gender === "女" ? "♀" : "♂"}
                  </div>
                </div>
                <div className="relative z-1 flex min-h-min flex-[0_0_auto] flex-col gap-[22px] overflow-visible">
                  <div className="mb-5 text-center text-[30px] leading-[1.32em] tracking-[0.04em] text-[#464646]">
                    {isCustomMode ? "自定义角色" : "编辑角色"}
                  </div>

                  <div className="flex items-start gap-[50px]">
                    <label className="w-[124px] shrink-0 pt-[15px] text-2xl leading-[1.32em] tracking-[0.04em] whitespace-nowrap text-[#464646]">姓名：</label>
                    <div className="relative w-[327px]">
                      <input
                        value={customCharacter.name}
                        maxLength={MAX_NAME_LENGTH}
                        placeholder="请填入"
                        className="h-[58.77px] w-full rounded-[10px] bg-[rgba(255,245,205,0.5)] px-8 pr-[100px] text-2xl text-[#464646] outline-none placeholder:text-[#999]"
                        onChange={(e) => setCustomCharacter((prev) => ({ ...prev, name: e.target.value }))}
                      />
                      <span className="pointer-events-none absolute top-4 right-4 text-2xl text-[#9a9a9a]">
                        {(customCharacter.name || "").length}/{MAX_NAME_LENGTH}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-[50px]">
                    <label className="w-[124px] shrink-0 pt-[15px] text-2xl leading-[1.32em] tracking-[0.04em] whitespace-nowrap text-[#464646]">性别：</label>
                    <div className="w-[327px]">
                      <select
                        value={customCharacter.gender}
                        className="h-[58.77px] w-full rounded-[10px] bg-[rgba(255,245,205,0.5)] px-8 text-2xl text-[#464646] outline-none"
                        onChange={(e) => setCustomCharacter((prev) => ({ ...prev, gender: e.target.value }))}
                      >
                        <option value="">请选择</option>
                        <option value="男">男</option>
                        <option value="女">女</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-start gap-[50px]">
                    <label className="w-[124px] shrink-0 pt-[15px] text-2xl leading-[1.32em] tracking-[0.04em] whitespace-nowrap text-[#464646]">人物标签：</label>
                    <div className="relative min-w-0 flex-1">
                      <input
                        value={customCharacter.abilities}
                        maxLength={MAX_ABILITIES_LENGTH}
                        placeholder="填写角色的特殊能力、金手指等（按、分割）"
                        className="h-[58.77px] w-full rounded-[10px] bg-[rgba(255,245,205,0.5)] px-8 pr-[100px] text-2xl text-[#464646] outline-none placeholder:text-[#999]"
                        onChange={(e) => setCustomCharacter((prev) => ({ ...prev, abilities: e.target.value }))}
                      />
                      <span className="pointer-events-none absolute top-4 right-4 text-2xl text-[#9a9a9a]">
                        {(customCharacter.abilities || "").length}/{MAX_ABILITIES_LENGTH}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-[50px]">
                    <label className="w-[124px] shrink-0 pt-[15px] text-2xl leading-[1.32em] tracking-[0.04em] whitespace-nowrap text-[#464646]">人物身份：</label>
                    <div className="relative min-w-0 flex-1">
                      <input
                        value={customCharacter.identity}
                        maxLength={MAX_IDENTITY_LENGTH}
                        placeholder="如：重生农神、地下牧师（按、分割）"
                        className="h-[58.77px] w-full rounded-[10px] bg-[rgba(255,245,205,0.5)] px-8 pr-[100px] text-2xl text-[#464646] outline-none placeholder:text-[#999]"
                        onChange={(e) => setCustomCharacter((prev) => ({ ...prev, identity: e.target.value }))}
                      />
                      <span className="pointer-events-none absolute top-4 right-4 text-2xl text-[#9a9a9a]">
                        {(customCharacter.identity || "").length}/{MAX_IDENTITY_LENGTH}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-[50px]">
                    <label className="w-[124px] shrink-0 pt-[15px] text-2xl leading-[1.32em] tracking-[0.04em] whitespace-nowrap text-[#464646]">人物小传：</label>
                    <div className="relative min-w-0 flex-1">
                      <textarea
                        value={customCharacter.experiences}
                        maxLength={MAX_EXPERIENCE_LENGTH}
                        placeholder="填写角色的背景，过往经历、重要事件等"
                        className="h-[170px] min-h-[150px] max-h-[200px] w-full resize-none rounded-[10px] bg-[rgba(255,245,205,0.5)] px-8 py-[15px] pr-[100px] text-2xl leading-[1.5em] text-[#464646] outline-none placeholder:text-[#999]"
                        onChange={(e) =>
                          setCustomCharacter((prev) => ({ ...prev, experiences: e.target.value }))
                        }
                      />
                      <span className="pointer-events-none absolute right-4 bottom-4 text-2xl text-[#9a9a9a]">
                        {(customCharacter.experiences || "").length}/{MAX_EXPERIENCE_LENGTH}
                      </span>
                    </div>
                  </div>

                  <div className="relative z-10 mt-[clamp(20px,3vh,40px)] mb-5 flex min-h-[52px] shrink-0 justify-center gap-[25px]">
                    <button
                      type="button"
                      className="h-[52px] w-[130.91px] rounded-[10px] border-2 border-[#9a9a9a] bg-transparent text-2xl text-[#464646] hover:border-(--bg-editor-save) hover:text-(--bg-editor-save)"
                      onClick={closeEditPanel}
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      className="h-[52px] w-[129px] rounded-[10px] bg-linear-to-r from-[#efaf00] to-[#ff9500] text-2xl font-bold text-white hover:opacity-90"
                      onClick={handleSaveCustomCharacter}
                    >
                      确定
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {!showEditPanel && (
        <div className="flex shrink-0 items-center justify-end">
          {!locked && (
            <button
              type="button"
              disabled={!hasSelectedCharacter}
              className="h-[52px] w-[221px] rounded-[10px] bg-linear-to-r from-[#efaf00] to-[#ff9500] text-[28px] leading-[1.32em] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 hover:opacity-90"
              onClick={handleConfirm}
            >
              下一步
            </button>
          )}
        </div>
      )}

      {hasNextContent && (
        <div className="flex shrink-0 justify-end">
          <button
            type="button"
            className="h-[52px] w-[261px] rounded-[10px] border-2 border-[#999] bg-transparent px-0 py-[7px] text-[28px] leading-[1.32em] font-normal text-[#999] transition hover:border-(--bg-editor-save) hover:text-(--bg-editor-save)"
            onClick={onRevertToCurrent}
          >
            回退至选择角色
          </button>
        </div>
      )}

    </div>
  );
};

export default QuickCharacterSelector;
