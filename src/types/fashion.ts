export interface GarmentAnalysis {
  type: string;
  fabric: string;
  color: string;
  pattern: string;
  construction: string;
  details: string;
  style: string;
  fullDescription: string;
  length: string;
  silhouette: string;
  hemline: string;
  neckline: string;
  sleeves: string;
  colorHexEstimate?: string;
  patternDescription?: string;
  hemType?: string;
  lengthDescription?: string;
  sleeveLength?: string;
  closure?: string;
  beltOrTie?: string;
  signatureDetails?: string;
  promptDescription?: string;
  fabricTexture?: string;
  sleeveDetail?: string;
  hemDetail?: string;
  trBadgeLocation?: string;
  trBadgeDescription?: string;
}

export interface ComboAnalysis {
  top: GarmentAnalysis;
  bottom: GarmentAnalysis;
  featuredPiece: 'top' | 'bottom';
  comboDescription: string;
}

export interface ModelProfile {
  id: string;
  name: string;
  height: string;
  bust: string;
  waist: string;
  hip: string;
  skinTone: string;
  hairType: string;
  hairColor: string;
  generalStyle: string;
  promptSeed?: string;
  lora_url?: string;
  lora_trigger_word?: string;
  lora_scale?: number;
  guidance_scale?: number;
  face_image_url?: string;
}

export interface StylePreset {
  id: string;
  name: string;
  description: string;
  promptBlock: string;
}

export interface StyleCategory {
  id: string;
  label: string;
  icon: string;
  presets: StylePreset[];
}

export interface PromptLayers {
  layer1: string;
  layer2: string;
  layer3: string;
}

export type GenerationEngine = 'gemini' | 'fal';

export interface GenerationRequest {
  type:
    | 'lookbook-front'
    | 'lookbook-back'
    | 'lookbook-left'
    | 'lookbook-three-quarter'
    | 'close-tr-detail'
    | 'movement-shot'
    | 'video-product'
    | 'video-model';
  label: string;
  prompt: string;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface GeneratedImage {
  id: string;
  type: GenerationRequest['type'];
  label: string;
  prompt: string;
  imageUrl?: string;
  status: 'pending' | 'generating' | 'done' | 'error';
  error?: string;
  photoAngle?: string;
  originalUrl?: string;
  previewUrl?: string;
  rawUrl?: string;
  upscaled?: boolean;
  promptUsed?: string;
  generationMs?: number;
  modelUsed?: string;
  attemptNumber?: number;
  approvalStatus?: ApprovalStatus;
  generationCostUsd?: number;
}

export interface WeeklyLaunch {
  id: string;
  label: string;
  name?: string;
  variantId?: string;
  engineUsed?: GenerationEngine;
  images: GeneratedImage[];
  mannequinHeightCm?: number | null;
  mannequinBustCm?: number | null;
  mannequinWaistCm?: number | null;
  mannequinHipCm?: number | null;
  mannequinTorsoCm?: number | null;
  mannequinArmCm?: number | null;
  referencePhotos?: string[];
  lockedProportionJson?: Record<string, unknown> | null;
  totalCostUsd?: number;
}

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  season?: string | null;
  objective?: string | null;
  color_tag?: string;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  colorName: string;
  uploadedImages: string[];
  garmentAnalysis: GarmentAnalysis | null;
  sortOrder: number;
  garmentType?: string | null;
  garmentLength?: string | null;
  garmentLengthCm?: number | null;
  hemBelowKneeCm?: number | null;
  waistPositionCm?: number | null;
  sleeveLengthCm?: number | null;
  sleeveType?: string | null;
  shoulderWidthCm?: number | null;
  proportionJson?: Record<string, unknown> | null;
  analysisRaw?: string | null;
  trBadgeLocation?: string | null;
  fabricTexture?: string | null;
}

export interface AccessorySelection {
  shoeType: string | null;
  shoeColor: string | null;
}

export interface WizardState {
  step: number;
  variants: ProductVariant[];
  activeVariantId: string;
  selectedProfile: ModelProfile | null;
  selectedPresets: Record<string, string>;
  selectedEngine: GenerationEngine;
  manualPrompt: string;
  generatedImages: GeneratedImage[];
  weeklyLaunches: WeeklyLaunch[];
  activeWeek: string;
  uploadedImages: string[];
  garmentAnalysis: GarmentAnalysis | null;
  accessories: AccessorySelection;
  isCombo: boolean;
  featuredPiece: string | null;
}
