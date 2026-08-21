import { Minus, X } from "lucide-react"
import { hostWindow } from "@/lib/tauriWindow"

/** The mark is the connect dial in miniature — a hairline accent ring around
 * a solid accent core. Drawn in CSS rather than shipped as an icon so it
 * tracks the accent token if the palette is ever retuned. */
function BrandMark() {
  return (
    <span
      aria-hidden
      className="grid size-4 shrink-0 place-items-center rounded-[5px] border border-primary"
    >
      <span className="size-[5px] rounded-full bg-primary" />
    </span>
  )
}

/**
 * Maximize is deliberately absent: the window is fixed at the design's 420px
 * (890px with the side panel open) and non-resizable, so a maximize control
 * would either do nothing or break the layout it claims to fill.
 */
export function TitleBar() {
  return (
    // data-tauri-drag-region only fires when the mousedown target IS this
    // element, so the buttons stay clickable without any extra handling.
    <header
      data-tauri-drag-region
      className="relative z-10 flex h-11 shrink-0 items-center gap-2.5 pr-3 pl-4 select-none"
    >
      <BrandMark />
      <span
        data-tauri-drag-region
        className="font-heading text-[13px] font-medium tracking-[0.02em]"
      >
        Aether
      </span>
      <span data-tauri-drag-region className="font-mono text-[10px] text-faint">
        {__APP_VERSION__}
      </span>
      <div className="ml-auto flex items-center gap-0.5">
        <button
          aria-label="Minimize"
          className="grid size-[26px] place-items-center rounded-md text-faint transition-colors hover:bg-white/6 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          onClick={() => void hostWindow()?.minimize()}
        >
          <Minus className="size-3" strokeWidth={1.6} />
        </button>
        <button
          aria-label="Close"
          className="grid size-[26px] place-items-center rounded-md text-faint transition-colors hover:bg-white/6 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          onClick={() => void hostWindow()?.close()}
        >
          <X className="size-3" strokeWidth={1.6} />
        </button>
      </div>
    </header>
  )
}
