import { useMemo, useState, type FormEvent } from "react"
import { invoke } from "@tauri-apps/api/core"
import { useConnectionStore } from "@/state/connectionStore"

/** Bridges Aether 1.5.0's terminal-only Zero Trust email-code prompt into the
 * GUI. A new prompt signal is emitted after each rejected code, allowing the
 * user to retry without relaunching the tunnel. */
export function AccessCodePrompt() {
  const logs = useConnectionStore((s) => s.logs)
  const [code, setCode] = useState("")
  const [submittedFor, setSubmittedFor] = useState(0)
  const [sending, setSending] = useState(false)
  const promptCount = useMemo(
    () =>
      logs.filter((log) => log.line === "[gui] Zero Trust access code required")
        .length,
    [logs]
  )
  const waiting = promptCount > submittedFor

  if (!waiting) return null

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!code.trim() || sending) return
    setSending(true)
    try {
      await invoke("submit_access_code", { code })
      setCode("")
      setSubmittedFor(promptCount)
    } finally {
      setSending(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="anim-rise mt-3 flex w-full flex-col gap-2 rounded-md border border-primary/45 px-3 py-3"
    >
      <label
        htmlFor="zt-code"
        className="text-[9px] tracking-[0.12em] text-faint uppercase"
      >
        Zero Trust — code sent to your email
      </label>
      <div className="flex items-center gap-2">
        <input
          id="zt-code"
          autoFocus
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="000000"
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-black/25 px-2.5 text-center font-mono text-xs tracking-[0.3em] text-foreground caret-primary outline-none placeholder:tracking-[0.3em] placeholder:text-faint focus:border-primary"
          aria-label="Zero Trust email code"
        />
        <button
          type="submit"
          disabled={!code.trim() || sending}
          className="rounded-md border border-primary px-3 py-1.5 font-heading text-xs font-medium text-primary transition-colors hover:bg-primary/12 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
        >
          {sending ? "Sending…" : "Verify"}
        </button>
      </div>
    </form>
  )
}
