Gere os dados de conteúdo para um novo mês no DS HUB.

## Como usar:
`/gerar-mes Agosto 2026` ou apenas `/gerar-mes` (usa o próximo mês automaticamente)

## O que fazer:

1. **Identificar o mês alvo** — se não informado, calcule o próximo mês após o último existente em `src/data.ts`

2. **Calcular o range de IDs**:
   - Jan=0, Fev=1, Mar=2, Abr=3, Mai=4, Jun=5, Jul=6, Ago=7, Set=8, Out=9, Nov=10, Dez=11
   - ID base = `(mêsIndex - 4) * 1000 + 1` (Maio=1, Junho=1001, Julho=2001, Agosto=3001...)
   - Gerar IDs de base até base+225 (226 itens)

3. **Replicar a estrutura do mês anterior** — mesmos clientes, mesma distribuição proporcional de posts/reels/stories, datas redistribuídas para o novo mês

4. **Exportar como constante** no padrão do projeto:
   ```typescript
   // ── Agosto 2026 — IDs 3001-3226 ─────────────────────────────────
   const d8 = (day: number) => new Date(2026, 7, day)
   export const DATA_AGOSTO: ContentItem[] = [ ... ]
   ```

5. **Atualizar `src/App.tsx`**:
   - Importar a nova constante em `import { DATA, DATA_JULHO, DATA_AGOSTO, CLIENTS } from './data'`
   - Adicionar ao `allItems`: `[...DATA, ...DATA_JULHO, ...DATA_AGOSTO, ...customItems]`

6. **Atualizar `src/data.ts`** com a nova exportação

## Regras:
- Distribuir datas nos dias úteis do mês (segunda a sábado)
- Manter proporção posts/reels por cliente conforme `CLIENTS[]`
- Todos os novos itens começam com `s: 0` (Pendente)
- Não duplicar IDs existentes

Mostre um resumo: X itens gerados para Y clientes, período MM/AAAA.
