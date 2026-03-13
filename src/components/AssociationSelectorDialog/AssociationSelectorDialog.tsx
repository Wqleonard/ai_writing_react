"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import clsx from "clsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import type { FileTreeNode } from "@/stores/editorStore/types";

export interface AssociationSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  treeData: FileTreeNode[];
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
}

const filterTree = (nodes: FileTreeNode[], search: string): FileTreeNode[] => {
  if (!search.trim()) return nodes;
  const q = search.toLowerCase().trim();
  const go = (list: FileTreeNode[]): FileTreeNode[] => {
    return list
      .map((node) => {
        const match = node.id?.toLowerCase().includes(q);
        const childrenFiltered = node.children?.length
          ? go(node.children)
          : [];
        if (match || childrenFiltered.length > 0) {
          return { ...node, children: childrenFiltered };
        }
        return null;
      })
      .filter(Boolean) as FileTreeNode[];
  };
  return go(nodes);
};

const TreeNodeRow = ({
  node,
  depth,
  checkedIds,
  onToggle,
  filtered,
}: {
  node: FileTreeNode;
  depth: number;
  checkedIds: Set<string>;
  onToggle: (id: string) => void;
  filtered: boolean;
}) => {
  const isChecked = checkedIds.has(node.id);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="flex flex-col gap-0">
      <div
        className={clsx(
          "flex items-center gap-2 py-1.5 px-2 rounded text-sm cursor-pointer hover:bg-muted/60",
          filtered && "border-l-2 border-transparent"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => onToggle(node.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle(node.id);
          }
        }}
      >
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => onToggle(node.id)}
          className="rounded border-input shrink-0"
          onClick={(e) => e.stopPropagation()}
        />
        <span className="truncate text-foreground">
          {node.label || node.id}
        </span>
      </div>
      {hasChildren &&
        node.children!.map((child) => (
          <TreeNodeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            checkedIds={checkedIds}
            onToggle={onToggle}
            filtered={filtered}
          />
        ))}
    </div>
  );
};

export const AssociationSelectorDialog = ({
  open,
  onOpenChange,
  treeData,
  selectedIds,
  onConfirm,
}: AssociationSelectorDialogProps) => {
  const [search, setSearch] = useState("");
  const [checkedSet, setCheckedSet] = useState<Set<string>>(() => new Set(selectedIds));

  useEffect(() => {
    if (open) setCheckedSet(new Set(selectedIds));
  }, [open, selectedIds]);

  const filteredTree = useMemo(
    () => filterTree(treeData, search),
    [treeData, search]
  );

  const handleToggle = (id: string) => {
    setCheckedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm(Array.from(checkedSet));
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setSearch("");
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px]" showCloseButton>
        <DialogHeader>
          <DialogTitle>关联本书内容</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜索文件或文件夹"
              className="w-full h-9 pl-8 pr-3 rounded border border-input bg-background text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-[400px] overflow-y-auto rounded border border-border p-2">
            {filteredTree.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">
                暂无内容或无匹配项
              </div>
            ) : (
              filteredTree.map((node) => (
                <TreeNodeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  checkedIds={checkedSet}
                  onToggle={handleToggle}
                  filtered={!!search.trim()}
                />
              ))
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleConfirm}>确定</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
