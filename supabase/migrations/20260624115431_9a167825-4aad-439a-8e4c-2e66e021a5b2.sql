
DELETE FROM public.model_profiles;

INSERT INTO public.model_profiles
  (slug, display_name, skin_tone, hair_description, facial_features, height_cm, bust_cm, waist_cm, hip_cm, prompt_seed)
VALUES
('paulistana-urbana', 'Paulistana Urbana',
 'morena clara', 'liso escuro castanho escuro',
 'Morena clara, cabelo liso, estilo cosmopolita',
 173, 86, 62, 92,
 'Brazilian latina woman, warm light morena skin tone, straight dark brown hair with natural shine, defined cheekbones, dark almond eyes, full lips, light bronze undertone. NOT Asian features. NOT pale European skin. São Paulo cosmopolitan beauty, age 26-30. Height 1.73m.'),
('gaucha-serrana', 'Gaúcha Serrana',
 'clara rosada', 'liso claro castanho claro',
 'Pele clara-rosada, traços europeus, Sul do Brasil',
 172, 84, 62, 90,
 'Brazilian woman from Rio Grande do Sul, light rosy skin with warm undertone, long straight light brown hair, light hazel or green eyes, defined European features, naturally pink cheeks. South Brazilian beauty, age 28-34. Height 1.72m.'),
('baiana-solar', 'Baiana Solar',
 'negra luminosa', 'afro natural preto',
 'Pele negra luminosa, beleza afro-brasileira',
 170, 88, 66, 96,
 'Black Brazilian woman, rich luminous dark skin with warm golden undertone, natural afro or coily hair, strong defined features, full lips, expressive dark eyes, authentic Afro-Brazilian beauty. NOT African features — Brazilian. Age 24-32. Height 1.70m.'),
('indigena-contemporanea', 'Indígena Contemporânea',
 'morena dourada', 'liso preto',
 'Morena dourada, traços indígenas, beleza nativa',
 168, 86, 64, 92,
 'Brazilian woman with indigenous heritage, warm golden brown skin, straight jet black hair, strong native facial features, high cheekbones, dark deep-set eyes, natural beauty. Contemporary indigenous Brazilian, age 25-33. Height 1.68m.'),
('mineira-classica', 'Mineira Clássica',
 'morena média', 'ondulado escuro castanho escuro',
 'Morena média, cabelo ondulado, elegância natural',
 171, 87, 64, 94,
 'Brazilian woman from Minas Gerais, medium warm morena skin, wavy dark brown hair with natural volume, warm brown eyes, soft defined features, natural classic elegance. Minas Gerais beauty, age 30-38. Height 1.71m.');

CREATE TABLE IF NOT EXISTS public.folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  folder_type TEXT NOT NULL DEFAULT 'week' CHECK (folder_type IN ('week','editorial','campaign')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.folders TO authenticated;
GRANT ALL ON public.folders TO service_role;

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own folders" ON public.folders;
CREATE POLICY "Users manage own folders" ON public.folders
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_folders_updated_at ON public.folders;
CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.weekly_launches
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL;
