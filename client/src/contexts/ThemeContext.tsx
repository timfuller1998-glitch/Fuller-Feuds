import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { Theme } from "@shared/schema";
import { formatHSL, parseHSL } from "@shared/colorUtils";

interface ThemeContextValue {
  currentTheme: Theme | null;
  applyTheme: (theme: Theme | null) => void;
  isDefaultTheme: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<Theme | null>(null);

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedThemeId = localStorage.getItem("appliedThemeId");
    if (savedThemeId) {
      // Fetch the saved theme from API
      fetch(`/api/themes/${savedThemeId}`)
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error("Theme not found");
        })
        .then((theme) => {
          applyThemeToDOM(theme);
          setCurrentTheme(theme);
        })
        .catch(() => {
          // If theme not found, clear from storage
          localStorage.removeItem("appliedThemeId");
        });
    }
  }, []);

  const applyTheme = (theme: Theme | null) => {
    if (theme) {
      applyThemeToDOM(theme);
      localStorage.setItem("appliedThemeId", theme.id);
      setCurrentTheme(theme);
    } else {
      clearThemeFromDOM();
      localStorage.removeItem("appliedThemeId");
      setCurrentTheme(null);
    }
  };

  const isDefaultTheme = currentTheme === null;

  return (
    <ThemeContext.Provider value={{ currentTheme, applyTheme, isDefaultTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

/**
 * Apply a theme's colors to the DOM by injecting CSS custom properties
 */
function applyThemeToDOM(theme: Theme) {
  const root = document.documentElement;
  const colors = theme.colors as Record<string, any>;
  
  // Apply base theme class first
  root.classList.remove("light", "medium", "dark");
  if (theme.baseTheme !== "light") {
    root.classList.add(theme.baseTheme);
  }
  
  // Create or update the custom theme style element
  let styleElement = document.getElementById("custom-theme-style");
  if (!styleElement) {
    styleElement = document.createElement("style");
    styleElement.id = "custom-theme-style";
    document.head.appendChild(styleElement);
  }
  
  // Build CSS custom properties from theme colors
  const cssVariables: string[] = [];
  
  for (const [key, value] of Object.entries(colors)) {
    if (value && typeof value === "object" && "h" in value && "s" in value && "l" in value) {
      const hslString = formatHSL(value);
      cssVariables.push(`  --${kebabCase(key)}: ${hslString};`);
    }
  }
  
  // Apply to root
  styleElement.textContent = `:root {
${cssVariables.join("\n")}
}`;
}

/**
 * Clear custom theme and restore default theme
 */
function clearThemeFromDOM() {
  const styleElement = document.getElementById("custom-theme-style");
  if (styleElement) {
    styleElement.remove();
  }
  
  // Restore default theme from localStorage
  const savedTheme = (localStorage.getItem("theme") as "light" | "medium" | "dark") || "light";
  const root = document.documentElement;
  root.classList.remove("light", "medium", "dark");
  if (savedTheme !== "light") {
    root.classList.add(savedTheme);
  }
}

/**
 * Convert camelCase to kebab-case
 */
function kebabCase(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}
