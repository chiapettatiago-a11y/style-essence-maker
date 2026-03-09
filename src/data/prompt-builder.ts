import { GarmentAnalysis, GenerationRequest, ModelProfile, PromptLayers } from "@/types/fashion";
import { LAYER1_BASE, LAYER1_VIDEO_BASE, STYLE_CATEGORIES } from "./prompt-layers";

const ANGLE_INSTRUCTIONS: Record<string, string> = {
  'lookbook-front': 'Front view — model facing directly toward camera, garment fully visible from the front.',
  'lookbook-back': 'Back view — model turned fully away from camera, showing garment back construction, closures, and rear design details.',
  'lookbook-left': 'Left side profile view — model turned 90° showing garment silhouette and side construction.',
  'lookbook-three-quarter': 'Three-quarter view (¾ angle) — model positioned at 45° to camera showing depth and drape of the garment.',
  'close-up': 'Tight close-up detail shot — focusing on the most distinctive design element: lace pattern, stitching, texture, belt, collar or trim. Extreme textile detail, macro-level fabric clarity.',
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

export function buildFullPrompt(
  layers: PromptLayers,
  garment: GarmentAnalysis | null,
  angleType: GenerationRequest['type'],
  modelProfile?: ModelProfile | null
): string {
  const isVideo = angleType === 'video-product' || angleType === 'video-model';
  const base = isVideo ? LAYER1_VIDEO_BASE : LAYER1_BASE;

  const parts: string[] = [base];

  // Add detailed garment description with consistency anchors
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

  // Add angle/shot instruction
  const angleInstruction = ANGLE_INSTRUCTIONS[angleType];
  if (angleInstruction) {
    parts.push(angleInstruction);
  }

  // Layer 2 — style presets
  if (layers.layer2.trim()) {
    parts.push(layers.layer2);
  }

  // Layer 3 — manual adjustments
  if (layers.layer3.trim()) {
    parts.push(layers.layer3);
  }

  return parts.join('\n\n');
}

export function generateAllRequests(
  layers: PromptLayers,
  garment: GarmentAnalysis | null
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
    prompt: buildFullPrompt(layers, garment, t.type),
  }));
}
