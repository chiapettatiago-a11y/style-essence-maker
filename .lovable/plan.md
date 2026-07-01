# Plano: Consistência de Modelo + Fluxo Simplificado

Duas frentes de trabalho que tocam banco, edge function de geração e UI da página do produto.

---

## Parte A — Consistência de modelo entre shots

### A1. Seed fixo por produto
- **Migration**: adicionar `generation_seed bigint` em `products` (nullable).
- Ao iniciar a geração do **primeiro shot** de um produto, se `generation_seed` for null, gerar um inteiro aleatório (`Math.floor(Math.random()*2_000_000_000)`) e persistir.
- Frontend envia `seed` no payload de `generate-image`. Edge function repassa para o Gemini (`generationConfig.seed`) e demais engines que suportarem.

### A2. Engine travada por sessão
- **Migration**: adicionar `locked_engine text` em `products`.
- Ao gerar o frontal, gravar a engine escolhida em `locked_engine`. Próximos shots usam essa engine; o seletor no UI fica desabilitado com badge "🔒 Travada para consistência".
- No edge function, remover o auto-fallback por timeout/crédito. Só faz fallback em erro 5xx/auth real.

### A3. Frontal obrigatório antes dos demais
- **Migration**: adicionar `model_reference_image text` em `products`.
- Tipo `GeneratedImage.approval_status` já existe ('pending'|'approved'|'rejected'). Botões de gerar lateral/costas/close ficam `disabled` enquanto não houver pelo menos um shot frontal com `approval_status='approved'`. Tooltip + texto inline: "Gere e aprove o frontal antes de continuar."

### A4. Referência de modelo via imagem
- Ao aprovar (✓) um shot frontal, atualizar `products.model_reference_image` com a `image_url` desse shot.
- Frontend inclui essa URL em `referenceImages` no payload dos shots não-frontais (em primeiro lugar do array). Edge function já aceita `referenceImages[]`.

### A5. Indicador visual de consistência
- Em `PhotoViewer`/`ResultsGrid`, cada shot mostra um badge:
  - ✅ verde "Consistente" quando `model_used == locked_engine` **e** `seed_used == generation_seed`.
  - ⚠️ amarelo "Reger. recomendada" caso contrário, com tooltip mostrando a divergência.
- **Migration**: adicionar `seed_used bigint` em `generated_images` (já tem `model_used`).

---

## Parte B — Simplificação do fluxo

### B1. Remover aba Vídeos
- Excluir `src/components/studio/VeoVideoSection.tsx`.
- Remover import e tab "Vídeos" de `ProjectPage.tsx`.
- Manter: Fotos, Análise técnica, Configurações.
- **Não** removo a edge function `generate-video` nesse passo (apenas UI). Posso remover depois se confirmado.

### B2. Etapa única — sem wizard bloqueado
- Na aba **Fotos** o prompt e as imagens de referência ficam sempre acessíveis, independente de já ter gerado ou não.
- Eliminar qualquer guard que esconda o prompt/imagens após a primeira geração.

### B3 + B4. Layout da edição (colapsáveis no topo da aba Fotos)
- Adicionar 2 `<Collapsible>` acima do grid de fotos:
  1. **📝 Prompt** — `Textarea` com prompt atual + botão "Salvar e Regenerar".
  2. **🖼️ Imagens de referência** — thumbs com botão remover + uploader + botão "Salvar e Regenerar".
- Edição persiste no banco (`products.manual_prompt` e `products.uploaded_images`/`product_variants.uploaded_images`).

### B5. Proteção de shots aprovados
- Ao clicar "Salvar e Regenerar", abre `AlertDialog`:
  - "Regerar **todos** os shots" 
  - "Regerar **apenas os não aprovados**" (default)
- Shots com `approval_status='approved'` só são regerados na opção 1.

---

## Detalhes técnicos

**Migrations SQL**
```sql
ALTER TABLE products
  ADD COLUMN generation_seed bigint,
  ADD COLUMN locked_engine text,
  ADD COLUMN model_reference_image text;

ALTER TABLE generated_images
  ADD COLUMN seed_used bigint;
```

**Arquivos tocados**
- `supabase/functions/generate-image/index.ts` — aceitar `seed`, repassar a Gemini, remover auto-fallback.
- `src/pages/ProjectPage.tsx` — remover tab Vídeos, orquestrar lock de engine, seed, model_reference, fluxo de aprovação do frontal.
- `src/components/studio/GenerateSection.tsx` (ou equivalente da aba Fotos) — colapsáveis Prompt + Referências, botão Salvar e Regenerar com diálogo de confirmação, disable de ângulos não-frontais.
- `src/components/studio/PhotoViewer.tsx` + `ResultsGrid.tsx` — badge de consistência.
- `src/components/studio/EngineSelector.tsx` — estado disabled + badge "Travada".
- Deletar `src/components/studio/VeoVideoSection.tsx`.

**Fora de escopo**
- Não vou alterar o `generate-video` nem outros wizards (`Index.tsx`).
- Não vou mexer em billing/credits além do que já é gravado.

Confirme para eu seguir — começo pelas migrations.
