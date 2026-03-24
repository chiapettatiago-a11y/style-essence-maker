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
  colorHexEstimate?: string;
  patternDescription?: string;
  hemType?: string;
  lengthDescription?: string;
  sleeveLength?: string;
  closure?: string;
  beltOrTie?: string;
  signatureDetails?: string;
  promptDescription?: string;
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

const FULL_BODY_ANGLE_TYPES = new Set<AngleType>([
  "lookbook-front",
  "lookbook-back",
  "lookbook-left",
  "lookbook-three-quarter",
]);

 const FOOTWEAR_BLOCK = `FOOTWEAR — CRITICAL:
 The model MUST be wearing shoes. NEVER barefoot, NEVER without footwear.
 Default: nude-colored pointed-toe stiletto pumps matching skin tone.
 Shoes must be elegant, fashion-appropriate, and fully visible in full-body shots.
 Do NOT show bare feet under any circumstances.`;
 
 const GENDER_BLOCK = `GENDER — CRITICAL:
 The model is FEMALE. This is a WOMEN'S garment.
 Do NOT generate a male model under any circumstances.
 Female body proportions, female facial features, female silhouette — mandatory.`;
 
 const TR_BADGE_DETAILED_BLOCK = `SIGNATURE BRAND ELEMENT — "TR" GOLDEN BADGE — MANDATORY IN EVERY IMAGE:
 Element type: Small round metallic button/tag, approximately 1.5–2cm in diameter.
 Material: Polished 18k gold-finish metal, high-shine reflective surface.
 Engraving: Interlocking monogram letters "TR" in decorative gothic/serif typeface, raised/embossed from the metal surface.
 Position: Attached at the garment's designated closure point (typically center-front waistband for skirts, right cuff for dresses, or as detected in garment analysis).
 Attachment: Functional button with visible thread shank in matching garment color.
 Rendering requirements:
 - The "TR" letters must be LEGIBLE and SHARP — not blurred, not abstracted.
 - Gold color must be warm polished gold (#D4AF37 to #FFD700 range), NOT silver, NOT brass, NOT matte.
 - Must catch light realistically with specular highlights showing metallic surface.
 - Must appear at CORRECT SCALE relative to garment — approximately 2cm diameter, NOT oversized, NOT microscopic.
 - In close-up shots, individual letter strokes of "T" and "R" must be distinguishable.
 Internal label: Black woven fabric label reading "THAIS RODRIGUES" stitched inside collar/waistband fold.`;
 
 const ANGLE_BLOCKS: Record<AngleType, string> = {
  "lookbook-front": "front_view: facing camera directly, full body head-to-toe, straight on. SAME FEMALE model as described.",
  "lookbook-back": "back_view: SAME FEMALE model, back to camera, full body head-to-toe, slight head turn left. SAME garment, SAME shoes.",
  "lookbook-left": "left_side: SAME FEMALE model, left profile, full body head-to-toe, facing right. SAME garment, SAME shoes.",
  "lookbook-three-quarter": "right_side: SAME FEMALE model, right profile, full body head-to-toe, facing left. SAME garment, SAME shoes.",
  "close-tr-cuff": "This is the same model from the reference image, wearing the same dress. Zoom into the RIGHT WRIST/CUFF area of the dress she is wearing. The model is still wearing the garment — do NOT remove it from her body. Show a tight crop of her right sleeve cuff as worn on her wrist. One golden metallic button engraved with \"TR\" in interlocking monogram style must be SHARP and centered in frame. Her wrist and hand are naturally relaxed beneath the cuff. Same lighting and background as reference image. Cinematic close, macro detail, 100mm lens feel. DO NOT show full body. Crop tightly to cuff area only.",
  "close-tr-label": "This is the same model from the reference image, wearing the same dress. Zoom into the NECKLINE/COLLAR area of the dress she is wearing. The model is still wearing the garment — do NOT remove it from her body. Show a tight crop of the collar and upper chest area as worn. Black fabric label \"THAIS RODRIGUES\" visible inside the collar fold, sharp and legible. Same lighting and background as reference image. Cinematic close, macro detail, 100mm lens feel. DO NOT show full body. Crop tightly to neckline area only.",
  "video-product": "Slow 360-degree rotation of the garment on an invisible mannequin. Pure white background. Smooth continuous rotation showing all angles of the garment. The fabric moves naturally with the rotation, revealing construction details, seams, and texture. No model, just the garment floating and rotating. Professional product video for e-commerce.",
  "video-model": "The model takes a slow, elegant step forward, then gracefully turns 180 degrees showing the back of the outfit, pauses briefly, then turns back to face the camera. Natural hair and fabric movement. Confident, editorial walk. Same white studio background. Subtle wind effect on hair and dress hem. Professional fashion lookbook video.",
};

