
-- Create products table (one per garment/product)
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  garment_analysis JSONB,
  model_profile JSONB,
  selected_presets JSONB DEFAULT '{}'::jsonb,
  manual_prompt TEXT DEFAULT '',
  uploaded_images TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create weekly_launches table
CREATE TABLE public.weekly_launches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create generated_images table
CREATE TABLE public.generated_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  launch_id UUID NOT NULL REFERENCES public.weekly_launches(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  prompt TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_launches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;

-- Products policies
CREATE POLICY "Users can view own products" ON public.products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own products" ON public.products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own products" ON public.products FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own products" ON public.products FOR DELETE USING (auth.uid() = user_id);

-- Weekly launches policies (via product ownership)
CREATE POLICY "Users can view own launches" ON public.weekly_launches FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.products WHERE products.id = weekly_launches.product_id AND products.user_id = auth.uid()));
CREATE POLICY "Users can create own launches" ON public.weekly_launches FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.products WHERE products.id = weekly_launches.product_id AND products.user_id = auth.uid()));
CREATE POLICY "Users can update own launches" ON public.weekly_launches FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.products WHERE products.id = weekly_launches.product_id AND products.user_id = auth.uid()));
CREATE POLICY "Users can delete own launches" ON public.weekly_launches FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.products WHERE products.id = weekly_launches.product_id AND products.user_id = auth.uid()));

-- Generated images policies (via launch -> product ownership)
CREATE POLICY "Users can view own images" ON public.generated_images FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.weekly_launches wl
    JOIN public.products p ON p.id = wl.product_id
    WHERE wl.id = generated_images.launch_id AND p.user_id = auth.uid()
  ));
CREATE POLICY "Users can create own images" ON public.generated_images FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.weekly_launches wl
    JOIN public.products p ON p.id = wl.product_id
    WHERE wl.id = generated_images.launch_id AND p.user_id = auth.uid()
  ));
CREATE POLICY "Users can update own images" ON public.generated_images FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.weekly_launches wl
    JOIN public.products p ON p.id = wl.product_id
    WHERE wl.id = generated_images.launch_id AND p.user_id = auth.uid()
  ));
CREATE POLICY "Users can delete own images" ON public.generated_images FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.weekly_launches wl
    JOIN public.products p ON p.id = wl.product_id
    WHERE wl.id = generated_images.launch_id AND p.user_id = auth.uid()
  ));

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
