import { GarmentAnalysis, GenerationRequest, ModelProfile, PromptLayers } from "@/types/fashion";
import { LAYER1_BASE, LAYER1_VIDEO_BASE, STYLE_CATEGORIES } from "./prompt-layers";
import { MODEL_GALLERY } from "./model-gallery";

const FULL_BODY_ANGLE_TYPES = new Set<GenerationRequest["type"]>([
  "lookbook-front",
  "lookbook-back",
  "lookbook-left",
  "lookbook-three-quarter",
  "movement-shot",
]);

const ANGLE_INSTRUCTIONS: Record<string, string> = {
  "lookbook-front": "Full body, facing camera, weight evenly distributed, arms relaxed, subtle natural posture. Full body framing, feet visible.",
  "lookbook-back": "Back to camera, slight head turn over left shoulder, natural posture. Full body framing, feet visible.",
  "lookbook-left": "Left profile, mid-stride feel, natural arm swing, candid editorial energy. Full body framing, feet visible.",
  "lookbook-three-quarter": "Right profile, weight on back foot, slight hip shift, arm softly bent. Full body framing, feet visible.",
  "close-tr-detail": "Half-body crop centered on the TR badge area of the garment. The TR badge must be clearly visible. Natural relaxed pose. NOT a macro close-up — maintain editorial distance showing garment context around the badge.",
  "movement-shot": "Full body, loose editorial walking pose — mid-stride, natural arm swing, slight body rotation, relaxed energy. Candid fashion week backstage feel. Full body framing, feet visible.",
};

