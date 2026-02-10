import { useRef, useState } from "react";
import TiptapEditorNew from "@/components/editor/TiptapEditorNew";
import type { EditorRef } from "@/components/editor/types";

const DemoPage = () => {
  const ref = useRef<EditorRef>(null);
  const [value, setValue] = useState<string>("# hello");
  return (
    <div>
      <button onClick={() => console.log(ref.current?.getState())}>查看状态</button>
      <button onClick={() => ref.current?.commands.save?.()}>外部保存</button>

      <TiptapEditorNew
        value={value}
        onChange={(v) => setValue(v as string)}
        contentType="markdown"
        placeholder="开始编写..."
      />
    </div>
  );
}

export default DemoPage;