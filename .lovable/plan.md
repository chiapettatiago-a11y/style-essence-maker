

## Atualização: Sistema de 3 Camadas de Prompt

### Arquitetura de Prompt em 3 Camadas

**🔒 Camada 1 — Base Técnica Travada (inalterável)**
Bloco fixo incluído automaticamente em todo prompt gerado. O usuário pode visualizar mas não editar. Contém:
- Resolução 1920×1080, 16:9, ultra HD
- Regras de fidelidade ao design original (não alterar, preservar padrões, proporções, transparências)
- Regras de composição (full body, sem crop, centralizado no frame)
- Regras de qualidade (sem distorção, sem compressão, realismo têxtil máximo)
- Iluminação difusa com profundidade de sombra para textura
- Exibido em bloco colapsável com ícone de cadeado

**🎛 Camada 2 — Biblioteca de Estilos**
Cards selecionáveis organizados por categoria:
- **Modelo**: presets de etnia/biotipo (ex: "Brasileira Natural", "Nórdica Editorial")
- **Pose**: presets de estilo (ex: "Orgânica Relaxada", "Editorial Dinâmica", "Comercial Clássica")
- **Cenário**: presets de fundo (ex: "Estúdio Neutro Bege", "Urbano Contemporâneo", "Natureza Suave")
- **Estética**: presets de mood (ex: "Luxury Lookbook", "Streetwear Campaign", "Resort Editorial")
- **Câmera/Vídeo**: presets de movimento (ex: "360° Gracioso 15s", "Dolly-in Close Detail")
- Cada preset injeta um bloco de texto pré-definido no prompt final
- Usuário pode selecionar um de cada categoria

**✏️ Camada 3 — Ajuste Manual**
- Campo de texto livre opcional onde o usuário pode adicionar instruções extras
- Inserido no final do prompt, após as duas camadas anteriores
- Placeholder com exemplos: "Adicionar vento suave no cabelo", "Foco extra no detalhe da gola"

### Preview do Prompt Final
- Seção que mostra o prompt completo montado (Base + Estilo + Manual) antes de gerar
- Camada 1 em cinza (travada), Camada 2 em azul (selecionada), Camada 3 em verde (manual)
- Botão de copiar prompt completo

### Prompt Templates
Os dois exemplos fornecidos pelo usuário (lookbook photo + vídeo cinematic) serão decompostos e distribuídos nas camadas como templates padrão da biblioteca.

### Fluxo Atualizado (Etapa 3.5 — entre Pose e Geração)
Nova sub-etapa no wizard: **"Revisar Prompts"** onde o usuário vê o prompt montado para cada imagem/vídeo do pacote, pode ajustar a Camada 3, e confirmar antes de gerar.

