import { createTheme, responsiveFontSizes, type ThemeOptions } from '@mui/material/styles'

// ── Design tokens DS HUB — identidade Digital Scale (laranja/amarelo) ────────
// 2026-09-28: o painel voltou para a identidade da agência — a MESMA do Painel
// de Tráfego (painel-facebook) e da capa (splash): grafite neutro, laranja
// #FF7A00 como acento e amarelo #FFD400 como segundo acento. O azul/ciano de
// 2026-07-15 saiu. Texto sobre laranja é ESCURO (DS.onAccent), nunca branco:
// branco sobre #FF7A00 dá 2,6:1 e reprova na WCAG.
// NOTA DE NOMES: as chaves são legadas (orange/cyan/blue…) — `cyan` hoje é o
// amarelo de apoio. Mantemos os
// nomes para não reescrever 78 arquivos de uma vez; uma onda de limpeza futura
// pode renomear. Nunca hardcodar hex fora daqui — usar sempre DS.*.
export const DS = {
  // === Acento de marca: laranja Digital Scale ===
  orange:    '#FF7A00',          // laranja principal — ações, destaques
  orangeDim: '#FF9A36',          // laranja claro (hover, chip suave, número em destaque)
  accent:    '#FF7A00',          // alias semântico
  accentStrong: '#DB5F00',       // laranja forte (pressed, ênfase)
  cyan:      '#FFD400',          // (legado "cyan") amarelo — segundo acento (decoração, dots, bordas)
  onAccent:  '#120B05',          // texto SOBRE laranja/amarelo — escuro, ~8:1 de contraste

  /* ── Gradiente de AÇÃO ────────────────────────────────────────────────
     O gradiente de marca (#3B82F6 → #06B6D4) é bonito e ILEGÍVEL sob texto
     branco: medido em 2026-09-03 pela WCAG 2.1, vai de 3,68:1 na ponta azul a
     2,43:1 na ponta ciano. O piso é 4,5 para texto normal e 3,0 para texto
     grande — a metade direita do botão não passa nem no piso frouxo. E isso é
     o botão primário do painel inteiro: "Enviar ao cliente", "Salvar",
     "Confirmar", em toda tela.

     Este par é o MESMO azul→ciano, dois degraus mais escuro. Pior ponto do
     gradiente com branco: 5,41:1 — passa em AA na extensão inteira.

     ⚠ NÃO substitui accent/cyan. Onde o gradiente é DECORAÇÃO — a linha de
     2px no topo do card, o título com background-clip:text, o halo —
     escurecer apagaria a identidade sem ganhar legibilidade nenhuma, porque
     não há texto branco em cima. Use ctaGradient() só quando houver rótulo. */
  ctaFrom:   '#FF7A00',
  ctaTo:     '#FF9500',
  // Categóricos de apoio. Eram roxo/rosa; viraram cinza claro neutro para o
  // painel ter só grafite + laranja/amarelo + status (padrão do painel-facebook).
  // Quem diferencia área/categoria agora é o ÍCONE e o rótulo, não a cor.
  purple:    '#C8CED8',
  purpleSoft:'#C8CED8',
  pink:      '#C8CED8',

  // === Superfícies ===
  bg:        '#090A0D',          // fundo principal (grafite)
  bgSidebar: '#0B0C10',          // fundo da sidebar
  surface:   '#101217',          // cards / papers
  surfaceAlt:'#15181F',          // superfície secundária (headers, hovers)
  field:     '#0B0D11',          // fundo de campos (inputs)

  // === Bordas ===
  border:    '#292D36',          // borda principal
  borderSoft:'rgba(146,152,165,0.12)', // borda suave
  borderHov: 'rgba(255,122,0,0.42)',   // borda hover (laranja)
  glow:      'rgba(255,122,0,0.14)',   // glow sutil laranja
  grid:      'rgba(255,255,255,0.025)', // grid de fundo

  // === Texto ===
  t1: '#F7F7F5',                 // principal
  t2: '#9298A5',                 // secundário (cinza neutro)
  t3: '#6F7785',                 // discreto
  t4: '#4A505C',                 // metadado / índice silencioso

  // === Semânticas ===
  neutral: '#9298A5',            // estrutura, "a fazer", categórico neutro
  green:   '#20D878',            // sucesso (aprovado / publicado)
  greenDim:'#22A866',            // sucesso escuro
  red:     '#EF4444',            // crítico (atraso, ajuste, erro)
  redSoft: '#FF8080',            // vermelho de TEXTO — o #EF4444 puro é duro
                                 // demais em corpo de texto sobre fundo escuro.
                                 // Usar em mensagem de erro e texto de recusa.
  amber:   '#FFB52E',            // ATENÇÃO / pendência / prazo próximo
  alert:   '#FF5F6D',            // ALERTA — degrau entre âmbar e vermelho (atraso curto).
                                 // Deixou de ser laranja: laranja agora é a MARCA, e um
                                 // alerta com a cor do botão principal confundiria.

  // === Legado repontado (info azul, categórico roxo) ===
  blue:     '#C8CED8',           // (legado) info → cinza claro neutro
  blueSoft: '#C8CED8',           // (legado) "pronto"/agendado → cinza claro neutro
  violet:   '#C8CED8',           // (legado) categórico → cinza claro neutro
}

