import React, { useEffect, useMemo, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";

export type ContentType = "markdown" | "html" | "json" | "auto";

// TipTap JSON 文档结构（这里不做强约束，按需你可以替换为你们项目里的 TiptapDocument 类型）
export type TiptapJsonDoc = Record<string, any>;

export interface TiptapEditorNewProps {
  value: string | TiptapJsonDoc;
  onChange?: (value: string | TiptapJsonDoc) => void;

  /** 默认 markdown；auto 会在输入为 string 时尝试识别 html / tiptap-json-doc / markdown */
  contentType?: ContentType;
  placeholder?: string;
  editable?: boolean;
  disableSelection?: boolean;

  /** 为了兼容原 Vue 版的调用方，先保留但不实现工具栏 */
  showToolbar?: boolean;

  className?: string;
  style?: React.CSSProperties;
}

const looksLikeHtml = (input: string) => {
  const s = input.trim();
  if (!s) return false;
  return /<\/?[a-z][\s\S]*>/i.test(s);
};

const isLikelyTiptapDoc = (v: any): v is TiptapJsonDoc => {
  return !!v && typeof v === "object" && v.type === "doc";
};

const tryParseJson = (input: string): any | null => {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
};

const detectContentTypeFromValue = (value: string | TiptapJsonDoc): Exclude<ContentType, "auto"> => {
  if (typeof value !== "string") return "json";
  const s = value.trim();
  if (!s) return "markdown";

  const parsed = tryParseJson(s);
  if (isLikelyTiptapDoc(parsed)) return "json";
  if (looksLikeHtml(s)) return "html";
  return "markdown";
};

const TiptapEditorNew = (props: TiptapEditorNewProps) => {
  const {
    value,
    onChange,
    contentType = "markdown",
    placeholder = "开始编写您的内容...",
    editable = true,
    disableSelection = false,
    className,
    style,
  } = props;

  const effectiveType = useMemo<Exclude<ContentType, "auto">>(() => {
    if (contentType !== "auto") return contentType;
    return detectContentTypeFromValue(value);
  }, [contentType, value]);

  const isUpdatingFromExternal = useRef(false);

  const extensions = useMemo(() => {
    return [
      StarterKit,
      Markdown,
      Placeholder.configure({ placeholder }),
    ];
  }, [placeholder]);

  const editor = useEditor(
    {
      extensions,
      editable,
      editorProps: {
        attributes: {
          style: `min-height: 12.5rem; padding: 1rem; outline: none; ${
            disableSelection
              ? "user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none;"
              : ""
          }`,
          "data-placeholder": placeholder,
        },
      },
      content:
        effectiveType === "json"
          ? (typeof value === "string" ? tryParseJson(value) ?? { type: "doc", content: [] } : value)
          : (typeof value === "string" ? value : ""),
      onUpdate: ({ editor }) => {
        if (isUpdatingFromExternal.current) return;
        if (!onChange) return;

        if (effectiveType === "json") {
          const json = editor.getJSON();
          onChange(json);
          return;
        }

        if (effectiveType === "markdown") {
          const md =
            (editor as any).getMarkdown?.() ??
            (editor as any).storage?.markdown?.getMarkdown?.() ??
            "";
          onChange(md);
          return;
        }

        // html
        onChange(editor.getHTML());
      },
    },
    // 关键：当内容类型切换时重建 editor，避免 setContent 语义错配
    [effectiveType, disableSelection]
  );

  // 外部 value 改变时，推送到 TipTap（避免循环）
  useEffect(() => {
    if (!editor) return;
    isUpdatingFromExternal.current = true;
    try {
      if (effectiveType === "json") {
        const nextDoc =
          typeof value === "string" ? (tryParseJson(value) ?? { type: "doc", content: [] }) : value;
        editor.commands.setContent(nextDoc);
      } else if (effectiveType === "markdown") {
        const next = typeof value === "string" ? value : "";
        try {
          editor.commands.setContent(next, { contentType: "markdown" } as any);
        } catch {
          editor.commands.setContent(next);
        }
      } else {
        const next = typeof value === "string" ? value : "<p></p>";
        editor.commands.setContent(next, { contentType: "html" } as any);
      }
    } finally {
      // 下一 tick 再放开，避免 onUpdate 立刻回流
      setTimeout(() => {
        isUpdatingFromExternal.current = false;
      }, 0);
    }
  }, [editor, value, effectiveType]);

  // editable 动态更新
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  return (
    <div className={className} style={{ width: "100%", ...style }}>
      <EditorContent editor={editor} />
    </div>
  );
};

export default TiptapEditorNew;

