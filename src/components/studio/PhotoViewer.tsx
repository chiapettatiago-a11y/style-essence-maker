import React, { useCallback, useEffect, useState } from "react";
import { GeneratedImage, GenerationEngine, ModelProfile } from "@/types/fashion";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Download, Loader2, RefreshCw, UserRound, X, Sparkles, Layers3 } from "lucide-react";
import { GalleryModel, MODEL_GALLERY } from "@/data/model-gallery";
import { cn } from "@/lib/utils";

const SCENE_OPTIONS = [
  { id: "estudio-branco", label: "Estúdio Branco Puro", icon: "⬜" },
  { id: "estudio-neutro-bege", label: "Estúdio Neutro Bege", icon: "🟫" },
  { id: "urbano-contemporaneo", label: "Urbano Contemporâneo", icon: "🏙️" },
  { id: "natureza-suave", label: "Natureza Suave", icon: "🌿" },
];

const ENGINE_OPTIONS: Array<{ id: GenerationEngine; label: string; detail: string }> = [
  { id: "gemini", label: "Gemini", detail: "Google Gemini — alta qualidade" },
  { id: "fal", label: "fal.ai Flux", detail: "fal.ai — Flux Kontext" },
];

interface PhotoViewerProps {
  images: GeneratedImage[];
  initialIndex: number;
  onClose: () => void;
  onApprove: (id: string) => void;
  onDownload: (image: GeneratedImage) => void;
  onRegenerate: (id: string, engine?: GenerationEngine, model?: ModelProfile | null) => void;
  onGenerateSingle?: (id: string, sceneOverride?: string) => void;
  isDownloading?: boolean;
}

const PhotoViewer: React.FC<PhotoViewerProps> = ({
  images,
  initialIndex,
  onClose,
  onApprove,
  onDownload,
  onRegenerate,
  onGenerateSingle,
  isDownloading,
}) => {
  const [index, setIndex] = useState(initialIndex);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"regenerate" | "model">("regenerate");

  const current = images[index];
  if (!current) return null;

  const goNext = useCallback(() => setIndex((i) => Math.min(i + 1, images.length - 1)), [images.length]);
  const goPrev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, goNext, goPrev]);

  const isApproved = current.approvalStatus === "approved";

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/60 backdrop-blur-sm border-b border-white/10 shrink-0">
        <Button variant="ghost" size="sm" className="text-white/80 hover:text-white gap-1.5" onClick={onClose}>
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/80 font-medium">{current.label}</span>
          <span className="text-xs text-white/50">{index + 1}/{images.length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {current.status === "done" && (
            <>
              <Button
                variant={isApproved ? "default" : "secondary"}
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => onApprove(current.id)}
              >
                <Check className="h-3.5 w-3.5" />
                {isApproved ? "Aprovada" : "Aprovar"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => onDownload(current)}
                disabled={isDownloading}
              >
                {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Baixar
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => { setDrawerMode("regenerate"); setDrawerOpen(true); }}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Regenerar
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => { setDrawerMode("model"); setDrawerOpen(true); }}
              >
                <UserRound className="h-3.5 w-3.5" /> Trocar modelo
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main image area */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {/* Left arrow */}
        {index > 0 && (
          <button
            onClick={goPrev}
            className="absolute left-4 z-10 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <ChevronLeft className="h-6 w-6 text-white" />
          </button>
        )}

        {/* Image */}
        {current.status === "done" && (current.originalUrl || current.imageUrl) ? (
          <img
            src={current.originalUrl || current.imageUrl}
            alt={current.label}
            className="max-h-full max-w-full object-contain"
            onError={(e) => {
              const target = e.currentTarget;
              if (current.imageUrl && target.src !== current.imageUrl) {
                target.src = current.imageUrl;
              }
            }}
          />
        ) : current.status === "generating" ? (
          <Loader2 className="h-10 w-10 animate-spin text-white/60" />
        ) : current.status === "error" ? (
          <div className="text-center text-white/60 space-y-2">
            <p className="text-sm">{current.error || "Erro na geração"}</p>
            <Button variant="secondary" size="sm" onClick={() => { setDrawerMode("regenerate"); setDrawerOpen(true); }}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Regenerar
            </Button>
          </div>
        ) : (
          <p className="text-white/40 text-sm">Aguardando geração</p>
        )}

        {/* Right arrow */}
        {index < images.length - 1 && (
          <button
            onClick={goNext}
            className="absolute right-4 z-10 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <ChevronRight className="h-6 w-6 text-white" />
          </button>
        )}
      </div>

      {/* Thumbnail strip */}
      <div className="shrink-0 bg-black/60 backdrop-blur-sm border-t border-white/10 px-4 py-2 flex gap-2 overflow-x-auto justify-center">
        {images.map((img, i) => (
          <button
            key={img.id}
            onClick={() => setIndex(i)}
            className={cn(
              "shrink-0 w-12 h-16 rounded-md overflow-hidden border-2 transition-all",
              i === index ? "border-white" : "border-transparent opacity-60 hover:opacity-80"
            )}
          >
            {img.status === "done" && (img.previewUrl || img.imageUrl) ? (
              <img src={img.previewUrl || img.imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-white/10 flex items-center justify-center">
                <span className="text-[8px] text-white/40">{img.label.substring(0, 3)}</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Regenerate / Model drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-80">
          <SheetHeader>
            <SheetTitle>{drawerMode === "model" ? "Trocar Modelo" : "Regenerar Foto"}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            {/* Model selector — always shown */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Modelo</h4>
              <div className="grid grid-cols-2 gap-2">
                {MODEL_GALLERY.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      onRegenerate(current.id, undefined, m);
                      setDrawerOpen(false);
                    }}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg border border-border hover:border-accent transition-colors"
                  >
                    <img src={m.faceImage} alt={m.name} className="h-10 w-10 rounded-full object-cover" />
                    <span className="text-[10px] font-medium text-center leading-tight">{m.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {drawerMode === "regenerate" && (
              <>
                {/* Scene selector */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cenário</h4>
                  <div className="space-y-1">
                    {SCENE_OPTIONS.map((scene) => (
                      <button
                        key={scene.id}
                        onClick={() => {
                          if (onGenerateSingle) {
                            onGenerateSingle(current.id, scene.id);
                            setDrawerOpen(false);
                          }
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted text-xs transition-colors"
                      >
                        <span>{scene.icon}</span>
                        {scene.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Engine selector */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Motor</h4>
                  <div className="space-y-1">
                    {ENGINE_OPTIONS.map((eng) => (
                      <button
                        key={eng.id}
                        onClick={() => {
                          onRegenerate(current.id, eng.id);
                          setDrawerOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted transition-colors"
                      >
                        {eng.id === "gemini" ? <Sparkles className="h-3.5 w-3.5" /> : <Layers3 className="h-3.5 w-3.5" />}
                        <div className="text-left">
                          <p className="text-xs font-medium">{eng.label}</p>
                          <p className="text-[10px] text-muted-foreground">{eng.detail}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default PhotoViewer;
