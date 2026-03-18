import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Mannequin = {
  height_cm?: number | null;
  bust_cm?: number | null;
  waist_cm?: number | null;
  hip_cm?: number | null;
  torso_cm?: number | null;
  arm_cm?: number | null;
};

type GeminiAnalysis = {
  garment_type?: string;
  fabric?: string;
  color?: string;
  color_hex_estimate?: string;
  pattern?: string;
  pattern_description?: string;
  silhouette?: string;
  neckline?: string;
  sleeve_type?: string;
  hem_type?: string;
  construction?: string;
  details?: string;
  style?: string;
  full_description?: string;
  proportions?: {
    garment_length_ratio?: number;
    waist_ratio?: number;
    sleeve_ratio?: number;
    shoulder_ratio?: number;
  };
};

function normalizeRatio(value: unknown, fallback: number): number {
  const n = Number(value);
  if (Number.isNaN(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function calculateProportions(geminiAnalysis: GeminiAnalysis, mannequin: Mannequin) {
  const h = Number(mannequin.height_cm || 0);
  const bust = Number(mannequin.bust_cm || 0);
  const arm = Number(mannequin.arm_cm || 0);

  if (!h || !bust || !arm) {
    return {
      garment_length_cm: null,
      waist_position_cm: null,
      sleeve_length_cm: null,
      shoulder_width_cm: null,
      hem_below_knee_cm: null,
      garment_length: null,
    };
  }

  const garmentLengthRatio = normalizeRatio(geminiAnalysis.proportions?.garment_length_ratio, 0.8);
  const waistRatio = normalizeRatio(geminiAnalysis.proportions?.waist_ratio, 0.46);
  const sleeveRatio = normalizeRatio(geminiAnalysis.proportions?.sleeve_ratio, 0.9);
  const shoulderRatio = normalizeRatio(geminiAnalysis.proportions?.shoulder_ratio, 0.42);

  const garment_length_cm = Math.round(garmentLengthRatio * h);
  const waist_position_cm = Math.round(waistRatio * h);
  const sleeve_length_cm = Math.round(sleeveRatio * arm);
  const shoulder_width_cm = Math.round(shoulderRatio * bust);

  const knee_position_cm = Math.round(0.61 * h);
  const hem_below_knee_cm = garment_length_cm - knee_position_cm;

  const garment_length =
    garment_length_cm < knee_position_cm - 15
      ? "curto"
      : garment_length_cm < knee_position_cm + 5
        ? "joelho"
        : garment_length_cm < knee_position_cm + 20
          ? "midi"
          : garment_length_cm < h - 15
            ? "longo"
            : "maxi";

  return {
    garment_length_cm,
    waist_position_cm,
    sleeve_length_cm,
    shoulder_width_cm,
    hem_below_knee_cm,
    garment_length,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { images, mannequin } = await req.json();

    if (!images || images.length === 0) {
      return new Response(JSON.stringify({ error: "No images provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const imageParts = images.slice(0, 4).map((img: string) => {
      const base64Match = img.match(/^data:image\/(.*?);base64,(.*)$/);
      if (!base64Match) return { type: "text", text: "[image]" };
      return {
        type: "image_url",
        image_url: {
          url: `data:image/${base64Match[1]};base64,${base64Match[2]}`,
        },
      };
    });

    const analysisPrompt = `You are a professional fashion analyst for a Brazilian fashion brand.
Analyze the garment photos carefully and return ONLY valid JSON.

Required JSON schema:
{
  "garment_type": "dress|blouse|pants|skirt|jacket|etc",
  "fabric": "brief fabric description in English",
  "color": "primary color description",
  "color_hex_estimate": "#xxxxxx",
  "pattern": "solid|stripes|floral|paisley|geometric|etc",
  "pattern_description": "detailed pattern description",
  "silhouette": "fitted|A-line|straight|wrap|etc",
  "neckline": "collar type description",
  "sleeve_type": "sleeveless|short|3/4|long|balloon|etc",
  "hem_type": "straight|asymmetric|ruffled|etc",
  "construction": "construction details",
  "details": "all key details; explicitly include TR golden metallic detail location if visible",
  "style": "overall style category",
  "full_description": "full faithful garment description for image generation",
  "proportions": {
    "garment_length_ratio": "0-1 ratio of garment length vs mannequin height",
    "waist_ratio": "0-1 ratio of waist position vs mannequin height",
    "sleeve_ratio": "0-1 ratio of sleeve length vs mannequin arm length",
    "shoulder_ratio": "0-1 ratio of shoulder width vs mannequin bust"
  }
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: [{ type: "text", text: analysisPrompt }, ...imageParts] }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes no workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`AI API call failed [${response.status}]: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Could not parse JSON from AI response");

    const raw = JSON.parse(jsonMatch[0]) as GeminiAnalysis;
    const proportions = calculateProportions(raw, mannequin || {});

    const analysis = {
      type: raw.garment_type || "",
      fabric: raw.fabric || "",
      color: raw.color || "",
      pattern: raw.pattern || "",
      construction: raw.construction || "",
      details: raw.details || "",
      style: raw.style || "",
      fullDescription: raw.full_description || "",
      length: proportions.garment_length || "",
      silhouette: raw.silhouette || "",
      hemline: raw.hem_type || "",
      neckline: raw.neckline || "",
      sleeves: raw.sleeve_type || "",
      colorHexEstimate: raw.color_hex_estimate || "",
      patternDescription: raw.pattern_description || "",
      hemType: raw.hem_type || "",
    };

    return new Response(JSON.stringify({ analysis, proportions, raw }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
