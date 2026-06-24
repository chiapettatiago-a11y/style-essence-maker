import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { fal } from "npm:@fal-ai/client";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type AngleType = "lookbook-front" | "lookbook-back" | "lookbook-left" | "lookbook-three-quarter" | "close-tr-detail" | "movement-shot" | "video-product" | "video-model";
type GenerationEngine = "seedream" | "fal" | "gemini";

class GenerationRateLimitError extends Error {
  retryAfterMs: number;

  constructor(message: string, retryAfterMs = 60_000) {
    super(message);
    this.name = "GenerationRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

function isRateLimitError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return error instanceof GenerationRateLimitError || /429|rate.?limit|too many requests|excedido|quota exceeded/i.test(message);
}

function parseRetryAfterMs(response: Response) {
  const retryAfter = response.headers.get("retry-after");
  if (!retryAfter) return null;
  const numeric = Number(retryAfter);
  if (Number.isFinite(numeric)) return Math.max(1000, numeric * 1000);
  const timestamp = Date.parse(retryAfter);
  return Number.isFinite(timestamp) ? Math.max(1000, timestamp - Date.now()) : null;
}

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function updateGeneratedImageRow(imageId: string | undefined, updates: Record<string, unknown>) {
  if (!imageId) return;
  const admin = getAdminClient();
  if (!admin) return;

  const { error } = await admin.from("generated_images").update(updates).eq("id", imageId);
  if (error) console.error(`[generate-image] Failed to update generated_images ${imageId}: ${error.message}`);
}

function waitUntilBackground(task: Promise<unknown>) {
  const edgeRuntime = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime;
  if (edgeRuntime?.waitUntil) {
    edgeRuntime.waitUntil(task);
    return;
  }

  task.catch((error) => console.error("[generate-image] Background task failed:", error));
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[generate-image] ${label} timed out after ${ms}ms; continuing without it.`);
      resolve(null);
    }, ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

type GarmentAnalysis = {
  type?: string;
  fabric?: string;
  fabricTexture?: string;
  color?: string;
  colorHexEstimate?: string;
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
  patternDescription?: string;
  hemType?: string;
  hemDetail?: string;
  lengthDescription?: string;
  sleeveLength?: string;
  sleeveDetail?: string;
  closure?: string;
  beltOrTie?: string;
  signatureDetails?: string;
  promptDescription?: string;
  trBadgeLocation?: string | null;
  trBadgeDescription?: string | null;
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
  lora_url?: string;
  lora_trigger_word?: string;
  lora_scale?: number;
  guidance_scale?: number;
  face_image_url?: string;
};

const FULL_BODY_ANGLE_TYPES = new Set<AngleType>([
  "lookbook-front",
  "lookbook-back",
  "lookbook-left",
  "lookbook-three-quarter",
  "movement-shot",
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

// ─── RULE 1: BOTTOM GARMENT — NEVER INVENT ───
const BOTTOM_GARMENT_BLOCK = `BOTTOM GARMENT — ABSOLUTE RULE:
When the main garment is a top (blouse, jacket, shirt, blazer, crop top, or any upper-body piece):
- ALWAYS use the EXACT bottom garment visible in the reference photo.
- Copy the reference bottom precisely: same length, same silhouette, same color, same fabric.
- NEVER generate: mini skirts, micro shorts, very short skirts, or any bottom shorter than midi length UNLESS explicitly shown in the reference photo.
- If NO bottom garment is visible in the reference photo, use: tailored straight black trousers, ankle length, clean and pressed, no creases.
- The bottom garment must look natural and proportional to the main piece.
- Do NOT invent, redesign, or substitute the bottom with anything not in the reference.`;

// ─── RULE 2: INNER LAYER FOR JACKETS ───
const INNER_LAYER_BLOCK = `INNER LAYER — STYLING RULE:
A plain white fitted t-shirt is worn underneath this open-front garment.
The white layer must:
- Be barely visible at the neckline opening and at the cuffs/wrists
- NEVER overshadow or compete with the main garment
- Prevent any skin, cleavage, or décolletage from showing
- Look natural and intentional as a deliberate styling choice
- Be a simple, minimal, fitted crew-neck white tee — no graphics, no logos`;

// ─── RULE 3: NO TAGS OR LABELS ───
const NO_TAGS_BLOCK = `TAGS AND LABELS — ABSOLUTE PROHIBITION:
The garment must appear RETAIL-READY, as displayed in a luxury boutique.
FORBIDDEN in all generated images — zero tolerance:
- Hang tags, price tags, swing tags of any kind
- Care labels, washing instruction labels visible externally
- Brand labels visible on the outside of the garment
- Any paper, plastic, or fabric tag hanging from the garment
- Stickers, barcodes, or any retail packaging remnants
If ANY tag or label appears in the generated image, the image is REJECTED.`;

// ─── RULE 4: TR CLOSE-UP QUALITY ───
const TR_CLOSEUP_QUALITY_BLOCK = `TR MONOGRAM BUTTON — EXACT REPLICATION REQUIRED:

BUTTON ANATOMY (replicate precisely from Figure 1 reference):
- Shape: small flat circular metal disc, approximately 1.5cm diameter
- Material: matte-oxidized aged gold metal, NOT shiny polished — warm dark gold tone, similar to antique brass (#8B6914 to #A07820)
- Letters: "T" and "R" are CUT-THROUGH / DIE-CUT openings in the metal, NOT raised embossed — the fabric behind shows THROUGH the letter shapes
- Letter style: serif typeface, the "R" has a curved serif leg, classic elegant typography
- Thread: 4 visible thread holes at cardinal points (N, S, E, W edges), with white or cream thread visible passing through
- No border rim engraving — the edge is a clean flat circle

BUTTON SCALE — CRITICAL:
The TR button is VERY SMALL — approximately 1.5cm diameter in real life.
On the wrist/cuff it appears as a TINY DISCRETE DETAIL, not a prominent element. It should occupy no more than 8-10% of the total image area.
The fabric and knit texture must be the dominant visual element.
The button is a subtle brand signature, NOT a large medallion.
Reference: imagine a shirt button — that is the correct scale.
HARD FAIL: if the button appears larger than a shirt button relative to the fabric, regenerate.

PHOTOGRAPHY SPECS:
- Macro shot, 100mm lens equivalent, f/2.8
- Button centered in frame
- Fabric texture visible and in soft focus around button
- Lighting: soft directional from upper-left, catching the matte metal surface without overexposure
- The cut-through letters must show fabric texture through them

HARD FAILS — regenerate if:
- Letters appear raised/embossed instead of cut-through
- Button looks shiny polished gold instead of matte antique
- "TR" letters are blurry or illegible
- Thread holes not visible
- Button appears silver, brass-bright, or any other color`;

 const TR_BADGE_DETAILED_BLOCK_FN = (signatureDetails?: string) => {
   const positionNotVisible = !signatureDetails || /not clearly visible/i.test(signatureDetails);
   if (positionNotVisible) {
     return `SIGNATURE BRAND ELEMENT — "TR" GOLDEN BADGE:
The TR button was NOT clearly visible in the reference photos.
Do NOT add a TR button/badge anywhere on the garment.
Internal label: Black woven fabric label reading "THAIS RODRIGUES" stitched inside collar/waistband fold.`;
   }
   return `SIGNATURE BRAND ELEMENT — "TR" GOLDEN BADGE — MANDATORY IN EVERY IMAGE:
Element type: Small round metallic button/tag, approximately 1.5–2cm in diameter.
Material: Polished 18k gold-finish metal, high-shine reflective surface.
Engraving: Interlocking monogram letters "TR" in decorative gothic/serif typeface, raised/embossed from the metal surface.
Position: ${signatureDetails}
Attachment: Functional button with visible thread shank in matching garment color.
Rendering requirements:
- The "TR" letters must be LEGIBLE and SHARP — not blurred, not abstracted.
- Gold color must be warm polished gold (#D4AF37 to #FFD700 range), NOT silver, NOT brass, NOT matte.
- Must catch light realistically with specular highlights showing metallic surface.
- Must appear at CORRECT SCALE relative to garment — approximately 2cm diameter, NOT oversized, NOT microscopic.
- In close-up shots, individual letter strokes of "T" and "R" must be distinguishable.
- NEVER invent or relocate the TR button to a different position than specified above.
Internal label: Black woven fabric label reading "THAIS RODRIGUES" stitched inside collar/waistband fold.`;
 };
 
 const ANGLE_BLOCKS: Record<AngleType, string> = {
  "lookbook-front": "Full body, facing camera, weight evenly distributed, arms relaxed, subtle natural posture. Full body framing, feet visible.",
  "lookbook-back": "Back to camera, slight head turn over left shoulder, natural posture. Full body framing, feet visible.",
  "lookbook-left": "Left profile, mid-stride feel, natural arm swing, candid editorial energy. Full body framing, feet visible.",
  "lookbook-three-quarter": "Right profile, weight on back foot, slight hip shift, arm softly bent. Full body framing, feet visible.",
  "close-tr-detail": "Half-body crop centered on the waist/midsection area. Show fabric texture, construction details, and any decorative elements. Natural relaxed pose. NOT a macro close-up — maintain editorial distance showing garment context.",
  "movement-shot": "Full body, loose editorial walking pose — mid-stride, natural arm swing, slight body rotation, relaxed energy. Candid fashion week backstage feel. Full body framing, feet visible.",
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

SCENE ANCHOR — ABSOLUTE RULE — apply to 100% of photos in this set:
Background: pure seamless white #FFFFFF, NO exceptions.
This instruction overrides any other background suggestion.
If you generate a non-white background, the image is REJECTED.
NOT beige. NOT cream. NOT warm. NOT gray. NOT gradient.
NO texture. NO shadow on background. NO vignette.
Lighting: soft even studio light, same temperature in all photos.`;

const FULL_BODY_CRITICAL_BLOCK_FAL = `FRAMING — CRITICAL (E-COMMERCE PRODUCT PHOTOGRAPHY):
Full body shot from head to toe. E-commerce product catalog photo.
Model centered in frame, occupying 70-75% of frame height.
Minimum 10% empty space above head, minimum 15% below feet.
Feet fully visible, ankles visible, NO cropping of any body part.
Clean, symmetrical, centered composition — like ZARA or NET-A-PORTER product page.
Professional fashion e-commerce catalog photo — NOT editorial, NOT artistic, NOT lifestyle.
NOT portrait crop. NOT tight crop. FULL BODY centered with breathing room.

SCENE ANCHOR — ABSOLUTE RULE — apply to 100% of photos in this set:
Background: pure seamless white #FFFFFF studio cyclorama backdrop, NO exceptions.
This instruction overrides any other background suggestion.
If you generate a non-white background, the image is REJECTED.
NOT beige. NOT cream. NOT warm. NOT gray. NOT gradient. NOT any environment.
NO texture. NO shadow on background. NO vignette. NO props.
Lighting: soft, diffused studio lighting from front and above.
Even illumination — no harsh shadows on garment or skin.
High-key, color-accurate: garment colors must look true to life.
Same lighting temperature in all photos of this set.`;

const MIDI_DRESS_CRITICAL_BLOCK = `DRESS LENGTH — CRITICAL:
Hem falls at mid-calf, 15cm below the knee.
Full midi silhouette visible in frame.
NOT mini. NOT knee-length. NOT above knee.
The full skirt must be visible — do NOT crop the hem.`;

function toCm(value: unknown): string {
  if (value === null || value === undefined || value === "") return "N/A";
  return `${value}cm`;
}

const DEFAULT_MANNEQUIN: Record<string, number> = {
  height_cm: 175,
  bust_cm: 88,
  waist_cm: 64,
  hip_cm: 96,
  torso_cm: 42,
  arm_cm: 60,
};

const STORAGE_BUCKET = "generated-assets";

function getImageSize(angleType: AngleType) {
  const isCloseDetail = angleType === "close-tr-detail";
  return isCloseDetail
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
  return /(dress|vestido|gown|two-piece|two piece|conjunto|saia|skirt)/.test(text);
}

function isUpperBodyGarment(garmentAnalysis?: GarmentAnalysis | null): boolean {
  const text = [garmentAnalysis?.type, garmentAnalysis?.fullDescription]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /(blouse|blusa|jacket|jaqueta|blazer|shirt|camisa|crop top|top|cardigan|coat|casaco|vest|colete)/.test(text)
    && !/(dress|vestido|gown|jumpsuit|macacão)/.test(text);
}

function isOpenFrontGarment(garmentAnalysis?: GarmentAnalysis | null): boolean {
  const text = [garmentAnalysis?.type, garmentAnalysis?.fullDescription, garmentAnalysis?.closure]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /(jacket|jaqueta|blazer|cardigan|coat|casaco|vest|colete|open.?front|kimono)/.test(text);
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

function shouldUseFalReferenceImage(_angleType: AngleType) {
  return true;
}

async function fetchImageBytes(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch generated image: ${response.status}`);
  const contentType = response.headers.get("content-type") || "image/jpeg";
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
  suffix?: string;
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

  const { bytes } = await fetchImageBytes(params.sourceUrl);
  const sfx = params.suffix ? `-${params.suffix}` : "";
  const objectPath = [
    sanitizePathSegment(params.launchId || "standalone"),
    `${sanitizePathSegment(params.type)}-attempt-${params.attemptNumber}${sfx}.jpg`,
  ].join("/");

  const { error } = await admin.storage.from(STORAGE_BUCKET).upload(objectPath, bytes, {
    contentType: "image/jpeg",
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
  const isSeedream = engine === "seedream";
  const isCloseDetail = angleType === "close-tr-detail";

  const blockA = isFal
    ? `Professional e-commerce fashion product photography.
Camera: studio DSLR, 85mm lens, f/5.6 for sharp full-body focus.
Lighting: soft diffused studio lighting, high-key, color-accurate.
Clean white studio cyclorama background. Centered model. Symmetrical framing.
Format: portrait orientation, high resolution, JPG 300 DPI sRGB.
Style: clean e-commerce catalog photo like ZARA, NET-A-PORTER, Farfetch.`
    : isSeedream
    ? `Cinematic fashion editorial photography for a Brazilian womenswear brand.
Studio DSLR quality, 85mm lens, f/5.6, soft diffused studio lighting.
Pure white seamless cyclorama background #FFFFFF, no exceptions.
Portrait orientation 3:4, high resolution, photorealistic quality.
The model is a Brazilian latina woman. ${modelProfile?.promptSeed || 'warm morena skin tone, dark hair, defined Brazilian features'}.
NOT Asian features. NOT pale European skin. Brazilian biotipo mandatory.
Photo-realistic skin with natural pores and texture. Real person, not CGI.`
    : `Professional fashion photography, editorial quality.
Camera: Sony A7R V equivalent, 85mm f/1.8.
Lighting: natural key light + soft fill, no harsh shadows.
Resolution: 1080x1920px portrait, 4K clarity, JPG 300 DPI sRGB.
Format: 9:16 portrait.`;

  const isTwoPieceSet = /two-piece|two piece|conjunto/i.test(garmentAnalysis?.type || "");
  const twoPieceBlock = isTwoPieceSet
    ? `TWO-PIECE SET RULE — CRITICAL:
This garment is a TWO-PIECE SET (top + bottom sold together).
- Show BOTH pieces worn together in all body shots.
- Blouse/top hem sits at natural waist, skirt/bottom waistband meets top hem.
- Do NOT merge into a single dress silhouette.
- Maintain visible separation line between top and bottom at waist.
- Each piece must maintain its own construction and proportions.`
    : "";

  // Resolve mannequin with fallback to defaults
  const resolvedMannequin = (mannequin && mannequin.height_cm) ? mannequin : DEFAULT_MANNEQUIN;

  // For close-tr-detail, use specialized close-up block with quality rules
  let blockB: string;
  if (isCloseDetail && garmentAnalysis) {
    blockB = `GARMENT CONTEXT:
Type: ${garmentAnalysis.type || "N/A"}
Color: ${garmentAnalysis.color || "N/A"}
Fabric: ${garmentAnalysis.fabric || "N/A"}. Texture: ${garmentAnalysis.fabricTexture || "N/A"}.

ANGLE: Half-body crop centered on the waist/midsection area of the garment. Show construction details, fabric texture, and any decorative elements around the waist. Natural relaxed pose. NOT a macro close-up — maintain editorial distance showing garment context.

${TR_CLOSEUP_QUALITY_BLOCK}`;
  } else {
    // Length description with smart fallback
    const lengthDesc = garmentAnalysis?.lengthDescription
      || (garmentAnalysis?.length === "maxi" ? "ankle/floor"
        : garmentAnalysis?.length === "midi" ? "10-15cm below knee"
        : garmentAnalysis?.length === "short" ? "above knee"
        : "full length visible");

    // Proportions block — only include if we have real data
    const hasProportions = proportionJson?.garment_length_cm && resolvedMannequin?.height_cm;
    const proportionsBlock = hasProportions
      ? `\nPROPORTIONS (from ${toCm(resolvedMannequin.height_cm)} reference mannequin):
- Total garment length: ${toCm(proportionJson.garment_length_cm)}
- Waist position: ${toCm(proportionJson.waist_position_cm)} from shoulder`
      : "";

    blockB = `GARMENT — ABSOLUTE FIDELITY REQUIRED. Do not redesign, simplify or alter any detail.
${twoPieceBlock}
Fabric: ${garmentAnalysis?.fabric || "N/A"}. Texture: ${garmentAnalysis?.fabricTexture || "N/A"}.
Color: ${garmentAnalysis?.color || "N/A"} (${garmentAnalysis?.colorHexEstimate || "N/A"}) — fully monochromatic, no color variation.
Silhouette: ${garmentAnalysis?.silhouette || "N/A"}.
Length: ${garmentAnalysis?.length || "N/A"} — hem reaches ${lengthDesc}.
Neckline: ${garmentAnalysis?.neckline || "N/A"}
Sleeves: ${garmentAnalysis?.sleeves || "N/A"}. Cuff detail: ${garmentAnalysis?.sleeveDetail || garmentAnalysis?.sleeveLength || toCm(proportionJson?.sleeve_length_cm)}
Hem/Skirt: ${garmentAnalysis?.hemDetail || garmentAnalysis?.hemline || "N/A"}
Construction details: ${garmentAnalysis?.details || "N/A"}${proportionsBlock}`;
  }

  // TR badge block removed from prompt — badge will be added in post-production
  const hasTexturedKnit = /waffle|ridged|raised|dimensional|knit|textured knit|point|relevo|canelado/i.test(
    [garmentAnalysis?.fabricTexture, garmentAnalysis?.fabric, garmentAnalysis?.details?.toString()].join(' ')
  );

  const knitTextureBlock = hasTexturedKnit
    ? `FABRIC TEXTURE — MANDATORY REPLICATION:
The knit fabric has a PRONOUNCED 3D SURFACE TEXTURE — raised ridged waffle-stitch pattern. Each stitch is individually visible and creates dimensional relief on the surface. This is NOT a smooth jersey or flat knit.
- Texture depth: the ridges cast visible micro-shadows
- Surface feel: chunky, dimensional, tactile — like a waffle weave
- Light behavior: the raised stitches catch light on top, shadow in valleys
- The texture must be visible and consistent across the entire garment
- Do NOT render as smooth, flat, shiny, or jersey-like fabric
HARD FAIL: if fabric appears smooth, silky, or flat — regenerate.`
    : "";

  const trBadgeBlock = "";

  const modelIdentityBlock = modelProfile?.promptSeed
    ? modelProfile.promptSeed
    : `Brazilian latina woman, warm morena clara skin tone, dark brown wavy hair with natural movement, defined facial features with broad cheekbones, dark expressive eyes, full lips, natural bronze undertone.
NOT Asian features. NOT straight black hair. NOT pale skin. Authentic Brazilian commercial beauty, age 26-30.`;

  const blockC = angleType === "video-product"
    ? ""
    : `MODEL — CRITICAL IDENTITY:
${modelIdentityBlock}
Height: ${modelProfile?.height || "1.72"}m.
Measurements: bust ${toCm(modelProfile?.bust)}, waist ${toCm(modelProfile?.waist)}, hips ${toCm(modelProfile?.hip)}.
Beauty direction: authentic, natural beauty, real skin texture, NOT heavily filtered.

SKIN REALISM — MANDATORY:
Natural human skin with visible pores, subtle skin imperfections, and realistic texture.
The model must look like a REAL PERSON — NOT a mannequin, NOT a doll, NOT a 3D render.
Include natural skin details: fine lines, subtle freckles or moles where appropriate, natural skin sheen.
Avoid: plastic skin, porcelain finish, overly smooth airbrushed look, CGI appearance, wax figure look.`;

  const blockD = ANGLE_BLOCKS[angleType] || "";
  const fullBodyBlock = FULL_BODY_ANGLE_TYPES.has(angleType)
    ? (isFal ? FULL_BODY_CRITICAL_BLOCK_FAL : FULL_BODY_CRITICAL_BLOCK)
    : "";

  // Skirt length block with smart fallback for null hem_below_knee_cm
  let skirtLengthBlock = "";
  if (FULL_BODY_ANGLE_TYPES.has(angleType) && isDressLikeGarment(garmentAnalysis)) {
    const detectedLength = garmentAnalysis?.length || "maxi";
    const lengthDesc = garmentAnalysis?.lengthDescription
      || (detectedLength === "maxi" ? "ankle/floor. Full length visible"
        : detectedLength === "midi" ? "mid-calf, 10-15cm below knee"
        : detectedLength === "short" ? "above knee"
        : "full length visible");
    skirtLengthBlock = `SKIRT LENGTH CRITICAL: ${detectedLength} length. ${lengthDesc}.\nThe full skirt must be visible — do NOT crop the hem.`;
  }

  const faceAnchorBlock = angleType !== "video-product" ? buildFaceAnchorPrompt(modelProfile) : "";
  const footwearBlock = FULL_BODY_ANGLE_TYPES.has(angleType) ? FOOTWEAR_BLOCK : "";
  const genderBlock = FULL_BODY_ANGLE_TYPES.has(angleType) ? GENDER_BLOCK : "";

  // RULE 1: Bottom garment safety for upper-body pieces
  const bottomBlock = (FULL_BODY_ANGLE_TYPES.has(angleType) && isUpperBodyGarment(garmentAnalysis))
    ? BOTTOM_GARMENT_BLOCK : "";

  // RULE 2: Inner layer for jackets/open-front tops
  const innerLayerBlock = isOpenFrontGarment(garmentAnalysis) ? INNER_LAYER_BLOCK : "";

  const blockE = manualPrompt?.trim()
    ? `Additional direction from the designer: ${manualPrompt.trim()}
Apply this while maintaining all garment fidelity rules.`
    : "";

  return [
    blockA, blockB, knitTextureBlock, trBadgeBlock, genderBlock, blockC, faceAnchorBlock, footwearBlock,
    bottomBlock, innerLayerBlock, NO_TAGS_BLOCK,
    blockD, fullBodyBlock, skirtLengthBlock, basePrompt || "", blockE,
  ]
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

async function callGeminiGatewayOnce(prompt: string, imageUrlParts: any[], model: string, seed?: number, retries = 1) {
  const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
  if (!GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY is not configured");

  // Map gateway model names → Google API model names
  const googleModel = model
    .replace(/^google\//, "")
    .replace("gemini-3.1-flash-image-preview", "gemini-2.5-flash-image")
    .replace("gemini-3-pro-image-preview", "gemini-2.5-flash-image")
    .replace("gemini-2.5-flash-image-preview", "gemini-2.5-flash-image");


  // Build Google-format parts: text + inlineData for reference images
  const parts: any[] = [{ text: prompt }];
  for (const p of imageUrlParts) {
    const url = p?.image_url?.url || "";
    const m = url.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (m) {
      parts.push({ inlineData: { mimeType: `image/${m[1]}`, data: m[2] } });
    }
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) {
      // Keep retries short and return a retryable response instead of risking the 150s idle timeout.
      const delayMs = Math.min(5000 * Math.pow(2, attempt - 1), 10_000) + Math.random() * 1000;
      console.log(`[generate-image] Rate limited, waiting ${Math.round(delayMs)}ms before retry ${attempt + 1}/${retries}...`);
      await new Promise(r => setTimeout(r, delayMs));
    }


    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${googleModel}:generateContent?key=${GOOGLE_API_KEY}`;
    const generationConfig: Record<string, unknown> = { responseModalities: ["IMAGE", "TEXT"] };
    if (typeof seed === "number" && Number.isFinite(seed)) {
      generationConfig.seed = Math.floor(seed);
    }
    const response = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig,
      }),
    }, 70_000);

    if (response.status === 429 || response.status === 503) {
      if (attempt < retries - 1) continue;
      const retryAfterMs = parseRetryAfterMs(response) ?? 90_000;
      throw new GenerationRateLimitError("Google API rate limit excedido. Aguarde alguns segundos e tente novamente.", retryAfterMs);
    }


    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 402 || response.status === 403) {
        throw new Error(`Google API: cota/permissão (${response.status}). Verifique billing do projeto tha-studio.`);
      }
      throw new Error(`Google API image generation failed [${response.status}]: ${errText}`);
    }

    const data = await response.json();

    // Extract image from Google native format
    let imageUrl = "";
    const candidateParts = data?.candidates?.[0]?.content?.parts || [];
    for (const part of candidateParts) {
      if (part?.inlineData?.data) {
        const mime = part.inlineData.mimeType || "image/png";
        imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!imageUrl) {
      const textContent = candidateParts.find((p: any) => p?.text)?.text;
      console.error(`[generate-image] Google API returned no image. Model: ${googleModel}. Text: ${(textContent || "").substring(0, 500)}`);
    }

    return { imageUrl, modelUsed: googleModel, rawData: data };
  }

  throw new Error("Rate limits exceeded após múltiplas tentativas.");
}


