import React from "react";
import { cn } from "@/lib/utils";
import { GalleryModel, MODEL_GALLERY } from "@/data/model-gallery";
import { Check } from "lucide-react";

interface ModelGalleryProps {
  selectedModelId: string | null;
  onSelectModel: (model: GalleryModel) => void;
}

const ModelGallery: React.FC<ModelGalleryProps> = ({ selectedModelId, onSelectModel }) => {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Escolha a Modelo</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Selecione o biotipo da modelo que usará a peça nas fotos
        </p>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {MODEL_GALLERY.map((model) => {
          const isSelected = selectedModelId === model.id;
          return (
            <button
              key={model.id}
              onClick={() => onSelectModel(model)}
              className={cn(
                "relative group rounded-xl overflow-hidden border-2 transition-all",
                isSelected
                  ? "border-accent ring-2 ring-accent/30 shadow-md"
                  : "border-border hover:border-accent/50 hover:shadow-sm"
              )}
            >
              <div className="aspect-[3/4] overflow-hidden">
                <img
                  src={model.faceImage}
                  alt={model.name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
              </div>
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 bg-accent text-accent-foreground rounded-full p-0.5">
                  <Check className="h-3 w-3" />
                </div>
              )}
              <div className="p-2 bg-card">
                <p className="text-[11px] font-medium truncate">{model.name}</p>
                <p className="text-[9px] text-muted-foreground truncate">{model.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ModelGallery;
