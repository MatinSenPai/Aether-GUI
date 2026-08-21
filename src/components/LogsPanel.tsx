import { useEffect, useRef, useState } from "react"
import { copyText } from "@/lib/clipboard"
import { cn } from "@/lib/utils"
import { useConnectionStore } from "@/state/connectionStore"

/** Only a leading token counts as the level — matching mid-sentence would
 * relabel a line that merely mentions an error. */
const LEVEL_RE =
  /^\s*\[?(TRACE|DEBUG|INFO|NOTICE|WARN(?:ING)?|ERROR|ERR|FATAL)]?[:\s-]*/i

const SHORT: Record<string, string> = {
  TRACE: "trc",
  DEBUG: "dbg",
  INFO: "info",
  NOTICE: "note",
  WARN: "warn",
  WARNING: "warn",
  ERROR: "err",
  ERR: "err",
  FATAL: "err",
}

/** Aether's pty stream is plain text, so the level is whatever token the line
 * happens to open with. Anything unrecognised keeps its whole line as the
 * message and renders with a blank level column rather than being guessed at.
 * Levels that matter (warn and above) take the brighter neutral — the design
 * reserves the accent for a live tunnel, never for severity. */
function parseLine(line: string): {
  level: string
  message: string
  className: string
} {
  const m = LEVEL_RE.exec(line)
  if (!m) return { level: "", message: line, className: "" }
  const raw = m[1].toUpperCase()
  const loud =
    raw.startsWith("WARN") || raw.startsWith("ERR") || raw === "FATAL"
  return {
    level: SHORT[raw] ?? raw.toLowerCase(),
    message: line.slice(m[0].length),
    className: loud ? "text-[var(--neutral-400)]" : "text-[var(--neutral-700)]",
  }
}

function clock(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** The raw stream, unedited. It is the one place in the app that does not
 * summarise anything — when the explained states are not enough, this is
 * what the user (or a bug report) needs verbatim. */
export function LogsPanel() {
  const logs = useConnectionStore((s) => s.logs)
  const status = useConnectionStore((s) => s.status)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (autoScroll && viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const copyAll = async () => {
    if (!(await copyText(logs.map((l) => l.line).join("\n")))) return
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  // Error and Idle both mean the pty is gone; only a live session is a
  // stream, and saying otherwise next to a stalled view reads as a hang.
  const streaming = status.state !== "Idle" && status.state !== "Error"

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={viewportRef}
        onScroll={(e) => {
          const el = e.currentTarget
          setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 24)
        }}
        className="scroll-slim flex flex-1 flex-col gap-[5px] overflow-y-auto px-[18px] py-3.5 font-mono text-[11.5px] leading-normal"
      >
        {logs.length === 0 ? (
          <p className="text-faint">No output yet.</p>
        ) : (
          logs.map((l, i) => {
            const { level, message, className } = parseLine(l.line)
            return (
              <div key={i} className="flex gap-2.5">
                <span className="shrink-0 text-[var(--neutral-700)]">
                  {clock(l.timestamp)}
                </span>
                <span className={cn("w-8 shrink-0", className)}>{level}</span>
                <span className="break-all text-[var(--neutral-400)]">
                  {message}
                </span>
              </div>
            )
          })
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-border px-[18px] py-2.5">
        <span className="text-[11px] text-faint">
          {streaming ? "Streaming from the aether pty" : "Stream idle"}
        </span>
        <button
          type="button"
          onClick={() => void copyAll()}
          disabled={logs.length === 0}
          className="ml-auto rounded-md border border-border px-2.5 py-1 text-[11.5px] transition-colors hover:bg-white/6 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
        >
          {copied ? "Copied" : "Copy all"}
        </button>
      </div>
    </div>
  )
}
