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

    // Chunk de deploy desatualizado — recarrega automaticamente uma vez
    const isChunkError =
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Importing a module script failed') ||
      error.message.includes('error loading dynamically imported module')

    if (isChunkError) {
      const lastReload = Number(sessionStorage.getItem('ds_chunk_reload') ?? '0')
      if (Date.now() - lastReload > 10_000) {
        sessionStorage.setItem('ds_chunk_reload', String(Date.now()))
        window.location.reload()
      }
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    // Chunk error — mostra loading enquanto recarrega
    const isChunkError =
      this.state.error.message.includes('Failed to fetch dynamically imported module') ||
      this.state.error.message.includes('Importing a module script failed') ||
      this.state.error.message.includes('error loading dynamically imported module')

    if (isChunkError) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 2 }}>
          <Box sx={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(59,130,246,0.3)', borderTopColor: '#3B82F6', animation: 'spin 0.8s linear infinite', '@keyframes spin': { to: { transform: 'rotate(360deg)' } } }} />
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Atualizando painel…</Typography>
        </Box>
      )
    }

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
            border: '1px solid rgba(59,130,246,0.4)', color: 'primary.main',
            borderRadius: 2, '&:hover': { bgcolor: 'rgba(59,130,246,0.08)' },
          }}
        >
          Tentar novamente
        </Button>
      </Box>
    )
  }
}
