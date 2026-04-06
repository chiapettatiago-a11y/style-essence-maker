import { AccessorySelection, GarmentAnalysis, GenerationRequest, ModelProfile, PromptLayers } from "@/types/fashion";
import { SHOE_PROMPT_MAP, COLOR_PROMPT_MAP } from "@/components/studio/AccessoriesSelector";
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

/** Map detected garment length to EN description */
function lengthDescriptionEN(length: string | undefined, desc: string | undefined): string {
  if (desc) return desc;
  const l = (length || "").toLowerCase();
  if (l.includes("maxi")) return "ankle/floor level";
  if (l.includes("midi")) return "mid-calf, 10-15cm below the knee";
  if (l.includes("short") || l.includes("mini")) return "above the knee";
  if (l.includes("cropped")) return "cropped above waist";
  return "as detected";
}

/** Map detected garment length to PT description */
function lengthDescriptionPT(length: string | undefined, desc: string | undefined): string {
  const l = (length || "").toLowerCase();
  if (l.includes("maxi")) return "maxi — barra chega ao tornozelo/chão";
  if (l.includes("midi")) return "midi — barra 10-15cm abaixo do joelho";
  if (l.includes("short") || l.includes("mini")) return "curto — barra acima do joelho";
  if (l.includes("cropped")) return "cropped — acima da cintura";
  if (desc) return desc;
  return length || "conforme detectado";
}

/** Extract scenario background instructions from selectedPresets */
function getScenarioBackground(selectedPresets: Record<string, string>): { en: string; pt: string } {
  const scenarioId = selectedPresets["scenario"];
  switch (scenarioId) {
    case "estudio-neutro-bege":
      return {
        en: "Background: seamless infinite beige backdrop #C8A882, NO exceptions.\nSoft even studio light, same temperature in all photos.",
        pt: "🖼️ Enquadramento/Fundo: corpo inteiro com respiro, pés visíveis, fundo infinito bege #C8A882.",
      };
    case "estudio-branco":
      return {
        en: "Background: pure seamless white backdrop #F8F8F6, NO exceptions.\nHigh-key lighting, clean commercial backdrop.\nNOT beige. NOT cream. NOT warm gray.\nSoft even studio light, same temperature in all photos.",
        pt: "🖼️ Enquadramento/Fundo: corpo inteiro com respiro, pés visíveis, fundo infinito branco puro #F8F8F6.",
      };
    case "urbano-contemporaneo":
      return {
        en: "Background: contemporary urban exterior setting with modern architecture — clean concrete walls, glass surfaces, muted city tones.\nShallow depth of field keeping focus on the garment.\nConsistent lighting across all photos.",
        pt: "🖼️ Enquadramento/Fundo: corpo inteiro com respiro, pés visíveis, cenário urbano contemporâneo exterior.",
      };
    case "natureza-suave":
      return {
        en: "Background: soft natural outdoor setting — lush green garden or open field, golden hour warm light, gentle bokeh.\nNatural environment that complements without competing with the garment.\nConsistent lighting across all photos.",
        pt: "🖼️ Enquadramento/Fundo: corpo inteiro com respiro, pés visíveis, exterior com luz dourada natural.",
      };
    default:
      // Fallback to white studio
      return {
        en: "Background: pure seamless white backdrop #F8F8F6, NO exceptions.\nSoft even studio light, same temperature in all photos.",
        pt: "🖼️ Enquadramento/Fundo: corpo inteiro com respiro, pés visíveis, fundo infinito branco puro #F8F8F6.",
      };
  }
}

