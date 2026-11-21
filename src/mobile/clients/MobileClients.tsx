import { useMemo, useState } from 'react'
import { Box, InputAdornment, TextField, Typography } from '@mui/material'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import type { ContentItem, ItemState, Client } from '../../types'
import { DS } from '../../theme'
import { isRealLate } from '../../lib/todaySignals'
import { nomeDoCliente } from '../../lib/clientes'
import { clickable } from '../../shared/a11y'

interface MobileClientsProps {
  items: ContentItem[]
  states: Record<number, ItemState>
  allClients: Client[]
  clientColors: Record<string, string>
  now: Date
  onOpenProductions: (clientName: string) => void
}

interface Linha { nome: string; exibido: string; noMes: number; publicados: number; atrasados: number; proxima: Date | null }

const iniciais = (n: string) => n.split(/\s+/).filter(p => p.length > 2 || /^[A-Z]/.test(p)).slice(0, 2).map(p => p[0]).join('').toUpperCase() || n.slice(0, 1).toUpperCase()
const diaCurto = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`

/**
 * Clientes no celular (2026-11-21): era um provisório "não disponível nesta compilação"
 * que mostrava só 3 clientes. Lista todos, com o mês de cada um (publicados, atrasados,
 * próxima postagem); tocar abre as Produções filtradas no cliente.
 */
export default function MobileClients({ items, states, allClients, now, onOpenProductions }: MobileClientsProps) {
  const [busca, setBusca] = useState('')

  const linhas = useMemo((): Linha[] => {
    const ano = now.getFullYear(), mes = now.getMonth()
    const hoje = new Date(ano, mes, now.getDate()).getTime()
    const por = new Map<string, Linha>()
    for (const c of allClients) {
      let exibido = c.name
      try { exibido = nomeDoCliente(c.name) || c.name } catch { /* sem carteira carregada */ }
      por.set(c.name, { nome: c.name, exibido, noMes: 0, publicados: 0, atrasados: 0, proxima: null })
    }
    for (const it of items) {
      const l = por.get(it.c)
      if (!l) continue
      const st = states[it.i]?.status ?? it.s
      const dt = new Date(it.dt)
      if (dt.getFullYear() === ano && dt.getMonth() === mes) {
        l.noMes++
        if (st === 7) l.publicados++
      }
      if (isRealLate(it, states[it.i], now)) l.atrasados++
      if (st !== 7 && dt.getTime() >= hoje && (!l.proxima || dt < l.proxima)) l.proxima = dt
    }
    return [...por.values()].sort((a, b) => b.atrasados - a.atrasados || a.exibido.localeCompare(b.exibido))
  }, [items, states, allClients, now])

  const q = busca.trim().toLowerCase()
  const lista = q ? linhas.filter(l => l.exibido.toLowerCase().includes(q) || l.nome.toLowerCase().includes(q)) : linhas
  const comAtraso = linhas.filter(l => l.atrasados > 0).length

  return (
    <Box sx={{ px: 2, pt: 1.5, pb: 4, display: 'flex', flexDirection: 'column', gap: 1.2 }}>
      <Typography sx={{ fontSize: '0.78rem', color: DS.t2 }}>
        {linhas.length} clientes{comAtraso ? ` · ${comAtraso} com atraso` : ' · nenhum com atraso'}
      </Typography>
      <TextField size="small" fullWidth placeholder="Buscar cliente" value={busca} onChange={e => setBusca(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" sx={{ color: DS.t3 }} /></InputAdornment> }} />

      {lista.length === 0 && <Typography sx={{ color: DS.t3, fontSize: '0.85rem', py: 3, textAlign: 'center' }}>Nenhum cliente encontrado.</Typography>}

      {lista.map(l => {
        const pct = l.noMes ? Math.round((l.publicados / l.noMes) * 100) : 0
        return (
          <Box key={l.nome} {...clickable(() => onOpenProductions(l.nome))}
            sx={{ display: 'flex', alignItems: 'center', gap: 1.4, p: 1.4, borderRadius: 2, bgcolor: DS.surface, border: `1px solid ${DS.border}`, cursor: 'pointer', '&:active': { bgcolor: DS.surfaceAlt } }}>
            <Box sx={{ width: 40, height: 40, borderRadius: 1.5, flexShrink: 0, display: 'grid', placeItems: 'center', bgcolor: DS.surfaceAlt, border: `1px solid ${DS.border}`, color: DS.t2, fontWeight: 800, fontSize: '0.82rem' }}>
              {iniciais(l.exibido)}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                <Typography noWrap sx={{ flex: 1, fontWeight: 700, fontSize: '0.92rem', color: DS.t1 }}>{l.exibido}</Typography>
                {l.atrasados > 0 && <Typography sx={{ flexShrink: 0, fontSize: '0.7rem', fontWeight: 800, color: DS.red }}>{l.atrasados} atrasado{l.atrasados > 1 ? 's' : ''}</Typography>}
              </Box>
              <Typography sx={{ fontSize: '0.74rem', color: DS.t2, mt: 0.2 }}>
                {l.noMes ? `${l.publicados}/${l.noMes} publicados no mês` : 'Nada planejado no mês'}
                {l.proxima ? ` · próxima ${diaCurto(l.proxima)}` : ''}
              </Typography>
              {l.noMes > 0 && (
                <Box sx={{ mt: 0.8, height: 4, borderRadius: 2, bgcolor: DS.field, overflow: 'hidden' }}>
                  <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: pct === 100 ? DS.green : DS.accent }} />
                </Box>
              )}
            </Box>
            <ChevronRightRoundedIcon sx={{ color: DS.t3, flexShrink: 0 }} />
          </Box>
        )
      })}
    </Box>
  )
}
