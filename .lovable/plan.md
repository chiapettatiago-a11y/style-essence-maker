# Painel lateral de setup — substituindo o modal

## Objetivo
Eliminar o modal de 3 steps e transformar o setup da peça em um painel lateral direito sempre visível dentro do ProjectPage. Reduzir de ~12 cliques para ~5 num fluxo típico, sem mudar a lógica de geração (botões por ângulo mantidos, análise manual mantida).

## Layout novo do ProjectPage

```text
┌─────────────────────────────────────────────────────────────┐
│ Header do projeto (breadcrumb, nome, ações)                 │
├──────────────┬──────────────────────────────┬───────────────┤
│              │                              │               │
│  Sidebar     │   Grid de imagens geradas    │  Painel de    │
│  (produtos)  │   (5 ângulos + histórico)    │  Setup        │
│              │                              │  (fixo)       │
│              │                              │               │
│              │                              │  ↕ scrollável │
└──────────────┴──────────────────────────────┴───────────────┘
```

Painel de setup (direita, ~380px, sticky):
- **Seção 1 — Peça** (sempre expandida)
  - Upload thumbnail + botão "Analisar" (manual, como pediu)
  - Chips resumo: tipo · tecido · cor (do resultado do Claude)
  - Link "Editar análise" → abre accordion com todos os campos
- **Seção 2 — Modelo** (accordion, recolhida após 1ª escolha)
  - Avatar do modelo selecionado + nome
  - Botão "Trocar" abre o `ModelGallery` inline
- **Seção 3 — Estilo & cenário** (accordion)
  - Chips de acessórios + preset de cenário
- **Seção 4 — Motor** (compacto, mostra badge "travado" quando fixado)
- **Seção 5 — Gerar** (sticky no rodapé do painel)
  - 5 botões por ângulo (frontal, lateral, costas, detalhe, movimento) — mantidos como estão
  - Ângulos não-frontais desabilitados até aprovar frontal (regra atual mantida)
  - Prompt manual como textarea colapsável abaixo

## Mudanças de código

**Novo:** `src/components/studio/SetupPanel.tsx`
- Recebe todas as props que hoje vão pro `LaunchFlowModal`
- Renderiza as 5 seções usando `Collapsible` do shadcn
- Reusa componentes existentes: `UploadSection` (versão compacta), `ModelGallery`, `AccessoriesSelector`, `EngineSelector`, `GenerateSection`

**Editado:** `src/pages/ProjectPage.tsx`
- Remover import e uso de `LaunchFlowModal`
- Adicionar `<SetupPanel>` como coluna direita fixa no layout principal
- Remover state `launchFlowOpen` / `launchStartStep`
- Botão "Novo lançamento" no header vira "Nova peça" e apenas limpa o state do painel (não abre modal)

**Deletado:** `src/components/studio/LaunchFlowModal.tsx`

**Não muda:**
- `GenerateSection.tsx` (5 botões por ângulo permanecem)
- `UploadSection.tsx` (botão "Analisar" manual permanece)
- Toda a lógica de seed lock, engine lock, aprovação de frontal, edge functions
- `PromptAndRefsEditor` continua funcionando por imagem gerada

## Responsivo
- ≥1280px: 3 colunas (sidebar · grid · painel)
- 1024-1279px: painel vira drawer lateral acionável por botão "Setup"
- <1024px: painel vira sheet bottom (reusa `Sheet` do shadcn)

## Ganho de cliques
| Ação | Antes | Depois |
|---|---|---|
| Abrir setup | 1 (botão modal) | 0 (sempre visível) |
| Navegar steps | 2 (Próximo × 2) | 0 |
| Fechar modal pra ver grid | 1 | 0 |
| Reabrir pra trocar modelo | 3 | 1 |

## Fora de escopo
- Auto-análise no upload (você quis manter manual)
- Botão "gerar lookbook completo" (você quis manter separado por ângulo)
- Mudanças em edge functions ou schema
