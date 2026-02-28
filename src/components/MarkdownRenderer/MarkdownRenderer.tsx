"use client";

import React, { useMemo, useEffect, useRef } from "react";
import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";

export interface MarkdownRendererProps {
  content: string;
  onFileNameClick?: (fileName: string) => void;
}

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
    <div
      ref={containerRef}
      className="markdown-content leading-relaxed text-[var(--text-primary)] prose prose-neutral max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default MarkdownRenderer;
