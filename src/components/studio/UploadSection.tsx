import React, { useState, useCallback, useRef } from "react";
import { GarmentAnalysis } from "@/types/fashion";
import { Upload, X, ImageIcon, Sparkles, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const GARMENT_TYPE_OPTIONS = [
  { value: "vestido-longo", label: "Vestido Longo" },
  { value: "vestido-curto", label: "Vestido Curto" },
  { value: "vestido-midi", label: "Vestido Midi" },
  { value: "conjunto", label: "Conjunto (2 peças)" },
  { value: "blusa", label: "Blusa" },
  { value: "saia", label: "Saia" },
  { value: "calca", label: "Calça" },
  { value: "macacao", label: "Macacão" },
  { value: "outro", label: "Outro" },
] as const;

export type GarmentTypeValue = typeof GARMENT_TYPE_OPTIONS[number]["value"];

interface UploadSectionProps {
  uploadedImages: string[];
  onImagesChange: (images: string[]) => void;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  garmentAnalysis: GarmentAnalysis | null;
  onAnalysisUpdate: (a: GarmentAnalysis) => void;
  garmentType: string | null;
  onGarmentTypeChange: (type: string) => void;
}

const analysisFields: { key: keyof GarmentAnalysis; label: string }[] = [
  { key: "type", label: "Tipo" },
  { key: "fabric", label: "Tecido" },
  { key: "color", label: "Cor" },
  { key: "length", label: "Comprimento" },
  { key: "silhouette", label: "Silhueta" },
  { key: "neckline", label: "Decote/Gola" },
  { key: "sleeves", label: "Mangas" },
  { key: "hemline", label: "Barra" },
  { key: "pattern", label: "Padrão" },
  { key: "construction", label: "Construção" },
  { key: "style", label: "Estilo" },
];

const UploadSection: React.FC<UploadSectionProps> = ({
  uploadedImages, onImagesChange, isAnalyzing, onAnalyze, garmentAnalysis, onAnalysisUpdate, garmentType, onGarmentTypeChange,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList) => {
    const selectedFiles = Array.from(files);
    Promise.all(
      selectedFiles.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve((e.target?.result as string) || "");
            reader.onerror = () => reject(new Error(`Falha ao ler ${file.name}`));
            reader.readAsDataURL(file);
          })
      )
    )
      .then((results) => {
        const nextImages = results.filter(Boolean);
        if (nextImages.length > 0) {
          onImagesChange([...uploadedImages, ...nextImages]);
        }
      })
      .catch(() => {});
  }, [uploadedImages, onImagesChange]);

  const removeImage = (index: number) => {
    onImagesChange(uploadedImages.filter((_, i) => i !== index));
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const hasImages = uploadedImages.length > 0;

  return (
    <div className="space-y-5">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }}
      />

      {/* Main upload area - MAGION style */}
      {!hasImages ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
          onClick={openFilePicker}
          className={cn(
            "border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all",
            dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/50 hover:bg-muted/30"
          )}
        >
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Upload className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-base font-semibold mb-1">Arraste as fotos da peça aqui</h3>
          <p className="text-sm text-muted-foreground">ou clique para selecionar • PNG, JPG, WEBP</p>
          <p className="text-xs text-muted-foreground/60 mt-2">Envie quantas fotos quiser — frente, costas, detalhes, etiqueta</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Fotos de referência</h3>
              <p className="text-xs text-muted-foreground">{uploadedImages.length} foto{uploadedImages.length !== 1 ? "s" : ""} adicionada{uploadedImages.length !== 1 ? "s" : ""}</p>
            </div>
            <Button variant="outline" size="sm" onClick={openFilePicker} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Adicionar mais
            </Button>
          </div>

          {/* Image grid with larger previews */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
            className={cn(
              "grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 p-3 rounded-xl border-2 border-dashed transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-transparent"
            )}
          >
            {uploadedImages.map((img, i) => (
              <div key={i} className="relative group aspect-[3/4] rounded-lg overflow-hidden border border-border bg-card shadow-sm">
                <img src={img} alt={`Ref ${i + 1}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-sm rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] text-white font-medium">Foto {i + 1}</span>
                </div>
              </div>
            ))}

            {/* Add more card */}
            <button
              onClick={openFilePicker}
              className="aspect-[3/4] rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-primary transition-colors bg-muted/20"
            >
              <Plus className="h-5 w-5" />
              <span className="text-[10px] font-medium">Adicionar</span>
            </button>
          </div>
        </div>
      )}

      {/* Analyze button */}
      {hasImages && (
        <div className="flex items-center gap-3">
          <Button
            onClick={onAnalyze}
            disabled={uploadedImages.length === 0 || isAnalyzing || !!garmentAnalysis}
            size="sm"
            className={cn(
              garmentAnalysis ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""
            )}
          >
            {isAnalyzing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Analisando peça...
              </span>
            ) : garmentAnalysis ? (
              <span className="flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> Análise concluída</span>
            ) : (
              <span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Analisar Peça com IA</span>
            )}
          </Button>
          {garmentAnalysis && (
            <Button
              variant="outline"
              size="sm"
              disabled={isAnalyzing}
              onClick={() => {
                onAnalysisUpdate(null as any);
                setTimeout(() => onAnalyze(), 100);
              }}
              className="gap-1"
            >
              <Sparkles className="h-3 w-3" /> Re-analisar
            </Button>
          )}
          {!garmentAnalysis && !isAnalyzing && (
            <p className="text-xs text-muted-foreground">A IA vai identificar tipo, tecido, cor e detalhes da peça</p>
          )}
        </div>
      )}

      {/* Analysis results */}
      {garmentAnalysis && (
        <div className="border border-border rounded-xl p-4 bg-card/80 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center">
              <ImageIcon className="h-3.5 w-3.5 text-accent" />
            </div>
            <h4 className="text-xs font-semibold">Análise Técnica da Peça</h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {analysisFields.map((f) => (
              <div key={f.key} className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">{f.label}</Label>
                <Input
                  value={garmentAnalysis[f.key]}
                  onChange={(e) => onAnalysisUpdate({ ...garmentAnalysis, [f.key]: e.target.value })}
                  className="text-xs h-7"
                />
              </div>
            ))}
          </div>
          <div className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">Detalhes</Label>
            <Textarea
              value={garmentAnalysis.details}
              onChange={(e) => onAnalysisUpdate({ ...garmentAnalysis, details: e.target.value })}
              rows={2}
              className="text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadSection;
