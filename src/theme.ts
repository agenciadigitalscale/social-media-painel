import { createTheme, responsiveFontSizes, type ThemeOptions } from '@mui/material/styles'

export const themeOptions: ThemeOptions = {
  breakpoints: {
    values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1920 },
  },

  palette: {
    mode: 'dark',
    primary:    { main: '#ff9039' },
    secondary:  { main: '#ff5339' },
    background: { default: '#080808', paper: 'rgba(14,14,14,0.85)' },
    success:    { main: '#00C47A' },
    warning:    { main: '#FFD700' },
    error:      { main: '#FF4545' },
    info:       { main: '#3B8EFF' },
    text: {
      primary:   'rgba(255,255,255,0.92)',
      secondary: 'rgba(255,255,255,0.50)',
      disabled:  'rgba(255,255,255,0.28)',
    },
  },

  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    fontWeightLight:   300,
    fontWeightRegular: 400,
    fontWeightMedium:  500,
    fontWeightBold:    600,
    h1: { fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.08 },
    h2: { fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.12 },
    h3: { fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.18 },
    h4: { fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.24 },
    h5: { fontWeight: 600, letterSpacing: '-0.015em', lineHeight: 1.3 },
    h6: { fontWeight: 600, letterSpacing: '-0.01em',  lineHeight: 1.35 },
    subtitle1: { fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.5 },
    subtitle2: { fontWeight: 500, letterSpacing: '-0.005em', lineHeight: 1.5 },
    body1: { fontWeight: 400, letterSpacing: '-0.011em', lineHeight: 1.65 },
    body2: { fontWeight: 400, letterSpacing: '-0.006em', lineHeight: 1.6  },
    caption: { fontWeight: 400, letterSpacing: '0.008em', lineHeight: 1.5 },
    overline: { fontWeight: 600, letterSpacing: '0.1em', lineHeight: 2 },
    button: { fontWeight: 500, letterSpacing: '-0.01em' },
  },

  shape: { borderRadius: 14 },

  components: {
    // ── Base global ──────────────────────────────────────
    MuiCssBaseline: {
      styleOverrides: {
        '*, *::before, *::after': { boxSizing: 'border-box' },
        html: { WebkitTextSizeAdjust: '100%' },
        body: {
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          textRendering: 'optimizeLegibility',
          // Inter: caractere alternativo 'a' single-story + dígitos abertos
          fontFeatureSettings: '"cv01","cv02","cv03","cv04","ss01"',
          scrollbarColor: 'rgba(255,144,57,0.5) transparent',
          '&::-webkit-scrollbar':       { width: 4, height: 4 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: 'linear-gradient(180deg, rgba(255,144,57,0.6), rgba(255,83,57,0.6))',
            borderRadius: 4,
            '&:hover': { background: 'linear-gradient(180deg, #ff9039, #ff5339)' },
          },
        },
      },
    },

    // ── Card ─────────────────────────────────────────────
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          background: 'rgba(13,13,13,0.82)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16,
          boxShadow: [
            '0 1px 2px rgba(0,0,0,0.4)',
            '0 4px 16px rgba(0,0,0,0.5)',
            '0 16px 48px rgba(0,0,0,0.4)',
            'inset 0 1px 0 rgba(255,255,255,0.055)',
          ].join(','),
          transition: 'box-shadow 0.28s ease, border-color 0.28s ease, transform 0.22s ease',
          '&:hover': {
            borderColor: 'rgba(255,144,57,0.18)',
            transform: 'translateY(-1px)',
            boxShadow: [
              '0 2px 4px rgba(0,0,0,0.4)',
              '0 8px 32px rgba(0,0,0,0.55)',
              '0 24px 64px rgba(0,0,0,0.45)',
              '0 0 0 1px rgba(255,144,57,0.08)',
              '0 0 32px rgba(255,144,57,0.06)',
              'inset 0 1px 0 rgba(255,255,255,0.08)',
            ].join(','),
          },
        },
      },
    },

    // ── Paper ────────────────────────────────────────────
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 14,
        },
        elevation1: { boxShadow: '0 1px 3px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.35)' },
        elevation2: { boxShadow: '0 2px 6px rgba(0,0,0,0.35), 0 8px 28px rgba(0,0,0,0.4)' },
        elevation8: { boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 24px 64px rgba(0,0,0,0.45)' },
      },
    },

    // ── Dialog ───────────────────────────────────────────
    MuiDialog: {
      styleOverrides: {
        paper: {
          background: 'rgba(11,11,11,0.97)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: [
            '0 4px 8px rgba(0,0,0,0.5)',
            '0 32px 96px rgba(0,0,0,0.9)',
            'inset 0 1px 0 rgba(255,255,255,0.06)',
          ].join(','),
        },
      },
    },

    // ── Button ───────────────────────────────────────────
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 10,
          letterSpacing: '-0.01em',
          transition: 'all 0.2s ease',
        },
        contained: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04) inset',
          '&:hover': { boxShadow: '0 4px 20px rgba(255,144,57,0.35), 0 2px 8px rgba(0,0,0,0.4)' },
          '&:active': { boxShadow: '0 1px 4px rgba(0,0,0,0.3)', transform: 'scale(0.98)' },
        },
        outlined: {
          borderWidth: '1px',
          backdropFilter: 'blur(8px)',
          '&:hover': { borderWidth: '1px', boxShadow: '0 0 12px rgba(255,144,57,0.12)' },
        },
      },
    },

    // ── IconButton ───────────────────────────────────────
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: 'background 0.18s ease, color 0.18s ease',
        },
      },
    },

    // ── Chip ─────────────────────────────────────────────
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          letterSpacing: '-0.01em',
          borderRadius: 8,
          fontSize: '0.72rem',
          backdropFilter: 'blur(8px)',
        },
        label: { paddingLeft: 10, paddingRight: 10 },
      },
    },

    // ── TextField / OutlinedInput ─────────────────────────
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backdropFilter: 'blur(8px)',
            fontWeight: 400,
            letterSpacing: '-0.01em',
            borderRadius: 10,
            '& fieldset': {
              borderColor: 'rgba(255,255,255,0.1)',
              borderWidth: '1px',
              transition: 'border-color 0.2s',
            },
            '&:hover:not(.Mui-focused) fieldset': { borderColor: 'rgba(255,255,255,0.18)' },
            '&.Mui-focused fieldset': { borderWidth: '1.5px' },
          },
          '& .MuiInputLabel-root': { letterSpacing: '-0.01em', fontWeight: 400 },
        },
      },
    },

    // ── Divider ──────────────────────────────────────────
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: 'rgba(255,255,255,0.06)', borderBottomWidth: '0.5px' },
      },
    },

    // ── Tooltip ──────────────────────────────────────────
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          background: 'rgba(16,16,16,0.97)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10,
          fontSize: '0.72rem',
          fontWeight: 400,
          letterSpacing: '-0.005em',
          lineHeight: 1.5,
          padding: '6px 10px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        },
        arrow: { color: 'rgba(16,16,16,0.97)' },
      },
    },

    // ── LinearProgress ───────────────────────────────────
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 6, overflow: 'hidden' },
        bar:  { borderRadius: 6 },
      },
    },

    // ── Slider ───────────────────────────────────────────
    MuiSlider: {
      styleOverrides: {
        root: { padding: '10px 0' },
        rail:  { opacity: 0.28, borderRadius: 4 },
        track: { borderRadius: 4, border: 'none' },
        thumb: {
          borderRadius: '50%',
          boxShadow: '0 0 0 4px rgba(255,144,57,0)',
          '&:hover': { boxShadow: '0 0 0 6px rgba(255,144,57,0.15)' },
          '&.Mui-active': { boxShadow: '0 0 0 8px rgba(255,144,57,0.22)' },
        },
      },
    },

    // ── List ─────────────────────────────────────────────
    MuiListItem: {
      styleOverrides: {
        root: { borderRadius: 10 },
      },
    },

    // ── Drawer ───────────────────────────────────────────
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: 'rgba(10,10,10,0.97)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          borderLeft: '1px solid rgba(255,255,255,0.07)',
        },
      },
    },

    // ── Alert ────────────────────────────────────────────
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.07)',
        },
      },
    },

    // ── BottomNavigation ─────────────────────────────────
    MuiBottomNavigation: {
      styleOverrides: { root: { borderRadius: 0, height: 62 } },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: { minWidth: 0 },
        label: { fontWeight: 500, fontSize: '0.6rem', letterSpacing: '0.04em' },
      },
    },
  },
}

const base = createTheme(themeOptions)
const theme = responsiveFontSizes(base, { breakpoints: ['md', 'lg', 'xl'], factor: 2.2 })
export default theme
