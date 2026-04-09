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

type AnalysisResult = {
  garment_type?: string;
  fabric?: string;
  fabric_texture?: string;
  color?: string;
  color_hex_estimate?: string;
  pattern?: string;
  pattern_description?: string;
  silhouette?: string;
  neckline?: string;
  sleeve_type?: string;
  sleeve_detail?: string;
  hem_type?: string;
  hem_detail?: string;
  length?: string;
  construction?: string;
  details?: string;
  tr_badge_location?: string | null;
  tr_badge_description?: string | null;
  proportions?: {
    garment_length_ratio?: number;
    waist_ratio?: number;
    sleeve_ratio?: number;
    shoulder_ratio?: number;
  };
  // Legacy fields mapped for backward compat
  garment_length?: string;
  length_description?: string;
  sleeve_length?: string;
  closure?: string;
  belt_or_tie?: string;
  signature_details?: string;
  prompt_description?: string;
};

class UpstreamAIError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = "ai_error") {
    super(message);
    this.name = "UpstreamAIError";
    this.status = status;
    this.code = code;
  }
}

const SYSTEM_PROMPT = `You are a professional fashion analyst for a Brazilian fashion brand called THAIS RODRIGUES (TR).
Analyze the garment photos and return ONLY a valid JSON object.
No text before or after the JSON.

IMPORTANT: Photos may have dark backgrounds, hangers, wooden racks, or papers in front of the garment. Ignore all background elements. Focus ONLY on the garment itself.

CRITICAL — TWO-PIECE SET DETECTION:
If you see a cropped top/blouse AND a separate skirt/pants displayed together, identify as:
  garment_type: "two-piece set"
Describe EACH piece separately in the "details" array.

TR SIGNATURE BADGE — ACCURACY RULE:
Look carefully for a small round metallic button/charm engraved with "TR" monogram.
Describe ONLY what you actually see and its exact position.
If the TR badge is not clearly visible in the reference photos, set tr_badge_location to null.

{
  "garment_type": "dress|blouse|shirt|skirt|pants|jacket|coat|top|two-piece set",
  "fabric": "primary fabric — single raw material name in English (tweed, satin, denim, silk, cotton, linen, knit, lace, chiffon, crepe, velvet, organza, leather, faux leather, boucle, etc.) — NOT a description like 'woven fabric'",
  "fabric_secondary": "secondary fabric if combo, or null",
  "fabric_texture": "visual texture description — e.g. alternating horizontal knit bands, waffle stitch, pointelle lace, smooth jersey",
  "color": "color description",
  "color_hex_estimate": "#xxxxxx",
  "pattern": "solid|woven|printed|embroidered|lace|textured|stripes|floral|patchwork|none",
  "pattern_description": "detailed pattern or texture description, or null",
  "silhouette": "fitted|A-line|straight|wrap|oversized|semi-fitted|etc",
  "neckline": "exact neckline description",
  "sleeve_type": "sleeveless|cap|short|3/4|long|puff|balloon|etc",
  "sleeve_detail": "detailed sleeve construction — e.g. gathered ruffle cuff, self-tie bow, ribbed, plain",
  "hem_type": "straight|asymmetric|tiered ruffles|scalloped|etc",
  "hem_detail": "detailed hem description",
  "length": "mini|short|midi|maxi|cropped|ankle",
  "hem_position": "well above knee|above knee|at knee|below knee|ankle|floor",
  "closure": "zipper back|zipper side|buttons front|etc",
  "lining": "lining description if visible, or null",
  "construction": "visible seams, panels, structural details",
  "details": [
    "each visible detail as a separate string — be specific and exhaustive"
  ],
  "tr_badge_location": "exact TR badge location or null",
  "tr_badge_description": "badge description or null",
  "signature_details": "TR monogram button: location and exact description. THAIS RODRIGUES label: location",
  "proportions": {
    "garment_length_ratio": 0.0,
    "waist_ratio": 0.0,
    "sleeve_ratio": 0.0,
    "shoulder_ratio": 0.0
  }
}

Critical rules:
- fabric must be the raw material name (tweed, satin, denim...) NOT a description like "woven fabric"
- details MUST be an array of strings — list EVERY visible detail as a separate item
- proportions: ratios 0-1 relative to total garment height
- NEVER leave length empty — estimate from visual proportions if unsure
- fabric_texture must describe the VISUAL texture pattern, not just fabric type
- sleeve_detail must describe the FINISH of the sleeve (cuff, tie, ruffle, plain)
- hem_detail must describe the FULL hem construction (tiers, gathers, finish)
- tr_badge_location must be the EXACT position or null — do NOT guess
- For PATCHWORK: describe each panel separately
- For TIERED/RUFFLE: count tiers, describe each tier's gathering
- For TWO-PIECE SETS: describe each piece separately in details array
- Return ONLY the JSON`;

