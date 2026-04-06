ALTER TABLE public.generated_images ADD COLUMN IF NOT EXISTS bg_swap_url TEXT;
ALTER TABLE public.generated_images ADD COLUMN IF NOT EXISTS bg_swap_at TIMESTAMPTZ;
ALTER TABLE public.generated_images ADD COLUMN IF NOT EXISTS bg_swap_prompt TEXT;