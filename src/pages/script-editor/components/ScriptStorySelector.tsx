import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { Iconfont } from "@/components/IconFont";
import { getScriptStorySynopsisReq, type ScriptStorySynopsisResult } from "@/api/generate-quick";
import titleIcon from "@/assets/images/quick_creation/script_story_title.svg";
import synopsisIcon from "@/assets/images/quick_creation/script_story_synopsis.svg";
import backgroundIcon from "@/assets/images/quick_creation/script_story_background.svg";
import highlightIcon from "@/assets/images/quick_creation/script_story_highlight.svg";
import informationGapIcon from "@/assets/images/quick_creation/script_story_informationGap.svg";
import editIcon from "@/assets/images/quick_creation/edit.svg";
import confirmScSvg from "@/assets/images/quick_creation/confirm_sc.svg";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import "./ScriptStorySelector.css";

type TabType = "original" | "inspiration1" | "inspiration2" | "custom1" | "custom2" | "custom3";
const CUSTOM_TAB_IDS: TabType[] = ["custom1", "custom2", "custom3"];
const MAX_CUSTOM_TABS = 3;
const MAX_TITLE_LENGTH = 20;
const MAX_OTHER_LENGTH = 300;
const CONFIRM_STAMP_ANIMATION_MS = 600;

interface StoryFieldConfig {
  key: keyof ScriptStorySynopsisResult;
  label: string;
  required: boolean;
  maxLength: number;
  icon: string;
}

const fields: StoryFieldConfig[] = [
  { key: "title", label: "剧名", required: true, maxLength: MAX_TITLE_LENGTH, icon: titleIcon },
  { key: "synopsis", label: "故事梗概", required: true, maxLength: MAX_OTHER_LENGTH, icon: synopsisIcon },
  { key: "background", label: "故事背景", required: true, maxLength: MAX_OTHER_LENGTH, icon: backgroundIcon },
  { key: "highlight", label: "核心亮点", required: false, maxLength: MAX_OTHER_LENGTH, icon: highlightIcon },
  {
    key: "informationGap",
    label: "信息差",
    required: false,
    maxLength: MAX_OTHER_LENGTH,
    icon: informationGapIcon,
  },
];

interface StoryDataPayload {
  selectedTab: TabType;
  selectedData: ScriptStorySynopsisResult;
  allCards: Record<TabType, ScriptStorySynopsisResult>;
  customTabCount: number;
}

export interface ScriptStorySelectorProps {
  novelPlot?: string;
  description?: string;
  storyContent?: string;
  locked?: boolean;
  hasNextContent?: boolean;
  triggerGenerate?: number;
  onConfirm?: (storyData: string, title: string) => void;
  onRevert?: () => void;
  onRevertToCurrent?: () => void;
  onErrorAndRevert?: (targetDir: string) => void;
}

const emptyCard = (): ScriptStorySynopsisResult => ({
  title: "",
  synopsis: "",
  background: "",
  highlight: "",
  informationGap: "",
});

const createInitialCards = (): Record<TabType, ScriptStorySynopsisResult> => ({
  original: emptyCard(),
  inspiration1: emptyCard(),
  inspiration2: emptyCard(),
  custom1: emptyCard(),
  custom2: emptyCard(),
  custom3: emptyCard(),
});

