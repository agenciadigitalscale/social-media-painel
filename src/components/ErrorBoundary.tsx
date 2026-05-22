import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Box, Typography, Button } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import BugReportIcon from '@mui/icons-material/BugReport'

interface Props { children: ReactNode; tabName?: string }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[DS HUB] Erro em', this.props.tabName ?? 'componente', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <Box sx={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '60vh', gap: 2, p: 3,
      }}>
        <Box sx={{
          width: 56, height: 56, borderRadius: '50%',
          bgcolor: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <BugReportIcon sx={{ color: '#FF3B30', fontSize: 28 }} />
        </Box>

        <Box sx={{ textAlign: 'center', maxWidth: 420 }}>
          <Typography fontWeight={700} sx={{ fontSize: '1rem', mb: 0.5 }}>
            Algo deu errado{this.props.tabName ? ` em ${this.props.tabName}` : ''}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.5 }}>
            Ocorreu um erro inesperado ao carregar este painel. Tente recarregar.
          </Typography>
          <Typography sx={{
            mt: 1.5, p: 1.5, borderRadius: 1.5, bgcolor: 'rgba(255,59,48,0.06)',
            border: '1px solid rgba(255,59,48,0.15)', fontSize: '0.62rem',
            color: '#FF6060', fontFamily: 'monospace', textAlign: 'left', wordBreak: 'break-all',
          }}>
            {this.state.error.message}
          </Typography>
        </Box>

        <Button
          size="small"
          startIcon={<RefreshIcon sx={{ fontSize: 15 }} />}
          onClick={() => this.setState({ error: null })}
          sx={{
            fontSize: '0.72rem', fontWeight: 700, px: 2, py: 0.7,
            border: '1px solid rgba(255,144,57,0.4)', color: 'primary.main',
            borderRadius: 2, '&:hover': { bgcolor: 'rgba(255,144,57,0.08)' },
          }}
        >
          Tentar novamente
        </Button>
      </Box>
    )
  }
}
