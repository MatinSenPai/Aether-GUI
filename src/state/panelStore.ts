import { create } from "zustand"
import { LogicalSize } from "@tauri-apps/api/window"
import { hostWindow } from "@/lib/tauriWindow"

export type PanelTab = "settings" | "logs"

/** The window is undecorated and non-resizable, so these logical sizes are
 * exactly the design's measurements: a 420px app column, and a 470px side
 * panel that the window grows sideways to reveal. Nothing reflows inside the
 * app column when the panel opens — it keeps its width and the window gets
 * wider, which is what makes the panel read as a drawer rather than a modal. */
export const APP_WIDTH = 420
export const PANEL_WIDTH = 470
export const WINDOW_HEIGHT = 640

interface PanelState {
  panel: PanelTab | null
  open: (tab: PanelTab) => void
  close: () => void
  /** Clicking the same tab that's already showing closes the drawer. */
  toggle: (tab: PanelTab) => void
}

export const usePanelStore = create<PanelState>((set, get) => ({
  panel: null,
  open: (tab) => set({ panel: tab }),
  close: () => set({ panel: null }),
  toggle: (tab) => set({ panel: get().panel === tab ? null : tab }),
}))

/** Resizing is a side effect on the host window, not React state, so it runs
 * from a store subscription rather than an effect in a component — that way
 * the width can't desync if the panel is opened from two different places
 * (the footer buttons, the profile row) in the same tick. */
let lastWidth = APP_WIDTH

async function applyWidth(width: number) {
  if (width === lastWidth) return
  lastWidth = width
  const win = hostWindow()
  if (!win) return
  try {
    // The window ships non-resizable, and GTK enforces that by pinning the
    // WM's min and max geometry hints together — a plain resize request on a
    // non-resizable window is simply dropped there, which would leave the
    // drawer rendered but clipped off the edge of the window on Linux.
    // Re-enabling resize for the duration of the call is the portable way to
    // do this; Windows and macOS accept the resize either way and the window
    // is never non-resizable at a moment the user could grab an edge.
    await win.setResizable(true)
    await win.setSize(new LogicalSize(width, WINDOW_HEIGHT))
  } catch {
    // Not inside Tauri (plain-browser dev), or the window is gone. The
    // layout still works — it just isn't clipped to the window.
  } finally {
    try {
      await win.setResizable(false)
    } catch {
      // Same as above; nothing to recover.
    }
  }
}

usePanelStore.subscribe((state) => {
  void applyWidth(state.panel ? APP_WIDTH + PANEL_WIDTH : APP_WIDTH)
})
