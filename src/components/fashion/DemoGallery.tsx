import React from "react";
import { Play } from "lucide-react";
import demoVideoModel from "@/assets/demo-video-360-model.mp4";
import demoVideoProduct from "@/assets/demo-video-360-product.mp4";

const demos = [
  {
    src: demoVideoProduct,
    title: "360° Produto",
    description: "Rotação completa do produto em fundo neutro, ideal para e-commerce e catálogo.",
  },
  {
    src: demoVideoModel,
    title: "360° Modelo",
    description: "Vídeo editorial com modelo vestindo a peça, perfeito para lookbooks e redes sociais.",
  },
];

const DemoGallery: React.FC = () => {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 space-y-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Play className="h-4 w-4 text-accent" />
          <h2 className="text-xl font-semibold tracking-tight">Galeria de Exemplos</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Veja exemplos de vídeos 360° gerados pela plataforma como referência para seus projetos.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {demos.map((demo) => (
          <div
            key={demo.title}
            className="rounded-xl border border-border bg-background overflow-hidden"
          >
            <video
              src={demo.src}
              className="w-full aspect-[9/16] max-h-[420px] object-cover bg-muted"
              muted
              loop
              controls
              playsInline
            />
            <div className="p-4 space-y-1">
              <h3 className="text-sm font-semibold">{demo.title}</h3>
              <p className="text-xs text-muted-foreground">{demo.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default DemoGallery;
