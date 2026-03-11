import { Mark, mergeAttributes } from "@tiptap/core";

export interface StreamedContentOptions {
  HTMLAttributes: Record<string, any>;
}

type StreamedContentToken = {
  type?: string;
  raw: string;
  highlightId?: string | null;
  text?: string;
  tokens?: any[];
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    streamedContent: {
      setStreamedContent: () => ReturnType;
      toggleStreamedContent: () => ReturnType;
      unsetStreamedContent: () => ReturnType;
    };
  }
}

const StreamedContentMark = Mark.create<StreamedContentOptions>({
  name: "streamedContent",

  addOptions() {
    return {
      HTMLAttributes: {
        class: "streamed-content",
      },
    };
  },

  addAttributes() {
    return {
      class: {
        default: this.options.HTMLAttributes.class,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("class") || this.options.HTMLAttributes.class,
        renderHTML: (attributes: Record<string, any>) => {
          let className = attributes.class || this.options.HTMLAttributes.class;
          if (attributes.isActive) {
            className = `${className} streamed-content-active`.trim();
          }
          return { class: className };
        },
      },
      highlightId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-highlight-id"),
        renderHTML: (attributes: Record<string, any>) =>
          attributes.highlightId ? { "data-highlight-id": attributes.highlightId } : {},
      },
      isActive: {
        default: false,
        parseHTML: (element: HTMLElement) => element.classList.contains("streamed-content-active"),
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[class*="streamed-content"]',
        getAttrs: (node: unknown) => {
          if (!(node instanceof HTMLElement)) return false;
          return node.classList.contains("streamed-content") ? {} : false;
        },
      },
    ];
  },

  // Define the custom tokenizer
  // note - this turns Markdown strings into tokens
  markdownTokenizer: {
    name: "streamedContent",
    level: "inline",

    // Optimization: return where custom syntax may start
    start: (src: string) => {
      return src.indexOf("<<<--highlight-start");
    },

    // Parse marker syntax at the beginning of src
    tokenize: (
      src: string,
      _tokens: unknown[],
      lexer: { inlineTokens: (value: string) => any[] }
    ) => {
      const match =
        /^<<<--highlight-start(?:\s+data-highlight-id="([^"]+)")?\s*-->>>([\s\S]*?)<<<--highlight-end-->>>/.exec(
          src
        );

      if (!match) {
        return undefined;
      }

      const text = match[2] || "";
      return {
        type: "streamedContent",
        raw: match[0],
        highlightId: match[1] || null,
        text,
        tokens: lexer.inlineTokens(text),
      } as any;
    },
  },

  // Consume tokens and convert to Tiptap JSON mark
  parseMarkdown: (token: any, helpers: any) => {
    const attrs = token.highlightId ? { highlightId: token.highlightId } : {};
    return helpers.applyMark(
      "streamedContent",
      helpers.parseInline(token.tokens || []),
      attrs
    );
  },

  // Convert mark back to marker syntax in Markdown
  renderMarkdown: (node: { attrs?: { highlightId?: string } }, helpers: any) => {
    const content = helpers.renderChildren(node);
    const highlightId = node.attrs?.highlightId;
    const startMarker = highlightId
      ? `<<<--highlight-start data-highlight-id="${highlightId}"-->>>`
      : '<<<--highlight-start-->>>';
    return `${startMarker}${content}${'<<<--highlight-end-->>>'}`;
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setStreamedContent:
        () =>
        ({ commands }) =>
          commands.setMark(this.name),
      toggleStreamedContent:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
      unsetStreamedContent:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});

export default StreamedContentMark;
