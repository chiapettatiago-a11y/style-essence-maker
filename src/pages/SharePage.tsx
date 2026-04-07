import React from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ImageIcon } from "lucide-react";

const SharePage = () => {
  const { token } = useParams<{ token: string }>();

  const { data: share, isLoading: shareLoading } = useQuery({
    queryKey: ["share", token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_shares")
        .select("*")
        .eq("token", token!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });

  const productId = share?.product_id;

  const { data: images, isLoading: imagesLoading } = useQuery({
    queryKey: ["share-images", productId],
    queryFn: async () => {
      const { data: weeks } = await supabase
        .from("weekly_launches")
        .select("id")
        .eq("product_id", productId!);
      if (!weeks || weeks.length === 0) return [];
      const weekIds = weeks.map((w) => w.id);
      const { data: imgs } = await supabase
        .from("generated_images")
        .select("*")
        .in("launch_id", weekIds)
        .eq("status", "done")
        .eq("approval_status", "approved");
      return imgs || [];
    },
    enabled: !!productId,
  });

  if (shareLoading || imagesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  if (!share) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Link não encontrado ou expirado.</p>
      </div>
    );
  }

  if (!images || images.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Nenhuma foto aprovada para exibição.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold text-center">Galeria Compartilhada</h1>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((img) => (
            <div key={img.id} className="aspect-[9/16] rounded-xl overflow-hidden border border-border bg-muted">
              <img
                src={img.preview_url || img.original_url || img.image_url || ""}
                alt={img.label}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default SharePage;
