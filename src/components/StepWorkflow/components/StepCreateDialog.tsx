"use client";

import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  VisuallyHidden,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { FormRecommendLabel } from "@/components/ui/FormRecommendLabel";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "sonner";
import {
  getTemplatesReq,
  getCharacterSettings,
  getStoriesReq,
} from "@/api/generate-dialog";
import { postTemplateStream } from "@/api/writing-templates";
import { useOptionsStore } from "@/stores/options";
import type { PostStreamData } from "@/api";
import { trackEvent } from "@/matomo/trackingMatomoEvent";
import { showStepConfirmDialog } from "./showStepConfirmDialog";
import { CustomSteps } from "./CustomSteps";
import { CharacterCard } from "./CharacterCard";
import { TagSelector, type TagCategoryDataItem } from "./TagSelector";
import { TemplateCardItem } from "../TemplateCardItem";
import {MarkdownEditor} from "@/components/MarkdownEditor";
import type {
  Mode,
  Template,
  CharacterCardData,
  StoryStorm,
  StepSaveData,
  Tag,
} from "../types";

/**
 * 模式封面图：用 import 引入，Vite 会打包并输出正确 URL。
 * 请将 Vue 项目 src/assets/images/step_create/ 下的三张图复制到：
 * react-app/src/assets/images/step_create/custom-cover.png
 * react-app/src/assets/images/step_create/template-cover.png
 * react-app/src/assets/images/step_create/tag-cover.png
 */
import customCoverImg from "@/assets/images/step_create/custom-cover.png";
import templateCoverImg from "@/assets/images/step_create/template-cover.png";
import tagCoverImg from "@/assets/images/step_create/tag-cover.png";
import Iconfont from "@/components/Iconfont/Iconfont";
import { getWorkTagsReq } from "@/api/works";
import { cn } from "@/lib/utils";
import { LinkButton } from "@/components/ui/LinkButton";
import { useEditorStore } from "@/stores/editorStore";
import { AutoScrollArea } from "@/components/AutoScrollArea";
import { ScrollArea } from "@/components/ui/ScrollArea";
import FEMALE from "@/assets/images/character_card/female.png";
import MALE from "@/assets/images/character_card/male.png";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

const CUSTOM_COVER = customCoverImg as string;
const TEMPLATE_COVER = templateCoverImg as string;
const TAG_COVER = tagCoverImg as string;

const STEPS = ["选择创作方式", "确定内容", "选择故事", "选择主角", "创作大纲"];
const STEPS_CUSTOM = [
  "选择创作方式",
  "自定义设定",
  "选择故事",
  "选择主角",
  "创作大纲",
];
const STEPS_TEMPLATE = [
  "选择创作方式",
  "选择模板",
  "选择故事",
  "选择主角",
  "创作大纲",
];
const STEPS_TAG = [
  "选择创作方式",
  "选择标签",
  "选择故事",
  "选择主角",
  "创作大纲",
];

const EMPTY_STORY: StoryStorm = { title: "", intro: "", theme: "" };
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
const MAX_INTRO_LENGTH = 1000;
const ROOT_FONT_PX = 16;
const pxToRem = (px: number) => `${(px / ROOT_FONT_PX).toFixed(4)}rem`;

// 深拷贝（与 Vue 侧实现一致）
const deepClone = <T,>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

export interface StepCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm?: (data: StepSaveData, editingId?: string) => void;
}

export interface StepCreateDialogRef {
  handleModeClick: (mode: Mode) => void;
  handleTemplateClick: (template: Template) => void;
  nextStepConfirm: () => void;
  /** 用于外部（如创作推荐弹窗）直接进入“选择内容”步骤 */
  startMode: (mode: Mode) => void;
  /** 用于外部选择模板后直接进入“选择故事”（stepActive=2） */
  startTemplateCreate: (template: Template) => void;
}

const MODES = [
  {
    mode: "custom" as Mode,
    title: "自定义短篇创作",
    desc: "详细制定你的内容方向，并进行导语→故事→角色→章节的完整创作链",
    cover: CUSTOM_COVER,
  },
  {
    mode: "template" as Mode,
    title: "使用模板创作",
    desc: "选择热门模板创作，套用核心梗，助力创作爆款小说",
    cover: TEMPLATE_COVER,
  },
  {
    mode: "tag" as Mode,
    title: "使用标签创作",
    desc: "选择标签自由获取灵感脑洞，让创作的思维肆意挥洒",
    cover: TAG_COVER,
  },
];

const FormMap = new Map([
  ["prompt", "提示词"],
  ["coreMeme", "核心梗"],
  ["background", "故事背景"],
  ["persona", "主角人设"],
  ["wordCount", "字数"],
  ["perspective", "人称"],
]);

const generateCustomDesc = (formData: Record<string, any> | null) => {
  let description = "";
  if (!formData) return description;

  const keys = Object.keys(formData);
  for (const key of keys) {
    const customItem = formData[key];
    if (FormMap.has(key) && customItem != "") {
      description += FormMap.get(key) + ":" + customItem + ";";
    }
    console.log("description", description);
  }
  return description;
};

/** 将 store 的 string[] 转为 FormRecommendLabel 需要的 { label, value }[] */
const toRecommendItems = (arr: string[]): { label: string; value: string }[] =>
  (arr ?? []).map((s) => ({ label: s, value: s }));

export const StepCreateDialog = React.forwardRef<
  StepCreateDialogRef,
  StepCreateDialogProps
