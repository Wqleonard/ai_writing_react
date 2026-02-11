import {
  useCallback,
  useEffect,
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
  } from "@xyflow/react";
  import "@xyflow/react/dist/style.css";
  import MainCardNode from "./components/MainCardNode";
  import SummaryCardNode from "./components/SummaryCardNode";
  import SettingCardNode from "./components/SettingCardNode";
  import OutlineCardNode from "./components/OutlineCardNode";
  import BubblesContainer from "./components/BubblesContainer";
  import InitWorkDialog from "@/components/InsCanvas/components/InitWorkDialog";
  import InspirationHistoryDialog from "@/components/InsCanvas/components/InspirationHistoryDialog";
  import { InsCanvasContext } from "@/components/InsCanvas/InsCanvasContext";
  import { useDagreLayout } from "@/hooks/InsCanvas/useDagreLayout";
  import type {
    CustomNode,
    CustomEdge,
    TreeNode,
    InspirationItem,
    ParentNode,
    InspirationVersion,
  } from "./types";
  
  const nodeTypes = {
    mainCard: MainCardNode,
    summaryCard: SummaryCardNode,
    settingCard: SettingCardNode,
    outlineCard: OutlineCardNode,
  };
  
  interface InsCanvasProps {
    workId: string;
    nodes?: CustomNode[];
    edges?: CustomEdge[];
    inspirationDrawId?: string;
    onCreateHere?: (files: Record<string, string>, chain: ParentNode | null) => void;
    onCreateNew?: (files: Record<string, string>, chain: ParentNode | null) => void;
    onMessage?: (type: "success" | "error" | "warning", msg: string) => void;
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
  }: InsCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState<CustomNode>(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState<CustomEdge>(initialEdges);
    // autoLayout 会被 setTimeout 调用；用 ref 避免闭包拿到旧 nodes/edges 导致把新数据覆盖回去
    const nodesRef = useRef<CustomNode[]>(initialNodes);
    const edgesRef = useRef<CustomEdge[]>(initialEdges);
    const [inspirationDrawId, setInspirationDrawId] = useState(initialInspirationDrawId);
    const [ideaContent, setIdeaContent] = useState("");
    const [reqIdeaContent, setReqIdeaContent] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [initWorkDialogShow, setInitWorkDialogShow] = useState(false);
    const [historyDialogShow, setHistoryDialogShow] = useState(false);
    const [currentChain, setCurrentChain] = useState<ParentNode | null>(null);
  
    const tree = useMemo(() => convertToTreeStructure(nodes, edges), [nodes, edges]);
  
    const hasIdea = useMemo(() => {
      if (!tree || tree.length === 0) return false;
      return tree.some(findMainCardWithChildren);
    }, [tree]);
  
    const { zoomIn, zoomOut } = useReactFlow();
    const { layout: dagreLayout } = useDagreLayout();
  
    const msg = useCallback(
      (type: "success" | "error" | "warning", text: string) => {
        onMessage?.(type, text);
        if (typeof (window as any).ElMessage !== "undefined") {
          (window as any).ElMessage[type](text);
        }
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

    const autoLayout = useCallback(() => {
      if (!hasIdea) return;
      setTimeout(() => {
        try {
          const layouted = dagreLayout(
            nodesRef.current,
            edgesRef.current,
            "LR"
          );
          setNodes(layouted as CustomNode[]);
        } catch (e) {
          console.error("dagre layout error:", e);
        }
      }, 100);
    }, [hasIdea, dagreLayout, setNodes]);
  
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
        setNodes((nds) => [...nds, ...newNodes]);
        setEdges((eds) => [...eds, ...newEdges]);
        setTimeout(autoLayout, 50);
      },
      [nodes, hasIdea, inspirationDrawId, setNodes, setEdges, autoLayout]
    );
  
    const addSummaryCard = useCallback(
      (sourceNodeId: string) => {
        const source = nodes.find((n) => n.id === sourceNodeId);
        console.log('addSummaryCard', {
          nodes,
          source,
          sourceNodeId,
        })
        if (!source) return;
        const parentEdge = (edges as CustomEdge[]).find((e) => e.target === sourceNodeId);
        const parentId = parentEdge?.source ?? "1";
        const newNodeId = `summaryCard-${Date.now()}`;
        const newNode: CustomNode = {
          id: newNodeId,
          type: "summaryCard",
          position: { x: source.position.x, y: source.position.y + 200 },
          draggable: hasIdea,
          data: { label: "故事梗概", content: "", isStreaming: true },
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
        setNodes((nds) => [...nds, newNode]);
        setEdges((eds) => [...eds, newEdge]);
        setTimeout(autoLayout, 50);
      },
      [nodes, edges, hasIdea, setNodes, setEdges, autoLayout]
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

        setNodes(nextNodes);
        setEdges(nextEdges);
        setTimeout(autoLayout, 50);

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
      [workId, nodes, edges, hasIdea, inspirationDrawId, setNodes, setEdges, autoLayout]
    );
  
    const addSettingCard = useCallback(
      (sourceNodeId: string) => {
        const source = nodes.find((n) => n.id === sourceNodeId);
        if (!source) return;
        const parentEdge = (edges as CustomEdge[]).find((e) => e.target === sourceNodeId);
        const parentId = parentEdge?.source ?? "1";
        const nid = `story-setting-${Date.now()}`;
        const newNode: CustomNode = {
          id: nid,
          type: "settingCard",
          position: { x: source.position.x, y: source.position.y + 200 },
          draggable: hasIdea,
          data: { label: "故事设定", content: "", isStreaming: true, expandable: true },
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
        setNodes((nds) => [...nds, newNode]);
        setEdges((eds) => [...eds, newEdge]);
        setTimeout(autoLayout, 50);
      },
      [nodes, edges, hasIdea, setNodes, setEdges, autoLayout]
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
        setNodes((nds) => [...nds, ...newNodes]);
        setEdges((eds) => [...eds, ...newEdges]);
      },
      [nodes, hasIdea, inspirationDrawId, setNodes, setEdges]
    );
  
    const addOutlineCard = useCallback(
      (sourceNodeId: string) => {
        console.log('addOutlineCard', sourceNodeId)
        const source = nodes.find((n) => n.id === sourceNodeId);
        if (!source) return;
        const parentEdge = (edges as CustomEdge[]).find((e) => e.target === sourceNodeId);
        const parentId = parentEdge?.source ?? "1";
        const nid = `outline-${Date.now()}`;
        const newNode: CustomNode = {
          id: nid,
          type: "outlineCard",
          position: { x: source.position.x, y: source.position.y + 295 },
          draggable: hasIdea,
          data: { label: "故事大纲", content: "", isStreaming: true, expandable: true },
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
        setNodes((nds) => [...nds, newNode]);
        setEdges((eds) => [...eds, newEdge]);
        setTimeout(autoLayout, 50);
      },
      [nodes, edges, hasIdea, setNodes, setEdges, autoLayout]
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
      } catch (e) {
        msg("error", "操作失败，请稍后重试");
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
      setNodes([]);
      setEdges([]);
      setInspirationDrawId("");
    }, [setNodes, setEdges]);
  
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
          setTimeout(autoLayout, 100);
        },
        handleSettingGenerate: generateOutlineNodes,
        handleSettingAdd: addSettingCard,
        handleSettingDelete: deleteNode,
        handleSettingUpdate: (id: string, c: string) => {
          updateNodeContent(id, c);
          setTimeout(autoLayout, 150);
        },
        handleSettingExpand: () => setTimeout(autoLayout, 100),
        handleOutlineGenerate,
        handleOutlineAdd: addOutlineCard,
        handleOutlineDelete: deleteNode,
        handleOutlineUpdate: (id: string, c: string) => {
          updateNodeContent(id, c);
          setTimeout(autoLayout, 100);
        },
        handleOutlineExpand: () => setTimeout(autoLayout, 100),
      }),
      [
        handleMainCardCreate,
        generateStorySettings,
        addSummaryCard,
        deleteNode,
        updateNodeContent,
        autoLayout,
        generateOutlineNodes,
        addSettingCard,
        handleOutlineGenerate,
        addOutlineCard,
      ]
    );
  
    const showInit = !tree?.length;
  
    return (
      <InsCanvasContext.Provider value={handlers}>
        <div ref={containerRef} className="com-ins-canvas">
          {showInit ? (
            <div className="ins-canvas-init">
              <BubblesContainer isAnimate={isLoading} />
              <h1 className="main-title">
                {isLoading
                  ? "爆文猫写作正在生成随机选题..."
                  : "与爆文猫写作一起脑洞大开地创作"}
              </h1>
              <div className="input-container">
                <textarea
                  className="idea-textarea"
                  value={ideaContent}
                  onChange={(e) => setIdeaContent(e.target.value)}
                  placeholder="输入一个想法,或点随机选题开始创作"
                  rows={4}
                  disabled={isLoading}
                />
                <button
                  className="random-topic-btn-init"
                  disabled={isLoading}
                  onClick={handleGenerateIns}
                >
                  {ideaContent === "" ? (
                    <span className="mr-3">随机选题</span>
                  ) : null}
                  <span className="iconfont">&#xe7a1;</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="canvas-container min-h-200">
              <ReactFlow
                id="main-canvas-flow"
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                defaultEdgeOptions={{ type: "smoothstep" }}
                defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                zoomOnScroll={hasIdea}
                zoomOnPinch={hasIdea}
                // 避免左键拖动画布吞掉节点内部点击（按钮/输入框等）
                // 仅允许中键/右键拖动平移画布
                panOnDrag={hasIdea ? [1, 2] : false}
                panOnScroll={hasIdea}
                nodesDraggable={hasIdea}
                elementsSelectable={hasIdea}
                nodesConnectable={hasIdea}
                minZoom={hasIdea ? 0.1 : 1}
                maxZoom={hasIdea ? 2 : 1}
                className={`vue-flow-container ${!hasIdea ? "no-idea" : ""}`}
              >
                {hasIdea && <Controls />}
                <MiniMap />
                <Background />
              </ReactFlow>
              <div className="zoom-controls">
                <button
                  className="zoom-btn"
                  disabled={!hasIdea}
                  onClick={() => hasIdea && zoomOut()}
                >
                  −
                </button>
                <button
                  className="zoom-btn"
                  disabled={!hasIdea}
                  onClick={() => hasIdea && zoomIn()}
                >
                  +
                </button>
              </div>
              {!hasIdea && (
                <div className="ins-actions-container">
                  <button
                    className="refresh-cards-btn"
                    disabled={isLoading}
                    onClick={() => refreshCards(reqIdeaContent)}
                  >
                    <span className="refresh-icon">⟳</span>
                    <span className="refresh-text">换一批</span>
                  </button>
                  <div className="idea-input-wrapper">
                    <textarea
                      className="idea-input"
                      value={ideaContent}
                      onChange={(e) => setIdeaContent(e.target.value)}
                      placeholder="输入一个想法，或点随机选题开始创作"
                      rows={4}
                    />
                    <button
                      className="random-topic-btn"
                      disabled={isLoading}
                      onClick={() => refreshCards(ideaContent)}
                    >
                      {!ideaContent ? (
                        <span className="mr-3">随机选题</span>
                      ) : null}
                      <span className="dropdown-icon iconfont">&#xe7a1;</span>
                    </button>
                  </div>
                </div>
              )}
              {hasIdea && (
                <div className="history-actions">
                  <button onClick={addNewCanvas} className="link-btn">
                    <span className="iconfont">&#xea7f;</span>
                  </button>
                  <button
                    onClick={() => {
                      if (!inspirationDrawId) {
                        msg("warning", "请先创建画布");
                        return;
                      }
                      setHistoryDialogShow(true);
                    }}
                    className="link-btn"
                  >
                    <span className="iconfont">&#xead4;</span>
                  </button>
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
          .com-ins-canvas {
            width: 100%; height: 100%; min-width: 400px; display: flex; flex-direction: column;
            background: var(--bg-primary, #f5f6f8);
          }
          .ins-canvas-init {
            flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
            position: relative; overflow: hidden;
          }
          .ins-canvas-init .main-title {
            font-size: 26px; font-weight: 600; color: #333; text-align: center; z-index: 1; margin-top: -90px;
          }
          .ins-canvas-init .input-container {
            margin-top: 32px; position: relative; width: 308px; background: #fff; border: 2px dashed #f0c29a;
            border-radius: 12px; padding: 16px; padding-bottom: 50px; z-index: 1;
          }
          .ins-canvas-init .idea-textarea {
            width: 100%; border: none; outline: none; resize: none; font-size: 16px; line-height: 1.6;
            padding: 0; box-sizing: border-box;
          }
          .ins-canvas-init .random-topic-btn-init {
            position: absolute; bottom: 12px; right: 12px; border-radius: 6px; padding: 8px 16px;
            background: #409eff; color: white; border: none; cursor: pointer; font-size: 14px;
          }
          .canvas-container { flex: 1; position: relative; min-height: 200px; }
          .canvas-container .zoom-controls {
            position: absolute; bottom: 20px; right: 20px; display: flex; align-items: center; gap: 8px;
            background: #fff; border: 1px solid #e4e7ed; border-radius: 6px; padding: 4px 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 10;
          }
          .zoom-btn { width: 28px; height: 28px; border: 1px solid #dcdfe6; background: #fff; cursor: pointer; }
          .vue-flow-container { width: 100%; height: 100%; background: var(--bg-primary, #f5f6f8); }
          .ins-actions-container {
            display: flex; flex-direction: column; align-items: center; position: absolute;
            top: 50%; left: 50%; transform: translate(-50%, -50%); margin-top: 150px; z-index: 10;
          }
          .refresh-cards-btn {
            padding: 12px; background: #333; color: white; border: none; border-radius: 8px;
            cursor: pointer; font-size: 16px; height: 42px;
          }
          .idea-input-wrapper { position: relative; width: 100%; max-width: 600px; margin-top: 32px; }
          .idea-input { width: 100%; border: 2px dashed #ff9800; border-radius: 12px; padding: 16px; font-size: 16px; }
          .random-topic-btn { position: absolute; bottom: 12px; right: 12px; padding: 8px 16px; background: #409eff; color: white; border: none; border-radius: 6px; cursor: pointer; }
          .history-actions { position: absolute; right: 20px; top: 20px; display: flex; gap: 8px; }
          .link-btn { background: none; border: none; cursor: pointer; font-size: 18px; }
        `}</style>
      </InsCanvasContext.Provider>
    );
  }
  
  export default function InsCanvas(props: InsCanvasProps) {
    return (
      <ReactFlowProvider>
        <InsCanvasInner
          workId={props.workId}
          nodes={props.nodes}
          edges={props.edges}
          inspirationDrawId={props.inspirationDrawId}
          onCreateHere={props.onCreateHere}
          onCreateNew={props.onCreateNew}
          onMessage={props.onMessage}
        />
      </ReactFlowProvider>
    );
  }
  