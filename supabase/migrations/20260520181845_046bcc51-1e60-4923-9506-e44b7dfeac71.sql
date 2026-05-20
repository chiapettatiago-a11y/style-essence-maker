ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS generation_seed bigint,
  ADD COLUMN IF NOT EXISTS locked_engine text,
  ADD COLUMN IF NOT EXISTS model_reference_image text;

ALTER TABLE public.generated_images
  ADD COLUMN IF NOT EXISTS seed_used bigint;