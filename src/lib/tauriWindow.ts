import { getCurrentWindow, type Window } from "@tauri-apps/api/window"

/**
 * The host window, or null when the UI is running outside Tauri (plain-browser
 * dev, where `getCurrentWindow()` throws because the internals bridge is
 * absent). Resolved per call rather than once at module scope so importing a
 * component that owns a window control can't take the whole app down.
 */
export function hostWindow(): Window | null {
  try {
    return getCurrentWindow()
  } catch {
    return null
  }
}
