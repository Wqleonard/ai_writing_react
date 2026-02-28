import { useCallback, useEffect, useState } from "react";
import type {
  CueWord,
  RuntimePromptsFormData,
} from "../types/runtimePrompts";

const CACHE_KEY = "runtime_prompts";

function getRuntimePromptsDataFromCache(): RuntimePromptsFormData[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw || raw === "[]" || raw === "null" || raw === "undefined")
      return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function getRuntimePromptsFromFormData(
  formData: RuntimePromptsFormData[]
): CueWord[] {
  return formData
    .filter((item) => item.selected && item.content.trim())
    .map((item) => ({
      stage: item.stage,
      category: item.category,
      content: item.content,
    }));
}

export function useRuntimePrompts() {
  const [runtimePromptsFormData, setRuntimePromptsFormData] = useState<
    RuntimePromptsFormData[]
  >([]);
  const [runtime_prompts, setRuntime_prompts] = useState<CueWord[]>([]);

  useEffect(() => {
    const cached = getRuntimePromptsDataFromCache();
    if (cached.length > 0) {
      setRuntimePromptsFormData(cached);
      setRuntime_prompts(getRuntimePromptsFromFormData(cached));
    }
  }, []);

  const saveRuntimePromptsDataToCache = useCallback(() => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(runtimePromptsFormData));
  }, [runtimePromptsFormData]);

  const loadRuntimePromptsToFormData = useCallback(() => {
    const cached = getRuntimePromptsDataFromCache();
    if (cached.length > 0) {
      setRuntimePromptsFormData(cached);
      setRuntime_prompts(getRuntimePromptsFromFormData(cached));
    }
  }, []);

  const getCurrentRuntimePrompts = useCallback((): CueWord[] => {
    const cached = getRuntimePromptsDataFromCache();
    if (cached.length > 0) {
      const next = getRuntimePromptsFromFormData(cached);
      setRuntimePromptsFormData(cached);
      setRuntime_prompts(next);
      return next;
    }
    return runtime_prompts;
  }, [runtime_prompts]);

  const correctionRuntimePrompts = useCallback(
    (fromAdd = false) => {
      const local = getRuntimePromptsDataFromCache();
      setRuntimePromptsFormData((prev) => {
        const real: RuntimePromptsFormData[] = [];
        for (const item of prev) {
          if (!item.editStatus || fromAdd) {
            real.push(item);
          } else {
            const localItem = local.find((l) => l.id === item.id);
            if (localItem) real.push(localItem);
          }
        }
        setRuntime_prompts(getRuntimePromptsFromFormData(real));
        localStorage.setItem(CACHE_KEY, JSON.stringify(real));
        return real;
      });
    },
    []
  );

  const addRuntimePromptsToFormData = useCallback(() => {
    setRuntimePromptsFormData((prev) =>
      prev.concat({
        selected: false,
        editStatus: true,
        id: Date.now().toString(),
        stage: "brainwave_to_outline",
        category: "",
        content: "",
      })
    );
    setTimeout(() => correctionRuntimePrompts(true), 0);
  }, [correctionRuntimePrompts]);

  const deleteRuntimePromptsFromFormData = useCallback((id: string) => {
    setRuntimePromptsFormData((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const cueWordStageList = [
    { id: "brainwave_to_outline", name: "脑洞到粗纲" },
    { id: "outline_to_detailed", name: "粗纲到细纲" },
    { id: "detailed_to_content", name: "细纲到正文" },
  ];

  const categoryList = [
    { id: "世情文", name: "世情文" },
    { id: "虐文", name: "虐文" },
    { id: "甜文", name: "甜文" },
    { id: "爽文", name: "爽文" },
    { id: "悬疑文", name: "悬疑文" },
    { id: "死人文学", name: "死人文学" },
    { id: "复仇文", name: "复仇文" },
    { id: "重生爽文", name: "重生爽文" },
    { id: "重生甜文", name: "重生甜文" },
    { id: "职场文", name: "职场文" },
    { id: "魂穿/穿书爽文", name: "魂穿/穿书爽文" },
    { id: "魂穿/穿书甜文", name: "魂穿/穿书甜文" },
  ];

  return {
    runtime_prompts,
    runtimePromptsFormData,
    setRuntimePromptsFormData,
    getRuntimePromptsDataFromCache,
    saveRuntimePromptsDataToCache,
    addRuntimePromptsToFormData,
    deleteRuntimePromptsFromFormData,
    correctionRuntimePrompts,
    getCurrentRuntimePrompts,
    loadRuntimePromptsToFormData,
    cueWordStageList,
    categoryList,
  };
}
