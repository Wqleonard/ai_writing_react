import { useEffect, useRef } from "react";
import { createApp } from "vue";
import { createPinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import { useParams } from "react-router-dom";
import "element-plus/dist/index.css";
import ScriptEditorVuePage from "@/vue/views/script-editor-vue/index.vue";

const ScriptEditorVueHostPage = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const { workId } = useParams<{ workId: string }>();

  useEffect(() => {
    if (!mountRef.current) return;

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/script-editor-vue/:workId", component: ScriptEditorVuePage },
        { path: "/script-editor/:workId", component: ScriptEditorVuePage },
      ],
    });
    const pinia = createPinia();
    const app = createApp(ScriptEditorVuePage);

    app.use(pinia);
    app.use(router);

    const targetPath = `/script-editor-vue/${workId ?? "unknown"}`;

    void router.replace(targetPath).then(() => {
      if (mountRef.current) app.mount(mountRef.current);
    });

    return () => {
      app.unmount();
    };
  }, [workId]);

  return <div ref={mountRef} className="h-screen w-screen overflow-hidden bg-(--bg-editor)" />;
};

export default ScriptEditorVueHostPage;
