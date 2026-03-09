
-- Create product_variants table
CREATE TABLE public.product_variants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  color_name text NOT NULL DEFAULT 'Original',
  uploaded_images text[] DEFAULT '{}'::text[],
  garment_analysis jsonb DEFAULT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add variant_id to weekly_launches (nullable for backward compat)
ALTER TABLE public.weekly_launches ADD COLUMN variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_variants
CREATE POLICY "Users can view own variants" ON public.product_variants
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products WHERE products.id = product_variants.product_id AND products.user_id = auth.uid()));

CREATE POLICY "Users can create own variants" ON public.product_variants
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.products WHERE products.id = product_variants.product_id AND products.user_id = auth.uid()));

CREATE POLICY "Users can update own variants" ON public.product_variants
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products WHERE products.id = product_variants.product_id AND products.user_id = auth.uid()));

CREATE POLICY "Users can delete own variants" ON public.product_variants
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products WHERE products.id = product_variants.product_id AND products.user_id = auth.uid()));

-- Migrate existing products: create a default variant for each product
INSERT INTO public.product_variants (product_id, color_name, uploaded_images, garment_analysis, sort_order)
SELECT id, 'Original', uploaded_images, garment_analysis, 0
FROM public.products;

-- Link existing weekly_launches to their product's default variant
UPDATE public.weekly_launches wl
SET variant_id = pv.id
FROM public.product_variants pv
WHERE pv.product_id = wl.product_id;
