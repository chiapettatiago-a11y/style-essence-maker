import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, sourceImageUrl, videoType } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build messages with source image if provided
    const userContent: any[] = [
      {
        type: "text",
        text: `Generate a professional fashion video based on this description. Create a single high-quality frame that captures the essence of this video concept:\n\n${prompt}\n\nThe output should be a cinematic still frame from this video concept, with perfect lighting, composition, and garment fidelity.`,
      },
    ];

    if (sourceImageUrl) {
      userContent.push({
        type: "image_url",
        image_url: { url: sourceImageUrl },
      });
    }

    const startMs = performance.now();

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        modalities: ["image", "text"],
        messages: [
          {
            role: "user",
            content: userContent,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes.", code: "rate_limited" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA insuficientes. Adicione créditos ao workspace.", code: "payment_required" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI gateway error [${response.status}]: ${errText}`);
    }

    const data = await response.json();
    const generationMs = Math.round(performance.now() - startMs);

    // Extract image from response
    const message = data?.choices?.[0]?.message;
    let imageUrl = "";

    if (Array.isArray(message?.images) && message.images.length > 0) {
      imageUrl = message.images[0]?.image_url?.url || "";
    }

    if (!imageUrl && Array.isArray(message?.content)) {
      const imagePart = message.content.find((part: any) => part?.type === "image_url" || part?.type === "image");
      if (imagePart?.image_url?.url) imageUrl = imagePart.image_url.url;
      if (imagePart?.data) imageUrl = `data:image/png;base64,${imagePart.data}`;
    }

    if (!imageUrl && typeof message?.content === "string") {
      const base64Match = message.content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
      if (base64Match) imageUrl = base64Match[0];
    }

    if (!imageUrl) {
      throw new Error("Nenhuma imagem gerada na resposta da IA");
    }

    return new Response(
      JSON.stringify({
        imageUrl,
        videoType: videoType || "video-model",
        modelUsed: "google/gemini-3-pro-image-preview",
        generationMs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-video error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido na geração de vídeo" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
