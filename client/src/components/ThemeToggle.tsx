import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Cloudy } from "lucide-react";

type Theme = "light" | "medium" | "dark";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    // Check for saved theme preference or default to light
    const savedTheme = (localStorage.getItem("theme") as Theme) || "light";
    setTheme(savedTheme);
    updateTheme(savedTheme);
  }, []);

  const updateTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    // Remove all theme classes
    root.classList.remove("light", "medium", "dark");
    // Add the new theme class (except for light which is default)
    if (newTheme !== "light") {
      root.classList.add(newTheme);
    }
    localStorage.setItem("theme", newTheme);
  };

  const toggleTheme = () => {
    // Cycle through: light -> medium -> dark -> light
    const newTheme: Theme =
      theme === "light" ? "medium" : theme === "medium" ? "dark" : "light";
    setTheme(newTheme);
    updateTheme(newTheme);
    console.log("Theme toggled to:", newTheme);
  };

  // Show appropriate icon based on current theme
  const getIcon = () => {
    switch (theme) {
      case "light":
        return <Sun className="h-4 w-4" />;
      case "medium":
        return <Cloudy className="h-4 w-4" />;
      case "dark":
        return <Moon className="h-4 w-4" />;
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      data-testid="button-theme-toggle"
      className="hover-elevate"
      title={`Current: ${theme} theme (click to cycle)`}
    >
      {getIcon()}
    </Button>
  );
}
