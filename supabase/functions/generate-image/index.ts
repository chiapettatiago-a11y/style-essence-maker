import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NEGATIVE_PROMPT = "wrinkles, creases, folds, crumpled fabric, price tag, hang tag, visible tag, distorted face, extra limbs, blurry, low quality, cartoon, watermark, text overlay";

const ENGINE_MODELS: Record<string, string> = {
  ultra: "imagen-4.0-ultra-generate-001",
  standard: "imagen-4.0-generate-001",
  fast: "imagen-4.0-fast-generate-001",
};

async function callImagen4(model: string, prompt: string, apiKey: string): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`;
  console.log(`[Imagen4] Calling model: ${model}`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{
        prompt,
        negativePrompt: NEGATIVE_PROMPT,
        sampleCount: 1,
        aspectRatio: "9:16",
        safetyFilterLevel: "block_few",
        personGeneration: "allow_adult",
      }],
      parameters: { sampleCount: 1 },
    }),
  });
  if (!res.ok) {
    console.error(`[Imagen4] ${model} failed ${res.status}: ${await res.text()}`);
    return null;
  }
  const data = await res.json();
  return data?.predictions?.[0]?.bytesBase64Encoded ?? null;
}

async function callGemini(model: string, prompt: string, apiKey: string): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  console.log(`[Gemini] Calling model: ${model}`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
    }),
  });
  if (!res.ok) {
    console.error(`[Gemini] ${model} failed ${res.status}: ${await res.text()}`);
    return null;
  }
  const data = await res.json();
  for (const part of data?.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.mimeType?.startsWith("image/")) return part.inlineData.data;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { prompt, launch_id, photo_id, engine = "standard", bucket = "generated-assets" } = await req.json();
    if (!prompt) return new Response(JSON.stringify({ error: "prompt is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const apiKey = Deno.env.get("GOOGLE_API_KEY")!;

    let base64: string | null = null;
    let engineUsed = engine;

    // Imagen 4 engines
    if (["ultra", "standard", "fast"].includes(engine)) {
      base64 = await callImagen4(ENGINE_MODELS[engine], prompt, apiKey);
      if (!base64 && engine !== "standard") {
        console.warn(`[Cascade] ${engine} failed, trying standard...`);
        base64 = await callImagen4(ENGINE_MODELS.standard, prompt, apiKey);
        engineUsed = "standard";
      }
    }

    // Gemini fallback — use current model names
    if (!base64) {
      console.warn("[Cascade] Falling back to Gemini Pro...");
      base64 = await callGemini("gemini-2.0-flash-exp", prompt, apiKey);
      engineUsed = "gemini";
    }

    if (!base64) throw new Error("All engines failed");

    const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const path = `launches/${launch_id ?? "unknown"}/${photo_id ?? Date.now()}.png`;

    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, binary, { contentType: "image/png", upsert: true });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);

    if (photo_id) {
      await supabase.from("launch_photos").update({ image_url: publicUrl, engine_used: engineUsed, status: "completed", generated_at: new Date().toISOString() }).eq("id", photo_id);
    }

    console.log(`[Done] engine=${engineUsed} url=${publicUrl}`);
    return new Response(JSON.stringify({ url: publicUrl, engine_used: engineUsed }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[generate-image] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
