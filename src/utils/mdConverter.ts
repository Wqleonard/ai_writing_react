/**
 * HTML/Markdown/Tiptap JSON 互转工具（React 版，由 src/utils/mdConverter.ts 重构，与 Vue 版同目录放置）
 */
import TurndownService from "turndown";
import { marked } from "marked";

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

export interface TiptapDocument {
  type: "doc";
  content: TiptapNode[];
}

export class FormatConverter {
  private turndownService: TurndownService;

  constructor(options?: {
    headingStyle?: "setext" | "atx";
    hr?: string;
    bulletListMarker?: "-" | "*" | "+";
    codeBlockStyle?: "indented" | "fenced";
    fence?: "```" | "~~~";
    emDelimiter?: "_" | "*";
    strongDelimiter?: "__" | "**";
    linkStyle?: "inlined" | "referenced";
    linkReferenceStyle?: "full" | "collapsed" | "shortcut";
    markedOptions?: unknown;
  }) {
    this.turndownService = new TurndownService({
      headingStyle: options?.headingStyle || "atx",
      hr: options?.hr || "---",
      bulletListMarker: options?.bulletListMarker || "-",
      codeBlockStyle: options?.codeBlockStyle || "fenced",
      fence: options?.fence || "```",
      emDelimiter: options?.emDelimiter || "*",
      strongDelimiter: options?.strongDelimiter || "**",
      linkStyle: options?.linkStyle || "inlined",
      linkReferenceStyle: options?.linkReferenceStyle || "full",
    });

    this.turndownService.addRule("mermaidCodeBlock", {
      filter: (node: HTMLElement) =>
        node.nodeName === "PRE" &&
        !!node.firstChild &&
        (node.firstChild as HTMLElement).nodeName === "CODE" &&
        /(^|\s)language-mermaid(\s|$)/.test((node.firstChild as HTMLElement).className || ""),
      replacement: (_content: string, node: HTMLElement) => {
        const codeNode = node.firstChild as HTMLElement;
        let raw = (codeNode?.textContent || "")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&");
        return "```mermaid\n" + raw.trim() + "\n```\n\n";
      },
    });

    this.turndownService.addRule("tiptapTable", {
      filter: "table",
      replacement: (_content: string, node: HTMLElement) => {
        const getText = (el: HTMLElement | null) => (el?.textContent || "").trim();
        const headerThs = Array.from(node.querySelectorAll("tr:first-child th")) as HTMLElement[];
        const hasHeader = headerThs.length > 0;
        const headers = hasHeader ? headerThs.map((th) => getText(th)) : [];
        const allRows = Array.from(node.querySelectorAll("tr")) as HTMLElement[];
        const dataRows = allRows.slice(hasHeader ? 1 : 0);
        const rows: string[][] = dataRows.map((tr) => {
          const cells = Array.from(tr.querySelectorAll("td,th")) as HTMLElement[];
          return cells.map((td) => getText(td));
        });
        if (headers.length > 0) {
          const headerLine = `| ${headers.join(" | ")} |`;
          const sepLine = `|${headers.map(() => "---------").join("|")}|`;
          const body = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
          return `\n${headerLine}\n${sepLine}\n${body}\n`;
        }
        return `\n${rows.map((r) => `| ${r.join(" | ")} |`).join("\n")}\n`;
      },
    });

    this.turndownService.addRule("preserveNumberedLists", {
      filter: "ol",
      replacement: (content: string) =>
        content.replace(/^\d+\.\s/gm, (match) => {
          const num = match.replace(/\.\s/, "");
          return `${num}. `;
        }) + "\n",
    });

    this.turndownService.addRule("preserveBulletLists", {
      filter: "ul",
      replacement: (content: string) => content.replace(/^-\s+/gm, "- ") + "\n",
    });

    this.turndownService.addRule("preserveHeaders", {
      filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
      replacement: (content: string, node: HTMLElement) => {
        const level = parseInt(node.tagName.charAt(1), 10);
        return "#".repeat(level) + " " + content + "\n";
      },
    });

    this.turndownService.addRule("tightParagraph", {
      filter: "p",
      replacement: (content: string) => content + "\n",
    });

    if (options?.markedOptions) {
      marked.setOptions(options.markedOptions as { breaks?: boolean; gfm?: boolean; pedantic?: boolean });
    } else {
      marked.setOptions({ breaks: true, gfm: true, pedantic: false });
    }
  }

