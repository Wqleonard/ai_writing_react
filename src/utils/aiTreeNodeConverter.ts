import type { FileTreeNode } from "@/stores/editorStore";

/**
 * Minimal file tree converter for React app (no mdConverter dependency).
 * Server data keys are file paths; values are string content.
 */
export interface ServerData {
  [key: string]: string;
}

function hasFileExtension(fileName: string): boolean {
  const parts = fileName.split(".");
  if (parts.length < 2) return false;
  const ext = parts[parts.length - 1].toLowerCase();
  return ["md", "txt", "jpg", "jpeg", "png", "gif", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext);
}

function getFileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() || "file";
}

function createIntermediateDirectoryNodes(
  path: string,
  nodeMap: Map<string, FileTreeNode>,
  root: FileTreeNode
): FileTreeNode | null {
  if (!path) return root;
  if (nodeMap.has(path)) return nodeMap.get(path)!;
  const pathParts = path.split("/").filter((p) => p !== "");
  if (pathParts.length === 0) return root;
  const parentPath = pathParts.slice(0, -1).join("/");
  const nodeLabel = pathParts[pathParts.length - 1];
  const parentNode = createIntermediateDirectoryNodes(parentPath, nodeMap, root);
  if (!parentNode) return null;
  const node: FileTreeNode = {
    id: path,
    key: pathParts.join("-"),
    label: nodeLabel,
    content: "",
    isDirectory: true,
    path: pathParts,
    fileType: "directory",
    children: [],
  };
  if (!parentNode.children.find((c) => c.id === node.id)) parentNode.children.push(node);
  nodeMap.set(path, node);
  return node;
}

export function serverData2FileTreeData(serverData: ServerData): FileTreeNode {
  const root: FileTreeNode = {
    id: "root",
    key: "root",
    label: "root",
    content: "",
    isDirectory: true,
    path: [],
    children: [],
  };
  const nodeMap = new Map<string, FileTreeNode>();
  const pendingNodes = new Map<string, { node: FileTreeNode; parentPath: string }>();
  nodeMap.set("", root);
  const keys = Object.keys(serverData);

  for (const key of keys) {
    if (!key.endsWith("/") && !hasFileExtension(key)) continue;
    const pathParts = key.split("/").filter((p) => p !== "");
    const isDirectory = key.endsWith("/");
    const fileType = isDirectory ? "directory" : getFileExtension(key);
    const nodePath = pathParts.join("/");
    let nodeLabel: string;
    if (isDirectory) {
      nodeLabel = pathParts[pathParts.length - 1];
    } else {
      const fileName = pathParts[pathParts.length - 1];
      const lastDot = fileName.lastIndexOf(".");
      nodeLabel = lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
    }
    const node: FileTreeNode = {
      id: nodePath || "root",
      key: pathParts.length > 0 ? pathParts.join("-") : "root",
      label: nodeLabel,
      content: serverData[key] ?? "",
      isDirectory,
      path: pathParts,
      fileType,
      children: [],
    };
    const parentPath = pathParts.slice(0, -1).join("/");
    nodeMap.set(nodePath, node);
    pendingNodes.set(nodePath, { node, parentPath });
  }

  for (const key of keys) {
    if (!key.endsWith("/") && !hasFileExtension(key)) continue;
    const pathParts = key.split("/").filter((p) => p !== "");
    const nodePath = pathParts.join("/");
    const pending = pendingNodes.get(nodePath);
    if (!pending) continue;
    const { node, parentPath } = pending;
    if (parentPath === "") {
      root.children.push(node);
    } else {
      let parentNode = nodeMap.get(parentPath);
      if (!parentNode) parentNode = createIntermediateDirectoryNodes(parentPath, nodeMap, root) ?? undefined;
      if (parentNode && !parentNode.children.find((c) => c.id === node.id)) parentNode.children.push(node);
    }
  }
  return root;
}

export function fileTreeData2ServerData(root: FileTreeNode): ServerData {
  const result: ServerData = {};

  const walk = (node: FileTreeNode) => {
    const isRoot = node.id === "root";
    if (!isRoot) {
      const key = node.isDirectory ? `${node.id}/` : node.id;
      result[key] = node.content ?? "";
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) walk(child);
    }
  };

  walk(root);
  return result;
}