async function callGeminiGateway(params: {
  promptUsed: string;
  referenceImages: string[];
  attemptNumber: number;
  seed?: number;
}) {
  const imageUrlParts: any[] = [];
  if (params.referenceImages.length > 0) {
    for (const img of params.referenceImages.slice(0, 3)) {
      const base64Match = img.match(/^data:image\/(.*?);base64,(.*)$/);
      if (base64Match) {
        imageUrlParts.push({
          type: "image_url",
          image_url: { url: `data:image/${base64Match[1]};base64,${base64Match[2]}` },
        });
      }
    }
  }

  // Use Flash by default (much faster). Pro só na 1ª tentativa explícita (attemptNumber === 0 indica forçar Pro).
  const PRIMARY_MODEL = "google/gemini-3.1-flash-image-preview";
  const FALLBACK_MODEL = "google/gemini-3.1-flash-image-preview";

  console.log(`[generate-image] Attempt 1 with ${PRIMARY_MODEL}, seed=${params.seed ?? "none"}`);
  const result1 = await callGeminiGatewayOnce(params.promptUsed, imageUrlParts, PRIMARY_MODEL, params.seed);
  if (result1.imageUrl) return { imageUrl: result1.imageUrl, modelUsed: result1.modelUsed };

  console.warn(`[generate-image] Retry with simplified prompt (model: ${FALLBACK_MODEL})`);
  const simplifiedPrompt = `Generate a professional fashion photograph based on this description. White studio background, full body shot, editorial quality.\n\n${params.promptUsed.substring(0, 1500)}`;
  const result2 = await callGeminiGatewayOnce(simplifiedPrompt, imageUrlParts, FALLBACK_MODEL, params.seed);
  if (result2.imageUrl) return { imageUrl: result2.imageUrl, modelUsed: result2.modelUsed };

  throw new Error("Gemini returned no image after 2 attempts. Possible content policy block.");
}

