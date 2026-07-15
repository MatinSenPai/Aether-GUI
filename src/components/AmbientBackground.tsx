/**
 * Pure CSS animated gradient orbs — no JavaScript animation driver.
 * Only transform and opacity are animated (compositor-only, no layout/paint
 * triggers).
 *
 * Under prefers-reduced-motion the animation is fully frozen via the
 * @media query in index.css.
 */
export function AmbientBackground() {
  return (
    <div className="orb-container pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="orb orb-a" />
      <div className="orb orb-b" />
    </div>
  );
}
