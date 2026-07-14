import { createTheme, responsiveFontSizes, type ThemeOptions } from '@mui/material/styles'

// ── Design tokens Digital Scale — visual limpo dark premium ──────────────────
export const DS = {
  orange:    '#F97316',          // laranja principal — ações, destaques
  orangeDim: '#FF9039',          // laranja suave (hover, chip)
  bg:        '#08090E',          // fundo cooler dark — menos quente
  surface:   'rgba(12,14,20,0.98)',  // cards/papers — sólido, limpo
  surfaceAlt:'rgba(15,17,24,0.98)',  // superfície alternativa (sidebar)
  border:    'rgba(255,255,255,0.07)', // borda neutra — não tintada com cor
  borderHov: 'rgba(249,115,22,0.22)', // borda hover laranja
  glow:      'rgba(249,115,22,0.12)', // glow sutil
  grid:      'rgba(255,255,255,0.012)',// grid de fundo (muito sutil)
  // Texto
  t1: 'rgba(255,255,255,0.92)',
  t2: 'rgba(255,255,255,0.50)',
  t3: 'rgba(255,255,255,0.26)',
  // Semânticas — fonte única (badges de tipo, prazo, alertas). Nunca hardcodar hex fora daqui.
  neutral: '#9CA3AF',   // estrutura, "a fazer", secundário
  amber:   '#F59E0B',   // em produção, atenção
  blue:    '#3B82F6',   // revisão interna, info
  blueSoft:'#60A5FA',   // pronto p/ enviar, agendado
  green:   '#22C55E',   // aprovado
  greenDim:'#4E9E76',   // publicado (verde apagado — estado "done" quieto)
  red:     '#EF4444',   // atraso, ajuste solicitado, erro
  violet:  '#A78BFA',   // categórico (Story)
}

// Cor por tipo de conteúdo — categórico, dentro da rampa (sem cores novas soltas)
export function typeColor(tp: string): string {
  if (tp === 'Reel')  return DS.blueSoft
  if (tp === 'Story') return DS.violet
  if (tp === 'Video' || tp === 'Feed') return DS.green
  return DS.orange // Post, Carrossel
}