async function ensurePublicUrl(imageUrl: string): Promise<string> {
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  if (imageUrl.startsWith("data:image/")) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Cannot convert base64 to public URL: missing Supabase credentials");
    }

    const admin = getAdminClient();
    if (!admin) throw new Error("Cannot convert base64 to public URL: missing Supabase credentials");

    const match = imageUrl.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) throw new Error("Invalid base64 image format");

    const ext = match[1] === "jpeg" ? "jpg" : match[1];
    const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
    const objectPath = `temp-ref/${crypto.randomUUID()}.${ext}`;

    const { error } = await admin.storage.from(STORAGE_BUCKET).upload(objectPath, bytes, {
      contentType: `image/${match[1]}`,
      cacheControl: "3600",
      upsert: true,
    });

    if (error) throw new Error(`Failed to upload reference image: ${error.message}`);

    return buildPublicObjectUrl(supabaseUrl, STORAGE_BUCKET, objectPath);
  }

  throw new Error("Unsupported image format for fal.ai reference");
}

async function callFalEngine(params: {
  promptUsed: string;
  imageUrl?: string;
  angleType: AngleType;
  loraUrl?: string;
  loraTriggerWord?: string;
  loraScale?: number;
  guidanceScale?: number;
}) {
  const FAL_API_KEY = Deno.env.get("FAL_API_KEY");
  if (!FAL_API_KEY) throw new Error("FAL_API_KEY is not configured");

  fal.config({ credentials: FAL_API_KEY });

  let publicImageUrl: string | undefined;
  if (params.imageUrl) {
    publicImageUrl = await ensurePublicUrl(params.imageUrl);
  }

  const useReference = !!publicImageUrl;
  const useLora = !!params.loraUrl;
  const isCloseUp = params.angleType === "close-tr-detail";
  const isFrontView = params.angleType === "lookbook-front";
  const isSideOrBack = ["lookbook-back", "lookbook-left", "lookbook-three-quarter", "movement-shot"].includes(params.angleType);

  let endpoint: string;
  if (isCloseUp) {
    endpoint = "fal-ai/flux-2-pro";
  } else if (useLora && isFrontView) {
    endpoint = "fal-ai/flux-lora";
  } else if (isSideOrBack && useReference) {
    endpoint = "fal-ai/flux-pro/kontext";
  } else if (useLora) {
    endpoint = "fal-ai/flux-lora";
  } else if (useReference) {
    endpoint = "fal-ai/flux-pro/kontext";
  } else {
    endpoint = "fal-ai/flux-2-pro";
  }

  const imageSize = getImageSize(params.angleType);
  const loraScale = params.loraScale ?? 1.0;
  const guidanceScale = params.guidanceScale ?? 3.5;

  const usingLoraEndpoint = endpoint === "fal-ai/flux-lora";
  const finalPrompt = usingLoraEndpoint && params.loraTriggerWord
    ? `${params.loraTriggerWord} ${params.promptUsed}`
    : params.promptUsed;

  console.log(`[fal] endpoint=${endpoint}, hasRef=${useReference}, useLora=${useLora}, angleType=${params.angleType}, loraScale=${loraScale}, guidanceScale=${guidanceScale}`);

  const input: Record<string, unknown> = {
    prompt: finalPrompt,
    image_size: imageSize,
    output_format: "jpeg",
  };

  if (usingLoraEndpoint) {
    input.loras = [{ path: params.loraUrl!, scale: loraScale }];
    input.num_inference_steps = 28;
    input.guidance_scale = guidanceScale;
    input.output_quality = 95;
    if (useReference) {
      input.image_url = publicImageUrl;
    }
  } else if (endpoint === "fal-ai/flux-pro/kontext") {
    input.image_url = publicImageUrl;
    input.num_inference_steps = 28;
    input.guidance_scale = 3.5;
    input.output_quality = 95;
  } else {
    input.num_inference_steps = 28;
    input.guidance_scale = 3.5;
    input.output_quality = 95;
  }

  console.log(`[fal] Full payload for ${endpoint}:`, JSON.stringify({
    endpoint,
    angleType: params.angleType,
    hasLoraUrl: !!params.loraUrl,
    loraScale,
    guidanceScale,
    imageSize,
    promptLength: finalPrompt.length,
    promptStart: finalPrompt.substring(0, 120),
    hasImageUrl: !!input.image_url,
    inputKeys: Object.keys(input),
  }));

  try {
    const result = await fal.subscribe(endpoint, { input });
    const imageUrl = extractFalImageUrl(result);
    if (!imageUrl) {
      console.error(`[fal] No image in response for ${params.angleType}:`, JSON.stringify(result).substring(0, 500));
      throw new Error("No image found in fal.ai response");
    }
    return { imageUrl, modelUsed: endpoint };
  } catch (falError: unknown) {
    const errMsg = falError instanceof Error ? falError.message : String(falError);
    const errDetail = (falError as any)?.body || (falError as any)?.detail || (falError as any)?.response;
    console.error(`[fal] ERROR for angle=${params.angleType}, endpoint=${endpoint}:`, errMsg);
    console.error(`[fal] Error detail:`, JSON.stringify(errDetail || {}).substring(0, 1000));
    console.error(`[fal] Input sent:`, JSON.stringify(input).substring(0, 1000));
    throw new Error(`fal.ai ${endpoint} failed: ${errMsg}`);
  }
}

