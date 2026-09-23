# Onda 1 — Isolamento de dados (multi-tenant real)

Objetivo: cada dado passa a pertencer a um **workspace** (agência). A Digital Scale
vira o workspace nº 1 e continua funcionando **sem regressão**. Dois tenants nunca
se enxergam.

Princípio que torna tudo seguro: **o tenant nº 1 fica SEM prefixo de chave**. Os
~858 KB já gravados (`sm_states`, `sm_custom`, …) continuam válidos sem migração de
linha — só tenants novos ganham `ws:<id>:` na frente (`scopedKey` em
`_lib/workspace.ts`).

## Sub-ondas

### 1a — Fundação INERTE ✅ FEITO (2026-09-23)
- `_lib/workspace.ts`: `DEFAULT_WORKSPACE`, `normalizeWorkspaceId`, `resolveWorkspace`, `scopedKey`.
- Tabela `workspaces` (schema.sql + migração), Digital Scale semeada como `owner`.
- 11 testes. Nada chama o resolvedor ainda → **zero mudança de comportamento**.

### 1b — `/api/sync` passa a escopar por workspace  ✅ FEITO (2026-09-23)
- GET (chave única, `since`, tudo) e POST (patch, value/baseRev) usam
  `scopedKey(ws, key)`; o bulk filtra por prefixo e devolve a chave DESescopada.
- Digital Scale (default) → chave sem prefixo → **idêntico a hoje** (não existe
  chave `ws:%` no banco, então o `NOT LIKE 'ws:%'` devolve as mesmas linhas).
- Reconciliação de 3 vias INTACTA — o prefixo entra antes da chave, não toca o merge.
- 3 testes de isolamento pelo handler real (`sync-workspace.test.ts`) + os 11 da
  fundação. Suíte: 679 verdes · typecheck 0 · build ok.

### 1c — Rotas públicas e Functions restantes
- `catalog.ts`, `portal.ts`, `review.ts`, `creative-set.ts`, `drive-*`: escopar o
  dado lido por workspace. O token do cliente/revisão passa a resolver o workspace.
- Aqui o cuidado é o `catalog.ts` importar `src/data.ts` (dado semeado da Digital
  Scale) — vira dado por workspace ou fica só para o nº 1.

### 1d — Sessão carrega o workspace
- `issueSession` grava `email:workspace:expiry`; `resolveWorkspace` passa a ler da
  sessão (não só do cabeçalho/cookie). Ponte para a Onda 2 (contas).

## Fora do escopo da Onda 1 (vem depois)
- Contas por pessoa e ligar `PANEL/SYNC_REQUIRE_AUTH` → **Onda 2**
- Marca por workspace (logo/cores do banco) → **Onda 3**
- Cobrança, landing, LGPD → Ondas 4–6

## Regra de ouro
Cada sub-onda: typecheck + build + testes verdes, e a Digital Scale funcionando
igual. Se uma sub-onda não puder ser provada sem quebrar o painel, ela para e vira
plano antes de código.
