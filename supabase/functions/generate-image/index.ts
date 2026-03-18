import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { fal } from "npm:@fal-ai/client";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type AngleType = "lookbook-front" | "lookbook-back" | "lookbook-left" | "lookbook-three-quarter" | "close-tr-cuff" | "close-tr-label" | "video-product" | "video-model";
type GenerationEngine = "gemini" | "fal";

type GarmentAnalysis = {
  type?: string;
  fabric?: string;
  color?: string;
  pattern?: string;
  construction?: string;
  details?: string;
  style?: string;
  fullDescription?: string;
  length?: string;
  silhouette?: string;
  hemline?: string;
  neckline?: string;
  sleeves?: string;
};

type ModelProfile = {
  id?: string;
  name?: string;
  height?: string;
  bust?: string;
  waist?: string;
  hip?: string;
  skinTone?: string;
  hairType?: string;
  hairColor?: string;
  generalStyle?: string;
  promptSeed?: string;
};

const ANGLE_BLOCKS: Record<AngleType, string> = {
  "lookbook-front": "FRONT VIEW — standing tall, weight evenly distributed, arms relaxed at sides, slight natural curve.",
  "lookbook-back": "BACK VIEW — back to camera, slight head turn over left shoulder, natural posture.",
  "lookbook-left": "LEFT SIDE — left profile, mid-stride feel, natural arm swing, candid energy.",
  "lookbook-three-quarter": "RIGHT SIDE / 3-4 VIEW — right profile with slight hip shift and soft arm bend.",
  "close-tr-cuff": "This is the same model from the reference image, wearing the same dress. Zoom into the RIGHT WRIST/CUFF area of the dress she is wearing. The model is still wearing the garment — do NOT remove it from her body. Show a tight crop of her right sleeve cuff as worn on her wrist. One golden metallic button engraved \"TR\" in interlocking monogram style must be SHARP and centered in frame. Her wrist and hand are naturally relaxed beneath the cuff. Same lighting and background as reference image. Cinematic close, macro detail, 100mm lens feel. DO NOT show full body. Crop tightly to cuff area only.",
  "close-tr-label": "This is the same model from the reference image, wearing the same dress. Zoom into the NECKLINE/COLLAR area of the dress she is wearing. The model is still wearing the garment — do NOT remove it from her body. Show a tight crop of the collar and upper chest area as worn. Black fabric label \"THAIS RODRIGUES\" visible inside the collar fold, sharp and legible. Same lighting and background as reference image. Cinematic close, macro detail, 100mm lens feel. DO NOT show full body. Crop tightly to neckline area only.",
  "video-product": "Generate still image frame with strong product fidelity suitable for product-video storyboard.",
  "video-model": "Generate still image frame with model fidelity suitable for model-video storyboard.",
};

function toCm(value: unknown): string {
  if (value === null || value === undefined || value === "") return "N/A";
  return `${value}cm`;
}

function buildPrompt(params: {
  basePrompt?: string;
  manualPrompt?: string;
  angleType: AngleType;
  garmentAnalysis?: GarmentAnalysis | null;
  proportionJson?: Record<string, unknown> | null;
  modelProfile?: ModelProfile | null;
  mannequin?: Record<string, unknown> | null;
}) {
  const {
    basePrompt,
    manualPrompt,
    angleType,
    garmentAnalysis,
    proportionJson,
    modelProfile,
    mannequin,
  } = params;

  const blockA = `Professional fashion photography, editorial quality.
Camera: Sony A7R V equivalent, 85mm f/1.8.
Lighting: natural key light + soft fill, no harsh shadows.
Resolution: 1080x1920px portrait, 4K clarity.
Format: 9:16 portrait.`;

  const blockB = `ABSOLUTE GARMENT FIDELITY — this is the most critical instruction.
Do NOT redesign, alter proportions, remove or add any detail.

Preserve exactly:
- Color: ${garmentAnalysis?.color || "N/A"} with ${garmentAnalysis?.pattern || "N/A"}
- Silhouette: ${garmentAnalysis?.silhouette || "N/A"}
- Neckline: ${garmentAnalysis?.neckline || "N/A"}
- Sleeves: ${garmentAnalysis?.sleeves || "N/A"}, length ${toCm(proportionJson?.sleeve_length_cm)}
- Hem: ${garmentAnalysis?.hemline || "N/A"}, falls ${toCm(proportionJson?.hem_below_knee_cm)} from knee reference
- Construction: ${garmentAnalysis?.construction || "N/A"}
- Details: ${garmentAnalysis?.details || "N/A"}

SIGNATURE DETAIL — mandatory in every photo:
One golden metallic button engraved with "TR" in interlocking monogram style on the RIGHT cuff, serving as closure.
Internal black label "THAIS RODRIGUES" stitched below the neckline.

PROPORTIONS (from ${toCm(mannequin?.height_cm)} reference mannequin):
- Total garment length: ${toCm(proportionJson?.garment_length_cm)}
- Waist position: ${toCm(proportionJson?.waist_position_cm)} from shoulder`;

  const blockC = angleType === "video-product"
    ? ""
    : `Model: ${modelProfile?.promptSeed || modelProfile?.name || "Brazilian model"}
Height: ${modelProfile?.height || "N/A"}m.
Measurements: bust ${toCm(modelProfile?.bust)}, waist ${toCm(modelProfile?.waist)}, hips ${toCm(modelProfile?.hip)}.
Beauty direction: authentic Brazilian, natural latina beauty, real skin texture, NOT Eurocentric features, NOT K-beauty influence, NOT heavily filtered.`;

  const blockD = ANGLE_BLOCKS[angleType] || "";

  const blockE = manualPrompt?.trim()
    ? `Additional direction from the designer: ${manualPrompt.trim()}
Apply this while maintaining all garment fidelity rules.`
    : "";

  return [blockA, blockB, blockC, blockD, basePrompt || "", blockE].filter(Boolean).join("\n\n");
}

