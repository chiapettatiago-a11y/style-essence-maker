
ALTER TABLE public.generated_images
  ADD COLUMN IF NOT EXISTS upscaled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS raw_url text;

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS reference_photos_top text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS reference_photos_bottom text[] DEFAULT '{}'::text[];
