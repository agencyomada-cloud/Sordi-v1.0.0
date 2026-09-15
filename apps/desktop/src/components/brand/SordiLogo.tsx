/**
 * Both variants are built from exact vector data — no redrawing, no raster.
 *
 * `iconOnly`: the exact icon geometry from the user's own "sordi icon.svg"
 * (paths extracted verbatim — see src-tauri/app-icon-source.svg, the same
 * source used to regenerate the compiled OS app icon via `tauri icon`).
 *
 * Full wordmark: the same exact icon paths (scaled via a nested <svg>'s
 * own viewBox, which resizes without altering the shape at all — not a
 * redraw) combined with the "sordi" logotype's own letterform paths
 * (unchanged from the prior wordmark asset — same typeface, just recolored
 * over the years, so reusing them isn't a reinterpretation of anything
 * new) in `currentColor`.
 *
 * This replaces an earlier version that used the user's raster wordmark
 * file (`public/brand/sordi-wordmark.webp`) directly — that had "sordi"
 * baked in at a fixed dark color, which was illegible against the dark
 * sidebar in dark mode. Rebuilding as vector with `currentColor` text
 * fixes that while still using only real, verified geometry throughout.
 */
function IconPetals({ fill }: { fill: string }) {
  return (
    <g fill={fill}>
      <path d="M2.66,1.42c.09.44.52.87.96.96.44.09.73-.2.64-.64-.09-.44-.52-.87-.96-.96-.44-.09-.73.2-.64.64Z" />
      <path d="M4.8,1.71c-.33.31-.49.92-.36,1.35.13.43.5.53.83.22.33-.31.49-.92.36-1.35-.13-.43-.5-.53-.83-.22Z" />
      <path d="M5.62,3.73c-.44-.11-1.07.05-1.39.37s-.23.67.21.78,1.07-.05,1.39-.37.23-.67-.21-.78Z" />
      <path d="M4.26,5.47c-.14-.44-.61-.91-1.05-1.05-.44-.14-.68.1-.54.54.14.44.61.91,1.05,1.05.44.14.68-.1.54-.54Z" />
      <path d="M2.03,5.14c.3-.36.48-1.02.4-1.48-.08-.46-.39-.54-.7-.19-.3.36-.48,1.02-.4,1.48.08.46.39.54.7.19Z" />
      <path d="M1.21,3.02c.47.07,1.15-.12,1.52-.41.37-.29.29-.59-.18-.65-.47-.07-1.15.12-1.52.41-.37.29-.29.59.18.65Z" />
    </g>
  );
}

export function SordiLogo({
  className,
  iconOnly = false,
  bare = false,
}: {
  className?: string;
  iconOnly?: boolean;
  bare?: boolean;
}) {
  if (bare) {
    return (
      <svg viewBox="0 0 6.83 6.83" className={className} role="img" aria-label="Sordi" fill="currentColor">
        <IconPetals fill="currentColor" />
      </svg>
    );
  }

  if (iconOnly) {
    return (
      <svg viewBox="0 0 6.83 6.83" className={className} role="img" aria-label="Sordi">
        <rect fill="#ff2949" width="6.83" height="6.83" />
        <IconPetals fill="#fff" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 89.33 24.81" className={className} role="img" aria-label="Sordi">
      <svg x="0" y=".23" width="24.59" height="24.59" viewBox="0 0 6.83 6.83">
        <IconPetals fill="#ff2949" />
      </svg>
      <g fill="currentColor">
        <path d="M79.7,7.23c-1.18-1.91-2.7-2.28-4.65-2.25-4.3.07-7.11,3.6-6.7,7.86.16,1.69.8,3.31,2.01,4.51,1.74,1.71,4.83,2.41,7.05,1.47,1.02-.43,1.87-1.11,2.43-2.16v2.3h2.3s.8-.01.8-.01V.32h-3.22s-.03,6.91-.03,6.91h0s0,0,0,0h0ZM76.77,16.26c-2.68.59-4.96-1.09-5.17-3.7-.11-1.28.17-2.51,1.03-3.45,1.03-1.13,2.52-1.5,4.01-1.21,1.24.24,2.17,1.03,2.71,2.15,1.05,2.2.29,5.57-2.58,6.21h0s0,0,0,0Z" />
        <path d="M54.15,6.27c-2.46-1.63-5.88-1.71-8.51-.29-3.93,2.13-4.63,7.48-1.85,10.71,2.08,2.42,5.61,3.05,8.55,2.11,2.78-.89,4.69-3.34,4.82-6.25.12-2.5-.91-4.89-3.02-6.29h0s0,0,0,0ZM49.67,16.37c-2.36,0-4.27-1.91-4.27-4.27s1.91-4.27,4.27-4.27,4.27,1.91,4.27,4.27-1.91,4.27-4.27,4.27Z" />
        <path d="M32.14,8.98c.03-.49.31-.88.8-1.05,2.1-.7,4.86-.03,6.87,1.07l.25-2.84c-1.78-.83-3.63-1.24-5.58-1.13-2.74,0-5.94,1.38-5.58,4.65.41,3.78,5.34,3.15,8.14,4.49.33.16.58.63.59.94,0,.34-.22.71-.53.91-1.45.98-4.7.37-6.27-.38l-1.7-.81-.18,2.91c2.79,1.63,7.88,2.24,10.54.2,1.02-.79,1.46-2.07,1.39-3.33-.25-5.01-8.88-3.07-8.75-5.62h0Z" />
        <rect x="85.83" y="5.29" width="3.26" height="13.66" />
        <path d="M87.45,3.76c1.04,0,1.88-.84,1.88-1.88s-.84-1.88-1.88-1.88-1.88.84-1.88,1.88.84,1.88,1.88,1.88Z" />
        <rect x="59.1" y="5.6" width="3.25" height="13.64" />
        <path d="M62.17,8.85c0-1.8,1.46-3.25,3.25-3.25h2.37v3.25h-5.63,0,0Z" />
      </g>
    </svg>
  );
}
