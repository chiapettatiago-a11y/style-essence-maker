import React from "react";
import { cn } from "@/lib/utils";
import { STYLE_CATEGORIES } from "@/data/prompt-layers";
import { User, Move, Image, Sparkles, Video } from "lucide-react";

const ICON_MAP: Record<string, React.ReactNode> = {
  User: <User className="h-3.5 w-3.5" />,
  Move: <Move className="h-3.5 w-3.5" />,
  Image: <Image className="h-3.5 w-3.5" />,
  Sparkles: <Sparkles className="h-3.5 w-3.5" />,
  Video: <Video className="h-3.5 w-3.5" />,
};

interface StyleSectionProps {
  selectedPresets: Record<string, string>;
  onPresetsChange: (p: Record<string, string>) => void;
}

// Filter out "model" category since we now use the gallery
const DISPLAY_CATEGORIES = STYLE_CATEGORIES.filter(c => c.id !== "model");

const StyleSection: React.FC<StyleSectionProps> = ({ selectedPresets, onPresetsChange }) => {
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
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Estilos e Cenário</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Escolha a pose, cenário, estética e câmera
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {DISPLAY_CATEGORIES.map((category) => (
          <div key={category.id} className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <span className="text-accent">{ICON_MAP[category.icon]}</span>
              {category.label}
            </div>
            <div className="space-y-1">
              {category.presets.map((preset) => {
                const isSelected = selectedPresets[category.id] === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => togglePreset(category.id, preset.id)}
                    className={cn(
                      "w-full text-left p-2.5 rounded-lg border transition-all",
                      isSelected
                        ? "border-accent bg-accent/10 shadow-sm"
                        : "border-border hover:border-accent/40 bg-card"
                    )}
                  >
                    <p className="text-xs font-medium">{preset.name}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{preset.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StyleSection;
