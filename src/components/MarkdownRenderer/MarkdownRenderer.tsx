"use client";

import React, { useMemo, useEffect, useRef } from "react";
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

const MarkdownRenderer = ({ content, onFileNameClick }: MarkdownRendererProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const html = useMemo(() => md.render(content ?? ""), [content]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const isExternalHref = (href: string): boolean =>
      href.startsWith("http://") || href.startsWith("https://");
    const isIgnoredScheme = (href: string): boolean =>
      href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:");
    const decodeHref = (href: string): string => {
      try {
        return decodeURIComponent(href);
      } catch {
        return href;
      }
    };
    const isMdFileHref = (decodedHref: string): boolean =>
      decodedHref.endsWith(".md") || /\.md($|[?#])/.test(decodedHref);

    // 与 Vue 逻辑一致：识别 .md 文件链接并阻止跳转；外部链接新开页
    const links = el.querySelectorAll("a");
    links.forEach((link) => {
      const href = link.getAttribute("href") || "";
      if (!href) return;

      const decodedHref = decodeHref(href);
      const isMdFile = isMdFileHref(decodedHref);

      // 与 Vue 逻辑一致：优先识别 .md 文件链接（即使 linkify 生成了 http(s) 也要拦截）
      if (isMdFile) {
        link.classList.add("file-link");
        // 避免被默认行为/target 影响（如 linkify 自动补全协议或用户按住 Ctrl/Meta）
        link.removeAttribute("target");
        link.removeAttribute("rel");
        return;
      }

      // 只对外部链接加 target=_blank
      if (isExternalHref(href)) {
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");
      }
    });

    // 将纯文本中的 .md 文件名转换为可点击的链接（对齐 Vue convertPlainTextMdToLinks）
    // 匹配冒号后面的 .md 文件名（支持中英文冒号），例如：生成了：正文/第一章.md
    const convertPlainTextMdToLinks = () => {
      const mdFilePattern = /[：:]\s*([^\s<>，,。.！!？?；;]+\.md)/g;

      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const nodesToProcess: Array<{
        node: Text;
        matches: Array<{ text: string; index: number }>;
      }> = [];

      let currentNode = walker.nextNode() as Text | null;
      while (currentNode) {
        const text = currentNode.textContent || "";
        const matches: Array<{ text: string; index: number }> = [];
        let match: RegExpExecArray | null;

        mdFilePattern.lastIndex = 0;
        while ((match = mdFilePattern.exec(text)) !== null) {
          const mdFileName = match[1];
          const fullMatchIndex = match.index;

          // 检查是否已经在 <a> 标签内（对齐 Vue：仅排除 link 内部）
          let parent = currentNode.parentElement;
          let isInLink = false;
          while (parent && parent !== el) {
            if (parent.tagName === "A") {
              isInLink = true;
              break;
            }
            parent = parent.parentElement;
          }

          if (!isInLink) {
            matches.push({ text: mdFileName, index: fullMatchIndex });
          }
        }

        if (matches.length > 0) nodesToProcess.push({ node: currentNode, matches });
        currentNode = walker.nextNode() as Text | null;
      }

      nodesToProcess.forEach(({ node, matches }) => {
        const text = node.textContent || "";
        const fragments: Array<string | HTMLElement> = [];
        let lastIndex = 0;

        matches.forEach(({ text: mdFile, index }) => {
          // 添加匹配前的文本（包括冒号和空格）
          if (index > lastIndex) fragments.push(text.substring(lastIndex, index));

          // 找到冒号的位置和完整的匹配文本
          const fullMatch = text.substring(index);
          const colonMatch = fullMatch.match(/^[：:]\s*/);
          const colonPart = colonMatch ? colonMatch[0] : "";

          // 添加冒号部分（不转换为链接）
          if (colonPart) fragments.push(colonPart);

          // 创建链接元素（只包含 .md 文件名部分）
          const link = document.createElement("a");
          // 用实际 .md 作为 href，统一交给事件代理拦截
          link.href = mdFile;
          link.textContent = mdFile;
          link.classList.add("file-link");
          fragments.push(link);

          lastIndex = index + colonPart.length + mdFile.length;
        });

        // 添加剩余文本
        if (lastIndex < text.length) fragments.push(text.substring(lastIndex));

        // 替换原文本节点
        const parent = node.parentNode;
        if (!parent) return;
        fragments.forEach((fragment) => {
          if (typeof fragment === "string") parent.insertBefore(document.createTextNode(fragment), node);
          else parent.insertBefore(fragment, node);
        });
        parent.removeChild(node);
      });
    };

    convertPlainTextMdToLinks();

    // 使用事件代理，避免重复绑定/泄漏；拦截 .md 文件链接点击，阻止默认跳转并回调定位左侧树
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const a = target?.closest?.("a") as HTMLAnchorElement | null;
      if (!a || !el.contains(a)) return;
      const href = a.getAttribute("href") || "";
      if (!href) return;

      const decodedHref = decodeHref(href);
      const isMdFile = isMdFileHref(decodedHref);
      if (!isMdFile) return;

      if (isIgnoredScheme(href)) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const fileName = (a.textContent || a.innerText || decodedHref).trim();
      if (!fileName) return;
      onFileNameClick?.(fileName);
    };

    // capture 阶段拦截，确保在其他 click handler/默认导航前阻断
    el.addEventListener("click", onClick, true);
    return () => el.removeEventListener("click", onClick, true);

  }, [html, onFileNameClick]);

  return (
    <div
      ref={containerRef}
      className="markdown-content markdown-renderer leading-relaxed text-[var(--text-primary)] prose prose-neutral max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default MarkdownRenderer;
