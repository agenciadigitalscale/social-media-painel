/* lib/pesq/brand.ts — Identidade visual do PESQ.
   Fonte única de cor, gradiente, sombra, raio e movimento do módulo.
   Nada de hex solto nos componentes: se uma cor não está aqui, ela não existe
   no PESQ. O `DS` do painel continua valendo fora deste módulo — o ambiente
   PESQ é uma ilha de marca dentro do DS HUB, não uma troca de paleta global.
*/

export const PESQ = {
  // ── Rampa da marca (extraída da logo) ──────────────────────────────
  greenLum:   '#52DC60',   // verde luminoso — acento, foco, publicado
  greenComp:  '#3AC366',   // verde complementar — meio do gradiente
  greenMid:   '#20A96C',   // verde intermediário — botões, barras
  emerald:    '#0B9371',   // esmeralda — superfície ativa, aro
  petrol:     '#008774',   // verde-petróleo — profundidade, ondas
  deep:       '#063A33',   // verde profundo — bordas, cartão elevado
  bg:         '#082D29',   // fundo escuro do ambiente
  light:      '#F4FBF7',   // fundo claro (bolha de WhatsApp, chip claro)
  white:      '#FFFFFF',
  ink:        '#12332E',   // texto principal sobre fundo CLARO
  inkSoft:    '#607A74',   // texto secundário sobre fundo CLARO

  // ── Derivados para fundo ESCURO ────────────────────────────────────
  // Não são cores novas de marca: são tintas do mesmo verde, necessárias
  // porque `ink`/`inkSoft` são ilegíveis sobre `bg` (2,4:1 e 1,6:1).
  // Medidos sobre o CARD (`surface`, #0A3A34), que é onde eles vivem — e não
  // sobre o fundo da página, que é mais escuro e daria um número mais bonito
  // do que a tela entrega. O `t3` já foi #6E9A92: passava sobre `bg` (4,6:1) e
  // reprovava sobre o card (4,02:1), que é justamente onde ele é usado.
  t1:         '#EAF7F1',   // texto principal   — 11,4:1 sobre o card ✅ AAA
  t2:         '#8FB8AE',   // texto secundário  —  5,8:1 sobre o card ✅ AA
  t3:         '#7CA59D',   // metadado discreto —  4,6:1 sobre o card ✅ AA
  onAccent:   '#04231F',   // texto sobre a rampa clara — ver `gradientCta`

  // ── Superfícies ────────────────────────────────────────────────────
  bgDeep:     '#061F1D',   // topo do ambiente / fundo de trás das ondas
  surface:    '#0A3A34',   // card
  surfaceAlt: '#0C443C',   // card elevado / hover
  field:      '#072A26',   // fundo de input
  border:     'rgba(82,220,96,0.14)',   // borda fina padrão
  borderSoft: 'rgba(234,247,241,0.08)', // borda ainda mais discreta
  borderLive: 'rgba(82,220,96,0.42)',   // borda de item ativo/selecionado

  // ── Sinais de status ───────────────────────────────────────────────
  // A marca é monocromática; status precisa de matiz própria para não virar
  // "cinco tons de verde". Todos vêm acompanhados de ícone e rótulo — cor
  // nunca é o único canal (WCAG 1.4.1).
  amber:      '#E8A33D',   // aguardando publicação —  8,0:1 sobre bg
  teal:       '#4FD1C0',   // lembrete enviado      — 10,6:1 sobre bg
  mute:       '#8FB8AE',   // pausado
  ghost:      '#7CA59D',   // cancelado — mesmo valor do `t3` pelo mesmo motivo:
                           // #6E9A92 reprovava em contraste sobre o card
  danger:     '#FF7A70',   // falha no WhatsApp     —  6,9:1 sobre bg
  dangerDeep: '#E5544B',   // falha — borda/ponto (não usar em texto corrido)

  // ── Gradientes ─────────────────────────────────────────────────────
  /** Gradiente institucional. Decorativo — NUNCA colocar texto em cima:
   *  a ponta `petrol` (#008774) deixa o branco em 4,45:1 e o preto em 2,8:1,
   *  os dois abaixo do piso de 4,5:1. */
  gradient:    'linear-gradient(135deg, #52DC60 0%, #20A96C 45%, #008774 100%)',
  /** Gradiente de AÇÃO — para de propósito no verde intermediário, para que
   *  `onAccent` (#04231F) passe em AA na extensão inteira: 9,3:1 no início,
   *  7,2:1 no meio, 5,5:1 no fim. É o que o botão primário usa. */
  gradientCta: 'linear-gradient(135deg, #52DC60 0%, #3AC366 55%, #20A96C 100%)',
  gradientDeep:'linear-gradient(160deg, #082D29 0%, #061F1D 60%, #05201C 100%)',
  /** Brilho que corre pela borda/superfície — usado em hover e no aro do
   *  contador. Transparente nas pontas para não virar faixa dura. */
  sheen: 'linear-gradient(120deg, rgba(82,220,96,0) 0%, rgba(82,220,96,0.16) 45%, rgba(82,220,96,0) 70%)',

  // ── Sombras ────────────────────────────────────────────────────────
  shadow:     '0 1px 2px rgba(3,20,17,0.5), 0 10px 30px rgba(3,20,17,0.45)',
  shadowUp:   '0 4px 10px rgba(3,20,17,0.5), 0 22px 54px rgba(3,20,17,0.6)',
  shadowGlow: '0 10px 34px rgba(11,147,113,0.34)',

  // ── Raios ──────────────────────────────────────────────────────────
  r:   { chip: 8, pill: 999, card: 18, sheet: 22, field: 12, logo: 14 },

  // ── Movimento ──────────────────────────────────────────────────────
  ease:  'cubic-bezier(0.16, 1, 0.3, 1)',
  soft:  'cubic-bezier(0.4, 0, 0.2, 1)',
  fast:  '0.16s',
  base:  '0.24s',
  slow:  '0.42s',
} as const

