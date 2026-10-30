// WHAT: Names the supported theme preferences and their browser storage key.
// WHY: The initial theme script and toggle need to agree on a single persisted value.
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "wedding-story-theme";
// WHAT: Shares the temporary theme-transition class and duration with the CSS.
// WHY: A single duration keeps the crossfade cleanup in sync with its styles.
export const THEME_TRANSITION_CLASS = "theme-transitioning";
export const THEME_TRANSITION_MS = 400;
