import { DropdownMenu } from "radix-ui";
import { Check, Palette } from "lucide-react";
import { useTheme, THEMES } from "@/theme/ThemeContext";
import { useLanguage } from "@/i18n/LanguageContext";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={t.titleBar.theme}
          className="grid size-7 place-items-center rounded-md text-muted-foreground outline-none hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Palette size={14} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 min-w-40 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          {THEMES.map(({ id, swatch }) => (
            <DropdownMenu.Item
              key={id}
              onSelect={() => setTheme(id)}
              className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none select-none focus:bg-accent focus:text-accent-foreground"
            >
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-full ring-1 ring-white/20"
                style={{ backgroundColor: swatch }}
              />
              <span className="flex-1">{t.theme[id]}</span>
              {theme === id && <Check size={13} className="shrink-0" />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
