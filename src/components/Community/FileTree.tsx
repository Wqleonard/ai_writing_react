import React, { useCallback, useMemo, useState } from "react";
import type { FileTreeNode } from "../../utils/aiTreeNodeConverter";
import { Checkbox } from "@/components/ui/Checkbox";
import { Iconfont } from "@/components/Iconfont";
import { Button } from "../ui/Button";

export const getCheckedNodesFromIds = (nodes: FileTreeNode[], checkedIds: Set<string>, leafOnly: boolean): FileTreeNode[] => {
  const acc: FileTreeNode[] = [];
  const walk = (ns: FileTreeNode[]) => {
    for (const n of ns) {
      if (checkedIds.has(n.id)) {
        if (!leafOnly || n.fileType === "md" || (!n.isDirectory && !n.children?.length)) acc.push(n);
      }
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return acc;
};

const collectAllIds = (n: FileTreeNode): string[] => {
  const ids = [n.id];
  if (n.children) for (const c of n.children) ids.push(...collectAllIds(c));
  return ids;
};

interface FileTreeProps {
  data: FileTreeNode[];
  checkedIds: Set<string>;
  onCheckedChange: (ids: Set<string>) => void;
  defaultExpandAll?: boolean;
}

const TreeNode = ({
  node,
  checkedIds,
  onToggle,
  expandedIds,
  onExpandToggle,
  level,
}: {
  node: FileTreeNode;
  checkedIds: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
  expandedIds: Set<string>;
  onExpandToggle: (id: string) => void;
  level: number;
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const checked = checkedIds.has(node.id);
  const childrenIds = useMemo(
    () => (node.children ? (node.children as FileTreeNode[]).flatMap((c) => collectAllIds(c)) : []),
    [node.children]
  );
  const allChildrenChecked = childrenIds.length > 0 && childrenIds.every((id) => checkedIds.has(id));
  const someChildrenChecked = childrenIds.some((id) => checkedIds.has(id));

  const handleCheckedChange = useCallback(
    (value: boolean | "indeterminate") => {
      const next = value !== false;
      onToggle(node.id, next);
      if (hasChildren) childrenIds.forEach((id) => onToggle(id, next));
    },
    [node.id, hasChildren, childrenIds, onToggle]
  );

  const displayChecked = hasChildren ? allChildrenChecked : checked;
  const indeterminate = hasChildren && someChildrenChecked && !allChildrenChecked;

  return (
    <div style={{ paddingLeft: level * 12 }}>
      <div className="flex items-center gap-1">
        {hasChildren ? (
          <Button
            variant="ghost"
            onClick={() => onExpandToggle(node.id)}
            className="size-4 shrink-0 rounded-sm! border-none bg-transparent p-0 cursor-pointer"
          >
            {isExpanded ? "−" : "+"}
          </Button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <Checkbox
          checked={indeterminate ? "indeterminate" : displayChecked}
          onCheckedChange={handleCheckedChange}
        />
        {node.isDirectory ? (
          <Iconfont unicode="&#xe620;" className="text-sm text-[#606266] shrink-0" />
        ) : node.fileType === "md" ? (
          <Iconfont unicode="&#xe624;" className="text-sm text-[#606266] shrink-0" />
        ) : (
          <span className="shrink-0 w-[14px]" />
        )}
        <span className="flex-1 min-w-0 overflow-hidden text-ellipsis">{node.label}</span>
      </div>
      {hasChildren && isExpanded &&
        node.children!.map((child) => (
          <TreeNode
            key={child.id}
            node={child as FileTreeNode}
            checkedIds={checkedIds}
            onToggle={onToggle}
            expandedIds={expandedIds}
            onExpandToggle={onExpandToggle}
            level={level + 1}
          />
        ))}
    </div>
  );
};

export const FileTree = ({ data, checkedIds, onCheckedChange, defaultExpandAll = true }: FileTreeProps) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const set = new Set<string>();
    function walk(ns: FileTreeNode[]) {
      for (const n of ns) {
        if (n.children?.length) {
          set.add(n.id);
          walk(n.children);
        }
      }
    }
    if (defaultExpandAll) walk(data);
    return set;
  });

  const onToggle = useCallback(
    (id: string, checked: boolean) => {
      const next = new Set(checkedIds);
      if (checked) next.add(id);
      else next.delete(id);
      onCheckedChange(next);
    },
    [checkedIds, onCheckedChange]
  );

  const onExpandToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="community-file-tree">
      {data.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          checkedIds={checkedIds}
          onToggle={onToggle}
          expandedIds={expandedIds}
          onExpandToggle={onExpandToggle}
          level={0}
        />
      ))}
    </div>
  );
};
