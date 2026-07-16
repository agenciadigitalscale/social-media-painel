import { useState, useMemo, useEffect } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, TextField, FormControl, InputLabel,
  Select, MenuItem, Chip, Divider, IconButton,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { getWorkdays } from '../lib/distribution'
import type { Client, ContentType } from '../types'

type Pattern = 'alternado' | 'posts' | 'reels' | 'stories' | 'feeds'

interface DraftItem { title: string; type: ContentType }

interface Props {
  open: boolean
  onClose: () => void
  allClients: Client[]
  onGenerate: (
    clientName: string,
    items: Array<{ title: string; type: ContentType; docsLink: string }>,
    year: number,
    month: number,
  ) => void
  defaultMonth?: number
  defaultYear?: number
}

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const fieldSx = {
  '& .MuiInputBase-input': { fontSize: '0.8rem' },
  '& .MuiOutlinedInput-root': {
    backdropFilter: 'blur(8px)',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
    '&.Mui-focused fieldset': { borderColor: 'rgba(59,130,246,0.6)' },
  },
}

const selectSx = {
  fontSize: '0.8rem',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(59,130,246,0.6)' },
}

function Label({ children }: { children: string }) {
  return (
    <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(255,255,255,0.28)', mb: 0.7 }}>
      {children}
    </Typography>
  )
}

function typeColor(t: ContentType) {
  if (t === 'Reel')      return { bg: 'rgba(59,130,246,0.14)', color: '#3B82F6', border: 'rgba(59,130,246,0.35)' }
  if (t === 'Story')     return { bg: 'rgba(192,132,252,0.12)', color: '#C084FC', border: 'rgba(192,132,252,0.3)' }
  if (t === 'Carrossel') return { bg: 'rgba(59,130,246,0.12)', color: '#3B82F6', border: 'rgba(59,130,246,0.3)' }
  if (t === 'Feed')      return { bg: 'rgba(59,130,246,0.12)', color: '#3B82F6', border: 'rgba(59,130,246,0.3)' }
  return { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: 'rgba(255,255,255,0.1)' }
}

function applyPattern(titles: string[], pattern: Pattern): DraftItem[] {
  const TYPES: ContentType[] = ['Post', 'Reel', 'Story', 'Carrossel', 'Feed']
  return titles.map((title, idx) => {
    let type: ContentType
    if (pattern === 'posts')    type = 'Post'
    else if (pattern === 'reels')   type = 'Reel'
    else if (pattern === 'stories') type = 'Story'
    else if (pattern === 'feeds')   type = 'Feed'
    else type = idx % 2 === 0 ? 'Post' : 'Reel'   // alternado
    return { title, type }
  })
}

