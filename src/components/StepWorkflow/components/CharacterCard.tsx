"use client"

import React from "react"
import { Skeleton } from "@/components/ui/Skeleton"
import FEMALE from '@/assets/images/character_card/female.png'
import MALE from '@/assets/images/character_card/male.png'

export interface CharacterCardData {
  name: string
  gender: string
  age: string
  bloodType: string
  mbti: string
  experiences: string
  personality: string
  abilities: string
  identity: string
  biograph: string
}

export interface CharacterCardProps {
  data: CharacterCardData
  loading?: boolean
  /** 点击卡片选中 */
  onClick?: () => void
  onEdit?: (data: CharacterCardData, event: React.MouseEvent) => void
}

export const CharacterCard = ({
  data,
  loading = false,
  onClick,
  onEdit,
}: CharacterCardProps) => {
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit?.(data, e)
  }

  if (loading) {
    return (
      <div className="h-[310px] w-[230px] rounded-[10px] bg-[#f9eece] p-2 px-3.5">
        <Skeleton className="mt-3.5 h-[72px]" />
        <Skeleton className="mt-2 h-8 w-full" />
        <Skeleton className="mt-2 h-8 w-4/5" />
      </div>
    )
  }

  if (!data.name) {
    return (
      <div className="h-[310px] w-[230px] rounded-[10px] bg-[#f9eece] p-2 px-3.5">
        <Skeleton className="mt-3.5 h-[72px]" />
        <Skeleton className="mt-2 h-8 w-full" />
        <Skeleton className="mt-2 h-8 w-4/5" />
      </div>
    )
  }

  const imgSrc = data.gender === "女" ? FEMALE : MALE

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick?.()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick?.()
        }
      }}
      className="group relative h-[310px] w-[230px] cursor-pointer rounded-[10px] bg-[#f9eece] p-2 px-3.5"
    >
      <div className="text-xs leading-[14px] text-[#9a9a9a]">CHARACTER</div>
      <div className="absolute right-3 bottom-0 h-[100px] w-[100px]">
        <img
          src={imgSrc}
          alt=""
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none"
          }}
        />
      </div>
      <div className="text-[36px] font-bold leading-[72px]">{data.name}</div>
      <div className="flex flex-nowrap gap-1.5 overflow-hidden">
        {data.gender && (
          <span className="character-tag shrink-0 rounded-md bg-[#eec9aa] px-1.5 text-xs font-bold leading-5 text-black">
            {data.gender}
          </span>
        )}
        {data.age && (
          <span className="character-tag shrink-0 rounded-md bg-[#eec9aa] px-1.5 text-xs font-bold leading-5 text-black">
            {data.age || 0}岁
          </span>
        )}
        {data.mbti && (
          <span className="character-tag shrink-0 rounded-md bg-[#eec9aa] px-1.5 text-xs font-bold leading-5 text-black">
            {data.mbti}
          </span>
        )}
      </div>
      <div className="line-clamp-9 mt-3 text-xs font-medium leading-tight text-black">
        {data.biograph}
      </div>
      <div className="absolute bottom-3 left-3.5 w-[calc(100%-28px)]">
        <div className="text-xs">身份</div>
        <div
          className="my-0.5 h-px w-[104px] bg-linear-to-r from-[#dedede] to-[rgba(77,77,77,0)]"
          style={{ marginBottom: 3 }}
        />
        <div className="truncate text-[10px] text-[#9a9a9a]">
          {data.identity}
        </div>
      </div>
      <button
        type="button"
        className="absolute cursor-pointer right-2 top-2 ml-auto text-lg leading-none opacity-0 transition-opacity hover:text-(--theme-color) group-hover:opacity-100"
        onClick={handleEdit}
      >
        <span
          className="text-lg"
          style={{ fontFamily: "iconfont" }}
        >
          &#xea48;
        </span>
      </button>
    </div>
  )
}
