import React from "react";
import { GeneratedImage, WeeklyLaunch } from "@/types/fashion";
import { Download, RefreshCw, Copy, Check, Loader2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PreviewPanelProps {
  selectedAssetId: string | null;
  uploadedImages: string[];
  weeklyLaunches: WeeklyLaunch[];
  onRegenerate: (id: string) => void;
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({
  selectedAssetId,
  uploadedImages,
  weeklyLaunches,
  onRegenerate,
}) => {
  const [copied, setCopied] = React.useState(false);

  // Find the selected asset
  let content: React.ReactNode = null;
  let selectedImage: GeneratedImage | null = null;

  if (selectedAssetId?.startsWith("upload-")) {
    const idx = parseInt(selectedAssetId.replace("upload-", ""));
    const img = uploadedImages[idx];
    if (img) {
      content = (
        <div className="flex items-center justify-center h-full p-6">
          <img
            src={img}
            alt={`Produto ${idx + 1}`}
            className="max-h-full max-w-full object-contain rounded-lg shadow-lg"
          />
        </div>
      );
    }
  } else if (selectedAssetId) {
    for (const w of weeklyLaunches) {
      const found = w.images.find((i) => i.id === selectedAssetId);
      if (found) {
        selectedImage = found;
        break;
      }
    }
  }

  if (selectedImage) {
    const isVideo = selectedImage.type === "video-product" || selectedImage.type === "video-model";

    if (isVideo) {
      content = (
        <div className="flex flex-col items-center justify-center h-full p-6 gap-4">
          <div className="text-center space-y-3 max-w-lg">
            <h3 className="text-lg font-semibold">{selectedImage.label}</h3>
            <p className="text-xs text-muted-foreground">
              Prompt para uso em ferramentas externas de vídeo.
            </p>
            <div className="bg-card border border-border rounded-lg p-4 text-left">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                {selectedImage.prompt}
              </pre>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(selectedImage!.prompt);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
              {copied ? "Copiado" : "Copiar Prompt"}
            </Button>
          </div>
        </div>
      );
    } else if (selectedImage.status === "done" && selectedImage.imageUrl) {
      content = (
        <div className="flex flex-col items-center justify-center h-full p-6 gap-3">
          <div className="flex-1 flex items-center justify-center min-h-0">
            <img
              src={selectedImage.imageUrl}
              alt={selectedImage.label}
              className="max-h-full max-w-full object-contain rounded-lg shadow-lg"
            />
          </div>
          <div className="flex items-center gap-2 pt-2">
            <span className="text-sm font-medium mr-2">{selectedImage.label}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const a = document.createElement("a");
                a.href = selectedImage!.imageUrl!;
                a.download = `${selectedImage!.label}.png`;
                a.click();
              }}
            >
              <Download className="h-3 w-3 mr-1" />
              Download
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRegenerate(selectedImage!.id)}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Regenerar
            </Button>
          </div>
        </div>
      );
    } else if (selectedImage.status === "generating") {
      content = (
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <span className="text-sm text-muted-foreground">Gerando {selectedImage.label}...</span>
        </div>
      );
    } else if (selectedImage.status === "error") {
      content = (
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <p className="text-sm text-destructive">{selectedImage.error || "Erro na geração"}</p>
          <Button variant="outline" size="sm" onClick={() => onRegenerate(selectedImage!.id)}>
            <RefreshCw className="h-3 w-3 mr-1" /> Tentar Novamente
          </Button>
        </div>
      );
    }
  }

  if (!content) {
    content = (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <ImageIcon className="h-12 w-12 opacity-30" />
        <p className="text-sm">Selecione um asset ou gere novas imagens</p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background flex flex-col min-h-0">
      {content}
    </div>
  );
};

export default PreviewPanel;
