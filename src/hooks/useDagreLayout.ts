import ELK from "elkjs/lib/elk.bundled.js";
import { Position, useReactFlow } from "@xyflow/react";
import { useCallback, useRef } from "react";

type Node = any;
type Edge = any;

/**
 * 获取 subtree 节点
 */
function getSubtree(rootId: string, nodes: Node[], edges: Edge[]) {
  const visited = new Set<string>();
  const queue = [rootId];

  while (queue.length) {
    const current = queue.shift()!;
    visited.add(current);

    edges
      .filter((e) => e.source === current)
      .forEach((e) => queue.push(e.target));
  }

  return nodes.filter((n) => visited.has(n.id));
}

/**
 * 获取 subtree edges
 */
function getSubtreeEdges(subtreeNodes: Node[], edges: Edge[]) {
  const ids = new Set(subtreeNodes.map((n) => n.id));

  return edges.filter(
    (e) => ids.has(e.source) && ids.has(e.target)
  );
}

/**
 * 稳定布局 Hook
 */
export function useDagreLayout() {
  const { getNode } = useReactFlow();
  const elkRef = useRef(new ELK());

  const layout = useCallback(
    async (
      nodes: Node[],
      edges: Edge[],
      direction: "LR" | "TB" = "LR",
      rootId?: string
    ) => {
      const isHorizontal = direction === "LR";

      /**
       * 如果有 rootId，只布局 subtree
       */
      let layoutNodes = nodes;
      let layoutEdges = edges;

      if (rootId) {
        layoutNodes = getSubtree(rootId, nodes, edges);
        layoutEdges = getSubtreeEdges(layoutNodes, edges);
      }

      const nodeSizeMap = new Map<
        string,
        { width: number; height: number }
      >();

      /**
       * 读取节点尺寸
       */
      for (const node of layoutNodes) {
        const graphNode = getNode(node.id);

        const measuredWidth = graphNode?.measured?.width;
        const measuredHeight = graphNode?.measured?.height;

        const dimWidth = (graphNode as any)?.dimensions?.width;
        const dimHeight = (graphNode as any)?.dimensions?.height;

        const width = measuredWidth ?? dimWidth ?? 300;
        const height = measuredHeight ?? dimHeight ?? 200;

        nodeSizeMap.set(node.id, { width, height });

      }

      const graph = {
        id: rootId ? `subtree-${rootId}` : "root",
        layoutOptions: {
          "elk.algorithm": "layered",
          "elk.direction": isHorizontal ? "RIGHT" : "DOWN",
          "elk.edgeRouting": "ORTHOGONAL",
          "elk.spacing.nodeNode": "72",
          "elk.layered.spacing.nodeNodeBetweenLayers": "170",
          "elk.layered.spacing.edgeNodeBetweenLayers": "80",
          "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
          "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
          "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
        },
        children: layoutNodes.map((node) => {
          const size = nodeSizeMap.get(node.id)!;
          return {
            id: node.id,
            width: size.width,
            height: size.height,
          };
        }),
        edges: layoutEdges.map((edge) => ({
          id: edge.id ?? `${edge.source}-${edge.target}`,
          sources: [edge.source],
          targets: [edge.target],
        })),
      };

      const result = await elkRef.current.layout(graph as any);
      const positionedNodeMap = new Map<string, { x: number; y: number }>();
      for (const child of result.children || []) {
        if (typeof child.x === "number" && typeof child.y === "number") {
          positionedNodeMap.set(child.id, { x: child.x, y: child.y });
        }
      }

      /**
       * root 锚点位置
       */
      let rootOffset = { x: 0, y: 0 };

      if (rootId) {
        const rootNode = nodes.find((n) => n.id === rootId);
        const elkRoot = positionedNodeMap.get(rootId);

        if (rootNode && elkRoot) {
          rootOffset = {
            x: rootNode.position.x - elkRoot.x,
            y: rootNode.position.y - elkRoot.y,
          };
        }
      }

      /**
       * 计算新位置
       */
      const layouted = layoutNodes.map((node) => {
        const elkNode = positionedNodeMap.get(node.id);
        const dims = nodeSizeMap.get(node.id)!;
        if (!elkNode) return node;

        return {
          ...node,
          targetPosition: isHorizontal
            ? Position.Left
            : Position.Top,
          sourcePosition: isHorizontal
            ? Position.Right
            : Position.Bottom,
          position: {
            x:
              elkNode.x +
              rootOffset.x,
            y:
              elkNode.y +
              rootOffset.y,
          },
        };
      });

      /**
       * 合并回原 nodes
       */
      const map = new Map(layouted.map((n) => [n.id, n]));

      return nodes.map((node) => map.get(node.id) || node);
    },
    [getNode]
  );

  return { layout };
}