import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Box, Typography, Dialog, TextField, InputAdornment, Chip,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import type { ContentItem, ItemState } from '../types'
import { STATUS_CONFIG } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  items: ContentItem[]
  states: Record<number, ItemState>
  onNavigate: (tabIndex: number, itemId?: number) => void
}

const TYPE_ICON: Record<string, string> = { Post: '📷', Reel: '🎬', Story: '📱', Carrossel: '🖼️', Feed: '📸' }

export default function GlobalSearch({ open, onClose, items, states, onNavigate }: Props) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setCursor(0)
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [open])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return items
      .filter(i => {
        const title = (states[i.i]?.title || i.n).toLowerCase()
        const client = i.c.toLowerCase()
        const type = i.tp.toLowerCase()
        return title.includes(q) || client.includes(q) || type.includes(q)
      })
      .slice(0, 20)
      .map(i => {
        const s = states[i.i]?.status ?? i.s
        const cfg = STATUS_CONFIG[s]
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const isLate = s !== 7 && s !== 5 && new Date(i.dt) < today
        return { item: i, s, cfg, isLate }
      })
  }, [query, items, states])

  useEffect(() => { setCursor(0) }, [results])

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    if (e.key === 'Enter' && results[cursor]) {
      handleSelect(results[cursor].item)
    }
    if (e.key === 'Escape') onClose()
  }

  function handleSelect(item: ContentItem) {
    const dt = new Date(item.dt)
    const now = new Date()
    if (dt.toDateString() === now.toDateString()) {
      onNavigate(0) // Hoje
    } else if (dt >= now) {
      onNavigate(2) // Agenda
    } else {
      onNavigate(3) // Produções
    }
    onClose()
  }

  // Quick actions
  const quickActions = [
    { label: 'Produções', icon: '⚡', tab: 3 },
    { label: 'Calendário', icon: '📅', tab: 5 },
    { label: 'Clientes', icon: '👥', tab: 6 },
    { label: 'Dashboard', icon: '📊', tab: 7 },
    { label: 'Roteiros', icon: '✍️', tab: 19 },
    { label: 'Tráfego', icon: '📈', tab: 15 },
  ]

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: 'rgba(11,11,11,0.97)',
          backdropFilter: 'blur(40px)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: '16px',
          overflow: 'hidden',
          mt: { xs: 4, md: 8 },
          mx: { xs: 1, md: 'auto' },
          maxHeight: '70vh',
        },
      }}
      sx={{ '& .MuiDialog-container': { alignItems: 'flex-start' }, '& .MuiBackdrop-root': { backdropFilter: 'blur(4px)', bgcolor: 'rgba(0,0,0,0.6)' } }}
    >
      {/* Input */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 1 }}>
        <SearchIcon sx={{ color: 'rgba(255,255,255,0.35)', fontSize: 20, flexShrink: 0 }} />
        <TextField
          inputRef={inputRef}
          fullWidth variant="standard"
          placeholder="Buscar conteúdo, cliente, status..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
          InputProps={{ disableUnderline: true }}
          inputProps={{ style: { fontSize: '0.95rem', color: 'rgba(255,255,255,0.88)', padding: 0 } }}
        />
        {query && (
          <Box onClick={() => setQuery('')} sx={{ cursor: 'pointer', p: 0.3, borderRadius: 1, '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' } }}>
            <CloseIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.35)' }} />
          </Box>
        )}
        <Box sx={{ px: 0.8, py: 0.3, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', flexShrink: 0 }} onClick={onClose}>
          <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>ESC</Typography>
        </Box>
      </Box>

      <Box sx={{ overflowY: 'auto', maxHeight: 'calc(70vh - 60px)' }}>
        {/* Quick nav — shown when query is empty */}
        {!query && (
          <Box sx={{ p: 2 }}>
            <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', mb: 1 }}>
              Ir para
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.8 }}>
              {quickActions.map(a => (
                <Box
                  key={a.label}
                  onClick={() => { onNavigate(a.tab); onClose() }}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.8,
                    px: 1.2, py: 0.8, borderRadius: '10px', cursor: 'pointer',
                    bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                    transition: 'all 0.15s',
                    '&:hover': { bgcolor: 'rgba(255,144,57,0.1)', borderColor: 'rgba(255,144,57,0.3)' },
                  }}
                >
                  <Typography sx={{ fontSize: '0.85rem', lineHeight: 1 }}>{a.icon}</Typography>
                  <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{a.label}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Search results */}
        {query.length >= 2 && results.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)' }}>Nenhum resultado para "{query}"</Typography>
          </Box>
        )}

        {results.length > 0 && (
          <Box sx={{ p: 1 }}>
            <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', px: 1, mb: 0.5 }}>
              {results.length} resultado{results.length !== 1 ? 's' : ''}
            </Typography>
            {results.map(({ item, s, cfg, isLate }, idx) => (
              <Box
                key={item.i}
                onClick={() => handleSelect(item)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  px: 1.2, py: 0.9, borderRadius: '10px', cursor: 'pointer',
                  bgcolor: idx === cursor ? 'rgba(255,144,57,0.1)' : 'transparent',
                  border: idx === cursor ? '1px solid rgba(255,144,57,0.25)' : '1px solid transparent',
                  transition: 'all 0.1s',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.06)' },
                }}
                onMouseEnter={() => setCursor(idx)}
              >
                <Typography sx={{ fontSize: '0.85rem', lineHeight: 1, flexShrink: 0 }}>
                  {TYPE_ICON[item.tp] ?? '📄'}
                </Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }} noWrap>
                    {states[item.i]?.title || item.n}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mt: 0.2 }}>
                    <Typography sx={{ fontSize: '0.58rem', color: '#ff9039', fontWeight: 600 }}>{item.c}</Typography>
                    <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)' }}>·</Typography>
                    <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.35)' }}>
                      {new Date(item.dt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </Typography>
                    {isLate && (
                      <Typography sx={{ fontSize: '0.5rem', color: '#FF4545', fontWeight: 700 }}>ATRASADO</Typography>
                    )}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: cfg.color }} />
                  <Typography sx={{ fontSize: '0.58rem', color: cfg.color, fontWeight: 600 }}>{cfg.label}</Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )}

        {/* Footer */}
        <Box sx={{ px: 2, py: 1, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 1.5 }}>
          {[
            { key: '↑↓', label: 'navegar' },
            { key: '↵', label: 'abrir' },
            { key: 'ESC', label: 'fechar' },
          ].map(hint => (
            <Box key={hint.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ px: 0.6, py: 0.1, borderRadius: 0.8, bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Typography sx={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{hint.key}</Typography>
              </Box>
              <Typography sx={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.25)' }}>{hint.label}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Dialog>
  )
}
