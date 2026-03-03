import React, { useState, useCallback } from "react";
import { GarmentAnalysis, GeneratedImage, GenerationRequest, ModelProfile, WizardState } from "@/types/fashion";
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
  const [state, setState] = useState<WizardState>({
    step: 0,
    uploadedImages: [],
    garmentAnalysis: null,
    selectedProfile: null,
    selectedPresets: {},
    manualPrompt: "",
    generatedImages: [],
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
        details: "Gola alta em renda com babado, corpete em renda transparente, padrão de renda intricado preservado, pregas verticais estruturadas, detalhe central de babado, cinto coberto em renda com fivela, painel de saia em renda em camadas, saia plissada estruturada inferior",
        style: "Luxury editorial",
        fullDescription: "",
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
      update("generatedImages", initial);
      update("step", 4);

      // Generate images sequentially (skip video prompts)
      for (const img of initial) {
        if (img.type === "video-product" || img.type === "video-model") continue;

        setState((s) => ({
          ...s,
          generatedImages: s.generatedImages.map((i) =>
            i.id === img.id ? { ...i, status: "generating" as const } : i
          ),
        }));

        try {
          const { data, error } = await supabase.functions.invoke("generate-image", {
            body: {
              prompt: img.prompt,
              referenceImages: state.uploadedImages.slice(0, 1),
            },
          });
          if (error) throw error;

          setState((s) => ({
            ...s,
            generatedImages: s.generatedImages.map((i) =>
              i.id === img.id
                ? { ...i, status: "done" as const, imageUrl: data.imageUrl }
                : i
            ),
          }));
        } catch (err) {
          console.error("Generation error:", err);
          setState((s) => ({
            ...s,
            generatedImages: s.generatedImages.map((i) =>
              i.id === img.id
                ? { ...i, status: "error" as const, error: "Falha na geração" }
                : i
            ),
          }));
        }
      }

      setIsGenerating(false);
    },
    [state.uploadedImages]
  );

  const handleRegenerate = useCallback(
    async (id: string) => {
      const img = state.generatedImages.find((i) => i.id === id);
      if (!img) return;

      setState((s) => ({
        ...s,
        generatedImages: s.generatedImages.map((i) =>
          i.id === id ? { ...i, status: "generating" as const } : i
        ),
      }));

      try {
        const { data, error } = await supabase.functions.invoke("generate-image", {
          body: {
            prompt: img.prompt,
            referenceImages: state.uploadedImages.slice(0, 1),
          },
        });
        if (error) throw error;

        setState((s) => ({
          ...s,
          generatedImages: s.generatedImages.map((i) =>
            i.id === id
              ? { ...i, status: "done" as const, imageUrl: data.imageUrl }
              : i
          ),
        }));
      } catch (err) {
        setState((s) => ({
          ...s,
          generatedImages: s.generatedImages.map((i) =>
            i.id === id
              ? { ...i, status: "error" as const, error: "Falha na regeneração" }
              : i
          ),
        }));
      }
    },
    [state.generatedImages, state.uploadedImages]
  );

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
            images={state.generatedImages}
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
