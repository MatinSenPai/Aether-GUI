import { getCurrentWindow } from "@tauri-apps/api/window";
import { Maximize2, Minus, X } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { useLanguage } from "@/i18n/LanguageContext";

const appWindow = getCurrentWindow();

export function TitleBar() {
  const { t } = useLanguage();

  return (
    // data-tauri-drag-region only fires when the mousedown target IS this
    // element, so the buttons stay clickable without any extra handling.
    <header
      data-tauri-drag-region
      className="relative z-10 flex h-9 shrink-0 select-none items-center justify-between"
    >
      <div className="flex items-center gap-0.5 px-1.5">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>

      {/* Window controls stay on the physical right regardless of RTL — an
        * OS-chrome convention users expect consistently, unlike the rest of
        * the layout which is free to mirror with the language. `dir="ltr"`
        * fixes this group's own internal button order; `rtl:order-first`
        * is what actually keeps the *group* pinned to the right in RTL —
        * flex's main-axis "start" is the right edge in a rtl container, so
        * order:-9999 there re-anchors it to the same physical side it's on
        * in LTR, instead of drifting to the left with everything else. */}
      <div dir="ltr" className="flex h-full rtl:order-first">
        <button
          aria-label={t.titleBar.minimize}
          className="grid h-full w-13 place-items-center text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          onClick={() => void appWindow.minimize()}
        >
          <Minus className="size-4" />
        </button>
        <button
          aria-label={t.titleBar.maximize}
          className="grid h-full w-13 place-items-center text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          onClick={() => void appWindow.toggleMaximize()}
        >
          <Maximize2 className="size-3.5" />
        </button>
        <button
          aria-label={t.titleBar.close}
          className="grid h-full w-13 place-items-center text-muted-foreground hover:bg-destructive hover:text-white"
          onClick={() => void appWindow.close()}
        >
          <X className="size-4" />
        </button>
      </div>
    </header>
  );
}
