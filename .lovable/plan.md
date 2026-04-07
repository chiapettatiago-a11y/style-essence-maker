
# Plano de Implementação — Melhorias v2

## Fase 1: Database Migrations (precisa rodar primeiro)
- `collections` table (id, user_id, name, description, season, objective, color_tag, created_at)
- `products.collection_id` (nullable FK)
- `products.product_code` text
- `weekly_launches.name` text (default "Lançamento {N}")
- `weekly_launches.locked_proportion_json` jsonb
- `generated_images.approval_status` text (default 'pending')
- `generated_images.generation_cost_usd` decimal
- `weekly_launches.total_cost_usd` decimal
- `user_credits` table (user_id, credits_balance, credits_used, updated_at)
- `project_shares` table (id, product_id, collection_id, shared_with_email, permission, token, created_at, expires_at)

## Fase 2: Upscaler → Download Only
- Remover upscale do pipeline de geração (NÃO tocar na Edge Function generate-image)
- No front-end: chamar fal-ai/clarity-upscaler apenas no momento do download
- Loading "Preparando em alta resolução..."
- Criar edge function `upscale-on-download` separada

## Fase 3: Approval Flow
- Botões ✅ Aprovar / ↺ Regenerar em cada card
- Bordas visuais por status (pending/approved/rejected)
- Counter "4/6 aprovadas" no header
- ZIP apenas fotos aprovadas

## Fase 4: Homepage Collections
- Grid de coleções na homepage
- CRUD de coleções (modal criar/editar)
- Sort por Nome/Data/Objetivo
- Breadcrumb dentro da coleção
- "Sem coleção" group

## Fase 5: Editable Product Cards + Launch Name
- Inline edit no nome/código do produto
- Inline edit no nome do lançamento
- Garment lock (snapshot proportion_json)

## Fase 6: Photo Viewer Redesign
- Fullscreen overlay com toolbar fixo
- Navegação por setas (mouse + teclado)
- Thumbnail strip
- Drawer lateral para Regenerar/Trocar modelo/Cenário/Engine

## Fase 7: Veo 3 Video Generation
- Nova edge function `generate-video-veo`
- Modal de configuração (tipo, duração)
- Progress bar + player inline
- Requer GOOGLE_CLOUD_PROJECT_ID secret

## Fase 8: Cost Tracking + Credits
- Registrar custo por geração
- Badge de custo no lançamento
- Sistema de créditos no sidebar
- Alerta de saldo baixo

## Fase 9: User Profile + Sharing
- Rota /perfil com avatar, créditos, gráfico
- Compartilhamento por link/email
- Rota pública /share/{token}
- "Compartilhado comigo" na homepage

## Fase 10: Rate Limit Timer
- Cooldown visual entre gerações
- Timer countdown no botão

---

**Ordem sugerida**: Fase 1 → 2 → 3 → 5 → 4 → 6 → 10 → 7 → 8 → 9

⚠️ Nenhuma alteração em: generate-image, analyze-product, prompt construction, engine routing, FAL/Google key usage, storage paths, LoRA logic.
