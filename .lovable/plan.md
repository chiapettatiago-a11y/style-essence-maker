

## Ajuste de Resolução: Portrait 1080×1920

O usuário quer formato **portrait** (vertical) em vez de landscape: **1080px de largura × 1920px de altura** (9:16).

### Alterações necessárias

**Arquivo: `src/data/prompt-layers.ts`**
- `LAYER1_BASE` (linha 4): Trocar `1920x1080 resolution (16:9 aspect ratio)` por `1080x1920 resolution (9:16 portrait aspect ratio)` e ajustar a referência `within 16:9 composition` para `within 9:16 portrait composition`
- `LAYER1_VIDEO_BASE` (linha 14): Trocar `1920x1080 resolution (16:9)` por `1080x1920 resolution (9:16 portrait)`

**Arquivo: `src/data/prompt-builder.ts`**
- Nenhuma mudança estrutural necessária — as strings de resolução vêm da Camada 1

Apenas duas strings de texto precisam ser atualizadas para refletir a orientação vertical correta.
