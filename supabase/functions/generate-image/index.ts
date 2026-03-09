import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, referenceImages } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: "No prompt provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build message content with ALL reference images (up to 3)
    const content: any[] = [];
    const imageUrlParts: any[] = [];

    if (referenceImages && referenceImages.length > 0) {
      const validImages = referenceImages.slice(0, 3);
      for (const img of validImages) {
        const base64Match = img.match(/^data:image\/(.*?);base64,(.*)$/);
        if (base64Match) {
          imageUrlParts.push({
            type: "image_url",
            image_url: {
              url: `data:image/${base64Match[1]};base64,${base64Match[2]}`,
            },
          });
        }
      }
    }

    const referencePrefix = imageUrlParts.length > 0
      ? `${imageUrlParts.length} reference garment image(s) are provided. You MUST reproduce this EXACT garment — same length, same color, same construction, same silhouette. Do NOT redesign, shorten, lengthen, or change the color of the garment. The generated image must look like a photo of THIS SPECIFIC garment.\n\n`
      : '';

    content.push({ type: "text", text: `${referencePrefix}${prompt}` });
    content.push(...imageUrlParts);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        modalities: ["image", "text"],
        messages: [
          {
            role: "user",
            content,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI image gen error:", errText);
      throw new Error(`AI image generation failed [${response.status}]: ${errText}`);
    }

    const data = await response.json();

    const extractImageUrl = (payload: any): string => {
      const message = payload?.choices?.[0]?.message;

      if (Array.isArray(message?.images) && message.images.length > 0) {
        const img = message.images[0]?.image_url?.url;
        if (img) return img;
      }

      if (Array.isArray(message?.content)) {
        const imagePart = message.content.find(
          (part: any) => part?.type === "image_url" || part?.type === "image"
        );
        if (imagePart?.image_url?.url) return imagePart.image_url.url;
        if (imagePart?.data) return `data:image/png;base64,${imagePart.data}`;
      }

      if (typeof message?.content === "string") {
        const base64Match = message.content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
        if (base64Match) return base64Match[0];
      }

      if (Array.isArray(message?.parts)) {
        const imgPart = message.parts.find((p: any) => p?.inline_data);
        if (imgPart?.inline_data?.data && imgPart?.inline_data?.mime_type) {
          return `data:${imgPart.inline_data.mime_type};base64,${imgPart.inline_data.data}`;
        }
      }

      return "";
    };

    let imageUrl = extractImageUrl(data);

    // Fallback retry
    if (!imageUrl) {
      const fallbackResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          modalities: ["image", "text"],
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `${referencePrefix}${prompt}\n\nGenerate one final image output now.`,
                },
                ...imageUrlParts,
              ],
            },
          ],
        }),
      });

      if (!fallbackResponse.ok) {
        const fallbackErrText = await fallbackResponse.text();
        console.error("AI fallback image gen error:", fallbackErrText);
      } else {
        const fallbackData = await fallbackResponse.json();
        imageUrl = extractImageUrl(fallbackData);
      }
    }

    if (!imageUrl) {
      console.error("Full AI response (primary):", JSON.stringify(data));
      throw new Error("No image found in AI response");
    }

    return new Response(JSON.stringify({ imageUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in generate-image:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});