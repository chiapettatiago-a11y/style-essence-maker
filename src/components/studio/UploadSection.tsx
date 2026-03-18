import React, { useState, useCallback } from "react";
import { GarmentAnalysis } from "@/types/fashion";
import { Upload, X, ImageIcon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface UploadSectionProps {
  uploadedImages: string[];
  onImagesChange: (images: string[]) => void;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  garmentAnalysis: GarmentAnalysis | null;
  onAnalysisUpdate: (a: GarmentAnalysis) => void;
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
  uploadedImages, onImagesChange, isAnalyzing, onAnalyze, garmentAnalysis, onAnalysisUpdate,
}) => {
  const [dragOver, setDragOver] = useState(false);

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
      .catch(() => {
        // silencioso por enquanto: o componente pai já lida com o estado visual
      });
  }, [uploadedImages, onImagesChange]);

  const removeImage = (index: number) => {
    onImagesChange(uploadedImages.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Fotos de Referência da Peça</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Envie até 3 fotos da peça original para análise
        </p>
      </div>

      <div className="flex gap-3 items-start">
        {/* Upload area */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file"; input.accept = "image/*"; input.multiple = true;
            input.onchange = (e) => { const files = (e.target as HTMLInputElement).files; if (files) handleFiles(files); };
            input.click();
          }}
          className={cn(
            "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all min-w-[140px]",
            dragOver ? "border-accent bg-accent/10" : "border-border hover:border-accent/50",
            uploadedImages.length > 0 ? "w-[140px]" : "flex-1"
          )}
        >
          <Upload className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
          <p className="text-xs font-medium">Arraste ou clique</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">PNG, JPG</p>
        </div>

        {/* Uploaded image thumbnails */}
        {uploadedImages.length > 0 && (
          <div className="flex gap-2 flex-wrap flex-1">
            {uploadedImages.map((img, i) => (
              <div key={i} className="relative group w-[100px] aspect-square rounded-lg overflow-hidden border border-border">
                <img src={img} alt={`Ref ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Analyze button */}
      <div className="flex gap-2">
        <Button
          onClick={onAnalyze}
          disabled={uploadedImages.length === 0 || isAnalyzing || !!garmentAnalysis}
          size="sm"
        >
          {isAnalyzing ? (
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Analisando...
            </span>
          ) : garmentAnalysis ? (
            <span className="flex items-center gap-1.5"><ImageIcon className="h-3 w-3" /> Análise concluída ✓</span>
          ) : (
            "Analisar Peça"
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
          >
            <Sparkles className="h-3 w-3 mr-1" /> Re-analisar
          </Button>
        )}
      </div>

      {/* Analysis results - compact horizontal */}
      {garmentAnalysis && (
        <div className="border border-border rounded-xl p-4 bg-card space-y-3">
          <h4 className="text-xs font-semibold text-accent">Análise Técnica da Peça</h4>
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