const COMBO_SYSTEM_PROMPT = `You are an expert technical fashion analyst for a Brazilian womenswear brand called THAIS RODRIGUES (TR).
You are analyzing a COMBINATION LOOK — two separate garments worn together, not a single piece.

Identify and analyze each garment independently.

GARMENT 1 (TOP — the upper piece):
Return a JSON object for the top piece with all fields (garment_type, fabric, color, sleeve_type, neckline, etc.)

GARMENT 2 (BOTTOM — the lower piece):
Return a JSON object for the bottom piece with all fields (garment_type, fabric, color, hem_type, length, etc.)

Also return:
- featured_piece: 'top' | 'bottom' (which is the star of this shoot)
- combo_description: brief description of how the two pieces work together

Return ONLY valid JSON in this structure:
{
  "top": {
    "garment_type": "...",
    "fabric": "...",
    "fabric_texture": "...",
    "color": "...",
    "color_hex_estimate": "#xxxxxx",
    "pattern": "...",
    "pattern_description": "...",
    "silhouette": "...",
    "neckline": "...",
    "sleeve_type": "...",
    "sleeve_detail": "...",
    "hem_type": "...",
    "hem_detail": "...",
    "length": "...",
    "construction": "...",
    "details": "...",
    "tr_badge_location": null,
    "tr_badge_description": null,
    "proportions": { "garment_length_ratio": 0.0, "waist_ratio": 0.0, "sleeve_ratio": 0.0, "shoulder_ratio": 0.0 }
  },
  "bottom": {
    "garment_type": "...",
    "fabric": "...",
    "fabric_texture": "...",
    "color": "...",
    "color_hex_estimate": "#xxxxxx",
    "pattern": "...",
    "pattern_description": "...",
    "silhouette": "...",
    "neckline": "N/A",
    "sleeve_type": "N/A",
    "sleeve_detail": "N/A",
    "hem_type": "...",
    "hem_detail": "...",
    "length": "...",
    "construction": "...",
    "details": "...",
    "tr_badge_location": null,
    "tr_badge_description": null,
    "proportions": { "garment_length_ratio": 0.0, "waist_ratio": 0.0, "sleeve_ratio": 0.0, "shoulder_ratio": 0.0 }
  },
  "featured_piece": "top",
  "combo_description": "..."
}

DO NOT merge the two garments into one description.
Critical rules:
- NEVER leave length empty — estimate from visual proportions if unsure
- fabric_texture must describe the VISUAL texture pattern
- For each piece, describe construction details independently`;


