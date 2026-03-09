import React, { useState, useCallback } from "react";
import { GarmentAnalysis, GeneratedImage, GenerationRequest, ModelProfile, WeeklyLaunch, WizardState } from "@/types/fashion";
import { LAYER1_BASE } from "@/data/prompt-layers";
import { assembleLayer2 } from "@/data/prompt-builder";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import UploadStep from "@/components/fashion/UploadStep";
import AnalysisCard from "@/components/fashion/AnalysisCard";
import ModelProfileStep from "@/components/fashion/ModelProfileStep";
import StyleLibraryStep from "@/components/fashion/StyleLibraryStep";
import PromptReviewStep from "@/components/fashion/PromptReviewStep";
import ResultsStep from "@/components/fashion/ResultsStep";


const STEPS = [
  { id: 0, label: "Upload" },
  { id: 1, label: "Modelo" },
  { id: 2, label: "Estilos" },
  { id: 3, label: "Prompts" },
  { id: 4, label: "Resultados" },
];

const Index = () => {
  const defaultWeekId = crypto.randomUUID();
  const [state, setState] = useState<WizardState>({
    step: 0,
    uploadedImages: [],
    garmentAnalysis: null,
    selectedProfile: null,
    selectedPresets: {},
    manualPrompt: "",
    generatedImages: [],
    weeklyLaunches: [{ id: defaultWeekId, label: "Semana 1", images: [] }],
    activeWeek: defaultWeekId,
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const update = <K extends keyof WizardState>(key: K, value: WizardState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  const handleAnalyze = useCallback(async () => {
    if (state.uploadedImages.length === 0) return;
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-garment", {
        body: { images: state.uploadedImages },
      });
      if (error) throw error;
      update("garmentAnalysis", data.analysis as GarmentAnalysis);
    } catch (err) {
      console.error("Analysis error:", err);
      // Fallback mock analysis
      update("garmentAnalysis", {
        type: "Vestido",
        fabric: "Renda e plissado",
        color: "Champagne",
        pattern: "Renda floral intricada",
        construction: "Corpete em renda transparente, saia plissada estruturada",
        details: "Gola alta em renda com babado",
        style: "Luxury editorial",
        fullDescription: "",
        length: "Longo até o tornozelo",
        silhouette: "Evasê",
        hemline: "Barra reta",
        neckline: "Gola alta",
        sleeves: "Manga longa",
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [state.uploadedImages]);

  const handleGenerate = useCallback(
    async (requests: GenerationRequest[]) => {
      setIsGenerating(true);

      const initial: GeneratedImage[] = requests.map((r) => ({
        id: crypto.randomUUID(),
        type: r.type,
        label: r.label,
        prompt: r.prompt,
        status: r.type === "video-product" || r.type === "video-model" ? "done" : "pending",
      }));
      // Store in active week
      setState((s) => ({
        ...s,
        step: 4,
        generatedImages: initial,
        weeklyLaunches: s.weeklyLaunches.map((w) =>
          w.id === s.activeWeek ? { ...w, images: [...w.images, ...initial] } : w
        ),
      }));

      // Generate images sequentially (skip video prompts)
      for (const img of initial) {
        if (img.type === "video-product" || img.type === "video-model") continue;

        const updateImageStatus = (id: string, updates: Partial<GeneratedImage>) => {
          setState((s) => ({
            ...s,
            generatedImages: s.generatedImages.map((i) =>
              i.id === id ? { ...i, ...updates } : i
            ),
            weeklyLaunches: s.weeklyLaunches.map((w) => ({
              ...w,
              images: w.images.map((i) => (i.id === id ? { ...i, ...updates } : i)),
            })),
          }));
        };

        updateImageStatus(img.id, { status: "generating" });

        try {
          const { data, error } = await supabase.functions.invoke("generate-image", {
            body: {
              prompt: img.prompt,
              referenceImages: state.uploadedImages.slice(0, 1),
            },
          });
          if (error) throw error;
          updateImageStatus(img.id, { status: "done", imageUrl: data.imageUrl });
        } catch (err) {
          console.error("Generation error:", err);
          updateImageStatus(img.id, { status: "error", error: "Falha na geração" });
        }
      }

      setIsGenerating(false);
    },
    [state.uploadedImages]
  );

  const handleRegenerate = useCallback(
    async (id: string) => {
      // Find image across all weeks
      let img: GeneratedImage | undefined;
      for (const w of state.weeklyLaunches) {
        img = w.images.find((i) => i.id === id);
        if (img) break;
      }
      if (!img) return;

      const updateImg = (updates: Partial<GeneratedImage>) => {
        setState((s) => ({
          ...s,
          weeklyLaunches: s.weeklyLaunches.map((w) => ({
            ...w,
            images: w.images.map((i) => (i.id === id ? { ...i, ...updates } : i)),
          })),
        }));
      };

      updateImg({ status: "generating" });

      try {
        const { data, error } = await supabase.functions.invoke("generate-image", {
          body: {
            prompt: img.prompt,
            referenceImages: state.uploadedImages.slice(0, 1),
          },
        });
        if (error) throw error;
        updateImg({ status: "done", imageUrl: data.imageUrl });
      } catch (err) {
        updateImg({ status: "error", error: "Falha na regeneração" });
      }
    },
    [state.weeklyLaunches, state.uploadedImages]
  );

  const handleAddWeek = useCallback(() => {
    const newId = crypto.randomUUID();
    const newLabel = `Semana ${state.weeklyLaunches.length + 1}`;
    setState((s) => ({
      ...s,
      weeklyLaunches: [...s.weeklyLaunches, { id: newId, label: newLabel, images: [] }],
      activeWeek: newId,
    }));
  }, [state.weeklyLaunches.length]);

  const canProceed =
    state.step === 0
      ? !!state.garmentAnalysis
      : state.step === 1
      ? !!state.selectedProfile
      : true;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            <h1 className="text-xl tracking-tight">Fashion AI Studio</h1>
          </div>
          <span className="text-xs text-muted-foreground">
            Gerador de Lookbook com IA
          </span>
        </div>
      </header>

      {/* Stepper */}
      <nav className="border-b border-border">
        <div className="max-w-5xl mx-auto flex">
          {STEPS.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                if (s.id < state.step) update("step", s.id);
              }}
              className={cn(
                "flex-1 py-3 text-xs font-medium text-center border-b-2 transition-colors",
                s.id === state.step
                  ? "border-accent text-accent"
                  : s.id < state.step
                  ? "border-transparent text-foreground cursor-pointer hover:text-accent"
                  : "border-transparent text-muted-foreground cursor-default"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {state.step === 0 && (
          <div className="space-y-6">
            <UploadStep
              images={state.uploadedImages}
              onImagesChange={(imgs) => update("uploadedImages", imgs)}
              isAnalyzing={isAnalyzing}
              onAnalyze={handleAnalyze}
              analysisComplete={!!state.garmentAnalysis}
            />
            {state.garmentAnalysis && (
              <AnalysisCard
                analysis={state.garmentAnalysis}
                onUpdate={(a) => update("garmentAnalysis", a)}
              />
            )}
          </div>
        )}

        {state.step === 1 && (
          <ModelProfileStep
            selectedProfile={state.selectedProfile}
            onProfileChange={(p) => update("selectedProfile", p)}
          />
        )}

        {state.step === 2 && (
          <StyleLibraryStep
            selectedPresets={state.selectedPresets}
            onPresetsChange={(p) => update("selectedPresets", p)}
          />
        )}

        {state.step === 3 && (
          <PromptReviewStep
            selectedPresets={state.selectedPresets}
            manualPrompt={state.manualPrompt}
            onManualPromptChange={(v) => update("manualPrompt", v)}
            garmentAnalysis={state.garmentAnalysis}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
          />
        )}

        {state.step === 4 && (
          <ResultsStep
            weeklyLaunches={state.weeklyLaunches}
            activeWeek={state.activeWeek}
            onActiveWeekChange={(id) => update("activeWeek", id)}
            onAddWeek={handleAddWeek}
            onRegenerate={handleRegenerate}
          />
        )}

        {/* Navigation */}
        {state.step < 4 && (
          <div className="flex justify-between mt-8 pt-6 border-t border-border">
            <Button
              variant="ghost"
              onClick={() => update("step", state.step - 1)}
              disabled={state.step === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
            {state.step < 3 && (
              <Button
                onClick={() => update("step", state.step + 1)}
                disabled={!canProceed}
              >
                Próximo
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
