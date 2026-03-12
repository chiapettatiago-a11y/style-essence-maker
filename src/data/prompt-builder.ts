import { GarmentAnalysis, GenerationRequest, ModelProfile, PromptLayers } from "@/types/fashion";
import { LAYER1_BASE, LAYER1_VIDEO_BASE, STYLE_CATEGORIES } from "./prompt-layers";
import { GalleryModel, MODEL_GALLERY } from "./model-gallery";

const ANGLE_INSTRUCTIONS: Record<string, string> = {
  'lookbook-front': 'Front view — model facing directly toward camera, garment fully visible from the front.',
  'lookbook-back': 'Back view — model turned fully away from camera, showing garment back construction, closures, and rear design details.',
  'lookbook-left': 'Left side profile view — model turned 90° showing garment silhouette and side construction.',
  'lookbook-three-quarter': 'Three-quarter view (¾ angle) — model positioned at 45° to camera showing depth and drape of the garment.',
  'close-up': 'Tight close-up detail shot — focusing on the most distinctive design element: lace pattern, stitching, texture, belt, collar or trim. Extreme textile detail, macro-level fabric clarity.',
};

/** PT-BR labels for angle types (user-facing) */
const ANGLE_LABELS_PT: Record<string, string> = {
  'lookbook-front': 'Vista frontal — modelo de frente para a câmera, peça totalmente visível.',
  'lookbook-back': 'Vista traseira — modelo de costas, mostrando construção traseira e fechamentos.',
  'lookbook-left': 'Perfil lateral esquerdo — modelo girada 90° mostrando silhueta e construção lateral.',
  'lookbook-three-quarter': 'Vista ¾ — modelo posicionada a 45° da câmera mostrando profundidade e caimento.',
  'close-up': 'Close-up de detalhe — foco no elemento de design mais marcante: renda, costura, textura, cinto ou acabamento.',
};

export function assembleLayer2(selectedPresets: Record<string, string>): string {
  const blocks: string[] = [];
  for (const [categoryId, presetId] of Object.entries(selectedPresets)) {
    const category = STYLE_CATEGORIES.find(c => c.id === categoryId);
    if (!category) continue;
    const preset = category.presets.find(p => p.id === presetId);
    if (preset) blocks.push(preset.promptBlock);
  }
  return blocks.join('\n\n');
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
  return blocks.join('\n');
}

export function buildFullPrompt(
  layers: PromptLayers,
  garment: GarmentAnalysis | null,
  angleType: GenerationRequest['type'],
  modelProfile?: ModelProfile | null
): string {
  const isVideo = angleType === 'video-product' || angleType === 'video-model';
  const base = isVideo ? LAYER1_VIDEO_BASE : LAYER1_BASE;

  const parts: string[] = [base];

  // Add detailed garment description
  if (garment) {
    const garmentBlock = [
      `GARMENT SPECIFICATION (do NOT deviate from this description):`,
      `Type: ${garment.type}`,
      garment.length ? `Length: ${garment.length} — THIS LENGTH IS MANDATORY, do not shorten or lengthen` : '',
      garment.silhouette ? `Silhouette: ${garment.silhouette}` : '',
      garment.neckline ? `Neckline: ${garment.neckline}` : '',
      garment.sleeves ? `Sleeves: ${garment.sleeves}` : '',
      garment.hemline ? `Hemline: ${garment.hemline}` : '',
      `Fabric: ${garment.fabric}`,
      `Color: ${garment.color} — EXACT color match required, no shifts in tone or saturation`,
      garment.pattern ? `Pattern: ${garment.pattern}` : '',
      `Construction: ${garment.construction}`,
      `Details: ${garment.details}`,
      garment.fullDescription ? `\nFull reference: ${garment.fullDescription}` : '',
    ].filter(Boolean).join('\n');
    parts.push(garmentBlock);
  }

  // Add angle/shot instruction (always in English for AI)
  const angleInstruction = ANGLE_INSTRUCTIONS[angleType];
  if (angleInstruction) {
    parts.push(angleInstruction);
  }

  // Add model from gallery if available
  if (modelProfile && angleType !== 'video-product') {
    const galleryModel = MODEL_GALLERY.find(m => m.id === modelProfile.id);
    if (galleryModel) {
      // Use the rich English prompt block from the gallery
      parts.push(galleryModel.promptBlockEN);
      parts.push(
        `MODEL IDENTITY LOCK (same person in ALL images):\n` +
        `This model must appear IDENTICAL across all angles — same face, same hair, same skin, same body.\n` +
        `Skin tone: ${galleryModel.skinTone}\n` +
        `Hair: ${galleryModel.hairType}, ${galleryModel.hairColor} — DO NOT CHANGE between shots`
      );
    } else {
      // Fallback for custom profiles
      const modelBlock = [
        `MODEL IDENTITY LOCK (same person in ALL images):`,
        modelProfile.skinTone ? `Skin tone: ${modelProfile.skinTone}` : '',
        modelProfile.hairType ? `Hair style/texture: ${modelProfile.hairType} — DO NOT CHANGE between shots` : '',
        modelProfile.hairColor ? `Hair color: ${modelProfile.hairColor} — EXACT same color in every image` : '',
        modelProfile.height ? `Height: ${modelProfile.height}m` : '',
        `This model must appear IDENTICAL across all angles — same face, same hair, same skin, same body.`,
      ].filter(Boolean).join('\n');
      parts.push(modelBlock);
    }
  }

  // Layer 2 — style presets (already in English)
  if (layers.layer2.trim()) {
    parts.push(layers.layer2);
  }

  // Layer 3 — manual adjustments (will be in PT-BR, auto-translate not needed as AI understands)
  if (layers.layer3.trim()) {
    parts.push(layers.layer3);
  }

  return parts.join('\n\n');
}

