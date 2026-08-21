import type { ConnectionStatus } from "@/types/connection"

/**
 * The seven screens the design draws, keyed off the backend's state machine
 * plus one purely front-end case: `setup`, when the Aether binary itself
 * can't be found. That failure used to take over the whole window; the
 * redesign folds it back into the normal dial + explanation layout, because
 * structurally it is just another thing the user has to fix before a tunnel
 * can exist.
 */
export type ConnectionView =
  | "idle"
  | "launching"
  | "connecting"
  | "reconnecting"
  | "connected"
  | "disconnecting"
  | "error"
  | "setup"

export function viewOf(
  status: ConnectionStatus,
  sidecarError: string | null
): ConnectionView {
  if (sidecarError) return "setup"
  switch (status.state) {
    case "Launching":
      return "launching"
    case "Connecting":
      return "connecting"
    case "Reconnecting":
      return "reconnecting"
    case "Connected":
      return "connected"
    case "Disconnecting":
      return "disconnecting"
    case "Error":
      return "error"
    default:
      return "idle"
  }
}

/** The three views that carry an explanation card and a pair of actions. */
export function isTrouble(view: ConnectionView): boolean {
  return view === "error" || view === "setup" || view === "reconnecting"
}

/** Profile controls are locked whenever a session exists — Aether can't
 * switch protocol, scan mode or transport mid-run. */
export function isLocked(status: ConnectionStatus): boolean {
  return status.state !== "Idle" && status.state !== "Error"
}
