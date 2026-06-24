import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, Sparkles, Layers3 } from "lucide-react";
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
    id: "seedream",
    name: "Seedream 5.0 — ByteDance",
    model: "fal-ai/bytedance/seedream/v5/lite",
    price: "~US$0.04/foto",
    summary: "Padrão atual. Editorial com modelo BR.",
    detail: "Seedream 5.0 Lite via fal.ai — bom custo, alta fidelidade ao biotipo brasileiro.",
    badge: "Padrão",
    Icon: Sparkles,
  },
  {
    id: "fal",
    name: "fal.ai — Flux (fallback)",
    model: "flux-pro/kontext",
    price: "~US$1/foto",
    summary: "Fallback para consistência facial avançada.",
    detail: "Usa Kontext com image reference e cai para Flux 2 Pro nos closes macro.",
    badge: "Premium",
    Icon: Layers3,
  },
  {
    id: "gemini",
    name: "Gemini (legado)",
    model: "google/gemini-3.1-flash-image",
    price: "~US$0.01/foto",
    summary: "Engine legado, mantido para compatibilidade.",
    detail: "Use apenas para regenerar imagens antigas; sujeito a rate limit do Google.",
    badge: "Legado",
    Icon: Sparkles,
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