export const ScriptStorySelector = ({
  novelPlot = "",
  description = "",
  storyContent = "",
  locked = false,
  hasNextContent = false,
  triggerGenerate = 0,
  onConfirm,
  onRevert,
  onRevertToCurrent,
  onErrorAndRevert,
}: ScriptStorySelectorProps) => {
  const [customTabCount, setCustomTabCount] = useState(0);
  const [activeTab, setActiveTab] = useState<TabType>("original");
  const [cards, setCards] = useState<Record<TabType, ScriptStorySynopsisResult>>(createInitialCards);
  const [loading, setLoading] = useState(false);
  const [activeFieldIndex, setActiveFieldIndex] = useState<number | null>(null);
  const [confirmStampPlaying, setConfirmStampPlaying] = useState(false);
  const [confirmStampKey, setConfirmStampKey] = useState(0);
  const prevTriggerGenerateRef = useRef(triggerGenerate);

  const tabs = useMemo(() => {
    const list: { id: TabType | "customAdd"; label: string }[] = [
      { id: "original", label: "小说原版" },
      { id: "inspiration1", label: "灵感版1" },
      { id: "inspiration2", label: "灵感版2" },
    ];
    for (let i = 0; i < customTabCount; i += 1) {
      list.push({ id: CUSTOM_TAB_IDS[i], label: `自定义${i + 1}` });
    }
    if (customTabCount < MAX_CUSTOM_TABS) {
      list.push({ id: "customAdd", label: "自定义+" });
    }
    return list;
  }, [customTabCount]);

  const isCurrentTabEditable = !locked && activeTab !== "original";
  const currentCard = cards[activeTab];
  const isFormValid =
    (currentCard.title || "").trim() !== "" &&
    (currentCard.synopsis || "").trim() !== "" &&
    (currentCard.background || "").trim() !== "";

  const userSelectedTab = useMemo((): TabType | null => {
    if (!storyContent) return null;
    try {
      const data = JSON.parse(storyContent) as { selectedTab?: string };
      const tab = data?.selectedTab;
      if (tab && tab !== "customAdd" && tabs.some((t) => t.id === tab)) return tab as TabType;
    } catch {
      // ignore
    }
    return null;
  }, [storyContent, tabs]);

  const initFromProps = () => {
    if (!storyContent) return;
    try {
      const data = JSON.parse(storyContent) as Partial<StoryDataPayload>;
      if (data.selectedTab && data.allCards) {
        setCards((prev) => ({ ...prev, ...data.allCards }));
        setActiveTab(data.selectedTab || "original");
        if (
          typeof data.customTabCount === "number" &&
          data.customTabCount >= 0 &&
          data.customTabCount <= MAX_CUSTOM_TABS
        ) {
          setCustomTabCount(data.customTabCount);
        }
      }
    } catch (e) {
      console.error("[ScriptStorySelector] Failed to parse storyContent:", e);
    }
  };

  useEffect(() => {
    if (storyContent) {
      initFromProps();
      return;
    }
    setCards(createInitialCards());
    setCustomTabCount(0);
    setActiveTab("original");
    setActiveFieldIndex(null);
  }, [storyContent]);

  const updateField = (key: keyof ScriptStorySynopsisResult, value: string) => {
    if (locked || !isCurrentTabEditable) return;
    setCards((prev) => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        [key]: value,
      },
    }));
  };

  const generateStorySynopsis = async () => {
    if (loading) return;
    if (!novelPlot) {
      toast.warning("请先完成小说纲章");
      return;
    }
    if (!description) {
      toast.warning("请先完成故事标签");
      return;
    }
    setLoading(true);
    try {
      const [resOriginal, resInspiration1, resInspiration2]: ScriptStorySynopsisResult[] =
        await Promise.all([
          getScriptStorySynopsisReq(novelPlot, ""),
          getScriptStorySynopsisReq(novelPlot, description),
          getScriptStorySynopsisReq(novelPlot, description),
        ]);
      setCards((prev) => ({
        ...prev,
        original: {
          title: resOriginal?.title || "",
          synopsis: resOriginal?.synopsis || "",
          background: resOriginal?.background || "",
          highlight: resOriginal?.highlight || "",
          informationGap: resOriginal?.informationGap || "",
        },
        inspiration1: {
          title: resInspiration1?.title || "",
          synopsis: resInspiration1?.synopsis || "",
          background: resInspiration1?.background || "",
          highlight: resInspiration1?.highlight || "",
          informationGap: resInspiration1?.informationGap || "",
        },
        inspiration2: {
          title: resInspiration2?.title || "",
          synopsis: resInspiration2?.synopsis || "",
          background: resInspiration2?.background || "",
          highlight: resInspiration2?.highlight || "",
          informationGap: resInspiration2?.informationGap || "",
        },
      }));
      setActiveTab("original");
    } catch (e) {
      console.error("[ScriptStorySelector] 获取故事梗概失败:", e);
      onErrorAndRevert?.("标签.md");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const oldVal = prevTriggerGenerateRef.current;
    if (triggerGenerate > oldVal && triggerGenerate > 0) {
      if (novelPlot && description && !locked) {
        void generateStorySynopsis();
      }
    }
    prevTriggerGenerateRef.current = triggerGenerate;
  }, [triggerGenerate, novelPlot, description, locked]);

  const handleTabChange = (tab: TabType | "customAdd") => {
    if (tab === "customAdd") {
      if (locked || customTabCount >= MAX_CUSTOM_TABS) return;
      const nextCount = customTabCount + 1;
      setCustomTabCount(nextCount);
      setActiveTab(CUSTOM_TAB_IDS[nextCount - 1]);
    } else {
      setActiveTab(tab);
    }
    setActiveFieldIndex(null);
  };

  const handleFieldClick = (index: number) => {
    if (locked) return;
    if (!isCurrentTabEditable) {
      toast.warning("小说原版不可修改");
      return;
    }
    const wasActive = activeFieldIndex === index;
    setActiveFieldIndex(wasActive ? null : index);
  };

  const handleConfirm = () => {
    if (!isFormValid) {
      toast.warning("请填写完整的必填项（剧名、故事梗概、故事背景）");
      return;
    }
    const selectedData = cards[activeTab];
    const fullData: StoryDataPayload = {
      selectedTab: activeTab,
      selectedData,
      allCards: cards,
      customTabCount,
    };
    const payload = JSON.stringify(fullData);
    if (confirmStampPlaying) return;
    setConfirmStampKey((k) => k + 1);
    setConfirmStampPlaying(true);
    setTimeout(() => {
      onConfirm?.(payload, selectedData.title || "");
      setTimeout(() => setConfirmStampPlaying(false), 500);
    }, CONFIRM_STAMP_ANIMATION_MS);
  };

  return (
    <div className="script-story-selector">
      <div className="header-section">
        <div className="section-title">请选择满意的故事梗概</div>
        {!locked ? (
          <Button
            variant="link"
            disabled={loading}
            className="regenerate-btn"
            onClick={() => void generateStorySynopsis()}
          >
            <Iconfont unicode="&#xe66f;" className="refresh-icon" />
            <span className="regenerate-text">重新生成</span>
          </Button>
        ) : null}
      </div>

      <div className="tabs-form-wrapper">
        <div className="tabs-row">
          {tabs.map((tab, i) => (
            <div key={`${tab.id}-${i}`} className="tabs-item-group">
              <button
                type="button"
                className={cn(
                  "tab-item",
                  i === 0 && "tab-first",
                  tab.id === activeTab && "active",
                  tab.id === "customAdd" && "tab-add"
                )}
                onClick={() => handleTabChange(tab.id)}
              >
                <span className="tab-item-content">{tab.label}</span>
              </button>
              <div
                className={cn(
                  "tabs-spacer",
                  activeTab === tab.id && "spacer-left-radius",
                  i + 1 < tabs.length && activeTab === tabs[i + 1]?.id && "spacer-right-radius",
                  i === tabs.length - 1 && "spacer-last"
                )}
              />
            </div>
          ))}
          <div className="tabs-fill" />
        </div>

        <div className="card-section">
          <div className={cn("story-card", loading && "loading")}>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="field-item skeleton-field">
                    <div className="field-icon-skeleton">
                      <Skeleton className="h-[50px] w-[50px] rounded-[5px]" />
                    </div>
                    <div className="field-content-skeleton">
                      <Skeleton className="mb-[5px] h-6 w-[100px]" />
                      <Skeleton className="h-6 w-full rounded-[5px]" />
                    </div>
                  </div>
                ))
              : fields.map((field, index) => {
                  const value = currentCard[field.key] || "";
                  const charCount = value.length;
                  const active = activeFieldIndex === index;
                  return (
                    <div
                      key={field.key}
                      className={cn(
                        "field-item",
                        active && "active",
                        value && "has-value"
                      )}
                      onClick={() => handleFieldClick(index)}
                    >
                      <div className="field-icon">
                        <img src={field.icon} alt={field.label} className="h-full w-full object-contain" />
                      </div>
                      <div className="field-content">
                        <div className="field-label">
                          {field.label}
                          {field.required ? <span className="required-mark">*</span> : null}
                        </div>
                        {!active ? (
                          <div className="field-preview">
                            <div className={cn("field-preview-text", value && "has-content")}>
                              {value || `请输入${field.label}`}
                            </div>
                            {isCurrentTabEditable && !locked ? (
                              <div className="field-edit-hint">
                                <img src={editIcon} alt="编辑" className="edit-icon" />
                                <span>编辑</span>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="field-input-wrapper" onClick={(e) => e.stopPropagation()}>
                            {field.key === "title" ? (
                              <Input
                                value={value}
                                maxLength={field.maxLength}
                                placeholder={`请输入${field.label}`}
                                className="field-input"
                                onChange={(e) => updateField(field.key, e.target.value)}
                                onBlur={() => setActiveFieldIndex(null)}
                              />
                            ) : (
                              <Textarea
                                value={value}
                                maxLength={field.maxLength}
                                placeholder={`请输入${field.label}`}
                                className="field-textarea"
                                areaClassName="field-textarea-area"
                                onChange={(e) => updateField(field.key, e.target.value)}
                                onBlur={() => setActiveFieldIndex(null)}
                              />
                            )}
                            <div className="field-char-count">
                              {charCount}/{field.maxLength}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>

        {(locked || confirmStampPlaying) ? (
          <div className="confirm-stamp-wrap">
            {(confirmStampPlaying || (locked && userSelectedTab != null && activeTab === userSelectedTab)) ? (
              <img
                key={`stamp-${confirmStampKey}`}
                className={cn(
                  "confirm-stamp-img",
                  confirmStampPlaying && "stamp-drop"
                )}
                src={confirmScSvg}
                alt=""
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {!locked ? (
        <div className="footer-actions">
          <Button className="confirm-btn" disabled={!isFormValid || confirmStampPlaying} onClick={handleConfirm}>
            下一步
          </Button>
        </div>
      ) : null}

      {hasNextContent ? (
        <div className="bottom-revert-section">
          <Button className="revert-btn-bottom" onClick={() => onRevertToCurrent?.()}>
            回退至故事梗概
          </Button>
        </div>
      ) : null}
      <span className="hidden" onClick={() => onRevert?.()} />
    </div>
  );
};