>(function StepCreateDialog({ open, onOpenChange, onConfirm }, ref) {
  const { recommendConfig, updateRecommendConfig } = useOptionsStore();

  const [stepActive, setStepActive] = useState(0);
  const [steps, setSteps] = useState<string[]>(STEPS);
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null,
  );
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [tagCategories, setTagCategories] = useState<TagCategoryDataItem[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [stories, setStories] = useState<StoryStorm[]>([
    EMPTY_STORY,
    EMPTY_STORY,
    EMPTY_STORY,
  ]);
  const [selectedStory, setSelectedStory] = useState<StoryStorm | null>(null);
  const [characters, setCharacters] = useState<CharacterCardData[]>([
    EMPTY_CHARACTER,
    EMPTY_CHARACTER,
    EMPTY_CHARACTER,
  ]);
  const [selectedCharacter, setSelectedCharacter] =
    useState<CharacterCardData | null>(null);
  const [outlineContent, setOutlineContent] = useState("");
  const [isOutlineEditing, setIsOutlineEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  // 自定义表单模型（对齐 Vue formModel）
  const [formModel, setFormModel] = useState({
    prompt: "官方提供-专业短篇小说写作30年",
    coreMeme: "",
    background: "",
    persona: "",
    wordCount: "",
    perspective: "",
  });
  // 流式大纲 AbortController
  const outlineStreamAbortControllerRef = useRef<AbortController | null>(null);
  // 当前步骤快照（与 Vue 的 currentStepStates 对应）
  const [stepSnapshots, setStepSnapshots] = useState<(unknown | null)[]>([
    null,
    null,
    null,
    null,
    null,
  ]);
  // 历史步骤快照（与 Vue 的 historyStepStates 对应）
  const [historyStepSnapshots, setHistoryStepSnapshots] = useState<
    (unknown | null)[]
  >([null, null, null, null, null]);
  const [stepUpdatedFlags, setStepUpdatedFlags] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
  ]);
  const storyAbortRef = useRef<AbortController | null>(null);
  const characterAbortRef = useRef<AbortController | null>(null);
  const lastTrackedStepRef = useRef<number | null>(null);
  const [isStoryEditOpen, setIsStoryEditOpen] = useState(false);
  const [isStoryEditAnimating, setIsStoryEditAnimating] = useState(false);
  const [storyEditPanelStyle, setStoryEditPanelStyle] =
    useState<React.CSSProperties>({
      left: "0rem",
      top: "0rem",
      width: "0rem",
      height: pxToRem(480),
      transformOrigin: "top left",
    });
  const [editingStory, setEditingStory] = useState<StoryStorm>(EMPTY_STORY);
  const [editingStoryIndex, setEditingStoryIndex] = useState<number | null>(
    null,
  );
  const storyStepRef = useRef<HTMLDivElement | null>(null);
  const storyEditExpandTimerRef = useRef<number | null>(null);
  const storyEditFinishTimerRef = useRef<number | null>(null);
  const [isCharacterEditOpen, setIsCharacterEditOpen] = useState(false);
  const [isCharacterEditAnimating, setIsCharacterEditAnimating] =
    useState(false);
  const [characterEditPanelStyle, setCharacterEditPanelStyle] =
    useState<React.CSSProperties>({
      left: "0rem",
      top: "0rem",
      width: "0rem",
      height: pxToRem(480),
      transformOrigin: "top left",
    });
  const [editingCharacter, setEditingCharacter] =
    useState<CharacterCardData>(EMPTY_CHARACTER);
  const [editingCharacterIndex, setEditingCharacterIndex] = useState<
    number | null
  >(null);
  const characterStepRef = useRef<HTMLDivElement | null>(null);
  const characterEditExpandTimerRef = useRef<number | null>(null);
  const characterEditFinishTimerRef = useRef<number | null>(null);

  const workId = useEditorStore((s) => s.workId);

  useEffect(() => {
    if (open) {
      // 打开 Dialog 前移除外层编辑器焦点，避免 aria-hidden 与已聚焦元素冲突
      const active = document.activeElement;
      if (active instanceof HTMLElement) {
        active.blur();
      }
    }
  }, [open]);

  useEffect(() => {
    if (selectedMode === "template") setSteps(STEPS_TEMPLATE);
    else if (selectedMode === "tag") setSteps(STEPS_TAG);
    else if (selectedMode === "custom") setSteps(STEPS_CUSTOM);
    else setSteps(STEPS);
  }, [selectedMode]);

  const [categories, setCategories] = useState<TagCategoryDataItem[]>([]);

  const updateTagCategories = useCallback(async () => {
    try {
      const response: any = await getWorkTagsReq();
      if (!Array.isArray(response)) {
        setCategories([]);
        return;
      }
      const nextCategories = response.map(
        (group: {
          category: string;
          categoryId: number;
          max: number;
          tags: Tag[];
        }) => ({
          category: group.category,
          categoryId: String(group.categoryId),
          max: group.max,
          tags: (group.tags ?? []).map((tag: Tag) => ({
            ...tag,
            category: group.category,
            categoryId: String(group.categoryId),
            max: group.max,
          })),
        }),
      );
      setCategories(nextCategories);
    } catch (error) {
      setCategories([]);
      console.error("获取标签数据失败:", error);
    }
  }, []);

  // 弹窗打开时拉取推荐配置（与 Vue optionsStore.updateConfig 一致）
  useEffect(() => {
    if (open) {
      updateTagCategories();
      updateRecommendConfig();
    }
  }, [open, updateRecommendConfig, updateTagCategories]);

  useEffect(() => {
    if (!open) {
      lastTrackedStepRef.current = null;
      return;
    }
    if (lastTrackedStepRef.current === stepActive) return;
    lastTrackedStepRef.current = stepActive;

    if (stepActive === 0) {
      trackEvent("Guided Writing", "Step", "Mode");
      return;
    }
    if (stepActive === 1) {
      trackEvent("Guided Writing", "Step", "Content");
      return;
    }
    if (stepActive === 2) {
      trackEvent("Guided Writing", "Step", "Story");
      if (selectedMode === "template" && selectedTemplate?.title) {
        trackEvent("Template", "Apply", selectedTemplate.title);
      }
      if (selectedMode === "tag" && selectedTags.length > 0) {
        selectedTags.forEach((tag) => {
          const category = tagCategories.find(
            (cat) => cat.categoryId === tag.categoryId,
          );
          if (category) {
            trackEvent("Tag", "Apply", `${category.category}:${tag.name}`);
          }
        });
      }
      return;
    }
    if (stepActive === 3) {
      trackEvent("Guided Writing", "Step", "Protagonist");
    }
  }, [
    open,
    stepActive,
    selectedMode,
    selectedTemplate,
    selectedTags,
    tagCategories,
  ]);

  const updateStepSnapshot = useCallback((index: number, snapshot: unknown) => {
    setStepSnapshots((prev) => {
      const next = [...prev];
      next[index] = snapshot;
      for (let j = index + 1; j < next.length; j++) next[j] = null;
      return next;
    });
    setStepUpdatedFlags((prev) => {
      const next = [...prev];
      for (let j = index + 1; j < next.length; j++) next[j] = false;
      return next;
    });
  }, []);

  const markStepUpdated = useCallback((index: number) => {
    setStepUpdatedFlags((prev) => {
      const next = [...prev];
      next[index] = true;
      return next;
    });
  }, []);

  // 自定义表单变更时更新步骤1快照（与 Vue watch formModel 一致）
  useEffect(() => {
    if (formModel.coreMeme && formModel.background && formModel.persona) {
      updateStepSnapshot(1, formModel);
    } else {
      updateStepSnapshot(1, null);
    }
  }, [formModel, updateStepSnapshot]);

  const isStepAccessible = useCallback(
    (stepIndex: number) => {
      if (stepIndex === 0) return true;
      return stepSnapshots[stepIndex - 1] != null;
    },
    [stepSnapshots],
  );

  const stepAccessibleList = steps.map((_, i) =>
    i <= stepActive ? true : isStepAccessible(i),
  );

  // 进入下一步前：把 current 同步到 history
  const syncHistoryIfChanged = useCallback(() => {
    setHistoryStepSnapshots((prev) => {
      if (prev[stepActive] !== stepSnapshots[stepActive]) {
        return deepClone(stepSnapshots);
      }
      return prev;
    });
  }, [stepActive, stepSnapshots]);

  // 是否可以进入下一步（完全对齐 Vue 的 nextStepAble）
  const nextStepAble = useMemo(() => {
    const currentStep = stepActive;
    if (currentStep === 0) {
      return !!selectedMode;
    } else if (currentStep === 1) {
      if (selectedMode === "template") {
        return !!selectedTemplate;
      } else if (selectedMode === "tag") {
        return selectedTags.length > 0;
      } else if (selectedMode === "custom") {
        return !!(
          formModel.coreMeme &&
          formModel.background &&
          formModel.persona
        );
      }
      return false;
    } else if (currentStep === 2) {
      return !!selectedStory;
    } else if (currentStep === 3) {
      return !!selectedCharacter;
    } else if (currentStep === 4) {
      if (loading) return false;
      return true;
    }
    return true;
  }, [
    stepActive,
    selectedMode,
    selectedTemplate,
    selectedTags,
    selectedStory,
    selectedCharacter,
    loading,
    formModel,
  ]);

  // 下一步/保存至作品（与 Vue nextStepConfirm 一致，Footer 与 ref 共用）
  const handleNextStepConfirm = useCallback(() => {
    syncHistoryIfChanged();
    if (stepActive === 0 && selectedMode) {
      if (selectedMode === "template")
        trackEvent("Guided Writing", "Start", "Template Write from Tool");
      if (selectedMode === "tag")
        trackEvent("Guided Writing", "Start", "Tag Write from Tool");
      if (selectedMode === "custom")
        trackEvent("Guided Writing", "Start", "Custom Write from Tool");
      setStepActive(1);
      return;
    }
    if (stepActive === 1) {
      setStepActive(2);
      return;
    }
    if (stepActive === 2) {
      setStepActive(3);
      return;
    }
    if (stepActive === 3) {
      setStepActive(4);
      return;
    }
    if (stepActive === 4) {
      const outline = outlineContent;
      const description =
        selectedMode === "template"
          ? (selectedTemplate?.description ?? "")
          : selectedMode === "tag"
            ? selectedTags.map((t) => t.name).join(",")
            : selectedMode === "custom"
              ? [formModel.coreMeme, formModel.background, formModel.persona]
                  .filter(Boolean)
                  .join(";")
              : "";
      trackEvent("Guided Writing", "Complete", "End");
      onConfirm?.(
        {
          mode: selectedMode,
          template: selectedTemplate,
          tags: selectedTags,
          character: selectedCharacter,
          story: selectedStory,
          outline,
          description,
          saveTarget: "current",
        },
        "大纲.md",
      );
      onOpenChange(false);
    }
  }, [
    stepActive,
    selectedMode,
    selectedTemplate,
    selectedTags,
    formModel,
    selectedCharacter,
    selectedStory,
    outlineContent,
    onConfirm,
    onOpenChange,
    syncHistoryIfChanged,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      handleModeClick(mode: Mode) {
        setSelectedMode(mode);
        setStepActive(0);
        updateStepSnapshot(0, mode);
      },
      handleTemplateClick(template: Template) {
        setSelectedTemplate(template);
        updateStepSnapshot(1, template);
      },
      nextStepConfirm() {
        handleNextStepConfirm();
      },
      startMode(mode: Mode) {
        setSelectedMode(mode);
        updateStepSnapshot(0, mode);
        setStepActive(1);
      },
      startTemplateCreate(template: Template) {
        setSelectedMode("template");
        setSelectedTemplate(template);
        updateStepSnapshot(0, "template");
        updateStepSnapshot(1, template);
        setStepActive(2);
      },
    }),
    [handleNextStepConfirm, updateStepSnapshot],
  );

  const handleStepClick = useCallback(
    (stepIndex: number) => {
      if (stepIndex === stepActive) return;
      if (stepIndex > stepActive && !isStepAccessible(stepIndex)) return;
      // 与 Vue onStepClick 一致：若当前步快照与历史不一致则先同步
      if (stepSnapshots[stepActive] !== historyStepSnapshots[stepActive]) {
        setHistoryStepSnapshots(deepClone(stepSnapshots));
      }
      setStepActive(stepIndex);
    },
    [stepActive, stepSnapshots, historyStepSnapshots, isStepAccessible],
  );

  const handleModeClick = useCallback(
    (mode: Mode) => {
      setSelectedMode(mode);
      updateStepSnapshot(0, mode);
    },
    [updateStepSnapshot],
  );

  const handleTemplateClick = useCallback(
    (template: Template) => {
      setSelectedTemplate(template);
      updateStepSnapshot(1, template);
    },
    [updateStepSnapshot],
  );

  const handleSelectedTagsChange = useCallback((tags: Tag[]) => {
    setSelectedTags(tags);
  }, []);

  const handleTagCategoriesChange = useCallback(
    (categories: TagCategoryDataItem[]) => {
      setTagCategories(categories);
    },
    [],
  );

  useEffect(() => {
    if (selectedMode !== "tag") return;
    if (selectedTags.length > 0) {
      updateStepSnapshot(1, selectedTags);
      return;
    }
    updateStepSnapshot(1, null);
  }, [selectedMode, selectedTags, updateStepSnapshot]);

  const chapterNumber = useMemo(() => {
    const chapterCategory = tagCategories.find((cat) =>
      cat.category.includes("章"),
    );
    if (!chapterCategory) return 10;
    const selectedIds = new Set(selectedTags.map((tag) => String(tag.id)));
    const selectedChapterTag = chapterCategory.tags.find((tag) =>
      selectedIds.has(String(tag.id)),
    );
    const chapterText = selectedChapterTag?.name ?? "10章";
    const matched = chapterText.match(/\d+/);
    if (!matched) return 10;
    const parsed = Number.parseInt(matched[0], 10);
    return Number.isNaN(parsed) ? 10 : parsed;
  }, [selectedTags, tagCategories]);

  const handleSelectStory = useCallback(
    (story: StoryStorm) => {
      if (story === selectedStory) return;
      if (!story?.title && !story?.intro) return;
      setSelectedStory(story);
      updateStepSnapshot(2, story);
    },
    [selectedStory, updateStepSnapshot],
  );

  const handleSelectRecommend = useCallback((key: string, value: string) => {
    setFormModel((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleBack = useCallback(() => {
    if (stepActive > 0) setStepActive(stepActive - 1);
  }, [stepActive]);

  const handleClose = useCallback(async () => {
    if (selectedStory || selectedCharacter) {
      try {
        const result = await showStepConfirmDialog();
        if (result === "cancel") {
          onOpenChange(false);
          return;
        }
        if (result === "saveToCurrent" || result === "saveToNew") {
          const outline = outlineContent || '';
          const description =
            selectedMode === "template"
              ? (selectedTemplate?.description ?? "")
              : selectedMode === "tag"
                ? selectedTags.map((t) => t.name).join(",")
                : selectedMode === "custom"
                  ? [
                      formModel.coreMeme,
                      formModel.background,
                      formModel.persona,
                    ]
                      .filter(Boolean)
                      .join(";")
                  : "";
          onConfirm?.(
            {
              mode: selectedMode,
              template: selectedTemplate,
              tags: selectedTags,
              character: selectedCharacter,
              story: selectedStory,
              outline,
              description,
              saveTarget: result === "saveToCurrent" ? "current" : "new",
            },
            "设定/故事设定.md",
          );
          onOpenChange(false);
        }
      } catch {
        onOpenChange(false);
      }
    } else {
      onOpenChange(false);
    }
  }, [
    selectedStory,
    selectedCharacter,
    outlineContent,
    selectedMode,
    selectedTemplate,
    selectedTags,
    formModel,
    onOpenChange,
    onConfirm,
  ]);

  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        onOpenChange(true);
        return;
      }
      void handleClose();
    },
    [onOpenChange, handleClose],
  );

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      try {
        const res: any = await getTemplatesReq();
        if (Array.isArray(res?.content)) {
          setTemplates(
            res.content.map((item: any) => ({
              id: String(item.id),
              title: item.title || "",
              description: item.content || "",
              usageCount: item.numberOfUses ?? 0,
              tags:
                item.tags?.map((t: any) => ({
                  name: t?.name,
                  id: t?.id,
                  category: t?.category,
                })) ?? [],
            })),
          );
        }
      } catch (error) {
        console.error(error);
      }
    };
    load();
  }, [open]);

  const updateStories = useCallback(async () => {
    if (storyAbortRef.current) storyAbortRef.current.abort();
    const controller = new AbortController();
    storyAbortRef.current = controller;
    markStepUpdated(2);
    setStories([EMPTY_STORY, EMPTY_STORY, EMPTY_STORY]);
    setSelectedStory(null);
    setLoading(true);
    let description = "";
    let tagIds: string[] = [];
    if (selectedMode === "tag") {
      description = selectedTags.map((t) => t.name).join(",");
      tagIds = selectedTags.map((t) => String(t.id));
    } else if (selectedMode === "template" && selectedTemplate) {
      description = selectedTemplate.description;
      // 与 Vue 一致：模板模式下传入模板自带的 tags
      tagIds = (selectedTemplate.tags ?? []).map((t) => String(t.id));
    } else if (selectedMode === "custom") {
      description = [
        formModel.coreMeme,
        formModel.background,
        formModel.persona,
      ]
        .filter(Boolean)
        .join(";");
    }
    try {
      const res: any = await getStoriesReq(
        { templateContent: description, tagIds: [] },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      const list = Array.isArray(res) ? res : [];
      setStories(
        [0, 1, 2].map((i) => {
          const item = list[i];
          return item
            ? {
                title: item.title || item.name || "彩蛋",
                intro: item.story || "这是彩蛋，没有故事设定~",
                theme: "",
              }
            : EMPTY_STORY;
        }),
      );
    } catch (e: any) {
      if (e?.name === "AbortError" || e?.code === "ERR_CANCELED") return;
      setStories([EMPTY_STORY, EMPTY_STORY, EMPTY_STORY]);
    } finally {
      setLoading(false);
      storyAbortRef.current = null;
    }
  }, [
    selectedMode,
    selectedTemplate,
    selectedTags,
    formModel.coreMeme,
    formModel.background,
    formModel.persona,
    markStepUpdated,
  ]);

  useEffect(() => {
    if (!open || stepActive !== 2 || !selectedMode) return;
    // 对齐 Vue：进入步骤2时，只要有当前/历史状态，或已有选中故事，或已更新标记，就不重复请求
    const hasStoryState =
      stepSnapshots[2] != null ||
      historyStepSnapshots[2] != null ||
      stepUpdatedFlags[2] ||
      !!selectedStory;
    if (hasStoryState) return;
    updateStories();
  }, [
    open,
    stepActive,
    selectedMode,
    stepSnapshots,
    historyStepSnapshots,
    stepUpdatedFlags,
    selectedStory,
    updateStories,
  ]);

  const updateCharacters = useCallback(async () => {
    if (!selectedStory?.title) return;
    if (characterAbortRef.current) characterAbortRef.current.abort();
    const controller = new AbortController();
    characterAbortRef.current = controller;
    markStepUpdated(3);
    setLoading(true);
    setCharacters([EMPTY_CHARACTER, EMPTY_CHARACTER, EMPTY_CHARACTER]);
    setSelectedCharacter(null);
    const desc =
      selectedMode === "template"
        ? (selectedTemplate?.description ?? "")
        : selectedMode === "tag"
          ? selectedTags.map((t) => t.name).join(",")
          : [formModel.coreMeme, formModel.background, formModel.persona]
              .filter(Boolean)
              .join(";");
    try {
      const req: any = await getCharacterSettings(
        {
          workType: "editor",
          description: desc,
          brainStorm: {
            title: selectedStory.title,
            intro: selectedStory.intro,
          },
        },
        {
          signal: controller.signal,
        },
      );
      if (controller.signal.aborted) return;
      const list = Array.isArray(req?.roleCards) ? req.roleCards : [];
      setCharacters(
        [0, 1, 2].map((i) => {
          const item = list[i];
          return item
            ? {
                name: item.name ?? "",
                gender: item.gender ?? "",
                age: item.age ?? "",
                bloodType: item.bloodType ?? "",
                mbti: item.mbti ?? "",
                experiences: item.experiences ?? "",
                personality: item.personality ?? "",
                abilities: item.abilities ?? "",
                identity: item.identity ?? "",
              }
            : EMPTY_CHARACTER;
        }),
      );
    } catch {
      setCharacters([EMPTY_CHARACTER, EMPTY_CHARACTER, EMPTY_CHARACTER]);
    } finally {
      setLoading(false);
      characterAbortRef.current = null;
    }
  }, [
    selectedStory,
    selectedMode,
    selectedTemplate,
    selectedTags,
    formModel.coreMeme,
    formModel.background,
    formModel.persona,
    markStepUpdated,
  ]);

  useEffect(() => {
    if (!open || stepActive !== 3 || !selectedStory?.title) return;
    // 对齐 Vue：进入步骤3时，只要有当前/历史状态，或已有选中角色，或已更新标记，就不重复请求
    const hasCharacterState =
      stepSnapshots[3] != null ||
      historyStepSnapshots[3] != null ||
      stepUpdatedFlags[3] ||
      !!selectedCharacter;
    if (hasCharacterState) return;
    updateCharacters();
  }, [
    open,
    stepActive,
    selectedStory,
    stepSnapshots,
    historyStepSnapshots,
    stepUpdatedFlags,
    selectedCharacter,
    updateCharacters,
  ]);

  const handleCharacterClick = useCallback(
    (c: CharacterCardData) => {
      if (!c.name) return;
      setSelectedCharacter(c);
      updateStepSnapshot(3, c);
    },
    [updateStepSnapshot],
  );

  const clearStoryEditTimers = useCallback(() => {
    if (storyEditExpandTimerRef.current !== null) {
      window.clearTimeout(storyEditExpandTimerRef.current);
      storyEditExpandTimerRef.current = null;
    }
    if (storyEditFinishTimerRef.current !== null) {
      window.clearTimeout(storyEditFinishTimerRef.current);
      storyEditFinishTimerRef.current = null;
    }
  }, []);

  const animateStoryPanelFromCard = useCallback(
    (cardElement: HTMLElement) => {
      if (!storyStepRef.current) {
        setIsStoryEditOpen(true);
        setIsStoryEditAnimating(false);
        return;
      }
      clearStoryEditTimers();
      const containerRect = storyStepRef.current.getBoundingClientRect();
      const cardRect = cardElement.getBoundingClientRect();
      const left = cardRect.left - containerRect.left;
      const top = cardRect.top - containerRect.top + 60;
      const width = cardRect.width;
      setStoryEditPanelStyle({
        left: pxToRem(left),
        top: pxToRem(top),
        width: pxToRem(width),
        height: pxToRem(440),
        transformOrigin: "top left",
      });
      setIsStoryEditAnimating(true);
      setIsStoryEditOpen(true);
      storyEditExpandTimerRef.current = window.setTimeout(() => {
        setStoryEditPanelStyle({
          left: "0rem",
          top: pxToRem(60),
          width: "100%",
          bottom: pxToRem(60),
          height: pxToRem(440),
          transformOrigin: "top left",
        });
        storyEditFinishTimerRef.current = window.setTimeout(() => {
          setIsStoryEditAnimating(false);
        }, 650);
      }, 50);
    },
    [clearStoryEditTimers],
  );

  const closeStoryEditPanel = useCallback(() => {
    clearStoryEditTimers();
    setIsStoryEditOpen(false);
    setEditingStory(EMPTY_STORY);
    setEditingStoryIndex(null);
    setIsStoryEditAnimating(false);
  }, [clearStoryEditTimers]);

  const handleEditStory = useCallback(
    (
      story: StoryStorm,
      index: number,
      event?: React.MouseEvent<HTMLElement>,
    ) => {
      if (!story?.title && !story?.intro) return;
      setEditingStory({ ...story });
      setEditingStoryIndex(index);
      const cardElement = event?.currentTarget
        ? ((event.currentTarget as HTMLElement).closest(
            ".story-card",
          ) as HTMLElement | null)
        : null;
      if (cardElement) {
        animateStoryPanelFromCard(cardElement);
        return;
      }
      setIsStoryEditAnimating(false);
      setIsStoryEditOpen(true);
    },
    [animateStoryPanelFromCard],
  );

  const handleSaveStoryEdit = useCallback(() => {
    if (editingStoryIndex == null) return;
    const title = (editingStory.title || "").trim();
    const intro = (editingStory.intro || "").trim();
    if (!title) {
      toast.warning("请填写书名");
      return;
    }

    let nextStory: StoryStorm | null = null;
    setStories((prev) => {
      const next = [...prev];
      nextStory = { ...editingStory, title, intro };
      next[editingStoryIndex] = nextStory;
      return next;
    });
    if (selectedStory === stories[editingStoryIndex] && nextStory) {
      setSelectedStory(nextStory);
    }
    if (nextStory) updateStepSnapshot(2, nextStory);
    closeStoryEditPanel();
  }, [
    editingStory,
    editingStoryIndex,
    selectedStory,
    stories,
    updateStepSnapshot,
    closeStoryEditPanel,
  ]);

  const clearCharacterEditTimers = useCallback(() => {
    if (characterEditExpandTimerRef.current !== null) {
      window.clearTimeout(characterEditExpandTimerRef.current);
      characterEditExpandTimerRef.current = null;
    }
    if (characterEditFinishTimerRef.current !== null) {
      window.clearTimeout(characterEditFinishTimerRef.current);
      characterEditFinishTimerRef.current = null;
    }
  }, []);

  const animateCharacterPanelFromCard = useCallback(
    (cardElement: HTMLElement) => {
      if (!characterStepRef.current) {
        setIsCharacterEditOpen(true);
        setIsCharacterEditAnimating(false);
        return;
      }
      clearCharacterEditTimers();
      const containerRect = characterStepRef.current.getBoundingClientRect();
      const cardRect = cardElement.getBoundingClientRect();
      const left = cardRect.left - containerRect.left;
      const top = cardRect.top - containerRect.top + 60;
      const width = cardRect.width;
      setCharacterEditPanelStyle({
        left: pxToRem(left),
        top: pxToRem(top),
        width: pxToRem(width),
        height: pxToRem(480),
        transformOrigin: "top left",
      });
      setIsCharacterEditAnimating(true);
      setIsCharacterEditOpen(true);
      characterEditExpandTimerRef.current = window.setTimeout(() => {
        setCharacterEditPanelStyle({
          left: "0rem",
          top: pxToRem(60),
          width: "100%",
          bottom: pxToRem(60),
          height: pxToRem(480),
          transformOrigin: "top left",
        });
        characterEditFinishTimerRef.current = window.setTimeout(() => {
          setIsCharacterEditAnimating(false);
        }, 650);
      }, 50);
    },
    [clearCharacterEditTimers],
  );

  const closeCharacterEditPanel = useCallback(() => {
    clearCharacterEditTimers();
    setIsCharacterEditOpen(false);
    setEditingCharacter(EMPTY_CHARACTER);
    setEditingCharacterIndex(null);
    setIsCharacterEditAnimating(false);
  }, [clearCharacterEditTimers]);

  const handleEditCharacter = useCallback(
    (character: CharacterCardData, index: number, event?: React.MouseEvent) => {
      if (!character?.name) return;
      setEditingCharacter({ ...character });
      setEditingCharacterIndex(index);
      const cardElement = event?.currentTarget
        ? ((event.currentTarget as HTMLElement).closest(
            ".character-card",
          ) as HTMLElement | null)
        : null;
      if (cardElement) {
        animateCharacterPanelFromCard(cardElement);
        return;
      }
      setIsCharacterEditAnimating(false);
      setIsCharacterEditOpen(true);
    },
    [animateCharacterPanelFromCard],
  );

  const handleSaveCharacterEdit = useCallback(() => {
    if (editingCharacterIndex == null) return;
    const name = (editingCharacter.name || "").trim();
    if (!name) {
      toast.warning("请填写角色名称");
      return;
    }

    let nextCharacter: CharacterCardData | null = null;
    setCharacters((prev) => {
      const next = [...prev];
      nextCharacter = { ...editingCharacter, name };
      next[editingCharacterIndex] = nextCharacter;
      return next;
    });
    if (
      selectedCharacter === characters[editingCharacterIndex] &&
      nextCharacter
    ) {
      setSelectedCharacter(nextCharacter);
    }
    if (nextCharacter) updateStepSnapshot(3, nextCharacter);
    closeCharacterEditPanel();
  }, [
    editingCharacter,
    editingCharacterIndex,
    selectedCharacter,
    characters,
    updateStepSnapshot,
    closeCharacterEditPanel,
  ]);

  const updateOutlineStream = useCallback(() => {
    if (!selectedStory?.title || !selectedCharacter?.name) return;
    if (outlineStreamAbortControllerRef.current)
      outlineStreamAbortControllerRef.current.abort();
    const controller = new AbortController();
    outlineStreamAbortControllerRef.current = controller;
    markStepUpdated(4);
    setOutlineContent("");
    setLoading(true);
    const onData = (data: PostStreamData) => {
      if (
        data.event === "messages/partial" &&
        Array.isArray(data.data) &&
        data.data.length > 0
      ) {
        const first = data.data[0];
        const text = first?.content?.[0]?.text;
        if (text != null) setOutlineContent(text);
      }
    };

    const requestData = {
      workId: workId || "0",
      targetStage: "outline",
      brainStorm: { title: selectedStory.title, intro: selectedStory.intro },
      roleCard: selectedCharacter,
      theme: selectedStory.theme,
      chapterNumber,
      description: "",
    };

    if (selectedMode === "template" && selectedTemplate) {
      requestData.description = selectedTemplate.description;
    } else if (selectedMode === "tag") {
      requestData.description = selectedTags.map((tag) => tag.name).join(",");
    } else if (selectedMode == "custom") {
      requestData.description = generateCustomDesc(
        historyStepSnapshots[1] as Record<string, any>,
      );
    }
    postTemplateStream(
      requestData,
      onData,
      () => {
        setLoading(false);
        outlineStreamAbortControllerRef.current = null;
      },
      () => {
        setLoading(false);
        outlineStreamAbortControllerRef.current = null;
      },
      { signal: controller.signal },
    );
  }, [selectedStory?.title, selectedStory?.intro, selectedStory?.theme, selectedCharacter, markStepUpdated, workId, chapterNumber, selectedMode, selectedTemplate, selectedTags, historyStepSnapshots]);

  useEffect(() => {
    if (
      !open ||
      stepActive !== 4 ||
      !selectedStory?.title ||
      !selectedCharacter?.name
    )
      return;
    setIsOutlineEditing(false);
    if (stepSnapshots[4] || stepUpdatedFlags[4]) return;
    updateOutlineStream();
  }, [
    open,
    stepActive,
    selectedStory,
    selectedCharacter,
    stepSnapshots,
    stepUpdatedFlags,
    updateOutlineStream,
  ]);

  // 关闭时重置状态（与 Vue initDialog 一致）
  useEffect(() => {
    if (!open) {
      setStepActive(0);
      setSteps(STEPS);
      setSelectedMode(null);
      setSelectedTemplate(null);
      setSelectedTags([]);
      setTagCategories([]);
      setFormModel({
        prompt: "官方提供-专业短篇小说写作30年",
        coreMeme: "",
        background: "",
        persona: "",
        wordCount: "",
        perspective: "",
      });
      setStories([EMPTY_STORY, EMPTY_STORY, EMPTY_STORY]);
      setSelectedStory(null);
      setCharacters([EMPTY_CHARACTER, EMPTY_CHARACTER, EMPTY_CHARACTER]);
      setSelectedCharacter(null);
      setOutlineContent("");
      setIsOutlineEditing(false);
      setLoading(false);
      setIsStoryEditOpen(false);
      setIsStoryEditAnimating(false);
      setEditingStory(EMPTY_STORY);
      setEditingStoryIndex(null);
      setIsCharacterEditOpen(false);
      setIsCharacterEditAnimating(false);
      setEditingCharacter(EMPTY_CHARACTER);
      setEditingCharacterIndex(null);
      setStepSnapshots([null, null, null, null, null]);
      setHistoryStepSnapshots([null, null, null, null, null]);
      setStepUpdatedFlags([false, false, false, false, false]);
      if (storyAbortRef.current) {
        storyAbortRef.current.abort();
        storyAbortRef.current = null;
      }
      if (characterAbortRef.current) {
        characterAbortRef.current.abort();
        characterAbortRef.current = null;
      }
      if (outlineStreamAbortControllerRef.current) {
        outlineStreamAbortControllerRef.current.abort();
        outlineStreamAbortControllerRef.current = null;
      }
      clearStoryEditTimers();
      clearCharacterEditTimers();
    }
  }, [open, clearStoryEditTimers, clearCharacterEditTimers]);

  useEffect(() => {
    return () => {
      clearStoryEditTimers();
      clearCharacterEditTimers();
    };
  }, [clearStoryEditTimers, clearCharacterEditTimers]);

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        showCloseButton
        className={clsx(
          "flex max-h-[80vh] min-h-[728px] w-full max-w-[95vw] flex-col overflow-y-auto rounded-[10px] p-0 sm:w-[1020px] sm:max-w-[1020px]!",
          "left-1/2 top-[10vh] -translate-x-1/2 translate-y-0",
        )}
      >
        <VisuallyHidden>
          <DialogTitle>创建作品</DialogTitle>
        </VisuallyHidden>
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header：与 Vue 一致 - 绝对定位的返回/关闭 + 居中步骤条 */}
          <header className="relative flex w-full justify-center px-8 pt-8 pb-0">
            {stepActive !== 0 ? (
              <Button
                variant="ghost"
                size="icon-lg"
                type="button"
                onClick={handleBack}
                className="absolute left-6 top-5 flex h-8 w-8 cursor-pointer items-center justify-center rounded bg-transparent p-0 transition-colors hover:text-(--el-color-primary)"
                aria-label="返回"
              >
                <Iconfont
                  unicode="&#xe62a;"
                  className="text-lg text-(--el-text-color-secondary)"
                />
              </Button>
            ) : null}
            <div className="w-full max-w-[550px]">
              <CustomSteps
                active={stepActive}
                steps={steps}
                stepAccessible={stepAccessibleList}
                maxWidth={550}
                onStepClick={handleStepClick}
              />
            </div>
          </header>

          {/* Body：与 Vue dialog-body-wrapper + el-dialog__body 一致 */}
          <div className="relative h-full flex flex-1 flex-col items-center justify-center overflow-auto px-6 pb-3 pt-4">
            {stepActive === 0 && (
              <div className="step-content step-mode flex h-full flex-wrap items-center justify-center gap-6">
                {MODES.map((m) => (
                  <button
                    key={m.mode}
                    type="button"
                    onClick={() => handleModeClick(m.mode)}
                    className={clsx(
                      "mode-item flex h-[204px] w-[240px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 p-5 transition-colors",
                      selectedMode === m.mode
                        ? "border-(--theme-color)"
                        : "border-[#e6e6e5] hover:border-(--theme-color)",
                    )}
                  >
                    <div className="mode-cover h-[76px] w-full overflow-hidden rounded bg-white">
                      <img
                        src={m.cover}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="mode-title h-[26px] text-[22px] font-medium leading-none">
                      {m.title}
                    </div>
                    <div className="mode-desc text-xs text-[#9a9a9a]">
                      {m.desc}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {stepActive === 1 && selectedMode === "template" && (
              <div className="step-template step-content min-h-[540px]">
                <div className="pt-5 px-5 template-group grid grid-cols-2 gap-4 overflow-y-auto sm:grid-cols-4">
                  {templates.map((t) => (
                    <TemplateCardItem
                      tabIndex={0}
                      key={t.id}
                      data={t}
                      onClick={() => handleTemplateClick(t)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleTemplateClick(t);
                        }
                      }}
                      className={cn(
                        selectedTemplate?.id === t.id ? "border-2 border-(--theme-color)!" : "",
                      )}
                    />
                  ))}
                </div>
              </div>
            )}

            {stepActive === 1 && selectedMode === "custom" && (
              <div className="step-content step-custom min-h-[540px] w-full">
                <ScrollArea className="h-[540px] px-8">
                <form
                  className="flex flex-col gap-6 pb-4 px-4"
                  onSubmit={(e) => e.preventDefault()}
                >
                  <div>
                    <label className="mb-2 block text-xl text-gray-800">
                      提示词
                    </label>
                    <Input
                      className="w-full px-3 py-2 text-gray-500"
                      value={formModel.prompt}
                      disabled
                      readOnly
                    />
                  </div>
                  <div>
                    <FormRecommendLabel
                      label="核心梗"
                      required
                      recommends={toRecommendItems(recommendConfig.coreMeme)}
                      fieldKey="coreMeme"
                      onSelect={handleSelectRecommend}
                    />
                    <Textarea
                      className="mt-2 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-gray-800 placeholder:text-gray-400"
                      rows={2}
                      maxLength={200}
                      placeholder={
                        '请填写核心冲突，如"为救家族签下替身协议后，发现金主竟是幼时白月光本尊"'
                      }
                      value={formModel.coreMeme}
                      onChange={(e) =>
                        setFormModel((p) => ({
                          ...p,
                          coreMeme: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <FormRecommendLabel
                      label="故事背景"
                      required
                      recommends={toRecommendItems(recommendConfig.background)}
                      fieldKey="background"
                      onSelect={handleSelectRecommend}
                    />
                    <Textarea
                      className="mt-2 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-gray-800 placeholder:text-gray-400"
                      rows={2}
                      maxLength={200}
                      placeholder="请填写时代背景、故事场景、主要矛盾设定、金手指设定、故事发展阶段等信息"
                      value={formModel.background}
                      onChange={(e) =>
                        setFormModel((p) => ({
                          ...p,
                          background: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <FormRecommendLabel
                      label="主角人设"
                      required
                      recommends={toRecommendItems(recommendConfig.persona)}
                      fieldKey="persona"
                      onSelect={handleSelectRecommend}
                    />
                    <Input
                      className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-800 placeholder:text-gray-400"
                      maxLength={200}
                      placeholder="请填写男女主角年龄、性别、性格、目标和规划等信息"
                      value={formModel.persona}
                      onChange={(e) =>
                        setFormModel((p) => ({ ...p, persona: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <FormRecommendLabel
                      label="字数"
                      recommends={toRecommendItems(recommendConfig.wordCount)}
                      fieldKey="wordCount"
                      onSelect={handleSelectRecommend}
                    />
                    <Input
                      className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-800 placeholder:text-gray-400"
                      maxLength={10}
                      placeholder="选填，默认10000字左右短篇"
                      value={formModel.wordCount}
                      onChange={(e) =>
                        setFormModel((p) => ({
                          ...p,
                          wordCount: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <FormRecommendLabel
                      label="人称"
                      recommends={toRecommendItems(recommendConfig.perspective)}
                      fieldKey="perspective"
                      onSelect={handleSelectRecommend}
                    />
                    <Input
                      className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-800 placeholder:text-gray-400"
                      maxLength={10}
                      placeholder="选填，默认第一人称"
                      value={formModel.perspective}
                      onChange={(e) =>
                        setFormModel((p) => ({
                          ...p,
                          perspective: e.target.value,
                        }))
                      }
                    />
                  </div>
                </form>
                </ScrollArea>
              </div>
            )}

            {stepActive === 1 && selectedMode === "tag" && (
              <div className="step-content min-h-[540px] px-20">
                <TagSelector
                  categories={categories}
                  selectedTags={selectedTags}
                  updateTagCategories={updateTagCategories}
                  onSelectedTagsChange={handleSelectedTagsChange}
                  onCategoriesChange={handleTagCategoriesChange}
                />
              </div>
            )}

            {stepActive === 2 && (
              <div
                ref={storyStepRef}
                className="w-full story-step step-content relative flex min-h-[540px] flex-col justify-center gap-6"
              >
                <div
                  className={clsx(
                    "story-grid grid w-full grid-cols-3 gap-6 px-20 transition-opacity",
                    isStoryEditOpen && "pointer-events-none opacity-60",
                  )}
                >
                  {stories.map((s, i) => (
                    <div
                      key={i}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectStory(s)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleSelectStory(s);
                        }
                      }}
                      className={clsx(
                        "story-card group relative flex h-[310px] flex-col gap-3 overflow-hidden rounded-xl bg-[#f9eece] p-5 transition",
                        selectedStory === s
                          ? "outline-2 outline-(--theme-color)"
                          : "hover:outline-2 hover:outline-(--theme-color)",
                      )}
                    >
                      {!s.title && !s.intro ? (
                        <div className="mt-2 flex flex-col gap-3">
                          <Skeleton className="h-6 w-3/5 bg-gray-300" />
                          <Skeleton className="h-3 w-full bg-gray-200" />
                          <Skeleton className="h-3 w-full bg-gray-200" />
                          <Skeleton className="h-3 w-4/5 bg-gray-200" />
                        </div>
                      ) : (
                        <div className="flex flex-col h-full">
                          <button
                            type="button"
                            className="absolute cursor-pointer right-2 top-2 ml-auto text-lg leading-none opacity-0 transition-opacity hover:text-(--theme-color) group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditStory(s, i, e);
                            }}
                          >
                            <span className="iconfont">&#xea48;</span>
                          </button>
                          <div className="shrink-0 book-title mt-2 line-clamp-2 text-xl font-semibold leading-tight text-black">
                            书名: 《{s.title || "未命名"}》
                          </div>
                          <ScrollArea className="flex-1 min-h-0">
                            <MarkdownEditor
                              value={s.intro}
                              readonly
                              className="text-sm p-0!"
                            />
                          </ScrollArea>
                          {/* <div className="book-synopsis line-clamp-6 max-h-[220px] flex-1 overflow-hidden text-sm text-gray-700">
                            {s.intro}
                          </div> */}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="footer-actions flex flex-col items-center w-full justify-center">
                  <div className="text-xs text-gray-400">服务器火爆，预计等待时间30s</div>
                  <LinkButton
                    onClick={updateStories}
                    disabled={loading}
                    className={cn(
                      "mt-1 flex cursor-pointer items-center gap-2 text-gray-500 custom-btn disabled:cursor-not-allowed",
                    )}
                  >
                    <span
                      className={clsx("iconfont", loading && "animate-spin")}
                    >
                      &#xe66f;
                    </span>
                    <span>换一批</span>
                  </LinkButton>
                </div>
                <AnimatePresence>
                  {isStoryEditOpen && (
                    <motion.div
                      key="story-edit-panel"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className={clsx(
                        "absolute z-20 flex flex-col overflow-hidden rounded-[10px] border-2 border-[#ff9500] bg-[#fff8e5] transition-all duration-600",
                        isStoryEditAnimating && "duration-600",
                      )}
                      style={storyEditPanelStyle}
                    >
                      <div className="flex h-full flex-col overflow-y-auto px-[50px] pt-[30px]">
                        <div className="flex h-full flex-col gap-[22px]">
                          <div className="flex items-start gap-[50px]">
                            <div className="w-[124px] shrink-0 text-2xl leading-8 text-[#464646]">
                              书名：
                            </div>
                            <div className="relative min-w-0 flex-1">
                              <input
                                className="w-full rounded-md border-none bg-[#fff6d9] px-3 py-2 text-base shadow-none focus:outline-none"
                                maxLength={50}
                                value={editingStory.title}
                                onChange={(e) =>
                                  setEditingStory((prev) => ({
                                    ...prev,
                                    title: e.target.value,
                                  }))
                                }
                              />
                            </div>
                          </div>
                          <div className="flex items-start gap-[50px]">
                            <div className="w-[124px] shrink-0 text-2xl leading-8 text-[#464646]">
                              故事简介：
                            </div>
                            <ScrollArea className="relative min-w-0 h-full max-h-[240px]">
                              <MarkdownEditor
                                className="h-[260px] w-full resize-none rounded-md border-none bg-[#fff6d9] px-3 py-2 pr-[70px] text-base shadow-none focus:outline-none"
                                maxlength={MAX_INTRO_LENGTH}
                                value={editingStory.intro}
                                onChange={(e) =>
                                  setEditingStory((prev) => ({
                                    ...prev,
                                    intro: e,
                                  }))
                                }
                              />
                              <span className="absolute bottom-4 right-4 text-sm text-[#999]">
                                {(editingStory.intro || "").length}/
                                {MAX_INTRO_LENGTH}
                              </span>
                            </ScrollArea>
                          </div>
                          <div className="mt-4 flex justify-center gap-6">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={closeStoryEditPanel}
                            >
                              取消
                            </Button>
                            <Button type="button" onClick={handleSaveStoryEdit}>
                              确定
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {stepActive === 3 && (
              <div
                ref={characterStepRef}
                className="character-step w-full step-content relative flex min-h-[540px] flex-col justify-center gap-6"
              >
                <div
                  className={clsx(
                    "character-grid flex w-full justify-center gap-6 px-20 transition-opacity",
                    isCharacterEditOpen && "pointer-events-none opacity-60",
                  )}
                >
                  {characters.map((c, i) => (
                    <div
                      key={`${c.name}-${c.mbti}-${i}`}
                      className={clsx(
                        "character-card cursor-pointer rounded-[10px] hover:outline-2 outline-(--theme-color)",
                        selectedCharacter === c && "outline-2",
                      )}
                    >
                      <CharacterCard
                        data={c}
                        loading={loading}
                        onClick={() => handleCharacterClick(c)}
                        onEdit={(data, event) =>
                          handleEditCharacter(data, i, event)
                        }
                      />
                    </div>
                  ))}
                </div>
                <div className="footer-actions flex w-full justify-center">
                  <LinkButton
                    role="button"
                    tabIndex={0}
                    onClick={loading ? undefined : updateCharacters}
                    onKeyDown={(e) => {
                      if (!loading && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        updateCharacters();
                      }
                    }}
                    disabled={loading}
                    className={clsx("flex items-center gap-2 text-gray-500")}
                  >
                    <span
                      className={clsx("iconfont", loading && "animate-spin")}
                    >
                      &#xe66f;
                    </span>
                    <span>换一批</span>
                  </LinkButton>
                </div>
                <AnimatePresence>
                  {isCharacterEditOpen && (
                    <motion.div
                      key="character-edit-panel"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className={clsx(
                        "absolute z-20 flex flex-col overflow-hidden rounded-[10px] border-2 border-[#ff9500] bg-[#fff8e5] p-6 transition-all duration-600",
                        isCharacterEditAnimating && "duration-600",
                      )}
                      style={characterEditPanelStyle}
                    >
                      <img
                        src={editingCharacter.gender == "女" ? FEMALE : MALE}
                        alt=""
                        className='absolute rounded-[10px] w-40 h-auto bottom-0 right-10'
                      />
                      <div className="grid grid-cols-2 gap-4 overflow-y-auto relative">

                        <div>
                          <label className="mb-2 block text-xl text-gray-700">
                            角色名
                          </label>
                          <input
                            className="w-full rounded-md border-none bg-[#fff6d999] px-3 py-2 focus:outline-none focus:ring-0 focus-visible:outline-none"
                            maxLength={5}
                            value={editingCharacter.name}
                            onChange={(e) =>
                              setEditingCharacter((prev) => ({
                                ...prev,
                                name: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-xl text-gray-700">
                            性别
                          </label>
                          <select
                            className="w-full rounded-md border-none bg-[#fff6d999] px-3 py-2 focus:outline-none focus:ring-0 focus-visible:outline-none"
                            value={editingCharacter.gender}
                            onChange={(e) =>
                              setEditingCharacter((prev) => ({
                                ...prev,
                                gender: e.target.value,
                              }))
                            }
                          >
                            <option value="">请选择</option>
                            <option value="男">男</option>
                            <option value="女">女</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-2 block text-xl text-gray-700">
                            人物标签
                          </label>
                          <input
                            className="w-full rounded-md border-none bg-[#fff6d999] px-3 py-2 focus:outline-none focus:ring-0 focus-visible:outline-none"
                            maxLength={100}
                            value={editingCharacter.abilities}
                            onChange={(e) =>
                              setEditingCharacter((prev) => ({
                                ...prev,
                                abilities: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-xl text-gray-700">
                            人物身份
                          </label>
                          <input
                            className="w-full rounded-md border-none bg-[#fff6d999] px-3 py-2 focus:outline-none focus:ring-0 focus-visible:outline-none"
                            maxLength={50}
                            value={editingCharacter.identity}
                            onChange={(e) =>
                              setEditingCharacter((prev) => ({
                                ...prev,
                                identity: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="mb-2 block text-xl text-gray-700">
                            人物小传
                          </label>
                          <textarea
                            className="h-32 w-full resize-none rounded-md border-none bg-[#fff6d999] px-3 py-2 focus:outline-none focus:ring-0 focus-visible:outline-none"
                            maxLength={300}
                            value={editingCharacter.experiences}
                            onChange={(e) =>
                              setEditingCharacter((prev) => ({
                                ...prev,
                                experiences: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="mt-5 flex justify-center gap-6">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={closeCharacterEditPanel}
                        >
                          取消
                        </Button>
                        <Button type="button" onClick={handleSaveCharacterEdit}>
                          确定
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {stepActive === 4 && (
              <div className="step-outline w-full step-content min-h-[540px] px-15 pt-6 flex flex-col">
                <div
                  className={clsx(
                    "editor-layout rounded-lg bg-[#f9eece] p-2 flex-1",
                    isOutlineEditing && "outline-2 outline-[#ce644c]",
                  )}
                >
                  <div className="header px-2 text-3xl font-semibold leading-10 text-black">
                    大纲
                  </div>
                  <AutoScrollArea
                    className="markdown-editor-scrollbar max-h-[420px] overflow-y-auto"
                    maxHeight={420}
                  >
                    <MarkdownEditor
                      value={outlineContent}
                      onChange={setOutlineContent}
                      readonly={!isOutlineEditing || loading}
                      placeholder="正在生成大纲…"
                    />
                  </AutoScrollArea>
                </div>
                <div className="footer-actions mt-4 flex h-8 w-full justify-center gap-4">
                  <LinkButton
                    tabIndex={0}
                    onClick={loading ? undefined : updateOutlineStream}
                    onKeyDown={(e) => {
                      if (!loading && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        updateOutlineStream();
                      }
                    }}
                    disabled={loading}
                    className="flex cursor-pointer items-center gap-2 text-gray-500"
                  >
                    <span
                      className={clsx("iconfont", loading && "animate-spin")}
                    >
                      &#xe66f;
                    </span>
                    <span>重新生成</span>
                  </LinkButton>
                  <LinkButton
                    tabIndex={0}
                    onClick={
                      loading ? undefined : () => setIsOutlineEditing((v) => !v)
                    }
                    onKeyDown={(e) => {
                      if (!loading && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        setIsOutlineEditing((v) => !v);
                      }
                    }}
                    disabled={loading}
                    className="flex cursor-pointer items-center gap-2 text-gray-500"
                  >
                    <span className="iconfont">&#xea48;</span>
                    <span>{isOutlineEditing ? "完成编辑" : "编辑"}</span>
                  </LinkButton>
                </div>
              </div>
            )}
          </div>

          {/* Footer：与 Vue 一致 - 退出 + 下一步/保存至作品 */}
          <footer className="flex flex-row-reverse items-center gap-3 px-12 py-4">
            <Button
              role="button"
              onClick={nextStepAble ? handleNextStepConfirm : undefined}
              disabled={!nextStepAble}
              onKeyDown={(e) => {
                if (nextStepAble && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  handleNextStepConfirm();
                }
              }}
            >
              {stepActive === 4 ? "保存至作品" : "下一步"}
            </Button>
            <Button
              variant="outline"
              role="button"
              onClick={handleClose}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleClose();
                }
              }}
            >
              退出
            </Button>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
});