export const themeOptions: ThemeOptions = {
  breakpoints: {
    values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1920 },
  },

  palette: {
    mode: 'dark',
    primary:    { main: DS.orange, light: DS.orangeDim, dark: '#EA6A0A' },
    secondary:  { main: 'rgba(255,255,255,0.1)' },
    background: { default: DS.bg, paper: DS.surface },
    success:    { main: '#22C55E' },
    warning:    { main: '#F59E0B' },
    error:      { main: '#EF4444' },
    info:       { main: DS.orange },
    text: {
      primary:   DS.t1,
      secondary: DS.t2,
      disabled:  DS.t3,
    },
    divider: DS.border,
  },

  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
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
          background: DS.bg,
          scrollbarColor: `rgba(249,115,22,0.3) transparent`,
          '&::-webkit-scrollbar':       { width: 4, height: 4 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: `rgba(249,115,22,0.22)`,
            borderRadius: 4,
            '&:hover': { background: DS.orange },
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
        '@keyframes floatUp': {
          '0%,100%': { transform: 'translateY(0)' },
          '50%':     { transform: 'translateY(-4px)' },
        },
        '@keyframes borderGlow': {
          '0%,100%': { borderColor: 'rgba(255,144,57,0.15)' },
          '50%':     { borderColor: 'rgba(255,144,57,0.4)' },
        },
        // Scrollbar cross-browser
        '*': {
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,144,57,0.35) transparent',
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
          borderRadius: 14,
          boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.3)',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease, transform 0.18s ease',
          '&:hover': {
            borderColor: 'rgba(255,255,255,0.13)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.45), 0 8px 24px rgba(0,0,0,0.35)',
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
          background: 'rgba(10,11,16,0.99)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          borderRadius: 18,
          border: `1px solid rgba(255,255,255,0.1)`,
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
        // Presença por tamanho — botões importantes maiores (pedido do redesign)
        sizeLarge:  { fontSize: '0.92rem', padding: '10px 22px', borderRadius: 12 },
        sizeMedium: { fontSize: '0.84rem', padding: '7px 16px' },
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
        // Primário = CTA da marca (gradiente laranja DS) — vem do tema, não hardcodado
        containedPrimary: {
          background: `linear-gradient(135deg, ${DS.orangeDim}, ${DS.orange})`,
          color: '#0A0A0A',
          fontWeight: 700,
          boxShadow: `0 4px 16px rgba(249,115,22,0.22)`,
          '&:hover': {
            background: `linear-gradient(135deg, ${DS.orangeDim}, ${DS.orange})`,
            boxShadow: `0 6px 22px rgba(249,115,22,0.32)`,
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
            background: `rgba(249,115,22,0.05)`,
          },
        },
        // Ghost
        text: {
          color: DS.t1,
          '&:hover': { background: `rgba(249,115,22,0.06)` },
        },
      },
    },

    // ── IconButton ────────────────────────────────────────────────────────────
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          transition: 'background 0.18s ease, color 0.18s ease',
          '&:hover': { background: `rgba(249,115,22,0.08)` },
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
        },
        label: { paddingLeft: 10, paddingRight: 10 },
        colorPrimary: {
          background: `rgba(249,115,22,0.1)`,
          color: DS.orange,
          borderColor: `rgba(249,115,22,0.22)`,
        },
        colorSuccess: {
          background: 'rgba(34,197,94,0.09)',
          color: '#22C55E',
          borderColor: 'rgba(34,197,94,0.18)',
        },
        colorError: {
          background: 'rgba(239,68,68,0.09)',
          color: '#EF4444',
          borderColor: 'rgba(239,68,68,0.18)',
        },
        colorWarning: {
          background: 'rgba(245,158,11,0.09)',
          color: '#F59E0B',
          borderColor: 'rgba(245,158,11,0.18)',
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
            background: 'rgba(255,255,255,0.03)',
            '& fieldset': {
              borderColor: DS.border,
              transition: 'border-color 0.2s',
            },
            '&:hover:not(.Mui-focused) fieldset': { borderColor: `rgba(255,255,255,0.14)` },
            '&.Mui-focused fieldset': { borderColor: DS.orange, borderWidth: '1.5px' },
          },
          '& .MuiInputLabel-root': {
            letterSpacing: '-0.01em',
            fontWeight: 400,
            color: DS.t2,
            '&.Mui-focused': { color: DS.orange },
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
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: `rgba(255,255,255,0.14)` },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: DS.orange },
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
          background: 'rgba(10,11,16,0.97)',
          backdropFilter: 'blur(20px)',
          border: `1px solid rgba(255,255,255,0.1)`,
          borderRadius: 8,
          fontSize: '0.72rem',
          fontWeight: 400,
          padding: '6px 10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          color: DS.t1,
        },
        arrow: { color: 'rgba(10,11,16,0.97)' },
      },
    },

    // ── LinearProgress ────────────────────────────────────────────────────────
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 6, overflow: 'hidden',
          background: 'rgba(255,255,255,0.07)',
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
          background: 'rgba(255,255,255,0.02)',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background 0.15s',
          '&:hover': { background: `rgba(255,255,255,0.03)` },
          '&:last-child td': { borderBottom: 0 },
        },
      },
    },

    // ── List / ListItemButton ─────────────────────────────────────────────────
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 9,
          transition: 'background 0.15s ease',
          '&.Mui-selected': {
            background: `rgba(249,115,22,0.1)`,
            borderLeft: `2.5px solid ${DS.orange}`,
            '&:hover': { background: `rgba(249,115,22,0.14)` },
          },
          '&:hover': { background: `rgba(255,255,255,0.05)` },
        },
      },
    },

    // ── Drawer — mantém blur ──────────────────────────────────────────────────
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: 'rgba(9,10,15,0.99)',
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
        standardSuccess: { background: 'rgba(34,197,94,0.07)', borderColor: 'rgba(34,197,94,0.18)' },
        standardError:   { background: 'rgba(239,68,68,0.07)', borderColor: 'rgba(239,68,68,0.18)' },
        standardWarning: { background: 'rgba(245,158,11,0.07)', borderColor: 'rgba(245,158,11,0.18)' },
        standardInfo:    { background: `rgba(249,115,22,0.07)`, borderColor: `rgba(249,115,22,0.18)` },
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
          '&.Mui-selected': { color: DS.orange, fontWeight: 700 },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { background: DS.orange, borderRadius: 2, height: 2.5 },
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
          '&:hover': { boxShadow: `0 0 0 6px rgba(249,115,22,0.14)` },
          '&.Mui-active': { boxShadow: `0 0 0 8px rgba(249,115,22,0.2)` },
        },
      },
    },

    // ── BottomNavigation — mantém blur ────────────────────────────────────────
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          height: 62,
          background: 'rgba(9,10,15,0.98)',
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
          '&.Mui-selected': { color: DS.orange },
        },
        label: { fontWeight: 500, fontSize: '0.6rem', letterSpacing: '0.04em' },
      },
    },

    // ── Menu / Popover — mantém blur ──────────────────────────────────────────
    MuiMenu: {
      styleOverrides: {
        paper: {
          background: 'rgba(10,11,16,0.99)',
          backdropFilter: 'blur(24px)',
          border: `1px solid rgba(255,255,255,0.09)`,
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
          '&:hover': { background: `rgba(255,255,255,0.06)` },
          '&.Mui-selected': {
            background: `rgba(249,115,22,0.1)`,
            '&:hover': { background: `rgba(249,115,22,0.15)` },
          },
        },
      },
    },
  },
}

const base = createTheme(themeOptions)
const theme = responsiveFontSizes(base, { breakpoints: ['md', 'lg', 'xl'], factor: 2.2 })
export default theme
