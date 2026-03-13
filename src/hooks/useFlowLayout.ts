import dagre from "@dagrejs/dagre";
import { Position } from "@xyflow/react";
import { useCallback, useRef, useState } from "react";

export interface FlowLayoutNode {
  id: string;
  position: { x: number; y: number };
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface FlowLayoutEdge {
  source: string;
  target: string;
  [key: string]: unknown;
}

/**
 * React hook for running dagre layout on a graph (fixed node size).
 * For React Flow with measured dimensions, use useDagreLayout instead.
 */
export function useFlowLayout() {
  const graphRef = useRef(new dagre.graphlib.Graph());
  const [previousDirection, setPreviousDirection] = useState("LR");

  const layout = useCallback(
    (
      nodes: FlowLayoutNode[],
      edges: FlowLayoutEdge[],
      direction: string = "LR"
    ): FlowLayoutNode[] => {
      const dagreGraph = new dagre.graphlib.Graph();
      graphRef.current = dagreGraph;

      dagreGraph.setDefaultEdgeLabel(() => ({}));
      const isHorizontal = direction === "LR";
      dagreGraph.setGraph({ rankdir: direction });
      setPreviousDirection(direction);

      for (const node of nodes) {
        dagreGraph.setNode(node.id, { width: 300, height: 150 });
      }
      for (const edge of edges) {
        dagreGraph.setEdge(edge.source, edge.target);
      }

      dagre.layout(dagreGraph);

      return nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        return {
          ...node,
          targetPosition: isHorizontal ? Position.Left : Position.Top,
          sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
          position: { x: nodeWithPosition.x, y: nodeWithPosition.y },
        };
      });
    },
    []
  );

  return { graph: graphRef.current, layout, previousDirection };
}
