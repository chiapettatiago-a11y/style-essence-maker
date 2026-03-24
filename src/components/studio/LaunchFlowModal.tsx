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
import StyleSection from "@/components/studio/StyleSection";
import GenerateSection from "@/components/studio/GenerateSection";
import EngineSelector from "@/components/studio/EngineSelector";
import { GarmentAnalysis, GenerationEngine, GenerationRequest, ModelProfile } from "@/types/fashion";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";

const STEPS = [
  { id: 1, title: "Upload da peça" },
  { id: 2, title: "Configurar manequim" },
  { id: 3, title: "Análise e proporções" },
  { id: 4, title: "Modelo e geração" },
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
}) => {
  const [step, setStep] = useState(startStep);

  useEffect(() => {
    if (open) setStep(startStep);
  }, [open, startStep]);

  const torsoRatio = useMemo(() => {
    if (!mannequin.mannequin_height_cm || !mannequin.mannequin_torso_cm) return null;
    return Math.round((mannequin.mannequin_torso_cm / mannequin.mannequin_height_cm) * 100);
  }, [mannequin.mannequin_height_cm, mannequin.mannequin_torso_cm]);

  const legRatio = useMemo(() => {
    if (!mannequin.mannequin_height_cm || !mannequin.mannequin_torso_cm) return null;
    const legs = mannequin.mannequin_height_cm - mannequin.mannequin_torso_cm;
    return Math.round((legs / mannequin.mannequin_height_cm) * 100);
  }, [mannequin.mannequin_height_cm, mannequin.mannequin_torso_cm]);

  const canGoNext =
    step === 1
      ? uploadedImages.length > 0 && !!garmentAnalysis
      : step === 2
        ? !!mannequin.mannequin_height_cm
        : true;

  const updateNumber = (key: keyof MannequinData, value: string) => {
    onMannequinChange({
      ...mannequin,
      [key]: value === "" ? null : Number(value),
    });
  };

  const updateProportionNumber = (
    key: "garmentLengthCm" | "waistPositionCm" | "sleeveLengthCm" | "shoulderWidthCm" | "hemBelowKneeCm",
    value: string,
  ) => {
    onProportionUpdate({
      [key]: value === "" ? null : Number(value),
    });
  };

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
          {step === 1 && (
            <UploadSection
              uploadedImages={uploadedImages}
              onImagesChange={onImagesChange}
              isAnalyzing={isAnalyzing}
              onAnalyze={onAnalyze}
              garmentAnalysis={garmentAnalysis}
              onAnalysisUpdate={onAnalysisUpdate}
            />
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Medidas do manequim de referência</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Altura total (cm)</Label>
                  <Input
                    type="number"
                    value={mannequin.mannequin_height_cm ?? ""}
                    onChange={(e) => updateNumber("mannequin_height_cm", e.target.value)}
                    className="border-accent/60"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Busto (cm)</Label>
                  <Input type="number" value={mannequin.mannequin_bust_cm ?? ""} onChange={(e) => updateNumber("mannequin_bust_cm", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cintura (cm)</Label>
                  <Input type="number" value={mannequin.mannequin_waist_cm ?? ""} onChange={(e) => updateNumber("mannequin_waist_cm", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Quadril (cm)</Label>
                  <Input type="number" value={mannequin.mannequin_hip_cm ?? ""} onChange={(e) => updateNumber("mannequin_hip_cm", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Torso (cm)</Label>
                  <Input type="number" value={mannequin.mannequin_torso_cm ?? ""} onChange={(e) => updateNumber("mannequin_torso_cm", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Braço (cm)</Label>
                  <Input type="number" value={mannequin.mannequin_arm_cm ?? ""} onChange={(e) => updateNumber("mannequin_arm_cm", e.target.value)} />
                </div>
              </div>
              <Card>
                <CardContent className="pt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">Razão torso/altura: {torsoRatio !== null ? `${torsoRatio}%` : "—"}</Badge>
                  <Badge variant="secondary">Razão perna/altura: {legRatio !== null ? `${legRatio}%` : "—"}</Badge>
                </CardContent>
              </Card>
            </div>
          )}

          {step === 3 && (
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

          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold">Escolher modelo e configurações</h3>
                <p className="text-xs text-muted-foreground mt-0.5">5 imagens + 2 prompts de vídeo serão gerados.</p>
              </div>
              <EngineSelector value={selectedEngine} onChange={onSelectedEngineChange} />
              <ModelGallery selectedModelId={selectedProfile?.id || null} onSelectModel={(m) => onSelectModel(m.id)} />
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
              />
            </div>
          )}
        </div>

        <div className="border-t border-border px-6 py-3 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          {step < 4 && (
            <Button onClick={() => setStep((s) => Math.min(4, s + 1))} disabled={!canGoNext}>
              Próximo <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LaunchFlowModal;
