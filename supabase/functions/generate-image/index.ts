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

    // Build message content with reference image if available
    const content: any[] = [{ type: "text", text: prompt }];

    if (referenceImages && referenceImages.length > 0) {
      const img = referenceImages[0];
      const base64Match = img.match(/^data:image\/(.*?);base64,(.*)$/);
      if (base64Match) {
        content.push({
          type: "image_url",
          image_url: {
            url: `data:image/${base64Match[1]};base64,${base64Match[2]}`,
          },
        });
        content[0].text = `Reference garment image is provided. Use it to accurately reproduce the garment design in the generated image.\n\n${prompt}`;
      }
    }

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

      // Primary gateway image format
      if (Array.isArray(message?.images) && message.images.length > 0) {
        const img = message.images[0]?.image_url?.url;
        if (img) return img;
      }

      // Alternative content-array format
      if (Array.isArray(message?.content)) {
        const imagePart = message.content.find(
          (part: any) => part?.type === "image_url" || part?.type === "image"
        );
        if (imagePart?.image_url?.url) return imagePart.image_url.url;
        if (imagePart?.data) return `data:image/png;base64,${imagePart.data}`;
      }

      // String content containing data URL
      if (typeof message?.content === "string") {
        const base64Match = message.content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
        if (base64Match) return base64Match[0];
      }

      // Inline data format
      if (Array.isArray(message?.parts)) {
        const imgPart = message.parts.find((p: any) => p?.inline_data);
        if (imgPart?.inline_data?.data && imgPart?.inline_data?.mime_type) {
          return `data:${imgPart.inline_data.mime_type};base64,${imgPart.inline_data.data}`;
        }
      }

      return "";
    };

    let imageUrl = extractImageUrl(data);

    // Fallback retry with Nano banana if provider returned text-only output
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
                  text: `${prompt}\n\nGenerate one final image output now.`,
                },
                ...content.filter((item) => item.type === "image_url"),
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
