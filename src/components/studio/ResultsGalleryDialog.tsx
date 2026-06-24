import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Check, X, RefreshCw, Loader2, Image as ImageIcon, Sparkles, Download, ZoomIn, ArrowRight, UserRound } from "lucide-react";
import { GeneratedImage, GenerationEngine, ModelProfile, WeeklyLaunch } from "@/types/fashion";
import { MODEL_GALLERY } from "@/data/model-gallery";

const ANGLE_LABELS_PT: Record<string, string> = {
  "lookbook-front": "Frente",
  "lookbook-back": "Costas",
  "lookbook-left": "Lateral Esquerda",
  "lookbook-three-quarter": "Lateral Direita",
  "close-tr-detail": "Close TR",
  "movement-shot": "Movimento",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  launch: WeeklyLaunch | null;
  hasApprovedFrontal: boolean;
  isDownloadingHd: boolean;
  onApprove: (id: string, value: "approved" | "rejected") => void;
  onRegenerate: (id: string, engine?: GenerationEngine, model?: ModelProfile | null) => void;
  onGenerateSingle: (id: string, scene?: string) => void;
  onDownloadHd: (launchId: string) => void;
  onZoom: (img: GeneratedImage) => void;
}

const ResultsGalleryDialog: React.FC<Props> = ({
  open, onOpenChange, launch, hasApprovedFrontal, isDownloadingHd,
  onApprove, onRegenerate, onGenerateSingle, onDownloadHd, onZoom,
}) => {
  if (!launch) return null;
  const photos = launch.images.filter((img) => img.type !== "video-product" && img.type !== "video-model");
  const approved = photos.filter((p) => p.approvalStatus === "approved").length;
  const generating = photos.filter((p) => p.status === "generating" || p.status === "pending").length;
  const pendingApproval = photos.filter((p) => p.status === "done" && p.approvalStatus !== "approved" && p.approvalStatus !== "rejected").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-base font-semibold">{launch.name || launch.label}</span>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] gap-1 border-green-500/40 text-green-600 dark:text-green-400">
                <Check className="h-2.5 w-2.5" /> {approved} aprovadas
              </Badge>
              <Badge variant="outline" className="text-[10px] gap-1">
                <Loader2 className={cn("h-2.5 w-2.5", generating > 0 && "animate-spin")} /> {generating} gerando
              </Badge>
              <Badge variant="outline" className="text-[10px] gap-1 border-yellow-500/40 text-yellow-700 dark:text-yellow-400">
                {pendingApproval} pendentes
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
          {photos.map((img) => {
            const label = ANGLE_LABELS_PT[img.type] || img.label;
            const isApproved = img.approvalStatus === "approved";
            const isRejected = img.approvalStatus === "rejected";
            const blocked = img.type !== "lookbook-front" && !hasApprovedFrontal;
            return (
              <div
                key={img.id}
                className={cn(
                  "group rounded-xl border-2 bg-card overflow-hidden transition-colors",
                  isApproved && "border-green-500",
                  isRejected && "border-destructive",
                  !isApproved && !isRejected && "border-border",
                )}
              >
                <div className="aspect-[9/16] bg-muted relative flex items-center justify-center">
                  {img.status === "done" && img.imageUrl && (
                    <>
                      <img src={img.imageUrl} alt={label} className="w-full h-full object-cover" loading="lazy" />
                      <button
                        onClick={() => onZoom(img)}
                        className="absolute top-1.5 right-1.5 bg-background/80 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
                        title="Ampliar"
                      >
                        <ZoomIn className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                  {img.status === "generating" && <Loader2 className="h-5 w-5 animate-spin text-accent" />}
                  {img.status === "pending" && (
                    <div className="flex flex-col items-center gap-2 p-3">
                      <ImageIcon className="h-7 w-7 text-muted-foreground/40" />
                      <span className="text-[10px] text-muted-foreground text-center">
                        {blocked ? "Aprove o frontal primeiro" : "Aguardando"}
                      </span>
                      <Button
                        size="sm"
                        disabled={blocked}
                        className="h-7 text-[10px] gap-1"
                        onClick={() => onGenerateSingle(img.id)}
                      >
                        <Sparkles className="h-3 w-3" /> Gerar
                      </Button>
                    </div>
                  )}
                  {img.status === "error" && (
                    <div className="text-center p-2 space-y-2">
                      <p className="text-[10px] text-destructive line-clamp-3">{img.error || "Erro"}</p>
                      <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => onRegenerate(img.id)}>
                        <RefreshCw className="h-3 w-3 mr-1" /> Tentar de novo
                      </Button>
                    </div>
                  )}
                </div>
                <div className="px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-medium truncate">{label}</span>
                    {isApproved && <Check className="h-3 w-3 text-green-500 shrink-0" />}
                  </div>
                  {img.status === "done" && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant={isApproved ? "default" : "outline"}
                        className={cn("h-7 text-[10px] flex-1 gap-1", isApproved && "bg-green-600 hover:bg-green-700")}
                        onClick={() => onApprove(img.id, "approved")}
                      >
                        <Check className="h-3 w-3" /> Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant={isRejected ? "destructive" : "outline"}
                        className="h-7 text-[10px] flex-1 gap-1"
                        onClick={() => onApprove(img.id, "rejected")}
                      >
                        <X className="h-3 w-3" /> Reprovar
                      </Button>
                      {isRejected && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" title="Regenerar">
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onRegenerate(img.id)} className="text-xs gap-2">
                              <RefreshCw className="h-3.5 w-3.5" /> Mesma engine
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onRegenerate(img.id, "gemini")} className="text-xs gap-2">
                              <Sparkles className="h-3.5 w-3.5" /> Gemini
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onRegenerate(img.id, "fal")} className="text-xs gap-2">
                              <ArrowRight className="h-3.5 w-3.5" /> fal.ai
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" title="Trocar modelo">
                            <UserRound className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {MODEL_GALLERY.map((m) => (
                            <DropdownMenuItem
                              key={m.id}
                              onClick={() => onRegenerate(img.id, undefined, m)}
                              className="gap-2 text-xs"
                            >
                              <img src={m.faceImage} alt={m.name} className="h-5 w-5 rounded-full object-cover" />
                              {m.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 pt-3 border-t border-border mt-2">
          <p className="text-[11px] text-muted-foreground">
            {approved > 0 ? `${approved} foto(s) prontas para download em HD.` : "Aprove fotos para liberar o download HD."}
          </p>
          <Button
            size="sm"
            onClick={() => onDownloadHd(launch.id)}
            disabled={isDownloadingHd || approved === 0}
            className="gap-1.5"
          >
            {isDownloadingHd ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Baixar aprovadas HD
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ResultsGalleryDialog;
