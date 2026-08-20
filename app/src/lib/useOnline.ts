import { useSyncExternalStore } from "react";

function subscribe(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** Browser-reported connectivity at render time (navigator.onLine). */
function getSnapshot(): boolean {
  return navigator.onLine;
}

/** SSR/initial-render snapshot: assume online until the client hydrates. */
function getServerSnapshot(): boolean {
  return true;
}

/**
 * Live connectivity flag backed by `navigator.onLine` + the browser's
 * `online`/`offline` events (useSyncExternalStore — no polling, no re-render
 * storms). `true` means the device has a network path; the backend may still
 * be unreachable (see app.healthError for that).
 */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
