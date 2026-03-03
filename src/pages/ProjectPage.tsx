import React, { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GarmentAnalysis, GeneratedImage, GenerationRequest, ModelProfile, WeeklyLaunch, WizardState } from "@/types/fashion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, Sparkles, Loader2, Home } from "lucide-react";
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

const ProjectPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [state, setState] = useState<WizardState>({
    step: 0,
    uploadedImages: [],
    garmentAnalysis: null,
    selectedProfile: null,
    selectedPresets: {},
    manualPrompt: "",
    generatedImages: [],
    weeklyLaunches: [],
    activeWeek: "",
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load product data
  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ["product", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", projectId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!projectId,
  });

  // Load weeks
  const { data: weeks } = useQuery({
    queryKey: ["weeks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_launches")
        .select("id, label, created_at")
        .eq("product_id", projectId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!projectId,
  });

  // Load images for all weeks
  const { data: dbImages } = useQuery({
    queryKey: ["images", projectId],
    queryFn: async () => {
      if (!weeks || weeks.length === 0) return [];
      const weekIds = weeks.map((w) => w.id);
      const { data, error } = await supabase
        .from("generated_images")
        .select("*")
        .in("launch_id", weekIds)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!weeks && weeks.length > 0,
  });

  // Initialize state from DB
  useEffect(() => {
    if (!product || loaded) return;

    const weeklyLaunches: WeeklyLaunch[] = (weeks || []).map((w) => ({
      id: w.id,
      label: w.label,
      images: (dbImages || [])
        .filter((img) => img.launch_id === w.id)
        .map((img) => ({
          id: img.id,
          type: img.type as GeneratedImage["type"],
          label: img.label,
          prompt: img.prompt,
          imageUrl: img.image_url || undefined,
          status: img.status as GeneratedImage["status"],
          error: img.error || undefined,
        })),
    }));

    setState({
      step: 0,
      uploadedImages: (product.uploaded_images as string[]) || [],
      garmentAnalysis: product.garment_analysis as unknown as GarmentAnalysis | null,
      selectedProfile: product.model_profile as unknown as ModelProfile | null,
      selectedPresets: (product.selected_presets as unknown as Record<string, string>) || {},
      manualPrompt: product.manual_prompt || "",
      generatedImages: [],
      weeklyLaunches,
      activeWeek: weeklyLaunches[0]?.id || "",
    });
    setLoaded(true);
  }, [product, weeks, dbImages, loaded]);

  // Save product data to DB on changes (debounced)
  const saveProduct = useCallback(
    async (updates: Partial<WizardState>) => {
      if (!projectId) return;
      const payload: Record<string, any> = {};
      if (updates.uploadedImages !== undefined) payload.uploaded_images = updates.uploadedImages;
      if (updates.garmentAnalysis !== undefined) payload.garment_analysis = updates.garmentAnalysis;
      if (updates.selectedProfile !== undefined) payload.model_profile = updates.selectedProfile;
      if (updates.selectedPresets !== undefined) payload.selected_presets = updates.selectedPresets;
      if (updates.manualPrompt !== undefined) payload.manual_prompt = updates.manualPrompt;
      if (Object.keys(payload).length > 0) {
        await supabase.from("products").update(payload).eq("id", projectId);
      }
    },
    [projectId]
  );

  const update = <K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
    saveProduct({ [key]: value });
  };

  const handleAnalyze = useCallback(async () => {
    if (state.uploadedImages.length === 0) return;
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-garment", {
        body: { images: state.uploadedImages },
      });
      if (error) throw error;
      const analysis = data.analysis as GarmentAnalysis;
      update("garmentAnalysis", analysis);
    } catch (err) {
      console.error("Analysis error:", err);
      const fallback: GarmentAnalysis = {
        type: "Vestido", fabric: "Renda e plissado", color: "Champagne",
        pattern: "Renda floral intricada", construction: "Corpete em renda transparente, saia plissada estruturada",
        details: "Gola alta em renda com babado", style: "Luxury editorial", fullDescription: "",
      };
      update("garmentAnalysis", fallback);
    } finally {
      setIsAnalyzing(false);
    }
  }, [state.uploadedImages]);

  const handleGenerate = useCallback(
    async (requests: GenerationRequest[]) => {
      setIsGenerating(true);
      const activeWeekId = state.activeWeek;

      const initial: GeneratedImage[] = requests.map((r) => ({
        id: crypto.randomUUID(),
        type: r.type,
        label: r.label,
        prompt: r.prompt,
        status: r.type === "video-product" || r.type === "video-model" ? "done" : "pending",
      }));

      // Save to DB
      for (const img of initial) {
        await supabase.from("generated_images").insert({
          id: img.id,
          launch_id: activeWeekId,
          type: img.type,
          label: img.label,
          prompt: img.prompt,
          status: img.status,
        });
      }

      setState((s) => ({
        ...s,
        step: 4,
        generatedImages: initial,
        weeklyLaunches: s.weeklyLaunches.map((w) =>
          w.id === activeWeekId ? { ...w, images: [...w.images, ...initial] } : w
        ),
      }));

      for (const img of initial) {
        if (img.type === "video-product" || img.type === "video-model") continue;

        const updateImageStatus = (id: string, updates: Partial<GeneratedImage>) => {
          setState((s) => ({
            ...s,
            weeklyLaunches: s.weeklyLaunches.map((w) => ({
              ...w,
              images: w.images.map((i) => (i.id === id ? { ...i, ...updates } : i)),
            })),
          }));
          // Update DB
          const dbUpdate: Record<string, any> = {};
          if (updates.status) dbUpdate.status = updates.status;
          if (updates.imageUrl) dbUpdate.image_url = updates.imageUrl;
          if (updates.error) dbUpdate.error = updates.error;
          supabase.from("generated_images").update(dbUpdate).eq("id", id).then();
        };

        updateImageStatus(img.id, { status: "generating" });

        try {
          const { data, error } = await supabase.functions.invoke("generate-image", {
            body: { prompt: img.prompt, referenceImages: state.uploadedImages.slice(0, 1) },
          });
          if (error) throw error;
          updateImageStatus(img.id, { status: "done", imageUrl: data.imageUrl });
        } catch (err) {
          console.error("Generation error:", err);
          updateImageStatus(img.id, { status: "error", error: "Falha na geração" });
        }
      }

      setIsGenerating(false);
      queryClient.invalidateQueries({ queryKey: ["images", projectId] });
    },
    [state.uploadedImages, state.activeWeek, projectId]
  );

  const handleRegenerate = useCallback(
    async (id: string) => {
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
        const dbUpdate: Record<string, any> = {};
        if (updates.status) dbUpdate.status = updates.status;
        if (updates.imageUrl) dbUpdate.image_url = updates.imageUrl;
        if (updates.error) dbUpdate.error = updates.error;
        supabase.from("generated_images").update(dbUpdate).eq("id", id).then();
      };

      updateImg({ status: "generating" });

      try {
        const { data, error } = await supabase.functions.invoke("generate-image", {
          body: { prompt: img.prompt, referenceImages: state.uploadedImages.slice(0, 1) },
        });
        if (error) throw error;
        updateImg({ status: "done", imageUrl: data.imageUrl });
      } catch (err) {
        updateImg({ status: "error", error: "Falha na regeneração" });
      }
    },
    [state.weeklyLaunches, state.uploadedImages]
  );

  const handleAddWeek = useCallback(async () => {
    const newLabel = `Semana ${state.weeklyLaunches.length + 1}`;
    const { data, error } = await supabase
      .from("weekly_launches")
      .insert({ product_id: projectId!, label: newLabel })
      .select("id")
      .single();
    if (error) return;
    const newId = data.id;
    setState((s) => ({
      ...s,
      weeklyLaunches: [...s.weeklyLaunches, { id: newId, label: newLabel, images: [] }],
      activeWeek: newId,
    }));
  }, [state.weeklyLaunches.length, projectId]);

  if (authLoading || productLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const canProceed =
    state.step === 0 ? !!state.garmentAnalysis
    : state.step === 1 ? !!state.selectedProfile
    : true;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
              <Home className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              <h1 className="text-xl tracking-tight">{product?.name || "Projeto"}</h1>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">Fashion AI Studio</span>
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
              images={state.uploadedImages}
              onImagesChange={(imgs) => update("uploadedImages", imgs)}
              isAnalyzing={isAnalyzing}
              onAnalyze={handleAnalyze}
              analysisComplete={!!state.garmentAnalysis}
            />
            {state.garmentAnalysis && (
              <AnalysisCard analysis={state.garmentAnalysis} onUpdate={(a) => update("garmentAnalysis", a)} />
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

export default ProjectPage;
