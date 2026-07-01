import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Package, UserRound, Palette, Cpu, Sparkles, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import UploadSection from "@/components/studio/UploadSection";
import ModelGallery from "@/components/studio/ModelGallery";
import AccessoriesSelector from "@/components/studio/AccessoriesSelector";
import StyleSection from "@/components/studio/StyleSection";
import GenerateSection from "@/components/studio/GenerateSection";
import EngineSelector from "@/components/studio/EngineSelector";
import { AccessorySelection, GarmentAnalysis, GenerationEngine, GenerationRequest, ModelProfile } from "@/types/fashion";

interface SetupPanelProps {
  uploadedImages: string[];
  onImagesChange: (images: string[]) => void;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  garmentAnalysis: GarmentAnalysis | null;
  onAnalysisUpdate: (a: GarmentAnalysis) => void;
  selectedProfile: ModelProfile | null;
  onSelectModel: (modelId: string) => void;
  selectedPresets: Record<string, string>;
  onPresetsChange: (p: Record<string, string>) => void;
  manualPrompt: string;
  onManualPromptChange: (v: string) => void;
  selectedEngine: GenerationEngine;
  onSelectedEngineChange: (engine: GenerationEngine) => void;
  onGenerate: (requests: GenerationRequest[]) => void;
  isGenerating: boolean;
  garmentType: string | null;
  onGarmentTypeChange: (type: string) => void;
  accessories: AccessorySelection;
  onAccessoriesChange: (a: AccessorySelection) => void;
  isCombo: boolean;
  onIsComboChange: (v: boolean) => void;
  featuredPiece: string | null;
  onFeaturedPieceChange: (v: string) => void;
  engineLocked?: boolean;
}

type SectionProps = {
  icon: React.ReactNode;
  title: string;
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

const Section: React.FC<SectionProps> = ({ icon, title, summary, defaultOpen = false, children }) => {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-border/60">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-accent/5 transition-colors rounded-t-md"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-muted-foreground">{icon}</span>
              <div className="min-w-0">
                <div className="text-xs font-semibold">{title}</div>
                {summary && <div className="text-[10px] text-muted-foreground truncate">{summary}</div>}
              </div>
            </div>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0", open && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-3 px-3 border-t border-border/40">
            <div className="pt-3">{children}</div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

const SetupPanel: React.FC<SetupPanelProps> = ({
  uploadedImages,
  onImagesChange,
  isAnalyzing,
  onAnalyze,
  garmentAnalysis,
  onAnalysisUpdate,
  selectedProfile,
  onSelectModel,
  selectedPresets,
  onPresetsChange,
  manualPrompt,
  onManualPromptChange,
  selectedEngine,
  onSelectedEngineChange,
  onGenerate,
  isGenerating,
  garmentType,
  onGarmentTypeChange,
  accessories,
  onAccessoriesChange,
  isCombo,
  onIsComboChange,
  featuredPiece,
  onFeaturedPieceChange,
  engineLocked = false,
}) => {
  const hasImage = uploadedImages.length > 0;
  const hasAnalysis = !!garmentAnalysis;
  const presetCount = Object.values(selectedPresets).filter(Boolean).length;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold">Setup do look</h2>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">Configure a peça, o modelo e gere os ângulos.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {/* Peça */}
        <Section
          icon={<Package className="h-3.5 w-3.5" />}
          title="Peça"
          summary={
            hasAnalysis
              ? `${garmentAnalysis?.type || "—"} · ${garmentAnalysis?.fabric || "—"} · ${garmentAnalysis?.color || "—"}`
              : hasImage
                ? "Imagem carregada — clique em Analisar"
                : "Envie a foto da peça"
          }
          defaultOpen={!hasAnalysis}
        >
          <UploadSection
            uploadedImages={uploadedImages}
            onImagesChange={onImagesChange}
            isAnalyzing={isAnalyzing}
            onAnalyze={onAnalyze}
            garmentAnalysis={garmentAnalysis}
            onAnalysisUpdate={onAnalysisUpdate}
            garmentType={garmentType}
            onGarmentTypeChange={onGarmentTypeChange}
            isCombo={isCombo}
            onIsComboChange={onIsComboChange}
            featuredPiece={featuredPiece}
            onFeaturedPieceChange={onFeaturedPieceChange}
          />
        </Section>

        {/* Modelo */}
        <Section
          icon={<UserRound className="h-3.5 w-3.5" />}
          title="Modelo"
          summary={selectedProfile ? selectedProfile.name : "Nenhum selecionado"}
          defaultOpen={!selectedProfile}
        >
          <ModelGallery
            selectedModelId={selectedProfile?.id || null}
            onSelectModel={(m) => onSelectModel(m.id)}
          />
        </Section>

        {/* Estilo & cenário */}
        <Section
          icon={<Palette className="h-3.5 w-3.5" />}
          title="Estilo & cenário"
          summary={presetCount > 0 ? `${presetCount} preset(s) · acessórios` : "Padrão"}
        >
          <div className="space-y-4">
            <AccessoriesSelector value={accessories} onChange={onAccessoriesChange} />
            <StyleSection selectedPresets={selectedPresets} onPresetsChange={onPresetsChange} />
          </div>
        </Section>

        {/* Motor */}
        <Section
          icon={<Cpu className="h-3.5 w-3.5" />}
          title="Motor de geração"
          summary={
            <span className="flex items-center gap-1">
              {selectedEngine === "gemini" ? "Google Gemini" : "fal.ai — Flux"}
              {engineLocked && <Lock className="h-2.5 w-2.5" />}
            </span>
          }
        >
          <EngineSelector value={selectedEngine} onChange={onSelectedEngineChange} locked={engineLocked} />
        </Section>
      </div>

      {/* Gerar — sticky no rodapé */}
      <div className="border-t border-border bg-card/50 px-3 py-3 max-h-[55vh] overflow-y-auto">
        {!hasAnalysis ? (
          <div className="text-[11px] text-muted-foreground text-center py-4">
            Faça a análise da peça para liberar a geração.
          </div>
        ) : !selectedProfile ? (
          <div className="text-[11px] text-muted-foreground text-center py-4">
            Selecione um modelo para gerar.
          </div>
        ) : (
          <GenerateSection
            manualPrompt={manualPrompt}
            onManualPromptChange={onManualPromptChange}
            garmentAnalysis={garmentAnalysis}
            selectedProfile={selectedProfile}
            selectedPresets={selectedPresets}
            selectedEngine={selectedEngine}
            onGenerate={onGenerate}
            isGenerating={isGenerating}
            garmentType={garmentType}
            accessories={accessories}
          />
        )}
      </div>
    </div>
  );
};

export default SetupPanel;
