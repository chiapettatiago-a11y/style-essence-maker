import React, { useRef, useCallback, useState } from "react";
import { Plus, X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { compressImage, createThumbnail, blobToDataUrl } from "@/lib/image-compress";

interface ReferencePhotosSectionProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  maxPhotos?: number;
  label?: string;
}

const ReferencePhotosSection: React.FC<ReferencePhotosSectionProps> = ({
  photos,
  onPhotosChange,
  maxPhotos = 3,
  label = "Fotos de referência",
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(async (files: FileList) => {
    const remaining = maxPhotos - photos.length;
    if (remaining <= 0) return;

    const selectedFiles = Array.from(files).slice(0, remaining);
    const results = await Promise.all(
      selectedFiles.map(async (file) => {
        const compressed = await compressImage(file);
        return blobToDataUrl(compressed);
      })
    );

    const valid = results.filter(Boolean);
    if (valid.length > 0) {
      onPhotosChange([...photos, ...valid]);
    }
  }, [photos, onPhotosChange, maxPhotos]);

  const removePhoto = (index: number) => {
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">{label}</Label>
        <span className="text-[10px] text-muted-foreground">{photos.length}/{maxPhotos}</span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }}
      />

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
        className={cn(
          "grid grid-cols-3 gap-2 p-2 rounded-lg border-2 border-dashed transition-colors min-h-[80px]",
          dragOver ? "border-primary bg-primary/5" : "border-border"
        )}
      >
        {photos.map((photo, i) => (
          <div key={i} className="relative group aspect-[3/4] rounded-md overflow-hidden border border-border bg-card">
            <img src={photo} alt={`Ref ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
            <button
              onClick={() => removePhoto(i)}
              className="absolute top-1 right-1 bg-destructive rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3 text-white" />
            </button>
          </div>
        ))}

        {photos.length < maxPhotos && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="aspect-[3/4] rounded-md border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="text-[9px] font-medium">Adicionar</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ReferencePhotosSection;
