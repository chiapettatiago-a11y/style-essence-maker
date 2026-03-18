-- Passos 1, 2 e 7 (estrutura de dados + seeds + realtime)

-- 1) PRODUCTS: medidas de manequim e fotos de referência
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS mannequin_height_cm integer,
  ADD COLUMN IF NOT EXISTS mannequin_bust_cm integer,
  ADD COLUMN IF NOT EXISTS mannequin_waist_cm integer,
  ADD COLUMN IF NOT EXISTS mannequin_hip_cm integer,
  ADD COLUMN IF NOT EXISTS mannequin_torso_cm integer,
  ADD COLUMN IF NOT EXISTS mannequin_arm_cm integer,
  ADD COLUMN IF NOT EXISTS reference_photos text[] DEFAULT '{}'::text[];

-- 2) PRODUCT_VARIANTS: campos técnicos e snapshot de proporção
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS garment_type text,
  ADD COLUMN IF NOT EXISTS garment_length text,
  ADD COLUMN IF NOT EXISTS garment_length_cm integer,
  ADD COLUMN IF NOT EXISTS hem_below_knee_cm integer,
  ADD COLUMN IF NOT EXISTS waist_position_cm integer,
  ADD COLUMN IF NOT EXISTS sleeve_length_cm integer,
  ADD COLUMN IF NOT EXISTS sleeve_type text,
  ADD COLUMN IF NOT EXISTS shoulder_width_cm integer,
  ADD COLUMN IF NOT EXISTS proportion_json jsonb,
  ADD COLUMN IF NOT EXISTS analysis_raw text;

-- 3) WEEKLY_LAUNCHES: snapshot de configuração por lançamento
ALTER TABLE public.weekly_launches
  ADD COLUMN IF NOT EXISTS mannequin_height_cm integer,
  ADD COLUMN IF NOT EXISTS mannequin_bust_cm integer,
  ADD COLUMN IF NOT EXISTS mannequin_waist_cm integer,
  ADD COLUMN IF NOT EXISTS mannequin_hip_cm integer,
  ADD COLUMN IF NOT EXISTS mannequin_torso_cm integer,
  ADD COLUMN IF NOT EXISTS mannequin_arm_cm integer,
  ADD COLUMN IF NOT EXISTS reference_photos text[] DEFAULT '{}'::text[];

-- 4) GENERATED_IMAGES: rastreabilidade de geração
ALTER TABLE public.generated_images
  ADD COLUMN IF NOT EXISTS photo_angle text,
  ADD COLUMN IF NOT EXISTS original_url text,
  ADD COLUMN IF NOT EXISTS preview_url text,
  ADD COLUMN IF NOT EXISTS prompt_used text,
  ADD COLUMN IF NOT EXISTS generation_ms integer,
  ADD COLUMN IF NOT EXISTS model_used text,
  ADD COLUMN IF NOT EXISTS attempt_number integer DEFAULT 1;

-- Backfill seguro para colunas NOT NULL novas
UPDATE public.generated_images
SET photo_angle = COALESCE(photo_angle, type)
WHERE photo_angle IS NULL;

UPDATE public.generated_images
SET attempt_number = COALESCE(attempt_number, 1)
WHERE attempt_number IS NULL;

ALTER TABLE public.generated_images
  ALTER COLUMN photo_angle SET NOT NULL,
  ALTER COLUMN attempt_number SET NOT NULL;

-- 5) MODEL_PROFILES: perfis fixos de modelo
CREATE TABLE IF NOT EXISTS public.model_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  skin_tone text,
  hair_description text,
  facial_features text,
  height_cm integer,
  bust_cm integer,
  waist_cm integer,
  hip_cm integer,
  prompt_seed text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.model_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'model_profiles'
      AND policyname = 'Authenticated users can view model profiles'
  ) THEN
    CREATE POLICY "Authenticated users can view model profiles"
      ON public.model_profiles
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Trigger de updated_at para model_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_model_profiles_updated_at'
  ) THEN
    CREATE TRIGGER update_model_profiles_updated_at
    BEFORE UPDATE ON public.model_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Seeds dos 6 perfis fixos
