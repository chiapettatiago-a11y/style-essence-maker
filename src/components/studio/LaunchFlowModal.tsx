import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import UploadSection from "@/components/studio/UploadSection";
import ModelGallery from "@/components/studio/ModelGallery";
import AccessoriesSelector from "@/components/studio/AccessoriesSelector";
import StyleSection from "@/components/studio/StyleSection";
import GenerateSection from "@/components/studio/GenerateSection";
import EngineSelector from "@/components/studio/EngineSelector";
import { AccessorySelection, GarmentAnalysis, GenerationEngine, GenerationRequest, ModelProfile } from "@/types/fashion";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";

const STEPS = [
  { id: 1, title: "Upload da peça" },
  { id: 2, title: "Análise e proporções" },
  { id: 3, title: "Modelo e geração" },
] as const;

type MannequinData = {
  mannequin_height_cm: number | null;
  mannequin_bust_cm: number | null;
  mannequin_waist_cm: number | null;
  mannequin_hip_cm: number | null;
  mannequin_torso_cm: number | null;
  mannequin_arm_cm: number | null;
};

interface LaunchFlowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startStep?: number;
  uploadedImages: string[];
  onImagesChange: (images: string[]) => void;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  garmentAnalysis: GarmentAnalysis | null;
  onAnalysisUpdate: (a: GarmentAnalysis) => void;
  mannequin: MannequinData;
  onMannequinChange: (value: MannequinData) => void;
  selectedProfile: ModelProfile | null;
  onSelectModel: (modelId: string) => void;
  onProfileUpdate: (profile: ModelProfile) => void;
  selectedPresets: Record<string, string>;
  onPresetsChange: (p: Record<string, string>) => void;
  manualPrompt: string;
  onManualPromptChange: (v: string) => void;
  selectedEngine: GenerationEngine;
  onSelectedEngineChange: (engine: GenerationEngine) => void;
  onGenerate: (requests: GenerationRequest[]) => void;
  isGenerating: boolean;
  proportionSummary: {
    garmentLengthCm?: number | null;
    waistPositionCm?: number | null;
    sleeveLengthCm?: number | null;
    shoulderWidthCm?: number | null;
    hemBelowKneeCm?: number | null;
    garmentLengthLabel?: string | null;
  };
  onProportionUpdate: (updates: {
    garmentLength?: string | null;
    garmentLengthCm?: number | null;
    waistPositionCm?: number | null;
    sleeveLengthCm?: number | null;
    shoulderWidthCm?: number | null;
    hemBelowKneeCm?: number | null;
  }) => void;
  garmentType: string | null;
  onGarmentTypeChange: (type: string) => void;
  accessories: AccessorySelection;
  onAccessoriesChange: (a: AccessorySelection) => void;
}

