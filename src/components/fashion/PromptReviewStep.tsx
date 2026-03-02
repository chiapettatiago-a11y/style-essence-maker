import React, { useMemo, useState } from "react";
import { Lock, Palette, PenLine, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { GarmentAnalysis, GenerationRequest } from "@/types/fashion";
import { LAYER1_BASE } from "@/data/prompt-layers";
import { assembleLayer2, generateAllRequests } from "@/data/prompt-builder";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PromptReviewStepProps {
  selectedPresets: Record<string, string>;
  manualPrompt: string;
  onManualPromptChange: (value: string) => void;
  garmentAnalysis: GarmentAnalysis | null;
  onGenerate: (requests: GenerationRequest[]) => void;
  isGenerating: boolean;
}

const PromptReviewStep: React.FC<PromptReviewStepProps> = ({
  selectedPresets,
  manualPrompt,
  onManualPromptChange,
  garmentAnalysis,
  onGenerate,
  isGenerating,
}) => {
  const [baseExpanded, setBaseExpanded] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const layer2Text = useMemo(() => assembleLayer2(selectedPresets), [selectedPresets]);

  const requests = useMemo(
    () =>
      generateAllRequests(
        { layer1: LAYER1_BASE, layer2: layer2Text, layer3: manualPrompt },
        garmentAnalysis
      ),
    [layer2Text, manualPrompt, garmentAnalysis]
  );

  const copyPrompt = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Revisar Prompts</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Visualize o prompt montado em 3 camadas. Ajuste a Camada 3 antes de gerar.
        </p>
      </div>

      {/* Layer indicators */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1 text-layer-locked">
          <Lock className="h-3 w-3" /> Base Técnica
        </span>
        <span className="flex items-center gap-1 text-layer-style">
          <Palette className="h-3 w-3" /> Estilos Selecionados
        </span>
        <span className="flex items-center gap-1 text-layer-manual">
          <PenLine className="h-3 w-3" /> Ajuste Manual
        </span>
      </div>

      {/* Collapsible base layer */}
      <div className="rounded-lg border border-border bg-card">
        <button
          onClick={() => setBaseExpanded(!baseExpanded)}
          className="w-full flex items-center justify-between p-3 text-sm"
        >
          <span className="flex items-center gap-2 font-medium text-layer-locked">
            <Lock className="h-3.5 w-3.5" />
            🔒 Camada 1 — Base Técnica Travada
          </span>
          {baseExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {baseExpanded && (
          <div className="px-3 pb-3">
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 p-3 rounded">
              {LAYER1_BASE}
            </pre>
          </div>
        )}
      </div>

      {/* Layer 2 preview */}
      {layer2Text && (
        <div className="rounded-lg border border-layer-style/30 bg-card p-3 space-y-1">
          <span className="flex items-center gap-2 text-sm font-medium text-layer-style">
            <Palette className="h-3.5 w-3.5" />
            🎛 Camada 2 — Estilos Selecionados
          </span>
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
            {layer2Text}
          </pre>
        </div>
      )}

      {/* Layer 3 manual */}
      <div className="rounded-lg border border-layer-manual/30 bg-card p-3 space-y-2">
        <span className="flex items-center gap-2 text-sm font-medium text-layer-manual">
          <PenLine className="h-3.5 w-3.5" />
          ✏️ Camada 3 — Ajuste Manual
        </span>
        <Textarea
          value={manualPrompt}
          onChange={(e) => onManualPromptChange(e.target.value)}
          placeholder="Adicionar vento suave no cabelo, foco extra no detalhe da gola..."
          rows={3}
          className="text-sm"
        />
      </div>

      {/* Per-request previews */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Prompts por Imagem/Vídeo</h3>
        {requests.map((req) => (
          <div
            key={req.type}
            className="rounded-lg border border-border bg-card p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{req.label}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyPrompt(req.type, req.prompt)}
                className="h-7 text-xs"
              >
                {copied === req.type ? (
                  <Check className="h-3 w-3 mr-1" />
                ) : (
                  <Copy className="h-3 w-3 mr-1" />
                )}
                {copied === req.type ? "Copiado" : "Copiar"}
              </Button>
            </div>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
              {req.prompt}
            </pre>
          </div>
        ))}
      </div>

      <Button
        onClick={() => onGenerate(requests)}
        disabled={isGenerating}
        className="w-full"
        size="lg"
      >
        {isGenerating ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            Gerando imagens...
          </span>
        ) : (
          `Gerar Pacote (${requests.filter((r) => r.type !== "video-product" && r.type !== "video-model").length} imagens + ${requests.filter((r) => r.type === "video-product" || r.type === "video-model").length} prompts de vídeo)`
        )}
      </Button>
    </div>
  );
};

export default PromptReviewStep;
