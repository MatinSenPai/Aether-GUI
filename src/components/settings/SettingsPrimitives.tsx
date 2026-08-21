import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Section heading — an accent micro-caps kicker, optionally with a hint
 * pinned to the right that names the axis the control moves along. */
export function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-baseline">
        <h2 className="text-[10px] tracking-[0.12em] text-primary uppercase">
          {title}
        </h2>
        {hint && (
          <span className="ml-auto text-[10.5px] text-faint">{hint}</span>
        )}
      </div>
      {children}
    </section>
  )
}

/** Every option carries its trade-off as visible copy, not a hover tooltip —
 * the note under each control is where that copy lives. */
export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 text-xs leading-normal text-muted-foreground">
      {children}
    </p>
  )
}

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

/**
 * Segmented control.
 *
 * The separator between options is an inset line on the option itself rather
 * than a gap letting the container's ground show through — a gap leaves dark
 * specks at the rounded corners. It is drawn only where neither this option
 * nor the one before it is selected, so the selected option's accent ring
 * stays a clean unbroken outline.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  label,
}: {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
  label: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "flex rounded-md border border-border",
        disabled && "opacity-45"
      )}
    >
      {options.map((opt, i) => {
        const on = opt.value === value
        const prevOn = i > 0 && options[i - 1].value === value
        const layers: string[] = []
        if (on) layers.push("inset 0 0 0 1px var(--color-primary)")
        if (i > 0 && !on && !prevOn)
          layers.push("inset 1px 0 0 var(--color-border)")
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 truncate px-1 py-[9px] font-heading text-[11.5px] transition-[box-shadow,background-color,color] duration-150 focus-visible:relative focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
              on ? "text-primary" : "text-[var(--neutral-500)]",
              !disabled && !on && "hover:bg-white/5",
              disabled && "cursor-not-allowed",
              i === 0 && "rounded-l-[7px]",
              i === options.length - 1 && "rounded-r-[7px]"
            )}
            style={{ boxShadow: layers.length ? layers.join(",") : undefined }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

/** A choice that needs a sentence of explanation, so it gets a whole row
 * instead of a segment: a dot, a name, and the trade-off underneath. */
export function RadioCard({
  selected,
  disabled = false,
  name,
  description,
  onSelect,
}: {
  selected: boolean
  disabled?: boolean
  name: string
  description: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex gap-2.5 rounded-md border border-border px-3 py-2.5 text-left transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
        disabled ? "cursor-not-allowed opacity-45" : "hover:border-primary/45"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 size-3.5 shrink-0 rounded-full border-[1.5px]",
          selected ? "border-primary bg-primary" : "border-border"
        )}
        style={
          selected
            ? { boxShadow: "inset 0 0 0 3px var(--surface-1)" }
            : undefined
        }
      />
      <span className="min-w-0">
        <span className="block font-heading text-[13.5px] font-medium">
          {name}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
          {description}
        </span>
      </span>
    </button>
  )
}

/** Compact single-axis escalation control — four steps of the same knob,
 * where the labels are short enough that a sentence underneath is a better
 * explanation than four sentences inline. */
export function Chip({
  selected,
  disabled = false,
  label,
  onSelect,
}: {
  selected: boolean
  disabled?: boolean
  label: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "h-[26px] flex-1 rounded-sm border font-heading text-[11px] transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
        selected
          ? "border-primary bg-primary/14 text-primary"
          : "border-border text-[var(--neutral-500)]",
        disabled
          ? "cursor-not-allowed opacity-45"
          : !selected && "hover:bg-white/5"
      )}
    >
      {label}
    </button>
  )
}

/** A boolean with a reason. The control sits to the right of the sentence
 * that justifies it, so nothing needs a tooltip. */
export function ToggleRow({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border px-3 py-3">
      <div className="min-w-0">
        <div className="font-heading text-[13.5px] font-medium">{title}</div>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="ml-auto shrink-0">{children}</div>
    </div>
  )
}

/** Shared text-input skin for the panel's free-text fields. */
export const PANEL_INPUT =
  "h-8 w-full rounded-md border border-border bg-black/25 px-2.5 text-xs text-foreground caret-primary outline-none transition-colors placeholder:text-faint hover:border-white/25 focus:border-primary disabled:cursor-not-allowed disabled:opacity-45"

export const PANEL_TEXTAREA =
  "min-h-16 w-full resize-y rounded-md border border-border bg-black/25 px-2.5 py-1.5 text-xs leading-relaxed text-foreground caret-primary outline-none transition-colors placeholder:text-faint hover:border-white/25 focus:border-primary disabled:cursor-not-allowed disabled:opacity-45"
