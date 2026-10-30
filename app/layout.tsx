// WHAT: Provides shared page metadata, theme initialization, and global styles.
// WHY: The early theme script avoids a light/dark flash and reads the saved choice before
// the app renders; the system preference is used only when no choice exists yet.
import type { Metadata } from "next";
import "./globals.css";
import { THEME_STORAGE_KEY } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Gathered Stories — Wedding story studio",
  description: "Turn wedding details and photo notes into a thoughtful, editable venue story.",
};

const themeScript = `
(() => {
  let saved = null;
  try {
    saved = localStorage.getItem("${THEME_STORAGE_KEY}");
  } catch {
    // A blocked storage API should not prevent device-preference detection.
  }
  const theme = saved === "light" || saved === "dark"
    ? saved
    : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = theme;
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
