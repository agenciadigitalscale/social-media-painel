# CLAUDE.md — DS HUB (React + Cloudflare)
**Digital Scale · Agência de Marketing Digital**

---

## Visão Geral

Painel operacional completo (**DS HUB**) para a equipe da Digital Scale gerenciar 17 clientes de social media — agendamentos, status de publicação, portal do cliente, IA, financeiro, campanhas pagas, design e gravações.

**Stack:**
- Frontend: React 18 + TypeScript + Vite + MUI v6
- Backend: Cloudflare Pages Functions (Workers)
- Banco: Cloudflare D1 (SQLite no edge)
- Deploy: GitHub → Cloudflare Pages (auto-deploy no push)
- Roteamento: React Router DOM v6
- PWA: Service Worker em `/public/sw.js` — offline + push notifications 7h
- Drag-and-drop: `@dnd-kit/core` + `@dnd-kit/utilities`
- Exportação visual: `html-to-image`

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## DESIGN SYSTEM — DS HUB
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Identidade Visual

O DS HUB segue uma estética **"dark premium agency"**: fundo quase preto, acentos em laranja Digital Scale, glassmorphism em superfícies elevadas, e tipografia Inter densa. Nada deve parecer "genérico" — cada elemento tem intenção visual.

**Princípios:**
- Dark-first: nunca fundo branco ou claro
- Laranja como único acento quente; verde para sucesso; azul para info
- Glassmorphism em modais, cards elevados, sidebar — `backdropFilter: blur()`
- Bordas sempre sutis: `rgba(255,255,255,0.06–0.12)`, nunca sólidas brancas
- Hover com `translateY(-1px)` ou `brightness(1.08)` — nunca flashes bruscos
- `transition: all 0.2s ease` como padrão universal

---

### Paleta de Cores

#### Cores Base
| Token | Valor | Uso |
|---|---|---|
| `background.default` | `#080808` | Fundo da página |
| `background.paper` | `rgba(14,14,14,0.85)` | Cards, Paper |
| Card bg | `rgba(13,13,13,0.82)` | MuiCard padrão |
| Modal bg | `rgba(11,11,11,0.97)` | Dialogs |
| Sidebar bg | `rgba(10,10,10,0.97)` | Drawer |

#### Cores de Marca (Digital Scale)
| Token | Valor | Uso |
|---|---|---|
| `primary.main` | `#ff9039` | Laranja DS — ações principais, destaque |
| `secondary.main` | `#ff5339` | Vermelho-laranja — gradientes, secundário |
| Gradiente principal | `linear-gradient(135deg, #ff9039, #ff5339)` | Botões CTA, acentos fortes |

#### Cores Semânticas
| Token | Valor | Uso |
|---|---|---|
| `success.main` | `#00C47A` | Publicado, aprovado, online |
| `warning.main` | `#FFD700` | Atenção, Sócio (dourado), atrasado |
| `error.main` | `#FF4545` | Reprovado, erro, excluir |
| `info.main` | `#3B8EFF` | Aprovação interna, info neutra |

#### Cores de Texto
| Token | Valor | Uso |
|---|---|---|
| `text.primary` | `rgba(255,255,255,0.92)` | Texto principal |
| `text.secondary` | `rgba(255,255,255,0.50)` | Subtítulos, labels |
| `text.disabled` | `rgba(255,255,255,0.28)` | Texto inativo |
| Placeholder | `rgba(255,255,255,0.18–0.22)` | Inputs |

#### Cores por Membro da Equipe
| Membro | Cor | Glow |
|---|---|---|
| pradox / testa (Sócio) | `#FFD700` | `rgba(255,215,0,0.5)` |
| kaique (Head) | `#ff9039` | `rgba(255,144,57,0.5)` |
| geovana (Social) | `#3B8EFF` | `rgba(59,142,255,0.5)` |
| jhones (Design) | `#C084FC` | `rgba(192,132,252,0.5)` |
| kerges (Copy) | `#FB7185` | `rgba(251,113,133,0.5)` |
| arthur / robson (Tráfego) | `#00C47A` | `rgba(0,196,122,0.5)` |

