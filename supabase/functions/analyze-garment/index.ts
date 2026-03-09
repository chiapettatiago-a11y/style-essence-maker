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
    const { images } = await req.json();

    if (!images || images.length === 0) {
      return new Response(JSON.stringify({ error: "No images provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build parts with images
    const imageParts = images.slice(0, 4).map((img: string) => {
      const base64Match = img.match(/^data:image\/(.*?);base64,(.*)$/);
      if (base64Match) {
        return {
          inlineData: {
            mimeType: `image/${base64Match[1]}`,
            data: base64Match[2],
          },
        };
      }
      return { text: "[image]" };
    });

    const analysisPrompt = `You are a fashion product analyst specializing in garment technical specifications. Analyze this garment image(s) with EXTREME PRECISION and extract the following details in JSON format:
{
  "type": "garment type (e.g., dress, blouse, pants, jumpsuit, skirt)",
  "fabric": "fabric type, texture, weight and composition (e.g., medium-weight denim, lightweight chiffon)",
  "color": "EXACT primary color with shade detail (e.g., 'medium indigo blue denim wash', 'deep navy', 'champagne beige') — be very specific about the exact tone/shade/wash",
  "pattern": "pattern or print description (e.g., solid, floral, striped, embroidered details)",
  "construction": "construction details (seams, structure, darts, closures)",
  "details": "ALL technical details — trims, closures, embellishments, buttons, zippers, pockets, embroidery, hardware. IMPORTANT: Look specifically for a small golden metallic tag/plate engraved with 'TR' — note its exact placement.",
  "style": "overall style category",
  "fullDescription": "complete detailed description suitable for AI image generation — must be specific enough to reproduce this EXACT garment faithfully",
  "length": "PRECISE garment length description (e.g., 'floor-length maxi reaching ankles', 'midi below knee', 'mini above mid-thigh', 'cropped above waist'). Measure relative to body landmarks.",
  "silhouette": "exact silhouette shape (e.g., 'A-line flared from waist', 'straight/column', 'fitted bodycon', 'oversized boxy')",
  "hemline": "hemline shape and finish (e.g., 'straight even hem', 'asymmetric hem', 'high-low hem', 'raw edge')",
  "neckline": "exact neckline type (e.g., 'pointed collar shirt-style', 'crew neck', 'V-neck', 'turtleneck', 'off-shoulder')",
  "sleeves": "exact sleeve type and length (e.g., 'long sleeves to wrist with button cuffs', 'sleeveless', '3/4 sleeves', 'cap sleeves')"
}

CRITICAL: The "length" field is EXTREMELY important. Look carefully at where the garment ends relative to the model's body. A long dress that reaches the ankles must be described as such. Do NOT guess — be precise.

The "color" field must capture the EXACT shade — not just "blue" but the specific type of blue wash/tone.

Output ONLY valid JSON.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: analysisPrompt },
              ...imageParts.map((part: any) => {
                if (part.inlineData) {
                  return {
                    type: "image_url",
                    image_url: {
                      url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                    },
                  };
                }
                return { type: "text", text: part.text };
              }),
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", errText);
      throw new Error(`AI API call failed [${response.status}]: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse JSON from AI response");
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in analyze-garment:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});