const extractGeminiImageUrl = (payload: any): string => {
  const message = payload?.choices?.[0]?.message;

  if (Array.isArray(message?.images) && message.images.length > 0) {
    const img = message.images[0]?.image_url?.url;
    if (img) return img;
  }

  if (Array.isArray(message?.content)) {
    const imagePart = message.content.find((part: any) => part?.type === "image_url" || part?.type === "image");
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

const extractFalImageUrl = (payload: any): string => {
  if (Array.isArray(payload?.images) && payload.images.length > 0) {
    return payload.images[0]?.url || payload.images[0]?.image_url || "";
  }

  if (Array.isArray(payload?.data?.images) && payload.data.images.length > 0) {
    return payload.data.images[0]?.url || payload.data.images[0]?.image_url || "";
  }

  return payload?.image?.url || payload?.image_url || payload?.data?.image?.url || "";
};

async function callGeminiGateway(params: {
  promptUsed: string;
  referenceImages: string[];
  attemptNumber: number;
}) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const imageUrlParts: any[] = [];
  if (params.referenceImages.length > 0) {
    const validImages = params.referenceImages.slice(0, 3);
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

  const modelUsed = params.attemptNumber > 1 ? "google/gemini-2.5-flash-image" : "google/gemini-3-pro-image-preview";

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: modelUsed,
      modalities: ["image", "text"],
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: params.promptUsed },
            ...imageUrlParts,
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();

    if (response.status === 429) {
      throw new Error("Rate limits exceeded, tente novamente em instantes.");
    }

    if (response.status === 402) {
      throw new Error("Créditos de IA insuficientes no workspace.");
    }

    throw new Error(`AI image generation failed [${response.status}]: ${errText}`);
  }

  const data = await response.json();
  const imageUrl = extractGeminiImageUrl(data);
  if (!imageUrl) throw new Error("No image found in AI response");

  return { imageUrl, modelUsed };
}

async function callFalEngine(params: {
  promptUsed: string;
  imageUrl?: string;
  angleType: AngleType;
}) {
  const FAL_API_KEY = Deno.env.get("FAL_API_KEY");
  if (!FAL_API_KEY) throw new Error("FAL_API_KEY is not configured");

  fal.config({ credentials: FAL_API_KEY });

  const useReference = !!params.imageUrl;
  const endpoint = useReference ? "fal-ai/flux-pro/kontext" : "fal-ai/flux-2-pro";
  const result = await fal.subscribe(endpoint, {
    input: {
      prompt: params.promptUsed,
      ...(useReference ? { image_url: params.imageUrl } : {}),
    },
  });

  const imageUrl = extractFalImageUrl(result);
  if (!imageUrl) throw new Error("No image found in fal.ai response");

  return { imageUrl, modelUsed: endpoint };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      angleType,
      angle,
      engine,
      prompt,
      image_url,
      basePrompt,
      manualPrompt,
      garmentAnalysis,
      proportionJson,
      modelProfile,
      mannequin,
      referenceImages,
      attemptNumber,
    } = await req.json();

    const parsedAngle = (angleType || angle || "lookbook-front") as AngleType;
    const parsedEngine = (engine || "gemini") as GenerationEngine;
    const requestAttempt = Number(attemptNumber || 1);
    const promptUsed = basePrompt || manualPrompt || garmentAnalysis
      ? buildPrompt({
          basePrompt: basePrompt || prompt,
          manualPrompt,
          angleType: parsedAngle,
          garmentAnalysis,
          proportionJson,
          modelProfile,
          mannequin,
        })
      : (prompt || "");

    const firstReferenceImage = image_url || referenceImages?.[0] || undefined;

    const result = parsedEngine === "fal"
      ? await callFalEngine({
          promptUsed,
          imageUrl: firstReferenceImage,
          angleType: parsedAngle,
        })
      : await callGeminiGateway({
          promptUsed,
          referenceImages: Array.isArray(referenceImages) ? referenceImages : firstReferenceImage ? [firstReferenceImage] : [],
          attemptNumber: requestAttempt,
        });

    return new Response(JSON.stringify({
      imageUrl: result.imageUrl,
      originalUrl: result.imageUrl,
      previewUrl: result.imageUrl,
      promptUsed,
      modelUsed: result.modelUsed,
      attemptNumber: requestAttempt,
      engineUsed: parsedEngine,
    }), {
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
