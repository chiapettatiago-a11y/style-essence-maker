export type FabricProfile = {
  surfaceType: 'flat' | 'textured' | 'structured' | 'fluid' | 'sheer';
  lightBehavior: string;
  renderingInstruction: string;
};

export const FABRIC_PHYSICS_ENGINE: Record<string, FabricProfile> = {
  tweed: {
    surfaceType: 'textured',
    lightBehavior: 'absorbs and scatters',
    renderingInstruction: 'chunky yarn loops RAISED above surface. Light catches on elevated threads, shadow pools between loops. Organic irregular surface — NOT geometric grid. Individual yarn colors distinguishable.',
  },
  boucle: {
    surfaceType: 'textured',
    lightBehavior: 'scatters softly',
    renderingInstruction: 'individual loops dimensional and irregular. Soft scattered light. Surface has visible depth and texture.',
  },
  lace: {
    surfaceType: 'sheer',
    lightBehavior: 'passes through',
    renderingInstruction: 'open-weave structure with visible negative space. Thread intersections sharp and distinct. NOT opaque.',
  },
  knit: {
    surfaceType: 'textured',
    lightBehavior: 'soft diffuse',
    renderingInstruction: 'individual knit loops visible. Fabric has stretch memory. Soft matte surface with subtle texture ridges.',
  },
  leather: {
    surfaceType: 'structured',
    lightBehavior: 'specular directional',
    renderingInstruction: 'smooth surface with subtle natural grain. Directional specular highlight. Slight stiffness in silhouette. NOT plastic or uniformly matte.',
  },
  'faux leather': {
    surfaceType: 'structured',
    lightBehavior: 'specular uniform',
    renderingInstruction: 'slightly more uniform sheen than real leather. Structure holds shape. Visible seam lines.',
  },
  satin: {
    surfaceType: 'fluid',
    lightBehavior: 'directional sheen',
    renderingInstruction: 'strong directional sheen gradient. Bright where light hits, deep shadow in folds. Fluid drape with bias movement.',
  },
  silk: {
    surfaceType: 'fluid',
    lightBehavior: 'soft sheen',
    renderingInstruction: 'delicate directional sheen, softer than satin. Natural drape with organic fold lines.',
  },
  chiffon: {
    surfaceType: 'sheer',
    lightBehavior: 'transmits light',
    renderingInstruction: 'semi-transparent layers. Light passes through. Multiple layers create visible depth. Gentle float in movement.',
  },
  crepe: {
    surfaceType: 'fluid',
    lightBehavior: 'matte diffuse',
    renderingInstruction: 'fully matte, slight irregular surface texture. Fluid drape, soft folds. NOT shiny or stiff.',
  },
  denim: {
    surfaceType: 'structured',
    lightBehavior: 'diffuse',
    renderingInstruction: 'visible diagonal warp/weft thread. Slight fading variation especially on seams and stress points. NOT uniform digital blue.',
  },
  cotton: {
    surfaceType: 'flat',
    lightBehavior: 'soft diffuse',
    renderingInstruction: 'matte breathable surface. Slight natural wrinkle at movement joints. NOT stiff or plastified.',
  },
  linen: {
    surfaceType: 'flat',
    lightBehavior: 'soft diffuse',
    renderingInstruction: 'slightly irregular weave visible. Natural creasing at waist and elbows. Organic texture.',
  },
  velvet: {
    surfaceType: 'textured',
    lightBehavior: 'absorbs with directional sheen',
    renderingInstruction: 'pile direction creates light/dark contrast zones. Deep color absorption. Subtle directional sheen where pile reflects light.',
  },
  organza: {
    surfaceType: 'sheer',
    lightBehavior: 'transmits and reflects',
    renderingInstruction: 'crisp semi-transparent structure. Light transmits through but fabric holds its shape. Slight crinkle at edges.',
  },
};

const FABRIC_PHYSICS_FALLBACK: FabricProfile = {
  surfaceType: 'flat',
  lightBehavior: 'diffuse',
  renderingInstruction: 'render as real physical material. Natural light interaction with fabric surface. Texture must be visible and dimensional — NOT flat or digitally simplified.',
};

export function getFabricPhysics(fabricDescription: string): FabricProfile {
  const lower = fabricDescription.toLowerCase();
  const match = Object.keys(FABRIC_PHYSICS_ENGINE).find(key =>
    lower.includes(key)
  );
  return match ? FABRIC_PHYSICS_ENGINE[match] : FABRIC_PHYSICS_FALLBACK;
}

export const GARMENT_TYPE_RULES: Record<string, string> = {
  dress:   'Render as single unified piece neckline to hem. Preserve exact length. Skirt movement natural.',
  skirt:   'Render from waistband to hem. Waistband construction visible. Hem behavior matches fabric physics.',
  blouse:  'All closure details visible. Collar/neckline construction precise. Sleeve and cuff details mandatory.',
  shirt:   'Button placket straight and aligned. Collar structure preserved.',
  pants:   'Waistband, closure, and leg width consistent. Hem break on shoe as specified.',
  jacket:  'Lapel structure precise. Front closure exact. Shoulder structure defines silhouette.',
  coat:    'Full length consistent. Collar and lapel preserved. Lining visible at hem if applicable.',
  top:     'Neckline and hem exact. All decorative details preserved.',
};

export function getGarmentTypeRules(garmentType: string): string {
  const lower = garmentType.toLowerCase();
  const match = Object.entries(GARMENT_TYPE_RULES).find(([key]) =>
    lower.includes(key)
  );
  return match?.[1] ??
    'Render garment with precise structural integrity. All seams, closures, and proportions exact.';
}
