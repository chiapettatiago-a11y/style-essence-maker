import React, { useMemo, useState } from "react";
import { GeneratedImage, WeeklyLaunch } from "@/types/fashion";
import { Download, RefreshCw, Copy, Check, Loader2, ImageIcon, X, Video } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ResultsGridProps {
  weeklyLaunches: WeeklyLaunch[];
  onRegenerate: (id: string) => void;
}

const GalleryImage: React.FC<{ image: GeneratedImage; className?: string }> = ({ image, className }) => {
  const primarySrc = image.previewUrl || image.imageUrl || image.originalUrl || "";
  const fallbackSrc = image.originalUrl || image.imageUrl || image.previewUrl || "";
  const [src, setSrc] = useState(primarySrc);

  React.useEffect(() => {
    setSrc(primarySrc);
  }, [primarySrc]);

  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        <ImageIcon className="h-6 w-6 opacity-40" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={image.label}
      className={className}
      loading="lazy"
      onError={() => {
        if (src !== fallbackSrc && fallbackSrc) setSrc(fallbackSrc);
      }}
    />
  );
};

const ResultsGrid: React.FC<ResultsGridProps> = ({ weeklyLaunches, onRegenerate }) => {
  const [lightboxImage, setLightboxImage] = useState<GeneratedImage | null>(null);
  const [copied, setCopied] = useState(false);

  const allImages = useMemo(
    () => weeklyLaunches.flatMap((w) => w.images.filter((i) => i.type !== "video-product" && i.type !== "video-model")),
    [weeklyLaunches]
  );
  const allVideos = useMemo(
    () => weeklyLaunches.flatMap((w) => w.images.filter((i) => i.type === "video-product" || i.type === "video-model")),
    [weeklyLaunches]
  );

  if (allImages.length === 0 && allVideos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <ImageIcon className="h-12 w-12 opacity-30" />
        <p className="text-sm">Nenhum resultado ainda. Configure e gere o pacote acima.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Resultados Gerados</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {allImages.length} imagens • {allVideos.length} prompts de vídeo
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {allImages.map((img) => (
          <div
            key={img.id}
            className="relative group aspect-[9/16] rounded-xl overflow-hidden border border-border bg-muted flex items-center justify-center cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => img.status === "done" && (img.previewUrl || img.imageUrl || img.originalUrl) && setLightboxImage(img)}
          >
            {img.status === "done" && (img.previewUrl || img.imageUrl || img.originalUrl) ? (
              <GalleryImage image={img} className="w-full h-full object-cover" />
            ) : img.status === "generating" ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
                <span className="text-[10px] text-muted-foreground">Gerando...</span>
              </div>
            ) : img.status === "error" ? (
              <div className="flex flex-col items-center gap-2 p-3">
                <span className="text-[10px] text-destructive text-center">{img.error || "Erro"}</span>
                <Button variant="outline" size="sm" className="text-[10px] h-6" onClick={(e) => { e.stopPropagation(); onRegenerate(img.id); }}>
                  <RefreshCw className="h-2.5 w-2.5 mr-1" /> Tentar
                </Button>
              </div>
            ) : (
              <span className="text-[10px] text-muted-foreground">Pendente...</span>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/80 to-transparent p-2 pt-6">
              <p className="text-[10px] font-medium text-foreground truncate">{img.label}</p>
            </div>
            {img.status === "done" && (img.previewUrl || img.imageUrl || img.originalUrl) && (
              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const a = document.createElement("a"); a.href = img.originalUrl || img.imageUrl || img.previewUrl || ""; a.download = `${img.label}.png`; a.click();
                  }}
                  className="bg-background/80 rounded-full p-1 hover:bg-background"
                >
                  <Download className="h-3 w-3" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onRegenerate(img.id); }}
                  className="bg-background/80 rounded-full p-1 hover:bg-background"
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {allVideos.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium flex items-center gap-1.5">
            <Video className="h-3.5 w-3.5 text-accent" />
            Prompts de Vídeo
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {allVideos.map((vid) => (
              <div key={vid.id} className="border border-border rounded-lg p-3 bg-card space-y-2">
                <p className="text-xs font-medium">{vid.label}</p>
                <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap font-mono max-h-20 overflow-y-auto">
                  {vid.prompt.slice(0, 200)}...
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[10px] h-6"
                  onClick={() => {
                    navigator.clipboard.writeText(vid.prompt);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check className="h-2.5 w-2.5 mr-1" /> : <Copy className="h-2.5 w-2.5 mr-1" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-background/90 flex items-center justify-center p-6"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-2xl max-h-full flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-2 -right-2 bg-card border border-border rounded-full p-1 hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
            <GalleryImage image={lightboxImage} className="max-h-[80vh] object-contain rounded-lg shadow-xl" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{lightboxImage.label}</span>
              <Button variant="outline" size="sm" onClick={() => {
                const a = document.createElement("a"); a.href = lightboxImage.originalUrl || lightboxImage.imageUrl || lightboxImage.previewUrl || ""; a.download = `${lightboxImage.label}.png`; a.click();
              }}>
                <Download className="h-3 w-3 mr-1" /> Download
              </Button>
              <Button variant="outline" size="sm" onClick={() => { onRegenerate(lightboxImage.id); setLightboxImage(null); }}>
                <RefreshCw className="h-3 w-3 mr-1" /> Regenerar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsGrid;
