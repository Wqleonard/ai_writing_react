import { Mark, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const ACTIVE_HIGHLIGHT_META = "tokenizer-highlight-active-meta";
const BRACKET_MARKER_END = "[[[hl-end]]]";
const BRACKET_START_MARKER_REGEX = /\[\[\[hl-start:([A-Za-z0-9_-]+)\]\]\]/g;
const MARKER_END = "<<<--highlight-end-->>>";
const START_MARKER_REGEX =
  /<<<--highlight-start(?:\s+data-highlight-id="([^"]+)")?\s*-->>>/g;
const activeHighlightPluginKey = new PluginKey<{
  activeId: string | null;
  decorations: DecorationSet;
}>("tokenizer-highlight-active-decoration");
const markerTransformPluginKey = new PluginKey("tokenizer-highlight-marker-transform");

type MarkerRange = {
  from: number;
  to: number;
  type: "start" | "end";
  highlightId?: string;
};

const buildActiveDecorations = (
  doc: any,
  markType: any,
  activeId: string | null
): DecorationSet => {
  if (!markType || !activeId) return DecorationSet.empty;
  const decorations: Decoration[] = [];
  doc.descendants((node: any, pos: number) => {
    if (!node?.isText) return true;
    const highlightMark = node.marks?.find((mark: any) => mark.type === markType);
    const attrs = highlightMark?.attrs ?? {};
    const markId =
      (typeof attrs.id === "string" && attrs.id) ||
      (typeof attrs.highlightId === "string" && attrs.highlightId) ||
      (typeof attrs["data-highlight-id"] === "string" && attrs["data-highlight-id"]) ||
      null;
    if (markId && markId === activeId) {
      decorations.push(
        Decoration.inline(pos, pos + node.nodeSize, {
          class: "streamed-content-active",
        })
      );
    }
    return true;
  });
  return decorations.length > 0
    ? DecorationSet.create(doc, decorations)
    : DecorationSet.empty;
};

const collectMarkerRanges = (doc: any): MarkerRange[] => {
  const ranges: MarkerRange[] = [];
  doc.descendants((node: any, pos: number) => {
    if (!node?.isText) return true;
    const text = node.text || "";

    BRACKET_START_MARKER_REGEX.lastIndex = 0;
    let bracketStartMatch: RegExpExecArray | null = null;
    while ((bracketStartMatch = BRACKET_START_MARKER_REGEX.exec(text)) !== null) {
      ranges.push({
        from: pos + bracketStartMatch.index,
        to: pos + bracketStartMatch.index + bracketStartMatch[0].length,
        type: "start",
        highlightId: bracketStartMatch[1] || undefined,
      });
    }

    START_MARKER_REGEX.lastIndex = 0;
    let startMatch: RegExpExecArray | null = null;
    while ((startMatch = START_MARKER_REGEX.exec(text)) !== null) {
      ranges.push({
        from: pos + startMatch.index,
        to: pos + startMatch.index + startMatch[0].length,
        type: "start",
        highlightId: startMatch[1] || undefined,
      });
    }

    let searchPos = 0;
    while (true) {
      const bracketEndIndex = text.indexOf(BRACKET_MARKER_END, searchPos);
      if (bracketEndIndex !== -1) {
        ranges.push({
          from: pos + bracketEndIndex,
          to: pos + bracketEndIndex + BRACKET_MARKER_END.length,
          type: "end",
        });
        searchPos = bracketEndIndex + 1;
        continue;
      }
      const endIndex = text.indexOf(MARKER_END, searchPos);
      if (endIndex === -1) break;
      ranges.push({
        from: pos + endIndex,
        to: pos + endIndex + MARKER_END.length,
        type: "end",
      });
      searchPos = endIndex + 1;
    }
    return true;
  });
  return ranges.sort((a, b) => a.from - b.from);
};

const pairMarkerRanges = (
  ranges: MarkerRange[]
): Array<{ start: number; end: number; highlightId?: string }> => {
  const pairs: Array<{ start: number; end: number; highlightId?: string }> = [];
  const stack: Array<{ pos: number; length: number; highlightId?: string }> = [];
  ranges.forEach((range) => {
    if (range.type === "start") {
      stack.push({
        pos: range.from,
        length: range.to - range.from,
        highlightId: range.highlightId,
      });
      return;
    }
    const startInfo = stack.pop();
    if (!startInfo) return;
    pairs.push({
      start: startInfo.pos + startInfo.length,
      end: range.from,
      highlightId: startInfo.highlightId,
    });
  });
  return pairs;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    tokenizerHighlight: {
      setActiveTokenizerHighlight: (id: string) => ReturnType;
      clearActiveTokenizerHighlight: () => ReturnType;
    };
  }
}

const TokenizerHighlight = Mark.create({
  name: "highlight",

  addOptions() {
    return {
      HTMLAttributes: {
        class: "streamed-content",
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: markerTransformPluginKey,
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const markType = newState.schema.marks.highlight;
          if (!markType) return null;

          const markerRanges = collectMarkerRanges(newState.doc);
          if (markerRanges.length === 0) return null;

          const pairs = pairMarkerRanges(markerRanges);
          if (pairs.length === 0) return null;

          let tr = newState.tr;
          const sorted = [...markerRanges].sort((a, b) => a.from - b.from);
          const getAdjustedPos = (pos: number): number => {
            let offset = 0;
            for (const range of sorted) {
              if (range.to <= pos) offset += range.to - range.from;
              else break;
            }
            return pos - offset;
          };

          [...markerRanges]
            .sort((a, b) => b.from - a.from)
            .forEach((range) => {
              tr = tr.delete(range.from, range.to);
            });

          pairs.forEach((pair) => {
            const from = getAdjustedPos(pair.start);
            const to = getAdjustedPos(pair.end);
            if (from >= to || from < 0 || to > tr.doc.content.size) return;
            const attrs = pair.highlightId
              ? { id: pair.highlightId, class: "streamed-content" }
              : { class: "streamed-content" };
            tr = tr.addMark(from, to, markType.create(attrs));
          });

          return tr.docChanged ? tr : null;
        },
      }),
      new Plugin({
        key: activeHighlightPluginKey,
        state: {
          init: (
            _,
            state
          ): { activeId: string | null; decorations: DecorationSet } => {
            const markType = state.schema.marks.highlight;
            return {
              activeId: null,
              decorations: buildActiveDecorations(state.doc, markType, null),
            };
          },
          apply: (
            tr,
            prev: { activeId: string | null; decorations: DecorationSet },
            _oldState,
            newState
          ): { activeId: string | null; decorations: DecorationSet } => {
            const meta = tr.getMeta(ACTIVE_HIGHLIGHT_META) as
              | { activeId: string | null }
              | undefined;
            const nextActiveId =
              meta && Object.prototype.hasOwnProperty.call(meta, "activeId")
                ? meta.activeId
                : prev.activeId;
            if (!tr.docChanged && !meta) return prev;
            const markType = newState.schema.marks.highlight;
            return {
              activeId: nextActiveId,
              decorations: buildActiveDecorations(
                newState.doc,
                markType,
                nextActiveId
              ),
            };
          },
        },
        props: {
          decorations(state) {
            return activeHighlightPluginKey.getState(state)?.decorations ?? null;
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      setActiveTokenizerHighlight:
        (id: string) =>
        ({ state, dispatch }) => {
          if (!dispatch) return true;
          dispatch(
            state.tr.setMeta(ACTIVE_HIGHLIGHT_META, { activeId: id || null })
          );
          return true;
        },
      clearActiveTokenizerHighlight:
        () =>
        ({ state, dispatch }) => {
          if (!dispatch) return true;
          dispatch(state.tr.setMeta(ACTIVE_HIGHLIGHT_META, { activeId: null }));
          return true;
        },
    };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute("data-highlight-id") || element.getAttribute("id"),
        renderHTML: (attributes) => {
          if (!attributes.id) return {};
          return {
            id: attributes.id,
            "data-highlight-id": attributes.id,
          };
        },
      },
      class: {
        default: this.options.HTMLAttributes.class,
        parseHTML: (element) =>
          element.getAttribute("class") || this.options.HTMLAttributes.class,
        renderHTML: (attributes) => ({
          class: attributes.class || this.options.HTMLAttributes.class,
        }),
      },
      isActive: {
        default: false,
        parseHTML: (element) =>
          element.classList.contains("streamed-content-active"),
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "mark" }, { tag: "span" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["mark", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  markdownTokenizer: {
    name: "highlight",
    level: "inline",
    start: (src) => {
      const bracketIndex = src.indexOf("[[[hl-start:");
      const markerIndex = src.indexOf("<<<--highlight-start");
      const equalIndex = src.indexOf("==");
      const indexes = [bracketIndex, markerIndex, equalIndex].filter(
        (index) => index >= 0
      );
      if (indexes.length === 0) return -1;
      return Math.min(...indexes);
    },
    tokenize: (src, _tokens, lexer) => {
      const bracketMatch =
        /^\[\[\[hl-start:([A-Za-z0-9_-]+)\]\]\]([\s\S]*?)\[\[\[hl-end\]\]\]/.exec(
          src
        );
      if (bracketMatch) {
        return {
          type: "highlight",
          raw: bracketMatch[0],
          text: bracketMatch[2],
          highlightId: bracketMatch[1],
          tokens: lexer.inlineTokens(bracketMatch[2]),
        };
      }
      const markerMatch =
        /^<<<--highlight-start(?:\s+data-highlight-id="([^"]+)")?\s*-->>>\n?([\s\S]*?)<<<--highlight-end-->>>/.exec(
          src
        );
      if (markerMatch) {
        return {
          type: "highlight",
          raw: markerMatch[0],
          text: markerMatch[2],
          highlightId: markerMatch[1],
          tokens: lexer.inlineTokens(markerMatch[2]),
        };
      }

      const withIdMatch = /^==#([A-Za-z0-9_-]+)#([\s\S]+?)==/.exec(src);
      if (withIdMatch) {
        return {
          type: "highlight",
          raw: withIdMatch[0],
          text: withIdMatch[2],
          highlightId: withIdMatch[1],
          tokens: lexer.inlineTokens(withIdMatch[2]),
        };
      }

      const match = /^==([\s\S]+?)==/.exec(src);
      if (!match) {
        return undefined;
      }

      return {
        type: "highlight",
        raw: match[0],
        text: match[1],
        tokens: lexer.inlineTokens(match[1]),
      };
    },
  },

  parseMarkdown: (token, helpers) => {
    const tokenRaw = typeof token?.raw === "string" ? token.raw : "";
    const fallbackId =
      /data-highlight-id="([^"]+)"/.exec(tokenRaw)?.[1] ||
      /\[\[\[hl-start:([A-Za-z0-9_-]+)\]\]\]/.exec(tokenRaw)?.[1];
    const highlightId =
      typeof token?.highlightId === "string" && token.highlightId
        ? token.highlightId
        : fallbackId;
    const attrs =
      typeof highlightId === "string" && highlightId
        ? { id: highlightId, class: "streamed-content" }
        : { class: "streamed-content" };
    return helpers.applyMark(
      "highlight",
      helpers.parseInline(token.tokens || []),
      attrs
    );
  },

  renderMarkdown: (node, helpers) => {
    const content = helpers.renderChildren(node);
    const attrs = (node && node.attrs) || {};
    const id =
      (typeof attrs.id === "string" && attrs.id) ||
      (typeof attrs.highlightId === "string" && attrs.highlightId) ||
      "";
    return id
      ? `[[[hl-start:${id}]]]${content}[[[hl-end]]]`
      : `==${content}==`;
  },
});

export default TokenizerHighlight;