# Refactor — phased delivery

Section 1 (database) is already applied: 5 new model profiles seeded, `folders` table created with RLS, `weekly_launches.folder_id` added.

The remaining work splits cleanly into two phases. Phase A is mechanical and low-risk; Phase B is a real UI rewrite of a 2500-line file and deserves its own deployment so I can verify each piece.

---

## Phase A — this deployment

Focused changes that don't reshape the existing UI.

**Section 2 — Seedream 5.0 engine** (`supabase/functions/generate-image/index.ts`)
- Expand `GenerationEngine` to `"seedream" | "fal" | "gemini"`.
- Add `callSeedreamEngine()` using `fal-ai/bytedance/seedream/v5/lite/{edit,text-to-image}`.
- Route engine dispatch in `runGenerationPipeline()` so `seedream` is the default branch; `fal` and `gemini` stay as-is.
- Inject the Seedream-specific `blockA` in `buildPrompt()` (Brazilian biotipo + studio white).
- Remove the face-swap block from `runGenerationPipeline()`.
- Default `parsedEngine` to `"seedream"`.
- All garment blocks (BOTTOM/TR/NO_TAGS/etc.) and the upscale + analyze functions remain untouched.

**Section 7 — defaults & labels**
- `GenerateSection.tsx`: replace `ENGINE_LABELS` with Seedream/fal/gemini entries.
- `ProjectPage.tsx`: replace literal `"gemini"` defaults with `"seedream"` (engine selection only — no layout changes here).

**Section 8 — parallel generation + polling fallback** (`ProjectPage.tsx`)
- After the front reference resolves, fire the remaining angles with `Promise.allSettled`.
- After each background invoke, start a 5s polling interval against `generated_images` and clear at 180s.

**Section 3 — `LaunchFlowModal.tsx` 3-step rewrite**
- Step 1 Fotos da peça: upload (1–6), thumbnails, green analysis row, dots `1●2○3○`, next disabled until analyzed.
- Step 2 Modelo: 5 model cards in a grid with skin-tone avatar circles (color map provided), selected state, dots `1✓2●3○`.
- Step 3 Cenário e geração: 4 background cards, folder dropdown (existing + "Nova pasta…" inline form with type pills), cost row "Seedream 5.0 · ~$0.24 · ~40s", primary "Gerar pacote completo — 6 fotos" button, dots `1✓2✓3●`.
- Voltar / Próximo footer, no X during generation.

---

## Phase B — next deployment

Full ProjectPage UI rewrite that introduces the folders model end-to-end.

**Section 4 — Sidebar**: MONOGRAMA logo + "Novo produto" dark button, product list with hanger icon + "N pastas · N lançamentos" meta, active highlight, Configurações footer. No nested launches.

**Section 5 — Main area**: header with action buttons + tabs (Lançamentos / Análise técnica / Fotos aprovadas), toolbar (Por pasta / Todos + status filter), stats row (3 metric cards), collapsible folder sections with colored type icons (week/editorial/campaign), 3-column launch card grid, empty "Novo lançamento" slot card, inline folder-creation form.

**Section 6 — Results gallery**: 2×3 photo grid with PT-BR angle labels, per-photo Aprovar / Reprovar with green/red states and Regenerar on rejection, header badges (aprovadas/gerando/pendentes), "Regenerar selecionadas" + "Baixar aprovadas HD" actions.

---

## Why split

Phase A is ~600 lines of focused edits across 3 files — testable end-to-end (generate a photo with Seedream, see polling work, open the new modal). Phase B requires re-architecting how launches are listed and grouped, including a new `folders` data layer (CRUD, queries, cache invalidation) that touches most of `ProjectPage.tsx`. Doing both at once would land 2500+ lines of churn untested.

If you'd rather I attempt everything in one pass anyway, say "tudo junto" and I'll proceed — but I recommend the split.