/**
 * 导出工具类（React 版，由 src/utils/exportUtils.ts 重构）
 * 使用 @/stores/editorStore 的 FileTreeNode 类型。
 */
import type { FileTreeNode } from "@/stores/editorStore/types";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import mermaid from "mermaid";
import { toDocx } from "mdast2docx";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { tablePlugin } from "@m2d/table";
import { imagePlugin } from "@m2d/image";
import { json2md, type TiptapDocument } from "./mdConverter";

export class ExportUtils {
  private static isTiptapJson(content: unknown): boolean {
    if (typeof content === "string") {
      try {
        const o = JSON.parse(content) as { type?: string };
        return !!o && typeof o === "object" && o.type === "doc";
      } catch {
        return false;
      }
    }
    try {
      return !!content && typeof content === "object" && (content as { type?: string })?.type === "doc";
    } catch {
      return false;
    }
  }

  private static isMarkdown(content: unknown): boolean {
    if (typeof content !== "string") return false;
    const markdownPatterns = [
      /^#{1,6}\s/m,
      /^\d+\.\s/m,
      /^[-*+]\s/m,
      /\*\*.*\*\*/,
      /\*.*\*/,
      /\[.*\]\(.*\)/,
      /!\[.*\]\(.*\)/,
      /^```/m,
      /^\|.*\|/m,
      /^>\s/m,
    ];
    return markdownPatterns.some((p) => p.test(content));
  }

  private static processContentToMarkdown(content: unknown): string {
    if (ExportUtils.isTiptapJson(content)) {
      try {
        const doc: TiptapDocument =
          typeof content === "string" ? (JSON.parse(content) as TiptapDocument) : (content as TiptapDocument);
        return json2md(doc);
      } catch (e) {
        console.warn("Failed to convert JSON to Markdown:", e);
        return typeof content === "string" ? content : JSON.stringify(content);
      }
    }
    if (typeof content === "string" && ExportUtils.isMarkdown(content)) return content;
    return typeof content === "string" ? content : JSON.stringify(content);
  }

  private static async mermaidToImage(mermaidCode: string): Promise<string> {
    if (!mermaidCode?.trim()) return "";
    try {
      const cleanCode = mermaidCode.trim();
      const id = `mermaid-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      const { svg } = await mermaid.render(id, cleanCode);
      try {
        return await ExportUtils.svgToPng(svg);
      } catch (e1) {
        try {
          return await ExportUtils.svgToPngAlternative(svg);
        } catch {
          return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        }
      }
    } catch (error) {
      console.warn("Failed to render Mermaid diagram:", error);
      const errorMessage = error instanceof Error && error.message.includes("UnknownDiagramError")
        ? "Mermaid 图表类型不支持"
        : "Mermaid 图渲染失败";
      return `data:image/svg+xml;base64,${btoa(
        `<svg width="400" height="120" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="120" fill="#f8f9fa" stroke="#dee2e6" stroke-width="2"/><text x="200" y="40" text-anchor="middle" fill="#6c757d" font-family="Arial, sans-serif" font-size="14">${errorMessage}</text><text x="200" y="60" text-anchor="middle" fill="#999" font-family="Arial, sans-serif" font-size="12">请检查 Mermaid 代码格式</text></svg>`
      )}`;
    }
  }

