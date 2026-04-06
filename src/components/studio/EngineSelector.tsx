import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, Sparkles, Layers3, Zap, Image, Cpu } from "lucide-react";
import { GenerationEngine } from "@/types/fashion";

interface EngineSelectorProps {
  value: GenerationEngine;
  onChange: (value: GenerationEngine) => void;
}

const ENGINES: Array<{
  id: GenerationEngine;
  name: string;
  model: string;
  price: string;
  summary: string;
  detail: string;
  badge: string;
  Icon: typeof Sparkles;
}> = [
  {
    id: "ultra",
    name: "Imagen 4 Ultra HD",
    model: "imagen-4-ultra-generate",
    price: "~US$0.06/foto",
    summary: "Melhor qualidade absoluta.",
    detail: "Resolução e fidelidade máximas. Ideal para hero shots e catálogo premium.",
    badge: "Ultra qualidade",
    Icon: Sparkles,
  },
  {
    id: "standard",
    name: "Imagen 4 Padrão",
    model: "imagen-4-generate",
    price: "~US$0.04/foto",
    summary: "Melhor custo-benefício para produção.",
    detail: "Qualidade excelente com custo controlado. Recomendado como padrão.",
    badge: "Recomendado",
    Icon: Image,
  },
  {
    id: "fast",
    name: "Imagen 4 Rápido",
    model: "imagen-4-fast-generate",
    price: "~US$0.02/foto",
    summary: "Ideal para testes e rascunhos.",
    detail: "Geração rápida para validar prompts e composições antes da versão final.",
    badge: "Rascunho",
    Icon: Zap,
  },
  {
    id: "gemini",
    name: "Gemini (fallback)",
    model: "gemini-3-pro-image",
    price: "~US$0.01/foto",
    summary: "Motor alternativo via Gemini.",
    detail: "Usa Gemini 3 Pro Image. Fallback automático quando Imagen 4 falha.",
    badge: "Fallback",
    Icon: Cpu,
  },
  {
    id: "fal",
    name: "fal.ai — Flux Kontext",
    model: "flux-pro/kontext",
    price: "~US$1/foto",
    summary: "Melhor consistência facial com LoRA.",
    detail: "Usa Kontext com image reference e LoRA para consistência de modelo.",
    badge: "LoRA",
    Icon: Layers3,
  },
];

const EngineSelector: React.FC<EngineSelectorProps> = ({ value, onChange }) => {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Motor de geração</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Compare qualidade e custo. Cascade automático se o motor falhar.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ENGINES.map(({ id, name, model, price, summary, detail, badge, Icon }) => {
          const selected = value === id;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                "relative rounded-2xl border p-4 text-left transition-all bg-card",
                selected
                  ? "border-accent bg-accent/10 shadow-sm ring-1 ring-accent/30"
                  : "border-border hover:border-accent/40 hover:bg-muted/40"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "inline-flex h-8 w-8 items-center justify-center rounded-full border",
                      selected ? "border-accent bg-accent text-accent-foreground" : "border-border bg-muted text-foreground"
                    )}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold">{name}</p>
                      <p className="text-[10px] text-muted-foreground">{model}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">{badge}</Badge>
                    <Badge variant="outline" className="text-[10px]">{price}</Badge>
                  </div>
                </div>

                {selected && (
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground shrink-0">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </div>

              <div className="mt-3 space-y-1">
                <p className="text-[11px] font-medium text-foreground">{summary}</p>
                <p className="text-[10px] leading-relaxed text-muted-foreground">{detail}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default EngineSelector;
