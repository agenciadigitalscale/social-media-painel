import { useState, useMemo, useEffect, useRef } from 'react'
import { Box, Typography, Dialog, TextField, InputAdornment } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import type { ContentItem, ItemState, Status } from '../types'
import { STATUS_CONFIG, STATUS_ORDER } from '../types'
import { DS } from '../theme'

interface Props {
  open: boolean
  onClose: () => void
  items: ContentItem[]
  states: Record<number, ItemState>
  onNavigate: (tabIndex: number, itemId?: number) => void
  onUpdateStatus?: (itemId: number, newStatus: Status) => void
}

const TYPE_ICON: Record<string, string> = { Post: '📷', Reel: '🎬', Story: '📱', Carrossel: '🖼️', Feed: '📸' }

const TYPE_COLOR: Record<string, { bg: string; color: string }> = {
  Post:      { bg: 'rgba(244,247,255,0.06)',  color: 'rgba(244,247,255,0.5)' },
  Reel:      { bg: 'rgba(59,130,246,0.14)',   color: DS.accent },
  Story:     { bg: 'rgba(192,132,252,0.12)',  color: '#C084FC' },
  Carrossel: { bg: 'rgba(59,130,246,0.12)',   color: DS.accent },
  Feed:      { bg: 'rgba(59,130,246,0.12)',   color: DS.accent },
}

