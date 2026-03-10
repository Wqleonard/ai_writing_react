import { useEffect, useRef } from "react";
import { createApp } from "vue";
import { createPinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import { useParams } from "react-router-dom";
import "element-plus/dist/index.css";
import QuickEditorVuePage from "@/vue/views/quick-editor-vue/index.vue";

const QuickEditorVueHostPage = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const { workId } = useParams<{ workId: string }>();

  useEffect(() => {
    if (!mountRef.current) return;

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/quick-editor-vue/:workId", component: QuickEditorVuePage },
        { path: "/quick-editor/:workId", component: QuickEditorVuePage },
      ],
    });
    const pinia = createPinia();
    const app = createApp(QuickEditorVuePage);

    app.use(pinia);
    app.use(router);

    const targetPath = `/quick-editor-vue/${workId ?? "unknown"}`;

    void router.replace(targetPath).then(() => {
      if (mountRef.current) app.mount(mountRef.current);
    });

    return () => {
      app.unmount();
    };
  }, [workId]);

  return <div ref={mountRef} className="h-screen w-screen overflow-hidden bg-(--bg-editor)" />;
};

export default QuickEditorVueHostPage;
