import EditableFlowCard from "./EditableFlowCard";
import { useInsCanvasHandlers } from "@/components/InsCanvas/InsCanvasContext";

export default function OutlineCardNode(props: any) {
  const handlers = useInsCanvasHandlers();
  return (
    <EditableFlowCard
      {...props}
      data={props.data}
      id={props.id}
      cardLabel="故事大纲"
      generateLabel="开始创作"
      onGenerate={handlers.handleOutlineGenerate}
      onAdd={handlers.handleOutlineAdd}
      onDelete={handlers.handleOutlineDelete}
      onUpdate={handlers.handleOutlineUpdate}
      onExpand={handlers.handleOutlineExpand}
    />
  );
}