/**
 * O gradiente dos botões que CARREGAM TEXTO.
 *
 * Ponto único de propósito: o par claro estava reproduzido à mão em dezenas de
 * arquivos, e corrigir contraste um por um seria garantir que alguns ficassem
 * para trás. O ângulo é parâmetro porque o projeto usa 90deg em barra e 135deg
 * em botão — é estética, não muda o contraste.
 */
// Painel sóbrio (2026-09-29): o botão de ação é LISO, na cor da marca — sem
// degradê. O nome ficou para não mexer em 37 chamadas; o ângulo não é mais usado.
export const ctaGradient = (_deg = 135): string => DS.accent

// Cores de MARCAS EXTERNAS. Ficam fora do DS de propósito: não são nossas, não
// respondem ao nosso sistema e não devem ser trocadas numa mudança de paleta —
// o verde do WhatsApp continua sendo o verde do WhatsApp. Só usar quando a cor
// serve para IDENTIFICAR o serviço (ícone, botão de compartilhar, aba do canal).
export const BRAND = {
  whatsapp:     '#25D366',
  whatsappDark: '#128C7E',       // fim do gradiente do botão de WhatsApp
  instagram:    '#E1306C',
  facebook:     '#1877F2',
  google:       '#EA4335',
  tiktok:       '#00F2EA',
}

// Cor por tipo de conteúdo — neutro (slate), info secundária que não compete
// com o acento azul.
export function typeColor(_tp: string): string {
  return DS.neutral
}

