import EditableFlowCard from "@/components/InsCanvasV2/components/EditableFlowCard";
import { useInsCanvasHandlers } from "@/components/InsCanvasV2/InsCanvasContext";

export default function SettingCardNode(props: any) {
  const handlers = useInsCanvasHandlers();
  const cardLabel = props?.data?.label ?? "故事设定";
  const generateLabel = props?.data?.generateLabel ?? "";
  return (
    <EditableFlowCard
      {...props}
      data={props.data}
      id={props.id}
      type="settingCard"
      cardLabel={cardLabel}
      generateLabel={generateLabel}
      onGenerate={handlers.handleSettingGenerate}
      onAdd={handlers.handleSettingAdd}
      onDelete={handlers.handleSettingDelete}
      onUpdate={handlers.handleSettingUpdate}
      onExpand={handlers.handleSettingExpand}
      msg={handlers.msg}
    />
  );
}