const FULL_BODY_CRITICAL_BLOCK = `FRAMING — CRITICAL:
Full body shot, head to toe with breathing room.
Model occupies 70% of frame height maximum.
Minimum 10% empty space above head.
Minimum 15% empty space below feet.
Feet fully visible, ankles visible, NO cropping of legs.
Wide enough to show both arms with space around them.
Editorial fashion campaign framing — NOT e-commerce product zoom.
NOT portrait crop. NOT tight crop. FULL BODY with air around.

BACKGROUND — CRITICAL:
Pure seamless white #FFFFFF infinity backdrop.
NOT beige. NOT cream. NOT warm. NOT gray. NOT gradient.
NO texture. NO shadow on background. NO vignette.
If background is any color other than pure white → image FAILED.`;

const FULL_BODY_CRITICAL_BLOCK_FAL = `FRAMING — CRITICAL (E-COMMERCE PRODUCT PHOTOGRAPHY):
Full body shot from head to toe. E-commerce product catalog photo.
Model centered in frame, occupying 70-75% of frame height.
Minimum 10% empty space above head, minimum 15% below feet.
Feet fully visible, ankles visible, NO cropping of any body part.
Clean, symmetrical, centered composition — like ZARA or NET-A-PORTER product page.
Professional fashion e-commerce catalog photo — NOT editorial, NOT artistic, NOT lifestyle.
NOT portrait crop. NOT tight crop. FULL BODY centered with breathing room.

BACKGROUND — CRITICAL:
Pure seamless white #FFFFFF studio cyclorama backdrop.
NOT beige. NOT cream. NOT warm. NOT gray. NOT gradient. NOT any environment.
NO texture. NO shadow on background. NO vignette. NO props.
Clean studio white only — if background is any color other than pure white → FAILED.

LIGHTING — CRITICAL:
Soft, diffused studio lighting from front and above.
Even illumination — no harsh shadows on garment or skin.
High-key, color-accurate: garment colors must look true to life.
Standard e-commerce product lighting — bright, clean, neutral.`;

const MIDI_DRESS_CRITICAL_BLOCK = `DRESS LENGTH — CRITICAL:
Hem falls at mid-calf, 15cm below the knee.
Full midi silhouette visible in frame.
NOT mini. NOT knee-length. NOT above knee.
The full skirt must be visible — do NOT crop the hem.`;

function toCm(value: unknown): string {
  if (value === null || value === undefined || value === "") return "N/A";
  return `${value}cm`;
}

const STORAGE_BUCKET = "generated-assets";

function getImageSize(angleType: AngleType) {
  const isMacroClose = angleType === "close-tr-cuff" || angleType === "close-tr-label";
  return isMacroClose
    ? { width: 2048, height: 2048 }
    : { width: 1365, height: 2048 };
}

function sanitizePathSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/(^-|-$)/g, "");
}

function isDressLikeGarment(garmentAnalysis?: GarmentAnalysis | null) {
  const text = [garmentAnalysis?.type, garmentAnalysis?.fullDescription, garmentAnalysis?.style]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /(dress|vestido|gown)/.test(text);
}

function buildFaceAnchorPrompt(modelProfile?: ModelProfile | null) {
  if (!modelProfile) return "";

  return [
    "FACE ANCHOR — CRITICAL:",
    `Identity anchor: ${modelProfile.promptSeed || modelProfile.name || "Brazilian model"}`,
    "Use the exact same woman across all images.",
    "Maintain identical facial structure, eye spacing, nose, lips, jawline and bone structure in every angle.",
    modelProfile.skinTone ? `Skin tone: ${modelProfile.skinTone} — keep unchanged.` : "",
    modelProfile.hairType ? `Hair texture/style: ${modelProfile.hairType} — keep unchanged.` : "",
    modelProfile.hairColor ? `Hair color: ${modelProfile.hairColor} — EXACT same shade in every image.` : "",
    "Do NOT drift identity between shots.",
  ].filter(Boolean).join("\n");
}

function shouldUseFalReferenceImage(angleType: AngleType) {
  return angleType === "lookbook-front" || angleType === "close-tr-cuff" || angleType === "close-tr-label";
}

async function fetchImageBytes(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch generated image: ${response.status}`);
  const contentType = response.headers.get("content-type") || "image/png";
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { bytes, contentType };
}

function buildPublicObjectUrl(supabaseUrl: string, bucket: string, path: string) {
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

function buildPreviewUrl(supabaseUrl: string, bucket: string, path: string) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl}/storage/v1/render/image/public/${bucket}/${encodedPath}?width=800&height=1200&resize=contain&format=webp&quality=80`;
}