INSERT INTO public.model_profiles (
  slug, display_name, skin_tone, hair_description, facial_features,
  height_cm, bust_cm, waist_cm, hip_cm, prompt_seed
)
VALUES
(
  'brasileira-natural',
  'Brasileira Natural',
  'light-medium warm olive skin tone',
  'dark brown wavy hair, shoulder length, natural movement',
  'authentic brazilian latina features, expressive dark eyes, natural lips',
  170, 88, 68, 96,
  'Brazilian woman with authentic latina features, light-medium warm olive skin tone, dark brown wavy shoulder-length hair with natural movement. Height 170cm, bust 88cm, waist 68cm, hips 96cm. Natural skin texture, subtle makeup, approachable elegance. NOT Eurocentric features, NOT K-beauty influence, NOT heavily filtered.'
),
(
  'afro-contemporanea',
  'Afro Contemporânea',
  'deep rich brown skin tone with warm undertone',
  'natural coily hair, voluminous shape, medium length',
  'strong cheekbones, expressive eyes, authentic afro-brazilian beauty',
  173, 92, 72, 102,
  'Brazilian woman with authentic afro-brazilian beauty, deep rich brown skin with warm undertone, natural coily voluminous medium-length hair. Height 173cm, bust 92cm, waist 72cm, hips 102cm. Real skin texture and refined natural makeup. NOT Eurocentric features, NOT K-beauty influence, NOT heavily filtered.'
),
(
  'nordica-editorial',
  'Nórdica Editorial',
  'fair neutral skin tone',
  'light brown straight hair, long, soft movement',
  'clean jawline, balanced facial symmetry, soft editorial expression',
  176, 86, 66, 94,
  'Brazilian woman with fair neutral skin and natural latina identity, long light-brown straight hair with soft movement. Height 176cm, bust 86cm, waist 66cm, hips 94cm. Minimal retouching, real pores visible, serene confidence. NOT Eurocentric features, NOT K-beauty influence, NOT heavily filtered.'
),
(
  'asiatica-moderna',
  'Asiática Moderna',
  'light warm beige skin tone',
  'dark straight hair, sleek, chest length',
  'delicate but defined features, modern commercial beauty',
  168, 84, 64, 92,
  'Brazilian woman with asian-latina heritage traits, light warm beige skin, sleek dark straight chest-length hair. Height 168cm, bust 84cm, waist 64cm, hips 92cm. Natural makeup and authentic expression. NOT Eurocentric features, NOT K-beauty influence, NOT heavily filtered.'
),
(
  'latina-glamour',
  'Latina Glamour',
  'medium tan golden skin tone',
  'dark brown long wavy hair, glossy natural finish',
  'defined eyebrows, full lips, confident commercial presence',
  171, 90, 70, 100,
  'Brazilian woman with authentic latina glamour, medium tan golden skin tone, long dark-brown wavy hair with natural gloss. Height 171cm, bust 90cm, waist 70cm, hips 100cm. Natural skin texture, subtle glam makeup, confident posture. NOT Eurocentric features, NOT K-beauty influence, NOT heavily filtered.'
),
(
  'morena-comercial',
  'Morena Comercial',
  'warm medium-brown morena clara skin tone',
  'dark wavy hair, past shoulders, natural movement',
  'broad cheekbones, expressive dark eyes, full lips',
  172, 91, 71, 101,
  'Brazilian woman, warm medium-brown morena clara skin tone, natural bronze undertone. Dark wavy hair with natural movement, falling past shoulders. Defined facial features typical of commercial Brazilian beauty — broad cheekbones, expressive dark eyes, full lips. Height 172cm, bust 91cm, waist 71cm, hips 101cm. Natural skin texture, minimal retouching, real pores visible. NOT Eurocentric features, NOT K-beauty influence, NOT heavily filtered.'
)
ON CONFLICT (slug) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  skin_tone = EXCLUDED.skin_tone,
  hair_description = EXCLUDED.hair_description,
  facial_features = EXCLUDED.facial_features,
  height_cm = EXCLUDED.height_cm,
  bust_cm = EXCLUDED.bust_cm,
  waist_cm = EXCLUDED.waist_cm,
  hip_cm = EXCLUDED.hip_cm,
  prompt_seed = EXCLUDED.prompt_seed,
  updated_at = now();

-- 7) Realtime para status das fotos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'generated_images'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.generated_images;
  END IF;
END $$;