/** PT-BR labels for angle types (user-facing) */
const ANGLE_LABELS_PT: Record<string, string> = {
  "lookbook-front": "Vista frontal — modelo de frente para a câmera, corpo inteiro, postura natural.",
  "lookbook-back": "Vista traseira — modelo de costas, corpo inteiro, leve giro da cabeça à esquerda.",
  "lookbook-left": "Perfil lateral esquerdo — corpo inteiro, energia editorial, passo natural.",
  "lookbook-three-quarter": "Perfil lateral direito — corpo inteiro, peso na perna de trás, quadril leve.",
  "close-tr-detail": "Close detalhe TR — meio-corpo focando na área do badge TR com contexto da peça.",
  "movement-shot": "Movimento editorial — corpo inteiro, pose de caminhada solta, energia backstage.",
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

const MIDI_DRESS_CRITICAL_BLOCK = `SKIRT LENGTH CRITICAL: maxi length, falls to ankle/floor level. The skirt hem must reach the ankle. NOT knee length. NOT midi. MAXI — ankle to floor.

DRESS LENGTH — CRITICAL:
Hem falls at mid-calf, 15cm below the knee.
Full midi silhouette visible in frame.
NOT mini. NOT knee-length. NOT above knee.
The full skirt must be visible — do NOT crop the hem.`;

function isDressLikeGarment(garment: GarmentAnalysis | null): boolean {
  const text = [garment?.type, garment?.fullDescription, garment?.style].filter(Boolean).join(" ").toLowerCase();
  return /(dress|vestido|gown|two-piece|two piece|conjunto|saia|skirt)/.test(text);
}

function buildFaceAnchorPrompt(input: {
  identity: string;
  skinTone?: string;
  hairType?: string;
  hairColor?: string;
}) {
  return [
    "FACE ANCHOR — CRITICAL:",
    `Identity anchor: ${input.identity}`,
    "Use the exact same woman across all images.",
    "Maintain identical facial structure, eye spacing, nose, lips, jawline and overall bone structure in every angle.",
    input.skinTone ? `Skin tone: ${input.skinTone} — keep unchanged.` : "",
    input.hairType ? `Hair texture/style: ${input.hairType} — keep unchanged.` : "",
    input.hairColor ? `Hair color: ${input.hairColor} — EXACT same shade in every image.` : "",
    "Do NOT drift identity between shots.",
  ].filter(Boolean).join("\n");
}

export function assembleLayer2(selectedPresets: Record<string, string>): string {
  const blocks: string[] = [];
  for (const [categoryId, presetId] of Object.entries(selectedPresets)) {
    const category = STYLE_CATEGORIES.find(c => c.id === categoryId);
    if (!category) continue;
    const preset = category.presets.find(p => p.id === presetId);
    if (preset) blocks.push(preset.promptBlock);
  }
  return blocks.join("\n\n");
}

/** Assemble PT-BR preview of layer2 for user display */
export function assembleLayer2PT(selectedPresets: Record<string, string>): string {
  const blocks: string[] = [];
  for (const [categoryId, presetId] of Object.entries(selectedPresets)) {
    const category = STYLE_CATEGORIES.find(c => c.id === categoryId);
    if (!category) continue;
    const preset = category.presets.find(p => p.id === presetId);
    if (preset) blocks.push(`[${category.label}] ${preset.name}: ${preset.description}`);
  }
  return blocks.join("\n");
}

export function buildFullPrompt(
  layers: PromptLayers,
  garment: GarmentAnalysis | null,
  angleType: GenerationRequest["type"],
  modelProfile?: ModelProfile | null
): string {
  const isVideo = angleType === "video-product" || angleType === "video-model";
  const isFullBody = FULL_BODY_ANGLE_TYPES.has(angleType);
  const isCloseDetail = angleType === "close-tr-detail";
  const base = isVideo ? LAYER1_VIDEO_BASE : LAYER1_BASE;

  const parts: string[] = [base];

  // For close-tr-detail, use a simplified garment block
  if (isCloseDetail && garment) {
    const trLocation = garment.trBadgeLocation || garment.signatureDetails || "unknown position";
    const closeGarmentBlock = [
      `GARMENT CONTEXT:`,
      `Type: ${garment.type}`,
      `Color: ${garment.color}`,
      `TR signature: ${garment.trBadgeDescription || "small round gold-tone metallic button with TR monogram"} positioned at ${trLocation}.`,
      ``,
      `ANGLE: Half-body crop centered on the ${trLocation} area of the garment. The TR badge must be clearly visible. Natural relaxed pose. NOT a macro close-up — maintain editorial distance showing garment context around the badge.`,
    ].join("\n");
    parts.push(closeGarmentBlock);
  } else if (garment) {
    const garmentBlock = [
      `GARMENT — ABSOLUTE FIDELITY REQUIRED. Do not redesign, simplify or alter any detail.`,
      `Fabric: ${garment.fabric}. Texture: ${garment.fabricTexture || "N/A"}.`,
      `Color: ${garment.color} (${garment.colorHexEstimate || "N/A"}) — fully monochromatic, no color variation.`,
      `Silhouette: ${garment.silhouette || "N/A"}.`,
      `Length: ${garment.length || "N/A"} — hem reaches ${garment.lengthDescription || "as detected"}.`,
      `Neckline: ${garment.neckline || "N/A"}`,
      `Sleeves: ${garment.sleeves || "N/A"}. Cuff detail: ${garment.sleeveDetail || garment.sleeveLength || "N/A"}`,
      `Hem/Skirt: ${garment.hemDetail || garment.hemline || "N/A"}`,
      `Construction details: ${garment.details || "N/A"}`,
      garment.trBadgeLocation && garment.trBadgeDescription
        ? `TR signature: ${garment.trBadgeDescription} positioned at ${garment.trBadgeLocation}.`
        : garment.signatureDetails
          ? `TR signature: ${garment.signatureDetails}`
          : `TR signature: not clearly visible in reference.`,
      `Internal label "THAIS RODRIGUES" stitched below neckline.`,
    ].filter(Boolean).join("\n");
    parts.push(garmentBlock);
  }

  const angleInstruction = ANGLE_INSTRUCTIONS[angleType];
  if (angleInstruction && !isCloseDetail) {
    parts.push(angleInstruction);
  }

  if (isFullBody) {
    parts.push(FULL_BODY_CRITICAL_BLOCK);
    if (isDressLikeGarment(garment)) {
      // Use detected length, never override with fixed "midi"
      const detectedLength = garment?.length || "";
      const lengthDesc = garment?.lengthDescription || "";
      parts.push(`SKIRT LENGTH CRITICAL: ${detectedLength} length. ${lengthDesc}.\nThe full skirt must be visible — do NOT crop the hem.`);
    }
  }

  if (modelProfile && angleType !== "video-product") {
    const galleryModel = MODEL_GALLERY.find(m => m.id === modelProfile.id);
    if (galleryModel) {
      parts.push(galleryModel.promptBlockEN);
      parts.push(buildFaceAnchorPrompt({
        identity: galleryModel.name,
        skinTone: galleryModel.skinTone,
        hairType: galleryModel.hairType,
        hairColor: galleryModel.hairColor,
      }));
    } else {
      const modelBlock = [
        `MODEL IDENTITY LOCK (same person in ALL images):`,
        modelProfile.skinTone ? `Skin tone: ${modelProfile.skinTone}` : "",
        modelProfile.hairType ? `Hair style/texture: ${modelProfile.hairType} — DO NOT CHANGE between shots` : "",
        modelProfile.hairColor ? `Hair color: ${modelProfile.hairColor} — EXACT same color in every image` : "",
        modelProfile.height ? `Height: ${modelProfile.height}m` : "",
        `This model must appear IDENTICAL across all angles — same face, same hair, same skin, same body.`,
      ].filter(Boolean).join("\n");
      parts.push(modelBlock);
      parts.push(buildFaceAnchorPrompt({
        identity: modelProfile.promptSeed || modelProfile.name,
        skinTone: modelProfile.skinTone,
        hairType: modelProfile.hairType,
        hairColor: modelProfile.hairColor,
      }));
    }
  }

  if (layers.layer2.trim()) {
    parts.push(layers.layer2);
  }

  if (layers.layer3.trim()) {
    parts.push(layers.layer3);
  }

  return parts.join("\n\n");
}

/** Build a PT-BR preview of the prompt for user display */
export function buildPromptPreviewPT(
  garment: GarmentAnalysis | null,
  angleType: GenerationRequest["type"],
  modelProfile?: ModelProfile | null,
  selectedPresets?: Record<string, string>,
  manualPrompt?: string,
): string {
  const parts: string[] = [];

  parts.push("🔒 Base técnica (resolução 1080x1920, fidelidade absoluta da peça)");

  if (garment) {
    parts.push(`👗 Peça: ${garment.type} | ${garment.color} | ${garment.fabric} | ${garment.silhouette || ""}`);
  }

  const anglePT = ANGLE_LABELS_PT[angleType];
  if (anglePT) {
    parts.push(`📐 ${anglePT}`);
  }

  if (FULL_BODY_ANGLE_TYPES.has(angleType)) {
    parts.push("🖼️ Enquadramento/Fundo: corpo inteiro com respiro, pés visíveis, fundo infinito branco puro #FFFFFF.");
    if (isDressLikeGarment(garment)) {
      parts.push("📏 Comprimento: midi obrigatório, barra 15cm abaixo do joelho.");
    }
  }

  if (modelProfile) {
    const galleryModel = MODEL_GALLERY.find(m => m.id === modelProfile.id);
    parts.push(`👤 Modelo: ${galleryModel?.name || modelProfile.name} | ${modelProfile.skinTone} | ${modelProfile.hairType} ${modelProfile.hairColor}`);
    parts.push("🧷 Face anchor: mesma identidade facial em todos os ângulos.");
  }

  if (selectedPresets && Object.keys(selectedPresets).length > 0) {
    parts.push(`🎨 Estilos: ${assembleLayer2PT(selectedPresets)}`);
  }

  if (manualPrompt?.trim()) {
    parts.push(`✏️ Ajuste manual: ${manualPrompt}`);
  }

  return parts.join("\n\n");
}

export function generateAllRequests(
  layers: PromptLayers,
  garment: GarmentAnalysis | null,
  modelProfile?: ModelProfile | null
): GenerationRequest[] {
  const types: { type: GenerationRequest["type"]; label: string }[] = [
    { type: "lookbook-front", label: "Lookbook — Frente" },
    { type: "lookbook-back", label: "Lookbook — Costas" },
    { type: "lookbook-left", label: "Lookbook — Lateral Esquerda" },
    { type: "lookbook-three-quarter", label: "Lookbook — Lateral Direita" },
    { type: "close-tr-detail", label: "Close — Detalhe TR" },
    { type: "movement-shot", label: "Movimento Editorial" },
    { type: "video-product", label: "Vídeo 360° Produto (prompt)" },
    { type: "video-model", label: "Vídeo 360° com Modelo (prompt)" },
  ];

  return types.map(t => ({
    type: t.type,
    label: t.label,
    prompt: buildFullPrompt(layers, garment, t.type, modelProfile),
  }));
}
