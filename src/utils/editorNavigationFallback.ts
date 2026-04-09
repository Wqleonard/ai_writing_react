const EDITOR_NAVIGATION_RELOAD_KEY = "__editor_navigation_reload_target__";

const getErrorText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  if (value && typeof value === "object" && "message" in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
};

export const isEditorAssetLoadError = (error: unknown): boolean => {
  const text = getErrorText(error);
  if (!text) return false;

  return [
    "Unable to preload CSS",
    "Failed to fetch dynamically imported module",
    "Importing a module script failed",
    "ChunkLoadError",
    "Loading chunk",
    "error loading dynamically imported module",
  ].some(fragment => text.includes(fragment));
};

export const getCurrentEditorReloadTarget = (): string | null => {
  try {
    return sessionStorage.getItem(EDITOR_NAVIGATION_RELOAD_KEY);
  } catch {
    return null;
  }
};

export const clearEditorReloadTarget = (): void => {
  try {
    sessionStorage.removeItem(EDITOR_NAVIGATION_RELOAD_KEY);
  } catch {
    // Ignore storage failures in private mode or restricted contexts.
  }
};

export const hardNavigateToEditorOnce = ({
  targetPath,
  reason,
  error,
}: {
  targetPath: string;
  reason: string;
  error?: unknown;
}): boolean => {
  if (typeof window === "undefined") return false;

  const normalizedTarget = targetPath || window.location.pathname;
  const previousTarget = getCurrentEditorReloadTarget();

  if (previousTarget === normalizedTarget) {
    return false;
  }

  try {
    sessionStorage.setItem(EDITOR_NAVIGATION_RELOAD_KEY, normalizedTarget);
  } catch {
    // Best-effort only.
  }

  window.location.assign(normalizedTarget);
  return true;
};
