Você vai cadastrar um novo cliente no DS HUB da Digital Scale.

Pergunte as informações necessárias se não foram fornecidas, depois execute tudo automaticamente:

## Dados necessários:
- **Nome do cliente** (ex: "Restaurante Silva")
- **Posts por mês** (padrão: 12)
- **Reels por mês** (padrão: 4)
- **WhatsApp** (opcional, formato: 5511999999999)
- **Cor personalizada** (opcional, hex — se não informado usa padrão)
- **Link do Google Drive** (opcional)

## O que fazer automaticamente:

1. **Adicionar em `src/data.ts`** — cliente no array `CLIENTS[]` com os campos:
   ```typescript
   { name: 'Nome do Cliente', postsPerMonth: X, reelsPerMonth: X, storiesPerMonth: 0 }
   ```

2. **Gerar conteúdos do mês atual** — criar entradas no `DATA[]` ou `DATA_JULHO[]` (dependendo do mês atual) para o cliente seguindo o padrão de IDs do projeto:
   - Maio: 1-226
   - Junho: 1001-1226
   - Julho: 2001-2226
   - Usar IDs acima do último existente

3. **Verificar** se o cliente já existe antes de adicionar (evitar duplicata)

4. **Mostrar resumo** do que foi criado

## Regras do projeto:
- Nome exatamente como será usado em todo o painel (case-sensitive nas buscas)
- Distribuir datas de publicação uniformemente ao longo do mês
- Alternar tipos: Post, Reel, Story conforme os limites mensais
- Nunca usar ID já existente

Após confirmar os dados, execute as mudanças nos arquivos e mostre um resumo do que foi adicionado.
