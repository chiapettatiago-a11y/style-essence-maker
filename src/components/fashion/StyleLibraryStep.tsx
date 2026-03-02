import React from "react";
import { STYLE_CATEGORIES } from "@/data/prompt-layers";
import { cn } from "@/lib/utils";
import { User, Move, Image, Sparkles, Video } from "lucide-react";

interface StyleLibraryStepProps {
  selectedPresets: Record<string, string>;
  onPresetsChange: (presets: Record<string, string>) => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  User: <User className="h-4 w-4" />,
  Move: <Move className="h-4 w-4" />,
  Image: <Image className="h-4 w-4" />,
  Sparkles: <Sparkles className="h-4 w-4" />,
  Video: <Video className="h-4 w-4" />,
};

const StyleLibraryStep: React.FC<StyleLibraryStepProps> = ({
  selectedPresets,
  onPresetsChange,
}) => {
  const togglePreset = (categoryId: string, presetId: string) => {
    if (selectedPresets[categoryId] === presetId) {
      const next = { ...selectedPresets };
      delete next[categoryId];
      onPresetsChange(next);
    } else {
      onPresetsChange({ ...selectedPresets, [categoryId]: presetId });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Biblioteca de Estilos
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione um preset de cada categoria para compor o prompt.
        </p>
      </div>

      {STYLE_CATEGORIES.map((category) => (
        <div key={category.id} className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="text-accent">{ICON_MAP[category.icon]}</span>
            {category.label}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {category.presets.map((preset) => {
              const isSelected = selectedPresets[category.id] === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => togglePreset(category.id, preset.id)}
                  className={cn(
                    "text-left p-3 rounded-lg border transition-all",
                    isSelected
                      ? "border-accent bg-accent/10 shadow-sm"
                      : "border-border hover:border-accent/40 bg-card"
                  )}
                >
                  <p className="text-sm font-medium">{preset.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {preset.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default StyleLibraryStep;
