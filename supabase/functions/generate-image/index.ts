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

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

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

    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
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

    // Extract image from response
    const message = data.choices?.[0]?.message;
    let imageUrl = "";

    if (message?.content) {
      // Check if content is an array with image parts
      if (Array.isArray(message.content)) {
        const imagePart = message.content.find(
          (part: any) => part.type === "image_url" || part.type === "image"
        );
        if (imagePart?.image_url?.url) {
          imageUrl = imagePart.image_url.url;
        } else if (imagePart?.data) {
          imageUrl = `data:image/png;base64,${imagePart.data}`;
        }
      } else if (typeof message.content === "string") {
        // Check for base64 image in text response
        const base64Match = message.content.match(
          /data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/
        );
        if (base64Match) {
          imageUrl = base64Match[0];
        }
      }
    }

    // Also check for inline_data in parts
    if (!imageUrl && message?.parts) {
      const imgPart = message.parts.find((p: any) => p.inline_data);
      if (imgPart?.inline_data) {
        imageUrl = `data:${imgPart.inline_data.mime_type};base64,${imgPart.inline_data.data}`;
      }
    }

    if (!imageUrl) {
      console.error("Full AI response:", JSON.stringify(data));
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
