import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  MarkerType,
  ControlButton,
} from "@xyflow/react";
  import "@xyflow/react/dist/style.css";
  import { Button } from "@/components/ui/Button";
  import { Textarea } from "@/components/ui/Textarea";
  import MainCardNode from "./components/MainCardNode";
  import SummaryCardNode from "./components/SummaryCardNode";
  import SettingCardNode from "./components/SettingCardNode";
  import OutlineCardNode from "./components/OutlineCardNode";
  import BubblesContainer from "./components/BubblesContainer";
  import InitWorkDialog from "./components/InitWorkDialog";
  import InspirationHistoryDialog from "./components/InspirationHistoryDialog";
  import { InsCanvasContext } from "./InsCanvasContext";
  import { useDagreLayout } from "@/hooks/useDagreLayout";
  import type {
    CustomNode,
    CustomEdge,
    TreeNode,
    InspirationItem,
    ParentNode,
    InspirationVersion,
  } from "./types";
import { Iconfont } from "../IconFont";
import { saveInspirationCanvasReq } from "@/api/works";
import { useCanvasStore } from "@/stores/canvasStore";
  
  const nodeTypes = {
    mainCard: MainCardNode,
    summaryCard: SummaryCardNode,
    settingCard: SettingCardNode,
    outlineCard: OutlineCardNode,
  };

  export interface InsCanvasApi {
    addNewCanvas: () => void;
    openHistory: () => void;
    saveCanvas: (sessionId?: string) => void;
    inspirationDrawId: string;
    isLoading: boolean;
  }

  interface InsCanvasProps {
    workId: string;
    nodes?: CustomNode[];
    edges?: CustomEdge[];
    inspirationDrawId?: string;
    onCreateHere?: (files: Record<string, string>, chain: ParentNode | null) => void;
    onCreateNew?: (files: Record<string, string>, chain: ParentNode | null) => void;
    onMessage?: (type: "success" | "error" | "warning", msg: string) => void;
    onCanvasReady?: () => void;
  }

  interface InsCanvasInnerProps extends InsCanvasProps {
    canvasRef?: React.RefObject<InsCanvasApi | null>;
  }
  
  function convertToTreeStructure(
    nodes: CustomNode[],
    edges: CustomEdge[]
  ): TreeNode[] | null {
    if (nodes.length === 0) return null;
    const targetIds = new Set(edges.map((e) => e.target));
    let roots = nodes.filter((n) => !targetIds.has(n.id));
    if (roots.length === 0) {
      const main = nodes.find((n) => n.type === "mainCard");
      if (main) roots = [main];
      else if (nodes.length > 0) roots = [nodes[0]];
    }
    if (roots.length === 0) return null;
  
    const processed = new Set<string>();
    const buildTree = (nodeId: string): TreeNode | null => {
      if (processed.has(nodeId)) return null;
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return null;
      processed.add(nodeId);
      const childEdges = edges.filter((e) => e.source === nodeId);
      const children: TreeNode[] = [];
      for (const e of childEdges) {
        processed.delete(nodeId);
        const child = buildTree(e.target);
        processed.add(nodeId);
        if (child) children.push(child);
      }
      processed.delete(nodeId);
      return {
        id: node.id,
        type: node.type,
        data: { ...node.data },
        position: { ...node.position },
        children: children.length > 0 ? children : undefined,
      };
    };
    const trees: TreeNode[] = [];
    for (const r of roots) {
      const t = buildTree(r.id);
      if (t) trees.push(t);
    }
    return trees.length > 0 ? trees : null;
  }
  
  function findMainCardWithChildren(node: TreeNode): boolean {
    if (
      node.type === "mainCard" &&
      Array.isArray(node.children) &&
      node.children.length > 0
    )
      return true;
    if (node.children?.length) {
      return node.children.some(findMainCardWithChildren);
    }
    return false;
  }
  
  function createCardsFromInspiration(
    inspirationData: InspirationItem[],
    inspirationWord?: string,
    inspirationDrawId?: string,
    viewportWidth: number = 1920
  ): CustomNode[] {
    const cardWidth = 250;
    const cardSpacing = 25;
    const startY = 100;
    const centerX = viewportWidth / 2;
    const secondCardX = centerX - cardWidth / 2;
    const firstCardX = secondCardX - (cardWidth + cardSpacing);
    const thirdCardX = secondCardX + (cardWidth + cardSpacing);
    const positions = [firstCardX, secondCardX, thirdCardX];
  
    return inspirationData.slice(0, 3).map((item, i) => ({
      id: `card-${i + 1}`,
      type: "mainCard",
      position: { x: positions[i], y: startY },
      draggable: false,
      data: {
        label: "主卡片",
        content: item.inspirationTheme,
        image: "",
        inspirationTheme: item.inspirationTheme,
        inspirationWord: inspirationWord,
        inspirationDrawId,
        isMain: true,
      },
    }));
  }
  
  function InsCanvasInner({
    workId,
    nodes: initialNodes = [],
    edges: initialEdges = [],
    inspirationDrawId: initialInspirationDrawId = "",
    onCreateHere,
    onCreateNew,
    onMessage,
    onCanvasReady,
    canvasRef,
  }: InsCanvasInnerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState<CustomNode>(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState<CustomEdge>(initialEdges);
    // autoLayout 会被 setTimeout 调用；用 ref 避免闭包拿到旧 nodes/edges 导致把新数据覆盖回去
    const nodesRef = useRef<CustomNode[]>(initialNodes);
    const edgesRef = useRef<CustomEdge[]>(initialEdges);
    const hasIdeaRef = useRef(false);
    const [inspirationDrawId, setInspirationDrawId] = useState(initialInspirationDrawId);
    const [ideaContent, setIdeaContent] = useState("");
    const [reqIdeaContent, setReqIdeaContent] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [initWorkDialogShow, setInitWorkDialogShow] = useState(false);
    const [historyDialogShow, setHistoryDialogShow] = useState(false);
    const [currentChain, setCurrentChain] = useState<ParentNode | null>(null);
    // 是否在画布中
    const [canvasReady, setCanvasReady] = useState(false);

    // 一次“生成”流程内的错误提示去重（跨多个卡片）
    const errorBatchRef = useRef<{ startedAt: number; messages: Set<string> } | null>(null);
    // 当前缩放百分比（用于右下角 UI 展示）
    const [zoomPercent, setZoomPercent] = useState(100);
    // 画布拖拽总开关（默认开启，支持按钮一键关闭）
    const [panMode, setPanMode] = useState(true);
    const getOrCreateCanvasSessionId = useCanvasStore((s) => s.getOrCreateCanvasSessionId);
    const createNewCanvasSessionId = useCanvasStore((s) => s.createNewCanvasSessionId);
    const clearCanvasSessionId = useCanvasStore((s) => s.clearCanvasSessionId);
  
    const tree = useMemo(() => convertToTreeStructure(nodes, edges), [nodes, edges]);
  
    const hasIdea = useMemo(() => {
      if (!tree || tree.length === 0) return false;
      return tree.some(findMainCardWithChildren);
    }, [tree]);

    // 是否可以交互(canvas: 比如拖拽 滑动)
    const canInteract = hasIdea && canvasReady;
  
    const { zoomIn, zoomOut } = useReactFlow();
    const { layout: dagreLayout } = useDagreLayout();
  
    const msg = useCallback(
      (type: "success" | "error" | "warning", text: string) => {
        if (type === "error") {
          const now = Date.now();
          const windowMs = 1000;
          let batch = errorBatchRef.current;
          if (!batch || now - batch.startedAt > windowMs) {
            batch = { startedAt: now, messages: new Set<string>() };
            errorBatchRef.current = batch;
          }
          if (batch.messages.has(text)) {
            return;
          }
          batch.messages.add(text);
        }
        onMessage?.(type, text);

      },
      [onMessage]
    );
  
    const updateMainCardsPosition = useCallback(() => {
      if (hasIdea) return;
      const mainCards = nodes.filter((n) => n.type === "mainCard");
      if (mainCards.length !== 3) return;
      const cardWidth = 250;
      const cardSpacing = 25;
      const w =
        containerRef.current?.clientWidth || window.innerWidth || 1920;
      const centerX = w / 2;
      const secondX = centerX - cardWidth / 2;
      const firstX = secondX - (cardWidth + cardSpacing);
      const thirdX = secondX + (cardWidth + cardSpacing);
      const sorted = [...mainCards].sort((a, b) => {
        const ia = parseInt((a.id || "").replace("card-", ""), 10) || 0;
        const ib = parseInt((b.id || "").replace("card-", ""), 10) || 0;
        return ia - ib;
      });
      const positions = [firstX, secondX, thirdX];
      const baseY = sorted[0]?.position?.y ?? 100;
      setNodes((nds) =>
        nds.map((n) => {
          if (n.type !== "mainCard") return n;
          const idx = sorted.findIndex((s) => s.id === n.id);
          if (idx < 0) return n;
          return { ...n, position: { x: positions[idx], y: baseY } };
        })
      );
    }, [hasIdea, nodes, setNodes]);
  
    useEffect(() => {
      const ro = containerRef.current
        ? new ResizeObserver(updateMainCardsPosition)
        : null;
      if (containerRef.current && ro) ro.observe(containerRef.current);
      return () => {
        if (containerRef.current && ro) ro.unobserve(containerRef.current);
      };
    }, [updateMainCardsPosition]);
  
    useEffect(() => {
      setNodes((nds) =>
        nds.map((n) => {
          // mainCard 内部有按钮等交互，保持不可拖拽避免吞点击
          if (n.type === "mainCard") return { ...n, draggable: false };
          return { ...n, draggable: hasIdea };
        })
      );
    }, [hasIdea, setNodes]);
  
    useEffect(() => {
      nodesRef.current = nodes;
    }, [nodes]);

    useEffect(() => {
      edgesRef.current = edges;
    }, [edges]);

    useEffect(() => {
      hasIdeaRef.current = hasIdea;
    }, [hasIdea]);

    // 有「想法」结构时即允许画布交互（拖拽/缩放），包括：1）用户点击「立即创作」后 2）从服务端加载已有画布时
    useEffect(() => {
      if (hasIdea) setCanvasReady(true);
    }, [hasIdea]);

    // dagre 完成后，按同父边顺序稳定兄弟节点上下顺序，避免出现 B->D->C 被排成 B->C->D
    const stabilizeSiblingOrder = useCallback(
      (layoutedNodes: CustomNode[], edgesArr: CustomEdge[]) => {
        const nextNodes = layoutedNodes.map((n) => ({
          ...n,
          position: { ...n.position },
        }));
        const nodeMap = new Map(nextNodes.map((n) => [n.id, n] as const));

        const parentChildrenMap = new Map<string, string[]>();
        for (const e of edgesArr) {
          if (!parentChildrenMap.has(e.source)) parentChildrenMap.set(e.source, []);
          parentChildrenMap.get(e.source)!.push(e.target);
        }

        for (const [, childIdsInEdgeOrder] of parentChildrenMap) {
          if (childIdsInEdgeOrder.length <= 1) continue;
          const children = childIdsInEdgeOrder
            .map((id) => nodeMap.get(id))
            .filter((n): n is CustomNode => Boolean(n));
          if (children.length <= 1) continue;

          const ySlots = [...children]
            .sort((a, b) => a.position.y - b.position.y)
            .map((n) => n.position.y);

          // 边顺序靠前的孩子使用更靠上的 y 槽位
          children.forEach((child, index) => {
            const y = ySlots[index];
            if (typeof y === "number") {
              child.position.y = y;
            }
          });
        }

        return nextNodes;
      },
      []
    );

    const autoLayout = useCallback(() => {
      // 注意：autoLayout 会延迟触发，不能用闭包里的 hasIdea（可能是旧值）
      if (!hasIdeaRef.current) return;
      setTimeout(() => {
        try {
          const layouted = dagreLayout(
            nodesRef.current,
            edgesRef.current,
            "LR"
          );
          const stabilized = stabilizeSiblingOrder(
            layouted as CustomNode[],
            edgesRef.current
          );
          setNodes(stabilized);
        } catch (e) {
          console.error("dagre layout error:", e);
        }
      }, 100);
    }, [dagreLayout, setNodes, stabilizeSiblingOrder]);

    // 统一图更新与布局触发：每次动作只触发一次布局，并且布局基于最新图数据
    const applyGraphAndAutoLayout = useCallback(
      (nextNodes: CustomNode[], nextEdges: CustomEdge[], delayMs: number = 120) => {
        nodesRef.current = nextNodes;
        edgesRef.current = nextEdges;
        setNodes(nextNodes);
        setEdges(nextEdges);
        setTimeout(autoLayout, delayMs);
      },
      [setNodes, setEdges, autoLayout]
    );

    const scheduleAutoLayoutForExpand = useCallback(() => {
      // 展开/折叠存在过渡动画，动画完成后做一次布局
      setTimeout(() => {
        autoLayout();
      }, 260);
    }, [autoLayout]);

    const updateNodeContent = useCallback(
      (nodeId: string, content: string) => {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  // 受控 nodes 模式下，必须在父层把 isStreaming 写回 false，
                  // 否则子组件里 updateNodeData 的变更会被下一次 render 覆盖，导致 props.data.isStreaming 仍为 true
                  data: { ...n.data, content, isStreaming: false },
                }
              : n
          )
        );
      },
      [setNodes]
    );
  
    const collectChildren = useCallback( 
      (nodeId: string): Set<string> => {
        const toDelete = new Set<string>([nodeId]);
        const collect = (id: string) => {
          const out = (edges as CustomEdge[]).filter((e) => e.source === id);
          for (const e of out) {
            toDelete.add(e.target);
            collect(e.target);
          }
        };
        collect(nodeId);
        return toDelete;
      },
      [edges]
    );
  
    const deleteNode = useCallback(
      (nodeId: string) => {
        if (nodeId === "1") return;
        const toDelete = collectChildren(nodeId);
        setNodes((nds) => nds.filter((n) => !toDelete.has(n.id)));
        setEdges((eds) =>
          (eds as CustomEdge[]).filter(
            (e) => !toDelete.has(e.source) && !toDelete.has(e.target)
          )
        );
        setTimeout(autoLayout, 50);
      },
      [collectChildren, setNodes, setEdges, autoLayout]
    );
  
    const generateStorySettings = useCallback(
      (sourceNodeId: string) => {
        const source = nodes.find((n) => n.id === sourceNodeId);
        if (!source) return;
        const baseX = source.position.x + 400;
        const spacing = 120;
        const parentY = source.position.y;
        const ys = [parentY - spacing, parentY, parentY + spacing];
        const newNodes: CustomNode[] = [];
        const newEdges: CustomEdge[] = [];
        for (let i = 0; i < 3; i++) {
          const nid = `story-setting-${Date.now()}-${i}`;
          newNodes.push({
            id: nid,
            type: "settingCard",
            position: { x: baseX, y: ys[i] },
            draggable: hasIdea,
            data: {
              label: "故事设定",
              content: "",
              isStreaming: true,
              inspirationWord: source.data?.inspirationWord,
              inspirationTheme: source.data?.inspirationTheme,
              shortSummary: source.data?.content,
              inspirationDrawId,
            },
          });
          newEdges.push({
            id: `e${sourceNodeId}-${nid}`,
            source: sourceNodeId,
            target: nid,
            type: "smoothstep",
            animated: true,
            sourceHandle: "right-handle",
            targetHandle: "left-handle",
          });
        }
        const nextNodes = [...nodes, ...newNodes];
        const nextEdges = [...(edges as CustomEdge[]), ...newEdges];
        applyGraphAndAutoLayout(nextNodes, nextEdges);
      },
      [nodes, edges, hasIdea, inspirationDrawId, applyGraphAndAutoLayout]
    );
  
    const addSummaryCard = useCallback(
      (sourceNodeId: string) => {
        const source = nodes.find((n) => n.id === sourceNodeId);
        if (!source) return;

        const edgesArr = edges as CustomEdge[];
        const parentEdge = edgesArr.find((e) => e.target === sourceNodeId);
        const parentId = parentEdge?.source ?? "1";
        const siblingEdges = edgesArr.filter((e) => e.source === parentId);
        const siblingNodesInfo = siblingEdges
          .map((edge) => {
            const node = nodes.find((n) => n.id === edge.target);
            return {
              node,
              y: node?.position.y ?? 0,
              edgeId: edge.id,
            };
          })
          .filter((item) => item.node);

        siblingNodesInfo.sort((a, b) => a.y - b.y);
        const sourceNodeInfo = siblingNodesInfo.find(
          (item) => item.node?.id === sourceNodeId
        );
        const sourceIndex = sourceNodeInfo
          ? siblingNodesInfo.indexOf(sourceNodeInfo)
          : -1;

        const newY = source.position.y + 200;

        const newNodeId = `summaryCard-${Date.now()}`;
        const newNode: CustomNode = {
          id: newNodeId,
          type: "summaryCard",
          position: { x: source.position.x, y: newY },
          draggable: hasIdea,
          data: {
            label: "故事梗概",
            content: "",
            isStreaming: true,
            inspirationWord: source.data?.inspirationWord,
            inspirationTheme: source.data?.inspirationTheme,
            shortSummary: source.data?.shortSummary,
            storySetting: source.data?.storySetting,
            inspirationDrawId: source.data?.inspirationDrawId ?? inspirationDrawId,
          },
        };

        const newEdge: CustomEdge = {
          id: `e${parentId}-${newNodeId}`,
          source: parentId,
          target: newNodeId,
          type: "smoothstep",
          animated: true,
          sourceHandle: "right-handle",
          targetHandle: "left-handle",
        };

        const nextNodes = [...nodes];
        if (sourceNodeInfo && sourceIndex >= 0) {
          if (sourceIndex < siblingNodesInfo.length - 1) {
            const nextSibling = siblingNodesInfo[sourceIndex + 1];
            const nextSiblingNodeId = nextSibling.node?.id;
            const insertIndex = nextSiblingNodeId
              ? nextNodes.findIndex((n) => n.id === nextSiblingNodeId)
              : -1;
            if (insertIndex >= 0) {
              nextNodes.splice(insertIndex, 0, newNode);
            } else {
              nextNodes.push(newNode);
            }
          } else {
            const sourceNodeIdInList = sourceNodeInfo.node?.id;
            const sourceNodeIndexInNodes = sourceNodeIdInList
              ? nextNodes.findIndex((n) => n.id === sourceNodeIdInList)
              : -1;
            if (sourceNodeIndexInNodes >= 0) {
              nextNodes.splice(sourceNodeIndexInNodes + 1, 0, newNode);
            } else {
              nextNodes.push(newNode);
            }
          }
        } else {
          nextNodes.push(newNode);
        }

        const nextEdges = [...edgesArr];
        if (sourceNodeInfo?.edgeId) {
          const sourceEdgeIndex = nextEdges.findIndex((e) => e.id === sourceNodeInfo.edgeId);
          if (sourceIndex >= 0 && sourceIndex < siblingNodesInfo.length - 1) {
            const nextSibling = siblingNodesInfo[sourceIndex + 1];
            const nextSiblingEdgeIndex = nextSibling.edgeId
              ? nextEdges.findIndex((e) => e.id === nextSibling.edgeId)
              : -1;
            if (nextSiblingEdgeIndex >= 0) {
              nextEdges.splice(nextSiblingEdgeIndex, 0, newEdge);
            } else {
              if (sourceEdgeIndex >= 0) {
                nextEdges.splice(sourceEdgeIndex + 1, 0, newEdge);
              } else {
                nextEdges.push(newEdge);
              }
            }
          } else {
            if (sourceEdgeIndex >= 0) {
              nextEdges.splice(sourceEdgeIndex + 1, 0, newEdge);
            } else {
              nextEdges.push(newEdge);
            }
          }
        } else {
          nextEdges.push(newEdge);
        }

        applyGraphAndAutoLayout(nextNodes, nextEdges);
      },
      [nodes, edges, hasIdea, inspirationDrawId, applyGraphAndAutoLayout]
    );
  
    const handleMainCardCreate = useCallback(
      (nodeId: string) => {
        const source = nodes.find((n) => n.id === nodeId);
        if (!source) return;
        // 先立即创建节点，避免等待接口导致“点了按钮但画布不出节点”
        const baseX = source.position.x + 400;
        const spacing = 120;
        const parentY = source.position.y;
        const ys = [parentY - spacing, parentY, parentY + spacing];
        const newNodes: CustomNode[] = [];
        const newEdges: CustomEdge[] = [];
        for (let i = 0; i < 3; i++) {
          const nid = `summaryCard-${Date.now()}-${i}`;
          newNodes.push({
            id: nid,
            type: "summaryCard",
            position: { x: baseX, y: ys[i] },
            draggable: hasIdea,
            isCreated: true,
            data: {
              label: "故事梗概",
              content: "",
              inspirationWord: source.data?.inspirationWord,
              inspirationTheme: source.data?.inspirationTheme,
              inspirationDrawId: inspirationDrawId || undefined,
              isStreaming: true,
            },
          });
          newEdges.push({
            id: `e${nodeId}-${nid}`,
            source: nodeId,
            target: nid,
            type: "smoothstep",
            animated: true,
            sourceHandle: "right-handle",
            targetHandle: "left-handle",
          });
        }

        const mainCards = nodes.filter(
          (n) => n.type === "mainCard" && n.id !== nodeId
        );
        const toRemove = new Set(mainCards.map((n) => n.id));
        const nextNodes: CustomNode[] = [
          ...nodes.filter((n) => n.type !== "mainCard" || n.id === nodeId),
          ...newNodes,
        ];
        const nextEdges: CustomEdge[] = [
          ...(edges as CustomEdge[]).filter(
            (e) => !toRemove.has(e.source) && !toRemove.has(e.target)
          ),
          ...newEdges,
        ];

        applyGraphAndAutoLayout(nextNodes, nextEdges);
        setCanvasReady(true);

        // 后台生成 drawId，成功后回写到状态与各节点 data 中
        void (async () => {
          try {
            const { generateInspirationDrawIdReq } = await import("@/api/works");
            const res: any = await generateInspirationDrawIdReq(workId, {
              nodes: nextNodes,
              edges: nextEdges,
            });
            if (!res?.id) return;
            const drawId = String(res.id);
            setInspirationDrawId(drawId);
            setNodes((nds) =>
              nds.map((n) => ({
                ...n,
                data: { ...n.data, inspirationDrawId: drawId },
              }))
            );
          } catch {
            // ignore
          }
        })();
      },
      [workId, nodes, edges, hasIdea, inspirationDrawId, setNodes, applyGraphAndAutoLayout]
    );
  
    const addSettingCard = useCallback(
      (sourceNodeId: string) => {
        const source = nodes.find((n) => n.id === sourceNodeId);
        if (!source) return;
        const edgesArr = edges as CustomEdge[];
        const parentEdge = edgesArr.find((e) => e.target === sourceNodeId);
        const parentId = parentEdge?.source ?? "1";
        const siblingEdges = edgesArr.filter((e) => e.source === parentId);
        const siblingNodesInfo = siblingEdges
          .map((edge) => {
            const node = nodes.find((n) => n.id === edge.target);
            return {
              node,
              y: node?.position.y ?? 0,
              edgeId: edge.id,
            };
          })
          .filter((item) => item.node);

        siblingNodesInfo.sort((a, b) => a.y - b.y);
        const sourceNodeInfo = siblingNodesInfo.find(
          (item) => item.node?.id === sourceNodeId
        );
        const sourceIndex = sourceNodeInfo
          ? siblingNodesInfo.indexOf(sourceNodeInfo)
          : -1;
        const nid = `story-setting-${Date.now()}`;
        const newY = source.position.y + 200;
        const newNode: CustomNode = {
          id: nid,
          type: "settingCard",
          position: { x: source.position.x, y: newY },
          draggable: hasIdea,
          data: {
            label: "故事设定",
            content: "",
            isStreaming: true,
            expandable: true,
            inspirationWord: source.data?.inspirationWord,
            inspirationTheme: source.data?.inspirationTheme,
            shortSummary: source.data?.shortSummary,
            storySetting: source.data?.storySetting,
            inspirationDrawId: source.data?.inspirationDrawId ?? inspirationDrawId,
          },
        };
        const newEdge: CustomEdge = {
          id: `e${parentId}-${nid}`,
          source: parentId,
          target: nid,
          type: "smoothstep",
          animated: true,
          sourceHandle: "right-handle",
          targetHandle: "left-handle",
        };

        const nextNodes = [...nodes];
        if (sourceNodeInfo && sourceIndex >= 0) {
          if (sourceIndex < siblingNodesInfo.length - 1) {
            const nextSibling = siblingNodesInfo[sourceIndex + 1];
            const nextSiblingNodeId = nextSibling.node?.id;
            const insertIndex = nextSiblingNodeId
              ? nextNodes.findIndex((n) => n.id === nextSiblingNodeId)
              : -1;
            if (insertIndex >= 0) {
              nextNodes.splice(insertIndex, 0, newNode);
            } else {
              nextNodes.push(newNode);
            }
          } else {
            const sourceNodeIdInList = sourceNodeInfo.node?.id;
            const sourceNodeIndexInNodes = sourceNodeIdInList
              ? nextNodes.findIndex((n) => n.id === sourceNodeIdInList)
              : -1;
            if (sourceNodeIndexInNodes >= 0) {
              nextNodes.splice(sourceNodeIndexInNodes + 1, 0, newNode);
            } else {
              nextNodes.push(newNode);
            }
          }
        } else {
          nextNodes.push(newNode);
        }

        const nextEdges = [...edgesArr];
        if (sourceNodeInfo?.edgeId) {
          const sourceEdgeIndex = nextEdges.findIndex((e) => e.id === sourceNodeInfo.edgeId);
          if (sourceIndex >= 0 && sourceIndex < siblingNodesInfo.length - 1) {
            const nextSibling = siblingNodesInfo[sourceIndex + 1];
            const nextSiblingEdgeIndex = nextSibling.edgeId
              ? nextEdges.findIndex((e) => e.id === nextSibling.edgeId)
              : -1;
            if (nextSiblingEdgeIndex >= 0) {
              nextEdges.splice(nextSiblingEdgeIndex, 0, newEdge);
            } else {
              if (sourceEdgeIndex >= 0) {
                nextEdges.splice(sourceEdgeIndex + 1, 0, newEdge);
              } else {
                nextEdges.push(newEdge);
              }
            }
          } else {
            if (sourceEdgeIndex >= 0) {
              nextEdges.splice(sourceEdgeIndex + 1, 0, newEdge);
            } else {
              nextEdges.push(newEdge);
            }
          }
        } else {
          nextEdges.push(newEdge);
        }

        applyGraphAndAutoLayout(nextNodes, nextEdges);
      },
      [nodes, edges, hasIdea, inspirationDrawId, applyGraphAndAutoLayout]
    );
  
    const generateOutlineNodes = useCallback(
      (sourceNodeId: string) => {
        const source = nodes.find((n) => n.id === sourceNodeId);
        if (!source) return;
        const baseX = source.position.x + 475;
        const spacing = 278;
        const ph = (source as any).measured?.height ?? (source as CustomNode).dimensions?.height ?? 200;
        const centerY = source.position.y + ph / 2;
        const secondY = centerY - 230 / 2;
        const ys = [secondY - spacing, secondY, secondY + spacing];
        const newNodes: CustomNode[] = [];
        const newEdges: CustomEdge[] = [];
        for (let i = 0; i < 3; i++) {
          const nid = `outline-${Date.now()}-${i}`;
          newNodes.push({
            id: nid,
            type: "outlineCard",
            position: { x: baseX, y: ys[i] },
            draggable: hasIdea,
            data: {
              label: "故事大纲",
              content: "",
              expandable: true,
              inspirationWord: source.data?.inspirationWord,
              inspirationTheme: source.data?.inspirationTheme,
              shortSummary: source.data?.shortSummary,
              storySetting: source.data?.content,
              inspirationDrawId,
              isStreaming: true,
            },
          });
          newEdges.push({
            id: `e${sourceNodeId}-${nid}`,
            source: sourceNodeId,
            target: nid,
            type: "smoothstep",
            animated: true,
            sourceHandle: "right-handle",
            targetHandle: "left-handle",
          });
        }
        const nextNodes = [...nodes, ...newNodes];
        const nextEdges = [...(edges as CustomEdge[]), ...newEdges];
        applyGraphAndAutoLayout(nextNodes, nextEdges);
      },
      [nodes, edges, hasIdea, inspirationDrawId, applyGraphAndAutoLayout]
    );
  
    const addOutlineCard = useCallback(
      (sourceNodeId: string) => {
        const source = nodes.find((n) => n.id === sourceNodeId);
        if (!source) return;
        const edgesArr = edges as CustomEdge[];
        const parentEdge = edgesArr.find((e) => e.target === sourceNodeId);
        const parentId = parentEdge?.source ?? "1";
        const siblingEdges = edgesArr.filter((e) => e.source === parentId);
        const siblingNodesInfo = siblingEdges
          .map((edge) => {
            const node = nodes.find((n) => n.id === edge.target);
            return {
              node,
              y: node?.position.y ?? 0,
              edgeId: edge.id,
            };
          })
          .filter((item) => item.node);

        siblingNodesInfo.sort((a, b) => a.y - b.y);
        const sourceNodeInfo = siblingNodesInfo.find(
          (item) => item.node?.id === sourceNodeId
        );
        const sourceIndex = sourceNodeInfo
          ? siblingNodesInfo.indexOf(sourceNodeInfo)
          : -1;
        const nid = `outline-${Date.now()}`;
        const newY = source.position.y + 295;
        const newNode: CustomNode = {
          id: nid,
          type: "outlineCard",
          position: { x: source.position.x, y: newY },
          draggable: hasIdea,
          data: {
            label: "故事大纲",
            content: "",
            isStreaming: true,
            expandable: true,
            inspirationWord: source.data?.inspirationWord,
            inspirationTheme: source.data?.inspirationTheme,
            shortSummary: source.data?.shortSummary,
            storySetting: source.data?.storySetting,
            inspirationDrawId: source.data?.inspirationDrawId ?? inspirationDrawId,
          },
        };
        const newEdge: CustomEdge = {
          id: `e${parentId}-${nid}`,
          source: parentId,
          target: nid,
          type: "smoothstep",
          animated: true,
          sourceHandle: "right-handle",
          targetHandle: "left-handle",
        };

        const nextNodes = [...nodes];
        if (sourceNodeInfo && sourceIndex >= 0) {
          if (sourceIndex < siblingNodesInfo.length - 1) {
            const nextSibling = siblingNodesInfo[sourceIndex + 1];
            const nextSiblingNodeId = nextSibling.node?.id;
            const insertIndex = nextSiblingNodeId
              ? nextNodes.findIndex((n) => n.id === nextSiblingNodeId)
              : -1;
            if (insertIndex >= 0) {
              nextNodes.splice(insertIndex, 0, newNode);
            } else {
              nextNodes.push(newNode);
            }
          } else {
            const sourceNodeIdInList = sourceNodeInfo.node?.id;
            const sourceNodeIndexInNodes = sourceNodeIdInList
              ? nextNodes.findIndex((n) => n.id === sourceNodeIdInList)
              : -1;
            if (sourceNodeIndexInNodes >= 0) {
              nextNodes.splice(sourceNodeIndexInNodes + 1, 0, newNode);
            } else {
              nextNodes.push(newNode);
            }
          }
        } else {
          nextNodes.push(newNode);
        }

        const nextEdges = [...edgesArr];
        if (sourceNodeInfo?.edgeId) {
          const sourceEdgeIndex = nextEdges.findIndex((e) => e.id === sourceNodeInfo.edgeId);
          if (sourceIndex >= 0 && sourceIndex < siblingNodesInfo.length - 1) {
            const nextSibling = siblingNodesInfo[sourceIndex + 1];
            const nextSiblingEdgeIndex = nextSibling.edgeId
              ? nextEdges.findIndex((e) => e.id === nextSibling.edgeId)
              : -1;
            if (nextSiblingEdgeIndex >= 0) {
              nextEdges.splice(nextSiblingEdgeIndex, 0, newEdge);
            } else {
              if (sourceEdgeIndex >= 0) {
                nextEdges.splice(sourceEdgeIndex + 1, 0, newEdge);
              } else {
                nextEdges.push(newEdge);
              }
            }
          } else {
            if (sourceEdgeIndex >= 0) {
              nextEdges.splice(sourceEdgeIndex + 1, 0, newEdge);
            } else {
              nextEdges.push(newEdge);
            }
          }
        } else {
          nextEdges.push(newEdge);
        }

        applyGraphAndAutoLayout(nextNodes, nextEdges);
      },
      [nodes, edges, hasIdea, inspirationDrawId, applyGraphAndAutoLayout]
    );
  
    const buildParentChain = useCallback(
      (targetId: string): ParentNode | null => {
        const edge = (edges as CustomEdge[]).find((e) => e.target === targetId);
        if (!edge) return null;
        const parent = nodes.find((n) => n.id === edge.source);
        if (!parent) return null;
        const parentChain = buildParentChain(edge.source);
        const node: ParentNode = {
          id: parent.id,
          type: parent.type,
          label: parent.data?.label ?? "",
          data: parent.data,
          next: null,
        };
        if (parentChain) {
          let tail = parentChain;
          while (tail.next) tail = tail.next;
          tail.next = node;
          return parentChain;
        }
        return node;
      },
      [nodes, edges]
    );
  
    const handleOutlineGenerate = useCallback(
      (nodeId: string) => {
        const currentNode = nodes.find((n) => n.id === nodeId);
        if (!currentNode) return;
        let chain = buildParentChain(nodeId);
        const current: ParentNode = {
          id: currentNode.id,
          type: currentNode.type,
          label: currentNode.data?.label ?? "",
          data: currentNode.data,
          next: null,
        };
        if (chain) {
          let tail = chain;
          while (tail.next) tail = tail.next;
          tail.next = current;
        } else chain = current;
        setCurrentChain(chain);
        setInitWorkDialogShow(true);
      },
      [nodes, buildParentChain]
    );
  
    const generateFiles = useCallback((): Record<string, string> => {
      const files: Record<string, string> = {
        "大纲.md": "",
        "故事设定/故事简介.md": "",
        "故事设定/故事设定.md": "",
      };
      if (!currentChain) return files;
      let cur: ParentNode | null = currentChain;
      while (cur) {
        if (cur.type === "summaryCard" && cur.data?.content)
          files["故事设定/故事简介.md"] = cur.data.content;
        if (cur.type === "settingCard" && cur.data?.content)
          files["故事设定/故事设定.md"] = cur.data.content;
        if (cur.type === "outlineCard" && cur.data?.content)
          files["大纲.md"] = cur.data.content;
        cur = cur.next;
      }
      return files;
    }, [currentChain]);
  
    const handleCreateHere = useCallback(() => {
      const files = generateFiles();
      onCreateHere?.(files, currentChain);
      setInitWorkDialogShow(false);
    }, [generateFiles, currentChain, onCreateHere]);
  
    const handleCreateNew = useCallback(() => {
      const files = generateFiles();
      onCreateNew?.(files, currentChain);
      setInitWorkDialogShow(false);
    }, [generateFiles, currentChain, onCreateNew]);
  
    const handleGenerateIns = useCallback(async () => {
      if (isLoading) return;
      setIsLoading(true);
      try {
        setReqIdeaContent(ideaContent);
        const { generateInspirationReqNew, generateInspirationImageReq } =
          await import("@/api/works");
        const req: any = await generateInspirationReqNew(ideaContent || undefined);
        if (req?.inspirations?.length > 0) {
          const dataToUse = req.inspirations.slice(0, 3);
          const w =
            containerRef.current?.clientWidth || window.innerWidth || 1920;
          const cards = createCardsFromInspiration(
            dataToUse,
            req?.inspirationWord,
            inspirationDrawId || undefined,
            w
          );
          setNodes(cards);
          setEdges([]);
          const imageReq: any[] = await generateInspirationImageReq({
            inspirationWord: req?.inspirationWord,
            inspirations: req?.inspirations,
          });
          if (Array.isArray(imageReq)) {
            setNodes((nds) =>
              nds.map((n) => {
                if (n.type !== "mainCard" || !n.data?.content) return n;
                const match = imageReq.find(
                  (item: any) => item.inspirationTheme === n.data?.content
                );
                if (match?.imageUrl)
                  return { ...n, data: { ...n.data, image: match.imageUrl } };
                return n;
              })
            );
          }
          msg("success", "灵感生成成功！");
        } else {
          msg("warning", "返回数据格式不正确，请重试");
        }
      } catch (e: any) {
        msg("error", e.message);
      } finally {
        setIsLoading(false);
      }
    }, [
      ideaContent,
      isLoading,
      inspirationDrawId,
      setNodes,
      setEdges,
      msg,
    ]);
  
    const refreshCards = useCallback(
      async (content: string) => {
        setReqIdeaContent(content);
        setIsLoading(true);
        setNodes((nds) =>
          nds.map((n) => {
            if (n.type !== "mainCard") return n;
            return { ...n, data: { ...n.data, content: "", image: "" } };
          })
        );
        try {
          const { generateInspirationReqNew, generateInspirationImageReq } =
            await import("@/api/works");
          const req: any = await generateInspirationReqNew(content || undefined);
          if (req?.inspirations?.length > 0) {
            const dataToUse = req.inspirations.slice(0, 3);
            const imageReq: any[] = await generateInspirationImageReq({
              inspirationWord: req?.inspirationWord,
              inspirations: req?.inspirations,
            });
            setNodes((nds) =>
              nds.map((n, idx) => {
                if (n.type !== "mainCard" || !dataToUse[idx]) return n;
                const item = dataToUse[idx];
                const match = Array.isArray(imageReq)
                  ? imageReq.find((i: any) => i.inspirationTheme === item.inspirationTheme)
                  : null;
                return {
                  ...n,
                  data: {
                    ...n.data,
                    content: item.inspirationTheme,
                    inspirationTheme: item.inspirationTheme,
                    inspirationWord: req?.inspirationWord,
                    inspirationDrawId: inspirationDrawId || undefined,
                    image: match?.imageUrl ?? n.data?.image,
                  },
                };
              })
            );
            msg("success", "卡片已刷新！");
          } else {
            msg("warning", "获取数据失败，请重试");
          }
        } catch (e) {
          msg("error", "刷新卡片失败，请稍后重试");
        } finally {
          setIsLoading(false);
        }
      },
      [inspirationDrawId, setNodes, msg]
    );

    const addNewCanvas = useCallback(() => {
      setIsLoading(false);
      setNodes([]);
      setEdges([]);
      setInspirationDrawId("");
      createNewCanvasSessionId(workId);
    }, [createNewCanvasSessionId, setNodes, setEdges, workId]);

    const handleSaveCanvas = useCallback(async (sessionIdOverride?: string) => {
      if (!inspirationDrawId) {
        msg("warning", "请先创建画布");
        return;
      }
      try {
        await saveInspirationCanvasReq(inspirationDrawId, {
          nodes: nodes as unknown[],
          edges: edges as unknown[],
        });
        msg("success", "保存成功");
      } catch {
        msg("error", "保存失败，请稍后重试");
      }
    }, [inspirationDrawId, nodes, edges, msg, getOrCreateCanvasSessionId, workId]);

    const getCanvasSessionId = useCallback(() => {
      if (!workId) return "";
      return getOrCreateCanvasSessionId(workId);
    }, [getOrCreateCanvasSessionId, workId]);

    useEffect(() => {
      return () => {
        clearCanvasSessionId(workId);
      };
    }, [clearCanvasSessionId, workId]);

    const openHistory = useCallback(() => setHistoryDialogShow(true), []);

    useImperativeHandle(
      canvasRef,
      () => ({
        addNewCanvas,
        openHistory,
        saveCanvas: handleSaveCanvas,
        inspirationDrawId,
        isLoading,
      }),
      [addNewCanvas, openHistory, handleSaveCanvas, inspirationDrawId, isLoading]
    );

    const onCanvasReadyRef = useRef(onCanvasReady);
    onCanvasReadyRef.current = onCanvasReady;
    useEffect(() => {
      onCanvasReadyRef.current?.();
    }, [inspirationDrawId, isLoading]);

    const handleRestoreVersion = useCallback(
      (version: InspirationVersion) => {
        try {
          if (version.content) {
            const data = JSON.parse(version.content);
            if (data.nodes && data.edges) {
              setNodes(data.nodes);
              setEdges(data.edges);
              setInspirationDrawId(String(version?.inspirationDrawId ?? ""));
              msg("success", "版本恢复成功");
              setTimeout(autoLayout, 100);
            } else {
              msg("error", "版本数据格式错误");
            }
          } else {
            msg("error", "版本数据为空");
          }
        } catch (e) {
          msg("error", "恢复版本失败");
        }
      },
      [setNodes, setEdges, msg, autoLayout]
    );
  
    const handlers = useMemo(
      () => ({
        handleMainCardCreate,
        handleSummaryGenerate: generateStorySettings,
        handleSummaryAdd: addSummaryCard,
        handleSummaryDelete: deleteNode,
        handleSummaryUpdate: (id: string, c: string) => {
          updateNodeContent(id, c);
          // 不触发 autoLayout，避免流式接口结束后新节点被 dagre 排到顶部
        },
        handleSummaryExpand: () => scheduleAutoLayoutForExpand(),
        handleSettingGenerate: generateOutlineNodes,
        handleSettingAdd: addSettingCard,
        handleSettingDelete: deleteNode,
        handleSettingUpdate: (id: string, c: string) => {
          updateNodeContent(id, c);
          // 不触发 autoLayout，与 addSummaryCard 一致，避免流式输出时新节点被 dagre 排到顶部
        },
        handleSettingExpand: () => scheduleAutoLayoutForExpand(),
        handleOutlineGenerate,
        handleOutlineAdd: addOutlineCard,
        handleOutlineDelete: deleteNode,
        handleOutlineUpdate: (id: string, c: string) => {
          updateNodeContent(id, c);
          // 不触发 autoLayout，避免流式接口结束后新节点被 dagre 排到顶部
        },
        handleOutlineExpand: () => scheduleAutoLayoutForExpand(),
        getCanvasSessionId,
        msg,
      }),
      [
        handleMainCardCreate,
        generateStorySettings,
        addSummaryCard,
        deleteNode,
        updateNodeContent,
        scheduleAutoLayoutForExpand,
        generateOutlineNodes,
        addSettingCard,
        handleOutlineGenerate,
        addOutlineCard,
        getCanvasSessionId,
        msg
      ]
    );
  
    const showInit = !tree?.length;
  
    return (
      <InsCanvasContext.Provider value={handlers}>
        <div
          ref={containerRef}
          className="relative flex h-full w-full min-w-[400px] flex-col bg-muted/30"
        >
          {showInit ? (
            <>
            <div className="relative flex flex-1 flex-col items-center justify-start overflow-hidden px-4">
              <BubblesContainer isAnimate={isLoading} />
              <h1 className="-mt-[90px] z-10 text-center text-[26px] font-semibold text-foreground">
                {isLoading
                  ? `爆文猫写作正在生成${ideaContent ? ideaContent + "选题" : "随机选题"}...`
                  : "与爆文猫写作一起脑洞大开地创作"}
              </h1>
              <div className="relative z-10 mt-8 w-[308px] rounded-xl border-2 border-dashed border-orange-200 bg-background p-4 pb-12 shadow-sm">
                <Textarea
                  className="min-h-0 w-full border-0 outline-none ring-0 shadow-none p-0 focus-within:ring-0"
                  areaClassName="min-h-0 resize-none border-0 bg-transparent p-0 text-base leading-relaxed shadow-none outline-none focus:border-0 focus:outline-none focus-visible:ring-0 disabled:opacity-60 md:text-base"
                  value={ideaContent}
                  onChange={(e) => setIdeaContent(e.target.value)}
                  placeholder="输入一个想法,或点随机选题开始创作"
                  rows={4}
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  className="absolute bottom-3 right-3 shrink-0"
                  disabled={isLoading}
                  onClick={handleGenerateIns}
                >
                  {ideaContent === "" ? (
                    <span className="flex items-center gap-2 text-white">
                      <span>随机选题</span>
                      <Iconfont unicode="&#xe7e2;" className="text-white shrink-0 !text-sm" />
                    </span>
                  ) : (
                    <Iconfont unicode="&#xe7e2;" className="text-white shrink-0 !text-sm" />
                  )}
                </Button>
              </div>
            </div>
            </>
            
          ) : (
            <div className="relative flex-1 min-h-[200px]">
              <ReactFlow
                id="main-canvas-flow"
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                proOptions={{ hideAttribution: true }}
                onMove={(_, viewport) => {
                  if (!viewport) return;
                  setZoomPercent(Math.round((viewport.zoom || 1) * 100));
                }}
                defaultEdgeOptions={{
                  type: "smoothstep",
                  style: {
                    // 基础连线样式：细一点、浅灰色、圆角
                    stroke: "#DEDEDE",
                    strokeWidth: 2,
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                  },
                  // 在目标节点一侧显示与线条同色的开放箭头
                  markerEnd: {
                    type: MarkerType.Arrow,
                    color: "#DEDEDE",
                    width: 18,
                    height: 18,
                  },
                }}
                defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                onPaneContextMenu={(e) => e.preventDefault()}
                zoomOnScroll={canInteract}
                zoomOnPinch={canInteract}
                // 画布空白区支持左/中/右键拖拽；可通过手型按钮关闭
                panOnDrag={canInteract && panMode ? [0, 1, 2] : false}
                panOnScroll={canInteract}
                panActivationKeyCode={canInteract && panMode ? 'Space' : null}
                nodesDraggable={canInteract}
                elementsSelectable={canInteract}
                nodesConnectable={canInteract}
                minZoom={canInteract ? 0.1 : 1}
                maxZoom={canInteract ? 2 : 1}
                className={`h-full w-full bg-muted/30 ${!hasIdea ? "no-idea" : ""}`}
              >
                {hasIdea && (
                  <Controls
                    showZoom={false}
                    showFitView={true}
                    showInteractive={false}
                    position="top-left"
                    orientation="vertical"
                    style={{
                      left: 16,
                      top: "50%",
                      transform: "translateY(-50%)",
                    }}
                    className="bg-background/90 !rounded-full shadow-sm border px-1 py-2 flex flex-col items-stretch gap-2"
                  >
                    <ControlButton
                      aria-label={panMode ? "关闭画布拖拽" : "开启画布拖拽"}
                      title={panMode ? "关闭画布拖拽" : "开启画布拖拽"}
                      onClick={() => setPanMode((v) => !v)}
                      className={panMode ? "!bg-primary !text-white !rounded-full" : "!rounded-full"}
                    >
                      {/* 简单手型图标：可以替换成你们自己的 iconfont */}
                      <span className="iconfont">&#xe86c;</span>
                    </ControlButton>
                  </Controls>
                )}
                <MiniMap
                  pannable={canInteract}
                  zoomable={canInteract}
                  // 上移一点，避免和右下角缩放按钮重叠
                  style={{ bottom: 48 }}
                />
                <div className="pointer-events-auto absolute bottom-5 right-5 z-50 flex items-center rounded-full border bg-background px-2 py-1 text-xs shadow-sm">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={!hasIdea}
                    onClick={() => hasIdea && zoomOut()}
                    aria-label="Zoom out"
                  >
                    −
                  </Button>
                  <span className="mx-1 min-w-[3rem] text-center tabular-nums">
                    {zoomPercent}%
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={!hasIdea}
                    onClick={() => hasIdea && zoomIn()}
                    aria-label="Zoom in"
                  >
                    +
                  </Button>
                </div>

                <Background />
              </ReactFlow>
              {/* <div className="pointer-events-auto absolute bottom-5 right-5 z-50 flex items-center gap-2 rounded-md border bg-background/80 p-1 shadow-sm backdrop-blur">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  disabled={!hasIdea}
                  onClick={() => hasIdea && zoomOut()}
                  aria-label="Zoom out"
                >
                  −
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  disabled={!hasIdea}
                  onClick={() => hasIdea && zoomIn()}
                  aria-label="Zoom in"
                >
                  +
                </Button>
              </div> */}
              {!hasIdea && (
                <div
                className="
                  pointer-events-auto absolute left-1/2 z-50 isolate flex -translate-x-1/2 flex-col items-center
                  top-[360px] sm:top-[400px] md:top-[440px] lg:top-[480px] xl:top-[520px]
                "
              >
                  <Button
                    type="button"
                    className="h-[42px] bg-foreground px-4 text-base text-background hover:bg-foreground/90"
                    disabled={isLoading}
                    onClick={() => refreshCards(reqIdeaContent)}
                  >
                    <span className="refresh-icon">⟳</span>
                    <span className="refresh-text">换一批</span>
                  </Button>
                  <div className="relative z-10 mt-8 w-[308px] rounded-xl border-2 border-dashed border-orange-200 bg-background p-4 pb-12 shadow-sm">
                    <Textarea
                      className="min-h-0 w-full border-0 outline-none ring-0 shadow-none p-0 focus-within:ring-0"
                      areaClassName="min-h-0 resize-none border-0 bg-transparent p-0 text-base leading-relaxed shadow-none outline-none focus:border-0 focus:outline-none focus-visible:ring-0 disabled:opacity-60 md:text-base"
                      value={ideaContent}
                      disabled={isLoading}
                      onChange={(e) => setIdeaContent(e.target.value)}
                      placeholder="输入一个想法，或点随机选题开始创作"
                      rows={4}
                    />
                    <Button
                      type="button"
                      className="absolute bottom-3 right-3"
                      disabled={isLoading}
                      onClick={() => refreshCards(ideaContent)}
                    >
                      {!ideaContent ? (
                        <span className="mr-3 text-white">随机选题</span>
                      ) : <Iconfont unicode="&#xe7e2;" className="text-white shrink-0 !text-sm" />}
                      {/* <span className="dropdown-icon iconfont">&#xe7a1;</span> */}
                    </Button>
                  </div>
                </div>
              )}

            </div>
          )}
          <InitWorkDialog
            open={initWorkDialogShow}
            onClose={() => setInitWorkDialogShow(false)}
            onCreateHere={handleCreateHere}
            onCreateNew={handleCreateNew}
          />
          <InspirationHistoryDialog
            open={historyDialogShow}
            onClose={() => setHistoryDialogShow(false)}
            workId={workId}
            inspirationDrawId={inspirationDrawId}
            onRestore={handleRestoreVersion}
          />
        </div>
        <style>{`
          /* 统一连接线样式：细灰色圆角，和 Vue 版保持一致风格 */
          #main-canvas-flow .react-flow__edge-path {
            stroke: #DEDEDE;
            stroke-width: 2px;
            stroke-linecap: round;
            stroke-linejoin: round;
          }
            /* 流式/高亮连线：虚线 + 流动动画 */
          #main-canvas-flow .react-flow__edge.animated .react-flow__edge-path {
            stroke-dasharray: 5;
            animation: rf-dashdraw 0.6s linear infinite;
          }

          @keyframes rf-dashdraw {
            to {
              stroke-dashoffset: -10;
            }
          }

          /* 左侧 Controls 工具栏：按钮统一圆角背景 */
          #main-canvas-flow .react-flow__controls {
            border-radius: 9999px;
            overflow: hidden;
          }

          #main-canvas-flow .react-flow__controls-button {
            border-radius: 9999px;
          }

          /* 主卡片骨架屏左到右高亮动画 */
          .ins-skeleton {
            position: relative;
            overflow: hidden;
            background-color: #e5e7eb;
          }

          .ins-skeleton::before {
            content: "";
            position: absolute;
            inset: 0;
            transform: translateX(-100%);
            background-image: linear-gradient(
              90deg,
              rgba(255,255,255,0) 0%,
              rgba(255,255,255,0.9) 50%,
              rgba(255,255,255,0) 100%
            );
            opacity: 0.9;
            animation: ins-skeleton-shimmer 1.4s ease-in-out infinite;
          }

          @keyframes ins-skeleton-shimmer {
            100% {
              transform: translateX(100%);
            }
          }

          /* 主卡片（card-1 / card-3）倾斜效果：仅在选择前（!hasIdea）生效，点击立即创作后取消 */
          #main-canvas-flow.no-idea .react-flow__node[data-id="card-1"] .main-card,
          #main-canvas-flow.no-idea .vue-flow__node[data-id="card-1"] .main-card {
            transform: translateY(65px) rotate(-15deg);
            transform-origin: bottom left;
          }
          #main-canvas-flow.no-idea .react-flow__node[data-id="card-3"] .main-card,
          #main-canvas-flow.no-idea .vue-flow__node[data-id="card-3"] .main-card {
            transform: translateY(65px) rotate(15deg);
            transform-origin: bottom right;
          }
        `}</style>
      </InsCanvasContext.Provider>
    );
  }
  
  const InsCanvas = React.forwardRef<InsCanvasApi, InsCanvasProps>(
    (props, ref) => (
      <ReactFlowProvider>
        <InsCanvasInner
          workId={props.workId}
          nodes={props.nodes}
          edges={props.edges}
          inspirationDrawId={props.inspirationDrawId}
          onCreateHere={props.onCreateHere}
          onCreateNew={props.onCreateNew}
          onMessage={props.onMessage}
          onCanvasReady={props.onCanvasReady}
          canvasRef={ref as React.RefObject<InsCanvasApi | null>}
        />
      </ReactFlowProvider>
    )
  );
  InsCanvas.displayName = "InsCanvas";
  export default InsCanvas;
  