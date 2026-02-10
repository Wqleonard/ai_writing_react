import { useRef } from "react";
import { TiptapEditor } from "./TipTapEditor";
import type { EditorRef } from "./types";

const DemoPage = () => {
  const ref = useRef<EditorRef>(null);

  return (
    <div>
      <button onClick={() => console.log(ref.current?.getState())}>查看状态</button>
      <button onClick={() => ref.current?.commands.save?.()}>外部保存</button>

      <TiptapEditor ref={ref} workId="work-001" />
    </div>
  );
}

export default DemoPage;