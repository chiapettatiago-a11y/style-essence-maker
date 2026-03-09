import React from "react";
import { GeneratedImage, WeeklyLaunch } from "@/types/fashion";
import { cn } from "@/lib/utils";
import { ImageIcon, Video, Upload, Loader2, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AssetPanelProps {
  uploadedImages: string[];
  weeklyLaunches: WeeklyLaunch[];
  selectedAssetId: string | null;
  onSelectAsset: (id: string, type: "uploaded" | "generated") => void;
  onRemoveUploaded: (index: number) => void;
  onUploadClick: () => void;
}

const AssetPanel: React.FC<AssetPanelProps> = ({
  uploadedImages,
  weeklyLaunches,
  selectedAssetId,
  onSelectAsset,
  onRemoveUploaded,
  onUploadClick,
}) => {
  const allGeneratedImages = weeklyLaunches.flatMap((w) =>
    w.images.filter((i) => i.type !== "video-product" && i.type !== "video-model")
  );
  const allVideos = weeklyLaunches.flatMap((w) =>
    w.images.filter((i) => i.type === "video-product" || i.type === "video-model")
  );

  return (
    <div className="w-60 border-r border-border bg-card flex flex-col h-full">
      <div className="px-3 py-3 border-b border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Assets do Projeto
        </h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Product Images */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium flex items-center gap-1.5">
                <Upload className="h-3 w-3 text-accent" />
                Produto
              </span>
              <button
                onClick={onUploadClick}
                className="text-[10px] text-accent hover:underline"
              >
                + Adicionar
              </button>
            </div>
            {uploadedImages.length === 0 ? (
              <button
                onClick={onUploadClick}
                className="w-full aspect-square rounded-lg border-2 border-dashed border-border hover:border-accent/50 flex flex-col items-center justify-center gap-1 transition-colors"
              >
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">Upload</span>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {uploadedImages.map((img, i) => (
                  <div
                    key={`upload-${i}`}
                    className={cn(
                      "relative group aspect-square rounded-md overflow-hidden cursor-pointer border-2 transition-all",
                      selectedAssetId === `upload-${i}`
                        ? "border-accent shadow-sm"
                        : "border-transparent hover:border-accent/30"
                    )}
                    onClick={() => onSelectAsset(`upload-${i}`, "uploaded")}
                  >
                    <img src={img} alt={`Produto ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemoveUploaded(i); }}
                      className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Generated Images */}
          {allGeneratedImages.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-medium flex items-center gap-1.5">
                <ImageIcon className="h-3 w-3 text-accent" />
                Geradas ({allGeneratedImages.length})
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {allGeneratedImages.map((img) => (
                  <div
                    key={img.id}
                    className={cn(
                      "relative aspect-[9/16] rounded-md overflow-hidden cursor-pointer border-2 transition-all bg-muted flex items-center justify-center",
                      selectedAssetId === img.id
                        ? "border-accent shadow-sm"
                        : "border-transparent hover:border-accent/30"
                    )}
                    onClick={() => onSelectAsset(img.id, "generated")}
                  >
                    {img.status === "done" && img.imageUrl ? (
                      <img src={img.imageUrl} alt={img.label} className="w-full h-full object-cover" />
                    ) : img.status === "generating" ? (
                      <Loader2 className="h-4 w-4 animate-spin text-accent" />
                    ) : img.status === "error" ? (
                      <span className="text-[8px] text-destructive">Erro</span>
                    ) : (
                      <span className="text-[8px] text-muted-foreground">...</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Video Prompts */}
          {allVideos.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-medium flex items-center gap-1.5">
                <Video className="h-3 w-3 text-accent" />
                Vídeos ({allVideos.length})
              </span>
              <div className="space-y-1">
                {allVideos.map((vid) => (
                  <button
                    key={vid.id}
                    onClick={() => onSelectAsset(vid.id, "generated")}
                    className={cn(
                      "w-full text-left text-[10px] p-2 rounded-md border transition-all truncate",
                      selectedAssetId === vid.id
                        ? "border-accent bg-accent/10"
                        : "border-border hover:border-accent/30"
                    )}
                  >
                    {vid.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default AssetPanel;
