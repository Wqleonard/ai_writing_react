import EditableFlowCard from "@/components/InsCanvasV2/components/EditableFlowCard";
import { useInsCanvasHandlers } from "@/components/InsCanvasV2/InsCanvasContext";

export default function SummaryCardNode(props: any) {
  const handlers = useInsCanvasHandlers();
  const cardLabel = props?.data?.label ?? "梗概";
  const generateLabel = props?.data?.generateLabel ?? "生成故事设定";
  return (
    <EditableFlowCard
      {...props}
      data={props.data}
      type="summaryCard"
      id={props.id}
      cardLabel={cardLabel}
      generateLabel={generateLabel}
      onGenerate={handlers.handleSummaryGenerate}
      onAdd={handlers.handleSummaryAdd}
      onDelete={handlers.handleSummaryDelete}
      onUpdate={handlers.handleSummaryUpdate}
      onExpand={handlers.handleSummaryExpand}
      msg={handlers.msg}
    />
  );
}
