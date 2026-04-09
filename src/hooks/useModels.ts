import { useMemo } from "react";
import type { QuickChatInputChannel } from "../types/quickChat";

export type QuickChatCreationType = "novel" | "script";

const buildQuickChatInputChannels = (
  creationType: QuickChatCreationType
): QuickChatInputChannel[] => {
  const workNoun = creationType === "script" ? "剧本" : "小说";
  return [
    {
      title: "我想写",
      icon: "&#xe63f;",
      value: [
        { mold: "tip", value: "我想写" },
        { mold: "span", value: "请帮我以" },
        { mold: "input", value: "输入脑洞、灵感", width: "120px" },
        { mold: "span", value: "为主题，创作一篇类型为" },
        { mold: "input", value: "输入题材类型", width: "100px" },
        { mold: "span", value: `的${workNoun}，章节数为` },
        { mold: "input", value: "输入数字", width: "75px" },
        { mold: "span", value: "章。" },
      ],
    },
    {
      title: "我想改",
      icon: "&#xe63c;",
      value: [
        { mold: "tip", value: "我想改" },
        { mold: "span", value: `帮我把作品${workNoun}的` },
        {
          mold: "input",
          value: "输入具体环节，如大纲、第一章、女角色的名字",
          width: "120px",
        },
        { mold: "span", value: "内容改一改，改成" },
        { mold: "input", value: "输入你想具体改动的内容", width: "120px" },
      ],
    },
    {
      title: "我想查",
      icon: "&#xe63e;",
      value: [
        { mold: "tip", value: "我想查" },
        { mold: "span", value: "帮我查一下" },
        {
          mold: "input",
          value: "输入具体查询内容，比如唐朝服饰、福布斯富豪排行",
          width: "120px",
        },
      ],
    },
    {
      title: "我没有想法",
      icon: "&#xe63d;",
      value: [
        { mold: "tip", value: "我没有想法" },
        { mold: "span", value: "我没有什么想法，给我个灵感吧~" },
      ],
    },
  ];
};

export function useModels(creationType: QuickChatCreationType = "novel") {
  const quickChatInputChannels = useMemo(
    () => buildQuickChatInputChannels(creationType),
    [creationType]
  );
  return {
    quickChatInputChannels,
  };
}
