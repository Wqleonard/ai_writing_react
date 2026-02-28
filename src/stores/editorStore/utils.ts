/**
 * serverData <-> 文件树转换，与 Vue aiTreeNodeConverter 对齐（最简版，无 md2json）。
 */
import type { FileTreeNode, ServerData } from "./types";

const HAS_EXT = /\.(md|txt|jpg|jpeg|png|gif|pdf|doc|docx|xls|xlsx|ppt|pptx)$/i;

function getFileExtension(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return ext ?? "file";
}

/** ServerData 转为树根节点的 children（用于侧边栏展示） */
export function serverDataToTree(serverData: ServerData): FileTreeNode[] {
  const nodeMap = new Map<string, FileTreeNode>();
  const rootChildren: FileTreeNode[] = [];
  const keys = Object.keys(serverData);

  for (const key of keys) {
    if (!key.endsWith("/") && !HAS_EXT.test(key)) continue;
    const pathParts = key.split("/").filter((p) => p !== "");
    const isDir = key.endsWith("/");
    const nodePath = pathParts.join("/");
    const label = isDir
      ? pathParts[pathParts.length - 1]
      : pathParts[pathParts.length - 1].replace(/\.[^.]+$/, "") || pathParts[pathParts.length - 1];
    const fileType = isDir ? "directory" : getFileExtension(pathParts[pathParts.length - 1] ?? "");

    const node: FileTreeNode = {
      id: nodePath,
      key: pathParts.join("-"),
      label,
      content: isDir ? "" : (serverData[key] ?? ""),
      isDirectory: isDir,
      path: pathParts,
      fileType: fileType as "directory" | "md" | string,
      children: [],
    };
    nodeMap.set(nodePath, node);
  }

  for (const key of keys) {
    if (!key.endsWith("/") && !HAS_EXT.test(key)) continue;
    const pathParts = key.split("/").filter((p) => p !== "");
    const nodePath = pathParts.join("/");
    const node = nodeMap.get(nodePath);
    if (!node) continue;

    const parentPath = pathParts.slice(0, -1).join("/");
    if (parentPath === "") {
      rootChildren.push(node);
    } else {
      let parent = nodeMap.get(parentPath);
      if (!parent) {
        const parts = parentPath.split("/").filter((p) => p !== "");
        parent = {
          id: parentPath,
          key: parts.join("-"),
          label: parts[parts.length - 1] ?? parentPath,
          content: "",
          isDirectory: true,
          path: parts,
          fileType: "directory",
          children: [],
        };
        nodeMap.set(parentPath, parent);
        const grandParentPath = parts.slice(0, -1).join("/");
        if (grandParentPath === "") rootChildren.push(parent);
        else {
          const grandParent = nodeMap.get(grandParentPath);
          if (grandParent) grandParent.children.push(parent);
          else rootChildren.push(parent);
        }
      }
      if (!parent.children.some((c) => c.id === node.id)) {
        parent.children.push(node);
      }
    }
  }

  return rootChildren;
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
  for (const node of nodes) {
    if (node.id === id) return node.label;
    if (node.children?.length) {
      const found = findNodeLabelById(node.children, id);
      if (found) return found;
    }
  }
  return "";
}

/** 从树中根据 id 查找节点，返回节点；找不到返回 null（与 Vue findNodeById 对齐） */
export function findNodeById(nodes: FileTreeNode[], id: string): FileTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children?.length) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}
