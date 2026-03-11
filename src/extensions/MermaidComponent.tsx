import React, { useEffect, useMemo, useRef, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import mermaid from "mermaid";
import "./MermaidComponent.css";

let mermaidInited = false;

const initMermaid = () => {
  if (mermaidInited || typeof window === "undefined") return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "default",
    securityLevel: "loose",
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
    },
  });
  mermaidInited = true;
};

const MermaidComponent: React.FC<NodeViewProps> = ({ node, updateAttributes }) => {
  const mermaidRef = useRef<HTMLDivElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [editableCode, setEditableCode] = useState<string>((node.attrs?.code as string) || "");
  const renderIdRef = useRef("");
  const code = useMemo(() => ((node.attrs?.code as string) || "").trim(), [node.attrs?.code]);

  useEffect(() => {
    initMermaid();
  }, []);

  const renderMermaid = async () => {
    if (!code) {
      setIsLoading(false);
      return;
    }
    if (!mermaidRef.current) return;

    setIsLoading(true);
    setHasError(false);
    setErrorMessage("");

    try {
      mermaidRef.current.innerHTML = "";
      const renderId = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      renderIdRef.current = renderId;
      const { svg } = await mermaid.render(renderId, code);
      if (mermaidRef.current) {
        mermaidRef.current.innerHTML = svg;
      }
      setIsLoading(false);
    } catch (error) {
      setHasError(true);
      setIsLoading(false);

      const errorDiv = document.querySelector(`#${renderIdRef.current}`);
      const errorDiv2 = document.querySelector(`#d${renderIdRef.current}`);
      errorDiv?.remove();
      errorDiv2?.remove();
      if (mermaidRef.current) mermaidRef.current.innerHTML = "";

      if (error instanceof Error) {
        setErrorMessage(error.message || "Mermaid 图表渲染失败");
      } else {
        setErrorMessage("Mermaid 图表渲染失败");
      }
    }
  };

  const toggleEditMode = () => {
    if (isEditMode) {
      if (editableCode !== (node.attrs?.code as string)) {
        updateAttributes?.({ code: editableCode });
      }
      setIsEditMode(false);
      void renderMermaid();
      return;
    }
    setEditableCode((node.attrs?.code as string) || "");
    setIsEditMode(true);
  };

  useEffect(() => {
    setEditableCode((node.attrs?.code as string) || "");
    if (!isEditMode) {
      void renderMermaid();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.attrs?.code, isEditMode]);

  useEffect(() => {
    return () => {
      if (mermaidRef.current) mermaidRef.current.innerHTML = "";
    };
  }, []);

  return (
    <NodeViewWrapper
      className={`mermaid-container ${isLoading ? "is-loading" : ""} ${hasError ? "has-error" : ""} ${isEditMode ? "is-edit-mode" : ""}`}
    >
      <div className="mermaid-toolbar">
        <button
          type="button"
          className="mermaid-edit-btn"
          onClick={toggleEditMode}
          title={isEditMode ? "渲染图表" : "编辑图表代码"}
        >
          {isEditMode ? "预览" : "编辑"}
        </button>
      </div>

      {isEditMode ? (
        <div className="mermaid-editor">
          <textarea
            value={editableCode}
            className="mermaid-code-input"
            placeholder="输入 Mermaid 代码..."
            onChange={(e) => setEditableCode(e.target.value)}
          />
          <div className="mermaid-editor-hint">提示：点击"预览"按钮渲染图表</div>
        </div>
      ) : (
        <>
          {isLoading && <div className="mermaid-loading">正在渲染 Mermaid 图表...</div>}
          {hasError && (
            <div className="mermaid-error">
              <div className="error-message">⚠️ Mermaid 语法错误</div>
              <div className="error-detail">{errorMessage}</div>
              <div className="error-hint">提示：点击右上角"编辑"按钮修改代码</div>
            </div>
          )}
          <div ref={mermaidRef} className="mermaid-content"/>
        </>
      )}
    </NodeViewWrapper>
  );
};

export default MermaidComponent;