export const themeOptions: ThemeOptions = {
  breakpoints: {
    values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1920 },
  },

  palette: {
    mode: 'dark',
    primary:    { main: DS.accent, light: DS.orangeDim, dark: DS.accentStrong },
    secondary:  { main: DS.cyan },
    background: { default: DS.bg, paper: DS.surface },
    success:    { main: DS.green },
    warning:    { main: DS.amber },
    error:      { main: DS.red },
    info:       { main: DS.accent },
    text: {
      primary:   DS.t1,
      secondary: DS.t2,
      disabled:  DS.t3,
    },
    divider: DS.border,
  },

  typography: {
    // "Noto Emoji" (monocromática) logo depois da Inter: emoji vira ícone de
    // traço na cor do texto em vez do emoji colorido do sistema.
    fontFamily: '"Inter", "Noto Emoji", system-ui, -apple-system, sans-serif',
    fontWeightLight:   300,
    fontWeightRegular: 400,
    fontWeightMedium:  500,
    fontWeightBold:    700,
    h1: { fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.08 },
    h2: { fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.12 },
    h3: { fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.18 },
    h4: { fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.24 },
    h5: { fontWeight: 700, letterSpacing: '-0.015em', lineHeight: 1.3 },
    h6: { fontWeight: 600, letterSpacing: '-0.01em',  lineHeight: 1.35 },
    subtitle1: { fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.5 },
    subtitle2: { fontWeight: 500, letterSpacing: '-0.005em', lineHeight: 1.5 },
    body1: { fontWeight: 400, letterSpacing: '-0.011em', lineHeight: 1.65 },
    body2: { fontWeight: 400, letterSpacing: '-0.006em', lineHeight: 1.6  },
    caption: { fontWeight: 400, letterSpacing: '0.005em', lineHeight: 1.5 },
    overline: { fontWeight: 600, letterSpacing: '0.1em', lineHeight: 2 },
    button: { fontWeight: 600, letterSpacing: '-0.01em' },
  },

  shape: { borderRadius: 12 },

  components: {
    // ── Base global ──────────────────────────────────────────────────────────
    MuiCssBaseline: {
      styleOverrides: {
        '*, *::before, *::after': { boxSizing: 'border-box' },
        html: { WebkitTextSizeAdjust: '100%' },
        body: {
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          textRendering: 'optimizeLegibility',
          fontFeatureSettings: '"cv01","cv02","cv03","cv04","ss01"',
          // Pede a forma de TEXTO do emoji (monocromática) — reforça a Noto Emoji
          // da pilha de fontes nos navegadores que já entendem a propriedade.
          fontVariantEmoji: 'text',
          background: DS.bg,
          scrollbarColor: `rgba(247,247,245,0.16) transparent`,
          '&::-webkit-scrollbar':       { width: 4, height: 4 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: `rgba(247,247,245,0.16)`,
            borderRadius: 4,
            '&:hover': { background: 'rgba(247,247,245,0.32)' },
          },
        },
        // ── Keyframes globais ────────────────────────────
        '@keyframes fadeInUp': {
          from: { opacity: 0, transform: 'translateY(10px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
        '@keyframes fadeInScale': {
          from: { opacity: 0, transform: 'scale(0.94)' },
          to:   { opacity: 1, transform: 'scale(1)' },
        },
        '@keyframes slideInLeft': {
          from: { opacity: 0, transform: 'translateX(-12px)' },
          to:   { opacity: 1, transform: 'translateX(0)' },
        },
        '@keyframes glowPulse': {
          '0%,100%': { opacity: 0.5 },
          '50%':     { opacity: 1 },
        },
        '@keyframes countUp': {
          from: { transform: 'translateY(8px)', opacity: 0 },
          to:   { transform: 'translateY(0)', opacity: 1 },
        },
        '@keyframes shimmer': {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        // Card recém-chegado numa coluna: um halo que acende e apaga.
        // O Kanban desmonta e remonta o card ao trocar de coluna, então este é o
        // único sinal de que ele se moveu.
        '@keyframes arrivalGlow': {
          '0%':   { boxShadow: '0 0 0 0 rgba(49,209,124,0)' },
          '18%':  { boxShadow: '0 0 0 2px rgba(49,209,124,0.55), 0 6px 22px rgba(49,209,124,0.28)' },
          '100%': { boxShadow: '0 0 0 0 rgba(49,209,124,0)' },
        },
        '@keyframes floatUp': {
          '0%,100%': { transform: 'translateY(0)' },
          '50%':     { transform: 'translateY(-4px)' },
        },
        '@keyframes borderGlow': {
          '0%,100%': { borderColor: 'rgba(255,122,0,0.18)' },
          '50%':     { borderColor: 'rgba(255,122,0,0.45)' },
        },
        // Scrollbar cross-browser
        '*': {
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(247,247,245,0.16) transparent',
        },
        // Foco visível para navegação por teclado — anel azul só quando o foco
        // vem do teclado (:focus-visible), nunca no clique de mouse.
        '[role="button"]:focus-visible, [tabindex]:focus-visible, a:focus-visible': {
          outline: `2px solid ${DS.accent}`,
          outlineOffset: '2px',
          borderRadius: '8px',
        },
        ':focus:not(:focus-visible)': { outline: 'none' },
        // cursor de clique em elementos sem botão nativo
        '[role="button"]': { cursor: 'pointer', touchAction: 'manipulation' },
        'button, .MuiButtonBase-root, .MuiIconButton-root, .MuiListItemButton-root, .MuiMenuItem-root': {
          cursor: 'pointer',
          touchAction: 'manipulation',
          transition: 'background 0.18s ease, color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease',
          WebkitTapHighlightColor: 'transparent',
        },
        // Respeita a preferência do sistema por menos movimento (acessibilidade):
        // neutraliza animações decorativas (mesh, órbitas, shimmer, confete…),
        // mantendo o conteúdo funcional. Não toca em lógica.
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.001ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.001ms !important',
            scrollBehavior: 'auto !important',
          },
        },
      },
    },

    // ── Card — sólido, limpo, sem blur ───────────────────────────────────────
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          background: DS.surface,
          border: `1px solid ${DS.border}`,
          borderRadius: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 4px 14px rgba(0,0,0,0.28)',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease, transform 0.18s ease',
          willChange: 'transform, box-shadow',
          '&:hover': {
            borderColor: 'rgba(255,122,0,0.28)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4), 0 10px 28px rgba(0,0,0,0.34)',
            transform: 'translateY(-1px)',
          },
        },
      },
    },

    // ── Paper — sólido, sem blur ──────────────────────────────────────────────
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          background: DS.surface,
          borderRadius: 12,
          border: `1px solid ${DS.border}`,
          transition: 'border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease, background 0.18s ease',
        },
        elevation0: { boxShadow: 'none', border: `1px solid ${DS.border}` },
        elevation1: { boxShadow: '0 1px 4px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.25)' },
        elevation2: { boxShadow: '0 2px 8px rgba(0,0,0,0.35), 0 8px 24px rgba(0,0,0,0.28)' },
        elevation8: { boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 24px 64px rgba(0,0,0,0.4)' },
      },
    },

    // ── Dialog — mantém blur (elemento elevado) ───────────────────────────────
    MuiDialog: {
      styleOverrides: {
        paper: {
          background: 'rgba(16,18,23,0.99)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          borderRadius: 18,
          border: `1px solid rgba(146,152,165,0.14)`,
          boxShadow: `0 4px 8px rgba(0,0,0,0.6), 0 32px 96px rgba(0,0,0,0.9)`,
          // Mobile (<600px): dialog usa quase toda a tela — sem estourar nem ficar apertado
          '@media (max-width:599.95px)': {
            margin: 12,
            width: 'calc(100% - 24px)',
            maxWidth: 'calc(100% - 24px)',
            maxHeight: 'calc(100% - 24px)',
            borderRadius: 16,
          },
        },
      },
    },

    // ── Button — sistema único (primário/secundário/ghost/sucesso/perigo) ───────
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 10,
          letterSpacing: '-0.01em',
          transition: 'all 0.18s ease',
          '&.Mui-disabled': { opacity: 0.42 },
        },
        sizeLarge:  { fontSize: '0.92rem', padding: '10px 22px', borderRadius: 12 },
        sizeMedium: { fontSize: '0.84rem', padding: '8px 16px' },
        sizeSmall:  { fontSize: '0.76rem', padding: '4px 12px' },
        contained: {
          boxShadow: `0 1px 4px rgba(0,0,0,0.3)`,
          '&:hover': {
            boxShadow: `0 4px 16px ${DS.glow}, 0 2px 8px rgba(0,0,0,0.4)`,
            transform: 'translateY(-1px)',
            filter: 'brightness(1.06)',
          },
          '&:active': {
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            transform: 'scale(0.98)',
          },
        },
        // Primário = CTA da marca (gradiente laranja) — texto escuro, vem do tema
        containedPrimary: {
          background: ctaGradient(90),
          color: DS.onAccent,
          fontWeight: 700,
          boxShadow: `0 4px 16px rgba(255,122,0,0.32)`,
          '&:hover': {
            background: ctaGradient(90),
            boxShadow: `0 6px 22px rgba(255,122,0,0.45)`,
            filter: 'brightness(1.12)',
          },
        },
        containedSuccess: { color: '#04140C', fontWeight: 700 },
        containedError:   { color: '#fff',    fontWeight: 700 },
        // Secundário
        outlined: {
          borderColor: DS.border,
          color: DS.t1,
          '&:hover': {
            borderColor: DS.borderHov,
            background: `rgba(255,122,0,0.06)`,
          },
        },
        // Ghost
        text: {
          color: DS.t1,
          '&:hover': { background: `rgba(255,122,0,0.08)` },
        },
      },
    },

    // ── IconButton ────────────────────────────────────────────────────────────
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          transition: 'background 0.18s ease, color 0.18s ease, transform 0.18s ease',
          touchAction: 'manipulation',
          '&:hover': { background: `rgba(255,122,0,0.1)` },
          '&:active': { transform: 'scale(0.94)' },
        },
      },
    },

    // ── Chip ──────────────────────────────────────────────────────────────────
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          letterSpacing: '-0.01em',
          borderRadius: 7,
          fontSize: '0.72rem',
          border: `1px solid transparent`,
          transition: 'background 0.18s ease, color 0.18s ease, transform 0.18s ease',
          '&:hover': { transform: 'scale(0.99)' },
        },
        label: { paddingLeft: 10, paddingRight: 10 },
        colorPrimary: {
          background: `rgba(255,122,0,0.12)`,
          color: DS.orangeDim,
          borderColor: `rgba(255,122,0,0.28)`,
        },
        colorSuccess: {
          background: 'rgba(49,209,124,0.1)',
          color: DS.green,
          borderColor: 'rgba(49,209,124,0.2)',
        },
        colorError: {
          background: 'rgba(239,68,68,0.1)',
          color: DS.red,
          borderColor: 'rgba(239,68,68,0.2)',
        },
        colorWarning: {
          background: 'rgba(255,181,46,0.1)',
          color: DS.amber,
          borderColor: 'rgba(255,181,46,0.2)',
        },
      },
    },

    // ── TextField ─────────────────────────────────────────────────────────────
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            fontWeight: 400,
            letterSpacing: '-0.01em',
            borderRadius: 10,
            background: DS.field,
            '& fieldset': {
              borderColor: DS.border,
              transition: 'border-color 0.2s',
            },
            '&:hover:not(.Mui-focused) fieldset': { borderColor: `rgba(146,152,165,0.28)` },
            '&.Mui-focused fieldset': { borderColor: DS.accent, borderWidth: '1.5px' },
          },
          '& .MuiInputLabel-root': {
            letterSpacing: '-0.01em',
            fontWeight: 400,
            color: DS.t2,
            '&.Mui-focused': { color: DS.accent },
          },
          '& .MuiFormHelperText-root': { color: DS.t3 },
        },
      },
    },

    // ── Select ────────────────────────────────────────────────────────────────
    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: DS.border },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: `rgba(146,152,165,0.28)` },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: DS.accent },
        },
      },
    },

    // ── Divider ───────────────────────────────────────────────────────────────
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: DS.border, borderBottomWidth: '0.5px' },
      },
    },

    // ── Tooltip — mantém blur ─────────────────────────────────────────────────
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          background: 'rgba(16,18,23,0.97)',
          backdropFilter: 'blur(20px)',
          border: `1px solid rgba(146,152,165,0.16)`,
          borderRadius: 8,
          fontSize: '0.72rem',
          fontWeight: 400,
          padding: '6px 10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          color: DS.t1,
        },
        arrow: { color: 'rgba(16,18,23,0.97)' },
      },
    },

    // ── LinearProgress ────────────────────────────────────────────────────────
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 6, overflow: 'hidden',
          background: 'rgba(146,152,165,0.1)',
        },
        bar: { borderRadius: 6 },
      },
    },

    // ── Table ─────────────────────────────────────────────────────────────────
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${DS.border}`,
          color: DS.t1,
          padding: '10px 16px',
        },
        head: {
          color: DS.t2,
          fontWeight: 700,
          fontSize: '0.72rem',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          background: 'rgba(146,152,165,0.03)',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background 0.15s',
          '&:hover': { background: `rgba(255,122,0,0.04)` },
          '&:last-child td': { borderBottom: 0 },
        },
      },
    },

    // ── List / ListItemButton ─────────────────────────────────────────────────
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 9,
          transition: 'background 0.15s ease, transform 0.18s ease',
          touchAction: 'manipulation',
          '&.Mui-selected': {
            background: `rgba(255,122,0,0.12)`,
            borderLeft: `2.5px solid ${DS.accent}`,
            '&:hover': { background: `rgba(255,122,0,0.16)` },
          },
          '&:hover': { background: `rgba(146,152,165,0.06)` },
          '&:active': { transform: 'scale(0.99)' },
        },
      },
    },

    // ── Drawer — mantém blur ──────────────────────────────────────────────────
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: 'rgba(9,10,13,0.99)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          borderRight: `1px solid ${DS.border}`,
        },
      },
    },

    // ── Alert ─────────────────────────────────────────────────────────────────
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          border: `1px solid transparent`,
        },
        standardSuccess: { background: 'rgba(49,209,124,0.08)', borderColor: 'rgba(49,209,124,0.2)' },
        standardError:   { background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)' },
        standardWarning: { background: 'rgba(255,181,46,0.08)', borderColor: 'rgba(255,181,46,0.2)' },
        standardInfo:    { background: `rgba(255,122,0,0.08)`, borderColor: `rgba(255,122,0,0.2)` },
      },
    },

    // ── Tabs ──────────────────────────────────────────────────────────────────
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '0.82rem',
          letterSpacing: '-0.01em',
          minHeight: 40,
          '&.Mui-selected': { color: DS.accent, fontWeight: 700 },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { background: DS.accent, borderRadius: 2, height: 2.5 },
      },
    },

    // ── Slider ────────────────────────────────────────────────────────────────
    MuiSlider: {
      styleOverrides: {
        root: { padding: '10px 0' },
        rail:  { opacity: 0.15, borderRadius: 4 },
        track: { borderRadius: 4, border: 'none' },
        thumb: {
          borderRadius: '50%',
          '&:hover': { boxShadow: `0 0 0 6px rgba(255,122,0,0.14)` },
          '&.Mui-active': { boxShadow: `0 0 0 8px rgba(255,122,0,0.2)` },
        },
      },
    },

    // ── BottomNavigation — mantém blur ────────────────────────────────────────
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          height: 62,
          background: 'rgba(9,10,13,0.98)',
          backdropFilter: 'blur(24px)',
          borderTop: `1px solid ${DS.border}`,
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          minWidth: 0,
          color: DS.t2,
          transition: 'color 0.18s ease, transform 0.18s ease',
          '&.Mui-selected': { color: DS.accent },
          '&:active': { transform: 'scale(0.98)' },
        },
        label: { fontWeight: 500, fontSize: '0.6rem', letterSpacing: '0.04em' },
      },
    },

    // ── Menu / Popover — mantém blur ──────────────────────────────────────────
    MuiMenu: {
      styleOverrides: {
        paper: {
          background: 'rgba(16,18,23,0.99)',
          backdropFilter: 'blur(24px)',
          border: `1px solid rgba(146,152,165,0.14)`,
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: '0.82rem',
          borderRadius: 7,
          margin: '1px 4px',
          transition: 'background 0.15s ease, color 0.15s ease, transform 0.18s ease',
          touchAction: 'manipulation',
          '&:hover': { background: `rgba(146,152,165,0.08)` },
          '&:active': { background: `rgba(146,152,165,0.12)`, transform: 'scale(0.995)' },
          '&.Mui-selected': {
            background: `rgba(255,122,0,0.12)`,
            '&:hover': { background: `rgba(255,122,0,0.17)` },
          },
        },
      },
    },
  },
}

const base = createTheme(themeOptions)
const theme = responsiveFontSizes(base, { breakpoints: ['md', 'lg', 'xl'], factor: 2.2 })
export default theme
