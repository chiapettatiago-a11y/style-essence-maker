import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import UploadSection from "@/components/studio/UploadSection";
import { AccessorySelection, GarmentAnalysis, GenerationEngine, GenerationRequest, ModelProfile } from "@/types/fashion";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles, Folder, Plus } from "lucide-react";
import { MODEL_GALLERY, GalleryModel } from "@/data/model-gallery";
import { LAYER1_BASE } from "@/data/prompt-layers";
import { assembleLayer2, generateAllRequests } from "@/data/prompt-builder";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

// The 5 model profile slugs that match the new DB rows (DB uses dashes; gallery uses underscores).
const MODEL_SLUGS = [
  "paulistana_urbana",
  "gaucha_serrana",
  "baiana_solar",
  "indigena_contemporanea",
  "mineira_classica",
] as const;

// Skin-tone → avatar background color mapping.
const SKIN_TONE_AVATAR: Record<string, string> = {
  "morena clara": "#F5C4B3",
  "clara rosada": "#F0D4C0",
  "negra luminosa": "#8B6346",
  "morena dourada": "#C8924A",
  "morena média": "#D4956A",
};

const skinToneColor = (st?: string) => {
  if (!st) return "#E5DDD2";
  const lc = st.toLowerCase();
  for (const key of Object.keys(SKIN_TONE_AVATAR)) {
    if (lc.includes(key)) return SKIN_TONE_AVATAR[key];
  }
  return "#E5DDD2";
};

const BACKGROUNDS: Array<{ id: string; label: string; emoji: string; presetValue: string; description: string }> = [
  { id: "studio-white", label: "Estúdio branco", emoji: "⬜", presetValue: "white-studio", description: "Cyclorama #FFFFFF" },
  { id: "studio-beige", label: "Estúdio bege", emoji: "🟫", presetValue: "beige-studio", description: "Tom quente neutro" },
  { id: "urban", label: "Urbano contemporâneo", emoji: "🏙", presetValue: "urban-contemporary", description: "Cena de cidade" },
  { id: "nature", label: "Natureza suave", emoji: "🌿", presetValue: "soft-nature", description: "Folhagem natural" },
];

const FOLDER_TYPES: Array<{ id: "week" | "editorial" | "campaign"; label: string }> = [
  { id: "week", label: "Semana" },
  { id: "editorial", label: "Editorial" },
  { id: "campaign", label: "Campanha" },
];

type FolderRow = { id: string; name: string; folder_type: string };

type StepDot = "done" | "current" | "pending";

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
  mannequin: unknown;
  onMannequinChange: (value: unknown) => void;
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
  proportionSummary: unknown;
  onProportionUpdate: (updates: unknown) => void;
  garmentType: string | null;
  onGarmentTypeChange: (type: string) => void;
  accessories: AccessorySelection;
  onAccessoriesChange: (a: AccessorySelection) => void;
  isCombo: boolean;
  onIsComboChange: (v: boolean) => void;
  featuredPiece: string | null;
  onFeaturedPieceChange: (v: string) => void;
  /** Product/project id used to scope folders. Optional during transition. */
  productId?: string;
  /** Optional callback fired with the selected folder id when the user generates. */
  onFolderSelected?: (folderId: string | null) => void;
  /** Pre-fills the folder selection in step 3 when the modal is opened from a folder slot. */
  initialFolderId?: string | null;
  /** Footwear selection (controlled by parent so it can be injected into the generation request). */
  selectedFootwear?: string;
  onSelectedFootwearChange?: (footwear: string) => void;
}

const FOOTWEAR_CHOICES: Array<{ id: string; label: string; emoji: string }> = [
  { id: "scarpin_nude", label: "Scarpin nude", emoji: "👠" },
  { id: "scarpin_preto", label: "Scarpin preto", emoji: "🖤" },
  { id: "sandalia_tira", label: "Sandália tira", emoji: "👡" },
  { id: "mule_dourado", label: "Mule dourado", emoji: "✨" },
  { id: "bota_ankle", label: "Bota ankle", emoji: "🥾" },
  { id: "sem_sapato", label: "Sem sapato", emoji: "🦶" },
];

const Dot: React.FC<{ index: number; state: StepDot }> = ({ index, state }) => (
  <div className="flex items-center gap-2 text-xs">
    <span
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors",
        state === "current" && "bg-foreground text-background border-foreground",
        state === "done" && "bg-emerald-600 text-white border-emerald-600",
        state === "pending" && "bg-transparent text-muted-foreground border-border",
      )}
    >
      {state === "done" ? <Check className="h-3 w-3" /> : index}
    </span>
  </div>
);

const STEP_TITLES = ["Fotos da peça", "Perfil de modelo", "Cenário e geração"];

