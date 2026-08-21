import { TriangleAlert } from "lucide-react"
import type { ConnectionView } from "@/lib/connectionView"
import { usesMasque } from "@/lib/profileLabels"
import { useConnectionStore } from "@/state/connectionStore"
import { usePanelStore } from "@/state/panelStore"

interface Copy {
  title: string
  body: string
  /** Exact strings the user has to act on — paths, not prose. Each gets its
   * own mono line so it can be read character by character. */
  details?: string[]
  primary: string
  onPrimary: () => void
}

/** The backend formats the missing-binary error as a "Looked in:" sentence
 * followed by one searched path per line (see aether/mod.rs::resolve_binary).
 * The sentence is already said better by the card's own copy, so only the
 * paths are kept. */
function missingBinaryPaths(message: string | null): string[] | undefined {
  if (!message) return undefined
  const lines = message
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/looked in:?$/i.test(l))
  return lines.length ? lines : undefined
}

/**
 * The three states that need explaining rather than announcing. Each one
 * carries its reason as visible copy and a primary action that is the next
 * thing actually worth trying — not a bare "Retry" that repeats whatever
 * just failed.
 */
export function TroublePanel({ view }: { view: ConnectionView }) {
  const status = useConnectionStore((s) => s.status)
  const sidecarError = useConnectionStore((s) => s.sidecarError)
  const profile = useConnectionStore((s) => s.profile)
  const connect = useConnectionStore((s) => s.connect)
  const disconnect = useConnectionStore((s) => s.disconnect)
  const setMasqueHttp2 = useConnectionStore((s) => s.setMasqueHttp2)
  const retryAfterSidecarError = useConnectionStore(
    (s) => s.retryAfterSidecarError
  )
  const openLogs = usePanelStore((s) => s.open)

  // A route scan that exhausted its candidates on MASQUE over HTTP/3 has one
  // obvious next move: networks that throttle UDP usually still pass HTTP/2.
  // Offering that as the primary action beats a Retry that repeats the run.
  const canFallBackToHttp2 =
    view === "error" && usesMasque(profile.protocol) && !profile.masque_http2

  let copy: Copy
  if (view === "setup") {
    copy = {
      title: "The Aether engine is missing",
      body: "Aether-GUI drives the real aether executable and does not ship it. Put a copy in any of these locations, then try again:",
      details: missingBinaryPaths(sidecarError),
      primary: "Try again",
      onPrimary: () => {
        retryAfterSidecarError()
        void connect()
      },
    }
  } else if (view === "reconnecting") {
    const attempt =
      status.state === "Reconnecting"
        ? `Attempt ${status.attempt} of ${status.max_attempts}.`
        : ""
    copy = {
      title: "The tunnel dropped",
      body: `Retrying with backoff. ${attempt} Your traffic is not leaving the machine while this is happening.`,
      primary: "Stop retrying",
      onPrimary: () => void disconnect(),
    }
  } else {
    copy = {
      title: canFallBackToHttp2
        ? "No working route found"
        : "Connection failed",
      body:
        status.state === "Error"
          ? status.message
          : "Aether stopped before a tunnel was established.",
      primary: canFallBackToHttp2 ? "Retry over HTTP/2" : "Try again",
      onPrimary: () => {
        if (canFallBackToHttp2) setMasqueHttp2(true)
        void connect()
      },
    }
  }

  return (
    <div
      aria-live="polite"
      className="anim-rise mt-5 flex w-full flex-col gap-3"
    >
      <div className="flex gap-2.5 rounded-md bg-surface-2 px-3 py-3 ring-1 ring-border">
        <TriangleAlert
          size={15}
          strokeWidth={1.4}
          className="mt-px shrink-0 text-[var(--neutral-400)]"
        />
        <div className="min-w-0">
          <div className="font-heading text-sm font-medium">{copy.title}</div>
          <p className="mt-[3px] text-[12.5px] leading-normal break-words text-muted-foreground">
            {copy.body}
          </p>
          {copy.details && (
            <ul className="mt-2 flex flex-col gap-1 rounded-sm bg-black/30 px-2 py-1.5">
              {copy.details.map((d) => (
                <li
                  key={d}
                  className="font-mono text-[11px] leading-snug break-all text-foreground/80"
                >
                  {d}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={copy.onPrimary}
          className="flex min-h-[38px] flex-1 items-center justify-center rounded-md border border-primary px-4 font-heading text-sm font-medium text-primary transition-colors hover:bg-primary/12 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          {copy.primary}
        </button>
        <button
          type="button"
          onClick={() => openLogs("logs")}
          className="flex min-h-[38px] items-center justify-center rounded-md border border-border px-4 font-heading text-sm font-medium transition-colors hover:bg-white/6 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          Logs
        </button>
      </div>
    </div>
  )
}
