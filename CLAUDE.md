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
- Roteamento: **match manual de `window.location.pathname` em `main.tsx`** — `react-router-dom`
  está no `package.json` mas não governa o topo da árvore (detalhe na seção F)
- PWA: Service Worker em `/public/sw.js` — offline + push notifications 7h
- Drag-and-drop: `@dnd-kit/core` + `@dnd-kit/utilities`
- Exportação visual: `html-to-image`

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## DESIGN SYSTEM — DS HUB
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

> ✅ **REDESIGN CONCLUÍDO (2026-07-15): SaaS premium azul/ciano.** Doc reconferido contra o código em 2026-07-17.
> A identidade mudou de "dark premium **laranja**" para **SaaS premium azul/ciano**.
> **Laranja NÃO é mais o acento de marca** — virou cor de alerta/pendência apenas.
> A fonte da verdade é sempre `src/theme.ts` (objeto `DS` + overrides MUI). Muitas
> chaves em `DS` mantêm nomes legados (`orange`, `blue`…) mas seus **valores já são
> o novo sistema azul** — não reverter para laranja.
>
> **Três armadilhas** para quem chega agora:
> 1. **Cards/paper/input são sólidos, sem blur.** Blur só em dialog/drawer/menu/tooltip/bottom-nav.
> 2. **Texto sobre azul é branco**, nunca `#000` — preto só sobre verde/claro.
> 3. **Os labels de status mudaram** ("A fazer", "Em produção"…), mas os valores 0–7 não. Sem migração de dados.

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
| `warning.main` / `DS.amber` | `#F59E0B` | **Atenção, pendência, vence hoje** |
| `DS.alert` | `#F97316` | **Alerta — degrau entre âmbar e vermelho** (atraso curto, 1–3 dias) |
| `error.main` / `DS.red` | `#EF4444` | Reprovado, erro, excluir, atraso crítico |
| `info.main` | `#3B82F6` | Info → azul |

**Escada de urgência** (`DELAY_BORDER`/`DELAY_DOT` em `ProducaoTab.tsx`) — a temperatura **só sobe**:

| Nível | Quando | Cor |
|---|---|---|
| `ok` | no prazo | neutro (branco 20%) |
| `today` | vence hoje | `DS.amber` `#F59E0B` |
| `warning` | 1–3 dias atrasado | `DS.alert` `#F97316` |
| `critical` | 4+ dias atrasado | `DS.red` `#EF4444` |

> `DS.alert` é laranja **de propósito** e não é recaída de marca: o manual permite laranja/âmbar
> para prazo. Não usar `DS.alert` como acento — só para atraso. Antes disso, `warning` usava
> `DS.orange`, que o remap repontou para azul: um card atrasado ficava com a cor de "tudo normal".

#### Cores de Texto
| Token | Valor | Uso |
|---|---|---|
| `text.primary` / `DS.t1` | `#F4F7FF` | Texto principal (branco levemente azulado) |
| `text.secondary` / `DS.t2` | `#94A3B8` | Subtítulos, labels (slate) |
| `text.disabled` / `DS.t3` | `#64748B` | Texto inativo |
| `DS.neutral` | `#94A3B8` | Estrutura, "a fazer", categórico neutro |

> ⚠️ O texto virou **hex slate opaco**, não mais `rgba(255,255,255,α)`. Muitos componentes ainda usam
> `rgba(255,255,255,0.5)` inline — legível, mas fora do token. Ao editar um arquivo, prefira `DS.t1/t2/t3`.

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
| h1 / h2 | 800 | `-0.04em` / `-0.03em` | 1.08 / 1.12 |
| h3 / h4 | 700 | `-0.025em` / `-0.02em` | 1.18 / 1.24 |
| h5 / h6 | 700 / 600 | `-0.015em` / `-0.01em` | 1.30 / 1.35 |
| subtitle1/2 | 500 | `-0.01em` / `-0.005em` | 1.5 |
| body1 | 400 | `-0.011em` | 1.65 |
| body2 | 400 | `-0.006em` | 1.60 |
| overline | 600 | `0.1em` | 2.0 |
| caption | 400 | `0.005em` | 1.5 |
| button | 600 | `-0.01em` | — |

`responsiveFontSizes` aplicado nos breakpoints `md/lg/xl` com `factor: 2.2`.

**Escalas comuns nos componentes:**
- Labels de coluna/header: `0.6–0.7rem`, weight 700, uppercase, letter-spacing 0.08em
- Títulos de card: `0.78–0.88rem`, weight 700
- Subtítulos/meta: `0.58–0.65rem`, color `rgba(255,255,255,0.5)`
- KPIs grandes: `1.6–2.4rem`, weight 900, letter-spacing `-0.03em`
- Badges de status: `0.6–0.68rem`, weight 700

---

### Superfícies e Blur — Padrões de Uso

> ⚠️ **Mudou no redesign:** cards, papers e inputs são **sólidos, SEM blur**. O blur ficou
> reservado a elementos que flutuam sobre o conteúdo (dialog, drawer, menu, tooltip, bottom nav).
> Não reintroduzir `backdropFilter` em card/paper/input.

