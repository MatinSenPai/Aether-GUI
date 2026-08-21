import { useEffect } from "react"
import { MotionConfig } from "motion/react"
import { AccessCodePrompt } from "@/components/AccessCodePrompt"
import { AmbientBackground } from "@/components/AmbientBackground"
import { ConnectDial } from "@/components/ConnectDial"
import { ConnectedPanel } from "@/components/ConnectedPanel"
import { ConnectingPanel } from "@/components/ConnectingPanel"
import { ProfileSummary } from "@/components/ProfileSummary"
import { SidePanel } from "@/components/SidePanel"
import { StatusBar } from "@/components/StatusBar"
import { TitleBar } from "@/components/TitleBar"
import { TroublePanel } from "@/components/TroublePanel"
import { isTrouble, viewOf } from "@/lib/connectionView"
import {
  initConnectionListeners,
  useConnectionStore,
} from "@/state/connectionStore"
import { APP_WIDTH } from "@/state/panelStore"

/** The idle line states the one thing the user might otherwise wonder about:
 * whether pressing Connect needs any setup first. */
function IdleNote() {
  const quickReconnect = useConnectionStore((s) => s.profile.quick_reconnect)
  return (
    <p className="mt-[22px] w-full text-center text-[12.5px] leading-relaxed text-muted-foreground">
      {quickReconnect
        ? "Reuses your last working route. Nothing to configure."
        : "Scans for a fresh route every time. Nothing to configure."}
    </p>
  )
}

function StateBlock() {
  const status = useConnectionStore((s) => s.status)
  const sidecarError = useConnectionStore((s) => s.sidecarError)
  const view = viewOf(status, sidecarError)

  if (view === "connected" && status.state === "Connected") {
    return (
      <ConnectedPanel
        socksAddr={status.socks_addr}
        since={status.connected_at_ms}
      />
    )
  }
  if (view === "launching" || view === "connecting") return <ConnectingPanel />
  if (isTrouble(view)) return <TroublePanel view={view} />
  if (view === "idle") return <IdleNote />
  // Disconnecting: the dial already says so and the tear-down is quick —
  // anything else here would flash for half a second and leave.
  return null
}

export function App() {
  const attemptId = useConnectionStore((s) => s.attemptId)

  useEffect(() => {
    const cleanup = initConnectionListeners()
    return () => {
      void cleanup.then((unlisten) => unlisten())
    }
  }, [])

  return (
    <MotionConfig reducedMotion="user">
      {/* The window IS the frame — decorations are off, so the metallic
       * ground is painted here rather than on a nested card. */}
      <div className="met-win flex h-svh w-full overflow-hidden text-foreground">
        <div
          className="relative isolate flex h-full shrink-0 flex-col"
          style={{ width: APP_WIDTH }}
        >
          <AmbientBackground />
          <TitleBar />

          <main className="scroll-slim relative z-10 flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-[26px] pt-2">
            <div className="mt-2.5">
              <ConnectDial />
            </div>
            <StateBlock />
            {/* Keyed on attemptId so a fresh connect never inherits the
             * previous attempt's half-typed code. */}
            <AccessCodePrompt key={attemptId} />
            <div className="mt-auto w-full pt-4 pb-4">
              <ProfileSummary />
            </div>
          </main>

          <StatusBar />
        </div>

        <SidePanel />
      </div>
    </MotionConfig>
  )
}

export default App
