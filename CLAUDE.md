# CLAUDE.md — Painel Social Media (React + Cloudflare)
**Digital Scale · Agência de Marketing Digital**

---

## Visão Geral

Painel operacional para a funcionária de Social Media da Digital Scale gerenciar 17 clientes, agendamentos, status de publicação e links de conteúdo.

**Stack:**
- Frontend: React 18 + TypeScript + Vite + MUI v6
- Backend: Cloudflare Pages Functions (Workers)
- Banco: Cloudflare D1 (SQLite no edge)
- Deploy: GitHub → Cloudflare Pages (auto-deploy no push)

---

## Estrutura do Projeto

```
├── src/
│   ├── App.tsx              # Root — ThemeProvider, navegação inferior, header
│   ├── main.tsx             # ReactDOM entry
│   ├── theme.ts             # MUI theme (dark, primary #ff9039, secondary #ff5339)
│   ├── types.ts             # ContentItem, ItemState, Client, Status (0-3)
│   ├── data.ts              # CLIENTS[] e DATA[] (conteúdo do mês)
│   └── components/
│       ├── ContentCard.tsx  # Card expansível com status, link, legenda, notas
│       ├── StatusChip.tsx   # Chip clicável (cicla status 0→1→2→3→0)
│       ├── TodayTab.tsx     # Aba Hoje: atrasados + publicar hoje + copiar resumo
│       ├── AgendaTab.tsx    # Aba Agenda: próximos 7/15 dias agrupados por data
│       ├── CalendarTab.tsx  # Aba Calendário: visão mensal com barras de progresso
│       └── ClientsTab.tsx   # Aba Clientes: cards com progresso Posts/Reels + links Drive
├── functions/
│   └── api/
│       ├── items.ts         # Pages Function: GET (ler) / POST (salvar) itens no D1
│       └── schema.sql       # DDL do banco D1
├── index.html
├── vite.config.ts           # Proxy /api → localhost:8787 em dev
├── wrangler.toml            # Config Cloudflare Pages + D1 binding
├── tsconfig.json
└── package.json
```

---

## Sistema de Status

| Valor | Label | Cor MUI |
|---|---|---|
| 0 | Pendente | default (outlined) |
| 1 | Em edição | warning |
| 2 | Aprovado | info |
| 3 | Publicado | success |

Clique no `StatusChip` para avançar para o próximo status (ciclo).

---

## Tema MUI

```typescript
// src/theme.ts
palette: {
  mode: 'dark',
  primary:    { main: '#ff9039' },   // laranja
  secondary:  { main: '#ff5339' },   // vermelho-laranja
  background: { default: '#0d0d0d', paper: '#161616' },
  success:    { main: '#00C47A' },
  warning:    { main: '#FFD700' },
  error:      { main: '#FF4545' },
  info:       { main: '#3B8EFF' },
}
```

---

## Persistência de Dados

**Dupla camada:**
1. `localStorage` — funciona offline, carrega instantâneo
2. Cloudflare D1 via `POST /api/items` — sincroniza em background a cada mudança

**Carregamento inicial:** `App.tsx` lê `localStorage` no estado inicial. Futuro: carregar D1 no mount e sobrescrever.

---

## API Cloudflare (functions/api/items.ts)

| Método | Path | Descrição |
|---|---|---|
| GET | /api/items | Retorna todos os itens salvos no D1 |
| POST | /api/items | Upsert de um item (id + status + link + caption + notes) |

**D1 schema:** `functions/api/schema.sql`

---

## Como Atualizar para Novo Mês

1. Abrir `src/data.ts`
2. Alterar `BASE_DATE` para o 1º dia do novo mês
3. Substituir o array `DATA` pelos novos conteúdos
4. `CLIENTS` só precisa de alteração se houver mudança de clientes

---

## Setup Inicial (Cloudflare)

```bash
# 1. Criar banco D1
npx wrangler d1 create social-media-db

# 2. Copiar o database_id retornado para wrangler.toml

# 3. Aplicar schema
npx wrangler d1 execute social-media-db --file=functions/api/schema.sql

# 4. Conectar GitHub no Cloudflare Pages dashboard
#    Build command: npm run build
#    Output dir: dist
#    Bind D1 database em Settings > Functions > D1 Database Bindings
```

## Desenvolvimento Local

```bash
npm install
npm run dev          # Vite em :5173
# Em outro terminal:
npx wrangler pages dev dist --d1 DB=social-media-db  # Worker em :8787
```

---

## Clientes Ativos (Maio 2026)

17 clientes · 224 conteúdos no mês

Casa de Ração 2 Irmãos · Chalés Alto da Represa · Frango d'Água · Garden Eventos · Hidro Elétrica Andrade · Home Elevadores · Kátia Bigatello · Lareiras Grill · LuzioPan · Magia dos Temáticos · Padaria R.A · Pousada Dukuka · Quero Bolo · Rest. Lambari · Suh Maya · ViniPlas · Rosângela Varas

---

## Próximos Passos

- [ ] Carregar estado inicial do D1 no mount (sobrescreve localStorage)
- [ ] Painel do Editor de Vídeo
- [ ] Painel do Gestor de Tráfego
- [ ] Dashboard executivo (visão geral Kaique)
- [ ] Notificação push às 7h
- [ ] Atualização automática mensal via script