**Sólidos (sem blur)** — vêm prontos do tema:
```css
/* Card (MuiCard) */
background: #0A1120;                 /* DS.surface */
border: 1px solid #1A2940;           /* DS.border */
borderRadius: 16px;
boxShadow: 0 1px 3px rgba(0,0,0,0.4), 0 4px 14px rgba(0,0,0,0.28);
/* hover */ borderColor: rgba(59,130,246,0.28); transform: translateY(-1px);

/* Paper (MuiPaper) */
background: #0A1120; border: 1px solid #1A2940; borderRadius: 12px;

/* Input/TextField */
background: #0B1322;                 /* DS.field */
fieldset borderColor: #1A2940;  focus: #3B82F6 (1.5px);  borderRadius: 10px;
```

**Elevados (com blur)** — a regra é: quanto mais alto o z-index, maior o blur:
```css
/* Dialog/Modal — blur 40px */
background: rgba(10,17,32,0.99);  border: 1px solid rgba(148,163,184,0.14);  borderRadius: 18px;
boxShadow: 0 4px 8px rgba(0,0,0,0.6), 0 32px 96px rgba(0,0,0,0.9);

/* Drawer/Sidebar — blur 32px */
background: rgba(6,10,19,0.99);  borderRight: 1px solid #1A2940;

/* Menu/Popover — blur 24px */
background: rgba(10,17,32,0.99);  border: 1px solid rgba(148,163,184,0.14);  borderRadius: 12px;

/* BottomNavigation — blur 24px */
background: rgba(6,10,19,0.98);  borderTop: 1px solid #1A2940;  height: 62px;

/* Tooltip — blur 20px */
background: rgba(10,17,32,0.97);  border: 1px solid rgba(148,163,184,0.16);  borderRadius: 8px;
```

---

### Border Radius

| Componente | Valor |
|---|---|
| `shape.borderRadius` (padrão) | `12px` |
| Cards (MuiCard) | `16px` |
| Paper / Menu | `12px` |
| Dialogs | `18px` (mobile <600px: `16px`) |
| Buttons | `10px` (size large: `12px`) |
| IconButtons | `8px` |
| Chips | `7px` |
| Inputs/TextField/Select | `10px` |
| Tooltip | `8px` |
| Pills/badges inline | `6–8px` |
| Dots de status | `50%` |

---

### Scrollbar

Sempre personalizada — fina e discreta. Já vem do `CssBaseline`; não redefinir por página:
```css
scrollbar-width: thin;
scrollbar-color: rgba(59,130,246,0.35) transparent;   /* '*' global */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: rgba(59,130,246,0.24);   /* azul chapado — não é gradiente */
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover { background: #3B82F6; }
```

---

### Sistema de Animações

#### Keyframes Globais — registrados no `CssBaseline` (`theme.ts`)

Disponíveis em **qualquer** componente sem redeclarar. Use estes antes de inventar outro:

| Nome | Uso |
|---|---|
| `fadeInUp` | Entrada padrão: fade + subida de 10px |
| `fadeInScale` | Entrada de modal/badge: fade + scale de 0.94 |
| `slideInLeft` | Entrada lateral: fade + translateX de -12px |
| `glowPulse` | Respiração de opacidade (dots, halos) |
| `countUp` | Número subindo ao atualizar |
| `shimmer` | Texto/superfície com gradiente animado |
| `floatUp` | Flutuação sutil de ±4px |
| `borderGlow` | Borda azul pulsando (destaque de atenção) |

#### Keyframes locais da `SplashScreen.tsx`
Definidos inline no próprio arquivo, **não são globais** — não referenciar de fora:
`logoIn`, `cardSlideUp`, `memberIn`, `welcomeIn`, `quoteIn`, `badgeIn`, `shake`, `dotBounce`, `loadBar`, `fadeInLoad`.

#### Easing padrão para transições de UI
```
cubic-bezier(0.16, 1, 0.3, 1)   → entrada de elementos (spring-like)
ease-in-out                       → respiração, loops
0.18s ease                        → padrão do tema (Button, IconButton, Card)
0.2s / 0.28s ease                 → hover e transições simples em componentes
```

> **Acessibilidade:** o `CssBaseline` já neutraliza animação e transição sob
> `@media (prefers-reduced-motion: reduce)`. Não é preciso tratar caso a caso.

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

**Não estilizar à mão — já vem do tema.** Basta:
```jsx
<Button variant="contained" color="primary">Ação</Button>
```
O que o tema aplica (`containedPrimary`):
```jsx
background: 'linear-gradient(90deg, #3B82F6 0%, #06B6D4 100%)',
color: '#FFFFFF',          // ⚠️ branco — NUNCA #000 sobre azul (falha de contraste)
fontWeight: 700,
borderRadius: 10,
boxShadow: '0 4px 16px rgba(59,130,246,0.28)',
'&:hover': { boxShadow: '0 6px 22px rgba(59,130,246,0.4)', transform: 'translateY(-1px)', filter: 'brightness(1.06)' },
```

> Texto preto só sobrevive em fundo **claro ou verde** (`containedSuccess` usa `#04140C`).
> Sobre azul/ciano o texto é sempre branco — isso já foi corrigido em 22 pontos do código.

#### Botão destrutivo (apagar, remover)
```jsx
sx={{
  background: 'rgba(239,68,68,0.12)',
  border: '1px solid rgba(239,68,68,0.3)',
  color: DS.red,                                  // #EF4444
  '&:hover': { background: 'rgba(239,68,68,0.22)' },
}}
```
> O vermelho foi unificado em `#EF4444` — `#FF4545` e `#FF3B30` não existem mais.

