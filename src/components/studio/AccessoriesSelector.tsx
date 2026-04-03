import React from "react";
import { cn } from "@/lib/utils";
import { AccessorySelection } from "@/types/fashion";

const SHOE_TYPES = [
  { id: "scarpin", label: "Scarpin", emoji: "👠" },
  { id: "sandalia-salto", label: "Sandália de Salto", emoji: "👡" },
  { id: "rasteirinha", label: "Rasteirinha", emoji: "🩴" },
  { id: "tenis", label: "Tênis", emoji: "👟" },
] as const;

const SHOE_COLORS = [
  { id: "preto", label: "Preto", hex: "#1a1a1a" },
  { id: "nude", label: "Nude", hex: "#D2B48C" },
  { id: "branco", label: "Branco", hex: "#F5F5F5" },
  { id: "vermelho", label: "Vermelho", hex: "#C62828" },
  { id: "dourado", label: "Dourado", hex: "#C5A03F" },
] as const;

export const SHOE_PROMPT_MAP: Record<string, string> = {
  scarpin: "pointed-toe stiletto pump heels",
  "sandalia-salto": "strappy high-heel sandals",
  rasteirinha: "flat leather sandals (rasteirinha)",
  tenis: "clean white fashion sneakers",
};

export const COLOR_PROMPT_MAP: Record<string, string> = {
  preto: "black",
  nude: "nude/beige",
  branco: "white",
  vermelho: "red",
  dourado: "gold metallic",
};

interface AccessoriesSelectorProps {
  value: AccessorySelection;
  onChange: (v: AccessorySelection) => void;
}

const AccessoriesSelector: React.FC<AccessoriesSelectorProps> = ({ value, onChange }) => {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Acessórios — Calçado</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Escolha o tipo de sapato e a cor (opcional)
        </p>
      </div>

      {/* Shoe type */}
      <div className="flex flex-wrap gap-2">
        {SHOE_TYPES.map((shoe) => {
          const selected = value.shoeType === shoe.id;
          return (
            <button
              key={shoe.id}
              onClick={() =>
                onChange({
                  ...value,
                  shoeType: selected ? null : shoe.id,
                })
              }
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs transition-all",
                selected
                  ? "border-accent bg-accent/10 text-accent font-medium"
                  : "border-border hover:border-accent/50 text-muted-foreground hover:text-foreground"
              )}
            >
              <span>{shoe.emoji}</span>
              {shoe.label}
            </button>
          );
        })}
      </div>

      {/* Shoe color — only if a shoe type is selected */}
      {value.shoeType && (
        <div className="flex flex-wrap gap-2">
          {SHOE_COLORS.map((color) => {
            const selected = value.shoeColor === color.id;
            return (
              <button
                key={color.id}
                onClick={() =>
                  onChange({
                    ...value,
                    shoeColor: selected ? null : color.id,
                  })
                }
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs transition-all",
                  selected
                    ? "border-accent bg-accent/10 font-medium"
                    : "border-border hover:border-accent/50 text-muted-foreground hover:text-foreground"
                )}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full border border-border"
                  style={{ backgroundColor: color.hex }}
                />
                {color.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AccessoriesSelector;
