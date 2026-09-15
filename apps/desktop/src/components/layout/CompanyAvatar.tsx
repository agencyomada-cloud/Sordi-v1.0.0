import { useMemo } from "react";
import { createAvatar } from "@dicebear/core";
import { shapes } from "@dicebear/collection";

interface CompanyAvatarProps {
  seed: string;
  size: number;
  className?: string;
}

/** Renders a DiceBear "shapes" avatar (abstract geometric marks, no faces
 *  — "glyphs" was requested but doesn't exist in the installed
 *  @dicebear/collection@9.4.3, the version that actually matches
 *  @dicebear/core's own 9.x line; "shapes" was picked as the closest
 *  face-free alternative) as a plain <img>, memoized per seed+size so
 *  switching companies or opening/closing the generator dialog doesn't
 *  regenerate the SVG on every unrelated re-render. */
export function CompanyAvatar({ seed, size, className }: CompanyAvatarProps) {
  const dataUri = useMemo(() => createAvatar(shapes, { seed, size }).toDataUri(), [seed, size]);
  return <img src={dataUri} alt="" width={size} height={size} className={className} />;
}
