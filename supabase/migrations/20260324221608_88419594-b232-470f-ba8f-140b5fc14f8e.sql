ALTER TABLE public.model_profiles ADD COLUMN IF NOT EXISTS lora_scale numeric DEFAULT 1.0;
ALTER TABLE public.model_profiles ADD COLUMN IF NOT EXISTS guidance_scale numeric DEFAULT 3.5;