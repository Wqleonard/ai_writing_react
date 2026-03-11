"use client";

import React, { useMemo, useCallback, useRef } from "react";
import MarkdownIt from "markdown-it";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import typescript from "highlight.js/lib/languages/typescript";
import "highlight.js/styles/github.css";
import "./MarkdownRenderer.css";

export interface MarkdownRendererProps {
  content: string;
  onFileNameClick?: (fileName: string) => void;
}

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight(str: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value;
      } catch {
        // ignore
      }
    }
    return "";
  },
});

// ===== 与 Vue MarkdownRenderer.vue 行为对齐（但避免 DOM 后处理被 React 覆盖） =====
// 1) 在 markdown-it 渲染阶段把 “：正文/第一章.md” 这类纯文本转成 <a>
// 2) 渲染 link_open 时：.md 不加 target；外链 http(s) 加 target=_blank
(() => {
  const colonMdPattern = /([：:]\s*)([^\s<>，,。.！!？?；;]+\.md)/g;

  const decodeHref = (href: string): string => {
    try {
      return decodeURIComponent(href);
    } catch {
      return href;
    }
  };

  const isMdFileHref = (href: string): boolean => {
    const decoded = decodeHref(href);
    return decoded.endsWith(".md") || /\.md($|[?#])/.test(decoded);
  };

  let TokenCtor: any = null;
  md.core.ruler.after("inline", "colon_md_plaintext_links", (state) => {
    if (!TokenCtor) TokenCtor = (state as any).Token;
    for (const blockToken of state.tokens) {
      if (blockToken.type !== "inline" || !blockToken.children) continue;

      const children = blockToken.children;
      const nextChildren: any[] = [];
      let inLink = 0;

      for (const child of children) {
        if (child.type === "link_open") {
          inLink += 1;
          nextChildren.push(child);
          continue;
        }
        if (child.type === "link_close") {
          inLink = Math.max(0, inLink - 1);
          nextChildren.push(child);
          continue;
        }

        // Vue 版：如果已经在 <a> 内，不再把文本转成链接
        if (inLink > 0 || child.type !== "text") {
          nextChildren.push(child);
          continue;
        }

        const text = child.content || "";
        colonMdPattern.lastIndex = 0;
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        let changed = false;

        while ((match = colonMdPattern.exec(text)) !== null) {
          changed = true;
          const before = text.slice(lastIndex, match.index);
          if (before) {
            const t = new TokenCtor("text", "", 0);
            t.content = before;
            nextChildren.push(t);
          }

          const colonPart = match[1] || "";
          const mdFile = match[2] || "";
          if (colonPart) {
            const t = new TokenCtor("text", "", 0);
            t.content = colonPart;
            nextChildren.push(t);
          }

          const open = new TokenCtor("link_open", "a", 1);
          open.attrs = [["href", mdFile]];
          open.attrJoin("class", "file-link");
          nextChildren.push(open);

          const inner = new TokenCtor("text", "", 0);
          inner.content = mdFile;
          nextChildren.push(inner);

          const close = new TokenCtor("link_close", "a", -1);
          nextChildren.push(close);

          lastIndex = match.index + match[0].length;
        }

        if (!changed) {
          nextChildren.push(child);
          continue;
        }

        const after = text.slice(lastIndex);
        if (after) {
          const t = new TokenCtor("text", "", 0);
          t.content = after;
          nextChildren.push(t);
        }
      }

      blockToken.children = nextChildren;
    }
  });

  const defaultLinkOpen =
    md.renderer.rules.link_open ??
    ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const href = token.attrGet("href") || "";

    if (href && isMdFileHref(href)) {
      token.attrJoin("class", "file-link");
    } else if (href && (href.startsWith("http://") || href.startsWith("https://"))) {
      token.attrSet("target", "_blank");
      token.attrSet("rel", "noopener noreferrer");
    }

    return defaultLinkOpen(tokens, idx, options, env, self);
  };
})();

const MarkdownRenderer = ({ content, onFileNameClick }: MarkdownRendererProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastHandledLinkRef = useRef<{ key: string; ts: number } | null>(null);
  const html = useMemo(() => md.render(content ?? ""), [content]);

  const tryHandleMdLink = useCallback(
    (target: HTMLElement | null): { handled: boolean; key?: string } => {
      const root = containerRef.current;
      if (!root) return { handled: false };
      const a = target?.closest?.("a") as HTMLAnchorElement | null;
      if (!a || !root.contains(a)) return { handled: false };
      const href = a.getAttribute("href") || "";
      if (!href) return { handled: false };

      let decodedHref = href;
      try {
        decodedHref = decodeURIComponent(href);
      } catch {
        // keep href
      }
      const isMdFile = decodedHref.endsWith(".md") || /\.md($|[?#])/.test(decodedHref);
      if (!isMdFile) return { handled: false };

      const fileName = (a.textContent || a.innerText || decodedHref).trim();
      if (!fileName) return { handled: false };

      const key = `${decodedHref}@@${fileName}`;
      onFileNameClick?.(fileName);
      return { handled: true, key };
    },
    [onFileNameClick]
  );

  const shouldIgnoreDuplicate = useCallback((key: string) => {
    const last = lastHandledLinkRef.current;
    if (!last) return false;
    if (last.key !== key) return false;
    return Date.now() - last.ts < 800;
  }, []);

  const rememberHandled = useCallback((key: string) => {
    lastHandledLinkRef.current = { key, ts: Date.now() };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // 用 pointerdown 提前触发：流式频繁更新会导致 DOM 在 down/up 间被替换，从而 click 合成失败
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      const res = tryHandleMdLink(target);
      if (!res.handled || !res.key) return;
      if (shouldIgnoreDuplicate(res.key)) return;

      e.preventDefault();
      e.stopPropagation();
      rememberHandled(res.key);
    },
    [rememberHandled, shouldIgnoreDuplicate, tryHandleMdLink]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      const res = tryHandleMdLink(target);
      if (!res.handled || !res.key) return;
      if (shouldIgnoreDuplicate(res.key)) return;

      e.preventDefault();
      e.stopPropagation();
      rememberHandled(res.key);
    },
    [rememberHandled, shouldIgnoreDuplicate, tryHandleMdLink]
  );

  return (
    <div
      ref={containerRef}
      onPointerDownCapture={handlePointerDown}
      onClickCapture={handleClick}
      className="markdown-content markdown-renderer leading-relaxed text-[var(--text-primary)] prose prose-neutral max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default MarkdownRenderer;
