

## Integrar Vídeos de Demonstração na Seção de Resultados

### O que será feito

Na seção de **Video Prompts** do `ResultsStep`, ao lado do prompt copiável, exibir o vídeo de demonstração correspondente (`demo-video-360-model.mp4` ou `demo-video-360-product.mp4`) como preview visual de referência.

### Alterações

**`src/components/fashion/ResultsStep.tsx`**
- Importar os dois vídeos de demo (`demo-video-360-model.mp4` e `demo-video-360-product.mp4`)
- Na seção de video prompts, adicionar um `<video>` player (muted, loop, controls) acima do prompt de texto
- Mapear o tipo `video-model` → vídeo de modelo, `video-product` → vídeo de produto
- Atualizar o subtítulo para mencionar que há vídeos de exemplo disponíveis

Layout: vídeo em aspect-ratio 9:16 (portrait) com max-height contido, seguido do prompt copiável abaixo.

