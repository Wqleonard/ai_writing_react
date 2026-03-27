import EditableFlowCard from "@/components/InsCanvasV2/components/EditableFlowCard";
import { useInsCanvasHandlers } from "@/components/InsCanvasV2/InsCanvasContext";

export default function OutlineCardNode(props: any) {
  const handlers = useInsCanvasHandlers();
  const cardLabel = props?.data?.label ?? "故事大纲";
  const generateLabel = props?.data?.generateLabel ?? "开始创作";
  return (
    <EditableFlowCard
      {...props}
      data={props.data}
      type="outlineCard"
      id={props.id}
      cardLabel={cardLabel}
      generateLabel={generateLabel}
      onGenerate={handlers.handleOutlineGenerate}
      onAdd={handlers.handleOutlineAdd}
      onDelete={handlers.handleOutlineDelete}
      onUpdate={handlers.handleOutlineUpdate}
      onExpand={handlers.handleOutlineExpand}
      msg={handlers.msg}
    />
  );
}
