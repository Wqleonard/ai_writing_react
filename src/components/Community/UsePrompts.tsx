import React, { useCallback, useState } from "react";
import type { PromptItem } from "./types";
import { PromptsDetailDialog } from "./PromptsDetailDialog";
import { PromptsMarketDialog } from "./PromptsMarketDialog";
import { PublicGenerateDialog } from "./PublicGenerateDialog";
import { IntroductionGenerateDialog } from "./IntroductionGenerateDialog";
import { OutlineGenerateDialog } from "./OutlineGenerateDialog";
import { CharacterGenerateDialog } from "./CharacterGenerateDialog";
import { WorldGenerateDialog } from "./WorldGenerateDialog";
import { ChapterGenerateDialog } from "./ChapterGenerateDialog";

export interface UsePromptsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: PromptItem | null;
  openMarketDirectly?: boolean;
}

export const UsePrompts = ({ open, onOpenChange, data, openMarketDirectly }: UsePromptsProps) => {
  const [promptData, setPromptData] = useState<PromptItem | null>(data ?? null);
  const [marketDialogShow, setMarketDialogShow] = useState(false);
  const [publicGenerateDialogShow, setPublicGenerateDialogShow] = useState(false);
  const [officialIntroductionDialogShow, setOfficialIntroductionDialogShow] = useState(false);
  const [officialOutlineDialogShow, setOfficialOutlineDialogShow] = useState(false);
  const [officialCharacterDialogShow, setOfficialCharacterDialogShow] = useState(false);
  const [officialWorldDialogShow, setOfficialWorldDialogShow] = useState(false);
  const [officialChapterDialogShow, setOfficialChapterDialogShow] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");

  React.useEffect(() => {
    setPromptData(data ?? null);
  }, [data]);

  React.useEffect(() => {
    if (open && openMarketDirectly) {
      setMarketDialogShow(true);
      onOpenChange(false);
    }
  }, [open, openMarketDirectly, onOpenChange]);

  const handleDetailUse = useCallback(
    (item: PromptItem | null) => {
      if (!promptData?.isOfficial) {
        onOpenChange(false);
        setPublicGenerateDialogShow(true);
        setPromptData(item ?? promptData);
        return;
      }
      const categoryId = promptData?.categories?.[0]?.id?.toString() ?? "";
      const validIds = ["1", "2", "3", "4", "5"];
      if (!validIds.includes(categoryId)) {
        return;
      }
      onOpenChange(false);
      setSelectedPrompt(item ?? promptData);
      switch (categoryId) {
        case "1":
          setOfficialIntroductionDialogShow(true);
          break;
        case "2":
          setOfficialOutlineDialogShow(true);
          break;
        case "3":
          setOfficialCharacterDialogShow(true);
          break;
        case "4":
          setOfficialWorldDialogShow(true);
          break;
        case "5":
          setOfficialChapterDialogShow(true);
          break;
      }
    },
    [promptData, onOpenChange]
  );

  const handleOpenMarket = useCallback((prompt: PromptItem | null) => {
    setMarketDialogShow(true);
    setSelectedPrompt(prompt);
    if (prompt?.categories?.[0]?.id != null) {
      setSelectedCategory(String(prompt.categories[0].id));
    }
  }, []);

  const handleMarketPromptUse = useCallback((prompt: PromptItem | null) => {
    setPromptData(prompt);
    setMarketDialogShow(false);
    setPublicGenerateDialogShow(false);
    onOpenChange(true);
  }, [onOpenChange]);

  return (
    <>
      <PromptsDetailDialog open={open} onOpenChange={onOpenChange} data={promptData} onUse={handleDetailUse} />
      <PromptsMarketDialog
        open={marketDialogShow}
        onClose={() => setMarketDialogShow(false)}
        selectedCategory={selectedCategory}
        onSelectedCategoryChange={setSelectedCategory}
        onUse={handleMarketPromptUse}
      />
      <PublicGenerateDialog
        open={publicGenerateDialogShow}
        onOpenChange={setPublicGenerateDialogShow}
        data={promptData}
        onOpenMarket={handleOpenMarket}
      />
      <IntroductionGenerateDialog
        open={officialIntroductionDialogShow}
        onOpenChange={setOfficialIntroductionDialogShow}
        promptData={selectedPrompt}
        onOpenMarket={handleOpenMarket}
      />
      <OutlineGenerateDialog
        open={officialOutlineDialogShow}
        onOpenChange={setOfficialOutlineDialogShow}
        promptData={selectedPrompt}
        onOpenMarket={handleOpenMarket}
      />
      <CharacterGenerateDialog
        open={officialCharacterDialogShow}
        onOpenChange={setOfficialCharacterDialogShow}
        promptData={selectedPrompt}
        onOpenMarket={handleOpenMarket}
      />
      <WorldGenerateDialog
        open={officialWorldDialogShow}
        onOpenChange={setOfficialWorldDialogShow}
        promptData={selectedPrompt}
        onOpenMarket={handleOpenMarket}
      />
      <ChapterGenerateDialog
        open={officialChapterDialogShow}
        onOpenChange={setOfficialChapterDialogShow}
        promptData={selectedPrompt}
        onOpenMarket={handleOpenMarket}
      />
    </>
  );
};
