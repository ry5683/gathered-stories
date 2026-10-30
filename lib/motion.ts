// WHAT: Creates a typed inline CSS custom property for animation indices.
// WHY: React style objects do not otherwise accept custom property names.
import type { CSSProperties } from "react";

export function cssVar(name: `--${string}`, value: number): CSSProperties {
  return { [name]: value } as CSSProperties;
}
