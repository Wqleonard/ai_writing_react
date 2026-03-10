import { addNote, type NoteSourceType } from "@/api/notes";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "sonner";
import EditIcon from "@/assets/images/quick_creation/edit.svg";
import PlotConflictIcon from "@/assets/images/quick_creation/plot_conflict.svg";
import EmotionalHeartIcon from "@/assets/images/quick_creation/emotional_heart.svg";
import StarIcon from "@/assets/images/quick_creation/star.svg";

export interface QuickStoryCardData {
  title: string;
  intro: string;
  theme: string;
  tags?: string[];
  conflictLevel?: string;
  emotionIndex?: string;
  coverImage?: string;
}

export interface ScriptStoryCardProps {
  data?: QuickStoryCardData;
  showEdit?: boolean;
  isCustom?: boolean;
  loading?: boolean;
  isSelected?: boolean;
  onClick?: (event?: React.MouseEvent<HTMLDivElement>) => void;
  onEdit?: (event: React.MouseEvent) => void;
}

const defaultTags = ["#电竞", "#搞笑", "#系统"];
const defaultConflictLevel = "极高";

export const ScriptStoryCard = ({
  data,
  showEdit = false,
  isCustom = false,
  loading = false,
  isSelected = false,
  onClick,
  onEdit,
}: ScriptStoryCardProps) => {
  const handleClick = (event?: React.MouseEvent<HTMLDivElement>) => {
    if (isSelected && showEdit && !isCustom) {
      if (event) onEdit?.(event);
      return;
    }
    onClick?.(event);
  };

  const handleAddNote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data?.title || !data?.intro) {
      toast.warning("故事内容不完整，无法添加笔记");
      return;
    }
    try {
      await addNote(data.title, data.intro, "PC_ADD" as NoteSourceType);
      toast.success("笔记添加成功");
    } catch (error) {
      console.error("添加笔记失败:", error);
      toast.error("添加笔记失败，请重试");
    }
  };

  if (isCustom) {
    return (
      <div
        role="button"
        className="flex h-full min-h-[400px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-[10px] border-2 border-dashed border-[#d9d9d9] bg-transparent p-4 shadow-[0_0_25px_0_rgba(58,37,0,0.15)] transition-colors hover:border-(--theme-color)"
        onClick={handleClick}
      >
        <div className="flex flex-col items-center justify-center gap-10 py-10">
          <div className="px-2 text-center text-[clamp(20px,3.5vw,42px)] font-bold leading-[1.32] tracking-[0.04em] text-[#d9d9d9]">
            自定义故事
          </div>
          <div className="mb-8 flex items-center justify-center p-3">
            <div className="relative h-[110px] w-[110px] rounded-full border-[7px] border-[#c8c8c8]">
              <div className="absolute top-1/2 left-1/2 h-[7px] w-[46px] -translate-x-1/2 -translate-y-1/2 bg-[#c8c8c8]" />
              <div className="absolute top-1/2 left-1/2 h-[46px] w-[7px] -translate-x-1/2 -translate-y-1/2 bg-[#c8c8c8]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !data?.title) {
    return (
      <div className="flex h-full min-h-[400px] w-full flex-col gap-6 overflow-hidden rounded-[10px] bg-[#fff8e5] p-6 shadow-[0_0_20px_0_rgba(58,37,0,0.15)]">
        <Skeleton className="h-[120px] w-full" />
        <Skeleton className="h-[120px] w-full" />
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-[55px] w-full" />
      </div>
    );
  }

  const tags = data.tags?.length ? data.tags : defaultTags;
  const coverUrl = data.coverImage?.trim();

  return (
    <div
      role="button"
      className="flex h-full min-h-[400px] w-full cursor-pointer flex-col overflow-hidden rounded-[10px] bg-[#fff8e5] p-6 shadow-[0_0_20px_0_rgba(58,37,0,0.15)]"
      onClick={handleClick}
    >
      <div className="mb-1 flex h-[21px] w-full shrink-0 items-start justify-end gap-3">
        <Button
          type="button"
          variant="quick-ghost"
          size="xs"
          className="h-auto p-0 text-base text-[#999999] hover:text-(--theme-color)"
          onClick={handleAddNote}
        >
          添加笔记
        </Button>
        {showEdit ? (
          <Button
            type="button"
            variant="quick-ghost"
            size="xs"
            className="h-auto p-0 text-base text-[#999999] hover:text-(--theme-color)"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(e);
            }}
          >
            <img src={EditIcon} alt="编辑" className="h-5 w-5" />
            <span className="ml-1">编辑</span>
          </Button>
        ) : null}
      </div>

      <div className="relative mb-3 flex h-[clamp(90px,12vh,120px)] w-full shrink-0 items-start">
        <div className="h-full w-[clamp(70px,9vw,89px)] shrink-0 overflow-hidden rounded-[5px] shadow-[0_1px_4px_2px_rgba(0,0,0,0.15)]">
          {coverUrl ? (
            <img src={coverUrl} alt="封面" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-[#ffe5b0] to-[#ffcc80] text-xs text-[#7a4a00]">
              封面
            </div>
          )}
        </div>
        <div className="absolute top-[clamp(10px,1.5vh,15px)] left-[clamp(85px,10vw,104px)] right-0 line-clamp-3 max-h-full overflow-hidden text-[clamp(16px,1.5vw,22px)] font-bold leading-[1.32] tracking-[0.04em] text-[#464646]">
          《{data.title}》
        </div>
      </div>

      <div className="mb-3 min-h-[clamp(60px,8vh,100px)] max-h-[clamp(120px,15vh,180px)] flex-1 overflow-y-auto overflow-x-hidden">
        <div className="w-full break-words text-justify text-[clamp(14px,1.3vw,18px)] font-normal leading-[1.5] text-[#464646]">
          梗概：{data.intro}
        </div>
      </div>

      <div className="relative mb-3 ml-[-5px] flex w-full shrink-0 flex-nowrap overflow-hidden">
        {tags.map((tag, index) => (
          <div
            key={`${tag}-${index}`}
            className="ml-[5px] shrink-0 whitespace-nowrap rounded-[21px] bg-[rgba(226,226,226,0.5)] px-[clamp(8px,0.8vw,12px)] py-[clamp(4px,0.5vh,6px)] text-[clamp(11px,1vw,14px)] leading-[1.32] tracking-[0.04em] text-[#4d4d4d]"
          >
            {tag}
          </div>
        ))}
        <div className="pointer-events-none absolute top-1/2 right-0 min-w-[50px] -translate-y-1/2 bg-[linear-gradient(to_right,rgba(255,248,229,0)_0%,rgba(255,248,229,0.8)_40%,rgba(255,248,229,1)_60%,rgba(255,248,229,1)_100%)] px-2 py-[6px] text-right text-[clamp(12px,1vw,14px)] leading-[1.32] text-[#4d4d4d]">
          ...
        </div>
      </div>

      <div className="mt-auto flex w-full min-h-[clamp(50px,6vh,70px)] shrink-0 items-center justify-between">
        <div className="flex flex-col items-start gap-[clamp(4px,0.7vh,7px)]">
          <div className="flex items-center">
            <div className="mr-[clamp(4px,0.6vw,7px)] flex items-center justify-center">
              <img src={PlotConflictIcon} alt="剧情冲突" className="h-[clamp(12px,1.3vw,16px)] w-[clamp(12px,1.3vw,16px)]" />
            </div>
            <div className="whitespace-nowrap text-[clamp(12px,1.2vw,16px)] leading-[1.5] text-[#999999]">
              剧情冲突：{data.conflictLevel || defaultConflictLevel}
            </div>
          </div>
          <div className="flex items-center">
            <div className="mr-[clamp(4px,0.6vw,7px)] flex items-center justify-center">
              <img src={EmotionalHeartIcon} alt="情感指数" className="h-[clamp(9px,1vw,12px)] w-[clamp(11px,1.2vw,14px)]" />
            </div>
            <div className="whitespace-nowrap text-[clamp(12px,1.2vw,16px)] leading-[1.5] text-[#999999]">
              情感指数：
            </div>
            <div className="ml-0 flex items-center gap-[clamp(3px,0.5vw,6px)]">
              {Array.from({ length: 5 }).map((_, i) => (
                <img
                  key={i}
                  src={StarIcon}
                  alt="星"
                  className="h-[clamp(13px,1.4vw,17px)] w-[clamp(14px,1.5vw,18px)] shrink-0"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
