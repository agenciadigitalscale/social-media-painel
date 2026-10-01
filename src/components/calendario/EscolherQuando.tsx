/**
 * Dia e horário — no MESMO padrão do seletor do Painel de Tráfego
 * (`../painel-facebook`): botão com a data que abre um calendário do mês
 * (‹ mês ano ›, Dom–Sáb, dia escolhido em laranja, pontinho no "hoje").
 * O horário é digitado livre ("14:37") — com atalhos para os mais usados.
 *
 * Sem campo nativo do navegador: ele seguia o idioma do navegador
 * ("09/30/2026", AM/PM) e pintava de azul.
 */
import { useState } from 'react'
import { Box, Button, Dialog, TextField, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import { DS } from '../../theme'
import { clickable } from '../../shared/a11y'
import { normalizarHora } from '../../lib/programacao'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const SEMANA_CURTA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const HORARIOS = ['08:00', '10:00', '12:00', '15:00', '18:00', '20:00']
const pad = (n: number) => String(n).padStart(2, '0')

export const dataInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const deInput = (v: string) => { const [a, m, d] = v.split('-').map(Number); return a && m && d ? new Date(a, m - 1, d, 12) : null }

/** "qua, 07/10/2026" */
function formatar(v: string): string {
  const d = deInput(v)
  return d ? `${SEMANA[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : 'Escolher dia'
}

/** "01/10/2026" — o resumo do topo da janela, como no Painel de Tráfego */
function formatarCompleto(v: string): string {
  const d = deInput(v)
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : 'Escolha um dia'
}

const CAMPO = {
  '& .MuiInputBase-root': { height: 44, bgcolor: DS.surface, borderRadius: '10px', fontSize: '0.9rem', fontWeight: 700 },
  '& fieldset': { borderColor: DS.border },
}

export default function EscolherQuando({ data, hora, onData, onHora, direcao = 'futuro' }: {
  /** "aaaa-mm-dd" */
  data: string
  /** "HH:MM" */
  hora: string
  onData: (v: string) => void
  onHora: (v: string) => void
  /** futuro = agendar (dias passados bloqueados); passado = registrar o que já saiu. */
  direcao?: 'futuro' | 'passado'
}) {
  const [ancora, setAncora] = useState<HTMLElement | null>(null)
  const [mes, setMes] = useState(() => { const d = deInput(data) ?? new Date(); return new Date(d.getFullYear(), d.getMonth(), 1, 12) })
  const [texto, setTexto] = useState(hora)
  const [horaRuim, setHoraRuim] = useState(false)
  // Hora mudou por fora (atalho, reabrir): o campo acompanha.
  const [ultima, setUltima] = useState(hora)
  if (hora !== ultima) { setUltima(hora); setTexto(hora); setHoraRuim(false) }

  const hoje = dataInput(new Date())
  const abrir = (el: HTMLElement) => {
    const d = deInput(data) ?? new Date()
    setMes(new Date(d.getFullYear(), d.getMonth(), 1, 12))
    setAncora(el)
  }
  const escolher = (v: string) => { onData(v); setAncora(null) }
  const bloqueado = (v: string) => (direcao === 'futuro' ? v < hoje : v > hoje)

  const inicio = new Date(mes.getFullYear(), mes.getMonth(), 1 - mes.getDay(), 12)
  const dias = Array.from({ length: 42 }, (_, i) => { const d = new Date(inicio); d.setDate(inicio.getDate() + i); return d })
  const anoAtual = new Date().getFullYear()
  const anos = [anoAtual - 1, anoAtual, anoAtual + 1, anoAtual + 2]
  const atalhos = direcao === 'futuro'
    ? [{ rotulo: 'Hoje', d: 0 }, { rotulo: 'Amanhã', d: 1 }, { rotulo: 'Daqui a 7 dias', d: 7 }]
    : [{ rotulo: 'Hoje', d: 0 }, { rotulo: 'Ontem', d: -1 }, { rotulo: 'Há 7 dias', d: -7 }]

  const confirmarHora = () => {
    const h = normalizarHora(texto)
    if (h) { setTexto(h); setHoraRuim(false); onHora(h) } else setHoraRuim(!!texto)
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1.2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Botão do dia — como o "Período" do Painel de Tráfego */}
        <Box component="button" type="button" onClick={e => abrir(e.currentTarget)} aria-haspopup="dialog" aria-expanded={!!ancora}
          sx={{
            minWidth: 230, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2,
            px: 1.5, borderRadius: '10px', cursor: 'pointer', textAlign: 'left', font: 'inherit',
            border: `1px solid ${ancora ? 'rgba(255,122,0,0.78)' : DS.border}`, bgcolor: DS.surface, color: DS.t1,
            boxShadow: ancora ? '0 0 0 3px rgba(255,122,0,0.08)' : 'none',
            transition: 'border-color 0.18s ease', '&:hover': { borderColor: 'rgba(255,122,0,0.52)' },
          }}>
          <Box>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: DS.t2, lineHeight: 1.2 }}>Dia</Typography>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: DS.t1, lineHeight: 1.3 }}>{formatar(data)}</Typography>
          </Box>
          <Box sx={{ width: 27, height: 27, borderRadius: '8px', bgcolor: 'rgba(255,122,0,0.1)', display: 'grid', placeItems: 'center' }}>
            <CalendarMonthIcon sx={{ fontSize: 17, color: DS.accent }} />
          </Box>
        </Box>

        {/* Horário livre */}
        <TextField size="small" label="Horário" value={texto} placeholder="ex.: 14:37"
          onChange={e => setTexto(e.target.value.replace(/[^\d:]/g, '').slice(0, 5))}
          onBlur={confirmarHora}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmarHora() } }}
          error={horaRuim} helperText={horaRuim ? 'Use o formato 14:37' : undefined}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { inputMode: 'numeric', 'aria-label': 'Horário' } }}
          sx={{ width: 130, ...CAMPO }} />
      </Box>

      <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap', mt: 1 }}>
        {HORARIOS.map(h => (
          <Box key={h} {...clickable(() => onHora(h))} aria-pressed={hora === h} sx={{
            px: 1.1, height: 28, display: 'flex', alignItems: 'center', borderRadius: '8px', cursor: 'pointer',
            fontSize: '0.72rem', fontWeight: 700,
            border: `1px solid ${hora === h ? DS.accent : DS.border}`,
            bgcolor: hora === h ? DS.accent : DS.surface, color: hora === h ? DS.onAccent : DS.t2,
            transition: 'all 0.18s ease', '&:hover': { borderColor: hora === h ? DS.accent : 'rgba(255,122,0,0.52)' },
          }}>{h}</Box>
        ))}
      </Box>

      {/* Igual ao "Período do relatório" do Painel de Tráfego: janela no centro,
          resumo do dia escolhido em cima e o calendário grande embaixo. */}
      <Dialog open={!!ancora} onClose={() => setAncora(null)} fullWidth maxWidth={false}
        slotProps={{ paper: { sx: {
          width: { xs: '94vw', sm: 480, xl: 560 }, m: 1.5, p: { xs: 2, sm: 2.4 },
          bgcolor: '#101318', backgroundImage: 'none', backdropFilter: 'none',
          border: '1px solid rgba(255,122,0,0.26)', borderRadius: '18px', boxShadow: '0 26px 80px rgba(0,0,0,0.55)',
        } } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 2 }}>
          <Box>
            <Typography sx={{ fontSize: { xs: '0.62rem', xl: '0.7rem' }, fontWeight: 900, letterSpacing: '0.14em', color: DS.accent }}>
              {direcao === 'futuro' ? 'DIA DA PUBLICAÇÃO' : 'DIA EM QUE FOI PUBLICADO'}
            </Typography>
            <Typography sx={{ fontSize: { xs: '1.15rem', xl: '1.3rem' }, fontWeight: 800, color: DS.t1, mt: 0.3 }}>Escolha o dia</Typography>
          </Box>
          <Box component="button" type="button" aria-label="Fechar" onClick={() => setAncora(null)} sx={{
            width: 38, height: 38, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', cursor: 'pointer',
            bgcolor: '#171b21', color: '#fff', border: `1px solid ${DS.border}`, font: 'inherit',
            '&:hover': { borderColor: 'rgba(255,122,0,0.58)' },
          }}><CloseIcon sx={{ fontSize: 20 }} /></Box>
        </Box>

        <Box sx={{ px: 1.6, py: 1.3, mb: 2, borderRadius: '12px', bgcolor: '#0b0e12', border: `1px solid ${DS.border}` }}>
          <Typography sx={{ fontSize: '0.66rem', color: DS.t2, mb: 0.4 }}>Dia</Typography>
          <Typography sx={{ fontSize: { xs: '0.95rem', xl: '1.05rem' }, fontWeight: 800, color: DS.t1 }}>{formatarCompleto(data)}</Typography>
        </Box>

        <Box sx={{ position: 'relative', p: 1.5, pt: 5, border: '1px solid rgba(255,122,0,0.22)', borderRadius: '14px', bgcolor: '#0c0f13' }}>
          <Typography sx={{ position: 'absolute', top: 12, left: 14, fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.12em', color: DS.accent }}>DIA</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '40px 1fr 40px', gap: 1, alignItems: 'center', mb: 1.5 }}>
            <BotaoMes rotulo="Mês anterior" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1, 12))}>‹</BotaoMes>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 110px', gap: 1 }}>
              <Select valor={mes.getMonth()} rotulo="Mês" opcoes={MESES.map((m, i) => [i, m])} onChange={v => setMes(new Date(mes.getFullYear(), v, 1, 12))} />
              <Select valor={mes.getFullYear()} rotulo="Ano" opcoes={anos.map(a => [a, String(a)])} onChange={v => setMes(new Date(v, mes.getMonth(), 1, 12))} />
            </Box>
            <BotaoMes rotulo="Próximo mês" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1, 12))}>›</BotaoMes>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.5 }}>
            {SEMANA_CURTA.map(s => <Typography key={s} sx={{ textAlign: 'center', py: 0.6, fontSize: { xs: '0.66rem', xl: '0.74rem' }, fontWeight: 700, color: '#737b89' }}>{s}</Typography>)}
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {dias.map(d => {
              const v = dataInput(d)
              const fora = d.getMonth() !== mes.getMonth()
              const sel = v === data
              const ehHoje = v === hoje
              const off = bloqueado(v)
              return (
                <Box key={v} component="button" type="button" disabled={off} onClick={() => escolher(v)}
                  aria-label={formatar(v)} aria-pressed={sel}
                  sx={{
                    position: 'relative', aspectRatio: '1', maxHeight: 60, border: 0, borderRadius: '10px', cursor: off ? 'default' : 'pointer',
                    font: 'inherit', fontSize: { xs: '0.86rem', xl: '0.95rem' }, fontWeight: sel ? 900 : 700,
                    background: sel ? 'linear-gradient(135deg, #FF7A00, #FF9B27)' : 'transparent',
                    color: sel ? DS.onAccent : off ? '#3a3f48' : fora ? '#4f5662' : '#dfe4ec',
                    transition: 'background-color 0.18s ease',
                    '&:hover': off || sel ? {} : { bgcolor: 'rgba(255,122,0,0.12)', color: '#fff' },
                    '&::after': ehHoje ? {
                      content: '""', position: 'absolute', width: 5, height: 5, borderRadius: '50%',
                      bgcolor: sel ? DS.onAccent : DS.accent, left: '50%', bottom: 6, transform: 'translateX(-50%)',
                    } : {},
                  }}>
                  {d.getDate()}
                </Box>
              )
            })}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap', mt: 1.6 }}>
          {atalhos.map(a => {
            const d = new Date(); d.setDate(d.getDate() + a.d)
            return (
              <Button key={a.rotulo} size="small" onClick={() => escolher(dataInput(d))}
                sx={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'none', color: '#d7dce4', bgcolor: '#171b21', border: `1px solid ${DS.border}`, borderRadius: '9px', px: 1.4, '&:hover': { borderColor: 'rgba(255,122,0,0.5)', bgcolor: '#171b21', color: '#fff' } }}>
                {a.rotulo}
              </Button>
            )
          })}
        </Box>
      </Dialog>
    </Box>
  )
}

function BotaoMes({ rotulo, onClick, children }: { rotulo: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Box component="button" type="button" aria-label={rotulo} onClick={onClick} sx={{
      width: 40, height: 40, display: 'grid', placeItems: 'center', font: 'inherit', fontSize: '1.4rem', fontWeight: 800, cursor: 'pointer',
      bgcolor: '#171b21', color: '#fff', border: `1px solid ${DS.border}`, borderRadius: '9px',
      '&:hover': { borderColor: 'rgba(255,122,0,0.58)' },
    }}>{children}</Box>
  )
}

function Select({ valor, rotulo, opcoes, onChange }: { valor: number; rotulo: string; opcoes: [number, string][]; onChange: (v: number) => void }) {
  return (
    <Box component="select" aria-label={rotulo} value={valor} onChange={e => onChange(Number((e.target as HTMLSelectElement).value))}
      sx={{
        width: '100%', minWidth: 0, height: 40, px: 1.2, font: 'inherit', fontSize: '0.86rem',
        border: `1px solid ${DS.border}`, borderRadius: '9px', bgcolor: '#171b21', color: '#fff', colorScheme: 'dark',
        '&:focus': { outline: 'none', borderColor: 'rgba(255,122,0,0.75)' },
      }}>
      {opcoes.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
    </Box>
  )
}
