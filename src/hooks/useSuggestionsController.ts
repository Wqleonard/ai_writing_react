import { useSyncExternalStore } from "react";
import { generateGuideReq } from "../api/works";
import type { RequestConfig } from "../api/index";

let store = { isFetching: false };
const listeners = new Set<() => void>();

function getSnapshot() {
  return store;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  listeners.forEach((l) => l());
}

class SuggestionsController {
  private abortController: AbortController | null = null;
  private requestCounter = 0;

  get isFetching(): boolean {
    return store.isFetching;
  }

  async fetch(sessionId: string, workId: number | string): Promise<unknown> {
    if (store.isFetching && this.abortController) {
      this.abortController.abort();
      this.abortController = null;
      await new Promise((r) => setTimeout(r, 50));
    }
    const currentRequestId = ++this.requestCounter;
    this.abortController = new AbortController();
    store = { ...store, isFetching: true };
    emit();

    try {
      const config: RequestConfig = {
        signal: this.abortController.signal,
      };
      const response = await generateGuideReq(
        sessionId,
        Number(workId),
        config
      );
      if (currentRequestId !== this.requestCounter) return null;
      return response;
    } catch (error: unknown) {
      if (currentRequestId !== this.requestCounter) return null;
      const err = error as { name?: string };
      if (err.name === "CanceledError" || err.name === "AbortError") {
        return null;
      }
      throw error;
    } finally {
      if (currentRequestId === this.requestCounter) {
        store = { ...store, isFetching: false };
        emit();
        this.abortController = null;
      }
    }
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    store = { ...store, isFetching: false };
    emit();
    this.requestCounter++;
  }
}

const suggestionsControllerInstance = new SuggestionsController();

export function useSuggestionsController() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    ...suggestionsControllerInstance,
    isFetching: snapshot.isFetching,
  };
}

export { suggestionsControllerInstance };
