import React, { useState } from "react";
import { GeneratedImage, WeeklyLaunch } from "@/types/fashion";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Copy, Check, Download, RefreshCw, Loader2, Plus } from "lucide-react";
import demoVideoModel from "@/assets/demo-video-360-model.mp4";
import demoVideoProduct from "@/assets/demo-video-360-product.mp4";

interface ResultsStepProps {
  weeklyLaunches: WeeklyLaunch[];
  activeWeek: string;
  onActiveWeekChange: (id: string) => void;
  onAddWeek: () => void;
  onRegenerate: (id: string) => void;
}

const ResultsStep: React.FC<ResultsStepProps> = ({
  weeklyLaunches,
  activeWeek,
  onActiveWeekChange,
  onAddWeek,
  onRegenerate,
}) => {
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

  const renderImages = (images: GeneratedImage[]) => {
    const imageResults = images.filter((i) => !isVideo(i.type));
    const videoPrompts = images.filter((i) => isVideo(i.type));

    return (
      <div className="space-y-6">
        {imageResults.length === 0 && videoPrompts.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">
            Nenhum resultado nesta semana ainda.
          </p>
        )}

        {imageResults.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {imageResults.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                <div className="aspect-[9/16] bg-muted relative flex items-center justify-center">
                  {item.status === "generating" && (
                    <Loader2 className="h-8 w-8 text-accent animate-spin" />
                  )}
                  {item.status === "done" && item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.label}
                      className="w-full h-full object-contain"
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
                <div className="p-4 flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{item.label}</span>
                  <div className="flex gap-1">
                    {item.status === "done" && item.imageUrl && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => downloadImage(item.imageUrl!, item.label)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onRegenerate(item.id)}
                      disabled={item.status === "generating"}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {videoPrompts.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Prompts de Vídeo</h3>
            <p className="text-xs text-muted-foreground">
              Copie e use em ferramentas externas. Veja os vídeos de exemplo como referência.
            </p>
            {videoPrompts.map((item) => {
              const demoVideo =
                item.type === "video-model" ? demoVideoModel : demoVideoProduct;
              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-border bg-card p-4 space-y-3"
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
                  <video
                    src={demoVideo}
                    className="w-full max-h-[360px] aspect-[9/16] object-cover rounded-lg bg-muted"
                    muted
                    loop
                    controls
                    playsInline
                  />
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                    {item.prompt}
                  </pre>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Resultados</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Galeria de imagens geradas e prompts de vídeo por lançamento.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onAddWeek}>
          <Plus className="h-4 w-4 mr-1" />
          Nova Semana
        </Button>
      </div>

      <Tabs value={activeWeek} onValueChange={onActiveWeekChange}>
        <TabsList className="w-full justify-start">
          {weeklyLaunches.map((week) => (
            <TabsTrigger key={week.id} value={week.id}>
              {week.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {weeklyLaunches.map((week) => (
          <TabsContent key={week.id} value={week.id}>
            {renderImages(week.images)}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default ResultsStep;
