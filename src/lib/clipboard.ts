/**
 * Copy text to the clipboard from inside the WebView.
 *
 * navigator.clipboard is only defined in a secure context. Tauri serves the
 * app from a scheme the platform webviews do treat as secure, but that is a
 * per-platform promise rather than a guarantee, so a hidden-textarea fallback
 * keeps the copy button from being a dead control if it ever isn't.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the legacy path.
  }

  try {
    const el = document.createElement("textarea")
    el.value = text
    el.setAttribute("readonly", "")
    el.style.position = "fixed"
    el.style.opacity = "0"
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}
