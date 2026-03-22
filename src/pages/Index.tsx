import React, { useState, useCallback } from "react";
import { GarmentAnalysis, GeneratedImage, GenerationRequest, ModelProfile, WeeklyLaunch, WizardState, ProductVariant } from "@/types/fashion";
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
  { id: 0, label: "Modelo" },
  { id: 1, label: "Upload" },
  { id: 2, label: "Estilos" },
  { id: 3, label: "Prompts" },
  { id: 4, label: "Resultados" },
];

const Index = () => {
  const defaultWeekId = crypto.randomUUID();
  const defaultVariantId = crypto.randomUUID();
  const defaultVariant: ProductVariant = {
    id: defaultVariantId, productId: "", colorName: "Original",
    uploadedImages: [], garmentAnalysis: null, sortOrder: 0,
  };
  const [state, setState] = useState<WizardState>({
    step: 0,
    variants: [defaultVariant],
    activeVariantId: defaultVariantId,
    uploadedImages: [],
    garmentAnalysis: null,
    selectedProfile: null,
    selectedPresets: {},
    selectedEngine: "gemini",
    manualPrompt: "",
    generatedImages: [],
    weeklyLaunches: [{ id: defaultWeekId, label: "Semana 1", images: [] }],
    activeWeek: defaultWeekId,
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const activeVariant = state.variants.find(v => v.id === state.activeVariantId) || state.variants[0];

  const update = <K extends keyof WizardState>(key: K, value: WizardState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  const updateVariant = (updates: Partial<ProductVariant>) => {
    setState(s => ({
      ...s,
      variants: s.variants.map(v => v.id === s.activeVariantId ? { ...v, ...updates } : v),
      ...(updates.uploadedImages !== undefined ? { uploadedImages: updates.uploadedImages } : {}),
      ...(updates.garmentAnalysis !== undefined ? { garmentAnalysis: updates.garmentAnalysis } : {}),
    }));
  };

  const handleAnalyze = useCallback(async () => {
    if (activeVariant.uploadedImages.length === 0) return;
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-garment", {
        body: { images: activeVariant.uploadedImages },
      });
      if (error) throw error;
      updateVariant({ garmentAnalysis: data.analysis as GarmentAnalysis });
    } catch (err) {
      console.error("Analysis error:", err);
      updateVariant({
        garmentAnalysis: {
          type: "Vestido", fabric: "Renda e plissado", color: "Champagne",
          pattern: "Renda floral intricada", construction: "Corpete em renda transparente, saia plissada estruturada",
          details: "Gola alta em renda com babado", style: "Luxury editorial",
          fullDescription: "", length: "Longo até o tornozelo", silhouette: "Evasê",
          hemline: "Barra reta", neckline: "Gola alta", sleeves: "Manga longa",
        },
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [activeVariant.uploadedImages]);

  const handleGenerate = useCallback(
    async (requests: GenerationRequest[]) => {
      setIsGenerating(true);
      const initial: GeneratedImage[] = requests.map((r) => ({
        id: crypto.randomUUID(), type: r.type, label: r.label, prompt: r.prompt,
        status: r.type === "video-product" || r.type === "video-model" ? "done" : "pending",
      }));
      setState((s) => ({
        ...s, step: 4, generatedImages: initial,
        weeklyLaunches: s.weeklyLaunches.map((w) =>
          w.id === s.activeWeek ? { ...w, images: [...w.images, ...initial] } : w
        ),
      }));
      for (const img of initial) {
        if (img.type === "video-product" || img.type === "video-model") continue;
        const updateImageStatus = (id: string, updates: Partial<GeneratedImage>) => {
          setState((s) => ({
            ...s,
            generatedImages: s.generatedImages.map((i) => i.id === id ? { ...i, ...updates } : i),
            weeklyLaunches: s.weeklyLaunches.map((w) => ({
              ...w, images: w.images.map((i) => (i.id === id ? { ...i, ...updates } : i)),
            })),
          }));
        };
        updateImageStatus(img.id, { status: "generating" });
        try {
          const { data, error } = await supabase.functions.invoke("generate-image", {
            body: { prompt: img.prompt, referenceImages: activeVariant.uploadedImages.slice(0, 3), engine: "gemini" },
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
    [activeVariant.uploadedImages]
  );

  const handleRegenerate = useCallback(
    async (id: string) => {
      let img: GeneratedImage | undefined;
      for (const w of state.weeklyLaunches) { img = w.images.find((i) => i.id === id); if (img) break; }
      if (!img) return;
      const updateImg = (updates: Partial<GeneratedImage>) => {
        setState((s) => ({
          ...s, weeklyLaunches: s.weeklyLaunches.map((w) => ({
            ...w, images: w.images.map((i) => (i.id === id ? { ...i, ...updates } : i)),
          })),
        }));
      };
      updateImg({ status: "generating" });
      try {
        const { data, error } = await supabase.functions.invoke("generate-image", {
          body: { prompt: img.prompt, referenceImages: activeVariant.uploadedImages.slice(0, 3), engine: "gemini" },
        });
        if (error) throw error;
        updateImg({ status: "done", imageUrl: data.imageUrl });
      } catch (err) {
        updateImg({ status: "error", error: "Falha na regeneração" });
      }
    },
    [state.weeklyLaunches, activeVariant.uploadedImages]
  );

  const handleAddWeek = useCallback(() => {
    const newId = crypto.randomUUID();
    const newLabel = `Semana ${state.weeklyLaunches.length + 1}`;
    setState((s) => ({
      ...s, weeklyLaunches: [...s.weeklyLaunches, { id: newId, label: newLabel, images: [] }],
      activeWeek: newId,
    }));
  }, [state.weeklyLaunches.length]);

  const canProceed =
    state.step === 0 ? !!activeVariant.garmentAnalysis
    : state.step === 1 ? !!state.selectedProfile
    : true;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            <h1 className="text-xl tracking-tight">Fashion AI Studio</h1>
          </div>
          <span className="text-xs text-muted-foreground">Gerador de Lookbook com IA</span>
        </div>
      </header>

      <nav className="border-b border-border">
        <div className="max-w-5xl mx-auto flex">
          {STEPS.map((s) => (
            <button
              key={s.id}
              onClick={() => { if (s.id < state.step) update("step", s.id); }}
              className={cn(
                "flex-1 py-3 text-xs font-medium text-center border-b-2 transition-colors",
                s.id === state.step ? "border-accent text-accent"
                : s.id < state.step ? "border-transparent text-foreground cursor-pointer hover:text-accent"
                : "border-transparent text-muted-foreground cursor-default"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {state.step === 0 && (
          <div className="space-y-6">
            <UploadStep
              images={activeVariant.uploadedImages}
              onImagesChange={(imgs) => updateVariant({ uploadedImages: imgs })}
              isAnalyzing={isAnalyzing}
              onAnalyze={handleAnalyze}
              analysisComplete={!!activeVariant.garmentAnalysis}
            />
            {activeVariant.garmentAnalysis && (
              <AnalysisCard
                analysis={activeVariant.garmentAnalysis}
                onUpdate={(a) => updateVariant({ garmentAnalysis: a })}
              />
            )}
          </div>
        )}

        {state.step === 1 && (
          <ModelProfileStep selectedProfile={state.selectedProfile} onProfileChange={(p) => update("selectedProfile", p)} />
        )}
        {state.step === 2 && (
          <StyleLibraryStep selectedPresets={state.selectedPresets} onPresetsChange={(p) => update("selectedPresets", p)} />
        )}
        {state.step === 3 && (
          <PromptReviewStep
            selectedPresets={state.selectedPresets} manualPrompt={state.manualPrompt}
            onManualPromptChange={(v) => update("manualPrompt", v)}
            garmentAnalysis={activeVariant.garmentAnalysis}
            onGenerate={handleGenerate} isGenerating={isGenerating}
          />
        )}
        {state.step === 4 && (
          <ResultsStep
            weeklyLaunches={state.weeklyLaunches} activeWeek={state.activeWeek}
            onActiveWeekChange={(id) => update("activeWeek", id)}
            onAddWeek={handleAddWeek} onRegenerate={handleRegenerate}
          />
        )}

        {state.step < 4 && (
          <div className="flex justify-between mt-8 pt-6 border-t border-border">
            <Button variant="ghost" onClick={() => update("step", state.step - 1)} disabled={state.step === 0}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            {state.step < 3 && (
              <Button onClick={() => update("step", state.step + 1)} disabled={!canProceed}>
                Próximo <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