const LaunchFlowModal: React.FC<LaunchFlowModalProps> = ({
  open,
  onOpenChange,
  startStep = 1,
  uploadedImages,
  onImagesChange,
  isAnalyzing,
  onAnalyze,
  garmentAnalysis,
  onAnalysisUpdate,
  mannequin,
  onMannequinChange,
  selectedProfile,
  onSelectModel,
  onProfileUpdate,
  selectedPresets,
  onPresetsChange,
  manualPrompt,
  onManualPromptChange,
  selectedEngine,
  onSelectedEngineChange,
  onGenerate,
  isGenerating,
  proportionSummary,
  onProportionUpdate,
  garmentType,
  onGarmentTypeChange,
  accessories,
  onAccessoriesChange,
}) => {
  const [step, setStep] = useState(startStep);

  useEffect(() => {
    if (open) setStep(startStep);
  }, [open, startStep]);

  const updateProportionNumber = (
    key: "garmentLengthCm" | "waistPositionCm" | "sleeveLengthCm" | "shoulderWidthCm" | "hemBelowKneeCm",
    value: string,
  ) => {
    onProportionUpdate({
      [key]: value === "" ? null : Number(value),
    });
  };

  const canGoNext =
    step === 1
      ? uploadedImages.length > 0 && !!garmentAnalysis
      : step === 2
        ? true
        : true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle>Novo lançamento</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 border-b border-border flex items-center gap-2 overflow-x-auto">
          {STEPS.map((s, idx) => (
            <div key={s.id} className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setStep(s.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition-colors",
                  step === s.id
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="font-semibold">{s.id}</span>
                {s.title}
              </button>
              {idx < STEPS.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Step 1: Upload */}
          {step === 1 && (
            <UploadSection
              uploadedImages={uploadedImages}
              onImagesChange={onImagesChange}
              isAnalyzing={isAnalyzing}
              onAnalyze={onAnalyze}
              garmentAnalysis={garmentAnalysis}
              onAnalysisUpdate={onAnalysisUpdate}
              garmentType={garmentType}
              onGarmentTypeChange={onGarmentTypeChange}
            />
          )}

          {/* Step 2: Analysis & Proportions */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Análise técnica e proporções</h3>
                <Button variant="outline" size="sm" onClick={onAnalyze} disabled={isAnalyzing || uploadedImages.length === 0}>
                  Re-analisar
                </Button>
              </div>

              {garmentAnalysis ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-4 space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase">Campos técnicos</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          ["Tipo", garmentAnalysis.type],
                          ["Tecido", garmentAnalysis.fabric],
                          ["Cor", garmentAnalysis.color],
                          ["Silhueta", garmentAnalysis.silhouette],
                          ["Decote", garmentAnalysis.neckline],
                          ["Mangas", garmentAnalysis.sleeves],
                          ["Barra", garmentAnalysis.hemline],
                          ["Padrão", garmentAnalysis.pattern],
                        ].map(([label, value]) => (
                          <div key={label} className="space-y-1">
                            <Label className="text-[10px]">{label}</Label>
                            <Input
                              value={String(value || "")}
                              onChange={(e) => {
                                const key =
                                  label === "Tipo" ? "type" :
                                  label === "Tecido" ? "fabric" :
                                  label === "Cor" ? "color" :
                                  label === "Silhueta" ? "silhouette" :
                                  label === "Decote" ? "neckline" :
                                  label === "Mangas" ? "sleeves" :
                                  label === "Barra" ? "hemline" : "pattern";
                                onAnalysisUpdate({ ...garmentAnalysis, [key]: e.target.value });
                              }}
                              className="h-8 text-xs"
                            />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-4 space-y-3">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase">Proporções da peça</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px]">Classificação de comprimento</Label>
                          <Input
                            value={proportionSummary.garmentLengthLabel || ""}
                            onChange={(e) => onProportionUpdate({ garmentLength: e.target.value || null })}
                            className="h-8 text-xs"
                            placeholder="Ex: midi, curto, longo"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Comprimento (cm)</Label>
                          <Input
                            type="number"
                            value={proportionSummary.garmentLengthCm ?? ""}
                            onChange={(e) => updateProportionNumber("garmentLengthCm", e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Posição cintura (cm)</Label>
                          <Input
                            type="number"
                            value={proportionSummary.waistPositionCm ?? ""}
                            onChange={(e) => updateProportionNumber("waistPositionCm", e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Manga (cm)</Label>
                          <Input
                            type="number"
                            value={proportionSummary.sleeveLengthCm ?? ""}
                            onChange={(e) => updateProportionNumber("sleeveLengthCm", e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Ombro (cm)</Label>
                          <Input
                            type="number"
                            value={proportionSummary.shoulderWidthCm ?? ""}
                            onChange={(e) => updateProportionNumber("shoulderWidthCm", e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Barra vs joelho (cm)</Label>
                          <Input
                            type="number"
                            value={proportionSummary.hemBelowKneeCm ?? ""}
                            onChange={(e) => updateProportionNumber("hemBelowKneeCm", e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Faça a análise da peça para visualizar os dados técnicos.</p>
              )}
            </div>
          )}

          {/* Step 3: Model + Styles + Generate */}
          {step === 3 && (
            <div className="space-y-5">
              <ModelGallery selectedModelId={selectedProfile?.id || null} onSelectModel={(m) => onSelectModel(m.id)} />

              {/* LoRA / Guidance sliders — only when model has LoRA and fal engine selected */}
              {selectedProfile?.lora_url && selectedEngine === "fal" && (
                <Card className="border-accent/30 bg-accent/5">
                  <CardContent className="pt-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-accent" />
                      <h4 className="text-xs font-semibold">Parâmetros LoRA — {selectedProfile.name}</h4>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] text-muted-foreground">LoRA Scale</Label>
                          <span className="text-[11px] font-mono text-accent">{(selectedProfile.lora_scale ?? 1.0).toFixed(2)}</span>
                        </div>
                        <Slider
                          value={[selectedProfile.lora_scale ?? 1.0]}
                          min={0}
                          max={2}
                          step={0.05}
                          onValueChange={([v]) => onProfileUpdate({ ...selectedProfile, lora_scale: v })}
                          className="w-full"
                        />
                        <p className="text-[10px] text-muted-foreground">Intensidade da LoRA. 1.0 = padrão validado.</p>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] text-muted-foreground">Guidance Scale</Label>
                          <span className="text-[11px] font-mono text-accent">{(selectedProfile.guidance_scale ?? 3.5).toFixed(1)}</span>
                        </div>
                        <Slider
                          value={[selectedProfile.guidance_scale ?? 3.5]}
                          min={1}
                          max={20}
                          step={0.5}
                          onValueChange={([v]) => onProfileUpdate({ ...selectedProfile, guidance_scale: v })}
                          className="w-full"
                        />
                        <p className="text-[10px] text-muted-foreground">Aderência ao prompt. 9 = validado para Thais.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <AccessoriesSelector value={accessories} onChange={onAccessoriesChange} />

              <EngineSelector value={selectedEngine} onChange={onSelectedEngineChange} />

              <div>
                <h3 className="text-sm font-semibold">Estilos e geração</h3>
                <p className="text-xs text-muted-foreground mt-0.5">5 imagens + 2 prompts de vídeo serão gerados.</p>
              </div>

              <StyleSection selectedPresets={selectedPresets} onPresetsChange={onPresetsChange} />
              <GenerateSection
                manualPrompt={manualPrompt}
                onManualPromptChange={onManualPromptChange}
                garmentAnalysis={garmentAnalysis}
                selectedProfile={selectedProfile}
                selectedPresets={selectedPresets}
                selectedEngine={selectedEngine}
                onGenerate={(requests) => {
                  onGenerate(requests);
                  onOpenChange(false);
                }}
                isGenerating={isGenerating}
                garmentType={garmentType}
                accessories={accessories}
              />
            </div>
          )}
        </div>

        <div className="border-t border-border px-6 py-3 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          {step < 3 && (
            <Button onClick={() => setStep((s) => Math.min(3, s + 1))} disabled={!canGoNext}>
              Próximo <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LaunchFlowModal;
