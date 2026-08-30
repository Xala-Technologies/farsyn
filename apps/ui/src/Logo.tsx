/**
 * The mark and the wordmark.
 *
 * Drawn rather than an emoji or a raster — four shapes, inherits the signal colour, stays
 * crisp at any density. Square crosshair rather than a globe: this is an instrument that
 * takes a reading at a coordinate, and a globe would say "international" when the product's
 * actual claim is "measured from exactly here".
 *
 * `Far` + `syn`: the distance axis this engine verifies, and the synthetic reading it takes
 * from there — the same two-weight split the wordmark has always used, now mapped onto the
 * name it actually carries.
 *
 * The same paths live in `public/favicon.svg` and `index.html`'s boot screen so the tab icon,
 * the loading state and the in-app mark cannot drift. `Wordmark` is exported on its own so
 * `Shell`'s sidebar title renders the identical two-weight name rather than a second,
 * plain-text copy of it.
 */
import type { JSX } from "react";

export function Wordmark(): JSX.Element {
  return (
    <>
      Far<b>syn</b>
    </>
  );
}

export function Logo({ size = 22, lockup = false }: { size?: number; lockup?: boolean }): JSX.Element {
  return (
    <span className={lockup ? "logo logo-lockup" : "logo"} aria-label="Farsyn">
      <Mark size={size} />
      <span className="logo-word">
        <span className="logo-name">
          <Wordmark />
        </span>
        <span className="logo-tag">evidence engine</span>
      </span>
    </span>
  );
}

export function Mark({ size = 22 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="19" height="19" stroke="var(--fg-accent)" strokeWidth="1.25" opacity="0.55" />
      <path d="M11 1.5v19M1.5 11h19" stroke="var(--fg-accent)" strokeWidth="1" opacity="0.35" />
      <rect x="7.5" y="7.5" width="7" height="7" stroke="var(--fg-accent)" strokeWidth="1.5" opacity="0.85" />
      <rect x="9.5" y="9.5" width="3" height="3" fill="var(--fg-accent)" />
    </svg>
  );
}
