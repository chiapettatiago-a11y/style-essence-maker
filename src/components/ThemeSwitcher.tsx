import React from "react";
import { useTheme } from "@/hooks/useTheme";
import { Moon, Sun, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

const themes = [
  { id: "dark" as const, label: "Dark", icon: Moon },
  { id: "neutral" as const, label: "Neutro", icon: Monitor },
  { id: "light" as const, label: "Claro", icon: Sun },
];

const ThemeSwitcher = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
      {themes.map((t) => {
        const Icon = t.icon;
        const active = theme === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            title={t.label}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ThemeSwitcher;