  private static async svgToPng(svg: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("无法创建 Canvas 上下文"));
            return;
          }
          const svgEl = new DOMParser().parseFromString(svg, "image/svg+xml").querySelector("svg");
          let w = 800,
            h = 600;
          if (svgEl) {
            const vb = svgEl.getAttribute("viewBox");
            if (vb) {
              const parts = vb.split(" ").map(Number);
              w = parts[2] || 800;
              h = parts[3] || 600;
            } else {
              w = parseInt(svgEl.getAttribute("width") || "800", 10);
              h = parseInt(svgEl.getAttribute("height") || "600", 10);
            }
          }
          const scale = 2;
          canvas.width = w * scale;
          canvas.height = h * scale;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.scale(scale, scale);
          setTimeout(() => {
            try {
              ctx.drawImage(img, 0, 0, w, h);
              resolve(canvas.toDataURL("image/png", 1.0));
            } catch (e) {
              reject(e);
            }
          }, 100);
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error("SVG 图片加载失败"));
      img.crossOrigin = "anonymous";
      img.src = svgDataUrl;
    });
  }

  private static async svgToPngAlternative(svg: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const svgEl = new DOMParser().parseFromString(svg, "image/svg+xml").querySelector("svg");
      if (!svgEl) {
        reject(new Error("无法解析 SVG"));
        return;
      }
      const bbox = svgEl.getBBox();
      const width = bbox.width || 800;
      const height = bbox.height || 600;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("无法创建 Canvas 上下文"));
        return;
      }
      const scale = 2;
      canvas.width = width * scale;
      canvas.height = height * scale;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.scale(scale, scale);
      const img = new Image();
      img.onload = () => {
        try {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/png", 1.0));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error("图片加载失败"));
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });
  }

  private static convertHtmlMermaidToMarkdown(markdown: string): string {
    const htmlMermaidPattern = /<pre\s+code="([^"]*)"[^>]*>\s*<code\s+class="language-mermaid"[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi;
    return markdown.replace(htmlMermaidPattern, (_match, codeAttr: string, mermaidContent: string) => {
      const decode = (t: string) =>
        t
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, " ")
          .trim();
      const mermaidCode = (codeAttr ? decode(codeAttr) : "") || decode(mermaidContent);
      return `\`\`\`mermaid\n${mermaidCode}\n\`\`\``;
    });
  }

  private static async generateWordContent(label: string, content: unknown): Promise<ArrayBuffer> {
    let markdownContent: string;
    if (ExportUtils.isTiptapJson(content)) {
      markdownContent = ExportUtils.processContentToMarkdown(content);
    } else if (typeof content === "string") {
      markdownContent = ExportUtils.isMarkdown(content) ? content : content;
    } else {
      markdownContent = JSON.stringify(content);
    }
    markdownContent += "\n\n(AI生成)";
    let processedMarkdown = ExportUtils.convertHtmlMermaidToMarkdown(markdownContent);
    const fullMarkdown = `# ${label}\n\n${processedMarkdown}`;
    processedMarkdown = fullMarkdown;

    const mermaidBlockPattern = /```mermaid\s*\n([\s\S]*?)```/g;
    const mermaidMatches = [...fullMarkdown.matchAll(mermaidBlockPattern)];
    if (mermaidMatches.length > 0) {
      mermaid.initialize({ startOnLoad: false, securityLevel: "loose", theme: "default" });
      for (const match of mermaidMatches) {
        try {
          const imageDataUrl = await ExportUtils.mermaidToImage(match[1]);
          if (imageDataUrl) {
            processedMarkdown = processedMarkdown.replace(match[0], `![Mermaid Diagram](${imageDataUrl})`);
          }
        } catch {
          processedMarkdown = processedMarkdown.replace(match[0], "\n[Mermaid 图表渲染失败]\n");
        }
      }
    }

    const mdast = unified().use(remarkParse).use(remarkGfm).parse(processedMarkdown);
    const docxBlob = (await toDocx(
      mdast,
      {},
      { plugins: [imagePlugin(), tablePlugin()] },
      "blob"
    )) as Blob;
    return docxBlob.arrayBuffer();
  }

  private static markdownToPlainText(markdown: string): string {
    return markdown
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/```mermaid\n([\s\S]*?)```/g, (_m, code: string) => `\n[Mermaid 图表]\n${code.trim()}\n`)
      .replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang: string, code: string) =>
        lang ? `\n[${lang} 代码]\n${code.trim()}\n` : `\n${code.trim()}\n`
      )
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
      .replace(/^[\s]*[-*+]\s+/gm, "• ")
      .replace(/^[\s]*\d+\.\s+/gm, "")
      .replace(/^>\s*/gm, "")
      .replace(/^[-*_]{3,}$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  private static htmlToPlainText(html: string): string {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    const text = (tempDiv.textContent || tempDiv.innerText || "").replace(/[ \t]+/g, " ").trim();
    return text;
  }

  private static generateTxtContent(label: string, content: unknown): string {
    const processed = ExportUtils.processContentToMarkdown(content);
    const plainText =
      ExportUtils.isTiptapJson(content) || ExportUtils.isMarkdown(content) || ExportUtils.isMarkdown(processed)
        ? ExportUtils.markdownToPlainText(processed)
        : ExportUtils.htmlToPlainText(processed);
    return `${label}\n\n${plainText}\n\n(AI生成)`;
  }

  static async exportChapterAsWord(chapter: FileTreeNode): Promise<void> {
    if (!chapter.label || chapter.content === undefined || chapter.content === null) {
      throw new Error("章节标题或内容不能为空");
    }
    const arrayBuffer = await ExportUtils.generateWordContent(chapter.label, chapter.content);
    const blob = new Blob([arrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    saveAs(blob, `${chapter.label}.docx`);
  }

  static async exportChapterAsTxt(chapter: FileTreeNode): Promise<void> {
    if (!chapter.label || chapter.content === undefined || chapter.content === null) {
      throw new Error("章节标题或内容不能为空");
    }
    const txtContent = ExportUtils.generateTxtContent(chapter.label, chapter.content);
    const blob = new Blob([txtContent], { type: "text/plain;charset=utf-8" });
    saveAs(blob, `${chapter.label}.txt`);
  }

  private static async collectMainTextContent(
    node: FileTreeNode
  ): Promise<{ content: string; fileCount: number } | null> {
    const mainTextFolder = node.children?.find(
      (c) => c.isDirectory && (c.label === "正文" || c.label === "正文内容")
    );
    if (!mainTextFolder?.children?.length) return null;
    const collected: string[] = [];
    let fileCount = 0;
    const collectFromNode = (cur: FileTreeNode) => {
      if (!cur.isDirectory && cur.content != null && cur.content !== "") {
        fileCount++;
        let content = "";
        if (ExportUtils.isTiptapJson(cur.content)) {
          content = ExportUtils.processContentToMarkdown(cur.content);
        } else if (typeof cur.content === "string") {
          content = cur.content;
        } else {
          content = JSON.stringify(cur.content);
        }
        collected.push(`## ${cur.label}\n\n${content}`);
      }
      cur.children?.forEach(collectFromNode);
    };
    mainTextFolder.children.forEach(collectFromNode);
    if (collected.length === 0) return null;
    return { content: collected.join("\n\n"), fileCount };
  }

  private static async processNodeForZip(node: FileTreeNode, zip: JSZip, currentPath: string): Promise<void> {
    const nodePath = currentPath ? `${currentPath}/${node.label}` : node.label;
    if (node.isDirectory) {
      if (node.children?.length) {
        for (const child of node.children) {
          await ExportUtils.processNodeForZip(child, zip, nodePath);
        }
      } else {
        zip.folder(nodePath);
      }
    } else {
      if (node.fileType === "md" && node.content != null && node.content !== "") {
        const arrayBuffer = await ExportUtils.generateWordContent(node.label, node.content);
        zip.file(`${nodePath}.docx`, arrayBuffer);
      } else if (node.content != null && node.content !== "") {
        const ext = node.fileType || "txt";
        const processed = ExportUtils.isTiptapJson(node.content)
          ? ExportUtils.processContentToMarkdown(node.content)
          : String(node.content);
        zip.file(`${nodePath}.${ext}`, processed);
      }
    }
  }

  private static processNodeForZipTxt(node: FileTreeNode, zip: JSZip, currentPath: string): void {
    const nodePath = currentPath ? `${currentPath}/${node.label}` : node.label;
    if (node.isDirectory) {
      if (node.children?.length) {
        node.children.forEach((c) => ExportUtils.processNodeForZipTxt(c, zip, nodePath));
      } else {
        zip.folder(nodePath);
      }
    } else {
      if (node.fileType === "md" && node.content != null && node.content !== "") {
        const txtContent = ExportUtils.generateTxtContent(node.label, node.content);
        zip.file(`${nodePath}.txt`, txtContent);
      } else if (node.content != null && node.content !== "") {
        const ext = node.fileType || "txt";
        const processed = ExportUtils.isTiptapJson(node.content)
          ? ExportUtils.processContentToMarkdown(node.content)
          : String(node.content);
        zip.file(`${nodePath}.${ext}`, processed);
      }
    }
  }

  static async exportWorkAsZipDoc(workNode: FileTreeNode): Promise<void> {
    const zip = new JSZip();
    await ExportUtils.processNodeForZip(workNode, zip, "");
    const mainTextResult = await ExportUtils.collectMainTextContent(workNode);
    if (mainTextResult) {
      const mergedBuffer = await ExportUtils.generateWordContent("正文_完整内容", mainTextResult.content);
      zip.file(`${workNode.label}/正文/正文_完整内容.docx`, mergedBuffer);
    }
    const zipBlob = await zip.generateAsync({ type: "blob" });
    saveAs(zipBlob, `${workNode.label}_doc.zip`);
  }

  static async exportWorkAsZipTxt(workNode: FileTreeNode): Promise<void> {
    const zip = new JSZip();
    ExportUtils.processNodeForZipTxt(workNode, zip, "");
    const mainTextResult = await ExportUtils.collectMainTextContent(workNode);
    if (mainTextResult) {
      const mergedTxt = ExportUtils.generateTxtContent("正文_完整内容", mainTextResult.content);
      zip.file(`${workNode.label}/正文/正文_完整内容.txt`, mergedTxt);
    }
    const zipBlob = await zip.generateAsync({ type: "blob" });
    saveAs(zipBlob, `${workNode.label}_txt.zip`);
  }
}
