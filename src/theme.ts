import { createTheme, type ThemeOptions } from '@mui/material/styles'

export const themeOptions: ThemeOptions = {
  palette: {
    mode: 'dark',
    primary:    { main: '#ff9039' },
    secondary:  { main: '#ff5339' },
    background: { default: '#080808', paper: 'rgba(20,20,20,0.75)' },
    success:    { main: '#00C47A' },
    warning:    { main: '#FFD700' },
    error:      { main: '#FF4545' },
    info:       { main: '#3B8EFF' },
  },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: '#ff9039 transparent',
          '&::-webkit-scrollbar': { width: 4, height: 4 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: 'linear-gradient(180deg,#ff9039,#ff5339)',
            borderRadius: 4,
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
      },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 500 } },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          background: 'rgba(22,22,22,0.65)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          background: 'rgba(18,18,18,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        },
      },
    },
  },
}

const theme = createTheme(themeOptions)
export default theme
