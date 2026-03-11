import { Mark } from "@tiptap/core";

const TokenizerHighlight = Mark.create({
  name: "highlight",

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("id"),
        renderHTML: (attributes) => {
          if (!attributes.id) return {};
          return { id: attributes.id };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "mark" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["mark", HTMLAttributes, 0];
  },

  markdownTokenizer: {
    name: "highlight",
    level: "inline",
    start: (src) => src.indexOf("=="),
    tokenize: (src, _tokens, lexer) => {
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
    const attrs =
      typeof token.highlightId === "string" && token.highlightId
        ? { id: token.highlightId }
        : undefined;
    return helpers.applyMark(
      "highlight",
      helpers.parseInline(token.tokens || []),
      attrs
    );
  },

  renderMarkdown: (node, helpers) => {
    const content = helpers.renderChildren(node);
    const id =
      node && node.attrs && typeof node.attrs.id === "string"
        ? node.attrs.id
        : "";
    return id ? `==#${id}#${content}==` : `==${content}==`;
  },
});

export default TokenizerHighlight;