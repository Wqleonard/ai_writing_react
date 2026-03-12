export type TreeNodeLike = {
  id: string;
  content?: string;
  children?: TreeNodeLike[];
};

export type SearchMatch = {
  actualIndex: number;
  preview: string;
};

type TreeNodeMatcher = (id: string) => boolean;

export const parseGuidesPayload = (raw: string[] | string | undefined): string[] => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw) as string[] | unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// 过滤“父目录 + 子目录”同时选中的冗余项，只保留更上层选择
export const filterAssociationIds = (ids: string[]): string[] =>
  ids.filter(
    (id) =>
      !ids.some(
        (other) =>
          other !== id && (id.startsWith(`${other}/`) || id === `${other}/`)
      )
  );

export const findTreeNodeRecursive = (
  nodes: TreeNodeLike[],
  predicate: (id: string) => boolean,
): TreeNodeLike | null => {
  for (const node of nodes) {
    if (predicate(node.id)) return node;
    if (node.children && node.children.length > 0) {
      const found = findTreeNodeRecursive(node.children, predicate);
      if (found) return found;
    }
  }
  return null;
};

export const resolveFileNodeByPath = (
  tree: TreeNodeLike[],
  normalizedPath: string,
): TreeNodeLike | null => {
  if (!normalizedPath) return null;
  const isPathLike = normalizedPath.includes("/");
  const suffixPath = `/${normalizedPath}`;
  // 按“精确到宽松”顺序匹配，尽量先命中最可信路径
  const matcherStrategies: TreeNodeMatcher[] = [];
  if (isPathLike) {
    matcherStrategies.push(
      (id) => id === normalizedPath,
      (id) => id.endsWith(suffixPath),
    );
  }
  matcherStrategies.push(
    (id) => id === normalizedPath || id.endsWith(suffixPath),
    (id) => id.includes(suffixPath),
  );

  for (const matcher of matcherStrategies) {
    const hit = findTreeNodeRecursive(tree, matcher);
    if (hit) return hit;
  }
  return null;
};

// 清洗消息中带 query/前缀的文件路径，统一成可匹配的 tree path
export const sanitizeIncomingFilePath = (rawFileName: string): string =>
  (rawFileName || "")
    .trim()
    .replace(/^\.?\//, "")
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "")
    .trim();

export const findSearchMatches = (source: string, query: string): SearchMatch[] => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];
  const sourceLower = source.toLowerCase();
  const list: SearchMatch[] = [];
  let idx = 0;
  while ((idx = sourceLower.indexOf(normalizedQuery, idx)) !== -1) {
    const start = Math.max(0, idx - 20);
    const end = Math.min(source.length, idx + normalizedQuery.length + 20);
    list.push({
      actualIndex: idx,
      preview: source.slice(start, end),
    });
    idx += 1;
  }
  return list;
};
