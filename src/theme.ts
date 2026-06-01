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
          fontFeatureSettings: '"cv01","cv02","cv03","cv04","ss01"',
          scrollbarColor: 'rgba(255,144,57,0.5) transparent',
          '&::-webkit-scrollbar':       { width: 4, height: 4 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: 'linear-gradient(180deg, rgba(255,144,57,0.6), rgba(255,83,57,0.6))',
            borderRadius: 4,
            '&:hover': { background: 'linear-gradient(180deg, #ff9039, #ff5339)' },
          },
          // Textura de ruído sutil — assinatura de UIs premium escuras
          '&::before': {
            content: '""',
            position: 'fixed',
            inset: 0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
            backgroundSize: '128px 128px',
            opacity: 0.028,
            pointerEvents: 'none',
            zIndex: 9998,
            mixBlendMode: 'overlay',
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
        '@keyframes scanline': {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        '@keyframes revealRight': {
          from: { clipPath: 'inset(0 100% 0 0)' },
          to:   { clipPath: 'inset(0 0% 0 0)' },
        },
        '@keyframes glowExpand': {
          '0%':   { opacity: 0, transform: 'scale(0.85)' },
          '60%':  { opacity: 1, transform: 'scale(1.05)' },
          '100%': { opacity: 1, transform: 'scale(1)' },
        },
        '@keyframes progressFill': {
          from: { width: '0%' },
          to:   { width: '100%' },
        },
        '@keyframes typeIn': {
          from: { width: 0 },
          to:   { width: '100%' },
        },
        '@keyframes rowIn': {
          from: { opacity: 0, transform: 'translateX(-6px)' },
          to:   { opacity: 1, transform: 'translateX(0)' },
        },
        // Scrollbar cross-browser
        '*': {
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,144,57,0.35) transparent',
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
          transition: [
            'box-shadow 0.32s cubic-bezier(0.16,1,0.3,1)',
            'border-color 0.32s cubic-bezier(0.16,1,0.3,1)',
            'transform 0.32s cubic-bezier(0.16,1,0.3,1)',
          ].join(','),
          transformStyle: 'preserve-3d',
          willChange: 'transform',
          '&:hover': {
            borderColor: 'rgba(255,144,57,0.22)',
            transform: 'perspective(1200px) rotateX(1.2deg) translateY(-3px)',
            boxShadow: [
              '0 2px 4px rgba(0,0,0,0.4)',
              '0 12px 40px rgba(0,0,0,0.6)',
              '0 28px 72px rgba(0,0,0,0.5)',
              '0 0 0 1px rgba(255,144,57,0.1)',
              '0 0 48px rgba(255,144,57,0.07)',
              'inset 0 1px 0 rgba(255,255,255,0.1)',
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
        elevation1: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.35)',
          border: '1px solid rgba(255,255,255,0.04)',
        },
        elevation2: {
          boxShadow: '0 2px 6px rgba(0,0,0,0.35), 0 8px 28px rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.05)',
        },
        elevation8: {
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 24px 64px rgba(0,0,0,0.45)',
          border: '1px solid rgba(255,255,255,0.07)',
        },
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
          transition: 'all 0.24s cubic-bezier(0.16,1,0.3,1)',
          position: 'relative',
          overflow: 'hidden',
          // Shimmer sweep on hover
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.12) 50%, transparent 70%)',
            backgroundSize: '200% auto',
            backgroundPosition: '-200% center',
            transition: 'background-position 0s',
          },
          '&:hover::after': {
            backgroundPosition: '200% center',
            transition: 'background-position 0.5s ease',
          },
        },
        contained: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04) inset',
          '&:hover': {
            boxShadow: '0 6px 24px rgba(255,144,57,0.38), 0 2px 8px rgba(0,0,0,0.4)',
            transform: 'translateY(-1px)',
          },
          '&:active': { boxShadow: '0 1px 4px rgba(0,0,0,0.3)', transform: 'scale(0.97) translateY(0)' },
        },
        outlined: {
          borderWidth: '1px',
          backdropFilter: 'blur(8px)',
          '&:hover': {
            borderWidth: '1px',
            boxShadow: '0 0 16px rgba(255,144,57,0.14)',
            transform: 'translateY(-1px)',
          },
        },
      },
    },

    // ── IconButton ───────────────────────────────────────
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: 'background 0.2s cubic-bezier(0.16,1,0.3,1), color 0.2s cubic-bezier(0.16,1,0.3,1), transform 0.2s cubic-bezier(0.16,1,0.3,1)',
          '&:hover': {
            transform: 'scale(1.1)',
          },
          '&:active': {
            transform: 'scale(0.92)',
          },
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
          transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)',
          '&.MuiChip-clickable:hover': {
            transform: 'translateY(-1px) scale(1.04)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          },
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
        root: {
          borderRadius: 6,
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.06)',
        },
        bar: {
          borderRadius: 6,
          // Shimmer sweep that travels along the bar
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.8s ease-in-out infinite',
          },
        },
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

    // ── ToggleButton ─────────────────────────────────────
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.72rem',
          letterSpacing: '-0.01em',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.45)',
          transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)',
          '&:hover': {
            bgcolor: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.75)',
          },
          '&.Mui-selected': {
            color: '#ff9039',
            bgcolor: 'rgba(255,144,57,0.12)',
            borderColor: 'rgba(255,144,57,0.35)',
            fontWeight: 700,
            '&:hover': {
              bgcolor: 'rgba(255,144,57,0.18)',
            },
          },
        },
      },
    },

    // ── ToggleButtonGroup ────────────────────────────────
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: {
          '& .MuiToggleButtonGroup-grouped': {
            '&:not(:first-of-type)': {
              borderLeft: '1px solid rgba(255,255,255,0.07)',
              marginLeft: 0,
            },
          },
        },
      },
    },

    // ── Badge ────────────────────────────────────────────
    MuiBadge: {
      styleOverrides: {
        badge: {
          fontWeight: 800,
          fontSize: '0.52rem',
          minWidth: 16,
          height: 16,
          padding: '0 4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        },
      },
    },

    // ── Select / MenuItem ────────────────────────────────
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: '0.82rem',
          fontWeight: 400,
          borderRadius: 8,
          marginInline: 4,
          '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
          '&.Mui-selected': {
            bgcolor: 'rgba(255,144,57,0.1)',
            color: '#ff9039',
            fontWeight: 600,
            '&:hover': { bgcolor: 'rgba(255,144,57,0.16)' },
          },
        },
      },
    },

    // ── Accordion / Collapse ─────────────────────────────
    MuiAccordion: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          bgcolor: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '12px !important',
          '&:before': { display: 'none' },
          '&.Mui-expanded': { margin: 0 },
        },
      },
    },

    // ── Table ────────────────────────────────────────────
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottomColor: 'rgba(255,255,255,0.06)',
          fontSize: '0.8rem',
        },
        head: {
          fontWeight: 700,
          fontSize: '0.62rem',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'rgba(255,255,255,0.45)',
          bgcolor: 'rgba(255,255,255,0.02)',
        },
      },
    },

    // ── Tabs ─────────────────────────────────────────────
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          letterSpacing: '-0.01em',
          fontSize: '0.82rem',
          minWidth: 80,
          transition: 'all 0.2s',
          '&.Mui-selected': { fontWeight: 700 },
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