async function callSeedreamEngine(params: {
  promptUsed: string;
  imageUrls?: string[];
  angleType: AngleType;
  trBadgeUrl?: string | null;
}) {
  console.log("[callSeedreamEngine] invoked", { angleType: params.angleType, refImages: params.imageUrls?.length || 0, promptLen: params.promptUsed?.length || 0, hasTrBadge: !!params.trBadgeUrl });
  const FAL_API_KEY = Deno.env.get("FAL_API_KEY");
  if (!FAL_API_KEY) throw new Error("FAL_API_KEY is not configured");

  fal.config({ credentials: FAL_API_KEY });

  const isCloseUp = params.angleType === "close-tr-detail";
  const isFrontView = params.angleType === "lookbook-front";
  const hasRefs = params.imageUrls && params.imageUrls.length > 0;

  // For close-up: force edit mode whenever any reference (badge or garment) is available
  const useEdit = isCloseUp
    ? (!!params.trBadgeUrl || hasRefs)
    : (hasRefs && !isFrontView);

  const endpoint = useEdit
    ? "fal-ai/bytedance/seedream/v5/lite/edit"
    : "fal-ai/bytedance/seedream/v5/lite/text-to-image";

  const imageSize = isCloseUp ? "square_hd" : "portrait_4_3";

  // For close-up with badge reference, prepend instruction so the model treats Figure 1 as the canonical TR button
  let finalPrompt = params.promptUsed;
  if (isCloseUp && params.trBadgeUrl) {
    finalPrompt =
      "Figure 1 is the EXACT TR monogram button that must appear in this image. " +
      "Replicate it with maximum fidelity — same cut-through letters, same matte gold finish, same thread holes, same proportions. " +
      "Figure 2 shows the garment fabric context.\n\n" +
      params.promptUsed;
  }

  const input: Record<string, unknown> = {
    prompt: finalPrompt,
    image_size: imageSize,
    num_images: 1,
    enable_safety_checker: false,
  };

  if (useEdit) {
    let sourceUrls: string[] = [];
    if (isCloseUp && params.trBadgeUrl) {
      // Badge first, then up to 2 garment context images
      sourceUrls = [params.trBadgeUrl, ...((params.imageUrls || []).slice(0, 2))];
    } else if (params.imageUrls) {
      sourceUrls = params.imageUrls.slice(0, 10);
    }
    const publicUrls: string[] = [];
    for (const url of sourceUrls) {
      if (!url) continue;
      publicUrls.push(url.startsWith("data:") ? await ensurePublicUrl(url) : url);
    }
    if (publicUrls.length > 0) {
      input.image_urls = publicUrls;
    }
  }

  console.log(`[seedream5] endpoint=${endpoint}, angle=${params.angleType}, refs=${(input.image_urls as string[] | undefined)?.length ?? 0}, badgeFirst=${isCloseUp && !!params.trBadgeUrl}`);

  try {
    const result = await fal.subscribe(endpoint, { input });
    const imageUrl = extractFalImageUrl(result);
    if (!imageUrl) throw new Error("No image in Seedream 5.0 response");
    return { imageUrl, modelUsed: endpoint };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[seedream5] ERROR angle=${params.angleType}:`, msg);
    throw new Error(`Seedream 5.0 ${endpoint} failed: ${msg}`);
  }
}

async function callUpscaler(imageUrl: string): Promise<string> {
  const FAL_API_KEY = Deno.env.get("FAL_API_KEY");
  if (!FAL_API_KEY) {
    console.warn("[upscaler] FAL_API_KEY not set, skipping upscale");
    return imageUrl;
  }

  fal.config({ credentials: FAL_API_KEY });

  const publicUrl = await ensurePublicUrl(imageUrl);
  console.log(`[upscaler] Upscaling image: ${publicUrl.substring(0, 80)}...`);

  try {
    const result = await fal.subscribe("fal-ai/clarity-upscaler", {
      input: {
        image_url: publicUrl,
        scale: 2,
        overlapping_tiles: true,
        creativity: 0,
        resemblance: 1,
        prompt: "professional fashion photography, high resolution, sharp details, clean studio photo, preserve natural skin pores and texture details, do not smooth skin",
        negative_prompt: "blur, noise, artifacts, distortion, watermark, plastic skin, airbrushed skin, smooth skin, doll-like",
      },
    });

    const upscaledUrl = (result as any)?.image?.url
      || (result as any)?.data?.image?.url
      || (Array.isArray((result as any)?.images) ? (result as any).images[0]?.url : "")
      || "";

    if (!upscaledUrl) {
      console.error(`[upscaler] No upscaled image in response:`, JSON.stringify(result).substring(0, 500));
      return imageUrl;
    }

    console.log(`[upscaler] Success: ${upscaledUrl.substring(0, 80)}...`);
    return upscaledUrl;
  } catch (upscaleErr: unknown) {
    const errMsg = upscaleErr instanceof Error ? upscaleErr.message : String(upscaleErr);
    console.error(`[upscaler] ERROR:`, errMsg);
    return imageUrl;
  }
}

async function callFaceSwap(params: {
  generatedImageUrl: string;
  faceReferenceUrl: string;
}): Promise<string> {
  const FAL_API_KEY = Deno.env.get("FAL_API_KEY");
  if (!FAL_API_KEY) throw new Error("FAL_API_KEY is not configured for face swap");

  fal.config({ credentials: FAL_API_KEY });

  const publicGenUrl = await ensurePublicUrl(params.generatedImageUrl);
  const publicFaceUrl = await ensurePublicUrl(params.faceReferenceUrl);

  console.log(`[face-swap] Swapping face. Generated: ${publicGenUrl.substring(0, 80)}... Face ref: ${publicFaceUrl.substring(0, 80)}...`);

  try {
    const result = await fal.subscribe("fal-ai/face-swap", {
      input: {
        base_image_url: publicGenUrl,
        swap_image_url: publicFaceUrl,
      },
    });

    const swappedUrl = (result as any)?.image?.url
      || (result as any)?.data?.image?.url
      || (result as any)?.output_image_url
      || (result as any)?.data?.output_image_url
      || "";

    if (!swappedUrl) {
      console.error(`[face-swap] No swapped image in response:`, JSON.stringify(result).substring(0, 500));
      throw new Error("No swapped image found in face-swap response");
    }

    console.log(`[face-swap] Success: ${swappedUrl.substring(0, 80)}...`);
    return swappedUrl;
  } catch (swapErr: unknown) {
    const errMsg = swapErr instanceof Error ? swapErr.message : String(swapErr);
    console.error(`[face-swap] ERROR:`, errMsg);
    console.warn(`[face-swap] Falling back to original generated image`);
    return publicGenUrl;
  }
}

async function callFalVideoEngine(params: {
  promptUsed: string;
  imageUrl: string;
}) {
  const FAL_API_KEY = Deno.env.get("FAL_API_KEY");
  if (!FAL_API_KEY) throw new Error("FAL_API_KEY is not configured");

  fal.config({ credentials: FAL_API_KEY });

  const publicImageUrl = await ensurePublicUrl(params.imageUrl);

  const truncatedPrompt = params.promptUsed.length > 2000
    ? params.promptUsed.substring(0, 2000)
    : params.promptUsed;

  const endpoint = "fal-ai/kling-video/v2.5-turbo/pro/image-to-video";

  const videoInput = {
    prompt: truncatedPrompt,
    image_url: publicImageUrl,
    duration: "5",
    cfg_scale: 0.5,
    negative_prompt: "blur, distort, low quality, deformed hands, extra fingers, missing fingers, cropped, out of frame",
  };

  console.log(`[fal-video] Calling ${endpoint}:`, JSON.stringify({
    promptLength: truncatedPrompt.length,
    promptStart: truncatedPrompt.substring(0, 100),
    imageUrl: publicImageUrl.substring(0, 100),
    inputKeys: Object.keys(videoInput),
  }));

  try {
    const result = await fal.subscribe(endpoint, { input: videoInput });

    const videoUrl = (result as any)?.video?.url
      || (result as any)?.data?.video?.url
      || (result as any)?.video_url
      || (result as any)?.data?.video_url
      || "";

    if (!videoUrl) {
      console.error(`[fal-video] No video URL in response:`, JSON.stringify(result).substring(0, 500));
      throw new Error("No video found in Kling response");
    }

    return { videoUrl, modelUsed: endpoint };
  } catch (videoErr: unknown) {
    const errMsg = videoErr instanceof Error ? videoErr.message : String(videoErr);
    const errDetail = (videoErr as any)?.body || (videoErr as any)?.detail || (videoErr as any)?.response;
    console.error(`[fal-video] ERROR for ${endpoint}:`, errMsg);
    console.error(`[fal-video] Error detail:`, JSON.stringify(errDetail || {}).substring(0, 1000));
    throw new Error(`Kling video generation failed: ${errMsg}`);
  }
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

async function runGenerationPipeline(body: Record<string, any>): Promise<Record<string, any>> {
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
      seed,
      autoUpscale,
    } = body;

    const numericSeed = typeof seed === "number" && Number.isFinite(seed) ? Math.floor(seed) : undefined;

    const parsedAngle = (angleType || angle || "lookbook-front") as AngleType;
    const parsedEngine = (engine || "seedream") as GenerationEngine;
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
      // Video generation is temporarily disabled
      return {
        error: "Geração de vídeo temporariamente desativada. Apenas prompts de texto são gerados.",
        code: "video_disabled",
        promptUsed,
        attemptNumber: requestAttempt,
      };
    }

    let result: { imageUrl: string; modelUsed: string };
    try {
      result = parsedEngine === "seedream"
        ? await callSeedreamEngine({
            promptUsed,
            imageUrls: falReferenceImage
              ? [falReferenceImage, ...(Array.isArray(referenceImages) ? referenceImages.slice(0, 2) : [])]
              : (Array.isArray(referenceImages) ? referenceImages.slice(0, 3) : []),
            angleType: parsedAngle,
            trBadgeUrl: (body as any)?.trBadgeUrl || null,
          })
        : parsedEngine === "fal"
          ? await callFalEngine({
              promptUsed,
              imageUrl: falReferenceImage,
              angleType: parsedAngle,
              loraUrl: modelProfile?.lora_url,
              loraTriggerWord: modelProfile?.lora_trigger_word,
              loraScale: modelProfile?.lora_scale ?? 1.0,
              guidanceScale: modelProfile?.guidance_scale ?? 3.5,
            })
          : await callGeminiGateway({
              promptUsed,
              referenceImages: Array.isArray(referenceImages)
                ? referenceImages
                : firstReferenceImage ? [firstReferenceImage] : [],
              attemptNumber: requestAttempt,
              seed: numericSeed,
            });
    } catch (engineErr: unknown) {
      const errMsg = engineErr instanceof Error ? engineErr.message : String(engineErr);
      console.error(`[generate-image] Engine error for angle=${parsedAngle}, engine=${parsedEngine}: ${errMsg}`);
      if (isRateLimitError(engineErr)) {
        const retryAfterMs = engineErr instanceof GenerationRateLimitError ? engineErr.retryAfterMs : 90_000;
        return {
          error: `Generation delayed for ${parsedAngle} (${parsedEngine}): ${errMsg}`,
          code: "rate_limited",
          retryable: true,
          retryAfterMs,
          promptUsed,
          attemptNumber: requestAttempt,
          engineUsed: parsedEngine,
          seedUsed: numericSeed ?? null,
        };
      }
      throw new Error(`Generation failed for ${parsedAngle} (${parsedEngine}): ${errMsg}`);
    }

    // Face swap removed — Seedream/fal handle identity via prompt + references.

    // Save raw (pre-upscale) image to storage as JPG
    const rawAsset = await uploadGeneratedAsset({
      sourceUrl: result.imageUrl,
      launchId,
      type: parsedAngle,
      attemptNumber: requestAttempt,
    });
    const rawUrl = rawAsset.originalUrl;

    // Auto-upscale can push the request beyond the 150s idle limit. Keep HD upscale on-demand at download time.
    let upscaled = false;
    let finalImageUrl = result.imageUrl;
    if (autoUpscale === true) {
      try {
        const upscaledUrl = await withTimeout(callUpscaler(result.imageUrl), 25_000, "upscale");
        if (upscaledUrl && upscaledUrl !== result.imageUrl) {
          finalImageUrl = upscaledUrl;
          upscaled = true;
        }
      } catch (upErr) {
        console.error(`[generate-image] Upscale failed, using original:`, upErr);
      }
    }

    // Upload upscaled (or original if upscale failed) as the main HD asset — JPG
    let storedAsset;
    if (upscaled) {
      storedAsset = await uploadGeneratedAsset({
        sourceUrl: finalImageUrl,
        launchId,
        type: parsedAngle,
        attemptNumber: requestAttempt,
        suffix: "hd",
      });
    } else {
      storedAsset = rawAsset;
    }

    return {
      imageUrl: storedAsset.imageUrl,
      originalUrl: storedAsset.originalUrl,
      previewUrl: storedAsset.previewUrl,
      rawUrl,
      upscaled,
      promptUsed,
      modelUsed: result.modelUsed,
      attemptNumber: requestAttempt,
      engineUsed: parsedEngine,
      seedUsed: numericSeed ?? null,
    };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const imageId = typeof body?.imageId === "string" ? body.imageId : undefined;
    const runInBackground = body?.background === true && !!imageId;

    if (runInBackground) {
      await updateGeneratedImageRow(imageId, { status: "generating", error: null });
      waitUntilBackground(
        runGenerationPipeline(body)
          .then(async (payload) => {
            if (payload?.code || payload?.error) {
              await updateGeneratedImageRow(imageId, {
                status: "error",
                error: payload.error || "A geração não retornou imagem.",
                prompt_used: payload.promptUsed || body.prompt || body.basePrompt || null,
                attempt_number: payload.attemptNumber || body.attemptNumber || 1,
                model_used: payload.engineUsed || body.engine || null,
                seed_used: payload.seedUsed ?? body.seed ?? null,
              });
              return;
            }

            await updateGeneratedImageRow(imageId, {
              status: "done",
              error: null,
              image_url: payload.imageUrl || null,
              original_url: payload.originalUrl || payload.imageUrl || null,
              preview_url: payload.previewUrl || payload.imageUrl || null,
              raw_url: payload.rawUrl || null,
              upscaled: payload.upscaled || false,
              model_used: payload.modelUsed || null,
              attempt_number: payload.attemptNumber || body.attemptNumber || 1,
              prompt_used: payload.promptUsed || body.prompt || body.basePrompt || null,
              seed_used: payload.seedUsed ?? body.seed ?? null,
            });
          })
          .catch(async (error: unknown) => {
            const msg = error instanceof Error ? error.message : "Unknown error";
            console.error(`[generate-image] Background generation failed for ${imageId}: ${msg}`);
            await updateGeneratedImageRow(imageId, {
              status: "error",
              error: msg,
              attempt_number: body.attemptNumber || 1,
              prompt_used: body.prompt || body.basePrompt || null,
              seed_used: body.seed ?? null,
            });
          }),
      );

      return jsonResponse({ code: "processing", status: "generating", imageId }, 202);
    }

    const payload = await runGenerationPipeline(body);
    return jsonResponse(payload);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    const status = isRateLimitError(error) ? 200 : 500;
    return jsonResponse({ error: msg }, status);
  }
});
