/**
 * Global registry mapping docId → function that returns the canvas as PNG dataURL.
 * CanvasEditor registers itself here on mount, App.tsx reads from here on save.
 */
const canvasGetters = new Map<string, () => string | null>();
const canvasCache = new Map<string, string>();

export function registerCanvasGetter(docId: string, fn: () => string | null) {
  console.log(`[canvasRegistry] Registering getter for: ${docId}`);
  canvasGetters.set(docId, fn);
}

export function unregisterCanvasGetter(docId: string) {
  // Before unregistering, we try to grab one last snapshot to the cache
  const fn = canvasGetters.get(docId);
  if (fn) {
    const data = fn();
    if (data) {
      console.log(`[canvasRegistry] Caching last state for: ${docId}`);
      canvasCache.set(docId, data);
    }
  }
  console.log(`[canvasRegistry] Unregistering getter for: ${docId}`);
  canvasGetters.delete(docId);
}

export function getCanvasDataUrl(docId: string): string | null {
  const fn = canvasGetters.get(docId);
  if (fn) {
    const data = fn();
    if (data) {
      canvasCache.set(docId, data); // Keep cache fresh
      return data;
    }
  }
  
  // Fallback to cache if getter is missing or returns null
  const cached = canvasCache.get(docId);
  if (cached) {
    console.log(`[canvasRegistry] Using cached data for: ${docId}`);
    return cached;
  }

  console.warn(`[canvasRegistry] No data found for: ${docId}`);
  return null;
}
