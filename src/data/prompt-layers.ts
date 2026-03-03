import { StyleCategory } from "@/types/fashion";

// 🔒 CAMADA 1 — Base Técnica Travada
export const LAYER1_BASE = `Professional fashion lookbook photo in 1080x1920 resolution (9:16 portrait aspect ratio), ultra high definition.

Do not alter garment design. Preserve all pattern details, transparency, pleat structure, proportions and trim alignment precisely.

CRITICAL BRAND ELEMENT — Golden "TR" tag/plate: This small golden metallic tag engraved with "TR" is a signature brand identity element. During garment analysis, identify its exact placement (e.g. waistband, collar, cuff, pocket). In every generated image, the golden TR tag MUST appear in its original position, with correct size, metallic gold finish, and legible "TR" engraving. Never omit, resize, reposition, or obscure this element.

Full body centered in frame, no cropping, garment fully visible within 9:16 portrait composition.

Soft diffused lighting with subtle shadow depth to enhance texture and textile realism.

Luxury commercial lookbook aesthetic, sharp textile detail, no distortion, no compression artifacts, maximum texture fidelity, photorealistic fabric detail.`;

export const LAYER1_VIDEO_BASE = `Professional cinematic fashion video in 1080x1920 resolution (9:16 portrait), 4K clarity, 24fps.

Absolute garment fidelity — do not redesign or modify proportions. Preserve all original design elements exactly.

CRITICAL BRAND ELEMENT — Golden "TR" tag/plate: The signature golden metallic tag engraved with "TR" must remain visible and intact throughout the video. Maintain its original placement, correct metallic gold finish, and legible engraving in every frame where it would naturally be visible.

Soft diffused studio lighting enhancing texture depth.

Luxury fashion campaign aesthetic. No distortion, no artificial smoothing, high textile realism.`;

