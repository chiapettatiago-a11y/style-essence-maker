import React, { useCallback, useState } from "react";
import { Upload, X, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { compressImage, createThumbnail, blobToDataUrl } from "@/lib/image-compress";

interface UploadStepProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  analysisComplete: boolean;
}

const UploadStep: React.FC<UploadStepProps> = ({
  images,
  onImagesChange,
  isAnalyzing,
  onAnalyze,
  analysisComplete,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  const handleFiles = useCallback(
    (files: FileList) => {
      const toProcess = Array.from(files);
      Promise.all(
        toProcess.map(async (file) => {
          const [compressed, thumb] = await Promise.all([
            compressImage(file),
            createThumbnail(file),
          ]);
          const [fullUrl, thumbUrl] = await Promise.all([
            blobToDataUrl(compressed),
            blobToDataUrl(thumb),
          ]);
          return { fullUrl, thumbUrl };
        })
      ).then((results) => {
        const newThumbs: Record<string, string> = {};
        results.forEach((r) => { newThumbs[r.fullUrl] = r.thumbUrl; });
        setThumbnails((prev) => ({ ...prev, ...newThumbs }));
        onImagesChange([...images, ...results.map((r) => r.fullUrl)]);
      }).catch(() => {});
    },
    [images, onImagesChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const removeImage = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Upload da Peça</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Envie as imagens do produto para análise técnica automática.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer",
          dragOver
            ? "border-accent bg-accent/10"
            : "border-border hover:border-accent/50"
        )}
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/*";
          input.multiple = true;
          input.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files) handleFiles(files);
          };
          input.click();
        }}
      >
        <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">
          Arraste imagens aqui ou clique para selecionar
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {images.length} {images.length === 1 ? "imagem" : "imagens"} • PNG, JPG até 10MB
        </p>
      </div>

      {/* Preview grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {images.map((img, i) => (
            <div
              key={i}
              className="relative group aspect-square rounded-lg overflow-hidden bg-muted border border-border"
            >
              <img
                src={img}
                alt={`Produto ${i + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(i);
                }}
                className="absolute top-2 right-2 bg-background/80 backdrop-blur rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Button
        onClick={onAnalyze}
        disabled={images.length === 0 || isAnalyzing || analysisComplete}
        className="w-full"
        size="lg"
      >
        {isAnalyzing ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            Analisando peça...
          </span>
        ) : analysisComplete ? (
          <span className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Análise concluída ✓
          </span>
        ) : (
          "Analisar Peça"
        )}
      </Button>
    </div>
  );
};

export default UploadStep;