async function uploadGeneratedAsset(params: {
  sourceUrl: string;
  launchId?: string;
  type: AngleType;
  attemptNumber: number;
}) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      originalUrl: params.sourceUrl,
      previewUrl: params.sourceUrl,
      imageUrl: params.sourceUrl,
    };
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { bytes, contentType } = await fetchImageBytes(params.sourceUrl);
  const objectPath = [
    sanitizePathSegment(params.launchId || "standalone"),
    `${sanitizePathSegment(params.type)}-attempt-${params.attemptNumber}.png`,
  ].join("/");

  const { error } = await admin.storage.from(STORAGE_BUCKET).upload(objectPath, bytes, {
    contentType: contentType.includes("png") ? contentType : "image/png",
    cacheControl: "3600",
    upsert: true,
  });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const originalUrl = buildPublicObjectUrl(supabaseUrl, STORAGE_BUCKET, objectPath);
  const previewUrl = buildPreviewUrl(supabaseUrl, STORAGE_BUCKET, objectPath);

  return {
    originalUrl,
    previewUrl,
    imageUrl: previewUrl,
  };
}

function buildPrompt(params: {
  basePrompt?: string;
  manualPrompt?: string;
  angleType: AngleType;
  garmentAnalysis?: GarmentAnalysis | null;
  proportionJson?: Record<string, unknown> | null;
  modelProfile?: ModelProfile | null;
  mannequin?: Record<string, unknown> | null;
  engine?: GenerationEngine;
}) {
  const {
    basePrompt,
    manualPrompt,
    angleType,
    garmentAnalysis,
    proportionJson,
    modelProfile,
    mannequin,
    engine,
  } = params;

  const isFal = engine === "fal";

  const blockA = isFal
    ? `Professional e-commerce fashion product photography.
Camera: studio DSLR, 85mm lens, f/5.6 for sharp full-body focus.
Lighting: soft diffused studio lighting, high-key, color-accurate.
Clean white studio cyclorama background. Centered model. Symmetrical framing.
Format: portrait orientation, high resolution.
Style: clean e-commerce catalog photo like ZARA, NET-A-PORTER, Farfetch.`
    : `Professional fashion photography, editorial quality.
Camera: Sony A7R V equivalent, 85mm f/1.8.
Lighting: natural key light + soft fill, no harsh shadows.
Resolution: 1080x1920px portrait, 4K clarity.
Format: 9:16 portrait.`;

  const blockB = `ABSOLUTE GARMENT FIDELITY — this is the most critical instruction.
Do NOT redesign, alter proportions, remove or add any detail.
${garmentAnalysis?.promptDescription ? `
DEFINITIVE GARMENT DESCRIPTION — preserve exactly:
${garmentAnalysis.promptDescription}
` : ""}
Preserve exactly:
- Color: ${garmentAnalysis?.color || "N/A"} with ${garmentAnalysis?.pattern || "N/A"}
- Silhouette: ${garmentAnalysis?.silhouette || "N/A"}
- Neckline: ${garmentAnalysis?.neckline || "N/A"}
- Sleeves: ${garmentAnalysis?.sleeves || "N/A"}, length ${garmentAnalysis?.sleeveLength || toCm(proportionJson?.sleeve_length_cm)}
- Hem: ${garmentAnalysis?.hemline || "N/A"}, ${garmentAnalysis?.lengthDescription || `falls ${toCm(proportionJson?.hem_below_knee_cm)} from knee reference`}
- Length: ${garmentAnalysis?.length || "N/A"}
- Closure: ${garmentAnalysis?.closure || "N/A"}
- Belt / tie: ${garmentAnalysis?.beltOrTie || "N/A"}
- Construction: ${garmentAnalysis?.construction || "N/A"}
- Details: ${garmentAnalysis?.details || "N/A"}
- Signature details: ${garmentAnalysis?.signatureDetails || "N/A"}

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
  const fullBodyBlock = FULL_BODY_ANGLE_TYPES.has(angleType)
    ? (isFal ? FULL_BODY_CRITICAL_BLOCK_FAL : FULL_BODY_CRITICAL_BLOCK)
    : "";
  const midiBlock = FULL_BODY_ANGLE_TYPES.has(angleType) && isDressLikeGarment(garmentAnalysis) ? MIDI_DRESS_CRITICAL_BLOCK : "";
  const faceAnchorBlock = angleType !== "video-product" ? buildFaceAnchorPrompt(modelProfile) : "";
  const footwearBlock = FULL_BODY_ANGLE_TYPES.has(angleType) ? FOOTWEAR_BLOCK : "";
  const genderBlock = FULL_BODY_ANGLE_TYPES.has(angleType) ? GENDER_BLOCK : "";
  const trBadgeBlock = TR_BADGE_DETAILED_BLOCK;

  const blockE = manualPrompt?.trim()
    ? `Additional direction from the designer: ${manualPrompt.trim()}
Apply this while maintaining all garment fidelity rules.`
    : "";

  return [blockA, blockB, trBadgeBlock, genderBlock, blockC, faceAnchorBlock, footwearBlock, blockD, fullBodyBlock, midiBlock, basePrompt || "", blockE]
    .filter(Boolean)
    .join("\n\n");
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
  const imageSize = getImageSize(params.angleType);
  const result = await fal.subscribe(endpoint, {
    input: {
      prompt: params.promptUsed,
      ...(useReference ? { image_url: params.imageUrl } : {}),
      image_size: imageSize,
      num_inference_steps: 28,
      guidance_scale: 3.5,
      output_format: "png",
      output_quality: 100,
    },
  });

  const imageUrl = extractFalImageUrl(result);
  if (!imageUrl) throw new Error("No image found in fal.ai response");

  return { imageUrl, modelUsed: endpoint };
}

async function callFalVideoEngine(params: {
  promptUsed: string;
  imageUrl: string;
}) {
  const FAL_API_KEY = Deno.env.get("FAL_API_KEY");
  if (!FAL_API_KEY) throw new Error("FAL_API_KEY is not configured");

  fal.config({ credentials: FAL_API_KEY });

  const endpoint = "fal-ai/kling-video/v2.5-turbo/pro/image-to-video";
  const result = await fal.subscribe(endpoint, {
    input: {
      prompt: params.promptUsed,
      image_url: params.imageUrl,
      duration: "5",
      cfg_scale: 0.5,
      negative_prompt: "blur, distort, low quality, deformed hands, extra fingers, missing fingers, cropped, out of frame",
    },
  });

  const videoUrl = (result as any)?.video?.url
    || (result as any)?.data?.video?.url
    || (result as any)?.video_url
    || (result as any)?.data?.video_url
    || "";

  if (!videoUrl) throw new Error("No video found in Kling response");

  return { videoUrl, modelUsed: endpoint };
}

async function uploadGeneratedVideo(params: {
  sourceUrl: string;
  launchId?: string;
  type: AngleType;
  attemptNumber: number;
}) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return { originalUrl: params.sourceUrl, imageUrl: params.sourceUrl };
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const response = await fetch(params.sourceUrl);
  if (!response.ok) throw new Error(`Failed to fetch video: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());

  const objectPath = [
    sanitizePathSegment(params.launchId || "standalone"),
    `${sanitizePathSegment(params.type)}-attempt-${params.attemptNumber}.mp4`,
  ].join("/");

  const { error } = await admin.storage.from(STORAGE_BUCKET).upload(objectPath, bytes, {
    contentType: "video/mp4",
    cacheControl: "3600",
    upsert: true,
  });

  if (error) throw new Error(`Video upload failed: ${error.message}`);

  const originalUrl = buildPublicObjectUrl(supabaseUrl, STORAGE_BUCKET, objectPath);
  return { originalUrl, imageUrl: originalUrl };
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
      launchId,
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
          engine: parsedEngine,
        })
      : (prompt || "");

    const firstReferenceImage = image_url || referenceImages?.[0] || undefined;
    const falReferenceImage = shouldUseFalReferenceImage(parsedAngle) ? firstReferenceImage : undefined;

    const isVideoRequest = parsedAngle === "video-model" || parsedAngle === "video-product";

    if (isVideoRequest) {
      const videoReferenceImage = image_url || firstReferenceImage;
      if (!videoReferenceImage) {
        throw new Error("Video generation requires a reference image (front_view).");
      }

      const videoResult = await callFalVideoEngine({
        promptUsed,
        imageUrl: videoReferenceImage,
      });

      const storedVideo = await uploadGeneratedVideo({
        sourceUrl: videoResult.videoUrl,
        launchId,
        type: parsedAngle,
        attemptNumber: requestAttempt,
      });

      return new Response(JSON.stringify({
        imageUrl: storedVideo.imageUrl,
        originalUrl: storedVideo.originalUrl,
        previewUrl: storedVideo.originalUrl,
        promptUsed,
        modelUsed: videoResult.modelUsed,
        attemptNumber: requestAttempt,
        engineUsed: "fal",
        isVideo: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = parsedEngine === "fal"
      ? await callFalEngine({
          promptUsed,
          imageUrl: falReferenceImage,
          angleType: parsedAngle,
        })
      : await callGeminiGateway({
          promptUsed,
          referenceImages: Array.isArray(referenceImages) ? referenceImages : firstReferenceImage ? [firstReferenceImage] : [],
          attemptNumber: requestAttempt,
        });

    const storedAsset = await uploadGeneratedAsset({
      sourceUrl: result.imageUrl,
      launchId,
      type: parsedAngle,
      attemptNumber: requestAttempt,
    });

    return new Response(JSON.stringify({
      imageUrl: storedAsset.imageUrl,
      originalUrl: storedAsset.originalUrl,
      previewUrl: storedAsset.previewUrl,
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
