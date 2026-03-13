/**
 * React markdown parser hook.
 * Vue 版使用 @nuxtjs/mdc + Shiki；React 可在此接入 react-markdown + rehype-highlight 等。
 * 当前提供简单实现：返回原始 HTML 字符串（可后续替换为真实解析）。
 */
export function useMarkdownParser() {
  const parse = async (markdown: string): Promise<string> => {
    if (!markdown) return "";
    // 占位：可接入 marked / react-markdown + rehype-plugins 等
    return markdown;
  };
  return parse;
}
