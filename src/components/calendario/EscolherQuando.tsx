/**
 * Escolher dia e horário SEM os campos do navegador — eles seguem o idioma do
 * navegador (apareciam "09/30/2026", AM/PM) e o tema dele. Aqui é tudo em
 * português: atalhos de dia, horários comuns e hora/minuto em listas.
 */
import { useState } from 'react'
import { Box, MenuItem, TextField, Typography } from '@mui/material'
import { DS } from '../../theme'
import { clickable } from '../../shared/a11y'

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const HORARIOS = ['08:00', '10:00', '12:00', '15:00', '18:00', '20:00']
const pad = (n: number) => String(n).padStart(2, '0')

export const dataInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function rotuloDoDia(d: Date, deslocamento: number): string {
  const dm = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`
  if (deslocamento === 0) return `Hoje ${dm}`
  if (deslocamento === 1) return `Amanhã ${dm}`
  if (deslocamento === -1) return `Ontem ${dm}`
  return `${SEMANA[d.getDay()]} ${dm}`
}

/** Dias a mostrar: para a frente (agendar) ou para trás (registrar o que já saiu). */
function dias(direcao: 'futuro' | 'passado', quantos: number, escolhido: string) {
  const base = new Date(); base.setHours(12, 0, 0, 0)
  const passo = direcao === 'futuro' ? 1 : -1
  const lista = Array.from({ length: quantos }, (_, i) => {
    const d = new Date(base); d.setDate(base.getDate() + i * passo)
    return { valor: dataInput(d), rotulo: rotuloDoDia(d, i * passo) }
  })
  if (escolhido && !lista.some(d => d.valor === escolhido)) {
    const [a, m, dd] = escolhido.split('-').map(Number)
    if (a && m && dd) {
      const d = new Date(a, m - 1, dd, 12)
      const desl = Math.round((d.getTime() - base.getTime()) / 86_400_000)
      lista.push({ valor: escolhido, rotulo: rotuloDoDia(d, desl) })
    }
  }
  return lista
}

function Atalho({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Box {...clickable(onClick)} aria-pressed={ativo} sx={{
      px: 1.2, height: 32, display: 'flex', alignItems: 'center', borderRadius: '8px', cursor: 'pointer',
      fontSize: '0.74rem', fontWeight: 700, whiteSpace: 'nowrap',
      border: `1px solid ${ativo ? DS.accent : DS.border}`,
      bgcolor: ativo ? DS.accent : DS.surfaceAlt, color: ativo ? DS.onAccent : DS.t1,
      transition: 'all 0.18s ease', '&:hover': { borderColor: ativo ? DS.accent : DS.borderHov },
    }}>
      {children}
    </Box>
  )
}

const SELECT = { width: 88, '& .MuiInputBase-root': { fontSize: '0.8rem', height: 32, bgcolor: DS.field, borderRadius: '8px' } }

export default function EscolherQuando({ data, hora, onData, onHora, direcao = 'futuro' }: {
  /** "aaaa-mm-dd" */
  data: string
  /** "HH:MM" */
  hora: string
  onData: (v: string) => void
  onHora: (v: string) => void
  direcao?: 'futuro' | 'passado'
}) {
  const [maisDias, setMaisDias] = useState(false)
  const lista = dias(direcao, maisDias ? 31 : 8, data)
  const [h, m] = /^\d{2}:\d{2}$/.test(hora) ? hora.split(':') : ['18', '00']
  const minutos = Array.from({ length: 12 }, (_, i) => pad(i * 5))
  if (!minutos.includes(m)) minutos.push(m)

  return (
    <Box>
      <Typography sx={{ fontSize: '0.7rem', color: DS.t2, mb: 0.6 }}>Dia</Typography>
      <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap', alignItems: 'center' }}>
        {lista.map(d => <Atalho key={d.valor} ativo={data === d.valor} onClick={() => onData(d.valor)}>{d.rotulo}</Atalho>)}
        <Box {...clickable(() => setMaisDias(v => !v))} sx={{ px: 1, fontSize: '0.72rem', fontWeight: 700, color: DS.accent, cursor: 'pointer' }}>
          {maisDias ? 'Menos dias' : 'Mais dias…'}
        </Box>
      </Box>

      <Typography sx={{ fontSize: '0.7rem', color: DS.t2, mt: 1.2, mb: 0.6 }}>Horário</Typography>
      <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap', alignItems: 'center' }}>
        {HORARIOS.map(x => <Atalho key={x} ativo={hora === x} onClick={() => onHora(x)}>{x}</Atalho>)}
        <Typography sx={{ fontSize: '0.72rem', color: DS.t3, mx: 0.4 }}>ou</Typography>
        <TextField select size="small" value={h} onChange={e => onHora(`${e.target.value}:${m}`)} aria-label="Hora" sx={SELECT}>
          {Array.from({ length: 24 }, (_, i) => pad(i)).map(x => <MenuItem key={x} value={x} sx={{ fontSize: '0.8rem' }}>{x}h</MenuItem>)}
        </TextField>
        <TextField select size="small" value={m} onChange={e => onHora(`${h}:${e.target.value}`)} aria-label="Minuto" sx={SELECT}>
          {minutos.sort().map(x => <MenuItem key={x} value={x} sx={{ fontSize: '0.8rem' }}>{x}</MenuItem>)}
        </TextField>
      </Box>
    </Box>
  )
}
