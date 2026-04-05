import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { GalleryModel, MODEL_GALLERY } from "@/data/model-gallery";
import { Check, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ModelGalleryProps {
  selectedModelId: string | null;
  onSelectModel: (model: GalleryModel) => void;
}

const ModelGallery: React.FC<ModelGalleryProps> = ({ selectedModelId, onSelectModel }) => {
  const [loraSlugs, setLoraSlugs] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchLora = async () => {
      const { data } = await supabase
        .from("model_profiles")
        .select("slug, lora_url")
        .not("lora_url", "is", null);
      if (data) {
        setLoraSlugs(new Set(data.map((r: any) => r.slug)));
      }
    };
    fetchLora();
  }, []);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Escolha a Modelo</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Selecione o biotipo da modelo que usará a peça nas fotos
        </p>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[480px] overflow-y-auto pr-1">
        {MODEL_GALLERY.map((model) => {
          const isSelected = selectedModelId === model.id;
          const hasLora = loraSlugs.has(model.id);
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
              {hasLora && (
                <div className="absolute top-1.5 left-1.5 bg-amber-500 text-white rounded-full px-1.5 py-0.5 flex items-center gap-0.5 shadow-sm">
                  <Sparkles className="h-2.5 w-2.5" />
                  <span className="text-[8px] font-bold tracking-wide">LoRA</span>
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
