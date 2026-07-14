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
import PageHero from '../shared/ui/PageHero'
import EmptyState from '../shared/ui/EmptyState'
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
  if (er >= 2)     return '#F97316'
  return '#FF4545'
}

function fmtBig(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString('pt-BR')
}

// ── KPI card (faixa-topo colorida) ──────
function KpiCard({ label, value, color = '#ff9039' }: { label: string; value: string | number; color?: string }) {
  return (
    <Paper sx={{
      position: 'relative', overflow: 'hidden',
      px: { xs: 1.5, xl: 2 }, py: 1.3, flex: 1, minWidth: 90, textAlign: 'center',
      border: `1px solid ${color}20`, bgcolor: `${color}08`, borderRadius: 2,
      transition: 'border-color 0.2s ease, transform 0.2s ease',
      '&:hover': { borderColor: `${color}44`, transform: 'translateY(-1px)' },
      '&::before': {
        content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2.5px',
        background: `linear-gradient(90deg, ${color}, ${color}00 82%)`,
      },
    }}>
      <Typography sx={{ fontWeight: 900, fontSize: { xs: '1.2rem', xl: '1.5rem' }, color, lineHeight: 1 }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: { xs: '0.58rem', xl: '0.64rem' }, color: 'text.secondary', mt: 0.5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
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
const FIELD_COLOR: Record<Field, string> = { likes: '#9CA3AF', comments: '#9CA3AF', reach: '#9CA3AF', saves: '#9CA3AF' }

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
      <Box sx={{ px: { xs: 1.5, xl: 3 }, pt: 2, pb: 1.5, flexShrink: 0 }}>

        {/* Título (PageHero) */}
        <PageHero
          compact
          title="Performance"
          subtitle="Métricas reais de produção, aprovação e financeiro da agência."
        />

        {/* Filtros */}
        <Stack direction="row" alignItems="center" gap={1.5} mt={1.5} mb={2} flexWrap="wrap">
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
          <KpiCard label="👁 Alcance" value={kpis.reach > 0 ? fmtBig(kpis.reach) : '—'} color="#F97316" />
          <KpiCard label="❤️ Curtidas" value={kpis.likes > 0 ? fmtBig(kpis.likes) : '—'} color="#F97316" />
          <KpiCard label="📊 ER médio"
            value={kpis.avgER !== null ? `${kpis.avgER.toFixed(1)}%` : '—'}
            color={kpis.avgER !== null ? erColor(kpis.avgER) : '#52525B'} />
          <KpiCard label="Com dados"
            value={`${kpis.fillPct}%`}
            color={kpis.fillPct >= 70 ? '#00C47A' : kpis.fillPct >= 30 ? '#F97316' : '#FF4545'} />
        </Stack>

        {/* Melhor post */}
        {kpis.bestItem && (() => {
          const eng = states[kpis.bestItem.i]?.engagement
          const er  = calcER(eng)
          return (
            <Paper sx={{
              px: 1.5, py: 1, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1.5,
              border: '1px solid rgba(255,215,0,0.18)', bgcolor: 'rgba(255,215,0,0.05)', borderRadius: 1.5,
            }}>
              <Typography sx={{ fontSize: '1rem', flexShrink: 0 }}>🏆</Typography>
              <Box flex={1} minWidth={0}>
                <Typography sx={{ fontSize: '0.7rem', color: '#F97316', fontWeight: 800, mb: 0.2 }}>
                  Melhor post do período
                </Typography>
                <Typography noWrap sx={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  {kpis.bestItem.c} · {kpis.bestItem.n || kpis.bestItem.tp}
                </Typography>
                <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                  {kpis.bestItem.tp} · {kpis.bestItem.dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </Typography>
              </Box>
              <Stack direction="row" gap={1.5} flexShrink={0}>
                {eng?.reach    && <Box sx={{ textAlign: 'center' }}><Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: '#F97316' }}>{fmtBig(eng.reach)}</Typography><Typography sx={{ fontSize: '0.56rem', color: 'text.disabled' }}>alcance</Typography></Box>}
                {eng?.likes    && <Box sx={{ textAlign: 'center' }}><Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: '#F97316' }}>{fmtBig(eng.likes)}</Typography><Typography sx={{ fontSize: '0.56rem', color: 'text.disabled' }}>curtidas</Typography></Box>}
                {er !== null   && <Box sx={{ textAlign: 'center' }}><Typography sx={{ fontSize: '1rem', fontWeight: 900, color: '#F97316' }}>{er.toFixed(1)}%</Typography><Typography sx={{ fontSize: '0.56rem', color: 'text.disabled' }}>ER</Typography></Box>}
              </Stack>
            </Paper>
          )
        })()}
      </Box>

      {/* ── Tabela ────────────────────────────────────────── */}
      <Box sx={{
        flex: 1, overflow: 'auto', px: { xs: 1, xl: 3 },
        '&::-webkit-scrollbar': { width: 4, height: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(0,196,122,0.15)', borderRadius: 2 },
      }}>
        {sortedRows.length === 0 ? (
          <Paper sx={{ border: '1px dashed rgba(255,255,255,0.07)', bgcolor: 'transparent', borderRadius: 2 }}>
            <EmptyState
              icon={<BarChartIcon sx={{ fontSize: 30 }} />}
              color="#00C47A"
              title={showEmpty
                ? 'Métricas completas 🎉'
                : kpis.total === 0
                  ? 'Nenhum item publicado ainda'
                  : 'Nenhum resultado para os filtros'}
              subtitle={showEmpty
                ? 'Todos os itens publicados deste período já têm métricas preenchidas.'
                : kpis.total === 0
                  ? 'Quando os conteúdos deste mês forem publicados, as métricas de engajamento aparecem aqui.'
                  : 'Ajuste o mês, o cliente ou os filtros acima para ver resultados.'}
            />
          </Paper>
        ) : (
          <Box component="table" sx={{
            width: '100%', borderCollapse: 'collapse',
            '& th': {
              fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)',
              textTransform: 'uppercase', letterSpacing: '0.07em',
              pb: 1, textAlign: 'left', whiteSpace: 'nowrap', px: 1,
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              position: 'sticky', top: 0, bgcolor: '#080808', zIndex: 1,
            },
            '& td': {
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              px: 1, py: 0.5, verticalAlign: 'middle',
            },
            '& tbody tr:hover td': { bgcolor: 'rgba(255,255,255,0.018)' },
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
            background: '#F97316',
            '&:hover': { filter: 'brightness(1.08)' },
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
