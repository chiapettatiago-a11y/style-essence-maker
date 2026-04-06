import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReferencePhotosSection from "@/components/studio/ReferencePhotosSection";
import { useParams, useNavigate, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GarmentAnalysis, GeneratedImage, GenerationEngine, GenerationRequest, ModelProfile, ProductVariant, WeeklyLaunch, WizardState } from "@/types/fashion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Loader2, Home, ChevronDown, Plus, Download, FolderOpen, RefreshCw, Copy, Check, Settings, Sparkles, ArrowRight, ArrowLeft, X, ZoomIn, Languages, UserRound } from "lucide-react";
import JSZip from "jszip";
import monograma from "@/assets/monograma.png";
import { GalleryModel, MODEL_GALLERY } from "@/data/model-gallery";
import LaunchFlowModal from "@/components/studio/LaunchFlowModal";
import { useToast } from "@/hooks/use-toast";

const ANGLE_BY_TYPE: Record<GenerationRequest["type"], string> = {
  "lookbook-front": "front_view",
  "lookbook-back": "back_view",
  "lookbook-left": "left_side",
  "lookbook-three-quarter": "right_side",
  "close-tr-detail": "close_tr_detail",
  "movement-shot": "movement_shot",
  "video-product": "video_product",
  "video-model": "video_model",
};

const ENGINE_CREDIT_ESTIMATE: Record<GenerationEngine, { label: string; detail: string }> = {
  gemini: {
    label: "Estimativa: consumo baixo",
    detail: "Lovable não expõe crédito exato por geração; Gemini tende a consumir menos IA.",
  },
  fal: {
    label: "Estimativa: consumo alto",
    detail: "Lovable não expõe crédito exato por geração; fal.ai tende a consumir mais IA.",
  },
};

type MainTab = "photos" | "video" | "analysis" | "settings";

type MannequinData = {
  mannequin_height_cm: number | null;
  mannequin_bust_cm: number | null;
  mannequin_waist_cm: number | null;
  mannequin_hip_cm: number | null;
  mannequin_torso_cm: number | null;
  mannequin_arm_cm: number | null;
};

const normalizeCmValue = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return value > 0 && value < 3 ? Math.round(value * 100) : Math.round(value);
};

const normalizeMannequinData = (data: MannequinData): MannequinData => ({
  mannequin_height_cm: normalizeCmValue(data.mannequin_height_cm),
  mannequin_bust_cm: normalizeCmValue(data.mannequin_bust_cm),
  mannequin_waist_cm: normalizeCmValue(data.mannequin_waist_cm),
  mannequin_hip_cm: normalizeCmValue(data.mannequin_hip_cm),
  mannequin_torso_cm: normalizeCmValue(data.mannequin_torso_cm),
  mannequin_arm_cm: normalizeCmValue(data.mannequin_arm_cm),
});

const getAnalysisErrorMessage = (error: unknown) => {
  const fallback = "Falha na análise técnica";

  if (!(error instanceof Error)) return fallback;

  const rawMessage = error.message || fallback;
  const jsonMatch = rawMessage.match(/\{[\s\S]*\}$/);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { error?: string; code?: string };
      if (parsed.code === "payment_required") {
        return parsed.error || "Créditos de IA insuficientes para analisar a peça.";
      }

      if (parsed.code === "rate_limited") {
        return parsed.error || "Limite de requisições atingido. Tente novamente em instantes.";
      }

      if (parsed.error) return parsed.error;
    } catch {
      // fall through to string heuristics
    }
  }

  if (/payment_required|not enough credits|credit balance is too low/i.test(rawMessage)) {
    return "Créditos de IA insuficientes para analisar a peça. Adicione créditos e tente novamente.";
  }

  if (/429|rate limit/i.test(rawMessage)) {
    return "Limite de requisições atingido. Aguarde um pouco e tente novamente.";
  }

  return rawMessage;
};

const ProductPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [state, setState] = useState<WizardState>({
    step: 0,
    variants: [],
    activeVariantId: "",
    uploadedImages: [],
    garmentAnalysis: null,
    selectedProfile: null,
    selectedPresets: {},
    selectedEngine: "gemini",
    manualPrompt: "",
    generatedImages: [],
    weeklyLaunches: [],
    activeWeek: "",
    accessories: { shoeType: null, shoeColor: null },
    isCombo: false,
    featuredPiece: null,
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [launchModalOpen, setLaunchModalOpen] = useState(false);
  const [launchModalStep, setLaunchModalStep] = useState(1);
  const [activeTab, setActiveTab] = useState<MainTab>("photos");
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [editingVariantName, setEditingVariantName] = useState("");
  const [productName, setProductName] = useState("");
  const [mannequin, setMannequin] = useState<MannequinData>({
    mannequin_height_cm: null,
    mannequin_bust_cm: null,
    mannequin_waist_cm: null,
    mannequin_hip_cm: null,
    mannequin_torso_cm: null,
    mannequin_arm_cm: null,
  });
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<GeneratedImage | null>(null);

  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ["product", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", projectId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!projectId,
  });

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, updated_at, is_combo, featured_piece")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: dbVariants, isLoading: variantsLoading } = useQuery({
    queryKey: ["variants", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", projectId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!projectId,
  });

  const { data: weeks, isLoading: weeksLoading } = useQuery({
    queryKey: ["weeks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_launches")
        .select("*")
        .eq("product_id", projectId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!projectId,
  });

  const { data: dbImages, isLoading: imagesLoading } = useQuery({
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
    enabled: !!weeks,
  });

  const { data: allWeeks } = useQuery({
    queryKey: ["all-weeks-for-sidebar"],
    queryFn: async () => {
      const { data, error } = await supabase.from("weekly_launches").select("id, product_id");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: allImages } = useQuery({
    queryKey: ["all-images-for-sidebar", allWeeks?.length || 0],
    queryFn: async () => {
      if (!allWeeks || allWeeks.length === 0) return [];
      const launchIds = allWeeks.map((w) => w.id);
      const { data, error } = await supabase
        .from("generated_images")
        .select("launch_id, type, status")
        .in("launch_id", launchIds);
      if (error) throw error;
      return data;
    },
    enabled: !!allWeeks && allWeeks.length > 0,
  });

  const sidebarPhotoCounts = useMemo(() => {
    if (!allWeeks || !allImages) return new Map<string, number>();

    const launchProductMap = new Map<string, string>();
    allWeeks.forEach((w) => launchProductMap.set(w.id, w.product_id));

    const productCountMap = new Map<string, number>();
    allImages.forEach((img) => {
      const productIdFromLaunch = launchProductMap.get(img.launch_id);
      if (!productIdFromLaunch) return;
      const isVideo = img.type === "video-product" || img.type === "video-model";
      if (isVideo) return;
      if (img.status !== "done") return;
      productCountMap.set(productIdFromLaunch, (productCountMap.get(productIdFromLaunch) || 0) + 1);
    });

    return productCountMap;
  }, [allWeeks, allImages]);

  useEffect(() => {
    setLoaded(false);
  }, [projectId]);

  useEffect(() => {
    if (!product || loaded || variantsLoading || weeksLoading || imagesLoading) return;

    const variants: ProductVariant[] = (dbVariants || []).map((v) => ({
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
      engineUsed: (w.engine_used as GenerationEngine | null) || "gemini",
      mannequinHeightCm: w.mannequin_height_cm,
      mannequinBustCm: w.mannequin_bust_cm,
      mannequinWaistCm: w.mannequin_waist_cm,
      mannequinHipCm: w.mannequin_hip_cm,
      mannequinTorsoCm: w.mannequin_torso_cm,
      mannequinArmCm: w.mannequin_arm_cm,
      referencePhotos: (w.reference_photos as string[]) || [],
      images: (dbImages || [])
        .filter((img) => img.launch_id === w.id)
        .map((img) => ({
          id: img.id,
          type: img.type as GeneratedImage["type"],
          label: img.label,
          prompt: img.prompt,
          promptUsed: img.prompt_used || undefined,
          imageUrl: img.preview_url || img.original_url || img.image_url || undefined,
          originalUrl: img.original_url || img.image_url || undefined,
          previewUrl: img.preview_url || undefined,
          photoAngle: img.photo_angle || undefined,
          generationMs: img.generation_ms || undefined,
          modelUsed: img.model_used || undefined,
          attemptNumber: img.attempt_number || undefined,
          status: img.status as GeneratedImage["status"],
          error: img.error || undefined,
        })),
    }));

    const hydratedActiveVariant = variants[0];
    const hydratedActiveWeek = weeklyLaunches[0];

    setState({
      step: 0,
      variants,
      activeVariantId: hydratedActiveVariant?.id || "",
      uploadedImages: hydratedActiveVariant?.uploadedImages || [],
      garmentAnalysis: hydratedActiveVariant?.garmentAnalysis || null,
      selectedProfile: product.model_profile as unknown as ModelProfile | null,
      selectedPresets: (product.selected_presets as Record<string, string>) || {},
      selectedEngine: hydratedActiveWeek?.engineUsed || "gemini",
      manualPrompt: product.manual_prompt || "",
      generatedImages: [],
      weeklyLaunches,
      activeWeek: hydratedActiveWeek?.id || "",
      accessories: { shoeType: null, shoeColor: null },
      isCombo: (product as any).is_combo || false,
      featuredPiece: (product as any).featured_piece || null,
    });

    setProductName(product.name || "");
    setMannequin({
      mannequin_height_cm: product.mannequin_height_cm,
      mannequin_bust_cm: product.mannequin_bust_cm,
      mannequin_waist_cm: product.mannequin_waist_cm,
      mannequin_hip_cm: product.mannequin_hip_cm,
      mannequin_torso_cm: product.mannequin_torso_cm,
      mannequin_arm_cm: product.mannequin_arm_cm,
    });

    setLoaded(true);

    // Auto-open launch flow for newly created products
    const isNew = searchParams.get("new") === "1";
    if (isNew) {
      setLaunchModalStep(1);
      setLaunchModalOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [product, weeks, dbImages, dbVariants, loaded, imagesLoading, projectId, variantsLoading, weeksLoading]);

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
          raw_url: string | null;
          upscaled: boolean;
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
            images: w.images.map((i) =>
              i.id !== row.id
                ? i
                : {
                    ...i,
                    status: row.status,
                    error: row.error || undefined,
                    imageUrl: row.preview_url || row.original_url || row.image_url || i.imageUrl,
                    originalUrl: row.original_url || row.image_url || i.originalUrl,
                    previewUrl: row.preview_url || i.previewUrl,
                    rawUrl: row.raw_url || i.rawUrl,
                    upscaled: row.upscaled ?? i.upscaled,
                    modelUsed: row.model_used || i.modelUsed,
                    generationMs: row.generation_ms || i.generationMs,
                    attemptNumber: row.attempt_number || i.attemptNumber,
                    promptUsed: row.prompt_used || i.promptUsed,
                    photoAngle: row.photo_angle || i.photoAngle,
                  }
            ),
          })),
        }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, user]);

  const activeVariant = state.variants.find((v) => v.id === state.activeVariantId) || state.variants[0];
  const variantWeeklyLaunches = state.weeklyLaunches.filter((w) => !w.variantId || w.variantId === state.activeVariantId);
  const activeLaunch = state.weeklyLaunches.find((w) => w.id === state.activeWeek) || variantWeeklyLaunches[0];

  const donePhotoCount = useMemo(() => {
    return variantWeeklyLaunches
      .flatMap((w) => w.images)
      .filter((img) => img.status === "done" && img.type !== "video-product" && img.type !== "video-model").length;
  }, [variantWeeklyLaunches]);

  const saveProductMeta = useCallback(async (payload: Record<string, unknown>) => {
    if (!projectId) return;
    const { error } = await supabase.from("products").update(payload).eq("id", projectId);
    if (error) throw error;
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

    if (key === "selectedProfile") saveProductMeta({ model_profile: value });
    if (key === "selectedPresets") saveProductMeta({ selected_presets: value });
    if (key === "manualPrompt") saveProductMeta({ manual_prompt: value });
  };

  const createVariantRecord = useCallback(async (sortOrder: number, colorName: string) => {
    if (!projectId) return null;

    const { data, error } = await supabase
      .from("product_variants")
      .insert({ product_id: projectId, color_name: colorName, sort_order: sortOrder })
      .select("*")
      .single();

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return null;
    }

    const newVariant: ProductVariant = {
      id: data.id,
      productId: data.product_id,
      colorName: data.color_name,
      uploadedImages: (data.uploaded_images as string[]) || [],
      garmentAnalysis: data.garment_analysis as unknown as GarmentAnalysis | null,
      sortOrder: data.sort_order,
      garmentType: data.garment_type,
      garmentLength: data.garment_length,
      garmentLengthCm: data.garment_length_cm,
      hemBelowKneeCm: data.hem_below_knee_cm,
      waistPositionCm: data.waist_position_cm,
      sleeveLengthCm: data.sleeve_length_cm,
      sleeveType: data.sleeve_type,
      shoulderWidthCm: data.shoulder_width_cm,
      proportionJson: data.proportion_json as Record<string, unknown> | null,
      analysisRaw: data.analysis_raw,
    };

    return newVariant;
  }, [projectId, toast]);

  const updateActiveVariant = useCallback(async (updates: Partial<ProductVariant>) => {
    let targetVariant = activeVariant;

    if (!targetVariant) {
      targetVariant = await createVariantRecord(state.variants.length, "Original");
      if (!targetVariant) return;
    }

    setState((s) => {
      const targetId = targetVariant!.id;
      const variantsWithTarget = s.variants.some((v) => v.id === targetId)
        ? s.variants
        : [...s.variants, targetVariant!];
      const newVariants = variantsWithTarget.map((v) => (v.id === targetId ? { ...v, ...updates } : v));

      return {
        ...s,
        variants: newVariants,
        activeVariantId: targetId,
        ...(updates.uploadedImages !== undefined ? { uploadedImages: updates.uploadedImages } : {}),
        ...(updates.garmentAnalysis !== undefined ? { garmentAnalysis: updates.garmentAnalysis ?? null } : {}),
      };
    });

    await saveVariant(targetVariant.id, updates);
  }, [activeVariant, createVariantRecord, saveVariant, state.variants.length]);

  const switchVariant = (variantId: string) => {
    const variant = state.variants.find((v) => v.id === variantId);
    if (!variant) return;

    const launchesForVariant = state.weeklyLaunches.filter((w) => !w.variantId || w.variantId === variantId);
    const nextActiveLaunch = launchesForVariant[0];

    setState((s) => ({
      ...s,
      activeVariantId: variantId,
      uploadedImages: variant.uploadedImages,
      garmentAnalysis: variant.garmentAnalysis,
      activeWeek: nextActiveLaunch?.id || "",
      selectedEngine: nextActiveLaunch?.engineUsed || "gemini",
    }));
  };

  const addVariant = async () => {
    const newVariant = await createVariantRecord(state.variants.length, `Cor ${state.variants.length + 1}`);
    if (!newVariant) return;

    setState((s) => ({
      ...s,
      variants: [...s.variants, newVariant],
      activeVariantId: newVariant.id,
      uploadedImages: newVariant.uploadedImages,
      garmentAnalysis: newVariant.garmentAnalysis,
      activeWeek: "",
      selectedEngine: "gemini",
    }));
  };

  const deleteVariant = async (variantId: string) => {
    if (state.variants.length <= 1) return;
    await supabase.from("product_variants").delete().eq("id", variantId);

    setState((s) => {
      const newVariants = s.variants.filter((v) => v.id !== variantId);
      const newActive = s.activeVariantId === variantId ? newVariants[0] : s.variants.find((v) => v.id === s.activeVariantId);
      const launchesForActive = s.weeklyLaunches.filter((w) => w.variantId !== variantId && (!w.variantId || w.variantId === newActive?.id));
      return {
        ...s,
        variants: newVariants,
        activeVariantId: newActive?.id || newVariants[0]?.id || "",
        uploadedImages: newActive?.uploadedImages || [],
        garmentAnalysis: newActive?.garmentAnalysis || null,
        weeklyLaunches: s.weeklyLaunches.filter((w) => w.variantId !== variantId),
        activeWeek: launchesForActive[0]?.id || "",
        selectedEngine: launchesForActive[0]?.engineUsed || "gemini",
      };
    });
  };

  const calculateProportions = useCallback(async (
    variant: ProductVariant,
    mannequinData: MannequinData,
  ) => {
    // Try to get ratios from proportionJson or analysisRaw
    let ratios: { garment_length_ratio?: number; waist_ratio?: number; sleeve_ratio?: number; shoulder_ratio?: number } | null = null;

    // First check if proportionJson has ratios directly
    const pj = variant.proportionJson;
    if (pj && typeof pj.garment_length_ratio === "number") {
      ratios = pj as typeof ratios;
    }

    // Otherwise try to extract from analysisRaw
    if (!ratios && variant.analysisRaw) {
      try {
        const raw = JSON.parse(variant.analysisRaw);
        if (raw.proportions?.garment_length_ratio != null) {
          ratios = raw.proportions;
        }
      } catch { /* ignore */ }
    }

    if (!ratios) {
      console.log("[calculateProportions] No ratios available");
      return;
    }

    const heightCm = mannequinData.mannequin_height_cm;
    const bustCm = mannequinData.mannequin_bust_cm;
    const armCm = mannequinData.mannequin_arm_cm;
    if (!heightCm) return;

    const garmentLengthRatio = Number(ratios.garment_length_ratio) || 0;
    const waistRatio = Number(ratios.waist_ratio) || 0;
    const sleeveRatio = Number(ratios.sleeve_ratio) || 0;
    const shoulderRatio = Number(ratios.shoulder_ratio) || 0;

    const garmentLengthCm = garmentLengthRatio > 0 ? Math.round(garmentLengthRatio * heightCm) : null;
    const waistPositionCm = waistRatio > 0 ? Math.round(waistRatio * heightCm) : null;
    const sleeveLengthCm = sleeveRatio > 0 && armCm ? Math.round(sleeveRatio * armCm) : null;
    const shoulderWidthCm = shoulderRatio > 0 && bustCm ? Math.round(shoulderRatio * bustCm) : null;
    const hemBelowKneeCm = garmentLengthCm != null ? Math.round(garmentLengthCm - (0.61 * heightCm)) : null;

    const updates: Partial<ProductVariant> = {
      garmentLengthCm,
      waistPositionCm,
      sleeveLengthCm,
      shoulderWidthCm,
      hemBelowKneeCm,
    };

    // Update local state
    setState((s) => ({
      ...s,
      variants: s.variants.map((v) => v.id === variant.id ? { ...v, ...updates } : v),
    }));

    // Persist to DB
    await saveVariant(variant.id, updates);

    console.log("[calculateProportions]", { garmentLengthCm, waistPositionCm, sleeveLengthCm, shoulderWidthCm, hemBelowKneeCm });
  }, [saveVariant]);

  const saveMannequin = async () => {
    try {
      const normalizedMannequin = normalizeMannequinData(mannequin);
      setMannequin(normalizedMannequin);
      await saveProductMeta({ ...normalizedMannequin, name: productName.trim() || productName });
      queryClient.invalidateQueries({ queryKey: ["product", projectId] });
      toast({ title: "Salvo", description: "Configurações atualizadas." });

      // Auto-calculate proportions if variant has analysis data
      if (activeVariant) {
        await calculateProportions(activeVariant, normalizedMannequin);
        toast({ title: "Proporções calculadas", description: "Campos de proporções atualizados automaticamente." });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao salvar";
      toast({ title: "Erro", description: message, variant: "destructive" });
    }
  };

  const handleAnalyze = useCallback(async () => {
    if (!activeVariant || activeVariant.uploadedImages.length === 0) return;

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-garment", {
        body: {
          images: activeVariant.uploadedImages,
          mannequin: {
            height_cm: mannequin.mannequin_height_cm,
            bust_cm: mannequin.mannequin_bust_cm,
            waist_cm: mannequin.mannequin_waist_cm,
            hip_cm: mannequin.mannequin_hip_cm,
            torso_cm: mannequin.mannequin_torso_cm,
            arm_cm: mannequin.mannequin_arm_cm,
          },
          isCombo: state.isCombo,
          featuredPiece: state.featuredPiece,
        },
      });

      if (error) throw error;

      const analysis = data.analysis as GarmentAnalysis;
      const proportions = (data.proportions || {}) as Record<string, unknown>;

      // Save tr_badge_location to variant
      const trBadgeLocation = analysis.trBadgeLocation || (data.raw?.tr_badge_location as string) || null;

      updateActiveVariant({
        garmentAnalysis: analysis,
        garmentType: analysis.type || null,
        garmentLength: analysis.length || (proportions.garment_length as string) || null,
        garmentLengthCm: (proportions.garment_length_cm as number) || null,
        hemBelowKneeCm: (proportions.hem_below_knee_cm as number) || null,
        waistPositionCm: (proportions.waist_position_cm as number) || null,
        sleeveLengthCm: (proportions.sleeve_length_cm as number) || null,
        sleeveType: analysis.sleeves || null,
        shoulderWidthCm: (proportions.shoulder_width_cm as number) || null,
        proportionJson: proportions,
        analysisRaw: data.raw ? JSON.stringify(data.raw) : null,
      });

      // Save tr_badge_location to DB separately (new column)
      if (activeVariant) {
        supabase.from("product_variants").update({ tr_badge_location: trBadgeLocation }).eq("id", activeVariant.id).then();
      }

      // Auto-calculate proportions from ratios + mannequin
      if (mannequin.mannequin_height_cm) {
        // Build a temporary variant with the fresh analysisRaw for ratio extraction
        const tempVariant: ProductVariant = {
          ...activeVariant,
          proportionJson: proportions,
          analysisRaw: data.raw ? JSON.stringify(data.raw) : activeVariant.analysisRaw,
        };
        await calculateProportions(tempVariant, mannequin);
      }

      toast({ title: "Análise concluída", description: "Dados técnicos e proporções atualizados." });
    } catch (err: unknown) {
      const message = getAnalysisErrorMessage(err);
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  }, [activeVariant, mannequin, calculateProportions]);

  const handleSelectModelById = useCallback(async (modelId: string) => {
    const model = MODEL_GALLERY.find((m) => m.id === modelId);
    if (!model) return;

    // Fetch LoRA data from DB if available
    let loraUrl: string | undefined;
    let loraTriggerWord: string | undefined;
    let loraScale: number | undefined;
    let guidanceScale: number | undefined;
    let faceImageUrl: string | undefined;
    try {
      const { data } = await supabase
        .from("model_profiles")
        .select("lora_url, lora_trigger_word, lora_scale, guidance_scale, face_image_url")
        .eq("slug", modelId)
        .maybeSingle();
      if (data?.lora_url) {
        loraUrl = data.lora_url;
        loraTriggerWord = data.lora_trigger_word || undefined;
        loraScale = data.lora_scale != null ? Number(data.lora_scale) : undefined;
        guidanceScale = data.guidance_scale != null ? Number(data.guidance_scale) : undefined;
      }
      if (data?.face_image_url) {
        faceImageUrl = data.face_image_url;
      }
    } catch (e) {
      console.warn("Could not fetch LoRA data for model:", e);
    }

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
      lora_url: loraUrl,
      lora_trigger_word: loraTriggerWord,
      lora_scale: loraScale,
      guidance_scale: guidanceScale,
      face_image_url: faceImageUrl,
    };

    update("selectedProfile", profile);
  }, []);

  const updateImageDb = (id: string, updates: Partial<GeneratedImage>) => {
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
    if (updates.rawUrl) dbUpdate.raw_url = updates.rawUrl;
    if (updates.upscaled !== undefined) dbUpdate.upscaled = updates.upscaled;

    if (Object.keys(dbUpdate).length > 0) {
      supabase.from("generated_images").update(dbUpdate).eq("id", id).then();
    }
  };

  const updateImageInState = (id: string, updates: Partial<GeneratedImage>) => {
    setState((s) => ({
      ...s,
      weeklyLaunches: s.weeklyLaunches.map((w) => ({
        ...w,
        images: w.images.map((i) => (i.id === id ? { ...i, ...updates } : i)),
      })),
    }));

    updateImageDb(id, updates);
  };

  const handleEngineChange = useCallback((engine: GenerationEngine) => {
    setState((s) => ({ ...s, selectedEngine: engine }));
  }, []);

  const handleGenerate = useCallback(async (requests: GenerationRequest[]) => {
    if (!activeVariant || !projectId) return;

    setIsGenerating(true);
    const normalizedMannequin = normalizeMannequinData(mannequin);
    setMannequin(normalizedMannequin);

    try {
      await saveProductMeta({ ...normalizedMannequin, name: productName.trim() || productName });
    } catch {
      // keep flow running
    }

    let activeWeekId = variantWeeklyLaunches.find((w) => w.variantId === state.activeVariantId)?.id;

    if (!activeWeekId) {
      const { data, error } = await supabase
        .from("weekly_launches")
        .insert({
          product_id: projectId,
          label: `Lançamento ${variantWeeklyLaunches.length + 1}`,
          variant_id: state.activeVariantId,
          engine_used: state.selectedEngine,
          mannequin_height_cm: normalizedMannequin.mannequin_height_cm,
          mannequin_bust_cm: normalizedMannequin.mannequin_bust_cm,
          mannequin_waist_cm: normalizedMannequin.mannequin_waist_cm,
          mannequin_hip_cm: normalizedMannequin.mannequin_hip_cm,
          mannequin_torso_cm: normalizedMannequin.mannequin_torso_cm,
          mannequin_arm_cm: normalizedMannequin.mannequin_arm_cm,
          reference_photos: activeVariant.uploadedImages,
        })
        .select("id,label,variant_id,engine_used")
        .single();

      if (error || !data?.id) {
        setIsGenerating(false);
        toast({ title: "Erro", description: error?.message || "Falha ao criar lançamento", variant: "destructive" });
        return;
      }

      activeWeekId = data.id;
      setState((s) => ({
        ...s,
        weeklyLaunches: [...s.weeklyLaunches, { id: activeWeekId!, label: data.label, variantId: data.variant_id || s.activeVariantId, engineUsed: (data.engine_used as GenerationEngine | null) || s.selectedEngine, images: [] }],
        activeWeek: activeWeekId!,
      }));
    } else {
      await supabase.from("weekly_launches").update({ engine_used: state.selectedEngine }).eq("id", activeWeekId);
      setState((s) => ({
        ...s,
        weeklyLaunches: s.weeklyLaunches.map((w) => (w.id === activeWeekId ? { ...w, engineUsed: s.selectedEngine } : w)),
        activeWeek: activeWeekId!,
      }));
    }

    const initial: GeneratedImage[] = requests.map((r) => ({
      id: crypto.randomUUID(),
      type: r.type,
      label: r.label,
      prompt: r.prompt,
      photoAngle: ANGLE_BY_TYPE[r.type],
      status: "pending" as const,
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
      weeklyLaunches: s.weeklyLaunches.map((w) => (w.id === activeWeekId ? { ...w, engineUsed: s.selectedEngine, images: [...w.images, ...initial] } : w)),
    }));

    const runImageGeneration = async (img: GeneratedImage, imageUrl?: string) => {
      updateImageInState(img.id, { status: "generating" });
      const startedAt = performance.now();

      try {
          const { data, error } = await supabase.functions.invoke("generate-image", {
            body: {
              angleType: img.type,
              angle: img.type,
              basePrompt: img.prompt,
              prompt: img.prompt,
              manualPrompt: state.manualPrompt,
              engine: state.selectedEngine,
              selectedPresets: state.selectedPresets,
              garmentAnalysis: activeVariant.garmentAnalysis,
              proportionJson: activeVariant.proportionJson,
              modelProfile: state.selectedProfile,
              mannequin: {
                height_cm: normalizedMannequin.mannequin_height_cm,
                bust_cm: normalizedMannequin.mannequin_bust_cm,
                waist_cm: normalizedMannequin.mannequin_waist_cm,
                hip_cm: normalizedMannequin.mannequin_hip_cm,
                torso_cm: normalizedMannequin.mannequin_torso_cm,
                arm_cm: normalizedMannequin.mannequin_arm_cm,
              },
              referenceImages: activeVariant.uploadedImages.slice(0, 3),
              image_url: imageUrl,
              launchId: activeWeekId,
            },
          });

        if (error) throw error;

        updateImageInState(img.id, {
          status: "done",
          imageUrl: data.previewUrl || data.imageUrl,
          originalUrl: data.originalUrl || data.imageUrl,
          previewUrl: data.previewUrl || data.imageUrl,
          rawUrl: data.rawUrl || undefined,
          upscaled: data.upscaled || false,
          modelUsed: data.modelUsed,
          generationMs: Math.round(performance.now() - startedAt),
          attemptNumber: data.attemptNumber || 1,
          promptUsed: data.promptUsed || img.prompt,
        });

        return data.originalUrl || data.previewUrl || data.imageUrl || "";
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Falha na geração";
        updateImageInState(img.id, { status: "error", error: message });
        return "";
      }
    };

    const imageItems = initial.filter((img) => img.type !== "video-product" && img.type !== "video-model");
    const frontImage = imageItems.find((img) => img.type === "lookbook-front");

    // Only generate the front view initially — other angles stay pending for individual generation
    let frontReferenceUrl = "";
    if (frontImage) {
      frontReferenceUrl = await runImageGeneration(frontImage, activeVariant.uploadedImages[0]);
    }

    // Generate videos using front_view as starting frame
    const videoItems = initial.filter((img) => img.type === "video-product" || img.type === "video-model");
    if (videoItems.length > 0 && frontReferenceUrl) {
      for (const vid of videoItems) {
        updateImageInState(vid.id, { status: "generating" });
        const startedAt = performance.now();
        try {
          const { data, error } = await supabase.functions.invoke("generate-image", {
            body: {
              angleType: vid.type,
              angle: vid.type,
              basePrompt: vid.prompt,
              prompt: vid.prompt,
              manualPrompt: state.manualPrompt,
              engine: "fal",
              garmentAnalysis: activeVariant.garmentAnalysis,
              modelProfile: state.selectedProfile,
              image_url: frontReferenceUrl,
              launchId: activeWeekId,
            },
          });
          if (error) throw error;
          updateImageInState(vid.id, {
            status: "done",
            imageUrl: data.originalUrl || data.imageUrl,
            originalUrl: data.originalUrl || data.imageUrl,
            previewUrl: data.previewUrl || data.originalUrl || data.imageUrl,
            modelUsed: data.modelUsed,
            generationMs: Math.round(performance.now() - startedAt),
            promptUsed: data.promptUsed || vid.prompt,
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Falha na geração de vídeo";
          updateImageInState(vid.id, { status: "error", error: message });
        }
      }
    } else if (videoItems.length > 0 && !frontReferenceUrl) {
      videoItems.forEach((vid) => {
        updateImageInState(vid.id, { status: "error", error: "A front view precisa ser gerada primeiro para servir como frame inicial do vídeo." });
      });
    }

    setIsGenerating(false);
    setActiveTab("photos");
    queryClient.invalidateQueries({ queryKey: ["images", projectId] });
    queryClient.invalidateQueries({ queryKey: ["weeks", projectId] });
  }, [
    activeVariant,
    mannequin,
    productName,
    projectId,
    queryClient,
    saveProductMeta,
    state.activeVariantId,
    state.manualPrompt,
    state.selectedEngine,
    state.selectedPresets,
    state.selectedProfile,
    variantWeeklyLaunches,
  ]);

  const handleRegenerate = useCallback(async (id: string, overrideEngine?: GenerationEngine, modelOverride?: ModelProfile | null) => {
    let img: GeneratedImage | undefined;
    let sourceLaunch: WeeklyLaunch | undefined;
    for (const w of state.weeklyLaunches) {
      const candidate = w.images.find((i) => i.id === id);
      if (candidate) {
        img = candidate;
        sourceLaunch = w;
        break;
      }
    }
    if (!img || !activeVariant) return;

    const nextAttempt = (img.attemptNumber || 1) + 1;
    const engine = overrideEngine || sourceLaunch?.engineUsed || state.selectedEngine;
    const frontReference = sourceLaunch?.images.find((launchImg) => launchImg.type === "lookbook-front" && launchImg.status === "done");
    const frontReferenceUrl = frontReference?.originalUrl || frontReference?.previewUrl || frontReference?.imageUrl || "";
    const isCloseDetail = img.type === "close-tr-detail";

    if (isCloseDetail && !frontReferenceUrl) {
      updateImageInState(id, {
        status: "error",
        error: "Regere a front view primeiro para usar como referência deste close.",
        attemptNumber: nextAttempt,
      });
      return;
    }

    updateImageInState(id, { status: "generating", error: undefined });

    const startedAt = performance.now();
    try {
      const isCloseOrMovement = img.type === "close-tr-detail" || img.type === "movement-shot";
      const shouldUseReferenceImage = isCloseDetail || img.type === "lookbook-front" || img.type === "movement-shot";
      const referenceImageUrl = shouldUseReferenceImage
        ? (isCloseDetail ? frontReferenceUrl : activeVariant.uploadedImages[0])
        : undefined;

      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: {
          angleType: img.type,
          angle: img.type,
          basePrompt: img.prompt,
          prompt: img.prompt,
          manualPrompt: state.manualPrompt,
          engine,
          selectedPresets: state.selectedPresets,
          garmentAnalysis: activeVariant.garmentAnalysis,
          proportionJson: activeVariant.proportionJson,
          modelProfile: modelOverride !== undefined ? modelOverride : state.selectedProfile,
          mannequin: {
            height_cm: mannequin.mannequin_height_cm,
            bust_cm: mannequin.mannequin_bust_cm,
            waist_cm: mannequin.mannequin_waist_cm,
            hip_cm: mannequin.mannequin_hip_cm,
            torso_cm: mannequin.mannequin_torso_cm,
            arm_cm: mannequin.mannequin_arm_cm,
          },
          referenceImages: activeVariant.uploadedImages.slice(0, 3),
          image_url: referenceImageUrl,
          attemptNumber: nextAttempt,
          launchId: sourceLaunch?.id,
        },
      });
      if (error) throw error;

      updateImageInState(id, {
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
      const message = err instanceof Error ? err.message : "Falha na regeneração";
      updateImageInState(id, { status: "error", error: message, attemptNumber: nextAttempt });
    }
  }, [activeVariant, mannequin, state.manualPrompt, state.selectedEngine, state.selectedPresets, state.selectedProfile, state.weeklyLaunches]);

  /** Generate a single pending angle with an optional scene override */
  const handleGenerateSingle = useCallback(async (id: string, sceneOverride?: string) => {
    let img: GeneratedImage | undefined;
    let sourceLaunch: WeeklyLaunch | undefined;
    for (const w of state.weeklyLaunches) {
      const candidate = w.images.find((i) => i.id === id);
      if (candidate) { img = candidate; sourceLaunch = w; break; }
    }
    if (!img || !activeVariant) return;

    const frontReference = sourceLaunch?.images.find((i) => i.type === "lookbook-front" && i.status === "done");
    const frontReferenceUrl = frontReference?.originalUrl || frontReference?.previewUrl || frontReference?.imageUrl || "";
    const isCloseDetail = img.type === "close-tr-detail";

    if (isCloseDetail && !frontReferenceUrl) {
      updateImageInState(id, { status: "error", error: "Gere a front view primeiro." });
      return;
    }

    // Build presets with scene override
    const presetsWithScene = sceneOverride
      ? { ...state.selectedPresets, scenario: sceneOverride }
      : state.selectedPresets;

    updateImageInState(id, { status: "generating", error: undefined });
    const startedAt = performance.now();

    try {
      const shouldUseRef = isCloseDetail || img.type === "lookbook-front" || img.type === "movement-shot";
      const referenceImageUrl = shouldUseRef
        ? (isCloseDetail ? frontReferenceUrl : (frontReferenceUrl || activeVariant.uploadedImages[0]))
        : (frontReferenceUrl || activeVariant.uploadedImages[0] || undefined);

      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: {
          angleType: img.type,
          angle: img.type,
          basePrompt: img.prompt,
          prompt: img.prompt,
          manualPrompt: state.manualPrompt,
          engine: state.selectedEngine,
          selectedPresets: presetsWithScene,
          garmentAnalysis: activeVariant.garmentAnalysis,
          proportionJson: activeVariant.proportionJson,
          modelProfile: state.selectedProfile,
          mannequin: {
            height_cm: mannequin.mannequin_height_cm,
            bust_cm: mannequin.mannequin_bust_cm,
            waist_cm: mannequin.mannequin_waist_cm,
            hip_cm: mannequin.mannequin_hip_cm,
            torso_cm: mannequin.mannequin_torso_cm,
            arm_cm: mannequin.mannequin_arm_cm,
          },
          referenceImages: activeVariant.uploadedImages.slice(0, 3),
          image_url: referenceImageUrl,
          attemptNumber: 1,
          launchId: sourceLaunch?.id,
        },
      });
      if (error) throw error;

      updateImageInState(id, {
        status: "done",
        imageUrl: data.previewUrl || data.imageUrl,
        originalUrl: data.originalUrl || data.imageUrl,
        previewUrl: data.previewUrl || data.imageUrl,
        rawUrl: data.rawUrl || undefined,
        upscaled: data.upscaled || false,
        modelUsed: data.modelUsed,
        generationMs: Math.round(performance.now() - startedAt),
        attemptNumber: data.attemptNumber || 1,
        promptUsed: data.promptUsed || img.prompt,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Falha na geração";
      updateImageInState(id, { status: "error", error: message });
    }
  }, [activeVariant, mannequin, state.manualPrompt, state.selectedEngine, state.selectedPresets, state.selectedProfile, state.weeklyLaunches]);

  const handleDownloadZip = async () => {
    const imagesToZip = variantWeeklyLaunches
      .flatMap((w) => w.images)
      .filter((img) => img.status === "done" && img.type !== "video-product" && img.type !== "video-model")
      .map((img) => ({ label: img.label, url: img.originalUrl || img.imageUrl }))
      .filter((img): img is { label: string; url: string } => !!img.url);

    if (imagesToZip.length === 0) {
      toast({ title: "Nada para baixar", description: "Nenhuma imagem finalizada nesta variante." });
      return;
    }

    try {
      const zip = new JSZip();
      await Promise.all(
        imagesToZip.map(async (img, idx) => {
          const response = await fetch(img.url);
          const blob = await response.blob();
          const safeName = img.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
          zip.file(`${String(idx + 1).padStart(2, "0")}-${safeName || "foto"}.jpg`, blob);
        })
      );

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(productName || "produto").toLowerCase().replace(/\s+/g, "-")}-lookbook.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Falha ao gerar ZIP";
      toast({ title: "Erro", description: message, variant: "destructive" });
    }
  };

  const handleDeleteProduct = async () => {
    if (!projectId) return;
    const ok = confirm(`Excluir produto \"${productName}\"? Esta ação não pode ser desfeita.`);
    if (!ok) return;

    const { error } = await supabase.from("products").delete().eq("id", projectId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    navigate("/");
  };

  const copyPrompt = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPromptId(id);
    setTimeout(() => setCopiedPromptId(null), 1200);
  };

  const proportionSummary = {
    garmentLengthCm: activeVariant?.garmentLengthCm,
    waistPositionCm: activeVariant?.waistPositionCm,
    sleeveLengthCm: activeVariant?.sleeveLengthCm,
    shoulderWidthCm: activeVariant?.shoulderWidthCm,
    hemBelowKneeCm: activeVariant?.hemBelowKneeCm,
    garmentLengthLabel: activeVariant?.garmentLength,
  };

  if (authLoading || productLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-[220px] shrink-0 border-r border-border hidden md:flex md:flex-col">
        <div className="px-4 py-4 border-b border-border flex items-center justify-between">
          <img src={monograma} alt="Monograma" className="h-5 brightness-0 invert cursor-pointer" onClick={() => navigate("/")} />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate("/")}>
            <Home className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-3 border-b border-border">
          <Button className="w-full" size="sm" onClick={() => navigate("/")}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Novo produto
          </Button>
        </div>

        <div className="p-3 space-y-1.5 overflow-y-auto">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2">Produtos</p>
          {(products || []).map((p) => {
            const active = p.id === projectId;
            const count = sidebarPhotoCounts.get(p.id) || 0;
            const pIsCombo = (p as any).is_combo;
            const pFeatured = (p as any).featured_piece;
            return (
              <button
                key={p.id}
                onClick={() => navigate(`/project/${p.id}`)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-xs border transition-colors",
                  active ? "border-accent bg-accent/10 text-accent" : "border-transparent hover:bg-muted text-foreground"
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{p.name}</span>
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  {pIsCombo && (
                    <Badge variant="outline" className="text-[9px] h-4 px-1">
                      Conjunto · {pFeatured === "bottom" ? "Baixo" : "Cima"}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-[10px] h-5">{count}</Badge>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-auto p-3 border-t border-border">
          <div className="text-[11px] text-muted-foreground truncate">{user.email}</div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={() => navigate("/")}>
              <Home className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg font-medium truncate">{productName || product?.name || "Produto"}</h1>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-xs text-muted-foreground">
                  Atualizado em {product?.updated_at ? new Date(product.updated_at).toLocaleDateString("pt-BR") : "—"} · {donePhotoCount} fotos geradas
                  {activeLaunch?.engineUsed ? ` · motor ${activeLaunch.engineUsed}` : ""}
                </p>
                <Badge variant="outline" className="text-[10px] font-medium">
                  {ENGINE_CREDIT_ESTIMATE[state.selectedEngine].label}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {ENGINE_CREDIT_ESTIMATE[state.selectedEngine].detail}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleDownloadZip}>
              <Download className="h-3.5 w-3.5 mr-1" /> Baixar ZIP
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLaunchModalStep(3);
                setLaunchModalOpen(true);
              }}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Re-analisar
            </Button>
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                setLaunchModalStep(1);
                setLaunchModalOpen(true);
              }}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" /> Novo lançamento
            </Button>
          </div>
        </header>

        {state.variants.length > 0 && (
          <div className="border-b border-border px-4 sm:px-6 py-2 flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[10px] text-muted-foreground mr-1 shrink-0">Variantes:</span>
            {state.variants.map((v) => (
              <div key={v.id} className="flex items-center shrink-0">
                {editingVariantId === v.id ? (
                  <Input
                    value={editingVariantName}
                    onChange={(e) => setEditingVariantName(e.target.value)}
                    onBlur={() => {
                      if (editingVariantName.trim()) {
                        setState((s) => ({
                          ...s,
                          variants: s.variants.map((vv) => (vv.id === v.id ? { ...vv, colorName: editingVariantName.trim() } : vv)),
                        }));
                        saveVariant(v.id, { colorName: editingVariantName.trim() });
                      }
                      setEditingVariantId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    className="h-7 text-xs w-28"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => switchVariant(v.id)}
                    onDoubleClick={() => {
                      setEditingVariantId(v.id);
                      setEditingVariantName(v.colorName);
                    }}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full border transition-all",
                      v.id === state.activeVariantId
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {v.colorName}
                    {v.uploadedImages.length > 0 && <span className="ml-1 opacity-70">({v.uploadedImages.length})</span>}
                  </button>
                )}
              </div>
            ))}
            <button onClick={addVariant} className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground shrink-0">
              <Plus className="h-3 w-3 inline mr-1" /> Nova Cor
            </button>
            {state.variants.length > 1 && activeVariant && (
              <button
                onClick={() => {
                  if (confirm(`Excluir variante \"${activeVariant.colorName}\"?`)) deleteVariant(activeVariant.id);
                }}
                className="text-xs px-2.5 py-1 rounded-full text-destructive hover:bg-destructive/10 ml-auto shrink-0"
              >
                Excluir
              </button>
            )}
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MainTab)}>
            <TabsList>
              <TabsTrigger value="photos">Fotos</TabsTrigger>
              <TabsTrigger value="video">Vídeos</TabsTrigger>
              <TabsTrigger value="analysis">Análise técnica</TabsTrigger>
              <TabsTrigger value="settings">Configurações</TabsTrigger>
            </TabsList>

            <TabsContent value="photos" className="mt-4 space-y-4">
              {[...variantWeeklyLaunches].reverse().map((launch) => {
                const photos = launch.images.filter((img) => img.type !== "video-product" && img.type !== "video-model");
                if (photos.length === 0) return null;
                return (
                  <div key={launch.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">{launch.label}</h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{launch.engineUsed || "gemini"}</Badge>
                        <Badge variant="secondary">{photos.length} ângulos</Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                      {photos.map((img) => (
                        <div key={img.id} className="group rounded-xl border border-border bg-card overflow-hidden">
                          <div className="aspect-[9/16] bg-muted relative flex items-center justify-center">
                            {img.status === "done" && img.imageUrl && (
                              <>
                                <img
                                  src={img.imageUrl}
                                  alt={img.label}
                                  className="w-full h-full object-cover cursor-pointer"
                                  loading="lazy"
                                  onClick={async () => {
                                    try {
                                      const resp = await fetch(img.originalUrl || img.imageUrl!);
                                      const blob = await resp.blob();
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement("a");
                                      a.href = url;
                                      a.download = `${img.label}.png`;
                                      a.click();
                                      URL.revokeObjectURL(url);
                                    } catch {
                                      window.open(img.originalUrl || img.imageUrl!, "_blank");
                                    }
                                  }}
                                  onError={(e) => {
                                    const target = e.currentTarget;
                                    const fallback = img.originalUrl || img.previewUrl;
                                    if (fallback && target.src !== fallback) {
                                      target.src = fallback;
                                    }
                                  }}
                                />
                                <button
                                  onClick={(e) => { e.stopPropagation(); setLightboxImage(img); }}
                                  className="absolute top-1 right-1 bg-background/80 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
                                  title="Ampliar"
                                >
                                  <ZoomIn className="h-4 w-4 text-foreground" />
                                </button>
                              </>
                            )}
                            {img.status === "generating" && <Loader2 className="h-5 w-5 animate-spin text-accent" />}
                            {img.status === "pending" && (
                              <div className="flex flex-col items-center gap-2 p-3">
                                <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                                <span className="text-[10px] text-muted-foreground">Aguardando</span>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="sm" className="h-7 text-[10px] gap-1">
                                      <Sparkles className="h-3 w-3" /> Gerar
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="center" className="w-52">
                                    <DropdownMenuItem className="text-[10px] text-muted-foreground font-medium" disabled>Escolha o cenário</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleGenerateSingle(img.id, "estudio-branco")} className="gap-2 text-xs">
                                      <span>⬜</span> Estúdio Branco Puro
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleGenerateSingle(img.id, "estudio-neutro-bege")} className="gap-2 text-xs">
                                      <span>🟫</span> Estúdio Neutro Bege
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleGenerateSingle(img.id, "urbano-contemporaneo")} className="gap-2 text-xs">
                                      <span>🏙️</span> Urbano Contemporâneo
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleGenerateSingle(img.id, "natureza-suave")} className="gap-2 text-xs">
                                      <span>🌿</span> Natureza Suave
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                            {img.status === "error" && (
                              <div className="text-center p-2">
                                <p className="text-[11px] text-destructive">{img.error || "Erro"}</p>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="sm" variant="outline" className="h-7 mt-2 text-xs">
                                      <RefreshCw className="h-3 w-3 mr-1" /> Regenerar
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent>
                                    <DropdownMenuItem onClick={() => handleRegenerate(img.id, "gemini")} className="gap-2 text-xs">
                                      <Sparkles className="h-3.5 w-3.5" /> Gemini
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleRegenerate(img.id, "fal")} className="gap-2 text-xs">
                                      <ArrowRight className="h-3.5 w-3.5" /> fal.ai Flux
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                          </div>
                          <div className="px-2.5 py-2 flex items-center justify-between">
                            <span className="text-xs font-medium truncate">{img.label}</span>
                            {img.status === "done" && (
                              <div className="flex items-center gap-0.5">
                                {/* Swap model for this angle */}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Trocar modelo">
                                      <UserRound className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    {MODEL_GALLERY.map((m) => (
                                      <DropdownMenuItem
                                        key={m.id}
                                        onClick={() => handleRegenerate(img.id, undefined, m)}
                                        className="gap-2 text-xs"
                                      >
                                        <img src={m.faceImage} alt={m.name} className="h-5 w-5 rounded-full object-cover" />
                                        {m.name}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                {/* Regenerate with engine */}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                      <RefreshCw className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent>
                                    <DropdownMenuItem onClick={() => handleRegenerate(img.id, "gemini")} className="gap-2 text-xs">
                                      <Sparkles className="h-3.5 w-3.5" /> Regenerar com Gemini
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleRegenerate(img.id, "fal")} className="gap-2 text-xs">
                                      <ArrowRight className="h-3.5 w-3.5" /> Regenerar com fal.ai
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {/* Generate more button */}
              {variantWeeklyLaunches.some((w) => w.images.some((img) => img.status === "done")) && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => { setLaunchModalStep(3); setLaunchModalOpen(true); }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Gerar mais fotos
                  </Button>
                </div>
              )}
              {variantWeeklyLaunches.every((w) => w.images.filter((img) => img.type !== "video-product" && img.type !== "video-model").length === 0) && (
                <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="rounded-2xl bg-muted/60 p-6 max-w-md space-y-3">
                    <div className="mx-auto w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                      <Sparkles className="h-6 w-6 text-accent" />
                    </div>
                    <h3 className="text-sm font-semibold">Nenhuma foto gerada ainda</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Use o botão <strong>"Novo lançamento"</strong> no topo para iniciar o fluxo de geração.
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="video" className="mt-4 space-y-4">
              {/* Gerar Vídeo standalone button */}
              {/* Video generation button disabled — keeping prompt text only */}

              {/* Video section hidden — Kling disabled */}
              <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
                <div className="rounded-2xl bg-muted/60 p-6 max-w-md space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold">Vídeos em breve</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    A geração de vídeos está temporariamente desativada. Os prompts de vídeo continuam sendo gerados no lançamento e podem ser copiados na aba de Resultados.
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="analysis" className="mt-4">
              {activeVariant?.garmentAnalysis ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={isTranslating}
                      onClick={async () => {
                        if (!activeVariant?.garmentAnalysis) return;
                        setIsTranslating(true);
                        try {
                          const ga = activeVariant.garmentAnalysis as unknown as Record<string, string>;
                          const fields: Record<string, string> = {};
                          for (const key of ["type", "fabric", "color", "silhouette", "neckline", "sleeves", "hemline", "pattern", "length", "closure", "beltOrTie", "signatureDetails", "promptDescription"]) {
                            if (ga[key]) fields[key] = ga[key];
                          }
                          const { data, error } = await supabase.functions.invoke("translate-analysis", { body: { fields } });
                          if (error) {
                            // Parse the actual error message from the edge function response
                            const errorBody = typeof error === 'object' && 'message' in error ? error.message : String(error);
                            if (errorBody.includes("402") || errorBody.includes("créditos") || errorBody.includes("Créditos")) {
                              throw new Error("Créditos de IA insuficientes. Adicione créditos em Settings > Workspace > Usage e tente novamente.");
                            }
                            if (errorBody.includes("429") || errorBody.includes("rate")) {
                              throw new Error("Limite de requisições atingido. Aguarde um momento e tente novamente.");
                            }
                            throw new Error(typeof error === 'object' && 'message' in error ? error.message : "Erro na tradução");
                          }
                          if (data?.translated && Object.keys(data.translated).length > 0) {
                            updateActiveVariant({
                              garmentAnalysis: { ...activeVariant.garmentAnalysis!, ...data.translated },
                            });
                            toast({ title: "Tradução aplicada", description: "Os campos foram traduzidos para português." });
                          } else {
                            toast({ title: "Aviso", description: "Não foi possível traduzir.", variant: "destructive" });
                          }
                        } catch (err: unknown) {
                          const msg = err instanceof Error ? err.message : "Erro na tradução";
                          toast({ title: "Erro", description: msg, variant: "destructive" });
                        } finally {
                          setIsTranslating(false);
                        }
                      }}
                    >
                      {isTranslating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
                      {isTranslating ? "Traduzindo..." : "Traduzir para Português"}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card>
                    <CardContent className="pt-4 space-y-3">
                      <h3 className="text-sm font-semibold">Campos técnicos detectados</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          ["type", "Tipo"],
                          ["fabric", "Tecido"],
                          ["color", "Cor"],
                          ["silhouette", "Silhueta"],
                          ["neckline", "Decote"],
                          ["sleeves", "Mangas"],
                          ["hemline", "Barra"],
                          ["pattern", "Padrão"],
                          ["length", "Comprimento"],
                          ["closure", "Fechamento"],
                          ["beltOrTie", "Cinto / Laço"],
                          ["signatureDetails", "Detalhes assinatura"],
                        ].map(([key, label]) => (
                          <div key={key} className="space-y-1">
                            <Label className="text-[10px]">{label}</Label>
                            <Input
                              value={(activeVariant.garmentAnalysis as unknown as Record<string, string>)[key] || ""}
                              onChange={(e) =>
                                updateActiveVariant({
                                  garmentAnalysis: {
                                    ...activeVariant.garmentAnalysis!,
                                    [key]: e.target.value,
                                  },
                                })
                              }
                              className="h-8 text-xs"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="space-y-1 mt-2">
                        <Label className="text-[10px]">Descrição para prompt (promptDescription)</Label>
                        <textarea
                          value={(activeVariant.garmentAnalysis as unknown as Record<string, string>)?.promptDescription || ""}
                          onChange={(e) =>
                            updateActiveVariant({
                              garmentAnalysis: {
                                ...activeVariant.garmentAnalysis!,
                                promptDescription: e.target.value,
                              },
                            })
                          }
                          rows={4}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          placeholder="Descrição técnica completa da peça usada nos prompts de geração..."
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-4 space-y-3">
                      <h3 className="text-sm font-semibold">Proporções da peça</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px]">Classificação de comprimento</Label>
                          <Input
                            value={activeVariant.garmentLength || ""}
                            onChange={(e) => updateActiveVariant({ garmentLength: e.target.value || null })}
                            className="h-8 text-xs"
                            placeholder="Ex: midi, curto, longo"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Comprimento (cm)</Label>
                          <Input
                            type="number"
                            value={activeVariant.garmentLengthCm ?? ""}
                            onChange={(e) => updateActiveVariant({ garmentLengthCm: e.target.value === "" ? null : Number(e.target.value) })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Posição cintura (cm)</Label>
                          <Input
                            type="number"
                            value={activeVariant.waistPositionCm ?? ""}
                            onChange={(e) => updateActiveVariant({ waistPositionCm: e.target.value === "" ? null : Number(e.target.value) })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Manga (cm)</Label>
                          <Input
                            type="number"
                            value={activeVariant.sleeveLengthCm ?? ""}
                            onChange={(e) => updateActiveVariant({ sleeveLengthCm: e.target.value === "" ? null : Number(e.target.value) })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Ombro (cm)</Label>
                          <Input
                            type="number"
                            value={activeVariant.shoulderWidthCm ?? ""}
                            onChange={(e) => updateActiveVariant({ shoulderWidthCm: e.target.value === "" ? null : Number(e.target.value) })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Barra vs joelho (cm)</Label>
                          <Input
                            type="number"
                            value={activeVariant.hemBelowKneeCm ?? ""}
                            onChange={(e) => updateActiveVariant({ hemBelowKneeCm: e.target.value === "" ? null : Number(e.target.value) })}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  </div>

                  {/* Prompts utilizados */}
                  {activeLaunch && activeLaunch.images.length > 0 && (
                    <Card className="mt-4">
                      <CardContent className="pt-4 space-y-3">
                        <h3 className="text-sm font-semibold">Prompts utilizados — {activeLaunch.label}</h3>
                        <p className="text-[10px] text-muted-foreground">Prompt completo enviado ao modelo de geração para cada ângulo deste lançamento.</p>
                        <div className="space-y-3">
                          {activeLaunch.images
                            .filter((img) => img.type !== "video-product" && img.type !== "video-model")
                            .map((img) => {
                              const angleLabels: Record<string, string> = {
                                "lookbook-front": "Frente",
                                "lookbook-back": "Costas",
                                "lookbook-left": "Lateral Esq.",
                                "lookbook-three-quarter": "Lateral Dir.",
                                "close-tr-detail": "Close TR",
                                "movement-shot": "Movimento",
                              };
                              const label = angleLabels[img.type] || img.label;
                              const hasPrompt = !!img.promptUsed;

                              return (
                                <div key={img.id} className="space-y-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-medium">{label}</span>
                                    {hasPrompt && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-[10px] gap-1 shrink-0"
                                        onClick={() => copyPrompt(img.id, img.promptUsed!)}
                                      >
                                        {copiedPromptId === img.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                        {copiedPromptId === img.id ? "Copiado" : "Copiar"}
                                      </Button>
                                    )}
                                  </div>
                                  {hasPrompt ? (
                                    <textarea
                                      readOnly
                                      value={img.promptUsed!}
                                      className="w-full h-[120px] rounded-md border border-input bg-muted/30 px-3 py-2 text-[10px] font-mono text-muted-foreground resize-none overflow-y-auto ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    />
                                  ) : (
                                    <p className="text-[10px] text-muted-foreground italic px-1">
                                      Prompt não disponível — regenere este lançamento.
                                    </p>
                                  )}
                                  <p className="text-[10px] text-muted-foreground px-1">
                                    {img.modelUsed ? `Modelo: ${img.modelUsed}` : ""}
                                    {img.generationMs ? ` · ${img.generationMs}ms` : ""}
                                    {img.attemptNumber ? ` · tentativa ${img.attemptNumber}` : ""}
                                  </p>
                                </div>
                              );
                            })}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="py-16 text-center text-muted-foreground text-sm">Faça a análise da peça para visualizar os campos técnicos.</div>
              )}
            </TabsContent>

            <TabsContent value="settings" className="mt-4 space-y-4">
              <Card>
                <CardContent className="pt-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome do produto</Label>
                    <Input value={productName} onChange={(e) => setProductName(e.target.value)} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      ["mannequin_height_cm", "Altura (cm)"],
                      ["mannequin_bust_cm", "Busto (cm)"],
                      ["mannequin_waist_cm", "Cintura (cm)"],
                      ["mannequin_hip_cm", "Quadril (cm)"],
                      ["mannequin_torso_cm", "Torso (cm)"],
                      ["mannequin_arm_cm", "Braço (cm)"],
                    ].map(([key, label]) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-xs">{label}</Label>
                        <Input
                          type="number"
                          value={mannequin[key as keyof MannequinData] ?? ""}
                          onChange={(e) =>
                            setMannequin((s) => ({
                              ...s,
                              [key]: e.target.value === "" ? null : Number(e.target.value),
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={saveMannequin}>
                      <Settings className="h-3.5 w-3.5 mr-1" /> Salvar configurações
                    </Button>
                    <Button size="sm" variant="destructive" onClick={handleDeleteProduct}>
                      Excluir produto
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Reference Photos */}
              <Card>
                <CardContent className="pt-4 space-y-4">
                  <h3 className="text-sm font-semibold">Fotos de referência</h3>
                  <p className="text-[10px] text-muted-foreground">
                    Fotos usadas como referência para análise e geração. Máximo 3 fotos.
                  </p>
                  <ReferencePhotosSection
                    photos={(product as any)?.reference_photos || []}
                    onPhotosChange={async (newPhotos) => {
                      await saveProductMeta({ reference_photos: newPhotos });
                      queryClient.invalidateQueries({ queryKey: ["product", projectId] });
                      toast({ title: "Atualizado", description: "Fotos de referência atualizadas." });
                    }}
                    maxPhotos={3}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <LaunchFlowModal
        open={launchModalOpen}
        onOpenChange={setLaunchModalOpen}
        startStep={launchModalStep}
        uploadedImages={activeVariant?.uploadedImages || []}
        onImagesChange={(imgs) => updateActiveVariant({ uploadedImages: imgs })}
        isAnalyzing={isAnalyzing}
        onAnalyze={handleAnalyze}
        garmentAnalysis={activeVariant?.garmentAnalysis || null}
        onAnalysisUpdate={(a) => updateActiveVariant({ garmentAnalysis: a })}
        mannequin={mannequin}
        onMannequinChange={setMannequin}
        selectedProfile={state.selectedProfile}
        onSelectModel={handleSelectModelById}
        onProfileUpdate={(profile) => update("selectedProfile", profile)}
        selectedPresets={state.selectedPresets}
        onPresetsChange={(p) => update("selectedPresets", p)}
        manualPrompt={state.manualPrompt}
        onManualPromptChange={(v) => update("manualPrompt", v)}
        selectedEngine={state.selectedEngine}
        onSelectedEngineChange={handleEngineChange}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
        proportionSummary={proportionSummary}
        onProportionUpdate={updateActiveVariant}
        garmentType={activeVariant?.garmentType || null}
        onGarmentTypeChange={(type) => updateActiveVariant({ garmentType: type })}
        accessories={state.accessories}
        onAccessoriesChange={(a) => update("accessories", a)}
        isCombo={state.isCombo}
        onIsComboChange={(v) => {
          update("isCombo", v);
          saveProductMeta({ is_combo: v });
        }}
        featuredPiece={state.featuredPiece}
        onFeaturedPieceChange={(v) => {
          update("featuredPiece", v || null);
          saveProductMeta({ featured_piece: v || null });
        }}
      />

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8" onClick={() => setLightboxImage(null)}>
          <div className="relative max-w-2xl max-h-[85vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {/* Top bar */}
            <div className="w-full flex items-center justify-between mb-3">
              <Button size="sm" variant="secondary" className="h-8 gap-1.5" onClick={() => setLightboxImage(null)}>
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar
              </Button>
              <span className="text-sm text-white/80 font-medium">{lightboxImage.label}</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 gap-1.5"
                  onClick={async () => {
                    try {
                      const resp = await fetch(lightboxImage.originalUrl || lightboxImage.imageUrl!);
                      const blob = await resp.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${lightboxImage.label}.png`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch {
                      window.open(lightboxImage.originalUrl || lightboxImage.imageUrl!, "_blank");
                    }
                  }}
                >
                  <Download className="h-3.5 w-3.5" /> Baixar
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="secondary" className="h-8 gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5" /> Regenerar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => { handleRegenerate(lightboxImage.id, "gemini"); setLightboxImage(null); }} className="gap-2 text-xs">
                      <Sparkles className="h-3.5 w-3.5" /> Regenerar com Gemini
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { handleRegenerate(lightboxImage.id, "fal"); setLightboxImage(null); }} className="gap-2 text-xs">
                      <ArrowRight className="h-3.5 w-3.5" /> Regenerar com fal.ai
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="secondary" className="h-8 gap-1.5">
                      <UserRound className="h-3.5 w-3.5" /> Trocar modelo
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-48">
                    {MODEL_GALLERY.map((m) => (
                      <DropdownMenuItem
                        key={m.id}
                        onClick={() => { handleRegenerate(lightboxImage.id, undefined, m); setLightboxImage(null); }}
                        className="gap-2 text-xs"
                      >
                        <img src={m.faceImage} alt={m.name} className="h-5 w-5 rounded-full object-cover" />
                        {m.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {/* Image with hover zoom */}
            <div className="rounded-xl overflow-hidden bg-card group cursor-zoom-in relative">
              <img
                src={lightboxImage.originalUrl || lightboxImage.imageUrl!}
                alt={lightboxImage.label}
                className="max-h-[75vh] w-auto object-contain transition-transform duration-300 group-hover:scale-150"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (lightboxImage.imageUrl && target.src !== lightboxImage.imageUrl) {
                    target.src = lightboxImage.imageUrl;
                  }
                }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 100;
                  const y = ((e.clientY - rect.top) / rect.height) * 100;
                  e.currentTarget.style.transformOrigin = `${x}% ${y}%`;
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductPage;
