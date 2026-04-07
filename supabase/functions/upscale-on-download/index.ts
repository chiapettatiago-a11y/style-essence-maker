import { corsHeaders } from "@supabase/supabase-js/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { imageUrl, scale = 2 } = await req.json();

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "imageUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const FAL_API_KEY = Deno.env.get("FAL_API_KEY");
    if (!FAL_API_KEY) {
      return new Response(JSON.stringify({ error: "FAL_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[upscale-on-download] Starting upscale at ${scale}x for: ${imageUrl.substring(0, 80)}...`);

    // Submit upscale job to fal.ai
    const submitResponse = await fetch("https://queue.fal.run/fal-ai/clarity-upscaler", {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_url: imageUrl,
        scale: scale,
        prompt: "masterpiece, best quality, highres, preserve natural skin pores and texture details, do not smooth skin",
        negative_prompt: "blurry, low quality, plastic skin, airbrushed, oversmoothed",
        creativity: 0.15,
        resemblance: 0.95,
        num_inference_steps: 18,
        guidance_scale: 4,
      }),
    });

    if (!submitResponse.ok) {
      const errText = await submitResponse.text();
      console.error("[upscale-on-download] Submit failed:", errText);
      return new Response(JSON.stringify({ error: `Upscale failed: ${submitResponse.status}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const submitData = await submitResponse.json();
    const requestId = submitData.request_id;

    if (!requestId) {
      // Synchronous response — result is already here
      const resultUrl = submitData?.images?.[0]?.url || submitData?.image?.url;
      if (resultUrl) {
        return new Response(JSON.stringify({ upscaledUrl: resultUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "No result from upscaler" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Poll for result
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      const statusResponse = await fetch(`https://queue.fal.run/fal-ai/clarity-upscaler/requests/${requestId}/status`, {
        headers: { Authorization: `Key ${FAL_API_KEY}` },
      });

      if (!statusResponse.ok) continue;

      const statusData = await statusResponse.json();

      if (statusData.status === "COMPLETED") {
        const resultResponse = await fetch(`https://queue.fal.run/fal-ai/clarity-upscaler/requests/${requestId}`, {
          headers: { Authorization: `Key ${FAL_API_KEY}` },
        });

        if (!resultResponse.ok) {
          return new Response(JSON.stringify({ error: "Failed to fetch upscale result" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const resultData = await resultResponse.json();
        const resultUrl = resultData?.images?.[0]?.url || resultData?.image?.url;

        if (resultUrl) {
          console.log(`[upscale-on-download] Upscale complete: ${resultUrl.substring(0, 80)}...`);
          return new Response(JSON.stringify({ upscaledUrl: resultUrl }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      if (statusData.status === "FAILED") {
        return new Response(JSON.stringify({ error: "Upscale job failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Upscale timed out" }), {
      status: 504,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[upscale-on-download] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
