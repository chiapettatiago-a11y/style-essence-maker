
ALTER TABLE public.products
  ADD COLUMN is_combo boolean NOT NULL DEFAULT false,
  ADD COLUMN featured_piece text NULL;

ALTER TABLE public.product_variants
  ADD COLUMN combo_piece_role text NULL;
