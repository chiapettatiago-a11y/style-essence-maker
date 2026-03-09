import React, { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GarmentAnalysis, GeneratedImage, GenerationRequest, ModelProfile, WeeklyLaunch, WizardState } from "@/types/fashion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, Home, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import monograma from "@/assets/monograma.png";
import AssetPanel from "@/components/studio/AssetPanel";
import PreviewPanel from "@/components/studio/PreviewPanel";
import ConfigPanel from "@/components/studio/ConfigPanel";

const ProductSwitcher = ({ currentName, currentId, navigate: nav, userId }: { currentName: string; currentId: string; navigate: (path: string) => void; userId?: string }) => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name").order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  if (!products || products.length <= 1) {
    return <span className="text-sm font-medium">{currentName}</span>;
  }

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DropdownMenu open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-sm font-medium gap-1 px-1 h-auto py-0.5">
          {currentName} <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {products.length > 4 && (
          <div className="px-2 py-1.5">
            <Input
              placeholder="Buscar projeto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 text-xs"
              autoFocus
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        )}
        <div className="max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground text-center">Nenhum projeto encontrado</div>
          ) : (
            filtered.map((p) => (
              <DropdownMenuItem
                key={p.id}
                className={cn(p.id === currentId && "bg-accent/15 text-accent")}
                onClick={() => { if (p.id !== currentId) nav(`/project/${p.id}`); }}
              >
                <span className="truncate">{p.name}</span>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const ProjectPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [state, setState] = useState<WizardState>({
    step: 0, uploadedImages: [], garmentAnalysis: null, selectedProfile: null,
    selectedPresets: {}, manualPrompt: "", generatedImages: [], weeklyLaunches: [], activeWeek: "",
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"upload" | "model" | "style" | "generate">("upload");

  // Load product data
  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ["product", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", projectId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!projectId,
  });

  const { data: weeks } = useQuery({
    queryKey: ["weeks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("weekly_launches").select("id, label, created_at").eq("product_id", projectId!).order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!projectId,
  });

  const { data: dbImages } = useQuery({
    queryKey: ["images", projectId],
    queryFn: async () => {
      if (!weeks || weeks.length === 0) return [];
      const weekIds = weeks.map((w) => w.id);
      const { data, error } = await supabase.from("generated_images").select("*").in("launch_id", weekIds).order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!weeks && weeks.length > 0,
  });

  // Initialize state from DB
  useEffect(() => {
    if (!product || loaded) return;
    const weeklyLaunches: WeeklyLaunch[] = (weeks || []).map((w) => ({
      id: w.id, label: w.label,
      images: (dbImages || []).filter((img) => img.launch_id === w.id).map((img) => ({
        id: img.id, type: img.type as GeneratedImage["type"], label: img.label,
        prompt: img.prompt, imageUrl: img.image_url || undefined,
        status: img.status as GeneratedImage["status"], error: img.error || undefined,
      })),
    }));

    setState({
      step: 0, uploadedImages: (product.uploaded_images as string[]) || [],
      garmentAnalysis: product.garment_analysis as unknown as GarmentAnalysis | null,
      selectedProfile: product.model_profile as unknown as ModelProfile | null,
      selectedPresets: (product.selected_presets as unknown as Record<string, string>) || {},
      manualPrompt: product.manual_prompt || "", generatedImages: [],
      weeklyLaunches, activeWeek: weeklyLaunches[0]?.id || "",
    });
    setLoaded(true);
  }, [product, weeks, dbImages, loaded]);

  const saveProduct = useCallback(async (updates: Partial<WizardState>) => {
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
  }, [projectId]);

  const update = <K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
    saveProduct({ [key]: value });
  };

  const handleAnalyze = useCallback(async () => {
    if (state.uploadedImages.length === 0) return;
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-garment", { body: { images: state.uploadedImages } });
      if (error) throw error;
      update("garmentAnalysis", data.analysis as GarmentAnalysis);
    } catch (err) {
      console.error("Analysis error:", err);
      update("garmentAnalysis", {
        type: "Vestido", fabric: "Jeans denim", color: "Azul médio",
        pattern: "Liso", construction: "Costura reforçada, botões frontais",
        details: "Botões metálicos, bordado dourado", style: "Casual chic",
        fullDescription: "", length: "Longo até o tornozelo", silhouette: "Evasê",
        hemline: "Barra reta", neckline: "Gola de camisa", sleeves: "Manga longa",
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [state.uploadedImages]);

  const handleGenerate = useCallback(async (requests: GenerationRequest[]) => {
    setIsGenerating(true);
    let activeWeekId = state.activeWeek;

    // Create a week if none exists
    if (!activeWeekId) {
      const { data, error } = await supabase.from("weekly_launches").insert({ product_id: projectId!, label: "Semana 1" }).select("id").single();
      if (error) { setIsGenerating(false); return; }
      activeWeekId = data.id;
      setState((s) => ({
        ...s, weeklyLaunches: [{ id: activeWeekId, label: "Semana 1", images: [] }], activeWeek: activeWeekId,
      }));
    }

    const initial: GeneratedImage[] = requests.map((r) => ({
      id: crypto.randomUUID(), type: r.type, label: r.label, prompt: r.prompt,
      status: r.type === "video-product" || r.type === "video-model" ? "done" : "pending",
    }));

    for (const img of initial) {
      await supabase.from("generated_images").insert({
        id: img.id, launch_id: activeWeekId, type: img.type, label: img.label, prompt: img.prompt, status: img.status,
      });
    }

    setState((s) => ({
      ...s, generatedImages: initial,
      weeklyLaunches: s.weeklyLaunches.map((w) => w.id === activeWeekId ? { ...w, images: [...w.images, ...initial] } : w),
    }));

    // Select the first image being generated
    const firstImage = initial.find((i) => i.type !== "video-product" && i.type !== "video-model");
    if (firstImage) setSelectedAssetId(firstImage.id);

    for (const img of initial) {
      if (img.type === "video-product" || img.type === "video-model") continue;

      const updateImageStatus = (id: string, updates: Partial<GeneratedImage>) => {
        setState((s) => ({
          ...s,
          weeklyLaunches: s.weeklyLaunches.map((w) => ({
            ...w, images: w.images.map((i) => (i.id === id ? { ...i, ...updates } : i)),
          })),
        }));
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
  }, [state.uploadedImages, state.activeWeek, projectId]);

  const handleRegenerate = useCallback(async (id: string) => {
    let img: GeneratedImage | undefined;
    for (const w of state.weeklyLaunches) { img = w.images.find((i) => i.id === id); if (img) break; }
    if (!img) return;

    const updateImg = (updates: Partial<GeneratedImage>) => {
      setState((s) => ({
        ...s, weeklyLaunches: s.weeklyLaunches.map((w) => ({
          ...w, images: w.images.map((i) => (i.id === id ? { ...i, ...updates } : i)),
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
  }, [state.weeklyLaunches, state.uploadedImages]);

  const handleUploadClick = useCallback(() => {
    setActiveSection("upload");
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*"; input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        Array.from(files).forEach((file) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            setState((s) => {
              const newImages = [...s.uploadedImages, ev.target?.result as string];
              saveProduct({ uploadedImages: newImages });
              return { ...s, uploadedImages: newImages };
            });
          };
          reader.readAsDataURL(file);
        });
      }
    };
    input.click();
  }, [saveProduct]);

  if (authLoading || productLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="border-b border-border px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate("/")}>
            <Home className="h-3.5 w-3.5" />
          </Button>
          <div className="flex items-center gap-2">
            <img src={monograma} alt="Logo" className="h-5" />
            <span className="text-muted-foreground text-xs">|</span>
            <ProductSwitcher currentName={product?.name || "Projeto"} currentId={projectId!} navigate={navigate} userId={user?.id} />
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground">Fashion AI Studio</span>
      </header>

      {/* 3-panel layout */}
      <div className="flex flex-1 min-h-0">
        <AssetPanel
          uploadedImages={state.uploadedImages}
          weeklyLaunches={state.weeklyLaunches}
          selectedAssetId={selectedAssetId}
          onSelectAsset={(id) => setSelectedAssetId(id)}
          onRemoveUploaded={(i) => {
            const newImages = state.uploadedImages.filter((_, idx) => idx !== i);
            update("uploadedImages", newImages);
          }}
          onUploadClick={handleUploadClick}
        />

        <PreviewPanel
          selectedAssetId={selectedAssetId}
          uploadedImages={state.uploadedImages}
          weeklyLaunches={state.weeklyLaunches}
          onRegenerate={handleRegenerate}
        />

        <ConfigPanel
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          uploadedImages={state.uploadedImages}
          onImagesChange={(imgs) => update("uploadedImages", imgs)}
          isAnalyzing={isAnalyzing}
          onAnalyze={handleAnalyze}
          garmentAnalysis={state.garmentAnalysis}
          onAnalysisUpdate={(a) => update("garmentAnalysis", a)}
          selectedProfile={state.selectedProfile}
          onProfileChange={(p) => update("selectedProfile", p)}
          selectedPresets={state.selectedPresets}
          onPresetsChange={(p) => update("selectedPresets", p)}
          manualPrompt={state.manualPrompt}
          onManualPromptChange={(v) => update("manualPrompt", v)}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
        />
      </div>
    </div>
  );
};

export default ProjectPage;
