import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VEO_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, sourceImageUrl, videoType, durationSeconds } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (!GOOGLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const duration = durationSeconds === 15 ? "15s" : "8s";
    const startMs = performance.now();

    // Build the generate request body for Veo
    const generateBody: any = {
      model: "models/veo-3",
      generateVideoConfig: {
        personGeneration: "allow_all",
      },
    };

    // If source image, use image-to-video; otherwise text-to-video
    if (sourceImageUrl) {
      // For image-to-video, fetch the image and send as inline data
      let imageBase64 = "";
      let mimeType = "image/png";

      if (sourceImageUrl.startsWith("data:")) {
        const match = sourceImageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          mimeType = match[1];
          imageBase64 = match[2];
        }
      } else {
        const imgResp = await fetch(sourceImageUrl);
        if (!imgResp.ok) throw new Error("Failed to fetch source image");
        const imgBuffer = await imgResp.arrayBuffer();
        imageBase64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));
        mimeType = imgResp.headers.get("content-type") || "image/png";
      }

      generateBody.contents = [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ];
    } else {
      generateBody.contents = [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ];
    }

    console.log(`[generate-video] Starting Veo 3 generation. Type: ${videoType}, Duration: ${duration}`);

    // Step 1: Initiate the video generation (long-running operation)
    const generateResp = await fetch(
      `${VEO_API_BASE}/models/veo-3:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(generateBody),
      }
    );

    if (!generateResp.ok) {
      const errText = await generateResp.text();
      console.error(`[generate-video] Veo API error [${generateResp.status}]:`, errText);

      if (generateResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições do Veo atingido. Tente novamente em instantes.", code: "rate_limited" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (generateResp.status === 403) {
        return new Response(
          JSON.stringify({ error: "Acesso negado ao Veo 3. Verifique se a API está ativada no Google Cloud.", code: "forbidden" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Veo API error [${generateResp.status}]: ${errText}`);
    }

    const generateData = await generateResp.json();

    // Check if it's a long-running operation (LRO)
    if (generateData.name) {
      // Poll the operation until complete
      const operationName = generateData.name;
      console.log(`[generate-video] LRO started: ${operationName}`);

      let videoUrl = "";
      const maxPolls = 120; // 10 minutes max (5s intervals)

      for (let i = 0; i < maxPolls; i++) {
        await new Promise((r) => setTimeout(r, 5000));

        const pollResp = await fetch(
          `${VEO_API_BASE}/${operationName}?key=${GOOGLE_API_KEY}`
        );

        if (!pollResp.ok) {
          const pollErr = await pollResp.text();
          console.error(`[generate-video] Poll error:`, pollErr);
          continue;
        }

        const pollData = await pollResp.json();

        if (pollData.done) {
          if (pollData.error) {
            throw new Error(`Veo generation failed: ${JSON.stringify(pollData.error)}`);
          }

          // Extract video from response
          const result = pollData.response || pollData.result;
          if (result?.candidates?.[0]?.content?.parts) {
            for (const part of result.candidates[0].content.parts) {
              if (part.fileData?.fileUri) {
                videoUrl = part.fileData.fileUri;
                break;
              }
              if (part.inlineData?.data) {
                videoUrl = `data:${part.inlineData.mimeType || "video/mp4"};base64,${part.inlineData.data}`;
                break;
              }
            }
          }

          if (result?.generatedVideos?.[0]?.video?.uri) {
            videoUrl = result.generatedVideos[0].video.uri;
          }

          break;
        }

        console.log(`[generate-video] Poll ${i + 1}/${maxPolls}: still processing...`);
      }

      if (!videoUrl) {
        throw new Error("Veo geração expirou ou não retornou vídeo.");
      }

      const generationMs = Math.round(performance.now() - startMs);

      return new Response(
        JSON.stringify({
          videoUrl,
          videoType: videoType || "video-model",
          modelUsed: "veo-3",
          generationMs,
          durationSeconds: durationSeconds || 8,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Direct response (unlikely for video but handle it)
    const candidates = generateData.candidates || [];
    let videoUrl = "";
    for (const cand of candidates) {
      for (const part of (cand.content?.parts || [])) {
        if (part.fileData?.fileUri) {
          videoUrl = part.fileData.fileUri;
          break;
        }
      }
      if (videoUrl) break;
    }

    if (!videoUrl) {
      throw new Error("Nenhum vídeo gerado na resposta do Veo.");
    }

    const generationMs = Math.round(performance.now() - startMs);

    return new Response(
      JSON.stringify({
        videoUrl,
        videoType: videoType || "video-model",
        modelUsed: "veo-3",
        generationMs,
        durationSeconds: durationSeconds || 8,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-video error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido na geração de vídeo" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
