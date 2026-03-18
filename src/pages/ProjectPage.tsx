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
import UploadSection from "@/components/studio/UploadSection";
import ModelGallery from "@/components/studio/ModelGallery";
import StyleSection from "@/components/studio/StyleSection";
import GenerateSection from "@/components/studio/GenerateSection";
import ResultsGrid from "@/components/studio/ResultsGrid";
import { GalleryModel } from "@/data/model-gallery";

const ANGLE_BY_TYPE: Record<GenerationRequest["type"], string> = {
  "lookbook-front": "front_view",
  "lookbook-back": "back_view",
  "lookbook-left": "left_side",
  "lookbook-three-quarter": "right_side",
  "close-up": "close_tr",
  "video-product": "video_product",
  "video-model": "video_model",
};

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

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

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
            <Input placeholder="Buscar projeto..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 text-xs" autoFocus onKeyDown={(e) => e.stopPropagation()} />
          </div>
        )}
        <div className="max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground text-center">Nenhum projeto encontrado</div>
          ) : (
            filtered.map((p) => (
              <DropdownMenuItem key={p.id} className={cn(p.id === currentId && "bg-accent/15 text-accent")} onClick={() => { if (p.id !== currentId) nav(`/project/${p.id}`); }}>
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
    step: 0,
    variants: [],
    activeVariantId: "",
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
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [editingVariantName, setEditingVariantName] = useState("");

  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ["product", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", projectId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!projectId,
  });

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
      const { data, error } = await supabase.from("weekly_launches").select("*").eq("product_id", projectId!).order("created_at", { ascending: true });
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

  useEffect(() => {
    if (!product || loaded) return;

    const variants: ProductVariant[] = (dbVariants || []).map(v => ({
      id: v.id,
      productId: v.product_id,
      colorName: v.color_name,
      uploadedImages: (v.uploaded_images as string[]) || [],
      garmentAnalysis: v.garment_analysis as unknown as GarmentAnalysis | null,
      sortOrder: v.sort_order,
      garmentType: v.garment_type,
      garmentLength: v.garment_length,
      garmentLengthCm: v.garment_length_cm,
      hemBelowKneeCm: v.hem_below_knee_cm,
      waistPositionCm: v.waist_position_cm,
      sleeveLengthCm: v.sleeve_length_cm,
      sleeveType: v.sleeve_type,
      shoulderWidthCm: v.shoulder_width_cm,
      proportionJson: v.proportion_json as Record<string, unknown> | null,
      analysisRaw: v.analysis_raw,
    }));

    const weeklyLaunches: WeeklyLaunch[] = (weeks || []).map((w) => ({
      id: w.id,
      label: w.label,
      variantId: w.variant_id || undefined,
      mannequinHeightCm: w.mannequin_height_cm,
      mannequinBustCm: w.mannequin_bust_cm,
      mannequinWaistCm: w.mannequin_waist_cm,
      mannequinHipCm: w.mannequin_hip_cm,
      mannequinTorsoCm: w.mannequin_torso_cm,
      mannequinArmCm: w.mannequin_arm_cm,
      referencePhotos: (w.reference_photos as string[]) || [],
      images: (dbImages || []).filter((img) => img.launch_id === w.id).map((img) => ({
        id: img.id,
        type: img.type as GeneratedImage["type"],
        label: img.label,
        prompt: img.prompt,
        promptUsed: img.prompt_used || undefined,
        imageUrl: img.preview_url || img.original_url || img.image_url || undefined,
        originalUrl: img.original_url || undefined,
        previewUrl: img.preview_url || undefined,
        photoAngle: img.photo_angle || undefined,
        generationMs: img.generation_ms || undefined,
        modelUsed: img.model_used || undefined,
        attemptNumber: img.attempt_number || undefined,
        status: img.status as GeneratedImage["status"],
        error: img.error || undefined,
      })),
    }));

    const activeVariant = variants[0];
    setState({
      step: 0,
      variants,
      activeVariantId: activeVariant?.id || "",
      uploadedImages: activeVariant?.uploadedImages || [],
      garmentAnalysis: activeVariant?.garmentAnalysis || null,
      selectedProfile: product.model_profile as ModelProfile | null,
      selectedPresets: (product.selected_presets as Record<string, string>) || {},
      manualPrompt: product.manual_prompt || "",
      generatedImages: [],
      weeklyLaunches,
      activeWeek: weeklyLaunches[0]?.id || "",
    });
    setLoaded(true);
  }, [product, weeks, dbImages, dbVariants, loaded]);

  useEffect(() => {
    if (!projectId || !user) return;

    const channel = supabase
      .channel(`generated-images-${projectId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "generated_images" }, (payload) => {
        const row = payload.new as {
          id: string;
          status: GeneratedImage["status"];
          error: string | null;
          image_url: string | null;
          original_url: string | null;
          preview_url: string | null;
          model_used: string | null;
          generation_ms: number | null;
          attempt_number: number | null;
          prompt_used: string | null;
          photo_angle: string | null;
        };

        setState((s) => ({
          ...s,
          weeklyLaunches: s.weeklyLaunches.map((w) => ({
            ...w,
            images: w.images.map((i) => i.id !== row.id ? i : {
              ...i,
              status: row.status,
              error: row.error || undefined,
              imageUrl: row.preview_url || row.original_url || row.image_url || i.imageUrl,
              originalUrl: row.original_url || i.originalUrl,
              previewUrl: row.preview_url || i.previewUrl,
              modelUsed: row.model_used || i.modelUsed,
              generationMs: row.generation_ms || i.generationMs,
              attemptNumber: row.attempt_number || i.attemptNumber,
              promptUsed: row.prompt_used || i.promptUsed,
              photoAngle: row.photo_angle || i.photoAngle,
            }),
          })),
        }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, user]);

  const activeVariant = state.variants.find(v => v.id === state.activeVariantId) || state.variants[0];
  const variantWeeklyLaunches = state.weeklyLaunches.filter(w => !w.variantId || w.variantId === state.activeVariantId);

  const saveProduct = useCallback(async (updates: Partial<WizardState>) => {
    if (!projectId) return;
    const payload: Record<string, unknown> = {};
    if (updates.selectedProfile !== undefined) payload.model_profile = updates.selectedProfile;
    if (updates.selectedPresets !== undefined) payload.selected_presets = updates.selectedPresets;
    if (updates.manualPrompt !== undefined) payload.manual_prompt = updates.manualPrompt;
    if (Object.keys(payload).length > 0) {
      await supabase.from("products").update(payload).eq("id", projectId);
    }
  }, [projectId]);

  const saveVariant = useCallback(async (variantId: string, updates: Partial<ProductVariant>) => {
    const payload: Record<string, unknown> = {};

    if (updates.uploadedImages !== undefined) payload.uploaded_images = updates.uploadedImages;
    if (updates.garmentAnalysis !== undefined) payload.garment_analysis = updates.garmentAnalysis;
    if (updates.colorName !== undefined) payload.color_name = updates.colorName;
    if (updates.garmentType !== undefined) payload.garment_type = updates.garmentType;
    if (updates.garmentLength !== undefined) payload.garment_length = updates.garmentLength;
    if (updates.garmentLengthCm !== undefined) payload.garment_length_cm = updates.garmentLengthCm;
    if (updates.hemBelowKneeCm !== undefined) payload.hem_below_knee_cm = updates.hemBelowKneeCm;
    if (updates.waistPositionCm !== undefined) payload.waist_position_cm = updates.waistPositionCm;
    if (updates.sleeveLengthCm !== undefined) payload.sleeve_length_cm = updates.sleeveLengthCm;
    if (updates.sleeveType !== undefined) payload.sleeve_type = updates.sleeveType;
    if (updates.shoulderWidthCm !== undefined) payload.shoulder_width_cm = updates.shoulderWidthCm;
    if (updates.proportionJson !== undefined) payload.proportion_json = updates.proportionJson;
    if (updates.analysisRaw !== undefined) payload.analysis_raw = updates.analysisRaw;

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
    if (activeVariant) saveVariant(activeVariant.id, updates);
  };

  const switchVariant = (variantId: string) => {
    const variant = state.variants.find(v => v.id === variantId);
    if (!variant) return;
    setState(s => ({ ...s, activeVariantId: variantId, uploadedImages: variant.uploadedImages, garmentAnalysis: variant.garmentAnalysis }));
  };

  const addVariant = async () => {
    if (!projectId) return;
    const sortOrder = state.variants.length;
    const { data, error } = await supabase.from("product_variants").insert({ product_id: projectId, color_name: `Cor ${sortOrder + 1}`, sort_order: sortOrder }).select("*").single();
    if (error) { console.error(error); return; }
    const newVariant: ProductVariant = {
      id: data.id,
      productId: data.product_id,
      colorName: data.color_name,
      uploadedImages: [],
      garmentAnalysis: null,
      sortOrder: data.sort_order,
    };
    setState(s => ({ ...s, variants: [...s.variants, newVariant], activeVariantId: newVariant.id, uploadedImages: [], garmentAnalysis: null }));
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
      const mannequin = {
        height_cm: product?.mannequin_height_cm || null,
        bust_cm: product?.mannequin_bust_cm || null,
        waist_cm: product?.mannequin_waist_cm || null,
        hip_cm: product?.mannequin_hip_cm || null,
        torso_cm: product?.mannequin_torso_cm || null,
        arm_cm: product?.mannequin_arm_cm || null,
      };

      const { data, error } = await supabase.functions.invoke("analyze-garment", {
        body: { images: activeVariant.uploadedImages, mannequin },
      });
      if (error) throw error;

      const analysis = data.analysis as GarmentAnalysis;
      const proportions = (data.proportions || {}) as Record<string, unknown>;

      updateActiveVariant({
        garmentAnalysis: analysis,
        garmentType: analysis.type || null,
        garmentLength: (proportions.garment_length as string) || analysis.length || null,
        garmentLengthCm: (proportions.garment_length_cm as number) || null,
        hemBelowKneeCm: (proportions.hem_below_knee_cm as number) || null,
        waistPositionCm: (proportions.waist_position_cm as number) || null,
        sleeveLengthCm: (proportions.sleeve_length_cm as number) || null,
        sleeveType: analysis.sleeves || null,
        shoulderWidthCm: (proportions.shoulder_width_cm as number) || null,
        proportionJson: proportions,
        analysisRaw: data.raw || null,
      });
    } catch (err) {
      console.error("Analysis error:", err);
      updateActiveVariant({
        garmentAnalysis: {
          type: "Vestido",
          fabric: "Jeans denim",
          color: "Azul médio",
          pattern: "Liso",
          construction: "Costura reforçada, botões frontais",
          details: "Botões metálicos, bordado dourado",
          style: "Casual chic",
          fullDescription: "",
          length: "Longo até o tornozelo",
          silhouette: "Evasê",
          hemline: "Barra reta",
          neckline: "Gola de camisa",
          sleeves: "Manga longa",
        },
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [activeVariant, product]);

  const handleSelectModel = useCallback((model: GalleryModel) => {
    const profile: ModelProfile = {
      id: model.id,
      name: model.name,
      height: model.height,
      bust: model.bust,
      waist: model.waist,
      hip: model.hip,
      skinTone: model.skinTone,
      hairType: model.hairType,
      hairColor: model.hairColor,
      generalStyle: model.generalStyle,
      promptSeed: model.promptBlockEN,
    };
    update("selectedProfile", profile);
  }, []);

  const handleGenerate = useCallback(async (requests: GenerationRequest[]) => {
    if (!activeVariant || !projectId) return;

    setIsGenerating(true);
    let activeWeekId = variantWeeklyLaunches.find(w => w.variantId === state.activeVariantId)?.id;

    if (!activeWeekId) {
      const { data, error } = await supabase.from("weekly_launches").insert({
        product_id: projectId,
        label: `Semana ${variantWeeklyLaunches.length + 1}`,
        variant_id: state.activeVariantId,
        mannequin_height_cm: product?.mannequin_height_cm || null,
        mannequin_bust_cm: product?.mannequin_bust_cm || null,
        mannequin_waist_cm: product?.mannequin_waist_cm || null,
        mannequin_hip_cm: product?.mannequin_hip_cm || null,
        mannequin_torso_cm: product?.mannequin_torso_cm || null,
        mannequin_arm_cm: product?.mannequin_arm_cm || null,
        reference_photos: activeVariant.uploadedImages,
      }).select("id,label,variant_id").single();

      if (error || !data?.id) {
        setIsGenerating(false);
        return;
      }

      activeWeekId = data.id;
      setState((s) => ({
        ...s,
        weeklyLaunches: [...s.weeklyLaunches, { id: activeWeekId!, label: data.label, variantId: data.variant_id || s.activeVariantId, images: [] }],
        activeWeek: activeWeekId!,
      }));
    }

    const initial: GeneratedImage[] = requests.map((r) => ({
      id: crypto.randomUUID(),
      type: r.type,
      label: r.label,
      prompt: r.prompt,
      photoAngle: ANGLE_BY_TYPE[r.type],
      status: r.type === "video-product" || r.type === "video-model" ? "done" : "pending",
      attemptNumber: 1,
      promptUsed: r.prompt,
    }));

    await supabase.from("generated_images").insert(
      initial.map((img) => ({
        id: img.id,
        launch_id: activeWeekId!,
        type: img.type,
        photo_angle: img.photoAngle!,
        label: img.label,
        prompt: img.prompt,
        prompt_used: img.prompt,
        attempt_number: 1,
        status: img.status,
      }))
    );

    setState((s) => ({
      ...s,
      generatedImages: initial,
      weeklyLaunches: s.weeklyLaunches.map((w) => w.id === activeWeekId ? { ...w, images: [...w.images, ...initial] } : w),
    }));

    const updateImageStatus = (id: string, updates: Partial<GeneratedImage>) => {
      setState((s) => ({
        ...s,
        weeklyLaunches: s.weeklyLaunches.map((w) => ({
          ...w,
          images: w.images.map((i) => (i.id === id ? { ...i, ...updates } : i)),
        })),
      }));

      const dbUpdate: Record<string, unknown> = {};
      if (updates.status) dbUpdate.status = updates.status;
      if (updates.imageUrl) dbUpdate.image_url = updates.imageUrl;
      if (updates.originalUrl) dbUpdate.original_url = updates.originalUrl;
      if (updates.previewUrl) dbUpdate.preview_url = updates.previewUrl;
      if (updates.error) dbUpdate.error = updates.error;
      if (updates.generationMs !== undefined) dbUpdate.generation_ms = updates.generationMs;
      if (updates.modelUsed) dbUpdate.model_used = updates.modelUsed;
      if (updates.attemptNumber !== undefined) dbUpdate.attempt_number = updates.attemptNumber;
      if (updates.promptUsed) dbUpdate.prompt_used = updates.promptUsed;

      if (Object.keys(dbUpdate).length > 0) {
        supabase.from("generated_images").update(dbUpdate).eq("id", id).then();
      }
    };

    const imageTasks = initial
      .filter((img) => img.type !== "video-product" && img.type !== "video-model")
      .map(async (img) => {
        updateImageStatus(img.id, { status: "generating" });
        const startedAt = performance.now();

        try {
          const { data, error } = await supabase.functions.invoke("generate-image", {
            body: {
              angleType: img.type,
              basePrompt: img.prompt,
              manualPrompt: state.manualPrompt,
              selectedPresets: state.selectedPresets,
              garmentAnalysis: activeVariant.garmentAnalysis,
              proportionJson: activeVariant.proportionJson,
              modelProfile: state.selectedProfile,
              mannequin: {
                height_cm: product?.mannequin_height_cm || null,
                bust_cm: product?.mannequin_bust_cm || null,
                waist_cm: product?.mannequin_waist_cm || null,
                hip_cm: product?.mannequin_hip_cm || null,
                torso_cm: product?.mannequin_torso_cm || null,
                arm_cm: product?.mannequin_arm_cm || null,
              },
              referenceImages: activeVariant.uploadedImages.slice(0, 3),
            },
          });

          if (error) throw error;

          updateImageStatus(img.id, {
            status: "done",
            imageUrl: data.previewUrl || data.imageUrl,
            originalUrl: data.originalUrl || data.imageUrl,
            previewUrl: data.previewUrl || data.imageUrl,
            modelUsed: data.modelUsed,
            generationMs: Math.round(performance.now() - startedAt),
            attemptNumber: data.attemptNumber || 1,
            promptUsed: data.promptUsed || img.prompt,
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Falha na geração";
          updateImageStatus(img.id, { status: "error", error: msg });
        }
      });

    await Promise.allSettled(imageTasks);

    setIsGenerating(false);
    queryClient.invalidateQueries({ queryKey: ["images", projectId] });
  }, [activeVariant, state.activeVariantId, state.manualPrompt, state.selectedPresets, state.selectedProfile, variantWeeklyLaunches, product, projectId, queryClient]);

  const handleRegenerate = useCallback(async (id: string) => {
    let img: GeneratedImage | undefined;
    for (const w of state.weeklyLaunches) {
      img = w.images.find((i) => i.id === id);
      if (img) break;
    }
    if (!img || !activeVariant) return;

    const nextAttempt = (img.attemptNumber || 1) + 1;

    const updateImg = (updates: Partial<GeneratedImage>) => {
      setState((s) => ({
        ...s,
        weeklyLaunches: s.weeklyLaunches.map((w) => ({
          ...w,
          images: w.images.map((i) => (i.id === id ? { ...i, ...updates } : i)),
        })),
      }));

      const dbUpdate: Record<string, unknown> = {};
      if (updates.status) dbUpdate.status = updates.status;
      if (updates.imageUrl) dbUpdate.image_url = updates.imageUrl;
      if (updates.originalUrl) dbUpdate.original_url = updates.originalUrl;
      if (updates.previewUrl) dbUpdate.preview_url = updates.previewUrl;
      if (updates.error) dbUpdate.error = updates.error;
      if (updates.generationMs !== undefined) dbUpdate.generation_ms = updates.generationMs;
      if (updates.modelUsed) dbUpdate.model_used = updates.modelUsed;
      if (updates.attemptNumber !== undefined) dbUpdate.attempt_number = updates.attemptNumber;
      if (updates.promptUsed) dbUpdate.prompt_used = updates.promptUsed;

      if (Object.keys(dbUpdate).length > 0) {
        supabase.from("generated_images").update(dbUpdate).eq("id", id).then();
      }
    };

    updateImg({ status: "generating", error: undefined });

    const startedAt = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: {
          angleType: img.type,
          basePrompt: img.prompt,
          manualPrompt: state.manualPrompt,
          selectedPresets: state.selectedPresets,
          garmentAnalysis: activeVariant.garmentAnalysis,
          proportionJson: activeVariant.proportionJson,
          modelProfile: state.selectedProfile,
          mannequin: {
            height_cm: product?.mannequin_height_cm || null,
            bust_cm: product?.mannequin_bust_cm || null,
            waist_cm: product?.mannequin_waist_cm || null,
            hip_cm: product?.mannequin_hip_cm || null,
            torso_cm: product?.mannequin_torso_cm || null,
            arm_cm: product?.mannequin_arm_cm || null,
          },
          referenceImages: activeVariant.uploadedImages.slice(0, 3),
          attemptNumber: nextAttempt,
        },
      });
      if (error) throw error;

      updateImg({
        status: "done",
        imageUrl: data.previewUrl || data.imageUrl,
        originalUrl: data.originalUrl || data.imageUrl,
        previewUrl: data.previewUrl || data.imageUrl,
        modelUsed: data.modelUsed,
        generationMs: Math.round(performance.now() - startedAt),
        attemptNumber: data.attemptNumber || nextAttempt,
        promptUsed: data.promptUsed || img.prompt,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha na regeneração";
      updateImg({ status: "error", error: msg, attemptNumber: nextAttempt });
    }
  }, [state.weeklyLaunches, state.manualPrompt, state.selectedPresets, state.selectedProfile, activeVariant, product]);

  if (authLoading || productLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border px-4 py-2.5 flex items-center justify-between shrink-0 sticky top-0 bg-background/95 backdrop-blur-sm z-30">
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

      {state.variants.length > 0 && (
        <div className="border-b border-border px-4 py-1.5 flex items-center gap-1.5 shrink-0 bg-muted/30 sticky top-[45px] z-20">
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
                      setState(s => ({ ...s, variants: s.variants.map(vv => vv.id === v.id ? { ...vv, colorName: editingVariantName.trim() } : vv) }));
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
                    v.id === state.activeVariantId ? "bg-accent text-accent-foreground font-medium" : "bg-muted text-muted-foreground hover:bg-accent/20"
                  )}
                >
                  {v.colorName}
                  {v.uploadedImages.length > 0 && <span className="ml-1 opacity-60">({v.uploadedImages.length})</span>}
                </button>
              )}
            </div>
          ))}
          <button onClick={addVariant} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-accent/20 transition-all flex items-center gap-0.5">
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

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
          <section id="section-upload" className="scroll-mt-24">
            <UploadSection
              uploadedImages={activeVariant?.uploadedImages || []}
              onImagesChange={(imgs) => updateActiveVariant({ uploadedImages: imgs })}
              isAnalyzing={isAnalyzing}
              onAnalyze={handleAnalyze}
              garmentAnalysis={activeVariant?.garmentAnalysis || null}
              onAnalysisUpdate={(a) => updateActiveVariant({ garmentAnalysis: a })}
            />
          </section>

          <div className="border-t border-border" />

          <section id="section-model" className="scroll-mt-24">
            <ModelGallery
              selectedModelId={state.selectedProfile?.id || null}
              onSelectModel={handleSelectModel}
            />
          </section>

          <div className="border-t border-border" />

          <section id="section-style" className="scroll-mt-24">
            <StyleSection
              selectedPresets={state.selectedPresets}
              onPresetsChange={(p) => update("selectedPresets", p)}
            />
          </section>

          <div className="border-t border-border" />

          <section id="section-generate" className="scroll-mt-24">
            <GenerateSection
              manualPrompt={state.manualPrompt}
              onManualPromptChange={(v) => update("manualPrompt", v)}
              garmentAnalysis={activeVariant?.garmentAnalysis || null}
              selectedProfile={state.selectedProfile}
              selectedPresets={state.selectedPresets}
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
            />
          </section>

          {variantWeeklyLaunches.some(w => w.images.length > 0) && (
            <>
              <div className="border-t border-border" />
              <section id="section-results" className="scroll-mt-24">
                <ResultsGrid
                  weeklyLaunches={variantWeeklyLaunches}
                  onRegenerate={handleRegenerate}
                />
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default ProjectPage;
