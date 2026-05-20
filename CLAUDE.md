# CLAUDE.md — Painel Social Media (React + Cloudflare)
**Digital Scale · Agência de Marketing Digital**

---

## Visão Geral

Painel operacional completo para a equipe da Digital Scale gerenciar 17 clientes de social media, incluindo agendamentos, status de publicação, links de conteúdo, portal do cliente, integração com IA e dashboard executivo.

**Stack:**
- Frontend: React 18 + TypeScript + Vite + MUI v6
- Backend: Cloudflare Pages Functions (Workers)
- Banco: Cloudflare D1 (SQLite no edge)
- Deploy: GitHub → Cloudflare Pages (auto-deploy no push)
- Roteamento: React Router DOM v6

---

## Estrutura do Projeto

```
├── src/
│   ├── App.tsx                    # Root (1.467 linhas) — estado global, navegação, sync
│   ├── main.tsx                   # Entry point com React Router (3 rotas)
│   ├── theme.ts                   # MUI v6 dark theme com glassmorphism
│   ├── types.ts                   # Todos os tipos TypeScript do projeto
│   ├── data.ts                    # CLIENTS[] (17) e DATA[] (226 itens — maio 2026)
│   └── components/
│       ├── ContentCard.tsx        # Card expansível: status, link, legenda, notas, histórico
│       ├── StatusChip.tsx         # Chip clicável com menu popover de status
│       ├── TodayTab.tsx           # Aba Hoje: atrasados + publicar hoje + resumo
│       ├── AgendaTab.tsx          # Aba Agenda: próximos 7/15 dias agrupados por data
│       ├── KanbanTab.tsx          # Aba Kanban: arrastar entre colunas de status
│       ├── CalendarTab.tsx        # Aba Calendário: visão mensal com drag-to-reschedule
│       ├── ClientsTab.tsx         # Aba Clientes: progresso Posts/Reels, Drive, roteiros
│       ├── KaiqueTab.tsx          # Dashboard executivo (KPIs, visão geral)
│       ├── TimelineTab.tsx        # Aba Timeline: visão cronológica
│       ├── RecordingCenter.tsx    # Central de gravações de vídeo
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
├── public/                        # Assets estáticos (logos, manifest, sw.js)
├── index.html
├── vite.config.ts                 # Proxy /api → :8787 em dev; alias @ → src/
├── wrangler.toml                  # Config Cloudflare Pages + D1 binding
├── tsconfig.json                  # TS strict, target ES2020, paths @/*
└── package.json
```

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
  s: Status           // Status inicial (calculado pela data)
  custom?: boolean
}

