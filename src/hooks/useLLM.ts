import { useSyncExternalStore, useCallback } from "react";

interface LLMState {
  modelsLLM: { id: string; name: string }[];
  modelLLM: string;
  selectedWritingStyle: string;
  writingStyles: { id: string; name: string }[];
}

const DEFAULT_MODELS_LLM = [
  { id: "kimi_k2", name: "KIMI K2" },
  { id: "qwen_max", name: "Qwen-Max" },
  { id: "deepseek_v3.2", name: "DeepSeek-V3.2" },
  { id: "doubao_seed_1.8", name: "豆包-1.8" },
  { id: "glm_4.7", name: "GLM-4.7" },
  // { id: 'gpt_5.4', name: 'GPT 5.4' },
  // { id: 'gemini-3.1-flash-lite', name: 'gemini-3.1-flash-lite' },
  // { id: 'gemini-2.5-flash-lite', name: 'gemini-2.5-flash-lite' },
  // { id: 'gemini-3.1-pro', name: 'gemini-3.1-pro' }
];

const initialState: LLMState = {
  modelsLLM: DEFAULT_MODELS_LLM,
  modelLLM: "kimi_k2",
  selectedWritingStyle: "1",
  writingStyles: [],
};

let state: LLMState = { ...initialState };
const listeners = new Set<() => void>();

function getSnapshot(): LLMState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(): void {
  listeners.forEach((l) => l());
}

export function resetLLMState(): void {
  state = { ...initialState };
  emit();
}

export function useLLM() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setModelLLM = useCallback((id: string) => {
    state = { ...state, modelLLM: id };
    emit();
  }, []);

  const setSelectedWritingStyle = useCallback((id: string) => {
    state = { ...state, selectedWritingStyle: id };
    emit();
  }, []);

  const setWritingStyles = useCallback(
    (styles: { id: string; name: string }[]) => {
      state = { ...state, writingStyles: styles };
      emit();
    },
    []
  );

  return {
    modelsLLM: snapshot.modelsLLM,
    modelLLM: snapshot.modelLLM,
    selectedWritingStyle: snapshot.selectedWritingStyle,
    writingStyles: snapshot.writingStyles,
    setModelLLM,
    setSelectedWritingStyle,
    setWritingStyles,
  };
}