/** Build a PT-BR preview of the prompt for user display */
export function buildPromptPreviewPT(
  garment: GarmentAnalysis | null,
  angleType: GenerationRequest['type'],
  modelProfile?: ModelProfile | null,
  selectedPresets?: Record<string, string>,
  manualPrompt?: string,
): string {
  const parts: string[] = [];

  parts.push("🔒 Base técnica (resolução 1080x1920, fidelidade absoluta da peça)");

  if (garment) {
    parts.push(`👗 Peça: ${garment.type} | ${garment.color} | ${garment.fabric} | ${garment.silhouette || ''}`);
  }

  const anglePT = ANGLE_LABELS_PT[angleType];
  if (anglePT) {
    parts.push(`📐 ${anglePT}`);
  }

  if (modelProfile) {
    const galleryModel = MODEL_GALLERY.find(m => m.id === modelProfile.id);
    parts.push(`👤 Modelo: ${galleryModel?.name || modelProfile.name} | ${modelProfile.skinTone} | ${modelProfile.hairType} ${modelProfile.hairColor}`);
  }

  if (selectedPresets && Object.keys(selectedPresets).length > 0) {
    parts.push(`🎨 Estilos: ${assembleLayer2PT(selectedPresets)}`);
  }

  if (manualPrompt?.trim()) {
    parts.push(`✏️ Ajuste manual: ${manualPrompt}`);
  }

  return parts.join('\n\n');
}

export function generateAllRequests(
  layers: PromptLayers,
  garment: GarmentAnalysis | null,
  modelProfile?: ModelProfile | null
): GenerationRequest[] {
  const types: { type: GenerationRequest['type']; label: string }[] = [
    { type: 'lookbook-front', label: 'Lookbook — Frente' },
    { type: 'lookbook-back', label: 'Lookbook — Costas' },
    { type: 'lookbook-left', label: 'Lookbook — Lateral Esquerda' },
    { type: 'lookbook-three-quarter', label: 'Lookbook — ¾' },
    { type: 'close-up', label: 'Close Técnico — Detalhe' },
    { type: 'video-product', label: 'Vídeo 360° Produto (prompt)' },
    { type: 'video-model', label: 'Vídeo 360° com Modelo (prompt)' },
  ];

  return types.map(t => ({
    type: t.type,
    label: t.label,
    prompt: buildFullPrompt(layers, garment, t.type, modelProfile),
  }));
}
