import React, { useCallback, useEffect, useRef, useState } from "react";
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

initMermaid();

const MermaidComponent: React.FC<NodeViewProps> = ({ node, updateAttributes }) => {
  const mermaidRef = useRef<HTMLDivElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  // 用 ref 追踪上一次渲染的 code，避免 code 未变时重复渲染
  const lastRenderedCodeRef = useRef<string | null>(null);
  const renderIdRef = useRef("");

  const code = ((node.attrs?.code as string) || "").trim();
  const [editableCode, setEditableCode] = useState(code);

  const renderMermaid = useCallback(async (codeToRender: string) => {
    if (!codeToRender) {
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
      const { svg } = await mermaid.render(renderId, codeToRender);
      if (mermaidRef.current) {
        mermaidRef.current.innerHTML = svg;
      }
      lastRenderedCodeRef.current = codeToRender;
      setIsLoading(false);
    } catch (error) {
      setHasError(true);
      setIsLoading(false);
      const errorDiv = document.querySelector(`#${renderIdRef.current}`);
      const errorDiv2 = document.querySelector(`#d${renderIdRef.current}`);
      errorDiv?.remove();
      errorDiv2?.remove();
      if (mermaidRef.current) mermaidRef.current.innerHTML = "";
      setErrorMessage(error instanceof Error ? (error.message || "Mermaid 图表渲染失败") : "Mermaid 图表渲染失败");
    }
  }, []);

  // code 变化时才重新渲染，跳过相同内容的重复渲染
  useEffect(() => {
    if (isEditMode) return;
    if (code === lastRenderedCodeRef.current) return;
    void renderMermaid(code);
  }, [code, isEditMode, renderMermaid]);

  const toggleEditMode = useCallback(() => {
    if (isEditMode) {
      if (editableCode !== (node.attrs?.code as string)) {
        updateAttributes?.({ code: editableCode });
      }
      setIsEditMode(false);
      // 退出编辑模式时强制重渲染
      lastRenderedCodeRef.current = null;
      return;
    }
    setEditableCode((node.attrs?.code as string) || "");
    setIsEditMode(true);
  }, [isEditMode, editableCode, node.attrs?.code, updateAttributes]);

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
