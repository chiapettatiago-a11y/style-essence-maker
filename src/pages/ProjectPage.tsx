import React, { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GarmentAnalysis, GeneratedImage, GenerationRequest, ModelProfile, WeeklyLaunch, WizardState, ProductVariant } from "@/types/fashion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, Home, ChevronDown, Plus, Palette } from "lucide-react";
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
    step: 0, variants: [], activeVariantId: "",
    uploadedImages: [], garmentAnalysis: null, selectedProfile: null,
    selectedPresets: {}, manualPrompt: "", generatedImages: [], weeklyLaunches: [], activeWeek: "",
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"upload" | "model" | "style" | "generate">("upload");
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [editingVariantName, setEditingVariantName] = useState("");

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

  // Load variants
  const { data: dbVariants } = useQuery({
    queryKey: ["variants", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_variants").select("*").eq("product_id", projectId!).order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!projectId,
  });

  const { data: weeks } = useQuery({
    queryKey: ["weeks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("weekly_launches").select("id, label, created_at, variant_id").eq("product_id", projectId!).order("created_at", { ascending: true });
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

    const variants: ProductVariant[] = (dbVariants || []).map(v => ({
      id: v.id,
      productId: v.product_id,
      colorName: v.color_name,
      uploadedImages: (v.uploaded_images as string[]) || [],
      garmentAnalysis: v.garment_analysis as unknown as GarmentAnalysis | null,
      sortOrder: v.sort_order,
    }));

    const weeklyLaunches: WeeklyLaunch[] = (weeks || []).map((w) => ({
      id: w.id, label: w.label, variantId: w.variant_id || undefined,
      images: (dbImages || []).filter((img) => img.launch_id === w.id).map((img) => ({
        id: img.id, type: img.type as GeneratedImage["type"], label: img.label,
        prompt: img.prompt, imageUrl: img.image_url || undefined,
        status: img.status as GeneratedImage["status"], error: img.error || undefined,
      })),
    }));

    const activeVariant = variants[0];
    setState({
      step: 0,
      variants,
      activeVariantId: activeVariant?.id || "",
      uploadedImages: activeVariant?.uploadedImages || [],
      garmentAnalysis: activeVariant?.garmentAnalysis || null,
      selectedProfile: product.model_profile as unknown as ModelProfile | null,
      selectedPresets: (product.selected_presets as unknown as Record<string, string>) || {},
      manualPrompt: product.manual_prompt || "",
      generatedImages: [],
      weeklyLaunches,
      activeWeek: weeklyLaunches[0]?.id || "",
    });
    setLoaded(true);
  }, [product, weeks, dbImages, dbVariants, loaded]);

  // Derived active variant
  const activeVariant = state.variants.find(v => v.id === state.activeVariantId) || state.variants[0];

  // Filter weekly launches for active variant
  const variantWeeklyLaunches = state.weeklyLaunches.filter(w => !w.variantId || w.variantId === state.activeVariantId);

  const saveProduct = useCallback(async (updates: Partial<WizardState>) => {
    if (!projectId) return;
    const payload: Record<string, any> = {};
    if (updates.selectedProfile !== undefined) payload.model_profile = updates.selectedProfile;
    if (updates.selectedPresets !== undefined) payload.selected_presets = updates.selectedPresets;
    if (updates.manualPrompt !== undefined) payload.manual_prompt = updates.manualPrompt;
    if (Object.keys(payload).length > 0) {
      await supabase.from("products").update(payload).eq("id", projectId);
    }
  }, [projectId]);

  const saveVariant = useCallback(async (variantId: string, updates: Partial<ProductVariant>) => {
    const payload: Record<string, any> = {};
    if (updates.uploadedImages !== undefined) payload.uploaded_images = updates.uploadedImages;
    if (updates.garmentAnalysis !== undefined) payload.garment_analysis = updates.garmentAnalysis;
    if (updates.colorName !== undefined) payload.color_name = updates.colorName;
    if (Object.keys(payload).length > 0) {
      await supabase.from("product_variants").update(payload).eq("id", variantId);
    }
  }, []);

  const update = <K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
    if (key !== "uploadedImages" && key !== "garmentAnalysis" && key !== "variants" && key !== "activeVariantId") {
      saveProduct({ [key]: value });
    }
  };

  const updateActiveVariant = (updates: Partial<ProductVariant>) => {
    setState(s => {
      const newVariants = s.variants.map(v => v.id === s.activeVariantId ? { ...v, ...updates } : v);
      return {
        ...s,
        variants: newVariants,
        ...(updates.uploadedImages !== undefined ? { uploadedImages: updates.uploadedImages } : {}),
        ...(updates.garmentAnalysis !== undefined ? { garmentAnalysis: updates.garmentAnalysis ?? null } : {}),
      };
    });
    if (activeVariant) {
      saveVariant(activeVariant.id, updates);
    }
  };

  const switchVariant = (variantId: string) => {
    const variant = state.variants.find(v => v.id === variantId);
    if (!variant) return;
    setState(s => ({
      ...s,
      activeVariantId: variantId,
      uploadedImages: variant.uploadedImages,
      garmentAnalysis: variant.garmentAnalysis,
    }));
  };

  const addVariant = async () => {
    if (!projectId) return;
    const sortOrder = state.variants.length;
    const { data, error } = await supabase.from("product_variants").insert({
      product_id: projectId,
      color_name: `Cor ${sortOrder + 1}`,
      sort_order: sortOrder,
    }).select("*").single();
    if (error) { console.error(error); return; }
    const newVariant: ProductVariant = {
      id: data.id, productId: data.product_id, colorName: data.color_name,
      uploadedImages: [], garmentAnalysis: null, sortOrder: data.sort_order,
    };
    setState(s => ({
      ...s,
      variants: [...s.variants, newVariant],
      activeVariantId: newVariant.id,
      uploadedImages: [],
      garmentAnalysis: null,
    }));
    setActiveSection("upload");
  };

  const deleteVariant = async (variantId: string) => {
    if (state.variants.length <= 1) return;
    await supabase.from("product_variants").delete().eq("id", variantId);
    setState(s => {
      const newVariants = s.variants.filter(v => v.id !== variantId);
      const newActive = s.activeVariantId === variantId ? newVariants[0] : s.variants.find(v => v.id === s.activeVariantId);
      return {
        ...s,
        variants: newVariants,
        activeVariantId: newActive?.id || newVariants[0]?.id || "",
        uploadedImages: newActive?.uploadedImages || [],
        garmentAnalysis: newActive?.garmentAnalysis || null,
        weeklyLaunches: s.weeklyLaunches.filter(w => w.variantId !== variantId),
      };
    });
  };

  const handleAnalyze = useCallback(async () => {
    if (!activeVariant || activeVariant.uploadedImages.length === 0) return;
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-garment", { body: { images: activeVariant.uploadedImages } });
      if (error) throw error;
      updateActiveVariant({ garmentAnalysis: data.analysis as GarmentAnalysis });
    } catch (err) {
      console.error("Analysis error:", err);
      updateActiveVariant({
        garmentAnalysis: {
          type: "Vestido", fabric: "Jeans denim", color: "Azul médio",
          pattern: "Liso", construction: "Costura reforçada, botões frontais",
          details: "Botões metálicos, bordado dourado", style: "Casual chic",
          fullDescription: "", length: "Longo até o tornozelo", silhouette: "Evasê",
          hemline: "Barra reta", neckline: "Gola de camisa", sleeves: "Manga longa",
        },
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [activeVariant]);

  const handleGenerate = useCallback(async (requests: GenerationRequest[]) => {
    if (!activeVariant) return;
    setIsGenerating(true);
    let activeWeekId = variantWeeklyLaunches.find(w => w.variantId === state.activeVariantId)?.id;

    if (!activeWeekId) {
      const { data, error } = await supabase.from("weekly_launches").insert({
        product_id: projectId!, label: "Semana 1", variant_id: state.activeVariantId,
      }).select("id").single();
      if (error) { setIsGenerating(false); return; }
      activeWeekId = data.id;
      setState((s) => ({
        ...s,
        weeklyLaunches: [...s.weeklyLaunches, { id: activeWeekId!, label: "Semana 1", variantId: s.activeVariantId, images: [] }],
        activeWeek: activeWeekId!,
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
          body: { prompt: img.prompt, referenceImages: activeVariant.uploadedImages.slice(0, 3) },
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
  }, [activeVariant, state.activeVariantId, variantWeeklyLaunches, projectId]);

  const handleRegenerate = useCallback(async (id: string) => {
    let img: GeneratedImage | undefined;
    for (const w of state.weeklyLaunches) { img = w.images.find((i) => i.id === id); if (img) break; }
    if (!img || !activeVariant) return;

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
        body: { prompt: img.prompt, referenceImages: activeVariant.uploadedImages.slice(0, 3) },
      });
      if (error) throw error;
      updateImg({ status: "done", imageUrl: data.imageUrl });
    } catch (err) {
      updateImg({ status: "error", error: "Falha na regeneração" });
    }
  }, [state.weeklyLaunches, activeVariant]);

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
              const variant = s.variants.find(v => v.id === s.activeVariantId);
              if (!variant) return s;
              const newImages = [...variant.uploadedImages, ev.target?.result as string];
              saveVariant(variant.id, { uploadedImages: newImages });
              return {
                ...s,
                uploadedImages: newImages,
                variants: s.variants.map(v => v.id === s.activeVariantId ? { ...v, uploadedImages: newImages } : v),
              };
            });
          };
          reader.readAsDataURL(file);
        });
      }
    };
    input.click();
  }, [saveVariant]);

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

      {/* Variant selector bar */}
      {state.variants.length > 0 && (
        <div className="border-b border-border px-4 py-1.5 flex items-center gap-1.5 shrink-0 bg-muted/30">
          <Palette className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground mr-1">Variantes:</span>
          {state.variants.map((v) => (
            <div key={v.id} className="flex items-center">
              {editingVariantId === v.id ? (
                <Input
                  value={editingVariantName}
                  onChange={(e) => setEditingVariantName(e.target.value)}
                  onBlur={() => {
                    if (editingVariantName.trim()) {
                      updateActiveVariant({ colorName: editingVariantName.trim() });
                      setState(s => ({
                        ...s,
                        variants: s.variants.map(vv => vv.id === v.id ? { ...vv, colorName: editingVariantName.trim() } : vv),
                      }));
                      saveVariant(v.id, { colorName: editingVariantName.trim() });
                    }
                    setEditingVariantId(null);
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  className="h-5 text-[10px] w-20 px-1"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => switchVariant(v.id)}
                  onDoubleClick={() => { setEditingVariantId(v.id); setEditingVariantName(v.colorName); }}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full transition-all",
                    v.id === state.activeVariantId
                      ? "bg-accent text-accent-foreground font-medium"
                      : "bg-muted text-muted-foreground hover:bg-accent/20"
                  )}
                >
                  {v.colorName}
                  {v.uploadedImages.length > 0 && (
                    <span className="ml-1 opacity-60">({v.uploadedImages.length})</span>
                  )}
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addVariant}
            className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-accent/20 transition-all flex items-center gap-0.5"
          >
            <Plus className="h-2.5 w-2.5" /> Nova Cor
          </button>
          {state.variants.length > 1 && activeVariant && (
            <button
              onClick={() => { if (confirm(`Excluir variante "${activeVariant.colorName}"?`)) deleteVariant(activeVariant.id); }}
              className="text-[10px] px-1.5 py-0.5 rounded-full text-destructive hover:bg-destructive/10 transition-all ml-auto"
            >
              Excluir
            </button>
          )}
        </div>
      )}

      {/* 3-panel layout */}
      <div className="flex flex-1 min-h-0">
        <AssetPanel
          uploadedImages={activeVariant?.uploadedImages || []}
          weeklyLaunches={variantWeeklyLaunches}
          selectedAssetId={selectedAssetId}
          onSelectAsset={(id) => setSelectedAssetId(id)}
          onRemoveUploaded={(i) => {
            const newImages = (activeVariant?.uploadedImages || []).filter((_, idx) => idx !== i);
            updateActiveVariant({ uploadedImages: newImages });
          }}
          onUploadClick={handleUploadClick}
        />

        <PreviewPanel
          selectedAssetId={selectedAssetId}
          uploadedImages={activeVariant?.uploadedImages || []}
          weeklyLaunches={variantWeeklyLaunches}
          onRegenerate={handleRegenerate}
        />

        <ConfigPanel
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          uploadedImages={activeVariant?.uploadedImages || []}
          onImagesChange={(imgs) => updateActiveVariant({ uploadedImages: imgs })}
          isAnalyzing={isAnalyzing}
          onAnalyze={handleAnalyze}
          garmentAnalysis={activeVariant?.garmentAnalysis || null}
          onAnalysisUpdate={(a) => updateActiveVariant({ garmentAnalysis: a })}
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
