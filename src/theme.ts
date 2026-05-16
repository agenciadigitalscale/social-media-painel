import { createTheme, type ThemeOptions } from '@mui/material/styles'

export const themeOptions: ThemeOptions = {
  palette: {
    mode: 'dark',
    primary: {
      main: '#ff9039',
    },
    secondary: {
      main: '#ff5339',
    },
    background: {
      default: '#0d0d0d',
      paper: '#161616',
    },
    success: {
      main: '#00C47A',
    },
    warning: {
      main: '#FFD700',
    },
    error: {
      main: '#FF4545',
    },
    info: {
      main: '#3B8EFF',
    },
  },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: '#ff9039 #161616',
          '&::-webkit-scrollbar': {
            width: 6,
          },
          '&::-webkit-scrollbar-track': {
            background: '#161616',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#ff9039',
            borderRadius: 3,
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(255,255,255,0.05)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
}

const theme = createTheme(themeOptions)
export default theme
