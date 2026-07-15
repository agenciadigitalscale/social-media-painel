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

> ⚠️ **REDESIGN EM ANDAMENTO (2026-07-15): SaaS premium azul/ciano.**
> A identidade mudou de "dark premium **laranja**" para **SaaS premium azul/ciano**.
> **Laranja NÃO é mais o acento de marca** — virou cor de alerta/pendência apenas.
> A fonte da verdade é sempre `src/theme.ts` (objeto `DS` + overrides MUI). Muitas
> chaves em `DS` mantêm nomes legados (`orange`, `blue`…) mas seus **valores já são
> o novo sistema azul** — não reverter para laranja. Tabelas abaixo já refletem o novo padrão.
> Migração por ondas: tema+shell prontos; limpeza de cores inline por página em andamento.

### Identidade Visual

O DS HUB segue uma estética **"SaaS premium"**: fundo azul-quase-preto, acento principal
em **azul (#3B82F6)** com **ciano (#06B6D4)** de apoio, superfícies limpas e sólidas,
tipografia Inter densa. Aparência de produto comercializável — nada genérico.

**Princípios:**
- Dark-first: nunca fundo branco ou claro
- **Azul como acento principal**; ciano de apoio; roxo (#7C5CFC) categórico
- Verde para sucesso; vermelho para erro/crítico; **laranja/âmbar SÓ para alerta/pendência/prazo**
- Superfícies sólidas e limpas (cards `#0A1120`); blur reservado a elementos elevados (dialog, menu, tooltip, drawer)
- Bordas sutis: `#1A2940` ou `rgba(148,163,184,0.12)`, nunca sólidas brancas
- Hover com `translateY(-1px)` ou `brightness(1.06)` — nunca flashes bruscos
- `transition: all 0.18s ease` como padrão universal

---

### Paleta de Cores

#### Cores Base (tokens `DS` em `src/theme.ts`)
| Token | Valor | Uso |
|---|---|---|
| `DS.bg` | `#050912` | Fundo da página |
| `DS.bgSidebar` | `#060A13` | Fundo da sidebar |
| `DS.surface` | `#0A1120` | Cards, Paper |
| `DS.surfaceAlt` | `#0D1728` | Superfície secundária, header |
| `DS.field` | `#0B1322` | Fundo de inputs |
| `DS.border` | `#1A2940` | Borda principal |
| `DS.borderSoft` | `rgba(148,163,184,0.12)` | Borda suave |

#### Cores de Marca (agora azul/ciano)
| Token | Valor | Uso |
|---|---|---|
| `primary.main` / `DS.accent` | `#3B82F6` | Azul — ações principais, destaque, item ativo |
| `DS.accentStrong` | `#2563EB` | Azul forte — pressed, ênfase |
| `secondary.main` / `DS.cyan` | `#06B6D4` | Ciano — segundo acento |
| `DS.purple` | `#7C5CFC` | Roxo de apoio — categórico |
| Gradiente CTA | `linear-gradient(90deg, #3B82F6, #06B6D4)` | Botão primário (texto branco) |

> ⚠️ Chaves legadas repontadas: `DS.orange`=azul, `DS.blue`=azul, `DS.blueSoft`=azul-céu, `DS.violet`=roxo. Não hardcodar hex fora do `theme.ts`.

#### Cores Semânticas
| Token | Valor | Uso |
|---|---|---|
| `success.main` / `DS.green` | `#31D17C` | Publicado, aprovado, online |
| `warning.main` / `DS.amber` | `#F59E0B` | **Alerta, pendência, prazo próximo, atrasado** (único uso do quente) |
| `error.main` / `DS.red` | `#EF4444` | Reprovado, erro, excluir |
| `info.main` | `#3B82F6` | Info → azul |

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
| pradox / testa (Sócio) | `#7C5CFC` | `rgba(124,92,252,0.5)` |
| kaique (Head) | `#3B82F6` | `rgba(59,130,246,0.5)` |
| jhones / kerges / arthur / robson | `#9CA3AF` (cinza neutro) | `rgba(156,163,175,0.45)` |

> Fonte da verdade dos membros: `src/lib/users.ts` (NAME_MAP). Identidade fica no emoji + tom cool; sócios roxo, Head azul, resto cinza.

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
scrollbar-color: rgba(59,130,246,0.5) transparent;
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(59,130,246,0.6), rgba(6,182,212,0.6));
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
- Hover: `translateY(-1px)` + borda azul sutil
- Drag ativo: `scale(1.02)`, `boxShadow` mais forte, `willChange: 'transform'`
- Atenção: **nunca usar `backdropFilter: blur()` em cards que serão arrastados** — causa lag de GPU

#### Chips de status
- Outlined por padrão, cor do status como borda e dot
- Hover abre popover com todas as opções
- Dot colorido antes do label: `width: 7px, height: 7px, borderRadius: '50%'`

#### Botão CTA principal
```jsx
sx={{
  background: 'linear-gradient(135deg, #3B82F6, #06B6D4)',
  color: '#000',
  fontWeight: 800,
  borderRadius: 2.5,
  boxShadow: '0 6px 20px rgba(59,130,246,0.32)',
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
- NavItem ativo: fundo `rgba(59,130,246,0.08)`, texto `#3B82F6`, barra esquerda azul `3px`
- NavItem highlight (Produções): glow azul mesmo sem seleção + dot pulsante
- NavItem hover: `rgba(255,255,255,0.04)`

#### Bottom Nav (Mobile)
- Altura: `62px` (MuiBottomNavigation override)
- Apenas 6 abas: Hoje, Agenda, Produções, Clientes, Dashboard, Gravações
- Ativo: cor `primary.main` (#3B82F6)

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
- `border: 1px solid rgba(59,130,246,0.10)`
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
- Ativo: `bgcolor` colorido, `boxShadow: 0 0 12px color`, borda inferior azul
- Badge de contagem: fundo colorido translúcido
- Inativo: texto dimmed `rgba(255,255,255,0.35)`

---

### Convenções Visuais a Seguir Sempre

1. **Nunca fundo branco** — usar `rgba(255,255,255,0.03–0.06)` para superfícies claras
2. **Nunca `border: 1px solid white`** — usar `rgba(255,255,255,0.06–0.12)`
3. **Gradiente azul em CTAs**: `linear-gradient(135deg, #3B82F6, #06B6D4)`, texto branco
4. **Ícones de ação**: tamanho padrão `14–16px`, cor `rgba(255,255,255,0.4)`, hover cor temática
5. **Loading states**: sempre dots bounce ou CircularProgress azul — nunca spinner MUI default cinza
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
│       ├── RoteirosIdeaTab.tsx    # Aba Roteiros: Central de roteiros (Kerges), ideias IA
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
| kaique | Head operacional | 🎬 | #3B82F6 |
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

**⭐ Produções** tem `highlight: true` → glow azul permanente na sidebar

### navItem flags
- `hidden: true` — não aparece em lugar nenhum
- `mobileHidden: true` — só no desktop sidebar
- `highlight: true` — glow azul + dot pulsante mesmo sem seleção

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

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ARQUITETURA FUNCIONAL — FLUXOS DE NEGÓCIO
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

> **Seção COMPLEMENTAR** (adicionada em 2026-06-23, verificada no código). Não substitui nada acima —
> apenas detalha o que faltava para tarefas complexas: aprovação, financeiro, produtividade, portal e persistência.
> Onde divergir do texto antigo, **vale o que está aqui** (o resto pode ter ficado defasado).

### 0. Correções de fatos desatualizados

| Tópico | O que o doc antigo diz | Realidade no código |
|---|---|---|
| Roteamento | "React Router DOM v6 (3 rotas)" | `main.tsx` **não usa React Router** no topo — faz match manual de `window.location.pathname` por regex, **6 rotas públicas** (ver seção F). `react-router-dom` está no `package.json` mas só é usado dentro de telas específicas. |
| IA | "/api/ai — Proxy Gemini 2.0 Flash" | `/api/ai` (Gemini, texto) **+** `/api/creative` (geração de imagem, OpenAI, via `CreativeStudio`) |
| Autenticação | só login por avatar/cargo | há também `functions/api/auth.ts` (sessão com `SESSION_SECRET`) e o wrapper `<LoginGate>` em volta do `<App/>` |
| Inventário | ~25 componentes, 5 funções, 4 libs | **68 componentes**, **25 funções**, **11 libs** (ver seção G) |

---

### A. Persistência — a regra mais importante

**Modelo:** `localStorage`-first com **fila de sync offline** que envia pro Cloudflare D1.

```
componente → escreve localStorage → syncToCloud(key, value) → fila sm_sync_queue
   → flush (paralelo, dedup por chave, último valor vence) → POST /api/sync → D1 tabela app_data
```

- **D1 só tem 7 tabelas reais:** `items`, `app_data`, `role_passwords`, `ig_tokens`, `ig_scheduled`, `drive_folders`, `drive_videos`.
- **TODO o resto** (financeiro, comentários, histórico, handoffs, feedback, tokens de portal, produtividade) é **JSON dentro de `app_data`**, numa linha por chave `sm_*`. `app_data` é um key-value: `{ key, value(JSON), updated }`.
- `src/lib/storage.ts` é o coração: `syncToCloud()`, fila, status (`getSyncStatus`/`onSyncStatus` → `SyncIndicator`), `flushQueueBeforeUnload()` via `sendBeacon`, flush automático em `online`/`focus`, e migração v1→v2 (`sm_v2_migrated`).

**Para adicionar dado novo persistente:**
1. Grave em `localStorage` (fonte imediata) **e** chame `syncToCloud('sm_minha_chave', valor)`.
2. Se precisar que ele **volte do servidor entre sessões/aparelhos**, adicione a chave em `SYNC_KEYS` (`storage.ts`). Chaves dinâmicas (ex.: financeiro por mês) sincronizam direto via `syncToCloud`, sem estar em `SYNC_KEYS`.

**Chaves `sm_*` conhecidas** (não exaustivo): `sm_states`, `sm_custom`, `sm_deleted`, `sm_edits`, `sm_roteiros`, `sm_extra_clients`, `sm_hidden_clients`, `sm_client_folders`, `sm_client_colors`, `sm_client_hashtags`, `sm_caption_templates`, `sm_publish_folders`, `sm_client_phones`, `sm_client_groups`, `sm_trafego`, `sm_handoffs`, `sm_pending_assignments`, `sm_activity_log`, `sm_financeiro2_${ANO-MÊS}`, `sm_caixa_empresa`. No D1 ainda existem (gravados pelas Functions): `sm_portal_tokens`, `sm_feedback`, `sm_client_feedback`, `briefing_tokens`, `briefing_${token}`.

---

### B. Controle de acesso por cargo (`src/lib/roles.ts`) — **não documentado antes**

Fonte de verdade das permissões (separado do `NAME_MAP` em `users.ts`, que é só visual).

- **7 cargos:** `socio`, `head`, `social`, `design`, `copy`, `trafego`, `guest`.
- **Mapa `USER_ROLES`:** `pradox`/`testa` = socio · `kaique` = head · `jhones` = design · `kerges` = copy · `arthur` = social · `robson` = trafego. Quem não estiver no mapa cai em **`guest`**.
  - **Nota (jun/2026):** `geovana` saiu da equipe; o `arthur` assumiu "Social media + Tráfego". Já removida do `NAME_MAP`, `USER_ROLES`, da whitelist `VALID_USERS` e do código morto (`GeovanaView` em `MeuDiaTab`).
- **`Permissions`:** `canDelete`, `canBulkDelete`, `canViewFinanceiro`, `canViewEquipe`, `canManageClients`, `canManagePasswords`, `canEditAnyCard`, `canSendToClient`, `canAddItems`, `hiddenTabs[]`.
- **Helpers:** `getUserRole(user)`, `getUserPerms(user)`, `isAdminRole(user)` (= socio ou head).
- **Índices de aba ocultáveis** (de `hiddenTabs`): `11`=Financeiro, `12`=Equipe, `14`=Roteiros, `15`=Tráfego, `16`=Design, `17`=Prospecção. (O mapa completo de abas/índices vive no `App.tsx` — conferir lá ao mexer em navegação.)

> Ao criar qualquer ação destrutiva ou tela sensível, **cheque `getUserPerms(currentUser)` antes de renderizar/permitir**.

---

### C. Fluxo de aprovação (ciclo de vida do status)

**Estados** (`STATUS_CONFIG` em `types.ts`): grupo `internal` (0 Pendente → 1 Em edição → 2 Aprovação interna → 3 Aprovado interno) → grupo `client` (4 Enviado → 5 Aprovado / 6 Reprovado) → `done` (7 Publicado).

**Quem dispara o quê:**
- Transições internas (0→3): equipe, dentro do app (`StatusChip`, `ContentCard`, boards de `ProducaoTab`).
- Ao mudar de status, o app: registra em `activity.ts` (`logActivity`), e **gera um `HandoffNotif`** avisando o próximo responsável (som + sininho + popover; sincroniza via `sm_handoffs`).
- **4 Enviado ao cliente:** gera/usa o token do cliente e o link público de aprovação.
- **5/6 (decisão do cliente):** **vem de fora**, pelo `functions/api/portal.ts` (ver seção F) — não do app.

**Token de aprovação:** **1 token por cliente**, em `sm_portal_tokens = { [clientName]: uuid }` (no D1). O mesmo token serve para todos os itens daquele cliente. `whatsapp.ts → generateApprovalUrl(token, itemId)` monta `${origin}/c/${token}/${itemId}`; `generateApprovalMessage()` monta a mensagem de WhatsApp.

**Campos de `ItemState` ligados à aprovação:** `sentToClientAt`, `approvedByClientAt`, `publishedAt`, `rejectionText`, `approvalToken`, `comments[]` (com `authorType: 'internal' | 'client'`), `history[]`.

**Componentes do fluxo:** `StatusChip` (menu de status), `ContentCard` (histórico/comentários/links), `ApprovalGallery`, `PublishChecklist`, `AssignmentNotification`, `NotificationCenter`.

---

### D. Financeiro (`FinanceiroTab.tsx` + `RentabilidadePanel.tsx`)

**Modelo de dados (`types.ts`, "Financial Module"):**
- `FinanceiroMes = { recorrencia, entradas, saidas, custosFixos }` — o pacote de **um mês**.
- `RecorrenciaEntry` — mensalidade por cliente (`diaCobranca`, `status`, `meioPagamento`; `isTemplate` replica todo mês).
- `CaixaEntrada` / `CaixaSaida` — fluxo de caixa avulso (categoria + meio de pagamento + status).
- `CustoFixo` — custo fixo mensal (`vencimento` = dia do mês; `isTemplate`).
- `CaixaEmpresaEntry` — **caixa da empresa, separado** do operacional (lucro, aporte, investimento, rendimento, retirada…).
- Uniões: `PayStatus` (pago/pendente/atrasado), `MeioPagamento`, `CategoriaEntrada/Saida/Fixo`, `CaixaEmpresaCategoria/Tipo`.

**Persistência (IMPORTANTE — não é uma chave só):**
- Cada mês → **`sm_financeiro2_${ANO-MÊS}`** (ex.: `sm_financeiro2_2026-06`), via `getMonthKey(date)`. Salva em `localStorage` + `sessionStorage` (backup anti-F5) + `syncToCloud`.
- Caixa da empresa → **`sm_caixa_empresa`** (chave única).
- A chave `sm_financeiro` que aparece em `SYNC_KEYS` é **legado** — o módulo atual usa `sm_financeiro2_*`.

**Organização da aba (preservar):** navegação por mês (setas ‹ ›), seções de **recorrência / entradas / saídas / custos fixos**, `auto-overdue` (pendente vira atrasado ao passar o vencimento), e o `RentabilidadePanel` (rentabilidade por cliente). Acesso restrito: `canViewFinanceiro` (só socio/head), aba índice **11**.

**Para adicionar campo/categoria:** estenda a `interface`/união em `types.ts`, trate no `FinanceiroTab.tsx`, e mantenha o save por `saveFinanceiro2(monthKey, data)` (que já faz localStorage+session+sync).

---

### E. Produtividade por colaborador

**`EquipeTab.tsx`** é a tela principal — 2 visões, calculadas a partir de `items` + `states`, atribuindo trabalho por **`states[i].responsible === chaveDoMembro`**:
- **Overview:** por membro → `totalItems`, `done` (status 7), `inProgress` (1–6), `pending` (0), `late` (status<7 e `dt` no passado), `pct`. Agrupa em sócios / operação / tráfego.
- **Performance:** `published`, `late`, `rejected` (6), `onTime` (`publishedAt ≤ dt`), `workload` (status 1–4), `avgSla` (média de dias `sentToClientAt → approvedByClientAt`), e um **`score`** = `publishedPct − late*8 − rejected*12 + onTime*2` (clamp 0–100).

**Fontes de atribuição/medição** (use estas ao criar relatórios de produtividade):
- `ItemState.responsible` (dono do card) e `assignedEditor` (editor do vídeo).
- `ItemState.history[]` (`HistoryEntry { user, action, ts }`).
- `src/lib/activity.ts` — **log de ações** (`ActivityEntry`, `logActivity()`, máx. 500 LIFO em `sm_activity_log`; `ActionType`, `ACTION_LABEL`, `ACTION_EMOJI`) → tela `ActivityLog`.
- `src/lib/assignments.ts` — **fila de atribuições** por usuário (`PendingAssignment`, `sm_pending_assignments`) → `AssignmentNotification`.
- `HandoffNotif` (`sm_handoffs`) — passagens de bastão entre responsáveis.

> ⚠️ **Não confundir:** `PerformanceTab.tsx` é **outra coisa** — métricas de **engajamento pós-publicação** (curtidas/comentários/alcance/saves, **ER%**), edição inline tipo planilha, alimenta o `MonthlyReportModal`. É sobre *resultado do conteúdo*, não sobre produtividade da equipe.

Acesso: `canViewEquipe`, aba índice **12**.

---

### F. Portal do cliente e rotas públicas

**Roteamento real (`main.tsx`, sem login):**

| Rota | Componente | Função/backend | Uso |
|---|---|---|---|
| `/c/:token/:itemId` | `CreativeViewer` | `functions/c/[token]/[itemId].ts` + `/api/portal` | Aprovar **um** criativo |
| `/c/:token` | `ClientPortal` | `/api/portal` | Portal do cliente (todos os itens) |
| `/relatorio/:token` | `ReportPage` | `/api/report` | Relatório mensal público |
| `/briefing/:token` | `BriefingForm` | `/api/briefing` | Cliente preenche briefing |
| `/landing` | `LandingPage` | — | Página de apresentação |
| (qualquer outra) | `<LoginGate><App/></LoginGate>` | `/api/auth`, `/api/role-auth` | O painel interno |

**Três sistemas de token INDEPENDENTES** (atenção ao mexer):
- **Portal/aprovação** (`portal.ts`): `sm_portal_tokens = { [clientName]: uuid }`. Ações: `generate` (cria/retorna), `feedback` (cliente aprova/reprova), `revoke` (regera).
- **Briefing** (`briefing.ts`): `briefing_tokens = { [token]: clientName }` (**mapeamento invertido!**), token = 20 hex. Ações: `generate` / `submit` / `list`. Respostas em `briefing_${token}`.
- **Relatório** (`report.ts`): token próprio para `/relatorio/:token`.

**Como o feedback do cliente volta pro painel** (`portal.ts`, ação `feedback`): grava em `sm_feedback[token][itemId]` **e** `sm_client_feedback[clientName][itemId]`, **muda `sm_states[itemId].status` para 5 (aprovado) ou 6 (reprovado)** + `rejectionText`, e chama `dispatchNotification` (`notifications.ts`) → alerta em tempo real + Web Push (VAPID) pra equipe.

**Segurança:** rotas públicas, sem login; o **token UUID é a única credencial**. `revoke` invalida o link antigo. Nunca expor dado além do cliente daquele token.

---

### G. Inventário de APIs (`functions/`)

| Endpoint | Arquivo | Uso |
|---|---|---|
| `/api/sync` | `sync.ts` | Key-value geral (app_data) ⭐ base de tudo |
| `/api/auth` | `auth.ts` | Sessão (SESSION_SECRET) |
| `/api/role-auth` | `role-auth.ts` | Senha por cargo (SHA-256, `role_passwords`) |
| `/api/portal` | `portal.ts` | Token + feedback do cliente |
| `/api/briefing` | `briefing.ts` | Briefing do cliente |
| `/api/report` | `report.ts` | Relatório público |
| `/api/items` | `items.ts` | Itens (tabela `items`) |
| `/api/notifications` | `notifications.ts` | `dispatchNotification` (tempo real) |
| `/api/push-subscribe` | `push-subscribe.ts` | Inscrição Web Push (VAPID) |
| `/api/ai` | `ai.ts` | Texto (Gemini) |
| `/api/creative` | `creative.ts` | Imagem (OpenAI) → `CreativeStudio` |
| `/api/instagram` | `instagram.ts` | Publicação IG (`ig_tokens`, `ig_scheduled`) |
| `/api/meta-ads` | `meta-ads.ts` | Campanhas Meta (TrafegoTab) |
| `/api/places` `/api/apify` | `places.ts` `apify.ts` | Prospecção (leads Maps) |
| `/api/drive*` | `drive.ts`, `drive-folders.ts`, `drive-scan.ts`, `drive-videos.ts` | Monitor de Drive (`drive_folders`, `drive_videos`) |
| `/api/fetch-doc` | `fetch-doc.ts` | Lê Google Docs (roteiros) |
| `/api/stream` `/v/:id` | `stream.ts`, `v/[id].ts` | Streaming de vídeo |
| (lib interna) | `_lib/google-auth.ts`, `_lib/webpush.ts` | Auth Google (service account) e Web Push |
