/**
 * serverData <-> 文件树转换，与 Vue aiTreeNodeConverter 对齐（最简版，无 md2json）。
 */
import type { FileTreeNode, ServerData } from "./types";

const HAS_EXT = /\.(md|txt|jpg|jpeg|png|gif|pdf|doc|docx|xls|xlsx|ppt|pptx)$/i;

function getFileExtension(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return ext ?? "file";
}

/**
 * 统一路径比较格式：
 * - 忽略前导 "/"
 * - 忽略尾随 "/"（目录也按同一规则比较）
 */
function normalizeNodeIdForCompare(id: string): string {
  return (id ?? "").replace(/^\/+/, "").replace(/\/+$/, "");
}

/** ServerData 转为树根节点的 children（用于侧边栏展示） */
export function serverDataToTree(serverData: ServerData): FileTreeNode[] {
  const nodeMap = new Map<string, FileTreeNode>();
  const rootChildren: FileTreeNode[] = [];
  const orderedNodePaths: string[] = [];
  const keys = Object.keys(serverData);
  const createDirectoryNode = (parts: string[]): FileTreeNode => ({
    id: parts.join("/"),
    key: parts.join("-"),
    label: parts[parts.length - 1] ?? "",
    content: "",
    isDirectory: true,
    path: parts,
    fileType: "directory",
    children: [],
  });

  const ensureDirectoryPath = (parts: string[]) => {
    for (let i = 1; i <= parts.length; i++) {
      const segmentParts = parts.slice(0, i);
      const segmentPath = segmentParts.join("/");
      if (!segmentPath || nodeMap.has(segmentPath)) continue;
      nodeMap.set(segmentPath, createDirectoryNode(segmentParts));
      orderedNodePaths.push(segmentPath);
    }
  };

  for (const key of keys) {
    if (!key.endsWith("/") && !HAS_EXT.test(key)) continue;
    const pathParts = key.split("/").filter((p) => p !== "");
    if (pathParts.length === 0) continue;
    const isDir = key.endsWith("/");
    const nodePath = pathParts.join("/");

    // 文件路径下，先确保祖先目录都存在；目录路径则确保目录链存在。
    ensureDirectoryPath(pathParts.slice(0, isDir ? pathParts.length : pathParts.length - 1));

    if (nodeMap.has(nodePath)) continue;
    const label = isDir
      ? pathParts[pathParts.length - 1]
      : pathParts[pathParts.length - 1].replace(/\.[^.]+$/, "") || pathParts[pathParts.length - 1];
    const fileType = isDir ? "directory" : getFileExtension(pathParts[pathParts.length - 1] ?? "");

    nodeMap.set(nodePath, {
      id: nodePath,
      key: pathParts.join("-"),
      label,
      content: isDir ? "" : (serverData[key] ?? ""),
      isDirectory: isDir,
      path: pathParts,
      fileType: fileType as "directory" | "md" | string,
      children: [],
    });
    orderedNodePaths.push(nodePath);
  }

  const attachedNodePaths = new Set<string>();
  for (const nodePath of orderedNodePaths) {
    if (attachedNodePaths.has(nodePath)) continue;
    const node = nodeMap.get(nodePath);
    if (!node) continue;
    attachedNodePaths.add(nodePath);
    const parentPath = node.path.slice(0, -1).join("/");
    if (!parentPath) {
      if (!rootChildren.some((c) => c.id === node.id)) rootChildren.push(node);
      continue;
    }
    const parent = nodeMap.get(parentPath);
    if (!parent) {
      if (!rootChildren.some((c) => c.id === node.id)) rootChildren.push(node);
      continue;
    }
    if (!parent.children.some((c) => c.id === node.id)) parent.children.push(node);
  }

  return rootChildren;
}

/** Init时使用，找到第一个为md的节点 作为 currentEditingId */
export function findFirstMdNode(nodes: FileTreeNode[], id?: string): FileTreeNode | null {
  const flat: FileTreeNode[] = [];
  const flatten = (list: FileTreeNode[]) => {
    for (const node of list) {
      flat.push(node);
      if (node.children?.length) flatten(node.children);
    }
  };
  flatten(nodes);

  if (id !== undefined) {
    const targetId = normalizeNodeIdForCompare(id);
    const found = flat.find((n) => normalizeNodeIdForCompare(n.id) === targetId);
    if (found) return found;
  }

  return flat.find((n) => n.fileType === "md") ?? null;
}

/** 文件树根（id='root'）转为 ServerData，用于保存 */
export function fileTreeData2ServerData(root: FileTreeNode): ServerData {
  const result: ServerData = {};
  const orderedKeys: string[] = [];

  const traverse = (node: FileTreeNode) => {
    if (node.id === "root") {
      node.children.forEach(traverse);
      return;
    }
    const nodePath = node.path.join("/");
    if (node.isDirectory) {
      if (node.children.length === 0) {
        result[`${nodePath}/`] = "";
        orderedKeys.push(`${nodePath}/`);
      }
    } else {
      result[nodePath] = typeof node.content === "string" ? node.content : "";
      orderedKeys.push(nodePath);
    }
    node.children.forEach(traverse);
  };

  traverse(root);
  const ordered: ServerData = {};
  orderedKeys.forEach((k) => (ordered[k] = result[k]));
  return ordered;
}

/** 从树中根据 id 查找节点，返回 label；找不到返回空字符串 */
export function findNodeLabelById(nodes: FileTreeNode[], id: string): string {
  const targetId = normalizeNodeIdForCompare(id);
  for (const node of nodes) {
    if (normalizeNodeIdForCompare(node.id) === targetId) return node.label;
    if (node.children?.length) {
      const found = findNodeLabelById(node.children, id);
      if (found) return found;
    }
  }
  return "";
}

/** 从树中根据 id 查找节点，返回节点；找不到返回 null（与 Vue findNodeById 对齐） */
export function findNodeById(nodes: FileTreeNode[], id: string): FileTreeNode | null {
  const targetId = normalizeNodeIdForCompare(id);
  for (const node of nodes) {
    if (normalizeNodeIdForCompare(node.id) === targetId) return node;
    if (node.children?.length) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}
