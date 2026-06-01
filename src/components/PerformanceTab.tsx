/* PerformanceTab.tsx — Tabela de métricas pós-publicação
   Edição inline estilo planilha: Tab entre campos, Enter para próxima linha.
   Salva no estado global no onBlur; ER% calculado em tempo real.
*/
import { useMemo, useRef, useState, useCallback, lazy, Suspense } from 'react'
import {
  Box, Typography, Paper, Stack, Chip, Select, MenuItem,
  FormControl, Button, Tooltip, CircularProgress,
} from '@mui/material'
import BarChartIcon from '@mui/icons-material/BarChart'
import type { ContentItem, ItemState, Client } from '../types'

const MonthlyReportModal = lazy(() => import('./MonthlyReportModal'))

// ── Helpers ────────────────────────────────────────────────
type Eng = { likes?: number; comments?: number; reach?: number; saves?: number }
type EngKey = keyof Eng

function calcER(eng: Eng | undefined): number | null {
  if (!eng?.reach) return null
  return ((eng.likes ?? 0) + (eng.comments ?? 0)) / eng.reach * 100
}

function erColor(er: number | null): string {
  if (er === null) return '#52525B'
  if (er >= 5)     return '#00C47A'
  if (er >= 2)     return '#FFD700'
  return '#FF4545'
}

function fmtBig(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString('pt-BR')
}

// ── KPI card ───────────────────────────────────────────────
function KpiCard({ label, value, color = '#ff9039' }: { label: string; value: string | number; color?: string }) {
  return (
    <Paper sx={{
      px: { xs: 1.5, xl: 2 }, py: 1.4, flex: 1, minWidth: 90, textAlign: 'center',
      border: `1px solid ${color}22`, bgcolor: `${color}09`, borderRadius: 2.5,
      position: 'relative', overflow: 'hidden',
      boxShadow: `0 2px 12px ${color}12, inset 0 1px 0 ${color}18`,
      transition: 'all 0.2s ease',
      '&::after': {
        content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
        background: `linear-gradient(90deg, transparent, ${color}55 50%, transparent)`,
        pointerEvents: 'none',
      },
      '&:hover': {
        boxShadow: `0 4px 20px ${color}22`,
        borderColor: `${color}35`,
        transform: 'translateY(-1px)',
      },
    }}>
      <Typography sx={{ fontWeight: 900, fontSize: { xs: '1.3rem', xl: '1.6rem' }, color, lineHeight: 1, letterSpacing: '-0.03em' }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: { xs: '0.56rem', xl: '0.62rem' }, color: 'rgba(255,255,255,0.4)', mt: 0.6, textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700 }}>
        {label}
      </Typography>
    </Paper>
  )
}

// ── Tipos ─────────────────────────────────────────────────
type SortMode = 'date' | 'er_desc' | 'er_asc'
const FIELDS = ['likes', 'comments', 'reach', 'saves'] as const
type Field = typeof FIELDS[number]
const FIELD_LABEL: Record<Field, string> = { likes: '❤️ Curt.', comments: '💬 Comt.', reach: '👁 Alcance', saves: '🔖 Salv.' }
const FIELD_COLOR: Record<Field, string> = { likes: '#FF4545', comments: '#60A5FA', reach: '#00C47A', saves: '#FFD700' }

interface Props {
  items:        ContentItem[]
  states:       Record<number, ItemState>
  allClients:   Client[]
  clientPhones?: Record<string, string>
  now:          Date
  onUpdate:     (id: number, patch: Partial<ItemState>) => void
}

