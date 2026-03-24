import { ModelProfile } from "@/types/fashion";

import brasileiraNatural from "@/assets/models/brasileira-natural.jpg";
import afroContemporanea from "@/assets/models/afro-contemporanea.jpg";
import nordicaEditorial from "@/assets/models/nordica-editorial.jpg";
import asiaticaModerna from "@/assets/models/asiatica-moderna.jpg";
import morenaComercial from "@/assets/models/morena-comercial.jpg";
import latinaGlamour from "@/assets/models/latina-glamour.jpg";
import thaisRodrigues from "@/assets/models/thais-rodrigues.jpg";

export interface GalleryModel extends ModelProfile {
  faceImage: string;
  description: string;
  /** English prompt block for AI generation */
  promptBlockEN: string;
}

export const MODEL_GALLERY: GalleryModel[] = [
  {
    id: "thais-rodrigues",
    name: "Thais Rodrigues",
    description: "Modelo oficial TR — LoRA treinada, morena clara, cabelo ondulado castanho",
    faceImage: thaisRodrigues,
    height: "1.72",
    bust: "86",
    waist: "62",
    hip: "92",
    skinTone: "Morena clara, bronze natural",
    hairType: "Ondulado natural com movimento",
    hairColor: "Castanho",
    generalStyle: "Editorial/Comercial",
    promptBlockEN: "MODELO_THAIS Brazilian female model, 1.72m height, morena clara skin with natural bronze undertone, broad cheekbones, dark expressive eyes, full lips, brown wavy hair with natural movement, authentic Brazilian commercial beauty, age 26-30. NOT Asian features, NOT straight black hair, NOT pale skin.",
    lora_url: "https://v3b.fal.media/files/b/0a937f0e/Hm1Fcjsk0831sOokpV8bv_pytorch_lora_weights.safetensors",
    lora_trigger_word: "MODELO_THAIS",
  },
  {
    id: "brasileira-natural",
    name: "Brasileira Natural",
    description: "Pele bronzeada, cabelo ondulado escuro, proporções naturais",
    faceImage: brasileiraNatural,
    height: "1.70",
    bust: "86",
    waist: "62",
    hip: "90",
    skinTone: "Bronzeado médio",
    hairType: "Liso ondulado",
    hairColor: "Castanho escuro",
    generalStyle: "Editorial",
    promptBlockEN: "Brazilian female model, 1.70m height, medium tan bronze skin, natural Brazilian body proportions (balanced hips and waist), elegant and relaxed posture. Soft natural makeup, subtle glow skin finish, dark brown softly waved shoulder-length hair, minimal accessories.",
  },
  {
    id: "morena-comercial",
    name: "Morena Comercial",
    description: "Pele morena clara, cabelo ondulado castanho, visual comercial",
    faceImage: morenaComercial,
    height: "1.70",
    bust: "88",
    waist: "65",
    hip: "94",
    skinTone: "Morena clara",
    hairType: "Ondulado natural",
    hairColor: "Castanho médio",
    generalStyle: "Comercial",
    promptBlockEN: "Brazilian mixed-race female model, 1.70m height, light morena skin with warm undertone, natural body proportions, approachable and warm expression. Fresh natural makeup, wavy medium brown hair with subtle highlights, minimal accessories.",
  },
  {
    id: "afro-contemporanea",
    name: "Afro Contemporânea",
    description: "Pele negra, cabelo crespo natural, presença marcante",
    faceImage: afroContemporanea,
    height: "1.75",
    bust: "88",
    waist: "64",
    hip: "92",
    skinTone: "Pele negra profunda",
    hairType: "Crespo natural",
    hairColor: "Preto",
    generalStyle: "Contemporâneo",
    promptBlockEN: "Black female model, 1.75m height, deep rich dark skin tone, strong confident presence, natural proportions. Dewy minimal makeup highlighting natural glow, natural textured afro hair, understated jewelry.",
  },
  {
    id: "nordica-editorial",
    name: "Nórdica Editorial",
    description: "Pele clara porcelana, cabelo loiro platinado liso",
    faceImage: nordicaEditorial,
    height: "1.78",
    bust: "84",
    waist: "60",
    hip: "88",
    skinTone: "Clara porcelana",
    hairType: "Liso",
    hairColor: "Loiro platinado",
    generalStyle: "Editorial",
    promptBlockEN: "Nordic female model, 1.78m height, fair porcelain skin, slender editorial proportions, sharp jawline, high cheekbones. Minimal dewy makeup, platinum ash blonde straight hair, no accessories.",
  },
  {
    id: "asiatica-moderna",
    name: "Asiática Moderna",
    description: "Pele marfim, bob escuro moderno, elegância minimalista",
    faceImage: asiaticaModerna,
    height: "1.68",
    bust: "82",
    waist: "60",
    hip: "86",
    skinTone: "Marfim quente",
    hairType: "Bob moderno",
    hairColor: "Preto",
    generalStyle: "Minimalista",
    promptBlockEN: "East Asian female model, 1.68m height, warm ivory skin tone, delicate features, graceful and poised posture. Clean minimal makeup, straight dark hair in modern bob cut, minimal accessories.",
  },
  {
    id: "latina-glamour",
    name: "Latina Glamour",
    description: "Pele oliva, cabelo escuro ondulado longo, visual sofisticado",
    faceImage: latinaGlamour,
    height: "1.72",
    bust: "88",
    waist: "63",
    hip: "92",
    skinTone: "Oliva quente",
    hairType: "Ondulado longo",
    hairColor: "Castanho escuro",
    generalStyle: "Glamour",
    promptBlockEN: "Mediterranean/Latina female model, 1.72m height, olive warm skin, expressive dark eyes, natural sensual elegance. Subtle glamour makeup, long dark wavy hair, understated accessories.",
  },
];