const FULL_BODY_FRAMING_BLOCK = `FRAMING — CRITICAL:
Full body shot, head to toe with breathing room.
Model occupies 70% of frame height maximum.
Minimum 10% empty space above head.
Minimum 15% empty space below feet.
Feet fully visible, ankles visible, NO cropping of legs.
Wide enough to show both arms with space around them.
Editorial fashion campaign framing — NOT e-commerce product zoom.
NOT portrait crop. NOT tight crop. FULL BODY with air around.`;

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
  modelProfile?: ModelProfile | null,
  selectedPresets?: Record<string, string>,
  userGarmentType?: string | null,
  accessories?: AccessorySelection | null,
): string {
  const isVideo = angleType === "video-product" || angleType === "video-model";
  const isFullBody = FULL_BODY_ANGLE_TYPES.has(angleType);
  const isCloseDetail = angleType === "close-tr-detail";
  const base = isVideo ? LAYER1_VIDEO_BASE : LAYER1_BASE;
  const presets = selectedPresets || {};

  const parts: string[] = [base];

  // For close-tr-detail, use a simplified garment block with precise framing
  if (isCloseDetail && garment) {
    const trLocation = garment.trBadgeLocation || garment.signatureDetails || "unknown position";
    const trDesc = garment.trBadgeDescription || "small round gold-tone metallic button with TR monogram";

    // Determine body-zone framing based on badge position
    const locLower = trLocation.toLowerCase();
    let framingInstruction: string;
    if (/hip|waist|cintura|quadril|lateral|side seam|ilhós/i.test(locLower)) {
      framingInstruction = `Crop from mid-torso to upper thigh, centering the frame on the ${trLocation} area. The camera must point at hip/waist level, NOT at the bust or face.`;
    } else if (/hem|barra|skirt|saia|lower/i.test(locLower)) {
      framingInstruction = `Crop from waist to below the knee, centering the frame on the ${trLocation} area. The camera must point at the lower garment, NOT at the bust.`;
    } else if (/back|costas|traseira/i.test(locLower)) {
      framingInstruction = `Model turned showing back. Crop centered on the ${trLocation} area. The TR badge must be the focal point.`;
    } else {
      // Default: chest/collar area
      framingInstruction = `Half-body crop centered on the ${trLocation} area of the garment.`;
    }

    const closeGarmentBlock = [
      `GARMENT CONTEXT:`,
      `Type: ${garment.type}`,
      `Color: ${garment.color}`,
      `TR signature: ${trDesc} positioned at ${trLocation}.`,
      ``,
      `ANGLE — CRITICAL FRAMING:`,
      framingInstruction,
      `The TR badge (${trDesc}) MUST be clearly visible and in sharp focus at the center of the frame.`,
      `Natural relaxed pose. NOT a macro close-up — maintain editorial distance showing garment context around the badge.`,
      `Do NOT default to a bust/face portrait. The camera must aim at the EXACT body zone where the badge sits.`,
    ].join("\n");
    parts.push(closeGarmentBlock);
  } else if (garment) {
    // Two-piece detection: user-declared garment type takes precedence over AI analysis
    const isTwoPiece = userGarmentType === "conjunto" || /two-piece|two piece|conjunto/i.test(garment.type || "");
    const lengthDesc = lengthDescriptionEN(garment.length, garment.lengthDescription);
    const garmentBlock = [
      `GARMENT — ABSOLUTE FIDELITY REQUIRED. Do not redesign, simplify or alter any detail.`,
      isTwoPiece
        ? `Type: TWO-PIECE SET (separate top + separate bottom). This is NOT a dress. These are TWO DISTINCT GARMENTS worn together.`
        : `Type: ${garment.type}.`,
      `Fabric: ${garment.fabric}. Texture: ${garment.fabricTexture || "N/A"}.`,
      `Color: ${garment.color} (${garment.colorHexEstimate || "N/A"}) — fully monochromatic, no color variation.`,
      `Silhouette: ${garment.silhouette || "N/A"}.`,
      `Length: ${garment.length || "N/A"} — hem reaches ${lengthDesc}.`,
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

    // Two-piece set: add explicit separation enforcement
    if (isTwoPiece) {
      parts.push(`TWO-PIECE SEPARATION — CRITICAL RULE:
This outfit consists of TWO SEPARATE GARMENTS: a cropped top/blouse AND a separate skirt/pants.
There MUST be a visible gap or waist seam between the top and the bottom piece.
Do NOT merge, fuse, or blend them into a single dress or jumpsuit.
The top ends at the waist. The bottom starts at the waist. They are SEPARATE pieces.
If you generate a single continuous garment, the image is REJECTED.
Maintain the exact proportions of each piece: the top's cropped length, the bottom's full length.
Ruffle/detail volume must match the reference EXACTLY — do not exaggerate or reduce.`);
    }
  }

  const angleInstruction = ANGLE_INSTRUCTIONS[angleType];
  if (angleInstruction && !isCloseDetail) {
    parts.push(angleInstruction);
  }

  if (isFullBody) {
    parts.push(FULL_BODY_FRAMING_BLOCK);

    // Dynamic background from scenario selection
    const scenarioBg = getScenarioBackground(presets);
    parts.push(`SCENE ANCHOR — ABSOLUTE RULE — apply to 100% of photos in this set:\n${scenarioBg.en}`);

    if (isDressLikeGarment(garment)) {
      const detectedLength = garment?.length || "";
      const lengthDesc = lengthDescriptionEN(detectedLength, garment?.lengthDescription);
      parts.push(`SKIRT LENGTH CRITICAL: ${detectedLength} length, hem reaches ${lengthDesc}.\nThe full skirt must be visible — do NOT crop the hem.`);
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

  // Accessories (shoes)
  if (accessories?.shoeType && FULL_BODY_ANGLE_TYPES.has(angleType)) {
    const shoeEN = SHOE_PROMPT_MAP[accessories.shoeType] || accessories.shoeType;
    const colorEN = accessories.shoeColor ? COLOR_PROMPT_MAP[accessories.shoeColor] || accessories.shoeColor : "";
    parts.push(`FOOTWEAR — REQUIRED:\nModel is wearing ${colorEN ? colorEN + " " : ""}${shoeEN}.\nShoes must be fully visible in every full-body shot.`);
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
  const presets = selectedPresets || {};

  parts.push("🔒 Base técnica (maximum native resolution, minimum 1365x2048, target 1536x2048+, portrait 9:16, fidelidade absoluta da peça)");

  if (garment) {
    const isTwoPiece = /two-piece|two piece|conjunto/i.test(garment.type || "");
    const lengthPT = lengthDescriptionPT(garment.length, garment.lengthDescription);
    const typeLabel = isTwoPiece
      ? "CONJUNTO DE DUAS PEÇAS (top + bottom separados) — NÃO é vestido"
      : garment.type;
    parts.push([
      `👗 Peça — fidelidade absoluta obrigatória. Não redesenhar, simplificar ou alterar nenhum detalhe.`,
      `Tipo: ${typeLabel}`,
      `Tecido: ${garment.fabric}. Textura: ${garment.fabricTexture || "N/A"}`,
      `Cor: ${garment.color} (${garment.colorHexEstimate || "N/A"}) — monocromático, sem variação de cor`,
      `Silhueta: ${garment.silhouette || "N/A"}`,
      `Comprimento: ${lengthPT}`,
      `Decote/Gola: ${garment.neckline || "N/A"}`,
      `Mangas: ${garment.sleeves || "N/A"}. Detalhe do punho: ${garment.sleeveDetail || garment.sleeveLength || "N/A"}`,
      `Barra/Saia: ${garment.hemDetail || garment.hemline || "N/A"}`,
      `Detalhes: ${garment.details || "N/A"}`,
      garment.trBadgeLocation && garment.trBadgeDescription
        ? `Chapinha TR: ${garment.trBadgeDescription} posicionada em ${garment.trBadgeLocation}`
        : garment.signatureDetails
          ? `Chapinha TR: ${garment.signatureDetails}`
          : `Chapinha TR: não visível claramente na referência`,
      `Etiqueta interna "THAIS RODRIGUES" costurada abaixo do decote.`,
    ].join("\n"));
  }

  const anglePT = ANGLE_LABELS_PT[angleType];
  if (anglePT) {
    parts.push(`📐 ${anglePT}`);
  }

  if (FULL_BODY_ANGLE_TYPES.has(angleType)) {
    const scenarioBg = getScenarioBackground(presets);
    parts.push(scenarioBg.pt);
    if (isDressLikeGarment(garment)) {
      const lengthPT = lengthDescriptionPT(garment?.length, garment?.lengthDescription);
      parts.push(`📏 Comprimento: ${lengthPT}. Barra completa visível.`);
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
  modelProfile?: ModelProfile | null,
  selectedPresets?: Record<string, string>,
  userGarmentType?: string | null,
  accessories?: AccessorySelection | null,
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
    prompt: buildFullPrompt(layers, garment, t.type, modelProfile, selectedPresets, userGarmentType, accessories),
  }));
}
