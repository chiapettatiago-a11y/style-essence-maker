import React, { useState } from "react";
import { GeneratedImage } from "@/types/fashion";
import { Button } from "@/components/ui/button";
import { Copy, Check, Download, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResultsStepProps {
  images: GeneratedImage[];
  onRegenerate: (id: string) => void;
}

const ResultsStep: React.FC<ResultsStepProps> = ({ images, onRegenerate }) => {
  const [copied, setCopied] = useState<string | null>(null);

  const copyPrompt = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const downloadImage = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.png`;
    a.click();
  };

  const isVideo = (type: string) =>
    type === "video-product" || type === "video-model";

  const imageResults = images.filter((i) => !isVideo(i.type));
  const videoPrompts = images.filter((i) => isVideo(i.type));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Resultados</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Galeria de imagens geradas e prompts de vídeo.
        </p>
      </div>

      {/* Image grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {imageResults.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <div className="aspect-video bg-muted relative flex items-center justify-center">
              {item.status === "generating" && (
                <Loader2 className="h-8 w-8 text-accent animate-spin" />
              )}
              {item.status === "done" && item.imageUrl && (
                <img
                  src={item.imageUrl}
                  alt={item.label}
                  className="w-full h-full object-cover"
                />
              )}
              {item.status === "error" && (
                <p className="text-xs text-destructive px-4 text-center">
                  {item.error || "Erro na geração"}
                </p>
              )}
              {item.status === "pending" && (
                <p className="text-xs text-muted-foreground">Aguardando...</p>
              )}
            </div>
            <div className="p-3 flex items-center justify-between">
              <span className="text-xs font-medium truncate">{item.label}</span>
              <div className="flex gap-1">
                {item.status === "done" && item.imageUrl && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => downloadImage(item.imageUrl!, item.label)}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onRegenerate(item.id)}
                  disabled={item.status === "generating"}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Video prompts */}
      {videoPrompts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Prompts de Vídeo</h3>
          <p className="text-xs text-muted-foreground">
            Copie e use em ferramentas de geração de vídeo externas.
          </p>
          {videoPrompts.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-border bg-card p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{item.label}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyPrompt(item.id, item.prompt)}
                  className="h-7 text-xs"
                >
                  {copied === item.id ? (
                    <Check className="h-3 w-3 mr-1" />
                  ) : (
                    <Copy className="h-3 w-3 mr-1" />
                  )}
                  {copied === item.id ? "Copiado" : "Copiar"}
                </Button>
              </div>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                {item.prompt}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ResultsStep;