---

### Tipografia

**Fonte:** `"Inter", system-ui, -apple-system, sans-serif`  
**Feature settings:** `"cv01","cv02","cv03","cv04","ss01"` (Inter alternativo, algarismos abertos)  
**Rendering:** `antialiased`, `optimizeLegibility`

| Elemento | Peso | Letter-spacing | Line-height |
|---|---|---|---|
| h1–h3 | 700 | `-0.03em` a `-0.04em` | 1.08–1.18 |
| h4–h6 | 600 | `-0.01em` a `-0.02em` | 1.24–1.35 |
| body1 | 400 | `-0.011em` | 1.65 |
| body2 | 400 | `-0.006em` | 1.60 |
| overline | 600 | `0.1em` | 2.0 |
| caption | 400 | `0.008em` | 1.5 |

**Escalas comuns nos componentes:**
- Labels de coluna/header: `0.6–0.7rem`, weight 700, uppercase, letter-spacing 0.08em
- Títulos de card: `0.78–0.88rem`, weight 700
- Subtítulos/meta: `0.58–0.65rem`, color `rgba(255,255,255,0.5)`
- KPIs grandes: `1.6–2.4rem`, weight 900, letter-spacing `-0.03em`
- Badges de status: `0.6–0.68rem`, weight 700

---

### Glassmorphism — Padrões de Uso

```css
/* Card padrão (MuiCard) */
background: rgba(13,13,13,0.82);
backdropFilter: blur(28px);
border: 1px solid rgba(255,255,255,0.06);
borderRadius: 16px;
boxShadow: 0 1px 2px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.5),
           0 16px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.055);

/* Dialog/Modal */
background: rgba(11,11,11,0.97);
backdropFilter: blur(40px);
border: 1px solid rgba(255,255,255,0.07);
borderRadius: 20px;

/* Tooltip */
background: rgba(16,16,16,0.97);
backdropFilter: blur(20px);
border: 1px solid rgba(255,255,255,0.10);
borderRadius: 10px;

/* Sidebar */
background: rgba(10,10,10,0.97);
backdropFilter: blur(32px);

/* Input/TextField */
backdropFilter: blur(8px);
border: 1px solid rgba(255,255,255,0.10);
borderRadius: 10px;
```

**Regra:** quanto mais elevado o z-index, maior o blur. Cards = 28px, Dialogs = 40px, Tooltips = 20px.

---

### Border Radius

| Componente | Valor |
|---|---|
| `shape.borderRadius` (padrão) | `14px` |
| Cards (MuiCard) | `16px` |
| Dialogs | `20px` |
| Buttons | `10px` |
| IconButtons | `10px` |
| Chips | `8px` |
| Inputs/TextField | `10px` |
| Pills/badges inline | `6–8px` |
| Dots de status | `50%` |

---

### Scrollbar

Sempre personalizada — fina e discreta:
```css
scrollbar-width: thin;
scrollbar-color: rgba(255,144,57,0.5) transparent;
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(255,144,57,0.6), rgba(255,83,57,0.6));
  border-radius: 4px;
}
```

---

### Sistema de Animações

#### Keyframes Globais (definidos inline no SX quando necessários)

