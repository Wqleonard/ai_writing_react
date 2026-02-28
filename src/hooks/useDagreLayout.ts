import dagre from "@dagrejs/dagre";
import { useReactFlow } from "@xyflow/react";
import { Position } from "@xyflow/react";
import { useCallback } from "react";

/**
 * React hook for running the dagre layout algorithm on the graph.
 */
export function useDagreLayout() {
  const { getNode } = useReactFlow();

  const layout = useCallback(
    (nodes: any[], edges: any[], direction: string = "LR") => {
      const dagreGraph = new dagre.graphlib.Graph();
      dagreGraph.setDefaultEdgeLabel(() => ({}));

      const isHorizontal = direction === "LR";

      dagreGraph.setGraph({
        rankdir: direction,
        nodesep: 50,
        ranksep: 75,
        edgesep: 20,
      });

      const nodeSizeMap = new Map<string, { width: number; height: number }>();

      for (const node of nodes) {
        const graphNode = getNode(node.id);
        const width = graphNode?.measured?.width ?? 400;
        const height = graphNode?.measured?.height ?? 200;
        nodeSizeMap.set(node.id, { width, height });

        dagreGraph.setNode(node.id, {
          width,
          height,
          label: node.data?.label || node.id,
        });
      }

      for (const edge of edges) {
        dagreGraph.setEdge(edge.source, edge.target, { weight: 1 });
      }

      dagre.layout(dagreGraph);

      return nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        const dims = nodeSizeMap.get(node.id) || { width: 300, height: 200 };

        return {
          ...node,
          targetPosition: isHorizontal ? Position.Left : Position.Top,
          sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
          position: {
            x: nodeWithPosition.x - (nodeWithPosition.width || dims.width) / 2,
            y: nodeWithPosition.y - (nodeWithPosition.height || dims.height) / 2,
          },
        };
      });
    },
    [getNode]
  );

  return { layout };
}
