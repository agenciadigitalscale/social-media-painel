Mostre um diagnóstico completo e rápido do estado atual do DS HUB.

## O que verificar e reportar:

### 📦 Código
- Branch atual e último commit
- Arquivos com mudanças não comitadas
- Há algo pendente de push?

### 🗓️ Dados
- Quais meses estão no `src/data.ts`? (DATA, DATA_JUNHO, DATA_JULHO...)
- Total de clientes em `CLIENTS[]`
- Total de itens de conteúdo em cada mês
- Próximo mês que precisa ser gerado?

### 🏗️ Build
- Rode `npm run build` rápido e reporte: ✅ limpo ou ❌ erros (liste-os)

### 🔌 Infraestrutura
- `wrangler.toml` existe e tem o database_id configurado?
- Functions em `functions/api/`: liste os endpoints disponíveis
- Service Worker em `public/sw.js` existe?

### 📋 Próximas tarefas (do CLAUDE.md)
Liste os itens do `## Próximos Passos` do CLAUDE.md ainda não implementados.

## Formato de saída:

```
DS HUB — Status Report
━━━━━━━━━━━━━━━━━━━━━
📦 Git: branch main, X commits à frente/atrás
🗓️ Dados: Mai/Jun/Jul 2026 — 678 itens — 17 clientes
🏗️ Build: ✅ limpo
🔌 APIs: /sync /portal /ai /role-auth /stream
📋 Pendente: [lista do CLAUDE.md]
━━━━━━━━━━━━━━━━━━━━━
```

Seja conciso. Termine com a recomendação mais urgente do que fazer a seguir.
