import React, { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Upload, X, ArrowRight, ArrowLeft, Check, ImagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { compressImage, blobToDataUrl } from "@/lib/image-compress";
import { useToast } from "@/hooks/use-toast";
import { ProductVariant, GarmentAnalysis } from "@/types/fashion";

interface NewVariantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  isCombo: boolean;
  originalVariant: ProductVariant | null;
  garmentType?: string | null;
  onVariantCreated: (variant: ProductVariant) => void;
}

const UPPER_BODY_TYPES = /jacket|jaqueta|blazer|blouse|blusa|shirt|camisa|top|cardigan|coat|casaco|vest|colete/i;

export default function NewVariantModal({
  open,
  onOpenChange,
  projectId,
  isCombo,
  originalVariant,
  garmentType,
  onVariantCreated,
}: NewVariantModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [colorName, setColorName] = useState("");
  const [colorHex, setColorHex] = useState("#000000");
  const [material, setMaterial] = useState<"same" | "other">("same");
  const [otherMaterial, setOtherMaterial] = useState("");

  // Step 2
  const [photos, setPhotos] = useState<string[]>([]);
  const [photosTop, setPhotosTop] = useState<string[]>([]);
  const [photosBottom, setPhotosBottom] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputTopRef = useRef<HTMLInputElement>(null);
  const fileInputBottomRef = useRef<HTMLInputElement>(null);

  // Step 3
  const [companionChoice, setCompanionChoice] = useState<"same" | "new">("same");
  const [companionPhoto, setCompanionPhoto] = useState<string | null>(null);
  const [companionDescription, setCompanionDescription] = useState("");
  const companionFileRef = useRef<HTMLInputElement>(null);

  const needsCompanionStep = !isCombo && garmentType && UPPER_BODY_TYPES.test(garmentType);
  const totalSteps = needsCompanionStep ? 3 : 2;

  const handleFileUpload = useCallback(async (
    files: FileList | null,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    max: number,
    current: string[],
  ) => {
    if (!files) return;
    const remaining = max - current.length;
    const toProcess = Array.from(files).slice(0, remaining);

    for (const file of toProcess) {
      try {
        const compressed = await compressImage(file);
        const dataUrl = await blobToDataUrl(compressed);
        setter((prev) => [...prev, dataUrl]);
      } catch {
        toast({ title: "Erro", description: `Falha ao processar ${file.name}`, variant: "destructive" });
      }
    }
  }, [toast]);

  const handleCompanionUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const compressed = await compressImage(files[0]);
      const dataUrl = await blobToDataUrl(compressed);
      setCompanionPhoto(dataUrl);
    } catch {
      toast({ title: "Erro", description: "Falha ao processar foto", variant: "destructive" });
    }
  }, [toast]);

  const removePhoto = (setter: React.Dispatch<React.SetStateAction<string[]>>, index: number) => {
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  const canProceedStep1 = colorName.trim().length > 0;
  const canProceedStep2 = isCombo
    ? photosTop.length > 0 && photosBottom.length > 0
    : photos.length > 0;

  const resetForm = () => {
    setStep(1);
    setColorName("");
    setColorHex("#000000");
    setMaterial("same");
    setOtherMaterial("");
    setPhotos([]);
    setPhotosTop([]);
    setPhotosBottom([]);
    setCompanionChoice("same");
    setCompanionPhoto(null);
    setCompanionDescription("");
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      // Upload photos to storage
      const uploadedUrls: string[] = [];
      const allPhotos = isCombo ? [...photosTop, ...photosBottom] : photos;

      for (const dataUrl of allPhotos) {
        const match = dataUrl.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (!match) continue;
        const ext = match[1] === "jpeg" ? "jpg" : match[1];
        const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
        const objectPath = `variants/${projectId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("generated-assets").upload(objectPath, bytes, {
          contentType: `image/${match[1]}`,
          cacheControl: "3600",
          upsert: true,
        });
        if (!error) {
          const { data: { publicUrl } } = supabase.storage.from("generated-assets").getPublicUrl(objectPath);
          uploadedUrls.push(publicUrl);
        }
      }

      // Upload companion photo if any
      let companionUrl: string | null = null;
      if (companionPhoto && companionChoice === "new") {
        const match = companionPhoto.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (match) {
          const ext = match[1] === "jpeg" ? "jpg" : match[1];
          const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
          const objectPath = `variants/${projectId}/companion-${crypto.randomUUID()}.${ext}`;
          const { error } = await supabase.storage.from("generated-assets").upload(objectPath, bytes, {
            contentType: `image/${match[1]}`,
            cacheControl: "3600",
            upsert: true,
          });
          if (!error) {
            const { data: { publicUrl } } = supabase.storage.from("generated-assets").getPublicUrl(objectPath);
            companionUrl = publicUrl;
          }
        }
      }

      // Build variant data inheriting proportions from original
      const proportionJson = originalVariant?.proportionJson || null;
      const materialNote = material === "other" ? otherMaterial : null;

      // Upload top/bottom reference photos separately for combos
      let refPhotosTop: string[] = [];
      let refPhotosBottom: string[] = [];
      if (isCombo) {
        for (const dataUrl of photosTop) {
          const match = dataUrl.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/);
          if (!match) continue;
          const ext = match[1] === "jpeg" ? "jpg" : match[1];
          const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
          const objectPath = `variants/${projectId}/top-${crypto.randomUUID()}.${ext}`;
          const { error } = await supabase.storage.from("generated-assets").upload(objectPath, bytes, {
            contentType: `image/${match[1]}`,
            cacheControl: "3600",
            upsert: true,
          });
          if (!error) {
            const { data: { publicUrl } } = supabase.storage.from("generated-assets").getPublicUrl(objectPath);
            refPhotosTop.push(publicUrl);
          }
        }
        for (const dataUrl of photosBottom) {
          const match = dataUrl.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/);
          if (!match) continue;
          const ext = match[1] === "jpeg" ? "jpg" : match[1];
          const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
          const objectPath = `variants/${projectId}/bottom-${crypto.randomUUID()}.${ext}`;
          const { error } = await supabase.storage.from("generated-assets").upload(objectPath, bytes, {
            contentType: `image/${match[1]}`,
            cacheControl: "3600",
            upsert: true,
          });
          if (!error) {
            const { data: { publicUrl } } = supabase.storage.from("generated-assets").getPublicUrl(objectPath);
            refPhotosBottom.push(publicUrl);
          }
        }
      }

      const insertData: Record<string, unknown> = {
        product_id: projectId,
        color_name: colorName.trim(),
        sort_order: (originalVariant?.sortOrder ?? 0) + 1,
        uploaded_images: uploadedUrls,
        proportion_json: proportionJson,
        garment_type: originalVariant?.garmentType || null,
        garment_length: originalVariant?.garmentLength || null,
        garment_length_cm: originalVariant?.garmentLengthCm || null,
        hem_below_knee_cm: originalVariant?.hemBelowKneeCm || null,
        waist_position_cm: originalVariant?.waistPositionCm || null,
        sleeve_length_cm: originalVariant?.sleeveLengthCm || null,
        sleeve_type: originalVariant?.sleeveType || null,
        shoulder_width_cm: originalVariant?.shoulderWidthCm || null,
        fabric_texture: materialNote || originalVariant?.fabricTexture || null,
        tr_badge_location: originalVariant?.trBadgeLocation || null,
      };

      if (isCombo) {
        insertData.reference_photos_top = refPhotosTop;
        insertData.reference_photos_bottom = refPhotosBottom;
      }

      const { data, error } = await supabase
        .from("product_variants")
        .insert(insertData)
        .select("*")
        .single();

      if (error) throw new Error(error.message);

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
        trBadgeLocation: data.tr_badge_location,
        fabricTexture: data.fabric_texture,
      };

      toast({ title: "Variante criada", description: `Cor "${colorName}" adicionada com sucesso.` });
      onVariantCreated(newVariant);
      resetForm();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao criar variante";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const PhotoGrid = ({
    label,
    photos: gridPhotos,
    setPhotos: setGridPhotos,
    inputRef,
    max = 3,
  }: {
    label: string;
    photos: string[];
    setPhotos: React.Dispatch<React.SetStateAction<string[]>>;
    inputRef: React.RefObject<HTMLInputElement>;
    max?: number;
  }) => (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="grid grid-cols-3 gap-2">
        {gridPhotos.map((photo, i) => (
          <div key={i} className="relative aspect-[3/4] rounded-md overflow-hidden bg-muted border">
            <img src={photo} alt="" className="w-full h-full object-cover" />
            <button
              onClick={() => removePhoto(setGridPhotos, i)}
              className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 hover:bg-destructive hover:text-destructive-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {gridPhotos.length < max && (
          <button
            onClick={() => inputRef.current?.click()}
            className="aspect-[3/4] rounded-md border-2 border-dashed border-border hover:border-accent flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ImagePlus className="h-5 w-5" />
            <span className="text-[10px]">Adicionar</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files, setGridPhotos, max, gridPhotos)}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) { onOpenChange(v); if (!v) resetForm(); } }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            Nova Cor — Etapa {step} de {totalSteps}
          </DialogTitle>
        </DialogHeader>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 pb-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i + 1 === step ? "w-6 bg-accent" : i + 1 < step ? "w-4 bg-accent/50" : "w-4 bg-muted"
              }`}
            />
          ))}
        </div>

        {/* STEP 1: Color Information */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="color-name">Nome da cor</Label>
              <Input
                id="color-name"
                placeholder="Ex: Caramelo, Off-white, Verde Musgo"
                value={colorName}
                onChange={(e) => setColorName(e.target.value)}
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="color-hex">Cor aproximada</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="color-hex"
                  value={colorHex}
                  onChange={(e) => setColorHex(e.target.value)}
                  className="w-10 h-10 rounded-md border cursor-pointer"
                />
                <Input
                  value={colorHex}
                  onChange={(e) => setColorHex(e.target.value)}
                  className="w-28 font-mono text-sm"
                  maxLength={7}
                />
                <div
                  className="w-10 h-10 rounded-md border"
                  style={{ backgroundColor: colorHex }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Material</Label>
              <Select value={material} onValueChange={(v) => setMaterial(v as "same" | "other")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="same">Mesmo da peça original</SelectItem>
                  <SelectItem value="other">Outro material</SelectItem>
                </SelectContent>
              </Select>
              {material === "other" && (
                <Input
                  placeholder="Descreva o material"
                  value={otherMaterial}
                  onChange={(e) => setOtherMaterial(e.target.value)}
                  maxLength={100}
                />
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Reference Photos */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Envie fotos da peça nesta cor. Pelo menos 1 foto é necessária.
            </p>

            {isCombo ? (
              <>
                <PhotoGrid
                  label="Fotos da parte de cima — nova cor"
                  photos={photosTop}
                  setPhotos={setPhotosTop}
                  inputRef={fileInputTopRef as React.RefObject<HTMLInputElement>}
                />
                <PhotoGrid
                  label="Fotos da parte de baixo — nova cor"
                  photos={photosBottom}
                  setPhotos={setPhotosBottom}
                  inputRef={fileInputBottomRef as React.RefObject<HTMLInputElement>}
                />
              </>
            ) : (
              <PhotoGrid
                label="Fotos de referência — nova cor"
                photos={photos}
                setPhotos={setPhotos}
                inputRef={fileInputRef as React.RefObject<HTMLInputElement>}
              />
            )}
          </div>
        )}

        {/* STEP 3: Companion Piece */}
        {step === 3 && needsCompanionStep && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Como a peça principal é um(a) {garmentType}, defina a peça de acompanhamento:
            </p>

            <RadioGroup value={companionChoice} onValueChange={(v) => setCompanionChoice(v as "same" | "new")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="same" id="companion-same" />
                <Label htmlFor="companion-same" className="text-sm cursor-pointer">
                  Manter a mesma da variante original
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="new" id="companion-new" />
                <Label htmlFor="companion-new" className="text-sm cursor-pointer">
                  Indicar nova peça de acompanhamento
                </Label>
              </div>
            </RadioGroup>

            {companionChoice === "new" && (
              <div className="space-y-3 pl-6 border-l-2 border-accent/30">
                <div className="space-y-2">
                  <Label>Foto da peça de acompanhamento</Label>
                  {companionPhoto ? (
                    <div className="relative w-24 aspect-[3/4] rounded-md overflow-hidden border">
                      <img src={companionPhoto} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setCompanionPhoto(null)}
                        className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => companionFileRef.current?.click()}
                      className="w-24 aspect-[3/4] rounded-md border-2 border-dashed flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <Upload className="h-4 w-4" />
                      <span className="text-[10px]">Upload</span>
                    </button>
                  )}
                  <input
                    ref={companionFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => handleCompanionUpload(e.target.files)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descreva a peça de acompanhamento</Label>
                  <Input
                    placeholder="Ex: Saia midi preta, tecido crepe"
                    value={companionDescription}
                    onChange={(e) => setCompanionDescription(e.target.value)}
                    maxLength={200}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-2">
          {step > 1 ? (
            <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Voltar
            </Button>
          ) : (
            <div />
          )}

          {step < totalSteps ? (
            <Button
              size="sm"
              onClick={() => setStep(step + 1)}
              disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
            >
              Próximo <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={saving || (step === 2 && !canProceedStep2)}
            >
              {saving ? "Salvando..." : "Criar variante"}
              {!saving && <Check className="h-3.5 w-3.5 ml-1" />}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