function normalizeRatio(value: unknown, fallback: number): number {
  const n = Number(value);
  if (Number.isNaN(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function calculateProportions(analysis: AnalysisResult, mannequin: Mannequin) {
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
      garment_length: analysis.length || analysis.garment_length || null,
    };
  }

  const garmentLengthRatio = normalizeRatio(analysis.proportions?.garment_length_ratio, 0.8);
  const waistRatio = normalizeRatio(analysis.proportions?.waist_ratio, 0.46);
  const sleeveRatio = normalizeRatio(analysis.proportions?.sleeve_ratio, 0.9);
  const shoulderRatio = normalizeRatio(analysis.proportions?.shoulder_ratio, 0.42);

  const garment_length_cm = Math.round(garmentLengthRatio * h);
  const waist_position_cm = Math.round(waistRatio * h);
  const sleeve_length_cm = Math.round(sleeveRatio * arm);
  const shoulder_width_cm = Math.round(shoulderRatio * bust);

  const knee_position_cm = Math.round(0.61 * h);
  const hem_below_knee_cm = garment_length_cm - knee_position_cm;

  const computedLength =
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
    garment_length: analysis.length || analysis.garment_length || computedLength,
  };
}

function stripJsonWrapper(content: string) {
  const cleaned = content.replace(/```json|```/gi, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Could not parse JSON from AI response");
  return jsonMatch[0];
}

function mapAnalysis(raw: AnalysisResult, proportions: ReturnType<typeof calculateProportions>) {
  return {
    type: raw.garment_type || "",
    fabric: raw.fabric || "",
    color: raw.color || "",
    pattern: raw.pattern || "",
    construction: raw.construction || "",
    details: raw.details || "",
    style: "",
    fullDescription: "",
    length: raw.length || raw.garment_length || proportions.garment_length || "",
    silhouette: raw.silhouette || "",
    hemline: raw.hem_type || "",
    neckline: raw.neckline || "",
    sleeves: raw.sleeve_type || "",
    colorHexEstimate: raw.color_hex_estimate || "",
    patternDescription: raw.pattern_description || "",
    hemType: raw.hem_type || "",
    hemDetail: raw.hem_detail || "",
    lengthDescription: raw.length_description || "",
    sleeveLength: raw.sleeve_length || raw.sleeve_type || "",
    sleeveDetail: raw.sleeve_detail || "",
    closure: raw.closure || "",
    beltOrTie: raw.belt_or_tie || "",
    signatureDetails: raw.signature_details || "",
    promptDescription: raw.prompt_description || "",
    fabricTexture: raw.fabric_texture || "",
    trBadgeLocation: raw.tr_badge_location || null,
    trBadgeDescription: raw.tr_badge_description || null,
  };
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new UpstreamAIError("Formato de imagem inválido para análise técnica.", 400, "invalid_image");
  }

  return {
    mediaType: match[1],
    data: match[2],
  };
}


function mapProviderError(status: number, errText: string, providerLabel: string) {
  if (status === 402 || /payment_required|not enough credits|credit balance is too low|insufficient credits/i.test(errText)) {
    return new UpstreamAIError(
      "Créditos de IA insuficientes para analisar a peça. Adicione créditos em Settings → Workspace → Usage e tente novamente.",
      402,
      "payment_required"
    );
  }

  if (status === 429 || /rate limit/i.test(errText)) {
    return new UpstreamAIError(
      "Limite de requisições da IA atingido. Aguarde alguns instantes e tente novamente.",
      429,
      "rate_limited"
    );
  }

  return new UpstreamAIError(`${providerLabel} failed [${status}]: ${errText}`, status, "ai_error");
}

async function callLovableAI(images: string[], systemPrompt: string = SYSTEM_PROMPT) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new UpstreamAIError("LOVABLE_API_KEY is not configured", 500, "missing_secret");
  }

  const contentParts: Array<Record<string, unknown>> = images.slice(0, 4).map((image) => ({
    type: "image_url",
    image_url: { url: image },
  }));

  contentParts.push({
    type: "text",
    text: "Analyze these hanger garment photos with maximum technical precision and return only the requested JSON.",
  });

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: contentParts },
      ],
      max_tokens: 2000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw mapProviderError(response.status, await response.text(), "Lovable AI");
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callClaudeAI(images: string[], systemPrompt: string = SYSTEM_PROMPT) {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    throw new UpstreamAIError("ANTHROPIC_API_KEY is not configured", 500, "missing_secret");
  }

  const contentParts: Array<Record<string, unknown>> = images.slice(0, 4).map((image) => {
    const parsed = parseDataUrl(image);
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: parsed.mediaType,
        data: parsed.data,
      },
    };
  });

  contentParts.push({
    type: "text",
    text: "Analyze these hanger garment photos with maximum technical precision and return only the requested JSON.",
  });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-6",
      system: systemPrompt,
      max_tokens: 2000,
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: contentParts,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw mapProviderError(response.status, await response.text(), "Claude API");
  }

  const data = await response.json();
  const textBlock = data.content?.find?.((item: { type?: string }) => item.type === "text");
  return textBlock?.text || "";
}

