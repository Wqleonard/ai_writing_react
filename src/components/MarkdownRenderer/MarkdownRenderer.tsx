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
import RichTextRender from "@/components/RichTextRender";

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

    const links = el.querySelectorAll("a");
    links.forEach((link) => {
      const href = link.getAttribute("href");
      if (!href) return;

      let decodedHref = href;
      try {
        decodedHref = decodeURIComponent(href);
      } catch {
        // keep href
      }

      const isMdFile =
        decodedHref.endsWith(".md") || /\.md($|[?#])/.test(decodedHref);

      if (isMdFile) {
        link.classList.add("file-link");
        link.addEventListener("click", (e: Event) => {
          e.preventDefault();
          const fileName = link.textContent || link.innerText || decodedHref;
          onFileNameClick?.(fileName);
        });
      } else if (
        href.startsWith("http://") ||
        href.startsWith("https://")
      ) {
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");
      }
    });

  }, [html, onFileNameClick]);

  return (
    <RichTextRender
      ref={containerRef}
      content={html}
      className="markdown-content markdown-renderer leading-relaxed text-[var(--text-primary)] prose prose-neutral max-w-none dark:prose-invert"
      contentClassName="markdown-renderer-inner"
    />
  );
};

export default MarkdownRenderer;
