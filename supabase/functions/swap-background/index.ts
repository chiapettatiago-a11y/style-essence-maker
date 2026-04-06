import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STORAGE_BUCKET = "generated-assets";

function buildPublicObjectUrl(supabaseUrl: string, bucket: string, path: string) {
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

async function fetchImageAsBase64(url: string): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.status}`);
  const buf = await resp.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { photo_id, launch_id, source_image_url, scene_prompt } = await req.json();

    if (!photo_id || !source_image_url || !scene_prompt) {
      return new Response(JSON.stringify({ error: "Missing required fields: photo_id, source_image_url, scene_prompt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (!GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase credentials");

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Fetch source image as base64
    console.log(`[swap-background] Fetching source image: ${source_image_url.substring(0, 80)}...`);
    const imageBase64 = await fetchImageAsBase64(source_image_url);

    const editPrompt = `${scene_prompt}. Keep the model, garment, pose and lighting identical. Replace only the background.`;

    console.log(`[swap-background] Calling Imagen 4 Edit API...`);
    const editResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-4-generate:edit?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{
            prompt: editPrompt,
            image: { bytesBase64Encoded: imageBase64 },
            editConfig: { editMode: "product-image" },
            safetyFilterLevel: "block_few",
            personGeneration: "allow_adult",
          }],
          parameters: { sampleCount: 1 },
        }),
      }
    );

    if (!editResponse.ok) {
      const errText = await editResponse.text();
      throw new Error(`Imagen 4 Edit failed [${editResponse.status}]: ${errText}`);
    }

    const editData = await editResponse.json();
    const base64Result = editData?.predictions?.[0]?.bytesBase64Encoded;
    if (!base64Result) {
      throw new Error("No image in Imagen 4 Edit response");
    }

    // Upload to storage
    const bytes = Uint8Array.from(atob(base64Result), (c) => c.charCodeAt(0));
    const objectPath = `${launch_id || "standalone"}/bg-swap-${photo_id}.jpg`;

    const { error: uploadError } = await admin.storage.from(STORAGE_BUCKET).upload(objectPath, bytes, {
      contentType: "image/jpeg",
      cacheControl: "3600",
      upsert: true,
    });

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    const bgSwapUrl = buildPublicObjectUrl(supabaseUrl, STORAGE_BUCKET, objectPath);

    // Update generated_images record
    const { error: updateError } = await admin.from("generated_images").update({
      bg_swap_url: bgSwapUrl,
      bg_swap_at: new Date().toISOString(),
      bg_swap_prompt: scene_prompt,
    }).eq("id", photo_id);

    if (updateError) {
      console.error(`[swap-background] DB update error:`, updateError.message);
    }

    console.log(`[swap-background] Success: ${bgSwapUrl.substring(0, 80)}...`);

    return new Response(JSON.stringify({
      bg_swap_url: bgSwapUrl,
      bg_swap_prompt: scene_prompt,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[swap-background] ERROR:`, msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