/** Caminho público da logo. Um lugar só: se o arquivo mudar de nome, muda aqui. */
export const PESQ_LOGO = '/brand/pesq-logo.png'

/**
 * Keyframes do módulo. Ficam locais (injetados por `<GlobalStyles>` na raiz do
 * PESQ) e não no `theme.ts`: são movimento de marca deste ambiente, e o painel
 * inteiro não precisa carregá-los. Mesma decisão da `SplashScreen`.
 *
 * O `CssBaseline` do tema já neutraliza animação sob `prefers-reduced-motion`,
 * então não é preciso repetir a mídia-query em cada uso.
 */
export const pesqKeyframes = {
  '@keyframes pesqRise': {
    from: { opacity: 0, transform: 'translateY(14px)' },
    to:   { opacity: 1, transform: 'none' },
  },
  '@keyframes pesqPop': {
    from: { opacity: 0, transform: 'scale(0.94)' },
    to:   { opacity: 1, transform: 'scale(1)' },
  },
  '@keyframes pesqPulse': {
    '0%, 100%': { opacity: 1,    transform: 'scale(1)' },
    '50%':      { opacity: 0.45, transform: 'scale(0.82)' },
  },
  '@keyframes pesqHalo': {
    '0%, 100%': { opacity: 0.35, transform: 'scale(1)' },
    '50%':      { opacity: 0.75, transform: 'scale(1.12)' },
  },
  '@keyframes pesqSheen': {
    from: { backgroundPosition: '-140% 0' },
    to:   { backgroundPosition: '240% 0' },
  },
  '@keyframes pesqDrift': {
    '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
    '50%':      { transform: 'translate3d(2.5%, -3%, 0) scale(1.06)' },
  },
  '@keyframes pesqDriftAlt': {
    '0%, 100%': { transform: 'translate3d(0,0,0) scale(1.04)' },
    '50%':      { transform: 'translate3d(-3%, 2.5%, 0) scale(1)' },
  },
  '@keyframes pesqDraw': {
    from: { strokeDashoffset: 320 },
    to:   { strokeDashoffset: 0 },
  },
  '@keyframes pesqCheck': {
    '0%':   { strokeDashoffset: 44, opacity: 0 },
    '30%':  { opacity: 1 },
    '100%': { strokeDashoffset: 0, opacity: 1 },
  },
  '@keyframes pesqRipple': {
    from: { opacity: 0.55, transform: 'scale(0.6)' },
    to:   { opacity: 0,    transform: 'scale(2.2)' },
  },
  '@keyframes pesqShimmer': {
    from: { backgroundPosition: '-260px 0' },
    to:   { backgroundPosition: '460px 0' },
  },
} as const
