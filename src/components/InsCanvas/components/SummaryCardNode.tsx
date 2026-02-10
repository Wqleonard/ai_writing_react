import EditableFlowCard from "./EditableFlowCard";
import { useInsCanvasHandlers } from "@/components/InsCanvas/InsCanvasContext";

export default function SummaryCardNode(props: any) {
  const handlers = useInsCanvasHandlers();
  return (
    <EditableFlowCard
      {...props}
      data={props.data}
      id={props.id}
      cardLabel="故事梗概"
      generateLabel="生成故事设定"
      onGenerate={handlers.handleSummaryGenerate}
      onAdd={handlers.handleSummaryAdd}
      onDelete={handlers.handleSummaryDelete}
      onUpdate={handlers.handleSummaryUpdate}
    />
  );
}
