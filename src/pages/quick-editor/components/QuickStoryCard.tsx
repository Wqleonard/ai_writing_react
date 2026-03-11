import { memo, useMemo } from "react";
import { toast } from "sonner";
import { addNote } from "@/api/notes";
import { Iconfont } from "@/components/Iconfont";
import { LinkButton } from "@/components/ui/LinkButton";

export interface QuickStoryCardData {
  title: string;
  intro: string;
  theme: string;
  tags?: string[];
  conflictLevel?: string;
  emotionIndex?: string;
  coverImage?: string;
}

type Props = {
  data?: QuickStoryCardData;
  showEdit?: boolean;
  isCustom?: boolean;
  loading?: boolean;
  isSelected?: boolean;
  onClick?: (event?: React.MouseEvent) => void;
  onEdit?: (event: React.MouseEvent) => void;
};

const DEFAULT_TAGS = ["#电竞", "#搞笑", "#系统"];
const DEFAULT_CONFLICT = "极高";

const SkeletonBlock = () => (
  <div className="animate-pulse">
    <div className="mb-[25px] h-[120px] rounded bg-[#f0f0f0]" />
    <div className="mb-[25px] h-[120px] rounded bg-[#f0f0f0]" />
    <div className="mb-[25px] h-[28px] rounded bg-[#f0f0f0]" />
    <div className="h-[55px] rounded bg-[#f0f0f0]" />
  </div>
);

const QuickStoryCard = ({
  data,
  showEdit = false,
  isCustom = false,
  loading = false,
  isSelected = false,
  onClick,
  onEdit,
}: Props) => {
  const tags = useMemo(() => data?.tags?.length ? data.tags : DEFAULT_TAGS, [data?.tags]);
  const handleCardClick = (event?: React.MouseEvent) => {
    if (isSelected && showEdit && !isCustom) {
      if (event && onEdit) onEdit(event);
      return;
    }
    onClick?.(event);
  };

  const handleAddNote = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!data?.title || !data?.intro) {
      toast.warning("故事内容不完整，无法添加笔记");
      return;
    }
    try {
      await addNote(data.title, data.intro, "PC_ADD");
      toast.success("笔记添加成功");
    } catch (error) {
      console.error("添加笔记失败:", error);
      toast.error("添加笔记失败，请重试");
    }
  };

  if (isCustom) {
    return (
      <div
        className="flex h-full min-h-[400px] w-full cursor-pointer flex-col items-center justify-center rounded-[10px] border-[2.568px] border-dashed border-[#d9d9d9] bg-transparent p-[clamp(15px,1.5vw,23px)] shadow-[0_0_25.68px_0_rgba(58,37,0,0.15)] transition hover:border-(--theme-color)"
        onClick={handleCardClick}
      >
        <div className="text-center text-[clamp(20px,3.5vw,42px)] leading-[1.32em] font-bold tracking-[0.04em] text-[#d9d9d9]">
          自定义故事
        </div>
        <div className="mt-6 mb-[30px] flex items-center justify-center">
          <div className="relative h-[113.42px] w-[113.42px] rounded-full border-[7.29px] border-[#c8c8c8]">
            <div className="absolute top-1/2 left-1/2 h-0 w-[45.51px] -translate-x-1/2 border-t-[7.29px] border-[#c8c8c8]" />
            <div className="absolute top-1/2 left-1/2 h-[45.51px] w-0 -translate-y-1/2 border-l-[7.29px] border-[#c8c8c8]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-110 w-full cursor-pointer flex-col overflow-hidden rounded-[10px] bg-[#fff8e5] p-[clamp(15px,1.5vw,23px)] shadow-[0_0_20px_0_rgba(58,37,0,0.15)]"
      onClick={handleCardClick}
    >
      {loading || !data?.title ? (
        <SkeletonBlock />
      ) : (
        <div className="flex h-full min-h-0 flex-col">
          <div className="mb-0.5 flex h-[21px] shrink-0 items-start justify-end gap-3">
            <LinkButton
              className="flex items-center gap-1 text-base text-[#999]"
              onClick={handleAddNote}
            >
              <Iconfont unicode="&#xe64c;" />
              <span>添加笔记</span>
            </LinkButton>
            {showEdit && (
              <LinkButton
                className="flex items-center gap-1 text-base text-[#999]"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.(e);
                }}
              >
                <Iconfont unicode="&#xea48;" />
                <span>编辑</span>
              </LinkButton>
            )}
          </div>

          <div className="relative mb-[clamp(10px,1.5vh,15px)] h-[clamp(90px,12vh,120px)] shrink-0">
            <div className="h-full w-[clamp(70px,9vw,89px)] overflow-hidden rounded-[5px] bg-white shadow-[0_1px_4px_2px_rgba(0,0,0,0.15)]">
              <div className="flex h-full w-full items-center justify-center text-[10px] text-[#999]">封面</div>
            </div>
            <div className="absolute top-[clamp(10px,1.5vh,15px)] right-0 left-[clamp(85px,10vw,104px)] line-clamp-3 text-[clamp(16px,1.5vw,22px)] leading-[1.32em] font-bold tracking-[0.04em] wrap-break-word text-[#464646]">
              《{data.title}》
            </div>
          </div>

          <div className="mb-[clamp(10px,1.5vh,15px)] min-h-[clamp(60px,8vh,100px)] max-h-[clamp(120px,15vh,180px)] flex-1 overflow-y-auto overflow-x-hidden">
            <div className="text-[clamp(14px,1.3vw,18px)] leading-[1.5em] wrap-break-word text-[#464646]">
              梗概：{data.intro}
            </div>
          </div>

          <div className="relative mb-[clamp(8px,1vh,12px)] ml-[-5px] flex shrink-0 flex-nowrap overflow-hidden pr-10">
            {tags.map((tag, index) => (
              <div
                key={`${tag}-${index}`}
                className="ml-[5px] shrink-0 whitespace-nowrap rounded-[21px] bg-[rgba(226,226,226,0.5)] px-[clamp(8px,0.8vw,12px)] py-[clamp(4px,0.5vh,6px)] text-[clamp(11px,1vw,14px)] leading-[1.32em] tracking-[0.04em] text-[#4d4d4d]"
              >
                {tag}
              </div>
            ))}
          </div>

          <div className="mt-auto flex min-h-[clamp(50px,6vh,70px)] shrink-0 items-center">
            <div className="flex flex-col items-start gap-[clamp(4px,0.7vh,7px)]">
              <div className="flex items-center">
                <span className="mr-[clamp(4px,0.6vw,7px)] text-[14px]">⚡</span>
                <span className="text-[clamp(12px,1.2vw,16px)] leading-[1.5em] text-[#999]">
                  剧情冲突：{data.conflictLevel || DEFAULT_CONFLICT}
                </span>
              </div>
              <div className="flex items-center">
                <span className="mr-[clamp(4px,0.6vw,7px)] text-[14px]">♥</span>
                <span className="text-[clamp(12px,1.2vw,16px)] leading-[1.5em] text-[#999]">情感指数：</span>
                <div className="ml-1 flex items-center gap-[clamp(3px,0.5vw,6.26px)]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className="text-[14px] text-[#f2b200]">★</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(QuickStoryCard);