async function callAI(images: string[], isCombo = false) {
  const hasClaude = Boolean(Deno.env.get("ANTHROPIC_API_KEY"));
  const hasLovableAI = Boolean(Deno.env.get("LOVABLE_API_KEY"));
  const systemPrompt = isCombo ? COMBO_SYSTEM_PROMPT : SYSTEM_PROMPT;

  // Try Claude first with retry, then fallback to Lovable AI
  if (hasClaude) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await callClaudeAI(images, systemPrompt);
      } catch (err) {
        const isRetryable = err instanceof UpstreamAIError && (err.status === 529 || err.status === 503);
        if (isRetryable && attempt === 0) {
          console.warn("Claude overloaded, retrying in 3s...");
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        // On second failure or non-retryable, fallback to Lovable AI
        if (isRetryable && hasLovableAI) {
          console.warn("Claude still unavailable, falling back to Lovable AI");
          return await callLovableAI(images, systemPrompt);
        }
        throw err;
      }
    }
  }

  if (hasLovableAI) {
    return await callLovableAI(images, systemPrompt);
  }

  throw new UpstreamAIError("Nenhum provedor de IA configurado para análise técnica.", 500, "missing_secret");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { images, mannequin, isCombo, featuredPiece } = await req.json();

    if (!Array.isArray(images) || images.length === 0) {
      return new Response(JSON.stringify({ error: "No images provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const content = await callAI(images, isCombo === true);

    if (isCombo) {
      // Parse combo response
      const comboRaw = JSON.parse(stripJsonWrapper(content));
      const topRaw = comboRaw.top as AnalysisResult;
      const bottomRaw = comboRaw.bottom as AnalysisResult;

      const topProportions = calculateProportions(topRaw, mannequin || {});
      const bottomProportions = calculateProportions(bottomRaw, mannequin || {});

      const topAnalysis = mapAnalysis(topRaw, topProportions);
      const bottomAnalysis = mapAnalysis(bottomRaw, bottomProportions);

      // Use the featured piece as the main analysis
      const featured = (featuredPiece || comboRaw.featured_piece || "top") as string;
      const mainAnalysis = featured === "bottom" ? bottomAnalysis : topAnalysis;
      const mainProportions = featured === "bottom" ? bottomProportions : topProportions;

      return new Response(JSON.stringify({
        analysis: mainAnalysis,
        proportions: mainProportions,
        raw: comboRaw,
        isCombo: true,
        topAnalysis,
        bottomAnalysis,
        comboDescription: comboRaw.combo_description || "",
        featuredPiece: featured,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const raw = JSON.parse(stripJsonWrapper(content)) as AnalysisResult;

    if (!raw.length && !raw.garment_length) {
      console.warn("AI response missing garment length fields, using defaults");
      raw.length = "midi";
    }

    const proportions = calculateProportions(raw, mannequin || {});
    const analysis = mapAnalysis(raw, proportions);

    return new Response(JSON.stringify({ analysis, proportions, raw }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    const status = error instanceof UpstreamAIError ? error.status : 500;
    const code = error instanceof UpstreamAIError ? error.code : "unknown_error";
    console.error("analyze-garment error:", msg);
    return new Response(JSON.stringify({ error: msg, code }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
