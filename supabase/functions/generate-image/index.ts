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

interface FalInput {
  prompt: string;
  image_url?: string;
  lora_url?: string;
  lora_scale?: number;
  guidance_scale?: number;
  num_images?: number;
  output_format?: string;
  aspect_ratio?: string;
}

async function callFalKontext(
  prompt: string,
  falKey: string,
  options?: { image_url?: string; lora_url?: string; lora_scale?: number; guidance_scale?: number }
): Promise<string | null> {
  console.log(`[fal.ai] Calling flux-pro/kontext`);

  const input: FalInput = {
    prompt,
    num_images: 1,
    output_format: "png",
    aspect_ratio: "9:16",
  };

  if (options?.image_url) input.image_url = options.image_url;
  if (options?.lora_url) input.lora_url = options.lora_url;
  if (options?.lora_scale !== undefined) input.lora_scale = options.lora_scale;
  if (options?.guidance_scale !== undefined) input.guidance_scale = options.guidance_scale;

  // Submit job
  const submitRes = await fetch("https://queue.fal.run/fal-ai/flux-pro/kontext", {
    method: "POST",
    headers: {
      "Authorization": `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input }),
  });

  if (!submitRes.ok) {
    console.error(`[fal.ai] Submit failed ${submitRes.status}: ${await submitRes.text()}`);
    return null;
  }

  const submitData = await submitRes.json();

  // If we got images directly (sync response)
  if (submitData?.images?.[0]?.url) {
    const imageUrl = submitData.images[0].url;
    console.log(`[fal.ai] Got sync result: ${imageUrl}`);
    // Download image and convert to base64
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return null;
    const imgBuf = await imgRes.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuf)));
    return base64;
  }

  // If async, poll for result
  const requestId = submitData?.request_id;
  if (!requestId) {
    console.error("[fal.ai] No request_id and no sync result");
    return null;
  }

  console.log(`[fal.ai] Polling request_id: ${requestId}`);
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const statusRes = await fetch(`https://queue.fal.run/fal-ai/flux-pro/kontext/requests/${requestId}/status`, {
      headers: { "Authorization": `Key ${falKey}` },
    });
    if (!statusRes.ok) continue;
    const statusData = await statusRes.json();

    if (statusData.status === "COMPLETED") {
      const resultRes = await fetch(`https://queue.fal.run/fal-ai/flux-pro/kontext/requests/${requestId}`, {
        headers: { "Authorization": `Key ${falKey}` },
      });
      if (!resultRes.ok) return null;
      const resultData = await resultRes.json();
      const imageUrl = resultData?.images?.[0]?.url;
      if (!imageUrl) return null;

      console.log(`[fal.ai] Got async result: ${imageUrl}`);
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) return null;
      const imgBuf = await imgRes.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuf)));
      return base64;
    }

    if (statusData.status === "FAILED") {
      console.error(`[fal.ai] Job failed: ${JSON.stringify(statusData)}`);
      return null;
    }
  }

  console.error("[fal.ai] Timeout waiting for result");
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      prompt,
      launch_id,
      launchId,
      photo_id,
      engine = "standard",
      bucket = "generated-assets",
      // fal.ai specific params
      image_url,
      lora_url,
      lora_scale,
      guidance_scale,
    } = body;
    const effectiveLaunchId = launch_id || launchId;

    if (!prompt) return new Response(JSON.stringify({ error: "prompt is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const apiKey = Deno.env.get("GOOGLE_API_KEY")!;

    let base64: string | null = null;
    let engineUsed = engine;

    // ── fal.ai Flux Kontext (manual selection, no cascade) ──
    if (engine === "fal" || engine === "fal.ai") {
      const falKey = Deno.env.get("FAL_API_KEY");
      if (!falKey) throw new Error("FAL_API_KEY not configured");
      base64 = await callFalKontext(prompt, falKey, {
        image_url,
        lora_url,
        lora_scale,
        guidance_scale,
      });
      engineUsed = "fal";
      if (!base64) throw new Error("fal.ai Flux Kontext failed");
    }

    // ── Imagen 4 engines (with cascade) ──
    if (!base64 && ["ultra", "standard", "fast"].includes(engine)) {
      base64 = await callImagen4(ENGINE_MODELS[engine], prompt, apiKey);
      if (!base64 && engine !== "standard") {
        console.warn(`[Cascade] ${engine} failed, trying standard...`);
        base64 = await callImagen4(ENGINE_MODELS.standard, prompt, apiKey);
        engineUsed = "standard";
      }
    }

    // ── Gemini fallback ──
    if (!base64 && engine !== "fal" && engine !== "fal.ai") {
      console.warn("[Cascade] Falling back to Gemini Flash Preview...");
      base64 = await callGemini("gemini-2.5-flash-preview-image-generation", prompt, apiKey);
      engineUsed = "gemini";
    }

    // ── Last resort ──
    if (!base64 && engine !== "fal" && engine !== "fal.ai") {
      console.warn("[Cascade] Falling back to Gemini 2.0 Flash Exp...");
      base64 = await callGemini("gemini-2.0-flash-exp-image-generation", prompt, apiKey);
      engineUsed = "nano";
    }

    if (!base64) throw new Error("All engines failed");

    console.log(`[DEBUG] base64 recebido: ${base64.substring(0, 50)}...`);

    // ── Upload original (raw) image ──
    const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const baseName = photo_id ?? Date.now();
    const rawPath = `${effectiveLaunchId ?? "unknown"}/${baseName}_raw.png`;

    const { error: uploadError } = await supabase.storage.from(bucket).upload(rawPath, binary, { contentType: "image/png", upsert: true });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data: { publicUrl: rawUrl } } = supabase.storage.from(bucket).getPublicUrl(rawPath);
    console.log(`[DEBUG] Raw upload done: ${rawUrl}`);

    // ── Upscale 2x via fal-ai/clarity-upscaler ──
    let hdUrl = rawUrl;
    let upscaled = false;
    const falKey = Deno.env.get("FAL_API_KEY");

    if (falKey) {
      try {
        console.log(`[Upscale] Starting clarity-upscaler for ${rawUrl}`);
        const upscaleRes = await fetch("https://queue.fal.run/fal-ai/clarity-upscaler", {
          method: "POST",
          headers: {
            "Authorization": `Key ${falKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input: {
              image_url: rawUrl,
              scale: 2,
              output_format: "png",
            },
          }),
        });

        if (!upscaleRes.ok) {
          console.warn(`[Upscale] Submit failed ${upscaleRes.status}: ${await upscaleRes.text()}`);
        } else {
          const upscaleData = await upscaleRes.json();

          // Check for sync result
          let upscaledImageUrl = upscaleData?.image?.url || upscaleData?.images?.[0]?.url;

          // If async, poll
          if (!upscaledImageUrl && upscaleData?.request_id) {
            const reqId = upscaleData.request_id;
            console.log(`[Upscale] Polling request_id: ${reqId}`);
            for (let i = 0; i < 60; i++) {
              await new Promise((r) => setTimeout(r, 2000));
              const sRes = await fetch(`https://queue.fal.run/fal-ai/clarity-upscaler/requests/${reqId}/status`, {
                headers: { "Authorization": `Key ${falKey}` },
              });
              if (!sRes.ok) continue;
              const sData = await sRes.json();
              if (sData.status === "COMPLETED") {
                const rRes = await fetch(`https://queue.fal.run/fal-ai/clarity-upscaler/requests/${reqId}`, {
                  headers: { "Authorization": `Key ${falKey}` },
                });
                if (rRes.ok) {
                  const rData = await rRes.json();
                  upscaledImageUrl = rData?.image?.url || rData?.images?.[0]?.url;
                }
                break;
              }
              if (sData.status === "FAILED") {
                console.warn(`[Upscale] Job failed: ${JSON.stringify(sData)}`);
                break;
              }
            }
          }

          if (upscaledImageUrl) {
            // Download HD image and upload to storage
            const hdRes = await fetch(upscaledImageUrl);
            if (hdRes.ok) {
              const hdBuf = new Uint8Array(await hdRes.arrayBuffer());
              const hdPath = `${effectiveLaunchId ?? "unknown"}/${baseName}.png`;
              const { error: hdUpErr } = await supabase.storage.from(bucket).upload(hdPath, hdBuf, { contentType: "image/png", upsert: true });
              if (!hdUpErr) {
                const { data: { publicUrl: hdPublicUrl } } = supabase.storage.from(bucket).getPublicUrl(hdPath);
                hdUrl = hdPublicUrl;
                upscaled = true;
                console.log(`[Upscale] HD uploaded: ${hdUrl}`);
              } else {
                console.warn(`[Upscale] HD upload failed: ${hdUpErr.message}`);
              }
            }
          }
        }
      } catch (upErr) {
        console.warn(`[Upscale] Error (non-fatal): ${upErr}`);
      }
    } else {
      console.warn("[Upscale] FAL_API_KEY not set, skipping upscale");
    }

    // ── Update DB ──
    const previewUrl = rawUrl;
    const originalUrl = hdUrl;

    if (photo_id) {
      const { error: dbError } = await supabase
        .from("generated_images")
        .update({
          image_url: originalUrl,
          original_url: originalUrl,
          preview_url: previewUrl,
          raw_url: rawUrl,
          model_used: engineUsed,
          status: "done",
          prompt_used: prompt,
          upscaled,
        })
        .eq("id", photo_id);
      console.log(`[DEBUG] DB update for photo_id ${photo_id}: ${dbError ? dbError.message : "OK"}`);
    }

    console.log(`[Done] engine=${engineUsed} upscaled=${upscaled} hdUrl=${hdUrl}`);

    return new Response(JSON.stringify({
      url: originalUrl,
      imageUrl: originalUrl,
      originalUrl,
      previewUrl,
      rawUrl,
      modelUsed: engineUsed,
      engine_used: engineUsed,
      promptUsed: prompt,
      upscaled,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[generate-image] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
