
-- Collections table
CREATE TABLE public.collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  season TEXT,
  objective TEXT,
  color_tag TEXT DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own collections" ON public.collections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own collections" ON public.collections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own collections" ON public.collections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own collections" ON public.collections FOR DELETE USING (auth.uid() = user_id);

-- Products: add collection_id and product_code
ALTER TABLE public.products ADD COLUMN collection_id UUID REFERENCES public.collections(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD COLUMN product_code TEXT;

-- Weekly launches: add name and locked_proportion_json
ALTER TABLE public.weekly_launches ADD COLUMN name TEXT DEFAULT 'Lançamento';
ALTER TABLE public.weekly_launches ADD COLUMN locked_proportion_json JSONB;
ALTER TABLE public.weekly_launches ADD COLUMN total_cost_usd NUMERIC DEFAULT 0;

-- Generated images: add approval_status and generation_cost_usd
ALTER TABLE public.generated_images ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.generated_images ADD COLUMN generation_cost_usd NUMERIC DEFAULT 0;

-- User credits table
CREATE TABLE public.user_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  credits_balance NUMERIC NOT NULL DEFAULT 100,
  credits_used NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own credits" ON public.user_credits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own credits" ON public.user_credits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own credits" ON public.user_credits FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Project shares table
CREATE TABLE public.project_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  collection_id UUID REFERENCES public.collections(id) ON DELETE CASCADE,
  shared_with_email TEXT,
  permission TEXT NOT NULL DEFAULT 'view',
  token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.project_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own shares" ON public.project_shares FOR SELECT USING (
  EXISTS (SELECT 1 FROM products WHERE products.id = project_shares.product_id AND products.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM collections WHERE collections.id = project_shares.collection_id AND collections.user_id = auth.uid())
);
CREATE POLICY "Users can create own shares" ON public.project_shares FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM products WHERE products.id = project_shares.product_id AND products.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM collections WHERE collections.id = project_shares.collection_id AND collections.user_id = auth.uid())
);
CREATE POLICY "Users can delete own shares" ON public.project_shares FOR DELETE USING (
  EXISTS (SELECT 1 FROM products WHERE products.id = project_shares.product_id AND products.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM collections WHERE collections.id = project_shares.collection_id AND collections.user_id = auth.uid())
);
-- Public access via token
CREATE POLICY "Anyone can view shared via token" ON public.project_shares FOR SELECT TO anon USING (true);
