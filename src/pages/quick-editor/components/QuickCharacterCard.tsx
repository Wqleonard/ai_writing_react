import { memo } from "react";
import { toast } from "sonner";
import { addNote } from "@/api/notes";

export interface QuickCharacterCardData {
  name: string;
  gender: string;
  age: string;
  bloodType: string;
  mbti: string;
  experiences: string;
  personality: string;
  abilities: string;
  identity: string;
}

type Props = {
  data?: QuickCharacterCardData;
  showEdit?: boolean;
  isCustom?: boolean;
  loading?: boolean;
  isSelected?: boolean;
  onClick?: (event?: React.MouseEvent) => void;
  onEdit?: (event: React.MouseEvent) => void;
};

const QuickCharacterCard = ({
  data,
  showEdit = false,
  isCustom = false,
  loading = false,
  isSelected = false,
  onClick,
  onEdit,
}: Props) => {
  const handleClick = (event?: React.MouseEvent) => {
    if (isSelected && showEdit && !isCustom) {
      if (event) onEdit?.(event);
      return;
    }
    onClick?.(event);
  };

  const handleAddNote = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!data?.name) {
      toast.warning("角色信息不完整，无法添加笔记");
      return;
    }

    const contentParts: string[] = [];
    const tagParts: string[] = [];
    if (data.gender) tagParts.push(data.gender);
    if (data.age) tagParts.push(data.age);
    if (data.mbti) tagParts.push(data.mbti);
    if (tagParts.length > 0) contentParts.push(tagParts.join("、"));
    if (data.abilities) contentParts.push(data.abilities);
    if (data.experiences) contentParts.push(data.experiences);
    if (data.identity) contentParts.push(`身份：${data.identity}`);
    const content = contentParts.join("\n\n");
    if (!content) {
      toast.warning("角色内容为空，无法添加笔记");
      return;
    }

    try {
      await addNote(data.name, content, "PC_ADD");
      toast.success("笔记添加成功");
    } catch (error) {
      console.error("添加笔记失败:", error);
      toast.error("添加笔记失败，请重试");
    }
  };

  if (isCustom) {
    return (
      <div
        className="flex h-full w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[12.84px] border-[2.568px] border-dashed border-[#d9d9d9] bg-transparent shadow-[0_0_25.68px_0_rgba(58,37,0,0.15)] transition hover:border-(--theme-color)"
        onClick={handleClick}
      >
        <div className="mb-[clamp(25px,3vh,38.52px)] px-2 text-center text-[clamp(20px,3.5vw,42px)] leading-[1.32em] font-bold tracking-[0.04em] text-[#d9d9d9]">
          自定义角色
        </div>
        <div className="mb-[clamp(30px,4vh,50px)] flex h-[clamp(80px,9vw,113.42px)] w-[clamp(80px,9vw,113.42px)] items-center justify-center">
          <div className="relative h-full w-full rounded-full border-[clamp(5px,0.6vw,7.29px)] border-[#c8c8c8]">
            <div className="absolute top-1/2 left-1/2 h-0 w-[40%] -translate-x-1/2 border-t-[clamp(5px,0.6vw,7.29px)] border-[#c8c8c8]" />
            <div className="absolute top-1/2 left-1/2 h-[40%] w-0 -translate-y-1/2 border-l-[clamp(5px,0.6vw,7.29px)] border-[#c8c8c8]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-[10px] bg-[#fff8e5] p-[clamp(18px,1.8vw,26px)] shadow-[0_0_20px_0_rgba(58,37,0,0.15)]"
      onClick={handleClick}
    >
      {loading || !data?.name ? (
        <div className="animate-pulse">
          <div className="mb-[25px] h-[42px] rounded bg-[#f0f0f0]" />
          <div className="mb-[25px] h-[28px] rounded bg-[#f0f0f0]" />
          <div className="mb-[25px] h-[90px] rounded bg-[#f0f0f0]" />
          <div className="h-[40px] rounded bg-[#f0f0f0]" />
        </div>
      ) : (
        <>
          <div className="absolute right-[-23px] bottom-[-23px] z-0 h-[234px] w-[222.3px] opacity-15">
            <div className="flex h-full w-full items-end justify-center text-[140px]">
              {data.gender === "女" ? "♀" : "♂"}
            </div>
          </div>
          <div className="relative z-1 flex h-full flex-col">
            <div className="mb-[clamp(15px,2vh,25px)] flex min-w-0 shrink-0 items-center justify-between">
              <div className="truncate text-[clamp(22px,2.8vw,24px)] leading-[1.32em] font-bold tracking-[0.04em] text-[#464646]">
                {data.name}
              </div>
              <div className="ml-2 flex items-center gap-3">
                <button
                  className="text-[clamp(12px,1.2vw,16px)] leading-[1.32em] tracking-[0.04em] whitespace-nowrap text-[#999] hover:text-(--bg-editor-save)"
                  onClick={handleAddNote}
                >
                  添加笔记
                </button>
                {showEdit && (
                  <button
                    className="flex items-center whitespace-nowrap text-[clamp(12px,1.2vw,16px)] leading-[1.32em] tracking-[0.04em] text-[#999] hover:text-(--bg-editor-save)"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit?.(e);
                    }}
                  >
                    <span className="mr-1 text-[clamp(14px,1.5vw,18.56px)]">✎</span>编辑
                  </button>
                )}
              </div>
            </div>

            <div className="mt-[-5px] mb-[clamp(18px,2.2vh,28px)] ml-[-5px] flex shrink-0 flex-wrap">
              {data.gender ? <div className="ml-[5px] mt-[5px] rounded-[21px] bg-[rgba(239,175,0,0.2)] px-[clamp(10px,1.2vw,14px)] py-[clamp(5px,0.6vh,7px)] text-[clamp(12px,1.1vw,14px)] text-[#4d4d4d]">{data.gender}</div> : null}
              {data.age ? <div className="ml-[5px] mt-[5px] rounded-[21px] bg-[rgba(239,175,0,0.2)] px-[clamp(10px,1.2vw,14px)] py-[clamp(5px,0.6vh,7px)] text-[clamp(12px,1.1vw,14px)] text-[#4d4d4d]">{data.age}</div> : null}
              {data.bloodType ? <div className="ml-[5px] mt-[5px] rounded-[21px] bg-[rgba(239,175,0,0.2)] px-[clamp(10px,1.2vw,14px)] py-[clamp(5px,0.6vh,7px)] text-[clamp(12px,1.1vw,14px)] text-[#4d4d4d]">{data.bloodType}</div> : null}
              {data.mbti ? <div className="ml-[5px] mt-[5px] rounded-[21px] bg-[rgba(239,175,0,0.2)] px-[clamp(10px,1.2vw,14px)] py-[clamp(5px,0.6vh,7px)] text-[clamp(12px,1.1vw,14px)] text-[#4d4d4d]">{data.mbti}</div> : null}
            </div>

            <div className="mb-[clamp(18px,2.2vh,28px)] min-h-[clamp(140px,18vh,220px)] flex-1 overflow-y-auto text-[clamp(14px,1.3vw,17px)] leading-[1.5em] text-[#464646]">
              {data.abilities ? <div className="mb-[clamp(14px,1.7vh,18px)] wrap-break-word">{data.abilities}</div> : null}
              {data.experiences ? <div className="wrap-break-word">{data.experiences}</div> : null}
            </div>

            <div className="shrink-0">
              <div className="mb-[clamp(4px,0.5vh,6px)] text-[clamp(14px,1.3vw,17px)] text-[#464646]">身份</div>
              <div className="mb-[clamp(4px,0.5vh,6px)] h-px w-[clamp(100px,11vw,130px)] bg-linear-to-r from-[#dedede] to-transparent" />
              <div className="max-w-[clamp(180px,20vw,240px)] text-[clamp(13px,1.2vw,15px)] leading-[1.32em] text-[#9a9a9a]">
                {data.identity}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default memo(QuickCharacterCard);
