import { createTheme, responsiveFontSizes, type ThemeOptions } from '@mui/material/styles'

// ── Design tokens Digital Scale ───────────────────────────────────────────────
export const DS = {
  orange:   '#F97316',   // laranja principal
  orangeDim:'#FF9039',   // laranja suave (hover, chip)
  bg:       '#07060A',   // fundo quase-preto com tint quente
  surface:  'rgba(14,12,10,0.92)',  // cards/papers
  border:   'rgba(249,115,22,0.1)', // borda padrão
  borderHov:'rgba(249,115,22,0.28)',// borda hover
  glow:     'rgba(249,115,22,0.18)',// glow suave
  grid:     'rgba(249,115,22,0.022)',// grid de fundo
  // Texto
  t1: 'rgba(255,255,255,0.92)',
  t2: 'rgba(255,255,255,0.52)',
  t3: 'rgba(255,255,255,0.28)',
}

export const themeOptions: ThemeOptions = {
  breakpoints: {
    values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1920 },
  },

  palette: {
    mode: 'dark',
    primary:    { main: DS.orange, light: DS.orangeDim, dark: '#EA6A0A' },
    secondary:  { main: 'rgba(255,255,255,0.12)' },
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
          // Grid global — mesma técnica do Flowspace, com laranja DS
          backgroundImage: [
            `linear-gradient(${DS.grid} 1px, transparent 1px)`,
            `linear-gradient(90deg, ${DS.grid} 1px, transparent 1px)`,
          ].join(','),
          backgroundSize: '48px 48px',
          scrollbarColor: `rgba(249,115,22,0.35) transparent`,
          '&::-webkit-scrollbar':       { width: 4, height: 4 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: `rgba(249,115,22,0.3)`,
            borderRadius: 4,
            '&:hover': { background: DS.orange },
          },
        },
      },
    },

    // ── Card ─────────────────────────────────────────────────────────────────
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          background: DS.surface,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: `1px solid ${DS.border}`,
          borderRadius: 16,
          boxShadow: '0 1px 2px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.4)',
          transition: 'border-color 0.22s ease, box-shadow 0.22s ease, transform 0.18s ease',
          '&:hover': {
            borderColor: DS.borderHov,
            boxShadow: `0 0 0 1px ${DS.border}, 0 8px 32px rgba(0,0,0,0.5), 0 0 24px ${DS.glow}`,
            transform: 'translateY(-1px)',
          },
        },
      },
    },

    // ── Paper ─────────────────────────────────────────────────────────────────
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          background: DS.surface,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 12,
          border: `1px solid ${DS.border}`,
        },
        elevation0: { boxShadow: 'none', border: `1px solid ${DS.border}` },
        elevation1: { boxShadow: '0 1px 4px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.3)' },
        elevation2: { boxShadow: '0 2px 8px rgba(0,0,0,0.45), 0 8px 28px rgba(0,0,0,0.35)' },
        elevation8: { boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 24px 64px rgba(0,0,0,0.4)' },
      },
    },

    // ── Dialog ────────────────────────────────────────────────────────────────
    MuiDialog: {
      styleOverrides: {
        paper: {
          background: 'rgba(10,8,6,0.98)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          borderRadius: 20,
          border: `1px solid ${DS.borderHov}`,
          boxShadow: `0 4px 8px rgba(0,0,0,0.6), 0 32px 96px rgba(0,0,0,0.9), 0 0 60px ${DS.glow}`,
        },
      },
    },

    // ── Button ────────────────────────────────────────────────────────────────
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 10,
          letterSpacing: '-0.01em',
          transition: 'all 0.18s ease',
        },
        contained: {
          boxShadow: `0 2px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04) inset`,
          '&:hover': {
            boxShadow: `0 4px 20px ${DS.glow}, 0 2px 8px rgba(0,0,0,0.4)`,
            transform: 'translateY(-1px)',
          },
          '&:active': {
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            transform: 'scale(0.98)',
          },
        },
        outlined: {
          borderColor: DS.border,
          backdropFilter: 'blur(8px)',
          '&:hover': {
            borderColor: DS.borderHov,
            boxShadow: `0 0 12px ${DS.glow}`,
            background: `rgba(249,115,22,0.06)`,
          },
        },
        text: {
          '&:hover': { background: `rgba(249,115,22,0.07)` },
        },
      },
    },

    // ── IconButton ────────────────────────────────────────────────────────────
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: 'background 0.18s ease, color 0.18s ease',
          '&:hover': { background: `rgba(249,115,22,0.09)` },
        },
      },
    },

    // ── Chip ──────────────────────────────────────────────────────────────────
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          letterSpacing: '-0.01em',
          borderRadius: 8,
          fontSize: '0.72rem',
          backdropFilter: 'blur(8px)',
          border: `1px solid transparent`,
        },
        label: { paddingLeft: 10, paddingRight: 10 },
        colorPrimary: {
          background: `rgba(249,115,22,0.12)`,
          color: DS.orange,
          borderColor: `rgba(249,115,22,0.25)`,
        },
        colorSuccess: {
          background: 'rgba(34,197,94,0.1)',
          color: '#22C55E',
          borderColor: 'rgba(34,197,94,0.2)',
        },
        colorError: {
          background: 'rgba(239,68,68,0.1)',
          color: '#EF4444',
          borderColor: 'rgba(239,68,68,0.2)',
        },
        colorWarning: {
          background: 'rgba(245,158,11,0.1)',
          color: '#F59E0B',
          borderColor: 'rgba(245,158,11,0.2)',
        },
      },
    },

    // ── TextField ─────────────────────────────────────────────────────────────
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backdropFilter: 'blur(8px)',
            fontWeight: 400,
            letterSpacing: '-0.01em',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.03)',
            '& fieldset': {
              borderColor: DS.border,
              transition: 'border-color 0.2s',
            },
            '&:hover:not(.Mui-focused) fieldset': { borderColor: `rgba(249,115,22,0.2)` },
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
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: `rgba(249,115,22,0.2)` },
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

    // ── Tooltip ───────────────────────────────────────────────────────────────
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          background: 'rgba(12,10,8,0.97)',
          backdropFilter: 'blur(20px)',
          border: `1px solid ${DS.border}`,
          borderRadius: 10,
          fontSize: '0.72rem',
          fontWeight: 400,
          padding: '6px 10px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          color: DS.t1,
        },
        arrow: { color: 'rgba(12,10,8,0.97)' },
      },
    },

    // ── LinearProgress ────────────────────────────────────────────────────────
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 6, overflow: 'hidden',
          background: 'rgba(255,255,255,0.06)',
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
        },
        head: { color: DS.t2, fontWeight: 600, fontSize: '0.75rem' },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': { background: `rgba(249,115,22,0.04)` },
          '&:last-child td': { borderBottom: 0 },
        },
      },
    },

    // ── List / ListItemButton ─────────────────────────────────────────────────
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: 'background 0.18s ease',
          '&.Mui-selected': {
            background: `rgba(249,115,22,0.12)`,
            borderLeft: `2.5px solid ${DS.orange}`,
            '&:hover': { background: `rgba(249,115,22,0.16)` },
          },
          '&:hover': { background: `rgba(249,115,22,0.07)` },
        },
      },
    },

    // ── Drawer ────────────────────────────────────────────────────────────────
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: 'rgba(8,6,4,0.97)',
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
          borderRadius: 12,
          backdropFilter: 'blur(16px)',
          border: `1px solid transparent`,
        },
        standardSuccess: { background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.2)' },
        standardError:   { background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)' },
        standardWarning: { background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.2)' },
        standardInfo:    { background: `rgba(249,115,22,0.08)`, borderColor: `rgba(249,115,22,0.2)` },
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
        rail:  { opacity: 0.18, borderRadius: 4 },
        track: { borderRadius: 4, border: 'none' },
        thumb: {
          borderRadius: '50%',
          boxShadow: `0 0 0 4px rgba(249,115,22,0)`,
          '&:hover': { boxShadow: `0 0 0 6px rgba(249,115,22,0.15)` },
          '&.Mui-active': { boxShadow: `0 0 0 8px rgba(249,115,22,0.22)` },
        },
      },
    },

    // ── BottomNavigation ──────────────────────────────────────────────────────
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          height: 62,
          background: 'rgba(8,6,4,0.96)',
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

    // ── Menu / Popover ────────────────────────────────────────────────────────
    MuiMenu: {
      styleOverrides: {
        paper: {
          background: 'rgba(12,10,8,0.97)',
          backdropFilter: 'blur(24px)',
          border: `1px solid ${DS.border}`,
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: '0.82rem',
          borderRadius: 8,
          margin: '1px 4px',
          '&:hover': { background: `rgba(249,115,22,0.08)` },
          '&.Mui-selected': {
            background: `rgba(249,115,22,0.12)`,
            '&:hover': { background: `rgba(249,115,22,0.16)` },
          },
        },
      },
    },
  },
}

const base = createTheme(themeOptions)
const theme = responsiveFontSizes(base, { breakpoints: ['md', 'lg', 'xl'], factor: 2.2 })
export default theme
