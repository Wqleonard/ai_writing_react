import { useEffect, useRef, useState } from "react";
import { createApp } from "vue";
import { createPinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import { useNavigate, useParams } from "react-router-dom";
import QuickEditorVuePage from "@/vue/views/quick-editor-vue/index.vue";
import { Spinner } from "@/components/ui/Spinner";
import '@/vue/assets/element-theme.css'
import '@/vue/assets/element-css.css'

const QuickEditorVueHostPage = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const { workId } = useParams<{ workId: string }>();
  const navigate = useNavigate();
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsBootstrapping(true);
    if (!mountRef.current) return;
    if (!workId) {
      navigate("/workspace/my-place");
      return;
    }

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
      if (!mountRef.current || cancelled) return;
      app.mount(mountRef.current);
      requestAnimationFrame(() => {
        if (!cancelled) setIsBootstrapping(false);
      });
    });

    return () => {
      cancelled = true;
      app.unmount();
    };
  }, [navigate, workId]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-(--bg-editor)">
      <div ref={mountRef} className="h-screen w-screen overflow-hidden bg-(--bg-editor)" />
      {isBootstrapping ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-(--bg-editor)">
          <div className="flex items-center justify-center min-h-screen">
            <Spinner className="size-10 text-(--theme-color)" />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default QuickEditorVueHostPage;
