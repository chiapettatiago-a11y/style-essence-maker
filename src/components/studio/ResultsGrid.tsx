import React, { useMemo, useState } from "react";
import { GeneratedImage, GenerationEngine, WeeklyLaunch } from "@/types/fashion";
import { Download, RefreshCw, Copy, Check, Loader2, ImageIcon, X, Video, Sparkles, Layers3, ZoomIn, ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface ResultsGridProps {
  weeklyLaunches: WeeklyLaunch[];
  onRegenerate: (id: string, engine?: GenerationEngine) => void;
  onRegenerateAll?: (engine: GenerationEngine) => void;
}

const GalleryImage: React.FC<{ image: GeneratedImage; className?: string }> = ({ image, className }) => {
  const candidates = React.useMemo(
    () => [image.originalUrl, image.previewUrl, image.imageUrl].filter(Boolean) as string[],
    [image.originalUrl, image.previewUrl, image.imageUrl]
  );
  const [srcIndex, setSrcIndex] = useState(0);

  React.useEffect(() => {
    setSrcIndex(0);
  }, [candidates]);

  const src = candidates[srcIndex] || "";

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
        setSrcIndex((current) => (current < candidates.length - 1 ? current + 1 : current));
      }}
    />
  );
};

const ENGINE_OPTIONS: Array<{ id: GenerationEngine; label: string; Icon: typeof Sparkles }> = [
  { id: "gemini", label: "Gemini", Icon: Sparkles },
  { id: "fal", label: "fal.ai Flux", Icon: Layers3 },
];

const downloadFile = async (url: string, filename: string) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(blobUrl);
  } catch {
    // Fallback: open in new tab
    window.open(url, "_blank");
  }
};

const ResultsGrid: React.FC<ResultsGridProps> = ({ weeklyLaunches, onRegenerate, onRegenerateAll }) => {
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

  const hasDoneImages = allImages.some((img) => img.status === "done");

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
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Resultados Gerados</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {allImages.length} imagens • {allVideos.length} prompts de vídeo
          </p>
        </div>

        {hasDoneImages && onRegenerateAll && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs gap-1.5">
                <RefreshCw className="h-3 w-3" />
                Regenerar Todas
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {ENGINE_OPTIONS.map(({ id, label, Icon }) => (
                <DropdownMenuItem key={id} onClick={() => onRegenerateAll(id)} className="gap-2 text-xs">
                  <Icon className="h-3.5 w-3.5" />
                  Regenerar com {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {allImages.map((img) => (
          <div
            key={img.id}
            className="relative group aspect-[9/16] rounded-xl overflow-hidden border border-border bg-muted flex items-center justify-center cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => {
              if (img.status === "done" && (img.originalUrl || img.imageUrl || img.previewUrl)) {
                downloadFile(img.originalUrl || img.imageUrl || img.previewUrl || "", `${img.label}.png`);
              }
            }}
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="text-[10px] h-6" onClick={(e) => e.stopPropagation()}>
                      <RefreshCw className="h-2.5 w-2.5 mr-1" /> Regenerar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                    {ENGINE_OPTIONS.map(({ id, label, Icon }) => (
                      <DropdownMenuItem key={id} onClick={() => onRegenerate(img.id, id)} className="gap-2 text-xs">
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <span className="text-[10px] text-muted-foreground">Pendente...</span>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/80 to-transparent p-2 pt-6">
              <div className="flex items-center gap-1">
                {img.upscaled && (
                  <span className="inline-flex items-center gap-0.5 bg-accent/90 text-accent-foreground text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                    HD
                  </span>
                )}
                <p className="text-[10px] font-medium text-foreground truncate">{img.label}</p>
              </div>
            </div>
            {img.status === "done" && (img.previewUrl || img.imageUrl || img.originalUrl) && (
              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxImage(img);
                  }}
                  className="bg-background/80 rounded-full p-1 hover:bg-background"
                  title="Ampliar"
                >
                  <ZoomIn className="h-3 w-3" />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="bg-background/80 rounded-full p-1 hover:bg-background"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                    {ENGINE_OPTIONS.map(({ id, label, Icon }) => (
                      <DropdownMenuItem key={id} onClick={() => onRegenerate(img.id, id)} className="gap-2 text-xs">
                        <Icon className="h-3.5 w-3.5" />
                        Regenerar com {label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
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
            <GalleryImage image={lightboxImage} className="max-h-[80vh] object-contain rounded-lg shadow-xl" />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setLightboxImage(null)}>
                <ArrowLeft className="h-3 w-3 mr-1" /> Voltar
              </Button>
              <span className="text-sm font-medium">{lightboxImage.label}</span>
              <Button variant="outline" size="sm" onClick={() => {
                downloadFile(lightboxImage.originalUrl || lightboxImage.imageUrl || lightboxImage.previewUrl || "", `${lightboxImage.label}_HD.png`);
              }}>
                <Download className="h-3 w-3 mr-1" /> Download HD
              </Button>
              {lightboxImage.upscaled && lightboxImage.rawUrl && (
                <Button variant="outline" size="sm" onClick={() => {
                  downloadFile(lightboxImage.rawUrl!, `${lightboxImage.label}_raw.png`);
                }}>
                  <Download className="h-3 w-3 mr-1" /> Download Raw
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <RefreshCw className="h-3 w-3 mr-1" /> Regenerar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {ENGINE_OPTIONS.map(({ id, label, Icon }) => (
                    <DropdownMenuItem key={id} onClick={() => { onRegenerate(lightboxImage.id, id); setLightboxImage(null); }} className="gap-2 text-xs">
                      <Icon className="h-3.5 w-3.5" />
                      Regenerar com {label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsGrid;