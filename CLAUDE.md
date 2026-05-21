# CLAUDE.md — DS HUB (React + Cloudflare)
**Digital Scale · Agência de Marketing Digital**

---

## Visão Geral

Painel operacional completo (**DS HUB**) para a equipe da Digital Scale gerenciar 17 clientes de social media, incluindo agendamentos, status de publicação, links de conteúdo, portal do cliente, integração com IA, gestão financeira, campanhas pagas, design e gravações.

**Stack:**
- Frontend: React 18 + TypeScript + Vite + MUI v6
- Backend: Cloudflare Pages Functions (Workers)
- Banco: Cloudflare D1 (SQLite no edge)
- Deploy: GitHub → Cloudflare Pages (auto-deploy no push)
- Roteamento: React Router DOM v6
- PWA: Service Worker em `/public/sw.js` — offline + push notifications 7h

---

## Estrutura do Projeto

```
├── src/
│   ├── App.tsx                    # Root — estado global, navegação, sync, push notifications
│   ├── main.tsx                   # Entry point com React Router (3 rotas)
│   ├── theme.ts                   # MUI v6 dark theme com glassmorphism
│   ├── types.ts                   # Todos os tipos TypeScript do projeto
│   ├── data.ts                    # CLIENTS[] (17) e DATA[] (226 itens — junho 2026)
│   ├── lib/
│   │   ├── storage.ts             # localStorage + syncToCloud() + SYNC_KEYS
│   │   ├── users.ts               # NAME_MAP: 8 membros da equipe com role/emoji/color
│   │   ├── distribution.ts        # Distribuição de roteiros por dia útil
│   │   └── whatsapp.ts            # Links de aprovação e mensagens WhatsApp
│   └── components/
│       ├── ContentCard.tsx        # Card expansível: status, link, legenda, notas, histórico
│       ├── StatusChip.tsx         # Chip clicável com menu popover de status
│       ├── TodayTab.tsx           # Aba Hoje: atrasados + publicar hoje + resumo
│       ├── AgendaTab.tsx          # Aba Agenda: próximos 7/15 dias agrupados por data
│       ├── KanbanTab.tsx          # Aba Kanban: arrastar entre colunas + atribuição de responsável
│       ├── CalendarTab.tsx        # Aba Calendário: visão mensal com drag-to-reschedule
│       ├── ClientsTab.tsx         # Aba Clientes: progresso Posts/Reels, Drive, roteiros
│       ├── KaiqueTab.tsx          # Dashboard executivo (KPIs, 3 colunas em 4K)
│       ├── TimelineTab.tsx        # Aba Timeline: visão cronológica (hidden)
│       ├── RecordingCenter.tsx    # Central de gravações de vídeo
│       ├── EditorMode.tsx         # Aba Editor: painel do editor de vídeo (Kaique)
│       ├── FinanceiroTab.tsx      # Aba Financeiro: gestão de mensalidades + auto-overdue
│       ├── EquipeTab.tsx          # Aba Equipe: visão por membro do time
│       ├── IATab.tsx              # Aba IA: agente de IA para operações em massa
│       ├── RoteirosIdeaTab.tsx    # Aba Roteiros: Central da Geovana+Kerges, ideias IA por cliente
│       ├── TrafegoTab.tsx         # Aba Tráfego: campanhas pagas (Arthur+Robson), KPIs, budget
│       ├── DesignTab.tsx          # Aba Design: Kanban do Jhones — criativos por urgência
│       ├── ClientPortal.tsx       # Portal público de feedback do cliente
│       ├── CreativeViewer.tsx     # Visualizador de criativo (rota pública /c/token/id)
│       ├── AIAgent.tsx            # Agente de IA para operações em massa
│       ├── ScaleAI.tsx            # Modal de chat multi-turn com contexto
│       ├── RoteirosModal.tsx      # Modal de roteiros e distribuição de conteúdo
│       ├── ClientFocusModal.tsx   # Modal de foco em um único cliente
│       ├── MonthlyReportModal.tsx # Geração de relatório mensal (imagem/PDF)
│       ├── PresentationMode.tsx   # Modo apresentação fullscreen
│       ├── PublishChecklist.tsx   # Checklist pré-publicação
│       ├── EditItemDialog.tsx     # Dialog de edição de metadados de item
│       ├── ClientAvatar.tsx       # Avatar do cliente com cor personalizada
│       ├── Logo.tsx               # Logo animado com efeito de fumaça
│       ├── SplashScreen.tsx       # Tela de carregamento inicial
│       └── HintCard.tsx           # Card de dica contextual
├── functions/
│   └── api/
│       ├── items.ts               # GET/POST itens no D1 (persistência por item)
│       ├── sync.ts                # GET/POST sync de estado geral (key-value no D1)
│       ├── portal.ts              # Portal do cliente: tokens, feedback, aprovação
│       ├── ai.ts                  # Proxy para Gemini 2.0 Flash (chat multi-turn)
│       ├── stream.ts              # Proxy de streaming de vídeo do Google Drive
│       ├── drive.ts               # Integração Google Drive
│       └── schema.sql             # DDL do banco D1
├── functions/c/[token]/
│   └── [itemId].ts                # Rota dinâmica do portal do cliente
├── public/
│   ├── sw.js                      # Service Worker: cache + push notifications 7h
│   └── ...                        # Outros assets estáticos
├── index.html
├── vite.config.ts                 # Proxy /api → :8787 em dev; alias @ → src/
├── wrangler.toml                  # Config Cloudflare Pages + D1 binding
├── tsconfig.json                  # TS strict, target ES2020, paths @/*
└── package.json
```

---

## Equipe (src/lib/users.ts — NAME_MAP)

| Usuário | Cargo | Emoji | Cor |
|---|---|---|---|
| pradox | Sócio | 👑 | #FFD700 |
| testa | Sócio | 👑 | #FFD700 |
| kaique | Head operacional | 🎬 | #ff9039 |
| geovana | Social media | 📱 | #3B8EFF |
| jhones | Design | 🎨 | #C084FC |
| kerges | Copy | ✍️ | #FB7185 |
| arthur | Gestor de tráfego | 📈 | #00C47A |
| robson | Gestor de tráfego | 📈 | #00C47A |

---

## Tipos TypeScript (src/types.ts)

```typescript
type ContentType = 'Post' | 'Reel' | 'Story'
type Status = 0 | 1 | 2 | 3 | 4

interface ContentItem {
  i: number           // ID único
  c: string           // Nome do cliente
  dt: Date            // Data de publicação
  tp: ContentType
  n: string           // Título do conteúdo
  s: Status           // Status inicial
  custom?: boolean
}

interface ItemState {
  status: Status
  title: string
  link: string              // Link do criativo
  caption: string
  notes: string
  responsible?: string      // Usuário responsável (NAME_MAP key)
  rejectionText?: string
  history?: HistoryEntry[]
  engagement?: { likes?: number; comments?: number; reach?: number }
}

interface Client {
  name: string
  postsPerMonth: number
  reelsPerMonth: number
  sheetUrl?: string
  scriptUrl?: string
}

interface Roteiro {
  id: string
  clientName: string
  title: string
  type: ContentType
  driveLink?: string
  notes?: string
  distributed: boolean
}
```

---

## Sistema de Status

| Valor | Label | Cor MUI | Significado |
|---|---|---|---|
| 0 | Pendente | default (outlined) | Aguardando iniciar |
| 1 | Em edição | warning | Design/edição em andamento |
| 2 | Aprovado | info | Aprovado internamente |
| 3 | Publicado | success | Publicado nas redes |
| 4 | Reprovado pelo cliente | error | Feedback negativo via portal |

- `StatusChip` abre um popover com todas as opções ao clicar
- Status 4 (Reprovado) é definido exclusivamente pelo portal do cliente
- A app faz polling a cada 8s para detectar novos status 4

**Status inicial em `data.ts`:**
- Mês atual: `s()` retorna 0 (Pendente) para todos — time ajusta conforme trabalha

---

## Tema MUI (src/theme.ts)

```typescript
palette: {
  mode: 'dark',
  primary:    { main: '#ff9039' },   // laranja Digital Scale
  secondary:  { main: '#ff5339' },   // vermelho-laranja
  background: { default: '#080808', paper: '#0e0e0e' },
  success:    { main: '#00C47A' },
  warning:    { main: '#FFD700' },
  error:      { main: '#FF4545' },
  info:       { main: '#3B8EFF' },
}
// Fontes: Inter
// Glassmorphism: backdropFilter blur, cards com rgba(255,255,255,0.04)
// Bottom nav mobile: 62px de altura
// Breakpoints xl usados para 4K: todos os componentes têm sx={{ xl: ... }}
```

---

## Roteamento (src/main.tsx)

```
/                        → App.tsx (dashboard principal)
/c/:token/:itemId        → CreativeViewer.tsx (cliente vê um criativo)
/c/:token                → ClientPortal.tsx (portal de feedback do cliente)
```

---

## Abas e Navegação

| Índice | Aba | Componente | Desktop | Mobile | Responsável |
|---|---|---|---|---|---|
| 0 | Hoje | `TodayTab` | ✅ | ✅ | Todos |
| 1 | Agenda | `AgendaTab` | ✅ | ✅ | Todos |
| 2 | Kanban | `KanbanTab` | ✅ | ✅ | Todos |
| 3 | Calendário | `CalendarTab` | ✅ | ❌ | Todos |
| 4 | Clientes | `ClientsTab` | ✅ | ✅ | Kaique/Sócios |
| 5 | Dashboard | `KaiqueTab` | ✅ | ✅ | Kaique/Sócios |
| 6 | Timeline | `TimelineTab` | ❌ hidden | ❌ | — |
| 7 | Gravações | `RecordingCenter` | ✅ | ✅ | Kaique |
| 8 | Editor | `EditorMode` | ✅ | ❌ | Kaique |
| 9 | Financeiro | `FinanceiroTab` | ✅ | ❌ | Sócios |
| 10 | Equipe | `EquipeTab` | ✅ | ❌ | Kaique/Sócios |
| 11 | IA | `IATab` | ✅ | ❌ | Todos |
| 12 | Roteiros | `RoteirosIdeaTab` | ✅ | ❌ | Geovana/Kerges |
| 13 | Tráfego | `TrafegoTab` | ✅ | ❌ | Arthur/Robson |
| 14 | Design | `DesignTab` | ✅ | ❌ | Jhones |

**Desktop:** sidebar lateral com todos os itens não-hidden  
**Mobile:** bottom navigation (62px) — apenas índices 0,1,2,4,5,7 (6 itens)

### navItem flags:
- `hidden: true` — não aparece em lugar nenhum (Timeline)
- `mobileHidden: true` — aparece só no desktop sidebar
- `mobileOnly: true` — legado, não usado ativamente

---

## Persistência de Dados

### Dupla Camada

**1. localStorage** (instantâneo, offline-first):
| Chave | Conteúdo |
|---|---|
| `sm_states` | `Record<number, ItemState>` |
| `sm_custom` | `ContentItem[]` — itens criados pelo usuário |
| `sm_deleted` | `number[]` — IDs deletados |
| `sm_edits` | Edições sobre itens originais |
| `sm_roteiros` | `Roteiro[]` por cliente |
| `sm_client_folders` | Links Drive por cliente |
| `sm_extra_clients` | Clientes adicionados manualmente |
| `sm_hidden_clients` | Clientes ocultos |
| `sm_client_colors` | Cores por cliente |
| `sm_client_hashtags` | Hashtags por cliente |
| `sm_caption_templates` | Templates de legenda |
| `sm_financeiro` | `Record<string, FinanceEntry>` |
| `sm_trafego` | `Record<string, CampanhaEntry>` |
| `sm_roteiro_ideias_junho_2026` | `Ideia[]` — ideias de roteiro junho |

**2. Cloudflare D1** (sync em background via `syncToCloud(key, value)`):
- Todas as chaves acima sincronizadas via `POST /api/sync`
- Na carga inicial: D1 sobrescreve localStorage se tiver dados mais recentes
- Polling de 8s para novos feedbacks do cliente (status 4)

---

## Push Notifications (sw.js)

- Service Worker agenda notificação diária às 7h via `setTimeout`
- No disparo: SW envia `REQUEST_DAILY_SUMMARY` ao App via `postMessage`
- App responde com `{ hoje, overdue, total }` calculado dos `states`
- SW exibe notificação nativa com resumo do dia
- App pede permissão de Notification automaticamente 3s após carregamento
- Para testar no console: `navigator.serviceWorker.controller.postMessage({type:'TEST_NOTIFY'})`

---

## API Cloudflare (functions/api/)

### GET/POST /api/sync — Sync de estado geral
```typescript
// GET → todos os pares key-value da tabela app_data
// POST { key, value } → upsert (key = qualquer chave sm_*)
```

### POST /api/ai — Chat com Gemini 2.0 Flash
```typescript
// POST { messages: [{role, content}] } → resposta do Gemini
// Usado por: ScaleAI, IATab, RoteirosIdeaTab (geração de ideias)
```

### GET/POST /api/portal — Portal do cliente
```typescript
// POST { action: 'generate', clientName } → cria/recupera token
// POST { action: 'feedback', token, itemId, approved, rejectionText }
// POST { action: 'revoke', token }
```

---

## IDs dos Dados

| Mês | Range de IDs | BASE_DATE |
|---|---|---|
| Maio 2026 | 1–226 | `new Date(2026, 4, 1)` |
| Junho 2026 | 1001–1226 | `new Date(2026, 5, 1)` |
| Julho 2026 | 2001–2226 | `new Date(2026, 6, 1)` |

**Regra:** IDs do mês = `(mêsIndex - 4) * 1000 + posição` para evitar colisão de estados no D1.  
O status inicial `s()` retorna 0 (Pendente) para todos os itens do mês novo.

---

## Scripts npm

```bash
npm run dev      # Vite em :5173
npm run build    # tsc + vite build → dist/
npm run preview  # Preview do build
npm run deploy   # Build + deploy para Cloudflare Pages
```

---

## Clientes Ativos (Junho 2026)

17 clientes · 226 conteúdos no mês

Casa de Ração 2 Irmãos · Chalés Alto da Represa · Compostela · Frango d'Água · Hidro Elétrica Andrade · Home Elevadores · Kátia Bigatello · Lareiras Grill · Luthita · LuzioPan · Magia dos Temáticos · Padaria R.A · Pousada Dukuka · Quero Bolo · Rosângela Varas · Suh Maya · ViniPlas

---

## Convenções de Código

- **Sem comentários** exceto quando o "porquê" não é óbvio
- **Alias `@/`** mapeia para `src/`
- **TypeScript strict** — sem `any` implícito
- **MUI v6** para todos os componentes — não usar bibliotecas de UI paralelas
- **dnd-kit** para drag-and-drop (`@dnd-kit/core`, `@dnd-kit/utilities`)
- **html-to-image** para exportação visual
- **Estado em App.tsx** — não criar context/store externo sem necessidade
- **Breakpoints xl** — todo componente UI deve ter variantes `xl` para 4K
- **mobileHidden: true** no navItem para abas desktop-only

---

## Próximos Passos

- [ ] Portal do cliente: aprovação em batch + comentário livre
- [ ] Script de geração automática de mês (`npm run gen-mes -- julho-2026`)
- [ ] WhatsApp: disparo em lote para aprovação
- [ ] Painel de Prospecção (pipeline de leads — nicho gastronômico)
- [ ] Integração Meta Ads API (puxar dados reais no TrafegoTab)
- [ ] Relatório mensal automático por email/WhatsApp no último dia do mês
- [ ] Painel de Jhones: melhorar preview de criativo com imagem do Drive