// 🎛 CAMADA 2 — Biblioteca de Estilos
export const STYLE_CATEGORIES: StyleCategory[] = [
  {
    id: "model",
    label: "Modelo",
    icon: "User",
    presets: [
      {
        id: "brasileira-natural",
        name: "Brasileira Natural",
        description: "Modelo brasileira com proporções naturais e pele bronzeada",
        promptBlock: "Brazilian female model, 1.70m height, medium tan skin, natural Brazilian body proportions (balanced hips and waist), elegant and relaxed posture. Soft natural makeup, subtle glow skin finish, straight or softly waved hair, minimal accessories."
      },
      {
        id: "nordica-editorial",
        name: "Nórdica Editorial",
        description: "Modelo nórdica com traços finos e pele clara",
        promptBlock: "Nordic female model, 1.78m height, fair porcelain skin, slender editorial proportions, sharp jawline, high cheekbones. Minimal dewy makeup, platinum or ash blonde hair, no accessories."
      },
      {
        id: "afro-contemporanea",
        name: "Afro Contemporânea",
        description: "Modelo afrodescendente com presença marcante",
        promptBlock: "Black female model, 1.75m height, deep rich dark skin tone, strong confident presence, natural proportions. Dewy minimal makeup highlighting natural glow, natural textured hair or sleek style, understated jewelry."
      },
      {
        id: "asiatica-moderna",
        name: "Asiática Moderna",
        description: "Modelo asiática com elegância minimalista",
        promptBlock: "East Asian female model, 1.68m height, warm ivory skin tone, delicate features, graceful and poised posture. Clean minimal makeup, straight dark hair or modern bob, minimal accessories."
      }
    ]
  },
  {
    id: "pose",
    label: "Pose",
    icon: "Move",
    presets: [
      {
        id: "organica-relaxada",
        name: "Orgânica Relaxada",
        description: "Pose natural com suavidade nos ombros",
        promptBlock: "Model pose must feel organic and natural — soft shoulders, slight asymmetry in stance, natural breathing posture, not rigid or over-posed. Weight shifted to one leg, relaxed arms."
      },
      {
        id: "editorial-dinamica",
        name: "Editorial Dinâmica",
        description: "Pose com energia editorial e atitude",
        promptBlock: "Dynamic editorial pose with confident energy — elongated limbs, deliberate angular stance, one hand on hip or mid-gesture. Sharp silhouette with intentional asymmetry, strong presence."
      },
      {
        id: "comercial-classica",
        name: "Comercial Clássica",
        description: "Pose equilibrada para e-commerce",
        promptBlock: "Classic commercial pose — balanced symmetrical stance, hands naturally at sides or lightly touching garment, approachable expression, clean silhouette optimized for product visibility."
      },
      {
        id: "lifestyle-movimento",
        name: "Lifestyle em Movimento",
        description: "Captura de movimento natural e espontâneo",
        promptBlock: "Lifestyle captured mid-movement — walking naturally, gentle turn of the body, hair and fabric responding to motion, candid and effortless energy, spontaneous elegance."
      }
    ]
  },
  {
    id: "scenario",
    label: "Cenário",
    icon: "Image",
    presets: [
      {
        id: "estudio-neutro-bege",
        name: "Estúdio Neutro Bege",
        description: "Fundo infinito bege para foco total na peça",
        promptBlock: "Neutral seamless beige studio background. Clean infinite backdrop with no distractions, soft gradient from center to edges."
      },
      {
        id: "estudio-branco",
        name: "Estúdio Branco Puro",
        description: "Fundo branco limpo para e-commerce",
        promptBlock: "Pure white seamless studio background. High-key lighting, clean commercial backdrop optimized for e-commerce presentation."
      },
      {
        id: "urbano-contemporaneo",
        name: "Urbano Contemporâneo",
        description: "Cenário urbano com arquitetura moderna",
        promptBlock: "Contemporary urban setting with modern architecture — clean concrete walls, glass surfaces, muted city tones. Blurred background with shallow depth of field keeping focus on the garment."
      },
      {
        id: "natureza-suave",
        name: "Natureza Suave",
        description: "Cenário natural com luz dourada",
        promptBlock: "Soft natural outdoor setting — lush green garden or open field, golden hour warm light, gentle bokeh in background. Natural environment that complements without competing with the garment."
      }
    ]
  },
  {
    id: "aesthetic",
    label: "Estética",
    icon: "Sparkles",
    presets: [
      {
        id: "luxury-lookbook",
        name: "Luxury Lookbook",
        description: "Estética de alto luxo editorial",
        promptBlock: "Luxury commercial lookbook aesthetic — refined color grading, rich tonal depth, elegant composition following fashion photography conventions. Magazine-quality finish."
      },
      {
        id: "streetwear-campaign",
        name: "Streetwear Campaign",
        description: "Estética urbana com contraste forte",
        promptBlock: "Streetwear campaign aesthetic — high contrast, raw urban energy, slightly desaturated with punchy highlights. Authentic street photography feel with editorial polish."
      },
      {
        id: "resort-editorial",
        name: "Resort Editorial",
        description: "Estética resort com tons quentes",
        promptBlock: "Resort editorial aesthetic — warm golden tones, sun-kissed highlights, dreamy soft focus. Vacation luxury atmosphere with sophisticated color palette."
      },
      {
        id: "minimal-avant-garde",
        name: "Minimal Avant-Garde",
        description: "Estética minimalista com toque artístico",
        promptBlock: "Minimal avant-garde aesthetic — stark contrasts, geometric composition, dramatic shadows. Art-directed feel with intentional negative space and sculptural lighting."
      }
    ]
  },
  {
    id: "camera",
    label: "Câmera / Vídeo",
    icon: "Video",
    presets: [
      {
        id: "360-gracioso",
        name: "360° Gracioso 15s",
        description: "Rotação completa suave de 15 segundos",
        promptBlock: "Model performs a slow, graceful 360° turn over 12–15 seconds. Acting must be natural and fluid — soft shoulders, subtle breathing movement, effortless elegance, no stiff posing. Fabric should show realistic micro-movement. Camera starts wide and stable, smooth cinematic orbit following the model."
      },
      {
        id: "dolly-in-detail",
        name: "Dolly-in Close Detail",
        description: "Aproximação cinematográfica com foco em detalhes",
        promptBlock: "Camera movement starts wide full-body shot, then smooth cinematic dolly-in gradually transitions into refined close-up focusing on garment detail — collar, belt, texture, or trim. Slow deliberate movement, 8–10 seconds."
      },
      {
        id: "orbita-produto",
        name: "Órbita Produto 360°",
        description: "Câmera gira ao redor do produto estático",
        promptBlock: "Static garment on invisible mannequin or hanger. Camera performs smooth 360° orbit around the product over 10 seconds. Even lighting from all angles, focusing on construction details and fabric texture."
      },
      {
        id: "passerelle-walk",
        name: "Passerelle Walk",
        description: "Modelo caminhando como em desfile",
        promptBlock: "Model walks toward camera in classic runway style — confident stride, controlled pace, natural arm movement. Camera is static at eye level. Clean backdrop, 8 seconds of movement capturing front and side views."
      }
    ]
  }
];

// Preset profiles para reutilização
export const DEFAULT_PROFILES = [
  {
    id: "editorial-br",
    name: "Modelo Editorial BR",
    height: "1.75",
    bust: "86",
    waist: "62",
    hip: "90",
    skinTone: "Bronzeado médio",
    hairType: "Liso ondulado",
    hairColor: "Castanho escuro",
    generalStyle: "Editorial"
  },
  {
    id: "comercial-br",
    name: "Modelo Comercial BR",
    height: "1.70",
    bust: "88",
    waist: "65",
    hip: "94",
    skinTone: "Morena clara",
    hairType: "Ondulado natural",
    hairColor: "Castanho médio",
    generalStyle: "Comercial"
  }
];
