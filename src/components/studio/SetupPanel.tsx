import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Package, UserRound, Palette, Sparkles, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import UploadSection from "@/components/studio/UploadSection";
import ModelGallery from "@/components/studio/ModelGallery";
import AccessoriesSelector from "@/components/studio/AccessoriesSelector";
import StyleSection from "@/components/studio/StyleSection";
import GenerateSection from "@/components/studio/GenerateSection";
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
  /** Rótulo do que está sendo gerado agora (ex.: "Frontal") */
  currentGeneratingLabel?: string | null;
  approvedCount?: number;
  donePhotoCount?: number;
  frontApproved?: boolean;
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
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors rounded-t-md"
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
  currentGeneratingLabel,
  approvedCount = 0,
  donePhotoCount = 0,
  frontApproved = false,
}) => {
  const hasImage = uploadedImages.length > 0;
  const hasAnalysis = !!garmentAnalysis;
  const presetCount = Object.values(selectedPresets).filter(Boolean).length;

  // Status derivado
  const statusLabel = isGenerating
    ? currentGeneratingLabel
      ? `Gerando ${currentGeneratingLabel.toLowerCase()}…`
      : "Gerando…"
    : donePhotoCount === 0
      ? "Pronto para começar"
      : !frontApproved
        ? "Aguardando aprovação da frontal"
        : approvedCount === donePhotoCount
          ? "Tudo aprovado"
          : "Aprove as fotos para liberar mais ângulos";

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Setup do look</h2>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">Configure a peça, o modelo e gere os ângulos.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        <Section
          icon={<Package className="h-3.5 w-3.5" />}
          title="Peça"
          summary={
            hasAnalysis
              ? `${garmentAnalysis?.type || "—"} · ${garmentAnalysis?.fabric || "—"} · ${garmentAnalysis?.color || "—"}`
              : hasImage
                ? "Imagem carregada — clique em Analisar"
                : "Envie a foto da peça (até 6)"
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
      </div>

      {/* Rodapé — geração + progresso */}
      <div className="border-t border-border bg-card/60 px-3 py-3 space-y-3 max-h-[60vh] overflow-y-auto">
        {/* Progresso */}
        <div className="rounded-md border border-border/60 bg-background/60 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {isGenerating ? (
                <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin shrink-0" />
              ) : donePhotoCount > 0 && approvedCount === donePhotoCount ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 shrink-0" />
              )}
              <span className="text-[11px] font-medium truncate">{statusLabel}</span>
            </div>
            <Badge variant="outline" className="text-[10px] shrink-0">
              {approvedCount}/{donePhotoCount || 0} aprovadas
            </Badge>
          </div>
          {donePhotoCount > 0 && (
            <div className="mt-2 h-1 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-foreground/70 transition-all"
                style={{ width: `${donePhotoCount ? (approvedCount / donePhotoCount) * 100 : 0}%` }}
              />
            </div>
          )}
        </div>

        {!hasAnalysis ? (
          <div className="text-[11px] text-muted-foreground text-center py-2">
            Faça a análise da peça para liberar a geração.
          </div>
        ) : !selectedProfile ? (
          <div className="text-[11px] text-muted-foreground text-center py-2">
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
