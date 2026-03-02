import EditableFlowCard from "./EditableFlowCard";
import { useInsCanvasHandlers } from "@/components/InsCanvas/InsCanvasContext";

export default function SettingCardNode(props: any) {
  const handlers = useInsCanvasHandlers();
  return (
    <EditableFlowCard
      {...props}
      data={props.data}
      id={props.id}
      cardLabel="故事设定"
      generateLabel="生成故事大纲"
      onGenerate={handlers.handleSettingGenerate}
      onAdd={handlers.handleSettingAdd}
      onDelete={handlers.handleSettingDelete}
      onUpdate={handlers.handleSettingUpdate}
      onExpand={handlers.handleSettingExpand}
      msg={handlers.msg}
    />
  );
}