interface ItemState {
  status: Status
  title: string
  link: string              // Link do criativo
  caption: string
  notes: string
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

| Valor | Label | Cor MUI | Transição |
|---|---|---|---|
| 0 | Pendente | default (outlined) | → 1 |
| 1 | Em edição | warning | → 2 |
| 2 | Aprovado | info | → 3 |
| 3 | Publicado | success | → 0 |
| 4 | Reprovado pelo cliente | error | (via portal) |

- `StatusChip` abre um popover com todas as opções ao clicar
- Status 4 (Reprovado) é definido exclusivamente pelo portal do cliente
- A app faz polling a cada 8s para detectar novos status 4

**Status inicial calculado automaticamente em `data.ts`:**
- Data passada → 3 (Publicado)
- Hoje → 1 (Em edição)
- Futuro → 0 (Pendente)

---

## Tema MUI (src/theme.ts)

```typescript
palette: {
  mode: 'dark',
  primary:    { main: '#ff9039' },   // laranja
  secondary:  { main: '#ff5339' },   // vermelho-laranja
  background: { default: '#080808', paper: '#0e0e0e' },
  success:    { main: '#00C47A' },
  warning:    { main: '#FFD700' },
  error:      { main: '#FF4545' },
  info:       { main: '#3B8EFF' },
}
// Fontes: Inter
// Componentes: Cards com blur, dialogs com glassmorphism
// Bottom nav: 62px de altura
// Tipografia responsiva (fator 2.2x)
```

---

## Roteamento (src/main.tsx)

```
/                        → App.tsx (dashboard principal)
/c/:token/:itemId        → CreativeViewer.tsx (cliente vê um criativo)
/c/:token                → ClientPortal.tsx (portal de feedback do cliente)
```

Service Worker registrado em `/sw.js` para suporte offline.

---

## Persistência de Dados

### Dupla Camada

**1. localStorage** (instantâneo, offline-first):
| Chave | Conteúdo |
|---|---|
| `sm_states` | `Record<number, ItemState>` — estado de cada item |
| `sm_custom` | `ContentItem[]` — itens criados pelo usuário |
| `sm_deleted` | `number[]` — IDs deletados |
| `sm_edits` | Edições aplicadas sobre itens originais |
| `sm_roteiros` | `Roteiro[]` por cliente |
| `sm_client_folders` | Links de pastas Drive por cliente |
| `sm_extra_clients` | Clientes adicionados manualmente |
| `sm_hidden_clients` | Clientes ocultos da visualização |
| `sm_client_colors` | Cores personalizadas por cliente |
| `sm_client_hashtags` | Hashtags por cliente |

**2. Cloudflare D1** (sync em background):
- Sync a cada mudança de estado via `POST /api/sync`
- Na carga inicial: se D1 tiver dados, sobrescreve localStorage; senão, empurra localStorage para D1
- Polling de 8s para novos feedbacks do cliente (status 4)

---

## API Cloudflare (functions/api/)

### GET/POST /api/items — Persistência por item
```typescript
// GET → todos os itens da tabela D1
// POST { id, status, link, caption, notes } → upsert
```

### GET/POST /api/sync — Sync de estado geral
```typescript
// GET → todos os pares key-value da tabela app_data
// POST { key, value } → upsert (key = sm_states, sm_custom, etc.)
```

### GET/POST /api/portal — Portal do cliente
```typescript
// GET ?token=TOKEN → valida token, retorna dados do cliente
// POST { action: 'generate', clientName } → cria/recupera token
// POST { action: 'feedback', token, itemId, approved, rejectionText } → salva feedback
// POST { action: 'revoke', token } → regenera token
```

### POST /api/ai — Chat com Gemini 2.0 Flash
```typescript
// POST { messages: [{role, content}] } → resposta do Gemini
// Suporta histórico multi-turn
```

### GET /api/stream — Proxy de vídeo Google Drive
```typescript
// GET ?id=FILE_ID → stream com suporte a Range (seek/scrub)
// CORS habilitado
```

---

## Estado Global (App.tsx)

Os principais hooks de estado gerenciados em `App.tsx`:

```typescript
states            // Record<number, ItemState> — estado de cada item
customItems       // ContentItem[] — itens criados pelo usuário
deletedIds        // number[]
editedItems       // Record — edições sobre itens originais
roteiros          // Roteiro[]
clientFolders     // Record<string, string> — links Drive por cliente
extraClients      // Client[] — clientes extras
hiddenClients     // string[]
clientColors      // Record<string, string>
clientHashtags    // Record<string, string>
tab               // number — aba atual (0-7)
now               // Date — atualiza a cada 60s
searchQuery       // string — busca global
focusClient       // string | null — cliente em foco
reportOpen        // boolean
presentationOpen  // boolean
scaleAIOpen       // boolean
```

---

## Abas e Navegação

| Índice | Aba | Componente | Descrição |
|---|---|---|---|
| 0 | Hoje | `TodayTab` | Atrasados + publicar hoje + copiar resumo |
| 1 | Agenda | `AgendaTab` | Próximos 7/15 dias por data |
| 2 | Kanban | `KanbanTab` | Arrastar entre colunas de status (dnd-kit) |
| 3 | Calendário | `CalendarTab` | Visão mensal + drag-to-reschedule |
| 4 | Clientes | `ClientsTab` | Cards com progresso, Drive, roteiros |
| 5 | Geral | `KaiqueTab` | Dashboard executivo (KPIs) |
| 6 | Timeline | `TimelineTab` | Visão cronológica |
| 7 | Gravações | `RecordingCenter` | Central de gravações |

**Desktop:** sidebar lateral  
**Mobile:** bottom navigation (62px)

---

## Atalhos de Teclado

| Tecla | Ação |
|---|---|
| `1` – `7` | Navegar para aba |
| `S` | Abrir/fechar busca |
| `P` | Modo apresentação |
| `R` | Modal de relatório |
| `A` | Scale AI |
| `Cmd/Ctrl+K` | Busca global |

---

## Scripts npm

```bash
npm run dev      # Vite em :5173
npm run build    # tsc + vite build → dist/
npm run preview  # Preview do build
npm run deploy   # Build + deploy para Cloudflare Pages
```

**Dev com backend local:**
```bash
# Terminal 1
npm run dev

# Terminal 2
npx wrangler pages dev dist --d1 DB=social-media-db
```

---

## Setup Inicial (Cloudflare)

```bash
# 1. Criar banco D1
npx wrangler d1 create social-media-db

# 2. Copiar database_id → wrangler.toml

# 3. Aplicar schema
npx wrangler d1 execute social-media-db --file=functions/api/schema.sql

# 4. Cloudflare Pages dashboard:
#    Build command:  npm run build
#    Output dir:     dist
#    D1 binding:     Settings > Functions > D1 Database Bindings (DB)
```

**wrangler.toml atual:**
```toml
name = "digital-scale-social-media"
compatibility_date = "2024-11-01"
pages_build_output_dir = "dist"

[[d1_databases]]
binding = "DB"
database_name = "social-media-db"
database_id = "a5c6a26d-5793-4769-b718-11de3017ee7f"
```

---

## Como Atualizar para Novo Mês

1. Abrir `src/data.ts`
2. Alterar `BASE_DATE` para o 1º dia do novo mês
3. Substituir o array `DATA[]` pelos novos conteúdos
4. `CLIENTS[]` só muda se houver entrada/saída de clientes

---

## Clientes Ativos (Maio 2026)

17 clientes · 226 conteúdos no mês

Casa de Ração 2 Irmãos · Chalés Alto da Represa · Compostela · Frango d'Água · Hidro Elétrica Andrade · Home Elevadores · Kátia Bigatello · Lareiras Grill · Luthita · LuzioPan · Magia dos Temáticos · Padaria R.A · Pousada Dukuka · Quero Bolo · Rosângela Varas · Suh Maya · ViniPlas

---

## Convenções de Código

- **Sem comentários** exceto quando o "porquê" não é óbvio
- **Alias `@/`** mapeia para `src/` (configurado em vite.config.ts e tsconfig.json)
- **TypeScript strict** habilitado — sem `any` implícito
- **MUI v6** para todos os componentes UI — não usar bibliotecas de UI paralelas
- **dnd-kit** para drag-and-drop (não react-beautiful-dnd)
- **html-to-image** para exportação visual
- **Estado em App.tsx** — não criar context/store externo sem necessidade

---

## Próximos Passos

- [ ] Carregar estado inicial do D1 no mount (sobrescreve localStorage)
- [ ] Painel do Editor de Vídeo
- [ ] Painel do Gestor de Tráfego
- [ ] Notificação push às 7h diária
- [ ] Atualização automática mensal via script
- [ ] Painel de Prospecção (nicho gastronômico)
