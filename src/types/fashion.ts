export interface GarmentAnalysis {
  type: string;
  fabric: string;
  color: string;
  pattern: string;
  construction: string;
  details: string;
  style: string;
  fullDescription: string;
  length: string;       // e.g. "midi", "longo até o tornozelo", "curto acima do joelho"
  silhouette: string;   // e.g. "evasê", "reto", "ajustado"
  hemline: string;      // e.g. "barra reta", "barra assimétrica"
  neckline: string;     // e.g. "gola alta", "decote V"
  sleeves: string;      // e.g. "manga longa", "sem manga"
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
  layer1: string; // Base técnica (locked)
  layer2: string; // Assembled from selected presets
  layer3: string; // Manual adjustments
}

export interface GenerationRequest {
  type: 'lookbook-front' | 'lookbook-back' | 'lookbook-left' | 'lookbook-three-quarter' | 'close-up' | 'video-product' | 'video-model';
  label: string;
  prompt: string;
}

export interface GeneratedImage {
  id: string;
  type: GenerationRequest['type'];
  label: string;
  prompt: string;
  imageUrl?: string;
  status: 'pending' | 'generating' | 'done' | 'error';
  error?: string;
}

export interface WeeklyLaunch {
  id: string;
  label: string;
  variantId?: string;
  images: GeneratedImage[];
}

export interface ProductVariant {
  id: string;
  productId: string;
  colorName: string;
  uploadedImages: string[];
  garmentAnalysis: GarmentAnalysis | null;
  sortOrder: number;
}

export interface WizardState {
  step: number;
  variants: ProductVariant[];
  activeVariantId: string;
  // Shared configs
  selectedProfile: ModelProfile | null;
  selectedPresets: Record<string, string>;
  manualPrompt: string;
  generatedImages: GeneratedImage[];
  weeklyLaunches: WeeklyLaunch[];
  activeWeek: string;
  // Convenience getters (derived from active variant)
  uploadedImages: string[];
  garmentAnalysis: GarmentAnalysis | null;
}
