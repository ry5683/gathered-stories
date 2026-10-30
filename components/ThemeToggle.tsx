// WHAT: Lets the user switch between the two explicit color themes.
// WHY: A saved choice wins on every visit; system preference is consulted only on first visit.
"use client";

import { useEffect, useRef, useState } from "react";
import { syncThemeIcon, THEME_STORAGE_KEY, THEME_TRANSITION_CLASS, THEME_TRANSITION_MS, type Theme } from "@/lib/theme";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [message, setMessage] = useState("");
  const userChangedTheme = useRef(false);
  const transitionTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
    document.documentElement.classList.remove(THEME_TRANSITION_CLASS);
  }, []);

  useEffect(() => {
    let active = true;
    const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setTheme(currentTheme);
    syncThemeIcon(currentTheme);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return () => { active = false; };
    supabase.auth.getUser().then(async ({ data, error }) => {
      if (error || !data.user || !active) return;
      try {
        const response = await fetch("/api/preferences/theme");
        if (!response.ok) throw new Error("preference_read_failed");
        const result: { theme?: Theme } = await response.json();
        if (active && !userChangedTheme.current && (result.theme === "light" || result.theme === "dark")) {
          document.documentElement.dataset.theme = result.theme;
          window.localStorage.setItem(THEME_STORAGE_KEY, result.theme);
          syncThemeIcon(result.theme);
          setTheme(result.theme);
        }
      } catch {
        if (active) setMessage("Using the saved theme on this device.");
      }
    });
    return () => { active = false; };
  }, []);

  function toggleTheme() {
    userChangedTheme.current = true;
    const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const next: Theme = current === "dark" ? "light" : "dark";
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
    document.documentElement.classList.add(THEME_TRANSITION_CLASS);
    document.documentElement.dataset.theme = next;
    syncThemeIcon(next);
    transitionTimer.current = window.setTimeout(() => {
      document.documentElement.classList.remove(THEME_TRANSITION_CLASS);
      transitionTimer.current = null;
    }, THEME_TRANSITION_MS);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    setTheme(next);
    setMessage("");
    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      supabase.auth.getUser().then(async ({ data, error }) => {
        if (error || !data.user) return;
        try {
          const response = await fetch("/api/preferences/theme", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ theme: next }),
          });
          if (!response.ok) throw new Error("preference_save_failed");
        } catch {
          setMessage("Theme saved on this device; account sync failed.");
        }
      });
    }
  }

  return (
    <>
      <button className="button button-secondary theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
        <span className="theme-icon" key={theme} aria-hidden="true">{theme === "dark" ? "☼" : "☾"}</span>
        {theme === "dark" ? "Light" : "Dark"}
      </button>
      {message && <span className="theme-status" role="status">{message}</span>}
    </>
  );
}