| Nome | Uso | Duração típica |
|---|---|---|
| `glowBreath` | Halos de fundo pulsando suavemente | 6–8s |
| `orbitSpin` | Anéis orbitais na splash | 20–54s linear |
| `shimmer` | Texto com gradiente animado | 4–5s linear |
| `logoPulse` | Drop-shadow do logo pulsando | 5s ease-in-out |
| `particleRise` | Partículas subindo e sumindo | 2.5–4s ease-out |
| `ringExpand` | Anéis se expandindo (hold phase) | 1.8s ease-out forwards |
| `badgeIn` | Badge/chip aparecendo | 0.22–0.28s cubic-bezier |
| `cardSlideUp` | Card subindo no login | 0.5s cubic-bezier(0.16,1,0.3,1) |
| `shake` | Input com erro balançando | 0.42s ease |
| `starTwinkle` | Estrelas piscando | 2.5–4s ease-in-out |
| `dotBounce` | Dots de loading saltando | 1.1s ease-in-out |
| `loadBar` | Barra de progresso do loading | 1.8s ease-in-out forwards |
| `fadeInLoad` | Fade-in do overlay de loading | 0.28s ease |

#### Easing padrão para transições de UI
```
cubic-bezier(0.16, 1, 0.3, 1)   → entrada de elementos (spring-like)
ease-in-out                       → respiração, loops
ease                              → hover, transições simples
0.2s ease                         → padrão universal de hover
```

---

### Padrões de Componentes

#### Card de conteúdo (mini card no Kanban/Produções)
- Fundo: `rgba(255,255,255,0.03–0.05)`
- Borda: `1px solid rgba(255,255,255,0.06)`
- BorderRadius: `10–12px`
- Hover: `translateY(-1px)` + borda laranja sutil
- Drag ativo: `scale(1.02)`, `boxShadow` mais forte, `willChange: 'transform'`
- Atenção: **nunca usar `backdropFilter: blur()` em cards que serão arrastados** — causa lag de GPU

#### Chips de status
- Outlined por padrão, cor do status como borda e dot
- Hover abre popover com todas as opções
- Dot colorido antes do label: `width: 7px, height: 7px, borderRadius: '50%'`

#### Botão CTA principal
```jsx
sx={{
  background: 'linear-gradient(135deg, #ff9039, #ff5339)',
  color: '#000',
  fontWeight: 800,
  borderRadius: 2.5,
  boxShadow: '0 6px 20px rgba(255,144,57,0.32)',
  '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-1px)' },
}}
```

#### Botão destrutivo (apagar, remover)
```jsx
sx={{
  background: 'rgba(255,69,69,0.12)',
  border: '1px solid rgba(255,69,69,0.3)',
  color: '#FF4545',
  '&:hover': { background: 'rgba(255,69,69,0.22)' },
}}
```

#### Badge de erro/acesso negado
```jsx
sx={{
  display: 'flex', alignItems: 'center', gap: 1.4,
  px: 2, py: 1.1, borderRadius: 2,
  background: 'rgba(255,69,69,0.08)',
  border: '1.5px solid rgba(255,69,69,0.28)',
  animation: 'badgeIn 0.22s ease both',
}}
```

#### Badge de sucesso/cargo detectado
```jsx
sx={{
  background: `${color}0c`,
  border: `1.5px solid ${color}35`,
  boxShadow: `0 4px 16px ${glow}`,
  animation: 'badgeIn 0.28s cubic-bezier(0.16,1,0.3,1) both',
}}
```

#### Header de seção com label uppercase
```jsx
<Typography sx={{
  fontSize: '0.6rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.08em',
  color: 'rgba(255,255,255,0.35)',
  mb: 0.5,
}} />
```

#### Dot de status online
```jsx
<Box sx={{
  width: 5, height: 5, borderRadius: '50%',
  bgcolor: '#00C47A', boxShadow: '0 0 6px #00C47A',
  animation: 'pulse 3s ease-in-out infinite',
}} />
```

---

### Layout e Responsividade

#### Breakpoints
| Breakpoint | Pixel | Uso |
|---|---|---|
| xs | 0px | Mobile base |
| sm | 600px | Mobile grande |
| md | 900px | Tablet / Desktop pequeno |
| lg | 1200px | Desktop padrão |
| xl | 1920px | 4K / Monitor grande |