#### Badge de erro/acesso negado
```jsx
sx={{
  display: 'flex', alignItems: 'center', gap: 1.4,
  px: 2, py: 1.1, borderRadius: 2,
  background: 'rgba(239,68,68,0.08)',
  border: '1.5px solid rgba(239,68,68,0.28)',
  animation: 'fadeInScale 0.22s ease both',       // global; badgeIn é local da Splash
}}
```

#### Badge de sucesso/cargo detectado
```jsx
sx={{
  background: `${color}0c`,
  border: `1.5px solid ${color}35`,
  boxShadow: `0 4px 16px ${glow}`,
  animation: 'fadeInScale 0.28s cubic-bezier(0.16,1,0.3,1) both',
}}
```
> `color`/`glow` vêm de `NAME_MAP[user]`. Dentro da `SplashScreen` esses dois snippets usam
> `badgeIn` (local); **fora dela use `fadeInScale`**, que é o keyframe global equivalente.

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
  bgcolor: DS.green, boxShadow: `0 0 6px ${DS.green}`,   // #31D17C
  animation: 'glowPulse 3s ease-in-out infinite',        // keyframe global do tema
}} />
```

> ⚠️ **Débito conhecido:** existe um `@keyframes pulse` redefinido localmente em `App.tsx`,
> `AgendaTab.tsx` e `EditorMode.tsx` — com **três comportamentos diferentes** (anel de boxShadow,
> opacidade 0.45, opacidade 0.3). Ao mexer nesses trechos, migrar para o `glowPulse` global.

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
- Background: `rgba(6,10,19,0.99)` + `backdropFilter: blur(32px)` (via `MuiDrawer`)
- Border-right: `1px solid #1A2940` (`DS.border`)
- NavItem ativo: fundo `rgba(59,130,246,0.12)`, texto `#3B82F6`, barra esquerda azul `2.5px`
- NavItem highlight (Produções): glow azul mesmo sem seleção + dot pulsante
- NavItem hover: `rgba(148,163,184,0.06)`
- **Recolhível**: toggle em chevron, estado persistido em `localStorage['sm_sidebar_collapsed']`
  (`'1'`/`'0'`); quando recolhida, cada item vira tooltip

