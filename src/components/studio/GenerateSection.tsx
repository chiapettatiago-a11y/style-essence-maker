import React, { useState } from "react";
import { GarmentAnalysis, GenerationEngine, GenerationRequest, ModelProfile } from "@/types/fashion";
import { Sparkles, PenLine, ChevronRight, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LAYER1_BASE } from "@/data/prompt-layers";
import { assembleLayer2, generateAllRequests, buildPromptPreviewPT, buildFullPrompt } from "@/data/prompt-builder";

interface GenerateSectionProps {
  manualPrompt: string;
  onManualPromptChange: (v: string) => void;
  garmentAnalysis: GarmentAnalysis | null;
  selectedProfile: ModelProfile | null;
  selectedPresets: Record<string, string>;
  selectedEngine: GenerationEngine;
  onGenerate: (requests: GenerationRequest[]) => void;
  isGenerating: boolean;
}

const ENGINE_LABELS: Record<GenerationEngine, string> = {
  gemini: "Google Gemini",
  fal: "fal.ai — Flux Kontext",
};

const GenerateSection: React.FC<GenerateSectionProps> = ({
  manualPrompt,
  onManualPromptChange,
  garmentAnalysis,
  selectedProfile,
  selectedPresets,
  selectedEngine,
  onGenerate,
  isGenerating,
}) => {
  const layer2Text = assembleLayer2(selectedPresets);
  const [showEnglish, setShowEnglish] = useState(false);
  const requests = generateAllRequests(
    { layer1: LAYER1_BASE, layer2: layer2Text, layer3: manualPrompt },
    garmentAnalysis,
    selectedProfile
  );

  const imageRequests = requests.filter(r => r.type !== "video-product" && r.type !== "video-model");
  const videoRequests = requests.filter(r => r.type === "video-product" || r.type === "video-model");

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Ajuste Final e Geração</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Adicione instruções extras em português e gere o pacote
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        <span>Motor selecionado:</span>
        <Badge variant="secondary">{ENGINE_LABELS[selectedEngine]}</Badge>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1.5">
          <PenLine className="h-3 w-3 text-accent" />
          Ajuste Manual (português)
        </Label>
        <Textarea
          value={manualPrompt}
          onChange={(e) => onManualPromptChange(e.target.value)}
          placeholder="Ex: Vento suave no cabelo, foco no detalhe da gola, iluminação mais quente..."
          rows={3}
          className="text-xs"
        />
      </div>

      <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 flex items-center gap-3">
        <span>
          <span className="font-medium text-foreground">{imageRequests.length} imagens</span>
          {" + "}
          <span className="font-medium text-foreground">{videoRequests.length} prompts de vídeo</span>
          {" serão gerados"}
        </span>
      </div>

      <Button
        onClick={() => onGenerate(requests)}
        disabled={isGenerating || !garmentAnalysis}
        className="w-full sm:w-auto"
        size="default"
      >
        {isGenerating ? (
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            Gerando...
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4" />
            Gerar Pacote Completo
          </span>
        )}
      </Button>

      <div className="border-t border-border pt-4 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Preview dos Prompts
          </h4>
          <Button
            variant={showEnglish ? "secondary" : "outline"}
            size="sm"
            className="h-6 text-[10px] gap-1"
            onClick={() => setShowEnglish((v) => !v)}
          >
            <Languages className="h-3 w-3" />
            {showEnglish ? "Ver em Português" : "Ver Prompt Original (EN)"}
          </Button>
        </div>
        {requests.map((req) => (
          <details key={req.type} className="group">
            <summary className="text-xs font-medium cursor-pointer hover:text-accent transition-colors list-none flex items-center gap-1">
              <ChevronRight className="h-3 w-3 group-open:rotate-90 transition-transform" />
              {req.label}
            </summary>
            <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap font-mono mt-1 ml-4 max-h-32 overflow-y-auto bg-muted/30 rounded-md p-2">
              {showEnglish ? req.prompt : buildPromptPreviewPT(
                garmentAnalysis,
                req.type,
                selectedProfile,
                selectedPresets,
                manualPrompt
              )}
            </pre>
          </details>
        ))}
      </div>
    </div>
  );
};

export default GenerateSection;