export default function PlanejamentoDialog({ open, onClose, allClients, onGenerate, defaultMonth, defaultYear }: Props) {
  const now = new Date()
  const [client,     setClient]     = useState('')
  const [month,      setMonth]      = useState(defaultMonth ?? now.getMonth())
  const [year,       setYear]       = useState(defaultYear  ?? now.getFullYear())
  const [titlesText, setTitlesText] = useState('')
  const [pattern,    setPattern]    = useState<Pattern>('alternado')
  const [overrides,  setOverrides]  = useState<Record<number, ContentType>>({})

  // Reset quando abre
  useEffect(() => {
    if (open) {
      setTitlesText('')
      setPattern('alternado')
      setOverrides({})
      if (defaultMonth !== undefined) setMonth(defaultMonth)
      if (defaultYear  !== undefined) setYear(defaultYear)
    }
  }, [open, defaultMonth, defaultYear])

  const rawTitles = useMemo(
    () => titlesText.split('\n').map(t => t.trim()).filter(Boolean),
    [titlesText],
  )

  const items: DraftItem[] = useMemo(() => {
    const base = applyPattern(rawTitles, pattern)
    return base.map((item, idx) => overrides[idx] ? { ...item, type: overrides[idx] } : item)
  }, [rawTitles, pattern, overrides])

  const workdays = useMemo(() => getWorkdays(year, month), [year, month])

  const preview = useMemo(() => {
    if (!items.length) return []
    const step = workdays.length / items.length
    return items.map((item, idx) => ({
      ...item,
      date: workdays[Math.min(Math.floor(idx * step), workdays.length - 1)],
    }))
  }, [items, workdays])

  const postCount  = items.filter(i => i.type === 'Post').length
  const reelCount  = items.filter(i => i.type === 'Reel').length
  const otherCount = items.length - postCount - reelCount

  const handleGenerate = () => {
    if (!client || !items.length) return
    onGenerate(client, items.map(i => ({ ...i, docsLink: '' })), year, month)
    onClose()
  }

  const cycleType = (idx: number, current: ContentType) => {
    const order: ContentType[] = ['Post', 'Reel', 'Story', 'Carrossel', 'Feed']
    const next = order[(order.indexOf(current) + 1) % order.length]
    setOverrides(prev => ({ ...prev, [idx]: next }))
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            background: 'rgba(11,11,11,0.97)',
            backdropFilter: 'blur(40px)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '20px',
            maxHeight: '88vh',
          },
        },
      }}
    >
      {/* Header */}
      <DialogTitle sx={{ pb: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '0.95rem' }}>📋 Planejar mês</Typography>
            <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.38)', mt: 0.2 }}>
              Cole os títulos dos conteúdos — distribui automaticamente nos dias úteis
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#fff' }, mt: -0.5 }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{
        pt: 2, pb: 0,
        display: 'flex', flexDirection: 'column', gap: 2,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(59,130,246,0.3)', borderRadius: 2 },
      }}>

        {/* Cliente + Mês + Ano */}
        <Box sx={{ display: 'flex', gap: 1.2 }}>
          <FormControl size="small" sx={{ flex: 2 }}>
            <InputLabel sx={{ fontSize: '0.75rem' }}>Cliente</InputLabel>
            <Select value={client} label="Cliente" onChange={e => setClient(e.target.value)} sx={selectSx}>
              <MenuItem value=""><em style={{ fontSize: '0.78rem' }}>Selecionar…</em></MenuItem>
              {allClients.map(c => (
                <MenuItem key={c.name} value={c.name} sx={{ fontSize: '0.8rem' }}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ flex: 1.2 }}>
            <InputLabel sx={{ fontSize: '0.75rem' }}>Mês</InputLabel>
            <Select value={month} label="Mês" onChange={e => setMonth(Number(e.target.value))} sx={selectSx}>
              {MONTHS.map((m, i) => (
                <MenuItem key={i} value={i} sx={{ fontSize: '0.8rem' }}>{m}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ width: 76 }}>
            <InputLabel sx={{ fontSize: '0.75rem' }}>Ano</InputLabel>
            <Select value={year} label="Ano" onChange={e => setYear(Number(e.target.value))} sx={selectSx}>
              {[2025, 2026, 2027].map(y => (
                <MenuItem key={y} value={y} sx={{ fontSize: '0.8rem' }}>{y}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Padrão de tipos */}
        <Box>
          <Label>Padrão de distribuição</Label>
          <Box sx={{ display: 'flex', gap: 0.7, flexWrap: 'wrap' }}>
            {([
              ['alternado', '🔁 Post + Reel'],
              ['posts',     '📷 Só Posts'],
              ['reels',     '🎬 Só Reels'],
              ['stories',   '📱 Só Stories'],
            ] as [Pattern, string][]).map(([p, label]) => (
              <Chip
                key={p}
                label={label}
                size="small"
                onClick={() => { setPattern(p); setOverrides({}) }}
                sx={{
                  fontSize: '0.62rem', cursor: 'pointer', fontWeight: pattern === p ? 700 : 400,
                  bgcolor:  pattern === p ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                  border:  `1px solid ${pattern === p ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  color:    pattern === p ? '#3B82F6' : 'rgba(255,255,255,0.4)',
                  transition: 'all 0.15s',
                  '&:hover': { bgcolor: 'rgba(59,130,246,0.1)' },
                }}
              />
            ))}
          </Box>
        </Box>

        {/* Textarea de títulos */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.7 }}>
            <Label>Títulos (um por linha)</Label>
            {rawTitles.length > 0 && (
              <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)' }}>
                {rawTitles.length} conteúdo{rawTitles.length !== 1 ? 's' : ''}
                {postCount > 0 && ` · ${postCount} Posts`}
                {reelCount > 0 && ` · ${reelCount} Reels`}
                {otherCount > 0 && ` · ${otherCount} outros`}
              </Typography>
            )}
          </Box>
          <TextField
            multiline
            minRows={4}
            maxRows={8}
            fullWidth
            size="small"
            placeholder={'Cole ou digite um título por linha:\nCafé da manhã\nReceita especial\nMaking of da cozinha\nDestaque de produto'}
            value={titlesText}
            onChange={e => setTitlesText(e.target.value)}
            sx={{
              ...fieldSx,
              '& .MuiInputBase-input': { fontSize: '0.8rem', fontFamily: 'monospace', lineHeight: 1.7 },
            }}
          />
          <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.2)', mt: 0.6 }}>
            Dica: cole direto da planilha de roteiros. Você pode ajustar o tipo de cada item na prévia abaixo.
          </Typography>
        </Box>

        {/* Preview da distribuição */}
        {preview.length > 0 && (
          <>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.8 }}>
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(255,255,255,0.28)' }}>
                  Prévia — {workdays.length} dias úteis em {MONTHS[month]}
                </Typography>
                <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.22)' }}>
                  Clique no tipo para alternar
                </Typography>
              </Box>
              <Box sx={{
                display: 'flex', flexDirection: 'column', gap: 0.4,
                maxHeight: 200, overflowY: 'auto',
                '&::-webkit-scrollbar': { width: 3 },
                '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(59,130,246,0.3)', borderRadius: 2 },
              }}>
                {preview.map((item, idx) => {
                  const tc = typeColor(item.type)
                  return (
                    <Box key={idx} sx={{
                      display: 'flex', alignItems: 'center', gap: 1,
                      px: 1, py: 0.45, borderRadius: '8px',
                      bgcolor: 'rgba(255,255,255,0.025)',
                      border: '1px solid rgba(255,255,255,0.04)',
                    }}>
                      <Typography sx={{
                        fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', width: 44,
                        flexShrink: 0, fontVariantNumeric: 'tabular-nums',
                      }}>
                        {item.date.getDate()} {MONTHS[item.date.getMonth()].slice(0, 3)}
                      </Typography>
                      <Chip
                        label={item.type}
                        size="small"
                        onClick={() => cycleType(idx, item.type)}
                        sx={{
                          height: 17, fontSize: '0.55rem', fontWeight: 700, flexShrink: 0, cursor: 'pointer',
                          bgcolor: tc.bg, color: tc.color, border: `1px solid ${tc.border}`,
                          transition: 'all 0.15s',
                          '&:hover': { filter: 'brightness(1.15)' },
                        }}
                      />
                      <Typography noWrap sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.78)', flex: 1 }}>
                        {item.title}
                      </Typography>
                    </Box>
                  )
                })}
              </Box>
            </Box>
          </>
        )}

        <Box sx={{ height: 4 }} />
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.06)', gap: 1 }}>
        <Button
          size="small"
          onClick={onClose}
          sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', borderRadius: '10px' }}
        >
          Cancelar
        </Button>
        <Button
          onClick={handleGenerate}
          disabled={!client || items.length === 0}
          size="small"
          variant="contained"
          sx={{
            background: 'linear-gradient(135deg, #3B82F6, #06B6D4)',
            color: '#fff', fontWeight: 800, fontSize: '0.75rem',
            px: 2.5, borderRadius: '10px',
            boxShadow: '0 4px 16px rgba(59,130,246,0.28)',
            '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-1px)' },
            '&.Mui-disabled': { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.22)', boxShadow: 'none' },
          }}
        >
          {items.length > 0 ? `✓ Criar ${items.length} cards` : 'Criar cards'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
