import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, Sparkles, Layers3, Lock } from "lucide-react";
import { GenerationEngine } from "@/types/fashion";

interface EngineSelectorProps {
  value: GenerationEngine;
  onChange: (value: GenerationEngine) => void;
  locked?: boolean;
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
    id: "gemini",
    name: "Google Gemini",
    model: "gemini-pro-image-preview",
    price: "~US$0.01/foto",
    summary: "Já integrado e ideal para volume.",
    detail: "Melhor equilíbrio entre custo e velocidade para lookbooks completos.",
    badge: "Custo baixo",
    Icon: Sparkles,
  },
  {
    id: "fal",
    name: "fal.ai — Flux Kontext",
    model: "flux-pro/kontext",
    price: "~US$1/foto",
    summary: "Melhor consistência facial com referência.",
    detail: "Usa Kontext com image reference e cai para Flux 2 Pro nos closes macro.",
    badge: "Qualidade premium",
    Icon: Layers3,
  },
];

const EngineSelector: React.FC<EngineSelectorProps> = ({ value, onChange }) => {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Motor de geração</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Compare qualidade e custo no mesmo fluxo antes de decidir o padrão.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "inline-flex h-9 w-9 items-center justify-center rounded-full border",
                      selected ? "border-accent bg-accent text-accent-foreground" : "border-border bg-muted text-foreground"
                    )}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{name}</p>
                      <p className="text-[11px] text-muted-foreground">{model}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{badge}</Badge>
                    <Badge variant="outline">{price}</Badge>
                  </div>
                </div>

                {selected && (
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>

              <div className="mt-4 space-y-1.5">
                <p className="text-xs font-medium text-foreground">{summary}</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">{detail}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default EngineSelector;