const NEW_MODELS: GalleryModel[] = MODEL_SLUGS
  .map((slug) => MODEL_GALLERY.find((m) => m.id === slug))
  .filter((m): m is GalleryModel => Boolean(m));

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
  selectedProfile,
  onSelectModel,
  selectedPresets,
  onPresetsChange,
  manualPrompt,
  selectedEngine,
  onGenerate,
  isGenerating,
  garmentType,
  onGarmentTypeChange,
  accessories,
  isCombo,
  onIsComboChange,
  featuredPiece,
  onFeaturedPieceChange,
  productId,
  onFolderSelected,
  initialFolderId,
}) => {
  const { user } = useAuth();
  const [step, setStep] = useState(startStep);
  const [selectedBg, setSelectedBg] = useState<string>("studio-white");
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderType, setNewFolderType] = useState<"week" | "editorial" | "campaign">("week");
  const [savingFolder, setSavingFolder] = useState(false);

  useEffect(() => {
    if (open) setStep(startStep);
  }, [open, startStep]);

  // Pre-fill folder selection when opened from a folder slot.
  useEffect(() => {
    if (open && initialFolderId) setSelectedFolderId(initialFolderId);
  }, [open, initialFolderId]);


  // Sync selected background into selectedPresets so the prompt-builder sees it.
  useEffect(() => {
    const bg = BACKGROUNDS.find((b) => b.id === selectedBg);
    if (!bg) return;
    if (selectedPresets.background === bg.presetValue) return;
    onPresetsChange({ ...selectedPresets, background: bg.presetValue });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBg]);

  // Load folders for this product when reaching step 3.
  useEffect(() => {
    const loadFolders = async () => {
      if (!productId || !user) return;
      const { data } = await supabase
        .from("folders")
        .select("id,name,folder_type")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });
      if (data) setFolders(data as FolderRow[]);
    };
    if (open && step === 3) loadFolders();
  }, [open, step, productId, user]);

  const dotState = (i: number): StepDot => (step === i ? "current" : step > i ? "done" : "pending");
  const canAdvanceFrom1 = uploadedImages.length > 0 && !!garmentAnalysis;
  const canAdvanceFrom2 = !!selectedProfile;

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !productId || !user) return;
    setSavingFolder(true);
    const { data, error } = await supabase
      .from("folders")
      .insert({
        product_id: productId,
        user_id: user.id,
        name: newFolderName.trim(),
        folder_type: newFolderType,
      })
      .select("id,name,folder_type")
      .single();
    setSavingFolder(false);
    if (error || !data) {
      toast({ title: "Não foi possível criar a pasta", description: error?.message, variant: "destructive" });
      return;
    }
    setFolders((prev) => [data as FolderRow, ...prev]);
    setSelectedFolderId(data.id);
    setCreatingFolder(false);
    setNewFolderName("");
  };

  const requests = useMemo(() => {
    const layer2 = assembleLayer2(selectedPresets);
    return generateAllRequests(
      { layer1: LAYER1_BASE, layer2, layer3: manualPrompt },
      garmentAnalysis,
      selectedProfile,
      selectedPresets,
      garmentType ?? undefined,
      accessories,
    );
  }, [selectedPresets, manualPrompt, garmentAnalysis, selectedProfile, garmentType, accessories]);

  const imageCount = requests.filter((r) => r.type !== "video-product" && r.type !== "video-model").length;

  const handleGenerate = () => {
    const folderId = selectedFolderId || initialFolderId || null;
    console.log("[LaunchFlowModal] Gerar pacote completo", { requestCount: requests.length, engine: selectedEngine, folderId });
    if (onFolderSelected) onFolderSelected(folderId);
    onGenerate(requests);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!isGenerating || o) onOpenChange(o); }}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-base">Novo lançamento — {STEP_TITLES[step - 1]}</DialogTitle>
        </DialogHeader>

        {/* Step dots */}
        <div className="px-6 py-3 border-b border-border flex items-center gap-3">
          {[1, 2, 3].map((i) => (
            <React.Fragment key={i}>
              <div className="flex items-center gap-2">
                <Dot index={i} state={dotState(i)} />
                <span className={cn("text-xs", step === i ? "font-medium text-foreground" : "text-muted-foreground")}>
                  {STEP_TITLES[i - 1]}
                </span>
              </div>
              {i < 3 && <div className="flex-1 h-px bg-border" />}
            </React.Fragment>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* STEP 1 — Fotos da peça */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Fotos da peça</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Envie 1 a 6 fotos do cabide. A IA analisa automaticamente.
                </p>
              </div>
              <UploadSection
                uploadedImages={uploadedImages}
                onImagesChange={onImagesChange}
                isAnalyzing={isAnalyzing}
                onAnalyze={onAnalyze}
                garmentAnalysis={garmentAnalysis}
                onAnalysisUpdate={onAnalysisUpdate}
                garmentType={garmentType}
                onGarmentTypeChange={onGarmentTypeChange}
                isCombo={isCombo}
                onIsComboChange={onIsComboChange}
                featuredPiece={featuredPiece}
                onFeaturedPieceChange={onFeaturedPieceChange}
              />
              {garmentAnalysis && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  <Check className="h-3.5 w-3.5" />
                  <span>
                    Peça analisada — {garmentAnalysis.type || "—"}, {garmentAnalysis.color || "—"}, {garmentAnalysis.silhouette || "—"}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* STEP 2 — Perfil de modelo */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Perfil de modelo</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Escolha a modelo para este lançamento.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {NEW_MODELS.map((m) => {
                  const isSelected = selectedProfile?.id === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onSelectModel(m.id)}
                      className={cn(
                        "text-left rounded-xl border p-3 bg-card transition-all flex items-center gap-3",
                        isSelected ? "border-foreground border-2 shadow-sm" : "border-border hover:border-foreground/40",
                      )}
                    >
                      <div
                        className="h-12 w-12 rounded-full shrink-0 flex items-center justify-center text-white text-sm font-medium"
                        style={{ backgroundColor: skinToneColor(m.skinTone) }}
                      >
                        {m.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{m.name}</p>
                        <p className="text-[10px] text-muted-foreground line-clamp-2">{m.description}</p>
                      </div>
                      {isSelected && (
                        <div className="ml-auto rounded-full bg-foreground text-background p-1">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3 — Cenário e geração */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold">Cenário e geração</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Escolha o fundo e gere as 6 fotos.</p>
              </div>

              {/* Background selector */}
              <div className="space-y-2">
                <Label className="text-xs">Fundo</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {BACKGROUNDS.map((bg) => {
                    const isSelected = selectedBg === bg.id;
                    return (
                      <button
                        key={bg.id}
                        type="button"
                        onClick={() => setSelectedBg(bg.id)}
                        className={cn(
                          "rounded-xl border p-3 text-left transition-all bg-card",
                          isSelected ? "border-foreground border-2 shadow-sm" : "border-border hover:border-foreground/40",
                        )}
                      >
                        <div className="text-2xl mb-1">{bg.emoji}</div>
                        <p className="text-xs font-medium">{bg.label}</p>
                        <p className="text-[10px] text-muted-foreground">{bg.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Folder selector */}
              {productId && (
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Folder className="h-3 w-3" /> Adicionar a uma pasta
                  </Label>
                  {!creatingFolder ? (
                    <div className="flex gap-2">
                      <Select
                        value={selectedFolderId || "none"}
                        onValueChange={(v) => {
                          if (v === "__new__") setCreatingFolder(true);
                          else setSelectedFolderId(v === "none" ? "" : v);
                        }}
                      >
                        <SelectTrigger className="h-9 text-xs flex-1">
                          <SelectValue placeholder="Sem pasta" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem pasta</SelectItem>
                          {folders.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.name} <span className="text-muted-foreground ml-1">· {f.folder_type}</span>
                            </SelectItem>
                          ))}
                          <SelectItem value="__new__">
                            <span className="flex items-center gap-1"><Plus className="h-3 w-3" /> Nova pasta…</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border p-3 space-y-2">
                      <Input
                        autoFocus
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Nome da pasta"
                        className="h-8 text-xs"
                      />
                      <div className="flex gap-1.5">
                        {FOLDER_TYPES.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setNewFolderType(t.id)}
                            className={cn(
                              "px-3 py-1 rounded-full text-xs border transition-colors",
                              newFolderType === t.id
                                ? "bg-foreground text-background border-foreground"
                                : "bg-transparent text-muted-foreground border-border hover:text-foreground",
                            )}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleCreateFolder} disabled={!newFolderName.trim() || savingFolder}>
                          {savingFolder ? <Loader2 className="h-3 w-3 animate-spin" /> : "Criar"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setCreatingFolder(false); setNewFolderName(""); }}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Cost + time */}
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Seedream 5.0 · ~$0.24 · ~40s</span>
                <span className="ml-auto">{imageCount} fotos serão geradas</span>
              </div>

              {/* Generate button */}
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !garmentAnalysis || !selectedProfile}
                className="w-full"
                size="lg"
              >
                {isGenerating ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Gerando…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> Gerar pacote completo — {imageCount} fotos
                  </span>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="border-t border-border px-6 py-3 flex items-center justify-between">
          {step > 1 && !isGenerating ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" /> Voltar
            </button>
          ) : <span />}

          {step < 3 ? (
            <Button
              onClick={() => setStep((s) => Math.min(3, s + 1))}
              disabled={(step === 1 && !canAdvanceFrom1) || (step === 2 && !canAdvanceFrom2)}
            >
              Próximo <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : <span />}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LaunchFlowModal;