// ── Componente principal ───────────────────────────────────
export default function PerformanceTab({ items, states, allClients, clientPhones, now, onUpdate }: Props) {

  // ── Seletores de mês ──────────────────────────────────────
  const months = useMemo(() => {
    const seen = new Map<string, { year: number; month: number }>()
    for (const i of items) {
      const k = `${i.dt.getFullYear()}-${i.dt.getMonth()}`
      if (!seen.has(k)) seen.set(k, { year: i.dt.getFullYear(), month: i.dt.getMonth() })
    }
    return [...seen.values()].sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month)
  }, [items])

  const [selMonth, setSelMonth] = useState<{ year: number; month: number }>(
    () => months[0] ?? { year: now.getFullYear(), month: now.getMonth() }
  )
  const [selClient, setSelClient] = useState<string>('__all__')
  const [sortMode, setSortMode] = useState<SortMode>('date')
  const [showEmpty, setShowEmpty] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportClient, setReportClient] = useState<string | undefined>()

  // Refs para navegação por teclado
  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  // ── Dados filtrados ────────────────────────────────────────
  const clients = useMemo(() =>
    [...new Set(
      items
        .filter(i => i.dt.getFullYear() === selMonth.year && i.dt.getMonth() === selMonth.month)
        .map(i => i.c)
    )].sort()
  , [items, selMonth])

  const publishedRows = useMemo(() => {
    return items.filter(i => {
      const st    = states[i.i]?.status ?? i.s
      const same  = i.dt.getFullYear() === selMonth.year && i.dt.getMonth() === selMonth.month
      const byClient = selClient === '__all__' || i.c === selClient
      const noData   = showEmpty
        ? !states[i.i]?.engagement?.reach
        : true
      return st === 7 && same && byClient && noData
    })
  }, [items, states, selMonth, selClient, showEmpty])

  const sortedRows = useMemo(() => {
    const rows = [...publishedRows]
    if (sortMode === 'date')     return rows.sort((a, b) => a.dt.getTime() - b.dt.getTime())
    const er = (i: ContentItem) => calcER(states[i.i]?.engagement) ?? (sortMode === 'er_desc' ? -1 : 999)
    return rows.sort((a, b) => sortMode === 'er_desc' ? er(b) - er(a) : er(a) - er(b))
  }, [publishedRows, sortMode, states])

  // ── KPIs globais ───────────────────────────────────────────
  const kpis = useMemo(() => {
    const base = items.filter(i => {
      const st = states[i.i]?.status ?? i.s
      return st === 7 &&
        i.dt.getFullYear() === selMonth.year &&
        i.dt.getMonth() === selMonth.month &&
        (selClient === '__all__' || i.c === selClient)
    })
    const withData  = base.filter(i => states[i.i]?.engagement?.reach)
    const reach     = withData.reduce((s, i) => s + (states[i.i].engagement?.reach    ?? 0), 0)
    const likes     = withData.reduce((s, i) => s + (states[i.i].engagement?.likes    ?? 0), 0)
    const comments  = withData.reduce((s, i) => s + (states[i.i].engagement?.comments ?? 0), 0)
    const erList    = withData.map(i => calcER(states[i.i].engagement)).filter((e): e is number => e !== null)
    const avgER     = erList.length > 0 ? erList.reduce((a, b) => a + b, 0) / erList.length : null
    const fillPct   = base.length > 0 ? Math.round((withData.length / base.length) * 100) : 0
    const bestItem  = withData.reduce<ContentItem | null>((best, i) => {
      const e = calcER(states[i.i].engagement) ?? -1
      return !best || e > (calcER(states[best.i].engagement) ?? -1) ? i : best
    }, null)
    return { total: base.length, withData: withData.length, reach, likes, comments, avgER, fillPct, bestItem }
  }, [items, states, selMonth, selClient])

  // ── Save on blur ───────────────────────────────────────────
  const handleBlur = useCallback((id: number, field: Field, raw: string) => {
    const current = (states[id]?.engagement ?? {}) as Eng
    const val     = raw.trim() !== '' ? Number(raw) : undefined
    if ((current[field as EngKey] ?? undefined) === val) return  // sem mudança
    onUpdate(id, { engagement: { ...(states[id]?.engagement ?? {}), [field]: val } })
  }, [states, onUpdate])

  // ── Navegação por teclado ──────────────────────────────────
  const focusCell = useCallback((itemId: number, fieldIdx: number) => {
    if (fieldIdx < 0 || fieldIdx >= FIELDS.length) return false
    const ref = cellRefs.current.get(`${itemId}-${FIELDS[fieldIdx]}`)
    if (ref) { ref.focus(); ref.select(); return true }
    return false
  }, [])

  const handleKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    colIdx: number,
  ) => {
    const rows = sortedRows  // captura do closure
    if (e.key === 'Tab') {
      e.preventDefault()
      if (colIdx < FIELDS.length - 1) {
        focusCell(rows[rowIdx].i, colIdx + 1)
      } else if (rowIdx < rows.length - 1) {
        focusCell(rows[rowIdx + 1].i, 0)
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (rowIdx < rows.length - 1) focusCell(rows[rowIdx + 1].i, colIdx)
    } else if (e.key === 'ArrowUp' && rowIdx > 0) {
      e.preventDefault()
      focusCell(rows[rowIdx - 1].i, colIdx)
    } else if (e.key === 'ArrowDown' && rowIdx < rows.length - 1) {
      e.preventDefault()
      focusCell(rows[rowIdx + 1].i, colIdx)
    }
  }, [sortedRows, focusCell])

  const monthLabel = (y: number, m: number) =>
    new Date(y, m, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  // ── Render ─────────────────────────────────────────────────
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Cabeçalho ─────────────────────────────────────── */}
      <Box sx={{
        px: { xs: 1.5, xl: 3 }, pt: 2, pb: 1.5, flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        position: 'relative',
        '&::after': {
          content: '""', position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(0,196,122,0.4) 30%, rgba(0,196,122,0.6) 50%, rgba(0,196,122,0.4) 70%, transparent)',
          pointerEvents: 'none',
        },
      }}>

        {/* Título + filtros */}
        <Stack direction="row" alignItems="center" gap={1.5} mb={2} flexWrap="wrap">
          <Stack direction="row" alignItems="center" gap={1}>
            <Box sx={{
              width: 32, height: 32, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: 'rgba(0,196,122,0.12)', border: '1px solid rgba(0,196,122,0.25)',
              boxShadow: '0 0 12px rgba(0,196,122,0.15)',
            }}>
              <BarChartIcon sx={{ color: '#00C47A', fontSize: 17 }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: { xs: '0.95rem', xl: '1.1rem' }, color: '#00C47A', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                Performance
              </Typography>
              <Typography sx={{ fontSize: '0.56rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Métricas pós-publicação
              </Typography>
            </Box>
          </Stack>

          {/* Mês */}
          <FormControl size="small" sx={{ minWidth: 155 }}>
            <Select
              value={`${selMonth.year}-${selMonth.month}`}
              onChange={e => {
                const [y, m] = (e.target.value as string).split('-').map(Number)
                setSelMonth({ year: y, month: m })
              }}
              sx={{ fontSize: '0.78rem', textTransform: 'capitalize',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' } }}>
              {months.map(({ year, month }) => (
                <MenuItem key={`${year}-${month}`} value={`${year}-${month}`}
                  sx={{ fontSize: '0.8rem', textTransform: 'capitalize' }}>
                  {monthLabel(year, month)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Cliente */}
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <Select value={selClient} onChange={e => setSelClient(e.target.value)}
              sx={{ fontSize: '0.78rem',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' } }}>
              <MenuItem value="__all__" sx={{ fontSize: '0.8rem' }}>Todos os clientes</MenuItem>
              {clients.map(c => (
                <MenuItem key={c} value={c} sx={{ fontSize: '0.8rem' }}>{c}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box flex={1} />

          {/* Sem métricas toggle */}
          <Chip
            label={showEmpty ? '🔴 Sem métricas' : 'Sem métricas'}
            size="small"
            onClick={() => setShowEmpty(v => !v)}
            sx={{
              fontSize: '0.64rem', height: 26, cursor: 'pointer',
              bgcolor: showEmpty ? 'rgba(255,69,69,0.12)' : 'transparent',
              color: showEmpty ? '#FF4545' : 'text.secondary',
              border: `1px solid ${showEmpty ? 'rgba(255,69,69,0.3)' : 'rgba(255,255,255,0.1)'}`,
            }}
          />

          {/* Sort */}
          {(['date', 'er_desc', 'er_asc'] as SortMode[]).map(m => (
            <Chip key={m}
              label={m === 'date' ? '📅 Data' : m === 'er_desc' ? '📈 ER ↓' : '📉 ER ↑'}
              size="small"
              onClick={() => setSortMode(m)}
              sx={{
                fontSize: '0.62rem', height: 24, cursor: 'pointer',
                bgcolor: sortMode === m ? 'rgba(0,196,122,0.12)' : 'transparent',
                color: sortMode === m ? '#00C47A' : 'text.secondary',
                border: `1px solid ${sortMode === m ? 'rgba(0,196,122,0.3)' : 'rgba(255,255,255,0.08)'}`,
              }}
            />
          ))}
        </Stack>

        {/* KPIs */}
        <Stack direction="row" gap={1.2} mb={1.5} flexWrap="wrap">
          <KpiCard label="Publicados" value={kpis.total} color="#00C47A" />
          <KpiCard label="👁 Alcance" value={kpis.reach > 0 ? fmtBig(kpis.reach) : '—'} color="#3B8EFF" />
          <KpiCard label="❤️ Curtidas" value={kpis.likes > 0 ? fmtBig(kpis.likes) : '—'} color="#FF4545" />
          <KpiCard label="📊 ER médio"
            value={kpis.avgER !== null ? `${kpis.avgER.toFixed(1)}%` : '—'}
            color={kpis.avgER !== null ? erColor(kpis.avgER) : '#52525B'} />
          <KpiCard label="Com dados"
            value={`${kpis.fillPct}%`}
            color={kpis.fillPct >= 70 ? '#00C47A' : kpis.fillPct >= 30 ? '#FFD700' : '#FF4545'} />
        </Stack>

        {/* Melhor post */}
        {kpis.bestItem && (() => {
          const eng = states[kpis.bestItem.i]?.engagement
          const er  = calcER(eng)
          return (
            <Paper sx={{
              px: 1.8, py: 1.2, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1.8,
              border: '1px solid rgba(255,215,0,0.22)', bgcolor: 'rgba(255,215,0,0.06)', borderRadius: 2,
              position: 'relative', overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(255,215,0,0.08)',
              '&::before': {
                content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px',
                background: 'linear-gradient(180deg, #FFD700, #ff9039)',
                borderRadius: '2px 0 0 2px',
              },
              '&::after': {
                content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.5) 50%, transparent)',
                pointerEvents: 'none',
              },
            }}>
              <Box sx={{
                width: 38, height: 38, borderRadius: 2, flexShrink: 0,
                bgcolor: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 16px rgba(255,215,0,0.2)',
              }}>
                <Typography sx={{ fontSize: '1.2rem', lineHeight: 1 }}>🏆</Typography>
              </Box>
              <Box flex={1} minWidth={0}>
                <Typography sx={{ fontSize: '0.58rem', color: '#FFD700', fontWeight: 700, mb: 0.3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Melhor post do período
                </Typography>
                <Typography noWrap sx={{ fontSize: '0.8rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                  {kpis.bestItem.c} · {kpis.bestItem.n || kpis.bestItem.tp}
                </Typography>
                <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.45)', mt: 0.2 }}>
                  {kpis.bestItem.tp} · {kpis.bestItem.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </Typography>
              </Box>
              <Stack direction="row" gap={2} flexShrink={0}>
                {eng?.reach    && <Box sx={{ textAlign: 'center' }}><Typography sx={{ fontSize: '0.88rem', fontWeight: 900, color: '#3B8EFF', letterSpacing: '-0.02em' }}>{fmtBig(eng.reach)}</Typography><Typography sx={{ fontSize: '0.54rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>alcance</Typography></Box>}
                {eng?.likes    && <Box sx={{ textAlign: 'center' }}><Typography sx={{ fontSize: '0.88rem', fontWeight: 900, color: '#FF4545', letterSpacing: '-0.02em' }}>{fmtBig(eng.likes)}</Typography><Typography sx={{ fontSize: '0.54rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>curtidas</Typography></Box>}
                {er !== null   && <Box sx={{ textAlign: 'center' }}><Typography sx={{ fontSize: '1.1rem', fontWeight: 900, color: '#FFD700', letterSpacing: '-0.03em', textShadow: '0 0 12px rgba(255,215,0,0.4)' }}>{er.toFixed(1)}%</Typography><Typography sx={{ fontSize: '0.54rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>ER</Typography></Box>}
              </Stack>
            </Paper>
          )
        })()}
      </Box>

      {/* ── Tabela ────────────────────────────────────────── */}
      <Box sx={{
        flex: 1, overflow: 'auto', px: { xs: 1, xl: 3 },
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(0,196,122,0.3) transparent',
        '&::-webkit-scrollbar': { width: 4, height: 4 },
        '&::-webkit-scrollbar-thumb': { background: 'linear-gradient(180deg, rgba(0,196,122,0.5), rgba(59,142,255,0.5))', borderRadius: 4 },
      }}>
        {sortedRows.length === 0 ? (
          <Paper sx={{
            py: 8, textAlign: 'center', border: '1px dashed rgba(255,255,255,0.07)',
            bgcolor: 'transparent', borderRadius: 2, mt: 2,
          }}>
            <BarChartIcon sx={{ fontSize: 40, color: 'rgba(255,255,255,0.07)', mb: 1.5, display: 'block', mx: 'auto' }} />
            <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.25)', fontWeight: 500 }}>
              {showEmpty
                ? 'Todos os itens publicados já têm métricas preenchidas 🎉'
                : kpis.total === 0
                  ? 'Nenhum item publicado neste período ainda'
                  : 'Nenhum resultado para os filtros selecionados'}
            </Typography>
          </Paper>
        ) : (
          <Box component="table" sx={{
            width: '100%', borderCollapse: 'collapse',
            '& th': {
              fontSize: '0.58rem', fontWeight: 700, color: 'rgba(255,255,255,0.28)',
              textTransform: 'uppercase', letterSpacing: '0.09em',
              pb: 1.2, pt: 0.5, textAlign: 'left', whiteSpace: 'nowrap', px: 1,
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              position: 'sticky', top: 0, bgcolor: '#080808', zIndex: 1,
            },
            '& td': {
              borderBottom: '1px solid rgba(255,255,255,0.035)',
              px: 1, py: 0.7, verticalAlign: 'middle',
            },
            '& tbody tr': { transition: 'background 0.15s ease' },
            '& tbody tr:hover td': { bgcolor: 'rgba(0,196,122,0.025)' },
          }}>
            <Box component="thead">
              <Box component="tr">
                <Box component="th">Cliente</Box>
                <Box component="th">Tipo</Box>
                <Box component="th">Data</Box>
                {FIELDS.map(f => (
                  <Box component="th" key={f} sx={{ textAlign: 'right !important', color: `${FIELD_COLOR[f]} !important` }}>
                    {FIELD_LABEL[f]}
                  </Box>
                ))}
                <Box component="th" sx={{ textAlign: 'center !important', color: '#00C47A !important' }}>ER%</Box>
              </Box>
            </Box>

            <Box component="tbody">
              {sortedRows.map((item, rowIdx) => {
                const eng = states[item.i]?.engagement ?? {}
                const er  = calcER(eng)

                return (
                  <Box component="tr" key={item.i}>
                    {/* Cliente */}
                    <Box component="td">
                      <Typography noWrap sx={{ fontSize: '0.76rem', fontWeight: 600, maxWidth: { xs: 110, xl: 200 } }}>
                        {item.c}
                      </Typography>
                    </Box>

                    {/* Tipo */}
                    <Box component="td">
                      <Chip label={item.tp} size="small"
                        sx={{ fontSize: '0.57rem', height: 17, bgcolor: 'rgba(255,255,255,0.05)', color: 'text.secondary' }} />
                    </Box>

                    {/* Data */}
                    <Box component="td">
                      <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                        {item.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </Typography>
                    </Box>

                    {/* Cells de métricas — editáveis */}
                    {FIELDS.map((field, colIdx) => (
                      <Box component="td" key={field} sx={{ textAlign: 'right' }}>
                        <input
                          key={`${item.i}-${field}-${(eng as Eng)[field as EngKey] ?? 'nil'}`}
                          ref={el => {
                            const k = `${item.i}-${field}`
                            if (el) cellRefs.current.set(k, el)
                            else cellRefs.current.delete(k)
                          }}
                          type="number"
                          min={0}
                          defaultValue={(eng as Eng)[field as EngKey] ?? ''}
                          placeholder="—"
                          onKeyDown={e => handleKeyDown(e, rowIdx, colIdx)}
                          onBlur={e => handleBlur(item.i, field, e.target.value)}
                          style={{
                            width: 76,
                            textAlign: 'right',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: `1px solid rgba(255,255,255,0.07)`,
                            color: (eng as Eng)[field as EngKey] != null ? FIELD_COLOR[field] : 'rgba(255,255,255,0.2)',
                            fontSize: '0.76rem',
                            fontFamily: 'inherit',
                            padding: '3px 4px',
                            outline: 'none',
                            MozAppearance: 'textfield',
                          } as React.CSSProperties}
                          onFocus={e => {
                            ;(e.target as HTMLInputElement).style.borderBottomColor = FIELD_COLOR[field]
                            ;(e.target as HTMLInputElement).style.backgroundColor = `${FIELD_COLOR[field]}08`
                          }}
                          onBlurCapture={e => {
                            ;(e.target as HTMLInputElement).style.borderBottomColor = 'rgba(255,255,255,0.07)'
                            ;(e.target as HTMLInputElement).style.backgroundColor = 'transparent'
                          }}
                        />
                      </Box>
                    ))}

                    {/* ER% */}
                    <Box component="td" sx={{ textAlign: 'center' }}>
                      <Tooltip title={er !== null ? `Engajamento: (curtidas + comentários) / alcance` : 'Preencha o alcance para calcular'}>
                        <Typography sx={{
                          fontSize: '0.76rem', fontWeight: er !== null ? 900 : 400,
                          color: erColor(er),
                          textShadow: er !== null && er >= 2 ? `0 0 8px ${erColor(er)}40` : 'none',
                          cursor: 'default',
                        }}>
                          {er !== null ? `${er.toFixed(1)}%` : '—'}
                        </Typography>
                      </Tooltip>
                    </Box>
                  </Box>
                )
              })}
            </Box>
          </Box>
        )}
      </Box>

      {/* ── Rodapé ────────────────────────────────────────── */}
      <Box sx={{
        px: { xs: 1.5, xl: 3 }, py: 1.2,
        borderTop: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1.5,
      }}>
        <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.25)' }}>
          {sortedRows.length} {showEmpty ? 'sem métricas' : 'publicados'} ·{' '}
          Tab/Enter para navegar · ↑↓ para trocar linha
        </Typography>
        <Box flex={1} />
        <Button
          size="small"
          variant="contained"
          onClick={() => {
            setReportClient(selClient === '__all__' ? undefined : selClient)
            setReportOpen(true)
          }}
          sx={{
            fontSize: '0.7rem', height: 32, textTransform: 'none', fontWeight: 700,
            background: 'linear-gradient(90deg, #ff9039, #ff5339)',
            '&:hover': { background: 'linear-gradient(90deg, #e8822e, #e84d33)' },
          }}
        >
          📄 Gerar relatório
        </Button>
      </Box>

      {/* ── MonthlyReportModal ────────────────────────────── */}
      {reportOpen && (
        <Suspense fallback={null}>
          <MonthlyReportModal
            open={reportOpen}
            onClose={() => setReportOpen(false)}
            items={items}
            states={states}
            allClients={allClients}
            clientPhones={clientPhones}
            now={now}
            initialClient={reportClient}
          />
        </Suspense>
      )}
    </Box>
  )
}
