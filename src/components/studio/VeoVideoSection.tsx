import React, { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Play, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import type { WeeklyLaunch } from "@/types/fashion";

interface VeoVideoSectionProps {
  launches: WeeklyLaunch[];
  activeLaunchId: string;
  onVideoGenerated: () => void;
}

const VeoVideoSection: React.FC<VeoVideoSectionProps> = ({ launches, activeLaunchId, onVideoGenerated }) => {
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [videoType, setVideoType] = useState<"video-product" | "video-model">("video-model");
  const [duration, setDuration] = useState<8 | 15>(8);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedVideos, setGeneratedVideos] = useState<{ url: string; type: string; durationSeconds: number; generationMs: number }[]>([]);

  const activeLaunch = launches.find((l) => l.id === activeLaunchId) || launches[0];

  const frontPhoto = useMemo(() => {
    if (!activeLaunch) return null;
    return activeLaunch.images.find(
      (img) => img.type === "lookbook-front" && img.status === "done" && (img.originalUrl || img.imageUrl)
    );
  }, [activeLaunch]);

  const handleGenerate = async () => {
    if (!frontPhoto) {
      toast({ title: "Erro", description: "Gere a foto frontal primeiro para usar como referência.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setProgress(5);
    setModalOpen(false);

    const sourceUrl = frontPhoto.originalUrl || frontPhoto.imageUrl!;
    const prompt = videoType === "video-product"
      ? `Professional 360-degree product rotation video. The garment slowly rotates on an invisible mannequin, showing all angles and details. Clean white studio background. Smooth continuous rotation. Duration: ${duration} seconds. High fashion commercial quality.`
      : `Professional fashion video of a model wearing the garment. The model does a slow elegant walk and turn, showing the garment from multiple angles. Editorial fashion film quality with cinematic lighting. Duration: ${duration} seconds.`;

    // Simulate progress while waiting
    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 1, 90));
    }, 3000);

    try {
      const { data, error } = await supabase.functions.invoke("generate-video", {
        body: { prompt, sourceImageUrl: sourceUrl, videoType, durationSeconds: duration },
      });

      clearInterval(progressInterval);

      if (error) throw error;
      if (!data?.videoUrl) throw new Error("Nenhum vídeo retornado.");

      setProgress(100);
      setGeneratedVideos((prev) => [
        { url: data.videoUrl, type: videoType, durationSeconds: duration, generationMs: data.generationMs || 0 },
        ...prev,
      ]);
      toast({ title: "Vídeo gerado com sucesso!", description: `${duration}s · ${videoType === "video-model" ? "Com modelo" : "Produto 360°"}` });
      onVideoGenerated();
    } catch (err: unknown) {
      clearInterval(progressInterval);
      const msg = err instanceof Error ? err.message : "Erro na geração de vídeo";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Vídeos</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gere vídeos profissionais usando Veo 3 a partir da foto frontal do lançamento.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)} disabled={isGenerating || !frontPhoto} className="gap-1.5">
          <Play className="h-4 w-4" />
          🎬 Solicitar vídeo Veo
        </Button>
      </div>

      {!frontPhoto && (
        <div className="rounded-xl border border-border bg-muted/30 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Gere a foto frontal primeiro na aba <strong>Fotos</strong> para usar como referência do vídeo.
          </p>
        </div>
      )}

      {/* Progress */}
      {isGenerating && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            <span className="text-sm font-medium">Gerando vídeo com Veo 3...</span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-[10px] text-muted-foreground">
            A geração pode levar de 2 a 5 minutos. Não feche esta aba.
          </p>
        </div>
      )}

      {/* Generated videos */}
      {generatedVideos.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Vídeos gerados</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {generatedVideos.map((vid, idx) => (
              <div key={idx} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="aspect-[9/16] bg-muted">
                  <video
                    src={vid.url}
                    className="w-full h-full object-contain"
                    controls
                    playsInline
                    muted
                    loop
                  />
                </div>
                <div className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {vid.type === "video-model" ? "Com Modelo" : "360° Produto"}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{vid.durationSeconds}s</span>
                    {vid.generationMs > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {Math.round(vid.generationMs / 1000)}s geração
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = vid.url;
                      a.download = `video_${vid.type}_${vid.durationSeconds}s.mp4`;
                      a.click();
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🎬 Solicitar Vídeo Veo 3</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Tipo de vídeo</Label>
              <Select value={videoType} onValueChange={(v) => setVideoType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video-product">360° Produto</SelectItem>
                  <SelectItem value="video-model">360° com Modelo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Duração</Label>
              <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v) as 8 | 15)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="8">8 segundos</SelectItem>
                  <SelectItem value="15">15 segundos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg bg-muted/50 p-3 space-y-2">
              <p className="text-xs font-medium">Referência</p>
              {frontPhoto && (
                <div className="flex items-center gap-3">
                  <img
                    src={frontPhoto.previewUrl || frontPhoto.imageUrl!}
                    alt="Referência"
                    className="h-20 w-auto rounded-md object-cover"
                  />
                  <div className="text-xs text-muted-foreground">
                    <p>Foto frontal do lançamento atual</p>
                    <p className="text-[10px]">{activeLaunch?.name || activeLaunch?.label}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="text-[10px] text-muted-foreground bg-muted/30 rounded-md p-2">
              Custo estimado: ~${(duration === 8 ? 0.56 : 1.05).toFixed(2)} (Veo 3 @ $0.07/s)
            </div>

            <Button onClick={handleGenerate} className="w-full" disabled={!frontPhoto}>
              <Sparkles className="h-4 w-4 mr-1.5" />
              Gerar Vídeo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VeoVideoSection;