  htmlToMarkdown(html: string): string {
    if (!html || typeof html !== "string") return "";
    try {
      let markdown = this.turndownService.turndown(html);
      return this.postProcessMarkdown(markdown);
    } catch (error) {
      throw new Error(
        `Failed to convert HTML to Markdown: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private postProcessMarkdown(markdown: string): string {
    return markdown
      .replace(/(\d+)\\\./g, "$1.")
      .replace(/^(-\s+)/gm, "- ")
      .replace(/^(\d+\.\s+)/gm, (match) => `${match.replace(/\.\s+/, "").replace(/\s+$/, "")}. `)
      .replace(/^\s+(\d+\.\s)/gm, "$1")
      .replace(/^\s+(-\s)/gm, "$1")
      .replace(/^(#{1,6}\s[^\n]+)\n([^\n#\s])/gm, "$1\n\n$2")
      .replace(/([^\n])\n\|/g, "$1\n\n|")
      .replace(/\|\n([^\n])/g, "|\n\n$1")
      .replace(/([^\n])```mermaid/g, "$1\n```mermaid")
      .replace(/```\n{2,}/g, "```\n\n")
      .replace(/([^\n#])\n([^\n#\-*\d|])/g, "$1\n\n$2")
      .replace(/^(#{1,6}\s[^\n]+)\n\n([^\n#])/gm, "$1\n$2")
      .replace(/([^\n])\n([^\n#\-*\d|])/g, "$1\n\n$2")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/\n+$/, "");
  }

  markdownToHtml(markdown: string): string {
    if (!markdown || typeof markdown !== "string") return "";
    try {
      const segments: string[] = [];
      const TABLE_START = /^(\|.*)\n(\|\s*-+\s*(\|\s*-+\s*)+\|)\s*$/m;
      let rest = markdown;
      while (rest.length > 0) {
        const match = rest.match(TABLE_START);
        if (!match) {
          segments.push(this.renderMarkdownChunk(rest));
          break;
        }
        const idx = match.index ?? 0;
        const before = rest.slice(0, idx);
        if (before.trim()) segments.push(this.renderMarkdownChunk(before));
        const after = rest.slice(idx);
        const lines = after.split("\n");
        let i = 0;
        let tableBlock = lines[i++] + "\n";
        tableBlock += lines[i++] + "\n";
        while (i < lines.length && /^\|/.test(lines[i])) {
          tableBlock += lines[i++] + "\n";
        }
        segments.push(this.buildTiptapTableFromMarkdown(tableBlock.trimEnd()));
        rest = lines.slice(i).join("\n");
      }
      let html = segments.join("");
      return this.postProcessHtml(html);
    } catch (error) {
      throw new Error(
        `Failed to convert Markdown to HTML: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private preProcessMarkdown(markdown: string): string {
    const hasMarkdownSyntax = /^#{1,6}\s|^\*\s|^-\s|^\d+\.\s|```|`|\[.*\]\(.*\)|!\[.*\]\(.*\)|^\s*>\s/m.test(markdown);
    if (!hasMarkdownSyntax && markdown.trim()) {
      const paragraphs = markdown
        .split("\n\n")
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
        .map((p) => p.replace(/\n/g, " "));
      return paragraphs.join("\n\n");
    }
    return markdown;
  }

  private postProcessHtml(html: string): string {
    return html
      .replace(/(<\/h[1-6]>)(<h[1-6])/g, "$1\n$2")
      .replace(/(<\/ul>)(<ul>)/g, "$1\n$2")
      .replace(/(<\/ol>)(<ol>)/g, "$1\n$2")
      .replace(/(<\/li>)(<li>)/g, "$1\n$2")
      .replace(/\n{3,}/g, "\n")
      .replace(/\n+$/, "");
  }

  private renderMarkdownChunk(md: string): string {
    return marked.parse(this.preProcessMarkdown(md)) as string;
  }

  private buildTiptapTableFromMarkdown(tableBlock: string): string {
    const lines = tableBlock.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length < 2) return "";
    const splitRow = (line: string) =>
      line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim());
    const headers = splitRow(lines[0]);
    const rows = lines.slice(2).map(splitRow);
    const colCount = headers.length;
    const colgroup = `<colgroup>${Array.from({ length: colCount }, () => '<col style="min-width: 25px;">').join("")}</colgroup>`;
    const headerRow = `<tr>${headers.map((h) => `<th colspan="1" rowspan="1"><p>${h}</p></th>`).join("")}</tr>`;
    const bodyRows = rows.map((r) => `<tr>${r.map((c) => `<td colspan="1" rowspan="1"><p>${c}</p></td>`).join("")}</tr>`).join("");
    return `<table style="min-width: 225px;">${colgroup}<tbody>${headerRow}${bodyRows}</tbody></table>`;
  }

  batchHtmlToMarkdown(htmlArray: string[]): string[] {
    if (!Array.isArray(htmlArray)) throw new Error("Input must be an array of HTML strings");
    return htmlArray.map((html, index) => {
      try {
        return this.htmlToMarkdown(html);
      } catch (error) {
        throw new Error(`Failed to convert HTML at index ${index}: ${error instanceof Error ? error.message : ""}`);
      }
    });
  }

  batchMarkdownToHtml(markdownArray: string[]): string[] {
    if (!Array.isArray(markdownArray)) throw new Error("Input must be an array of Markdown strings");
    return markdownArray.map((md, index) => {
      try {
        return this.markdownToHtml(md);
      } catch (error) {
        throw new Error(`Failed to convert Markdown at index ${index}: ${error instanceof Error ? error.message : ""}`);
      }
    });
  }

  isValidHtml(html: string): boolean {
    if (!html || typeof html !== "string") return false;
    return /<[^>]*>/g.test(html) || html.trim().length === 0;
  }

  isValidMarkdown(markdown: string): boolean {
    if (!markdown || typeof markdown !== "string") return false;
    return /^#{1,6}\s|^\*\s|^-\s|^\d+\.\s|```|`|\[.*\]\(.*\)|!\[.*\]\(.*\)/m.test(markdown) || markdown.trim().length === 0;
  }

  sanitizeHtml(html: string): string {
    if (!html || typeof html !== "string") return "";
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/on\w+="[^"]*"/gi, "")
      .replace(/javascript:/gi, "");
  }

  markdownToJson(markdown: string): TiptapDocument {
    if (!markdown || typeof markdown !== "string") return { type: "doc", content: [] };
    try {
      const lines = markdown.split("\n");
      const content: TiptapNode[] = [];
      let i = 0;
      while (i < lines.length) {
        const line = lines[i].trim();
        if (!line) {
          i++;
          continue;
        }
        if (line.startsWith("#")) {
          const level = line.match(/^#+/)?.[0].length ?? 1;
          const text = line.replace(/^#+\s*/, "");
          content.push({
            type: "heading",
            attrs: { level: Math.min(level, 6) },
            content: [{ type: "text", text }],
          });
          i++;
          continue;
        }
        if (line.match(/^\d+\.\s/) || line.match(/^[-*+]\s/)) {
          const listItems: TiptapNode[] = [];
          const isOrdered = !!line.match(/^\d+\.\s/);
          while (i < lines.length && (lines[i].match(/^\d+\.\s/) || lines[i].match(/^[-*+]\s/))) {
            const itemText = lines[i].replace(/^(\d+\.\s|[-*+]\s)/, "").trim();
            listItems.push({
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: itemText }] }],
            });
            i++;
          }
          content.push({ type: isOrdered ? "orderedList" : "bulletList", content: listItems });
          continue;
        }
        if (line.startsWith("|")) {
          const tableRows: TiptapNode[] = [];
          while (i < lines.length && lines[i].startsWith("|")) {
            const cells = lines[i].split("|").slice(1, -1).map((c) => c.trim());
            const isHeader = i === 0 || lines[i].includes("---");
            if (!isHeader) {
              tableRows.push({
                type: "tableRow",
                content: cells.map((cell) => ({
                  type: "tableCell",
                  content: [{ type: "paragraph", content: [{ type: "text", text: cell }] }],
                })),
              });
            }
            i++;
          }
          if (tableRows.length > 0) content.push({ type: "table", content: tableRows });
          continue;
        }
        if (line.startsWith("```")) {
          const language = line.replace("```", "").trim();
          const codeLines: string[] = [];
          i++;
          while (i < lines.length && !lines[i].startsWith("```")) {
            codeLines.push(lines[i]);
            i++;
          }
          i++;
          if (language === "mermaid") {
            content.push({ type: "mermaid", attrs: { code: codeLines.join("\n") } });
          } else {
            content.push({
              type: "codeBlock",
              attrs: { language },
              content: [{ type: "text", text: codeLines.join("\n") }],
            });
          }
          continue;
        }
        const paragraphLines: string[] = [line];
        i++;
        while (i < lines.length && lines[i].trim() && !lines[i].startsWith("#") && !lines[i].startsWith("|") && !lines[i].startsWith("```")) {
          paragraphLines.push(lines[i].trim());
          i++;
        }
        const paragraphText = paragraphLines.join(" ");
        if (paragraphText.trim()) {
          content.push({ type: "paragraph", content: this.parseInlineMarkdown(paragraphText) });
        }
      }
      return { type: "doc", content };
    } catch (error) {
      throw new Error(`Failed to convert Markdown to JSON: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  jsonToMarkdown(json: TiptapDocument): string {
    if (!json.content) return "";
    return json.content.map((node) => this.convertNodeToMarkdown(node)).join("\n\n");
  }

  jsonToHtml(json: TiptapDocument): string {
    if (!json.content) return "";
    return json.content.map((node) => this.convertNodeToHtml(node)).join("");
  }

  private parseInlineMarkdown(text: string): TiptapNode[] {
    const nodes: TiptapNode[] = [];
    let currentText = text;
    let pos = 0;
    while (pos < currentText.length) {
      const boldMatch = currentText.slice(pos).match(/^\*\*(.*?)\*\*/);
      if (boldMatch) {
        if (pos > 0) nodes.push({ type: "text", text: currentText.slice(0, pos) });
        nodes.push({ type: "text", text: boldMatch[1], marks: [{ type: "bold" }] });
        currentText = currentText.slice(pos + boldMatch[0].length);
        pos = 0;
        continue;
      }
      const italicMatch = currentText.slice(pos).match(/^\*(.*?)\*/);
      if (italicMatch) {
        if (pos > 0) nodes.push({ type: "text", text: currentText.slice(0, pos) });
        nodes.push({ type: "text", text: italicMatch[1], marks: [{ type: "italic" }] });
        currentText = currentText.slice(pos + italicMatch[0].length);
        pos = 0;
        continue;
      }
      pos++;
    }
    if (currentText) nodes.push({ type: "text", text: currentText });
    return nodes.length > 0 ? nodes : [{ type: "text", text }];
  }

  private convertNodeToMarkdown(node: TiptapNode): string {
    switch (node.type) {
      case "heading": {
        const level = (node.attrs?.level as number) || 1;
        const headingText = node.content?.map((c) => this.convertNodeToMarkdown(c)).join("") || "";
        return "#".repeat(level) + " " + headingText;
      }
      case "paragraph":
        return node.content?.map((c) => this.convertNodeToMarkdown(c)).join("") || "";
      case "text": {
        let text = node.text || "";
        for (const mark of node.marks ?? []) {
          if (mark.type === "bold") text = `**${text}**`;
          else if (mark.type === "italic") text = `*${text}*`;
        }
        return text;
      }
      case "bulletList":
        return node.content?.map((c) => this.convertNodeToMarkdown(c)).join("\n") || "";
      case "orderedList":
        return node.content?.map((c) => this.convertNodeToMarkdown(c)).join("\n") || "";
      case "listItem":
        return "- " + (node.content?.map((c) => this.convertNodeToMarkdown(c)).join("") || "");
      case "table":
        return node.content?.map((c) => this.convertNodeToMarkdown(c)).join("\n") || "";
      case "tableRow":
        return "| " + (node.content?.map((c) => this.convertNodeToMarkdown(c)).join(" | ") || "") + " |";
      case "tableCell":
        return node.content?.map((c) => this.convertNodeToMarkdown(c)).join("") || "";
      case "codeBlock": {
        const language = (node.attrs?.language as string) || "";
        const code = node.content?.map((c) => this.convertNodeToMarkdown(c)).join("") || "";
        return "```" + language + "\n" + code + "\n```";
      }
      case "mermaid":
        return "```mermaid\n" + ((node.attrs?.code as string) || "") + "\n```";
      default:
        return node.content?.map((c) => this.convertNodeToMarkdown(c)).join("") || "";
    }
  }

  private convertNodeToHtml(node: TiptapNode): string {
    switch (node.type) {
      case "heading": {
        const level = (node.attrs?.level as number) || 1;
        const headingText = node.content?.map((c) => this.convertNodeToHtml(c)).join("") || "";
        return `<h${level}>${headingText}</h${level}>`;
      }
      case "paragraph":
        return "<p>" + (node.content?.map((c) => this.convertNodeToHtml(c)).join("") || "") + "</p>";
      case "text": {
        let text = node.text || "";
        for (const mark of node.marks ?? []) {
          if (mark.type === "bold") text = `<strong>${text}</strong>`;
          else if (mark.type === "italic") text = `<em>${text}</em>`;
        }
        return text;
      }
      case "bulletList":
        return "<ul>" + (node.content?.map((c) => this.convertNodeToHtml(c)).join("") || "") + "</ul>";
      case "orderedList":
        return "<ol>" + (node.content?.map((c) => this.convertNodeToHtml(c)).join("") || "") + "</ol>";
      case "listItem":
        return "<li>" + (node.content?.map((c) => this.convertNodeToHtml(c)).join("") || "") + "</li>";
      case "table":
        return "<table>" + (node.content?.map((c) => this.convertNodeToHtml(c)).join("") || "") + "</table>";
      case "tableRow":
        return "<tr>" + (node.content?.map((c) => this.convertNodeToHtml(c)).join("") || "") + "</tr>";
      case "tableCell":
        return "<td>" + (node.content?.map((c) => this.convertNodeToHtml(c)).join("") || "") + "</td>";
      case "codeBlock": {
        const language = (node.attrs?.language as string) || "";
        const code = node.content?.map((c) => this.convertNodeToHtml(c)).join("") || "";
        return `<pre><code class="language-${language}">${code}</code></pre>`;
      }
      case "mermaid":
        return `<pre><code class="language-mermaid">${(node.attrs?.code as string) || ""}</code></pre>`;
      default:
        return node.content?.map((c) => this.convertNodeToHtml(c)).join("") || "";
    }
  }

  getContentStats(
    content: string,
    type: "html" | "markdown"
  ): { length: number; lines: number; words: number; characters: number; type: string } {
    if (!content || typeof content !== "string") {
      return { length: 0, lines: 0, words: 0, characters: 0, type };
    }
    return {
      length: content.length,
      lines: content.split("\n").length,
      words: content.split(/\s+/).filter((w) => w.length > 0).length,
      characters: content.length,
      type,
    };
  }
}

export const formatConverter = new FormatConverter();
export const md2html = (markdown: string) => formatConverter.markdownToHtml(markdown);
export const html2md = (html: string) => formatConverter.htmlToMarkdown(html);
export const batchHtml2md = (htmlArray: string[]) => formatConverter.batchHtmlToMarkdown(htmlArray);
export const batchMd2html = (markdownArray: string[]) => formatConverter.batchMarkdownToHtml(markdownArray);
export const md2json = (markdown: string) => formatConverter.markdownToJson(markdown);
export const json2md = (json: TiptapDocument) => formatConverter.jsonToMarkdown(json);
export const json2html = (json: TiptapDocument) => formatConverter.jsonToHtml(json);
export default FormatConverter;