#### Bottom Nav (Mobile)
- Altura: `62px` · Background `rgba(6,10,19,0.98)` + blur 24px · Ativo: `primary.main` (#3B82F6)
- Abas visíveis no mobile (as que **não** têm `mobileHidden`): **Meu Dia, Hoje, Produções,
  Calendário, Clientes, Gravações, Prospecção**
- ⚠️ Agenda e Dashboard são **desktop-only** — não assumir que estão no mobile

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
2. `hold` → logo grande
3. `login` → logo reduz, card de login sobe (`cardSlideUp`), avatares entram em stagger (`memberIn`)
4. `loading` → overlay escuro com dots bounce (`dotBounce`) + barra de progresso (`loadBar`)
5. `exit` → fade-out global

**Logo tamanhos:**
- Splash (não-login): `{ xs: 210, sm: 270, md: 330, lg: 375, xl: 420 }px`
- Login ativo: `{ xs: 105, sm: 125, md: 155, lg: 175, xl: 190 }px`
- Transição: `transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)'`

**Card de login** (`SplashScreen.tsx` ~206):
- `background: rgba(10,17,32,0.98)`, `backdropFilter: blur(32px)` — azul-escuro, não mais preto quente
- `border: 1px solid rgba(59,130,246,0.14)`
- `boxShadow: 0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(59,130,246,0.04)`
- `borderRadius: { xs: 3, sm: 4 }`
- Estrutura: header (saudação + relógio) → formulário → footer (KPIs + status)

> 📸 **Screenshot da splash:** limpar `sessionStorage` + reload, e congelar as animações com
> `* { animation-delay: -3s; animation-duration: 0.001s }` — `animation: none` esconde os avatares
> (eles entram em stagger).

**Fluxo de autenticação:**
1. Usuário seleciona seu avatar/nome
2. API `POST /api/role-auth { action: 'verify', role }` verifica se cargo tem senha
3. Se `noPassword: true` → entra direto
4. Se tem senha → mostra `RolePasswordForm` com `POST /api/role-auth { action: 'verify', role, password }`
5. Fallback offline: se API cair, entra sem senha

---

### Sistema de Status (v2 — 8 estados)

Definido em `src/types.ts` como `STATUS_CONFIG`:

| Valor | Label | Label curto | Cor | Emoji | Grupo |
|---|---|---|---|---|---|
| 0 | A fazer | A fazer | `#9CA3AF` cinza | ⏳ | internal |
| 1 | Em produção | Produção | `#3B82F6` azul | ✏️ | internal |
| 2 | Revisão interna | Revisão | `#06B6D4` ciano | 👁️ | internal |
| 3 | Pronto p/ enviar | Pronto | `#7C5CFC` roxo | ✅ | internal |
| 4 | Enviado ao cliente | Enviado | `#F59E0B` âmbar | 📤 | client |
| 5 | Aprovado cliente | Aprovado | `#31D17C` verde | 🎉 | client |
| 6 | Ajuste solicitado | Ajuste | `#EF4444` vermelho | 🔄 | client |
| 7 | Publicado | Publicado | `#31D17C` verde | 🚀 | done |
| 8 | Pronto | Pronto | `#31D17C` verde | ✅ | internal |

> ⚠️ **O 8 nasceu depois do 7 mas fica ENTRE o 1 e o 2 no fluxo.** Os valores 0–7 já
> estão gravados no D1 e no localStorage de todo mundo — renumerar quebraria os dados.
> Quem manda na ordem é `STATUS_ORDER = [0, 1, 8, 2, 3, 4, 5, 6, 7]` (em `types.ts`).
> Nunca compare avanço com `status <= 3`; use `isPreClientStatus()`, `statusRank()` ou
> `statusAllowsPreview()`. O `shortLabel` do 3 virou "P/ enviar" para não colidir com "Pronto".

**A escada de cor conta a história:** cinza (parado) → azul → ciano → roxo (avançando internamente)
→ **âmbar** (a bola está com o cliente, é o único quente) → verde (fim feliz) / vermelho (voltou).

**Uso:** sempre referenciar via `STATUS_CONFIG[s].color/shortLabel/label/dot/glow/emoji` — nunca hardcodar.
Os labels mudaram no redesign (era "Pendente"/"Em edição"/"Aprovado interno"…); **não houve migração de dados**,
só os valores 0–7 importam.

---

### Boards de Produções (ProducaoTab)

**6 boards** com colunas e filtros distintos (`const BOARDS` em `ProducaoTab.tsx`):

| Board | `key` | Emoji | Cor | Escopo |
|---|---|---|---|---|
| Vídeo | `vid` | 🎬 | `#60A5FA` azul-claro | Reels e Stories — produção audiovisual |
| Design | `des` | 🎨 | `#C084FC` roxo | Posts, Carrosseis e Feed — criação visual |
| Feed | `fed` | 📸 | `#06B6D4` ciano | Fotos e imagens da empresa |
| Social | `soc` | 📱 | `#31D17C` verde | Conteúdos prontos para programar e publicar |
| Roteiros | `rot` | 📝 | `#FB7185` rosa | Scripts e links para todos os colaboradores |
| Inbox | `drv` | 📥 | `#3B82F6` azul | Vídeos exportados → WhatsApp automático |

> ⚠️ A **aba Roteiros da navegação (índice 14) está `hidden`** — a Central de Roteiros que a
> equipe usa é o board `rot` aqui dentro, não o `RoteirosIdeaTab`.

**Seletor de boards:** não é tab-bar nem MUI Tabs — são **cards espaçosos** (ícone em caixa colorida,
título, descrição + contagem inline). Card ativo ganha contorno/glow azul + dot. Badge **"Minha área"**
aparece via `USER_AREA_BOARD`: `kaique→vid`, `jhones→des`, `kerges→rot`, `arthur→soc`, `robson→soc`.

---

### Convenções Visuais a Seguir Sempre

1. **Nunca fundo branco** — usar `rgba(255,255,255,0.03–0.06)` para superfícies claras
2. **Nunca `border: 1px solid white`** — usar `rgba(255,255,255,0.06–0.12)`
3. **Gradiente azul em CTAs**: `linear-gradient(135deg, #3B82F6, #06B6D4)`, texto branco
4. **Ícones de ação**: tamanho padrão `14–16px`, cor `rgba(255,255,255,0.4)`, hover cor temática
5. **Loading states**: sempre dots bounce ou CircularProgress azul — nunca spinner MUI default cinza
6. **Espaçamento padrão**: `gap: 1` (8px) entre itens similares, `gap: 2` (16px) entre seções
7. **Hover em lista/sidebar**: `bgcolor: rgba(148,163,184,0.06)` leve — nunca highlight forte
8. **Textos de alerta/badge**: uppercase + letter-spacing `0.08em` + weight 700
9. **Transições**: `0.18s ease` (padrão do tema) ou `0.2–0.28s ease` — nunca instantâneo, nunca lento
10. **4K obrigatório**: qualquer `fontSize`, `width`, `height` fixo deve ter variante `xl`
11. **Teclado**: todo `Box onClick` clicável deve usar `clickable(fn)` de `src/shared/a11y.ts`
    (role=button + tabIndex + Enter/Espaço). O anel de foco azul já é global.

---

### O que NÃO fazer

- ❌ `backdropFilter: blur()` em **card, paper ou input** — são sólidos por decisão de design
- ❌ `backdropFilter: blur()` em cards draggáveis (trava GPU)
- ❌ **`color: '#000'` sobre fundo azul/ciano** — texto é branco; preto só sobre verde/claro
- ❌ Reintroduzir laranja como acento — âmbar `#F59E0B` só para alerta/pendência/prazo
- ❌ Importar bibliotecas de UI além de MUI (styled-components, Tailwind, etc.)
- ❌ Criar context/store externo — estado global fica em `App.tsx`
- ❌ Hardcodar cores de status — usar `STATUS_CONFIG`
- ❌ Hardcodar cores de usuário — usar `NAME_MAP[user].color`
- ❌ Hardcodar hex fora do `theme.ts` — usar os tokens `DS.*`
- ❌ Inserir aba no **meio** do `navItems` — os índices são posicionais e quebram `roles.ts`
- ❌ `any` implícito no TypeScript
- ❌ Comentários óbvios no código (só comentar o "porquê", nunca o "o quê")
- ❌ `transform: translateZ(0)` desnecessário — usar `willChange` só durante drag

---

## Estrutura do Projeto

```
├── src/
│   ├── App.tsx                    # Root — estado global, navegação (navItems 0–22), sync, push
│   ├── main.tsx                   # Entry point — match manual de pathname, 7 rotas públicas
│   ├── theme.ts                   # MUI v6 dark theme + tokens DS (fonte da verdade visual)
│   ├── types.ts                   # Todos os tipos TypeScript + STATUS_CONFIG
│   ├── data.ts                    # CLIENTS[] (17) e DATA[] + 7 meses (Mai–Dez 2026, 1.582 itens)
│   ├── lib/
│   │   ├── storage.ts             # localStorage + syncToCloud() + SYNC_KEYS
│   │   ├── users.ts               # NAME_MAP: 7 membros com role/emoji/color/glow (só visual)
│   │   ├── distribution.ts        # Distribuição de roteiros por dia útil
│   │   ├── roles.ts               # Permissões por cargo (fonte da verdade) — ver seção B
│   │   ├── activity.ts            # Log de ações (sm_activity_log)
│   │   ├── assignments.ts         # Fila de atribuições por usuário
│   │   └── whatsapp.ts            # Links de aprovação (cliente + revisão interna) e mensagens
│   ├── shared/
│   │   ├── a11y.ts                # clickable() — role=button + tabIndex + Enter/Espaço
│   │   └── ui/                    # PageHero, KpiCard, EmptyState (kit compartilhado)
│   ├── mobile/                    # Camada mobile premium (framer-motion) — Kanban, TabBar
│   └── components/
│       ├── SplashScreen.tsx       # Login — avatar seleção + per-user password + daily quote
│       ├── AccessManager.tsx      # Gerenciar senhas por cargo (somente Sócio/Head)
│       ├── ContentCard.tsx        # Card expansível: status, link, legenda, notas, histórico
│       ├── StatusChip.tsx         # Chip clicável com menu popover de status
│       ├── TodayTab.tsx           # Aba Hoje: atrasados + publicar hoje + resumo
│       ├── AgendaTab.tsx          # Aba Agenda: próximos 7/15 dias agrupados por data
│       ├── ProducaoTab.tsx        # Aba Produções: 6 boards (Vídeo/Design/Feed/Social/Roteiros/Inbox)
│       ├── KanbanTab.tsx          # Aba Kanban: 8 colunas status v2 (hidden da nav)
│       ├── CalendarTab.tsx        # Aba Calendário: visão mensal com drag-to-reschedule
│       ├── ClientsTab.tsx         # Aba Clientes: progresso Posts/Reels, Drive, roteiros
│       ├── KaiqueTab.tsx          # Dashboard executivo (KPIs, 3 colunas em 4K)
│       ├── RecordingCenter.tsx    # Central de gravações de vídeo
│       ├── EditorMode.tsx         # Aba Editor: painel do editor de vídeo (Kaique)
│       ├── FinanceiroTab.tsx      # Aba Financeiro: gestão de mensalidades + auto-overdue
│       ├── EquipeTab.tsx          # Aba Equipe: visão por membro do time
│       ├── IATab.tsx              # Aba IA: agente de IA para operações em massa
│       ├── RoteirosIdeaTab.tsx    # ⚠️ aba 14, HIDDEN — a Central de Roteiros real é o board 'rot' no ProducaoTab
│       ├── ReviewViewer.tsx       # Revisão interna (rota pública /r/token/id) — grupo do WhatsApp
│       ├── TrafegoTab.tsx         # Aba Tráfego: campanhas pagas (Arthur+Robson)
│       ├── DesignTab.tsx          # Aba Design: Kanban do Jhones — criativos por urgência
│       ├── ClientPortal.tsx       # Portal público de feedback do cliente
│       ├── CreativeViewer.tsx     # Visualizador de criativo (rota pública /c/token/id)
│       ├── AIAgent.tsx            # Agente de IA para operações em massa
│       ├── ScaleAI.tsx            # Modal de chat multi-turn com contexto
│       ├── MonthlyReportModal.tsx # Relatório mensal (todos os 8 status v2)
│       ├── ErrorBoundary.tsx      # Class component — previne tela branca em crash
│       └── ...                    # outros modais e utilitários
├── functions/api/                 # 25 endpoints — inventário completo na seção G
│   ├── role-auth.ts               # Senhas por cargo — SHA-256, D1
│   ├── sync.ts                    # GET/POST sync key-value (app_data) ⭐ base de tudo
│   ├── portal.ts                  # Portal do cliente: tokens + feedback
│   ├── review.ts                  # Revisão interna: token por item + decisão
│   ├── ai.ts                      # Proxy Gemini 2.0 Flash
│   └── schema.sql                 # DDL: items, app_data, role_passwords, ig_*
└── public/sw.js                   # Service Worker: cache + push 7h
```

---

## Equipe (src/lib/users.ts — NAME_MAP)

| Usuário | Cargo (`role`) | Emoji | Cor |
|---|---|---|---|
| pradox | Sócio | 👑 | `#7C5CFC` roxo |
| testa | Sócio | 👑 | `#7C5CFC` roxo |
| kaique | Head · Fundador do painel | 🎬 | `#3B82F6` azul |
| jhones | Design | 🎨 | `#9CA3AF` cinza |
| kerges | Copy | ✍️ | `#9CA3AF` cinza |
| arthur | Social media + Tráfego | 📱 | `#9CA3AF` cinza |
| robson | Gestor de tráfego | 📈 | `#9CA3AF` cinza |

São **7 membros** (não 8). A identidade visual fica no **emoji + tom cool**: sócios roxo (liderança),
Head azul (marca), o resto cinza neutro (`MEMBER_GRAY`). Não voltar a dar cor própria por pessoa —
isso competia com o acento azul.

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

**23 abas (índices 0–22).** Fonte da verdade: o array `navItems` em `App.tsx` (~linha 2074).
Os índices são **posicionais** — inserir uma aba no meio quebra `hiddenTabs` em `roles.ts`.
Para adicionar, **acrescente no fim**.

| Índice | Aba | Desktop | Mobile |
|---|---|---|---|
| 0 | Meu Dia | ✅ | ✅ |
| 1 | Hoje | ✅ | ✅ |
| 2 | Agenda | ✅ | ❌ (Meu Dia cobre) |
| 3 | Kanban | `hidden` | `hidden` |
| 4 | **Produções** ⭐ | ✅ | ✅ |
| 5 | Calendário | ✅ | ✅ |
| 6 | Clientes | ✅ | ✅ |
| 7 | Dashboard | ✅ | ❌ |
| 8 | Timeline | `hidden` | `hidden` (mobileOnly) |
| 9 | Gravações | ✅ | ✅ |
| 10 | Editor | ✅ | ❌ |
| 11 | Financeiro 🔒 | ✅ | ❌ |
| 12 | Equipe 🔒 | ✅ | ❌ |
| 13 | IA | ✅ | ❌ |
| 14 | Roteiros | `hidden` | `hidden` |
| 15 | Tráfego 🔒 | ✅ | ❌ |
| 16 | Design 🔒 | ✅ | ❌ |
| 17 | Prospecção 🔒 | ✅ | ✅ |
| 18 | Studio | ✅ | ❌ |
| 19 | Performance | ✅ | ❌ |
| 20 | Datas | ✅ | ❌ |
| 21 | Radar | ✅ | ❌ |
| 22 | Onboarding | ✅ | ❌ |

🔒 = ocultável por cargo via `hiddenTabs` em `roles.ts` · ⭐ `highlight: true`

### navItem flags
- `hidden: true` — não aparece em lugar nenhum (acessível só por código/atalho)
- `mobileHidden: true` — só no desktop sidebar
- `mobileOnly: true` — só faz sentido no mobile
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
- [x] Relatório mensal automático por WhatsApp — botão "Enviar para todos" no MonthlyReportModal
- [x] Prospecção: 20 templates gastronômicos, funil de conversão, pitch IA especializado
- [x] Modo apresentação: slideshow fullscreen com auto-play, teclado, dot indicators
- [x] Redesign SaaS azul/ciano (2026-07-15) — 6 ondas, concluído
- [x] Revisão interna via grupo do WhatsApp (2026-07-16) — `/r/:token/:itemId` + `/api/review`
- [ ] Meta Ads API: dados reais no TrafegoTab
- [ ] **a11y**: estender `clickable()` de `shared/a11y.ts` aos `Box onClick` restantes —
      os caminhos primários já estão cobertos; faltam cards de conteúdo e chips
      (`ProducaoTab` ~116 onClick, `EditorMode` ~58, `ClientsTab` ~57)
- [ ] **Consistência**: `PageHero` está em 7 de 19 abas — avaliar as scrolláveis restantes
      (não usar em board/ferramenta full-height)
- [ ] **Limpeza**: unificar os 3 `@keyframes pulse` locais no `glowPulse` global;
      renomear as chaves legadas de `DS` (`orange`→`accent`, `violet`→`purple`)

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
| Roteamento | "React Router DOM v6 (3 rotas)" | `main.tsx` **não usa React Router** no topo — faz match manual de `window.location.pathname` por regex, **7 rotas** (ver seção F). `react-router-dom` está no `package.json` mas só é usado dentro de telas específicas. |
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

**Chaves `sm_*` conhecidas** (não exaustivo): `sm_states`, `sm_custom`, `sm_deleted`, `sm_edits`, `sm_roteiros`, `sm_extra_clients`, `sm_hidden_clients`, `sm_client_folders`, `sm_client_colors`, `sm_client_hashtags`, `sm_caption_templates`, `sm_publish_folders`, `sm_client_phones`, `sm_client_groups`, `sm_trafego`, `sm_handoffs`, `sm_pending_assignments`, `sm_activity_log`, `sm_financeiro2_${ANO-MÊS}`, `sm_caixa_empresa`, `sm_sidebar_collapsed` (UI, só local). No D1 ainda existem (gravados pelas Functions): `sm_portal_tokens`, `sm_feedback`, `sm_client_feedback`, `sm_review_tokens`, `sm_review_feedback`, `briefing_tokens`, `briefing_${token}`.

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

#### Do Drive ao grupo de revisão (fluxo do vídeo pronto)

```
editor exporta como "2007 - Unboxing.mp4"  ← nome vem do card (botão 📄 no hover)
  → pasta "Publicar" do cliente (Clientes → 📂; vira drive_folders no sync)
  → /api/drive-scan acha o arquivo → drive_videos (status inbox)
       + reconcilia a PRESENÇA na pasta (app_data `_drive_presence`)
  → toast discreto "Novo arquivo recebido na Inbox." (uma vez por arquivo) + contador
  → o usuário abre a Inbox (board 5 ou painel lateral) e clica "Vincular"
  → LinkVideoDialog: escolha explícita do card (o ID no nome só DESTACA o sugerido)
  → handleLinkVideo grava link + footageLink + upsertMediaLink(itemId, fileId, cliente, etapa)
  → se "mandar para revisão" (checkbox): App → status 2 + /api/review → grupo no WhatsApp
  → revisor abre /r/:token/:itemId → ReviewViewer lê sm_states[id].link → prévia embutida
```

**Princípio (2026-07-21):** *nada de vínculo por palpite, nada de modal que abre sozinho.*
Até esta data o `checkAutoLink` vinculava quando havia "só um Reel pendente do cliente" e
abria o dialog sozinho quando não sabia — em todo fetch, polling e mudança de `states`. Os
dois efeitos colaterais eram os bugs relatados: vídeo de um conteúdo carimbado em card de
outro (inclusive em "A fazer") e o modal reaparecendo por cima do trabalho. Quem vincula
agora é sempre um clique humano.

**Prévia do card — regra única (`src/lib/mediaLinks.ts`, `getCardPreview`):**
só aparece thumbnail quando existe vínculo explícito **para aquele item**, do **mesmo
cliente**, **confirmado**, com o arquivo **presente na pasta Publicar** e o card **em
Revisão interna ou adiante** (`statusAllowsPreview`). Qualquer outro estado vira um selo
discreto ("aguardando publicação" / "vínculo a confirmar"). `state.link` sozinho não gera
mais prévia — ele continua sendo o campo de link do card, nada mais.
Registro persistido em `sm_media_links` (localStorage + `syncToCloud`); estado por arquivo da
Inbox (`seenAt`/`dismissedAt`/`ignoredAt`/`linkedAt`/`remindAt`) em `sm_drive_inbox_state`.

#### Coluna "Pronto" — a esteira (2026-07-21)

```
card arrastado Produção → Pronto (status 8)
  → aba em branco reservada NO GESTO (senão o WhatsApp cai no bloqueador de popup)
  → GET /api/drive-files?client=X — listagem AO VIVO só da pasta registrada do cliente
  → matchCardToFile (src/lib/videoMatch.ts):
      1. ID no nome (DSHUB-5821_… em qualquer posição; "5821 - …" só no começo)
      2. título normalizado EXATO, com resultado ÚNICO
      3. qualquer dúvida → 'ambiguous' → o humano escolhe (ReadyPickerDialog)
  → validação real da prévia: <video preload=metadata src=/api/stream?id=… → loadedmetadata
  → só então: mediaLink + status 2 + ReviewModal + WhatsApp na aba reservada
```

- Serviço: `src/lib/readyAutomation.ts` (fases, lock, idempotência, auditoria no histórico).
  Estado por card em `sm_ready_automation`; `whatsappOpenedAt` e
  `reviewAutomationCompletedAt` ficam no `ItemState` (sincronizado, sobrevive a F5).
- **Boards Vídeo, Design e Feed.** `acceptForContentType`: Reel/Story só casam
  `video/*`; Post/Carrossel/Feed casam `image/*` **ou** `video/*`. A validação segue o
  mime — `<video preload=metadata>` para vídeo, `Image()` para criativo estático.
  Carrossel com várias imagens do mesmo ID cai em `ambiguous` de propósito: quem
  escolhe a capa é o humano. O **Social não tem a coluna** — ele começa na Revisão.
- **Dois modos** (`mode` em `runReadyAutomation`):
  - `interactive` (arraste, "Tentar novamente", "Procurar arquivo") — vai até o fim:
    move para Revisão e abre o WhatsApp na aba reservada no gesto.
  - `background` (revarredura a cada 90s + ao voltar para a aba, enquanto o card
    espera em Pronto) — acha, vincula, valida e **para** em `awaiting_send`
    ("Arquivo encontrado — enviar para revisão"). Não move nem notifica: abrir aba
    exige gesto, e card que anda sozinho sem ninguém receber o link vira revisão que
    não acontece. O clique em "Enviar para revisão" fecha o ciclo.
- Falhou em qualquer etapa? O card **fica em Pronto** com a mensagem e as ações
  (tentar de novo / vincular manualmente / voltar para Produção). Nunca meio-caminho.
- O WhatsApp da revisão é sempre o grupo/telefone do cliente **`Digital Scale`**
  (`REVIEW_CLIENT`), nunca o do cliente final — a página `/r/` tem os botões internos
  de aprovar e pedir ajuste.
- Nome de exportação (botão 📄 no card): `DSHUB-{id}_{TITULO}.mp4`. O formato antigo
  (`5821 - Título.mp4`) continua sendo reconhecido.

> ⚠️ **Nunca automatizar o envio ao cliente.** Até 2026-07-17 havia **dois** caminhos que
> mandavam sozinho: um countdown de 5s na detecção, e o checkbox "Enviar direto para aprovação
> do cliente" (ligado por padrão) no dialog de vínculo — que dizia, literalmente, "pula revisão
> interna". Ambos nasceram antes da revisão interna existir. O envio ao cliente é sempre
> deliberado (`handleSendToClient`, status 3→4).

**Por que o ID só é lido no COMEÇO do nome:** os IDs de julho vão de 2001 a 2226 e o **ano 2026
cai no meio dessa faixa** — procurar o número em qualquer posição faria `reel 2026.mp4` casar
com o item 2026 por acidente. `parseLeadingItemId` ancora em `^` por isso. Não relaxar essa
regex.

**Detecção global (2026-07-22):** a busca do Drive (`useDriveInbox`) e a revarredura da
coluna Pronto (`useReadyEsteira`, `enableSweep`) rodam no **`App.tsx`**, uma vez só, com
**qualquer aba aberta** — desktop e celular. Antes moravam no `ProducaoTab`: quem estivesse
em outra aba não recebia arquivo nenhum. Regras para não duplicar trabalho:
- O poller do `useDriveInbox` é um **singleton com refcount** no módulo — montar o hook de
  novo (board, painel lateral) **não** cria timer nem requisição; só assina o estado.
- Só o App passa `onNewFiles`; o aviso de chegada é o toast global (`setSnack`, agora
  renderizado também no mobile) com ação "Abrir Inbox" → Produções, board 5.
- Os boards montam `useReadyEsteira` com **`enableSweep: false`** — lá o motor serve só aos
  gestos (arraste, "Tentar novamente", seleção manual), que precisam da aba reservada.
- O intervalo da revarredura é ancorado só em `waitingIds`; `startReadyAutomation` entra por
  ref. Sem isso o timer reiniciava a cada mudança de `states` e, no App, nunca chegaria aos 90s.

**Cron (`cron/`) — a esteira sem ninguém olhando:** o poller do painel só existe com alguém
logado. O worker `ds-hub-cron` chama `POST /api/drive-scan` a cada 5 min com
`Authorization: Bearer ${CRON_SECRET}`, e o endpoint dispara **Web Push** para a equipe quando
acha arquivo novo. Mora fora do projeto do painel porque **Pages Functions não aceitam cron
trigger**. Deploy: `npm run deploy:cron`; teste local: `npm run cron:test`.
O `CRON_SECRET` precisa do **mesmo valor nos dois lados** (`wrangler secret put` no worker e
`wrangler pages secret put` no Pages) — sem ele o scan responde 401.

> ⚠️ Até 2026-07-22 o `drive-scan` chamava `writeNotification(env.DB, …)`, um atalho que
> passava só o D1: **sem as chaves VAPID o push nunca saía**, o aviso morria na fila e só
> aparecia para quem abrisse o painel. Agora é `dispatchNotification(env, …)`. Ao criar
> notificação em qualquer Function, **passe o `env` inteiro**.

**Criativo estático na varredura (2026-07-22):** o `drive-scan` aceita `video/*` **e**
`image/*` (constante `MEDIA_FILTER`, usada nas DUAS consultas) e grava `drive_videos.mime_type`.
A tabela mantém o nome histórico "videos" — renomear custaria uma migração por nada.
A coluna nasce sozinha: `ensureColumn` (`functions/api/_lib/schema-guard.ts`) confere o
`PRAGMA` uma vez por isolate e roda o `ALTER TABLE` se faltar — deploy do Pages e migração do
D1 são atos separados, e no intervalo um INSERT com coluna inexistente congelaria a Inbox
inteira. O SQL equivalente fica em `functions/api/migrations/` como registro e caminho manual.
**Só vale para coluna opcional**; mudança que precise de backfill continua sendo migração de verdade.

> ⚠️ Antes disso a **presença** também só listava vídeo — e presença é a prova de que o
> arquivo continua na pasta. Imagem vinculada pela coluna Pronto (Design/Feed) era lida como
> "sumiu da pasta" na varredura seguinte e o card trocava a prévia pelo selo "aguardando
> publicação", com o arquivo intacto no Drive. Ao mexer no filtro de mime, **mexa nos dois
> lugares**: detectar sem enxergar na presença apaga prévia.

**Limites conhecidos:** a checagem de Drive público roda no envio à revisão e é o **único** motivo de
interromper: arquivo privado quebra a prévia do `ReviewViewer` pra quem abre pelo WhatsApp.
A presença na pasta só é conhecida depois de um `/api/drive-scan` — sem ela o registro
mantém a etapa conhecida em vez de apagar prévias (ausência de dado não é prova de remoção).

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
| `/r/:token/:itemId` | `ReviewViewer` | `/api/review` | **Revisão/aprovação INTERNA** (grupo da equipe no WhatsApp) — casado primeiro, antes de `/c/` |
| `/c/:token/:itemId` | `CreativeViewer` | `functions/c/[token]/[itemId].ts` + `/api/portal` | Aprovar **um** criativo (cliente) |
| `/c/:token` | `ClientPortal` | `/api/portal` | Portal do cliente (todos os itens) |
| `/relatorio/:token` | `ReportPage` | `/api/report` | Relatório mensal público |
| `/briefing/:token` | `BriefingForm` | `/api/briefing` | Cliente preenche briefing |
| `/landing` | `LandingPage` | — | Página de apresentação |
| (qualquer outra) | `<LoginGate><App/></LoginGate>` | `/api/auth`, `/api/role-auth` | O painel interno |

**Quatro sistemas de token INDEPENDENTES** (atenção ao mexer):
- **Portal/aprovação do cliente** (`portal.ts`): `sm_portal_tokens = { [clientName]: uuid }` — **1 token por CLIENTE**, serve todos os itens dele. Ações: `generate` (cria/retorna), `feedback` (cliente aprova/reprova), `revoke` (regera).
- **Revisão interna** (`review.ts`): `sm_review_tokens = { [itemId]: uuid }` — ⚠️ **1 token por ITEM**, granularidade diferente do portal. Decisões em `sm_review_feedback`. Ações: `generate` / `decide`; `GET /api/review?token=&itemId=` valida o link e devolve a decisão já tomada. Alimenta o grupo de aprovação interna no WhatsApp.
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
| `/api/review` | `review.ts` | **Revisão interna** — rota `/r/:token/:itemId` (`ReviewViewer`) |
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