**Regra obrigatória:** Todo componente de UI deve ter variantes `xl` para telas 4K. Exemplo:
```jsx
fontSize: { md: '0.72rem', lg: '0.8rem', xl: '0.9rem' }
width: { md: 220, lg: 260, xl: 320 }
```

#### Sidebar (Desktop)
- Largura: `{ md: 200, lg: 220, xl: 260 }px`
- Background: `rgba(10,10,10,0.97)` + `backdropFilter: blur(32px)`
- Border-right: `1px solid rgba(255,255,255,0.06)`
- NavItem ativo: fundo `rgba(255,144,57,0.08)`, texto `#ff9039`, barra esquerda laranja `3px`
- NavItem highlight (Produções): glow laranja mesmo sem seleção + dot pulsante
- NavItem hover: `rgba(255,255,255,0.04)`

#### Bottom Nav (Mobile)
- Altura: `62px` (MuiBottomNavigation override)
- Apenas 6 abas: Hoje, Agenda, Produções, Clientes, Dashboard, Gravações
- Ativo: cor `primary.main` (#ff9039)

---

### Drag-and-Drop (dnd-kit)

**Regras críticas de performance:**
- `backdropFilter: blur()` → **PROIBIDO em cards draggáveis** — causa travamento em GPU
- Usar `willChange: isDragging ? 'transform' : undefined` no card durante drag
- Collision detection: sempre `pointerWithin` + fallback `closestCenter`
  ```tsx
  const colHits = hits.filter(({ id }) => String(id).startsWith('col-'))
  if (colHits.length > 0) return colHits // prioriza colunas vazias
  return closestCenter(args)
  ```
- Sensors: `distance: 4` (pointer), `delay: 120, tolerance: 10` (touch)
- DragOverlay: opacidade 0.9, `rotate(2deg)` — visual de "segurando"
- Coluna droppable mínima: `minHeight: 120px` para aceitar drop em colunas vazias

---

### Splash Screen

**Conceito:** Dark premium, logo centralizado, fundo quase preto com glow atmosférico suave.

**Layout:** Coluna única centralizada — sem split esquerda/direita.

**Fases:**
1. `enter` → logo anima com `logoIn` (blur + scale + translateY)
2. `hold` → anéis expandem (`ringExpand`), logo grande
3. `login` → logo reduz, card de login sobe (`cardSlideUp`)
4. `loading` → overlay escuro com dots bounce + barra de progresso
5. `exit` → fade-out global

**Logo tamanhos:**
- Splash (não-login): `{ xs: 210, sm: 270, md: 330, lg: 375, xl: 420 }px`
- Login ativo: `{ xs: 105, sm: 125, md: 155, lg: 175, xl: 190 }px`
- Transição: `transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)'`

**Card de login:**
- `background: rgba(10,7,7,0.9)`, `backdropFilter: blur(28px)`
- `border: 1px solid rgba(255,144,57,0.10)`
- `boxShadow: 0 12px 50px rgba(0,0,0,0.6)`
- Max-width: `{ sm: 490, md: 520 }px`
- Estrutura: header (saudação + relógio) → formulário → footer (KPIs + status)

**Fluxo de autenticação:**
1. Usuário seleciona seu avatar/nome
2. API `POST /api/role-auth { action: 'verify', role }` verifica se cargo tem senha
3. Se `noPassword: true` → entra direto
4. Se tem senha → mostra `RolePasswordForm` com `POST /api/role-auth { action: 'verify', role, password }`
5. Fallback offline: se API cair, entra sem senha

---

### Sistema de Status (v2 — 8 estados)

Definido em `src/types.ts` como `STATUS_CONFIG`:

| Valor | Label | Cor | Emoji | Grupo |
|---|---|---|---|---|
| 0 | Pendente | `#A1A1AA` | ⏳ | internal |
| 1 | Em edição | `#FFD700` | ✏️ | internal |
| 2 | Aprovação interna | `#60A5FA` | 👁️ | internal |
| 3 | Aprovado interno | `#2F80ED` | ✅ | internal |
| 4 | Enviado ao cliente | `#FF9A3D` | 📤 | client |
| 5 | Aprovado pelo cliente | `#00C875` | 🎉 | client |
| 6 | Reprovado pelo cliente | `#FF3B30` | 🔄 | client |
| 7 | Publicado | `#00C47A` | 🚀 | done |

**Uso:** sempre referenciar via `STATUS_CONFIG[s].color/label/emoji/glow` — nunca hardcodar.

---

### Boards de Produções (ProducaoTab)

4 boards com colunas e filtros distintos:

| Board | Emoji | Cor | Tipos de conteúdo |
|---|---|---|---|
| Vídeo | 🎬 | `#60A5FA` | Reel |
| Design | 🎨 | `#C084FC` | Post, Story, Carrossel |
| Feed | 📸 | `#F97316` | Feed (fotos da empresa) |
| Social | 📱 | `#00C47A` | Todos os tipos |

Tabs dos boards: pills customizados (não MUI Tabs) com:
- Ativo: `bgcolor` colorido, `boxShadow: 0 0 12px color`, borda inferior laranja
- Badge de contagem: fundo colorido translúcido
- Inativo: texto dimmed `rgba(255,255,255,0.35)`

---

### Convenções Visuais a Seguir Sempre

1. **Nunca fundo branco** — usar `rgba(255,255,255,0.03–0.06)` para superfícies claras
2. **Nunca `border: 1px solid white`** — usar `rgba(255,255,255,0.06–0.12)`
3. **Gradiente laranja em CTAs**: `linear-gradient(135deg, #ff9039, #ff5339)`, texto `#000`
4. **Ícones de ação**: tamanho padrão `14–16px`, cor `rgba(255,255,255,0.4)`, hover cor temática
5. **Loading states**: sempre dots bounce ou CircularProgress laranja — nunca spinner MUI default cinza
6. **Espaçamento padrão**: `gap: 1` (8px) entre itens similares, `gap: 2` (16px) entre seções
7. **Hover em lista/sidebar**: `bgcolor: rgba(255,255,255,0.04)` leve — nunca highlight forte
8. **Textos de alerta/badge**: uppercase + letter-spacing `0.08em` + weight 700
9. **Transições**: sempre `0.2s ease` ou `0.28s ease` — nunca instantâneo, nunca lento
10. **4K obrigatório**: qualquer `fontSize`, `width`, `height` fixo deve ter variante `xl`

---

### O que NÃO fazer

- ❌ `backdropFilter: blur()` em cards draggáveis (trava GPU)
- ❌ Importar bibliotecas de UI além de MUI (styled-components, Tailwind, etc.)
- ❌ Criar context/store externo — estado global fica em `App.tsx`
- ❌ Hardcodar cores de status — usar `STATUS_CONFIG`
- ❌ Hardcodar cores de usuário — usar `NAME_MAP[user].color`
- ❌ `any` implícito no TypeScript
- ❌ Comentários óbvios no código (só comentar o "porquê", nunca o "o quê")
- ❌ `transform: translateZ(0)` desnecessário — usar `willChange` só durante drag

---

## Estrutura do Projeto

```
├── src/
│   ├── App.tsx                    # Root — estado global, navegação, sync, push notifications
│   ├── main.tsx                   # Entry point com React Router (3 rotas)
│   ├── theme.ts                   # MUI v6 dark theme com glassmorphism (fonte da verdade visual)
│   ├── types.ts                   # Todos os tipos TypeScript + STATUS_CONFIG
│   ├── data.ts                    # CLIENTS[] (17) e DATA[] + 7 meses (Mai–Dez 2026, 1.582 itens)
│   ├── lib/
│   │   ├── storage.ts             # localStorage + syncToCloud() + SYNC_KEYS
│   │   ├── users.ts               # NAME_MAP: 8 membros com role/emoji/color/glow
│   │   ├── distribution.ts        # Distribuição de roteiros por dia útil
│   │   └── whatsapp.ts            # Links de aprovação e mensagens WhatsApp
│   └── components/
│       ├── SplashScreen.tsx       # Login — avatar seleção + per-user password + daily quote
│       ├── AccessManager.tsx      # Gerenciar senhas por cargo (somente Sócio/Head)
│       ├── ContentCard.tsx        # Card expansível: status, link, legenda, notas, histórico
│       ├── StatusChip.tsx         # Chip clicável com menu popover de status
│       ├── TodayTab.tsx           # Aba Hoje: atrasados + publicar hoje + resumo
│       ├── AgendaTab.tsx          # Aba Agenda: próximos 7/15 dias agrupados por data
│       ├── ProducaoTab.tsx        # Aba Produções: 4 boards (Vídeo/Design/Feed/Social)
│       ├── KanbanTab.tsx          # Aba Kanban: 8 colunas status v2 (hidden da nav)
│       ├── CalendarTab.tsx        # Aba Calendário: visão mensal com drag-to-reschedule
│       ├── ClientsTab.tsx         # Aba Clientes: progresso Posts/Reels, Drive, roteiros
│       ├── KaiqueTab.tsx          # Dashboard executivo (KPIs, 3 colunas em 4K)
│       ├── RecordingCenter.tsx    # Central de gravações de vídeo
│       ├── EditorMode.tsx         # Aba Editor: painel do editor de vídeo (Kaique)
│       ├── FinanceiroTab.tsx      # Aba Financeiro: gestão de mensalidades + auto-overdue
│       ├── EquipeTab.tsx          # Aba Equipe: visão por membro do time
│       ├── IATab.tsx              # Aba IA: agente de IA para operações em massa
│       ├── RoteirosIdeaTab.tsx    # Aba Roteiros: Central da Geovana+Kerges, ideias IA
│       ├── TrafegoTab.tsx         # Aba Tráfego: campanhas pagas (Arthur+Robson)
│       ├── DesignTab.tsx          # Aba Design: Kanban do Jhones — criativos por urgência
│       ├── ClientPortal.tsx       # Portal público de feedback do cliente
│       ├── CreativeViewer.tsx     # Visualizador de criativo (rota pública /c/token/id)
│       ├── AIAgent.tsx            # Agente de IA para operações em massa
│       ├── ScaleAI.tsx            # Modal de chat multi-turn com contexto
│       ├── MonthlyReportModal.tsx # Relatório mensal (todos os 8 status v2)
│       ├── ErrorBoundary.tsx      # Class component — previne tela branca em crash
│       └── ...                    # outros modais e utilitários
├── functions/api/
│   ├── role-auth.ts               # Senhas por cargo — SHA-256, D1
│   ├── sync.ts                    # GET/POST sync key-value (app_data)
│   ├── portal.ts                  # Portal do cliente: tokens + feedback
│   ├── ai.ts                      # Proxy Gemini 2.0 Flash
│   └── schema.sql                 # DDL: items, app_data, role_passwords, ig_*
└── public/sw.js                   # Service Worker: cache + push 7h
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

**Acesso ao AccessManager (Gerenciar Senhas):** Sócio + Head operacional (kaique)

---

## Tipos TypeScript (src/types.ts)

```typescript
type ContentType = 'Post' | 'Reel' | 'Story' | 'Carrossel' | 'Feed'

type Status = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7   // v2 — 8 estados

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
  link: string
  caption: string
  notes: string
  responsible?: string        // key do NAME_MAP
  rejectionText?: string
  history?: HistoryEntry[]
  comments?: Comment[]
  engagement?: { likes?: number; comments?: number; reach?: number }
  sentToClientAt?: number
  approvedByClientAt?: number
  publishedAt?: number
  approvalToken?: string
  footageLink?: string
  assignedEditor?: string
  isTraffic?: boolean
  tags?: string[]
  priority?: 'alta' | 'media' | 'baixa'
}
```

---

## Abas e Navegação

| Índice | Aba | Componente | Desktop | Mobile |
|---|---|---|---|---|
| 0 | Meu Dia | `TodayTab` | ✅ | ✅ |
| 1 | Hoje | `TodayTab` (variante) | ✅ | ✅ |
| 2 | Agenda | `AgendaTab` | ✅ | ✅ |
| 3 | Produções ⭐ | `ProducaoTab` | ✅ | ✅ |
| 4 | Calendário | `CalendarTab` | ✅ | ❌ |
| 5 | Clientes | `ClientsTab` | ✅ | ✅ |
| 6 | Dashboard | `KaiqueTab` | ✅ | ✅ |
| — | Kanban | `KanbanTab` | hidden | hidden |

**⭐ Produções** tem `highlight: true` → glow laranja permanente na sidebar

### navItem flags
- `hidden: true` — não aparece em lugar nenhum
- `mobileHidden: true` — só no desktop sidebar
- `highlight: true` — glow laranja + dot pulsante mesmo sem seleção

---

## Persistência de Dados

### Dupla Camada (offline-first)

**localStorage** → imediato, sem latência  
**Cloudflare D1** → sync em background via `POST /api/sync`

| Chave localStorage | Conteúdo |
|---|---|
| `sm_states` | `Record<number, ItemState>` |
| `sm_custom` | `ContentItem[]` criados manualmente |
| `sm_deleted` | `number[]` IDs deletados |
| `sm_edits` | Edições sobre itens originais |
| `sm_roteiros` | Roteiros por cliente |
| `sm_client_folders` | Links Drive por cliente |
| `sm_financeiro` | Mensalidades |
| `sm_trafego` | Campanhas pagas |
| `sm_client_phones` | WhatsApp por cliente |
| `sm_client_colors` | Cor personalizada por cliente |

---

## IDs dos Dados

| Mês | Range de IDs |
|---|---|
| Maio 2026 | 1–226 |
| Junho 2026 | 1001–1226 |
| Julho 2026 | 2001–2226 |
| Agosto 2026 | 3001–3226 |
| Setembro 2026 | 4001–4226 |
| Outubro 2026 | 5001–5226 |
| Novembro 2026 | 6001–6226 |
| Dezembro 2026 | 7001–7226 |

Regra: `(mêsIndex - 4) * 1000 + posição` — evita colisão de estados no D1.

---

## API Cloudflare

| Endpoint | Método | Uso |
|---|---|---|
| `/api/sync` | GET/POST | Sync key-value geral |
| `/api/role-auth` | POST | Senhas por cargo (SHA-256) |
| `/api/portal` | POST | Portal do cliente |
| `/api/ai` | POST | Chat Gemini 2.0 Flash |
| `/api/stream` | GET | Streaming de vídeo Drive |

---

## Scripts npm

```bash
npm run dev      # Vite em :5173 + wrangler em :8787
npm run build    # tsc + vite build → dist/
npm run deploy   # Build + deploy Cloudflare Pages
```

---

## Convenções de Código

- **Sem comentários** exceto quando o "porquê" não é óbvio
- **Alias `@/`** mapeia para `src/`
- **TypeScript strict** — sem `any` implícito
- **MUI v6** para todos os componentes — sem bibliotecas de UI paralelas
- **Estado global em App.tsx** — sem context/store externo
- **Breakpoints xl obrigatórios** em todo componente UI

---

## Próximos Passos

- [x] Portal do cliente: aprovação em batch + comentário livre
- [ ] Meta Ads API: dados reais no TrafegoTab
- [x] Relatório mensal automático por WhatsApp — botão "Enviar para todos" no MonthlyReportModal
- [x] Prospecção: 20 templates gastronômicos, funil de conversão, pitch IA especializado
- [x] Modo apresentação: slideshow fullscreen com auto-play, teclado, dot indicators
