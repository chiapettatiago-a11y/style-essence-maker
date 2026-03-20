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
  color?: string;
  color_hex_estimate?: string;
  pattern?: string;
  pattern_description?: string;
  silhouette?: string;
  neckline?: string;
  sleeve_type?: string;
  sleeve_length?: string;
  hem_type?: string;
  garment_length?: string;
  length_description?: string;
  construction?: string;
  closure?: string;
  belt_or_tie?: string;
  details?: string;
  signature_details?: string;
  prompt_description?: string;
  proportions?: {
    garment_length_ratio?: number;
    waist_ratio?: number;
    sleeve_ratio?: number;
    shoulder_ratio?: number;
  };
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

const SYSTEM_PROMPT = `You are an expert technical fashion analyst for a Brazilian womenswear brand.
Analyze the garment photos and return ONLY a valid JSON object with no text before or after.

{
  "garment_type": "dress|blouse|pants|skirt|jacket",
  "fabric": "detailed fabric description",
  "color": "precise color description",
  "color_hex_estimate": "#xxxxxx",
  "pattern": "solid|paisley|floral|geometric|stripes|etc",
  "pattern_description": "detailed pattern description",
  "silhouette": "A-line|fitted|straight|wrap|etc",
  "neckline": "precise collar/neckline description",
  "sleeve_type": "sleeveless|short|3/4|long|balloon|etc",
  "sleeve_length": "exact description of sleeve length",
  "hem_type": "straight|asymmetric|ruffled|etc",
  "garment_length": "mini|knee|midi|maxi — with description e.g. midi, falls 15cm below knee",
  "length_description": "precise description: where hem falls relative to knee",
  "construction": "visible construction details",
  "closure": "buttons|zipper|wrap|etc — describe in detail",
  "belt_or_tie": "describe exactly: fabric self-tie sash / leather belt / none",
  "details": "ALL details: buttons, cuffs, pockets, pleats, gathering",
  "signature_details": "TR monogram button location, brand label location",
  "proportions": {
    "garment_length_ratio": 0.72,
    "waist_ratio": 0.40,
    "sleeve_ratio": 1.0,
    "shoulder_ratio": 0.44
  },
  "prompt_description": "one paragraph describing the garment precisely for image generation, emphasizing ALL details that must be preserved"
}

Critical rules:
- NEVER leave garment_length or length_description empty
- If unsure of exact length, estimate based on visual proportions
- Be extremely precise about belt/tie type — fabric sash vs leather belt are very different
- The prompt_description field will be used directly in AI image generation prompts`;

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
      garment_length: analysis.garment_length || null,
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
    garment_length: analysis.garment_length || computedLength,
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
    fullDescription: raw.prompt_description || "",
    length: raw.garment_length || proportions.garment_length || "",
    silhouette: raw.silhouette || "",
    hemline: raw.hem_type || "",
    neckline: raw.neckline || "",
    sleeves: raw.sleeve_type || "",
    colorHexEstimate: raw.color_hex_estimate || "",
    patternDescription: raw.pattern_description || "",
    hemType: raw.hem_type || "",
    lengthDescription: raw.length_description || "",
    sleeveLength: raw.sleeve_length || "",
    closure: raw.closure || "",
    beltOrTie: raw.belt_or_tie || "",
    signatureDetails: raw.signature_details || "",
    promptDescription: raw.prompt_description || "",
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

async function callLovableAI(images: string[]) {
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
        { role: "system", content: SYSTEM_PROMPT },
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

async function callClaudeAI(images: string[]) {
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
      model: "claude-sonnet-4-6-20260320",
      system: SYSTEM_PROMPT,
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

async function callAI(images: string[]) {
  const hasClaude = Boolean(Deno.env.get("ANTHROPIC_API_KEY"));
  const hasLovableAI = Boolean(Deno.env.get("LOVABLE_API_KEY"));

  if (hasClaude) {
    return await callClaudeAI(images);
  }

  if (hasLovableAI) {
    return await callLovableAI(images);
  }

  throw new UpstreamAIError("Nenhum provedor de IA configurado para análise técnica.", 500, "missing_secret");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { images, mannequin } = await req.json();

    if (!Array.isArray(images) || images.length === 0) {
      return new Response(JSON.stringify({ error: "No images provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const content = await callAI(images);
    const raw = JSON.parse(stripJsonWrapper(content)) as AnalysisResult;

    if (!raw.garment_length || !raw.length_description) {
      console.warn("AI response missing garment length fields, using defaults");
      raw.garment_length = raw.garment_length || "midi";
      raw.length_description = raw.length_description || "estimated from visual proportions";
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
