import { useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import type { PostStreamData } from "@/api";
import { generateImage, postSelectionToolbarStream } from "@/api/selection-toolbar";
import IconFont from "@/components/IconFont/Iconfont";
import { StreamIndicator } from "@/components/StreamIndicator";
import { toast } from "sonner";
// "image" |
export type SelectionToolbarAction = "edit" | "expand" |  "add" | "note";

type ChatItem = {
  role: "ai" | "human";
  content: string;
  contentType?: "text" | "image";
  end: boolean;
};

type SelectionSnapshot = {
  from: number;
  to: number;
  selectedText: string;
};

interface SelectionToolbarComponentProps {
  editor: Editor;
  btns: SelectionToolbarAction[];
  onAdd?: (text: string) => void;
  onNote?: (text: string) => void;
  onAction?: (action: SelectionToolbarAction, text: string, fullText: string) => void;
  onPinnedChange?: (pinned: boolean) => void;
}

const actionLabelMap: Record<SelectionToolbarAction, string> = {
  edit: "修改",
  expand: "扩写",
  // image: "生图",
  add: "添加到对话",
  note: "添加到笔记",
};

const actionIconMap: Record<SelectionToolbarAction, string> = {
  edit: "&#xea48;",
  expand: "&#xe616;",
  add: "&#xe62c;",
  // image: "&#xea2d;",
  note: "&#xe64c;",
};

export default function SelectionToolbarComponent(props: SelectionToolbarComponentProps) {
  const { editor, btns, onAdd, onNote, onAction, onPinnedChange } = props;
  const [showChat, setShowChat] = useState(false);
  const [chatType, setChatType] = useState<SelectionToolbarAction>("edit");
  const [inputVal, setInputVal] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatArr, setChatArr] = useState<ChatItem[]>([]);
  const streamAbortRef = useRef<AbortController | null>(null);
  const selectionRef = useRef<SelectionSnapshot | null>(null);

  const inputPlaceholder = useMemo(
    () => (chatType === "expand" ? "请输入扩写建议" : "请输入修改建议"),
    [chatType]
  );

  const getSelection = (): SelectionSnapshot | null => {
    const { from, to } = editor.state.selection;
    if (from >= to) return null;
    const selectedText = editor.state.doc.textBetween(from, to).trim().replace(/\s+/g, " ");
    if (!selectedText) return null;
    return { from, to, selectedText };
  };

  const upsertAiMessage = (updater: (prev: ChatItem) => ChatItem) => {
    setChatArr((prev) => {
      const copy = [...prev];
      const idx = copy.findIndex((item) => item.role === "ai");
      if (idx === -1) return prev;
      copy[idx] = updater(copy[idx]);
      return copy;
    });
  };

  const closePanel = () => {
    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
      streamAbortRef.current = null;
    }
    setShowChat(false);
    setChatLoading(false);
    setChatArr([]);
    setInputVal("");
    onPinnedChange?.(false);
  };

  const handleBack = () => {
    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
      streamAbortRef.current = null;
    }
    setShowChat(false);
    setChatLoading(false);
    setChatArr([]);
    if (chatType === "expand") {
      setInputVal("保持内容不变，字数扩写至两倍");
    } else {
      setInputVal("");
    }
    onPinnedChange?.(false);
  };

  const openActionPanel = (action: SelectionToolbarAction, selection: SelectionSnapshot) => {
    selectionRef.current = selection;
    setChatType(action);
    setShowChat(true);
    setChatArr([]);
    setChatLoading(false);
    if (action === "expand") {
      setInputVal("保持内容不变，字数扩写至两倍");
    } else {
      setInputVal("");
    }
    onPinnedChange?.(true);
  };

  const onStreamData = (data: PostStreamData) => {
    switch (data.event) {
      case "messages/partial": {
        const content = Array.isArray(data.data) ? data.data?.[0]?.content?.[0]?.text ?? "" : "";
        upsertAiMessage((prev) => ({ ...prev, content }));
        setChatLoading(false);
        break;
      }
      case "updates": {
        const content = data?.data?.generate_excerpt?.content;
        if (typeof content === "string") {
          upsertAiMessage((prev) => ({ ...prev, content }));
        }
        break;
      }
      default:
        break;
    }
  };

  const onStreamError = (error: Error) => {
    if (error instanceof DOMException && error.name === "AbortError") return;
    upsertAiMessage((prev) => ({
      ...prev,
      content: "生成失败，请重试",
      contentType: "text",
      end: true,
    }));
    setChatLoading(false);
  };

  const onStreamEnd = () => {
    setChatLoading(false);
    streamAbortRef.current = null;
    upsertAiMessage((prev) => ({ ...prev, end: true }));
  };

  const handleInputSend = async () => {
    const snapshot = selectionRef.current;
    if (!snapshot) {
      toast.warning("选中范围已失效，请重新选中");
      return;
    }
    const query = inputVal.trim();
    if (!query) {
      toast.warning(chatType === "expand" ? "请输入扩写建议" : "请输入修改建议");
      return;
    }
    if (chatType !== "edit" && chatType !== "expand") return;

    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
    }
    const abort = new AbortController();
    streamAbortRef.current = abort;

    setChatLoading(true);
    setChatArr([
      { role: "human", content: query, end: true },
      { role: "ai", content: "", contentType: "text", end: false },
    ]);
    setInputVal("");

    try {
      await postSelectionToolbarStream(
        {
          action: chatType,
          originalText: snapshot.selectedText,
          query,
          fullText: editor.getText(),
        },
        onStreamData,
        onStreamError,
        onStreamEnd,
        { signal: abort.signal }
      );
    } catch {
      // handled in onStreamError
    }
  };

  const handleImage = async () => {
    const snapshot = selectionRef.current;
    if (!snapshot) {
      toast.warning("选中范围已失效，请重新选中");
      return;
    }
    setChatLoading(true);
    setChatArr([
      { role: "human", content: "请根据选中内容生成图片", end: true },
      { role: "ai", content: "正在生成中，请稍后...", contentType: "text", end: false },
    ]);
    try {
      const req = await generateImage(snapshot.selectedText, editor.getText());
      const imageUrl = req?.imageUrl || "";
      if (!imageUrl) throw new Error("empty image url");
      setChatArr((prev) => [
        prev[0],
        { role: "ai", content: imageUrl, contentType: "image", end: true },
      ]);
    } catch {
      setChatArr((prev) => [
        prev[0],
        { role: "ai", content: "生成失败，请稍后重试", contentType: "text", end: true },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleAccept = () => {
    const snapshot = selectionRef.current;
    const aiMessage = chatArr.find((item) => item.role === "ai");
    const content = aiMessage?.content?.trim();
    if (!snapshot || !content || aiMessage?.contentType === "image") {
      toast.warning("没有可替换的内容");
      return;
    }

    editor
      .chain()
      .focus()
      .setTextSelection({ from: snapshot.from, to: snapshot.to })
      .deleteSelection()
      .run();
    const insertPos = editor.state.selection.$from.pos;
    editor
      .chain()
      .focus()
      .setTextSelection(insertPos)
      .insertContent(content, { parseOptions: { preserveWhitespace: "full" } })
      .run();

    toast.success("内容已替换");
    closePanel();
  };

  const handleInsertImage = () => {
    const snapshot = selectionRef.current;
    const aiMessage = chatArr.find((item) => item.role === "ai");
    const imageUrl = aiMessage?.content?.trim();
    if (!imageUrl || aiMessage?.contentType !== "image") {
      toast.warning("没有可用图片");
      return;
    }
    const insertPos = snapshot?.to ?? editor.state.selection.from;
    editor
      .chain()
      .focus()
      .setTextSelection(insertPos)
      .insertContent(`\n![插入图片](${imageUrl})\n`, {
        parseOptions: { preserveWhitespace: "full" },
      })
      .run();
    toast.success("图片插入成功");
    closePanel();
  };

  const handleResetChat = () => {
    setChatArr([]);
    setChatLoading(false);
    if (chatType === "expand") {
      setInputVal("保持内容不变，字数扩写至两倍");
    } else {
      setInputVal("");
    }
  };

  const handleBtnClick = (action: SelectionToolbarAction) => {
    const selection = getSelection();
    if (!selection) return;
    selectionRef.current = selection;

    if (action === "add") {
      onAdd?.(selection.selectedText);
      return;
    }
    if (action === "note") {
      onNote?.(selection.selectedText);
      return;
    }

    onAction?.(action, selection.selectedText, editor.getText());
    // if (action === "image") {
    //   openActionPanel(action, selection);
    //   void handleImage();
    //   return;
    // }
    openActionPanel(action, selection);
  };

  return (
    <div
      className="min-w-[128px] rounded-[10px]  bg-white p-1"
      style={{ fontFamily: '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif' }}
    >
      {!showChat ? (
        <div className="flex flex-col gap-2">
          {btns.map((btn, index) => (
            <button
              key={`${btn}_${index}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleBtnClick(btn)}
              className="flex h-7 cursor-pointer items-center rounded-[6px] px-2 text-[#61615f] hover:bg-[#e8e8e8]"
            >
              <IconFont unicode={actionIconMap[btn]} className="h-5 w-5 text-center leading-5" />
              <span className="ml-1 text-base">{actionLabelMap[btn]}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="w-[420px] p-3 pt-0">
          <div className="cursor-move pt-3">
            <div className="flex h-[34px] items-center justify-between text-xl text-[#61616f]">
              <div className="flex items-center">
                <button
                  type="button"
                  className="h-6 w-6 cursor-pointer rounded-sm hover:bg-[#e8e8e8]"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleBack}
                >
                  <IconFont unicode="&#xeaa2;" className="h-6 w-6 text-center text-2xl leading-6" />
                </button>
                <span className="ml-2">{actionLabelMap[chatType]}</span>
              </div>

              <button
                type="button"
                className="h-6 w-6 cursor-pointer rounded-sm text-[#61616f] hover:bg-[#e8e8e8]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={closePanel}
              >
                <IconFont unicode="&#xe633;" className="h-6 w-6 text-center text-base leading-6" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex max-h-[240px] flex-col gap-4 overflow-y-auto">
            {chatArr.map((chat, idx) =>
              chat.role === "human" ? (
                <div
                  key={`human-${idx}`}
                  className="self-end rounded-bl-[10px] rounded-tl-[10px] rounded-tr-[10px] bg-[#e8e8e8] px-2.5 py-1.5"
                >
                  {chat.content}
                </div>
              ) : chat.contentType === "image" ? (
                <div key={`ai-image-${idx}`} className="flex flex-col gap-1">
                  <img src={chat.content} alt="生成图片" className="w-[150px] object-cover" />
                  {chat.end && (
                    <div className="flex flex-row gap-1">
                      <button
                        type="button"
                        className="m-0 h-[22px] rounded border border-[#dcdfe6] px-1.5 py-[3px] text-xs text-[#606266] hover:bg-[#f5f7fa]"
                        onClick={handleInsertImage}
                      >
                        插入
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div key={`ai-text-${idx}`} className="py-1.5 pl-2.5">
                  {chat.content}
                </div>
              )
            )}
            {chatLoading && <StreamIndicator className="ml-2.5 h-9!" />}
          </div>

          {(chatType === "edit" || chatType === "expand") && chatArr.length === 0 && (
            <div className="mt-3 flex min-h-12 items-end justify-between gap-2 rounded-lg border border-[#c4c4c4] p-2">
              <textarea
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleInputSend();
                  }
                }}
                placeholder={inputPlaceholder}
                maxLength={500}
                className="min-h-[42px] flex-1 resize-none border-none px-2 py-0 text-base outline-none"
              />
              <button
                type="button"
                className="h-9 w-9 shrink-0 cursor-pointer rounded-full bg-[#fa9e00] text-white hover:opacity-80"
                onClick={() => void handleInputSend()}
              >
                <IconFont unicode="&#xe63a;" className="inline-block -scale-x-100 text-xl leading-9" />
              </button>
            </div>
          )}

          {chatArr.length > 0 && chatArr[1]?.end && (
            <div className="mt-2 flex h-9 flex-row-reverse gap-5 px-2">
              <button
                type="button"
                className="h-9 w-9 cursor-pointer rounded-full bg-[#fa9e00] text-white hover:opacity-80"
                onClick={handleAccept}
              >
                <IconFont unicode="&#xe610;" className="text-xl leading-9" />
              </button>
              <button
                type="button"
                className="h-9 w-9 cursor-pointer rounded-full bg-[#e8e8e8] text-white hover:opacity-80"
                onClick={handleResetChat}
              >
                <IconFont unicode="&#xe66f;" className="text-xl leading-9" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