const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export default function GlobalSearch({ open, onClose, items, states, onNavigate, onUpdateStatus }: Props) {
  const [query,  setQuery]  = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLDivElement>(null)

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
        const title  = (states[i.i]?.title || i.n).toLowerCase()
        const client = i.c.toLowerCase()
        const type   = i.tp.toLowerCase()
        const status = states[i.i] ? STATUS_CONFIG[states[i.i].status].label.toLowerCase() : ''
        return title.includes(q) || client.includes(q) || type.includes(q) || status.includes(q)
      })
      .slice(0, 30)
      .map(i => {
        const s = states[i.i]?.status ?? i.s
        const cfg = STATUS_CONFIG[s]
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const isLate = s !== 7 && s !== 5 && new Date(i.dt) < today
        return { item: i, s, cfg, isLate }
      })
  }, [query, items, states])

  useEffect(() => { setCursor(0) }, [results])

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.children[cursor] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const selectedResult = results[cursor]

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    if (e.key === 'Enter' && results[cursor]) handleSelect(results[cursor].item)
    if (e.key === 'Escape') onClose()
  }

  function handleSelect(item: ContentItem) {
    const dt = new Date(item.dt)
    const now = new Date()
    if (dt.toDateString() === now.toDateString()) onNavigate(0)
    else if (dt >= now) onNavigate(2)
    else onNavigate(3)
    onClose()
  }

  const quickActions = [
    { label: 'Produções', icon: '⚡', tab: 3 },
    { label: 'Calendário', icon: '📅', tab: 5 },
    { label: 'Clientes',   icon: '👥', tab: 6 },
    { label: 'Dashboard',  icon: '📊', tab: 7 },
    { label: 'Roteiros',   icon: '✍️', tab: 19 },
    { label: 'Tráfego',    icon: '📈', tab: 15 },
  ]

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={selectedResult ? 'md' : 'sm'}
      fullWidth
      PaperProps={{
        sx: {
          background: 'rgba(10,10,10,0.99)',
          backdropFilter: 'blur(40px)',
          border: '1px solid rgba(244,247,255,0.09)',
          borderRadius: '20px',
          overflow: 'hidden',
          mt: { xs: 4, md: 8 },
          mx: { xs: 1, md: 'auto' },
          maxHeight: '72vh',
          transition: 'max-width 0.2s ease',
        },
      }}
      sx={{
        '& .MuiDialog-container': { alignItems: 'flex-start' },
        '& .MuiBackdrop-root': { backdropFilter: 'blur(6px)', bgcolor: 'rgba(0,0,0,0.7)' },
      }}
    >
      {/* ── Input ─────────────────────────────────────────── */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(244,247,255,0.07)', display: 'flex', alignItems: 'center', gap: 1.2 }}>
        <SearchIcon sx={{ color: 'rgba(244,247,255,0.3)', fontSize: 20, flexShrink: 0 }} />
        <TextField
          inputRef={inputRef}
          fullWidth
          variant="standard"
          placeholder="Buscar conteúdo, cliente, status…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
          InputProps={{ disableUnderline: true }}
          inputProps={{ style: { fontSize: '0.92rem', color: 'rgba(244,247,255,0.88)', padding: 0 } }}
        />
        {query && (
          <Box onClick={() => setQuery('')} sx={{ cursor: 'pointer', p: 0.3, borderRadius: 1, color: 'rgba(244,247,255,0.3)', '&:hover': { color: '#fff', bgcolor: 'rgba(244,247,255,0.06)' } }}>
            <CloseIcon sx={{ fontSize: 14 }} />
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 0.6, flexShrink: 0 }}>
          <Box sx={{ px: 0.7, py: 0.2, borderRadius: '5px', bgcolor: 'rgba(244,247,255,0.06)', border: '1px solid rgba(244,247,255,0.1)' }}>
            <Typography sx={{ fontSize: '0.55rem', color: 'rgba(244,247,255,0.35)', fontFamily: 'monospace', fontWeight: 700 }}>Ctrl K</Typography>
          </Box>
        </Box>
      </Box>

      {/* ── Body ──────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', minHeight: 0, flex: 1 }}>

        {/* Lista de resultados */}
        <Box
          ref={listRef}
          sx={{
            flex: selectedResult ? { xs: 1, md: '0 0 320px' } : 1,
            overflowY: 'auto',
            scrollbarWidth: 'thin', scrollbarColor: 'rgba(59,130,246,0.3) transparent',
            '&::-webkit-scrollbar': { width: 3 },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(59,130,246,0.3)', borderRadius: 2 },
            borderRight: selectedResult ? { md: '1px solid rgba(244,247,255,0.06)' } : 'none',
          }}
        >
          {/* Quick nav (sem query) */}
          {!query && (
            <Box sx={{ p: 2 }}>
              <Typography sx={{ fontSize: '0.56rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(244,247,255,0.28)', mb: 1 }}>
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
                      bgcolor: 'rgba(244,247,255,0.04)', border: '1px solid rgba(244,247,255,0.06)',
                      transition: 'all 0.15s',
                      '&:hover': { bgcolor: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.3)' },
                    }}
                  >
                    <Typography sx={{ fontSize: '0.85rem', lineHeight: 1 }}>{a.icon}</Typography>
                    <Typography sx={{ fontSize: '0.68rem', color: 'rgba(244,247,255,0.7)', fontWeight: 600 }}>{a.label}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* Sem resultados */}
          {query.length >= 2 && results.length === 0 && (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.78rem', color: 'rgba(244,247,255,0.28)' }}>Nenhum resultado para "{query}"</Typography>
            </Box>
          )}

          {/* Resultados */}
          {results.length > 0 && (
            <Box sx={{ p: 1 }}>
              <Typography sx={{ fontSize: '0.54rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(244,247,255,0.28)', px: 1, mb: 0.6 }}>
                {results.length} resultado{results.length !== 1 ? 's' : ''}
              </Typography>
              {results.map(({ item, s, cfg, isLate }, idx) => {
                const active = idx === cursor
                const title = states[item.i]?.title || item.n
                return (
                  <Box
                    key={item.i}
                    onClick={() => setCursor(idx)}
                    onDoubleClick={() => handleSelect(item)}
                    onMouseEnter={() => setCursor(idx)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1,
                      px: 1.2, py: 0.85, borderRadius: '10px', cursor: 'pointer',
                      bgcolor: active ? 'rgba(59,130,246,0.09)' : 'transparent',
                      borderLeft: `2px solid ${active ? DS.accent : 'transparent'}`,
                      transition: 'all 0.1s',
                      '&:hover': { bgcolor: active ? 'rgba(59,130,246,0.09)' : 'rgba(244,247,255,0.03)' },
                    }}
                  >
                    <Typography sx={{ fontSize: '0.85rem', lineHeight: 1, flexShrink: 0 }}>
                      {TYPE_ICON[item.tp] ?? '📄'}
                    </Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgba(244,247,255,0.9)' }}>
                        {title}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mt: 0.15 }}>
                        <Typography sx={{ fontSize: '0.58rem', color: DS.accent, fontWeight: 600 }}>{item.c}</Typography>
                        <Typography sx={{ fontSize: '0.5rem', color: 'rgba(244,247,255,0.25)' }}>·</Typography>
                        <Typography sx={{ fontSize: '0.55rem', color: 'rgba(244,247,255,0.32)' }}>
                          {item.dt.getDate()} {MONTHS_SHORT[item.dt.getMonth()]}
                        </Typography>
                        {isLate && (
                          <Typography sx={{ fontSize: '0.5rem', color: DS.red, fontWeight: 700 }}>ATRASADO</Typography>
                        )}
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                      <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: cfg.color, boxShadow: `0 0 4px ${cfg.glow}` }} />
                      <Typography sx={{ fontSize: '0.56rem', color: cfg.color, fontWeight: 600 }}>{cfg.shortLabel}</Typography>
                    </Box>
                  </Box>
                )
              })}
            </Box>
          )}
        </Box>

        {/* ── Painel de detalhe (desktop) ─────────────────── */}
        {selectedResult && (
          <Box sx={{
            display: { xs: 'none', md: 'flex' },
            flex: 1, flexDirection: 'column', p: 2.5, gap: 1.8,
            overflowY: 'auto',
            scrollbarWidth: 'thin', scrollbarColor: 'rgba(59,130,246,0.3) transparent',
            '&::-webkit-scrollbar': { width: 3 },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(59,130,246,0.3)', borderRadius: 2 },
          }}>
            {(() => {
              const { item, cfg } = selectedResult
              const st = states[item.i]
              const tc = TYPE_COLOR[item.tp] ?? TYPE_COLOR.Post
              const title = st?.title || item.n

              return (
                <>
                  {/* Type + date + client */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Box sx={{ px: 0.9, py: 0.3, borderRadius: '7px', fontSize: '0.6rem', fontWeight: 700, bgcolor: tc.bg, color: tc.color, border: `1px solid ${tc.color}30` }}>
                      {item.tp}
                    </Box>
                    <Typography sx={{ fontSize: '0.62rem', color: 'rgba(244,247,255,0.32)' }}>
                      {item.dt.getDate()} {MONTHS_SHORT[item.dt.getMonth()]} {item.dt.getFullYear()} · {item.c}
                    </Typography>
                  </Box>

                  {/* Título */}
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#fff', lineHeight: 1.35 }}>
                    {title}
                  </Typography>

                  {/* Status atual */}
                  <Box sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.8, alignSelf: 'flex-start',
                    px: 1.2, py: 0.55, borderRadius: '9px',
                    bgcolor: `${cfg.color}14`, border: `1px solid ${cfg.color}35`,
                  }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: cfg.color, boxShadow: `0 0 5px ${cfg.glow}` }} />
                    <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: cfg.color }}>
                      {cfg.emoji} {cfg.label}
                    </Typography>
                  </Box>

                  {/* Link */}
                  {st?.link && (
                    <Box
                      component="a"
                      href={st.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 0.9,
                        px: 1.4, py: 0.9, borderRadius: '10px',
                        bgcolor: 'rgba(244,247,255,0.04)', border: '1px solid rgba(244,247,255,0.08)',
                        textDecoration: 'none',
                        '&:hover': { bgcolor: 'rgba(59,130,246,0.07)', borderColor: 'rgba(59,130,246,0.25)' },
                        transition: 'all 0.15s',
                      }}
                    >
                      <OpenInNewIcon sx={{ fontSize: 13, color: DS.accent, flexShrink: 0 }} />
                      <Typography noWrap sx={{ fontSize: '0.62rem', color: 'rgba(244,247,255,0.55)' }}>
                        {st.link}
                      </Typography>
                    </Box>
                  )}

                  {/* Notas */}
                  {st?.notes && (
                    <Box>
                      <Typography sx={{ fontSize: '0.54rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(244,247,255,0.22)', mb: 0.5 }}>
                        Notas
                      </Typography>
                      <Typography sx={{ fontSize: '0.7rem', color: 'rgba(244,247,255,0.48)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                        {st.notes.slice(0, 240)}{st.notes.length > 240 ? '…' : ''}
                      </Typography>
                    </Box>
                  )}

                  {/* Responsável */}
                  {(st?.responsible || st?.assignedEditor) && (
                    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                      {st.responsible && (
                        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(244,247,255,0.28)' }}>
                          Responsável: <Box component="span" sx={{ color: 'rgba(244,247,255,0.6)', fontWeight: 600 }}>{st.responsible}</Box>
                        </Typography>
                      )}
                      {st.assignedEditor && (
                        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(244,247,255,0.28)' }}>
                          Editor: <Box component="span" sx={{ color: 'rgba(244,247,255,0.6)', fontWeight: 600 }}>{st.assignedEditor}</Box>
                        </Typography>
                      )}
                    </Box>
                  )}

                  {/* Alterar status */}
                  {onUpdateStatus && st && (
                    <Box sx={{ mt: 'auto', pt: 1.5, borderTop: '1px solid rgba(244,247,255,0.06)' }}>
                      <Typography sx={{ fontSize: '0.54rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(244,247,255,0.2)', mb: 0.9 }}>
                        Alterar status
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {STATUS_ORDER.map(s => {
                          const sc = STATUS_CONFIG[s]
                          const isCurrent = st.status === s
                          return (
                            <Box
                              key={s}
                              onClick={() => { if (!isCurrent) onUpdateStatus(item.i, s) }}
                              sx={{
                                px: 0.9, py: 0.4, borderRadius: '7px',
                                fontSize: '0.58rem', fontWeight: isCurrent ? 700 : 400,
                                bgcolor: isCurrent ? `${sc.color}1e` : 'rgba(244,247,255,0.04)',
                                color: isCurrent ? sc.color : 'rgba(244,247,255,0.32)',
                                border: `1px solid ${isCurrent ? sc.color + '50' : 'rgba(244,247,255,0.07)'}`,
                                cursor: isCurrent ? 'default' : 'pointer',
                                transition: 'all 0.12s',
                                '&:hover': !isCurrent ? { bgcolor: `${sc.color}12`, color: sc.color, borderColor: `${sc.color}35` } : {},
                              }}
                            >
                              {sc.emoji} {sc.shortLabel}
                            </Box>
                          )
                        })}
                      </Box>
                    </Box>
                  )}
                </>
              )
            })()}
          </Box>
        )}
      </Box>

      {/* ── Footer ────────────────────────────────────────── */}
      <Box sx={{
        px: 2, py: 0.9, borderTop: '1px solid rgba(244,247,255,0.05)',
        display: 'flex', alignItems: 'center', gap: 2,
      }}>
        <Typography sx={{ fontSize: '0.55rem', color: 'rgba(244,247,255,0.18)' }}>
          {results.length > 0 ? `${results.length} resultado${results.length !== 1 ? 's' : ''}` : 'Ctrl+K para abrir · S para buscar'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.2, ml: 'auto' }}>
          {[['↑↓', 'navegar'], ['↵', 'ir para aba'], ['ESC', 'fechar']].map(([key, lbl]) => (
            <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
              <Box sx={{ px: 0.6, py: 0.1, borderRadius: '4px', bgcolor: 'rgba(244,247,255,0.07)', border: '1px solid rgba(244,247,255,0.1)', fontSize: '0.55rem', fontFamily: 'monospace', color: 'rgba(244,247,255,0.32)' }}>{key}</Box>
              <Typography sx={{ fontSize: '0.52rem', color: 'rgba(244,247,255,0.18)' }}>{lbl}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Dialog>
  )
}
