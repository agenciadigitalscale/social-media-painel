/**
 * Padrão Editorial de um cliente — ou as PREFERÊNCIAS de um mês dele.
 *
 * Os dois usam a mesma forma (plano, dias por tipo, meta). A diferença é onde
 * grava: o padrão é a base de todos os meses; as preferências do mês valem só
 * para aquele mês e, depois de criadas, não mudam quando o padrão muda.
 * No modo padrão entra também a carteira: mensal × freelancer, entrada e saída.
 */
import { useEffect, useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Tooltip, Typography } from '@mui/material'
import type { Client } from '../../types'
import { DS } from '../../theme'
import { clickable } from '../../shared/a11y'
import { COR_TIPO, PLANOS, ROTULO_TIPO, TIPOS_PADRAO, segundoTipo, type PadraoCliente, type PlanoEditorial, type SegundoTipo, type TipoPadrao } from '../../lib/padraoEditorial'
import { chaveMes, type ClienteNaCarteira, type TipoCliente } from '../../lib/planejamentoMes'

const DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const DIA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const PLANOS_OPCOES: { key: PlanoEditorial; rotulo: string; dica: string }[] = [
  { key: '4+4', rotulo: '4+4', dica: '1 dia de Reel e 1 de Design/Feed por semana' },
  { key: '6+6', rotulo: '6+6', dica: 'semana forte: 2 dias de cada · semana fraca: 1 dia de cada — alterna sozinho' },
  { key: '8+8', rotulo: '8+8', dica: '2 dias de Reel e 2 de Design/Feed por semana' },
  { key: 'livre', rotulo: 'Personalizado', dica: 'você escolhe os dias e a meta' },
]

/** Meses para entrada/saída na carteira: 12 para trás e 12 para frente. */
function mesesDaCarteira(hoje: Date): { v: string; rotulo: string }[] {
  return Array.from({ length: 25 }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - 12 + i, 1)
    return { v: chaveMes(d.getFullYear(), d.getMonth()), rotulo: `${MESES_CURTO[d.getMonth()]}/${d.getFullYear()}` }
  })
}

export default function PadraoDialog({ open, modo, cliente, nomeMes, inicial, plano, carteira, metaInicial, metaHerdada, segundoCliente, onClose, onSalvar }: {
  open: boolean
  /** padrao = base do cliente · mes = preferências só daquele mês */
  modo: 'padrao' | 'mes'
  cliente: string
  /** "outubro de 2026" — título no modo mês. */
  nomeMes: string
  inicial: PadraoCliente
  plano: Client | undefined
  /** Só no modo padrão. */
  carteira?: ClienteNaCarteira
  /** Meta que aparece preenchida: no padrão, a permanente; no mês, só a EXCEÇÃO daquele mês. */
  metaInicial?: Partial<Record<TipoPadrao, number>>
  /** No mês: a meta permanente, mostrada como "vazio = …". */
  metaHerdada?: Record<TipoPadrao, number>
  /** Segundo tipo do cliente (Design ou Feed) — decide as linhas do mês. */
  segundoCliente?: SegundoTipo
  onClose: () => void
  onSalvar: (p: PadraoCliente, carteira?: ClienteNaCarteira) => void
}) {
  const [dias, setDias] = useState(inicial.dias)
  const [diasFraca, setDiasFraca] = useState<Record<TipoPadrao, number[]>>({ Reel: [], Post: [], Feed: [] })
  const [planoSel, setPlanoSel] = useState<PlanoEditorial>('livre')
  const [meta, setMeta] = useState<Partial<Record<TipoPadrao, string>>>({})
  const [tipoCliente, setTipoCliente] = useState<TipoCliente>('mensal')
  const [entrada, setEntrada] = useState('')
  const [saida, setSaida] = useState('')
  const [segundo, setSegundo] = useState<SegundoTipo>('Post')
  const [comecaFraca, setComecaFraca] = useState(false)
  useEffect(() => {
    if (!open) return
    setDias(inicial.dias)
    setDiasFraca({ Reel: [], Post: [], Feed: [], ...inicial.diasFraca } as Record<TipoPadrao, number[]>)
    setPlanoSel(inicial.plano ?? 'livre')
    const m = metaInicial ?? inicial.meta
    setMeta(Object.fromEntries(TIPOS_PADRAO.map(t => [t, m?.[t] !== undefined ? String(m[t]) : ''])))
    setSegundo(segundoCliente ?? segundoTipo(inicial))
    setComecaFraca(!!inicial.comecaFraca)
    setTipoCliente(carteira?.tipo ?? 'mensal')
    setEntrada(carteira?.entrada ?? '')
    setSaida(carteira?.saida ?? '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cliente, modo])

  const doPlano: Record<TipoPadrao, number> = metaHerdada ?? {
    Reel: plano?.reelsPerMonth ?? 0,
    Post: segundo === 'Post' ? plano?.postsPerMonth ?? 0 : 0,
    Feed: segundo === 'Feed' ? plano?.postsPerMonth ?? 0 : 0,
  }
  const outro: TipoPadrao = segundo === 'Post' ? 'Feed' : 'Post'
  // Linhas: Reel + o segundo tipo do cliente. O outro só aparece se já tiver dia ou meta (compatibilidade).
  const linhas: TipoPadrao[] = ['Reel', segundo, ...((dias[outro]?.length || (meta[outro] ?? '').trim()) ? [outro] : [])]
  const alternar = (qual: 'forte' | 'fraca', t: TipoPadrao, d: number) => {
    const set = qual === 'forte' ? setDias : setDiasFraca
    set(prev => ({ ...prev, [t]: prev[t].includes(d) ? prev[t].filter(x => x !== d) : [...prev[t], d].sort() }))
  }
  // Escolher o plano já preenche a meta de Reel e Post — dá para mudar depois.
  const escolherPlano = (p: PlanoEditorial) => {
    setPlanoSel(p)
    if (p !== 'livre' && modo === 'padrao') setMeta(m => ({ ...m, Reel: String(PLANOS[p].meta), [segundo]: String(PLANOS[p].meta) }))
  }
  const regra = planoSel !== 'livre' ? PLANOS[planoSel] : null
  const meses = mesesDaCarteira(new Date())
  const freelancer = modo === 'padrao' && tipoCliente === 'freelancer'

  const linhaDias = (qual: 'forte' | 'fraca', t: TipoPadrao) => {
    const atual = (qual === 'forte' ? dias : diasFraca)[t]
    const esperado = regra && (t === 'Reel' || t === segundo) ? (qual === 'forte' ? regra.forte : regra.fraca) : null
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, flexWrap: 'wrap' }}>
        {planoSel === '6+6' && (
          <Typography sx={{ width: 92, fontSize: '0.66rem', fontWeight: 700, color: DS.t3 }}>
            {qual === 'forte' ? 'Semana forte' : 'Semana fraca'}
          </Typography>
        )}
        {DIAS.map((rotulo, d) => {
          const on = atual.includes(d)
          return (
            <Tooltip key={d} title={DIA_SEMANA[d]}>
              <Box {...clickable(() => alternar(qual, t, d))} aria-pressed={on}
                aria-label={`${ROTULO_TIPO[t]} às ${DIA_SEMANA[d]}s${planoSel === '6+6' ? ` (semana ${qual})` : ''}`} sx={{
                  width: { xs: 32, xl: 38 }, height: 32, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: '0.74rem', fontWeight: 800, transition: 'all 0.15s ease',
                  bgcolor: on ? COR_TIPO[t] : 'transparent', color: on ? DS.onAccent : DS.t2,
                  border: `1px solid ${on ? COR_TIPO[t] : DS.border}`, '&:hover': { borderColor: COR_TIPO[t] },
                }}>
                {rotulo}
              </Box>
            </Tooltip>
          )
        })}
        {esperado !== null && atual.length !== esperado && (
          <Typography sx={{ fontSize: '0.64rem', color: DS.amber, ml: 0.5 }}>
            o plano pede {esperado} dia{esperado !== 1 ? 's' : ''}
          </Typography>
        )}
      </Box>
    )
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography sx={{ fontSize: '1rem', fontWeight: 800 }}>
          {modo === 'padrao' ? `Padrão editorial — ${cliente}` : `Preferências de ${nomeMes} — ${cliente}`}
        </Typography>
        <Typography sx={{ fontSize: '0.72rem', color: DS.t2, mt: 0.3, lineHeight: 1.5 }}>
          {modo === 'padrao'
            ? 'A base de todo mês novo: quando o mês é criado, estas preferências são copiadas para ele. Meses já criados não mudam.'
            : `Valem só para ${nomeMes}. O padrão editorial do cliente continua como está — "Restaurar padrão" volta o mês para ele.`}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
        {modo === 'padrao' && (
          <Box sx={{ p: 1.4, borderRadius: '11px', border: `1px solid ${DS.border}`, display: 'flex', flexDirection: 'column', gap: 1.2 }}>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.1em', color: DS.t3 }}>CARTEIRA</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <TextField select size="small" label="Tipo de cliente" value={tipoCliente} onChange={e => setTipoCliente(e.target.value as TipoCliente)}
                sx={{ minWidth: 170 }} slotProps={{ inputLabel: { shrink: true } }}>
                <MenuItem value="mensal" sx={{ fontSize: '0.78rem' }}>Mensal (padrão + meta)</MenuItem>
                <MenuItem value="freelancer" sx={{ fontSize: '0.78rem' }}>Freelancer (demanda avulsa)</MenuItem>
              </TextField>
              <TextField select size="small" label="Entrou em" value={entrada} onChange={e => setEntrada(e.target.value)}
                sx={{ minWidth: 140 }} slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
                <MenuItem value="" sx={{ fontSize: '0.78rem' }}>Desde sempre</MenuItem>
                {meses.map(m => <MenuItem key={m.v} value={m.v} sx={{ fontSize: '0.78rem' }}>{m.rotulo}</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Saiu em" value={saida} onChange={e => setSaida(e.target.value)}
                sx={{ minWidth: 140 }} slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
                <MenuItem value="" sx={{ fontSize: '0.78rem' }}>Continua ativo</MenuItem>
                {meses.map(m => <MenuItem key={m.v} value={m.v} sx={{ fontSize: '0.78rem' }}>{m.rotulo}</MenuItem>)}
              </TextField>
            </Box>
            <Typography sx={{ fontSize: '0.66rem', color: DS.t3, lineHeight: 1.5 }}>
              Fora da carteira o cliente some do calendário naquele mês — os conteúdos antigos dele continuam onde estão.
              {freelancer && ' Freelancer não recebe distribuição nem restauração automática.'}
            </Typography>
          </Box>
        )}

        {!freelancer && (
          <>
            <Box>
              <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.1em', color: DS.t3, mb: 0.8 }}>PLANO</Typography>
              <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
                {PLANOS_OPCOES.map(p => (
                  <Tooltip key={p.key} title={p.dica}>
                    <Box {...clickable(() => escolherPlano(p.key))} aria-pressed={planoSel === p.key} sx={{
                      px: 1.4, height: 32, display: 'flex', alignItems: 'center', borderRadius: '8px', cursor: 'pointer',
                      fontSize: '0.76rem', fontWeight: 800, transition: 'all 0.15s ease',
                      bgcolor: planoSel === p.key ? DS.accent : 'transparent', color: planoSel === p.key ? DS.onAccent : DS.t2,
                      border: `1px solid ${planoSel === p.key ? DS.accent : DS.border}`, '&:hover': { borderColor: DS.accent },
                    }}>{p.rotulo}</Box>
                  </Tooltip>
                ))}
              </Box>
            </Box>

            {modo === 'padrao' && (
              <Box>
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.1em', color: DS.t3, mb: 0.8 }}>TIPO PADRÃO (ALÉM DO REEL)</Typography>
                <Box sx={{ display: 'flex', gap: 0.6 }}>
                  {(['Post', 'Feed'] as SegundoTipo[]).map(t => (
                    <Box key={t} {...clickable(() => setSegundo(t))} aria-pressed={segundo === t} sx={{
                      px: 1.6, height: 32, display: 'flex', alignItems: 'center', gap: 0.8, borderRadius: '8px', cursor: 'pointer',
                      fontSize: '0.76rem', fontWeight: 800, transition: 'all 0.15s ease',
                      bgcolor: segundo === t ? `${COR_TIPO[t]}22` : 'transparent', color: segundo === t ? DS.t1 : DS.t2,
                      border: `1px solid ${segundo === t ? COR_TIPO[t] : DS.border}`, '&:hover': { borderColor: COR_TIPO[t] },
                    }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: COR_TIPO[t] }} />Reel + {ROTULO_TIPO[t]}
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {planoSel === '6+6' && (
              <Box>
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.1em', color: DS.t3, mb: 0.8 }}>O MÊS COMEÇA COM</Typography>
                <Box sx={{ display: 'flex', gap: 0.6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {([[false, 'Semana forte'], [true, 'Semana fraca']] as const).map(([v, r]) => (
                    <Box key={r} {...clickable(() => setComecaFraca(v))} aria-pressed={comecaFraca === v} sx={{
                      px: 1.4, height: 32, display: 'flex', alignItems: 'center', borderRadius: '8px', cursor: 'pointer',
                      fontSize: '0.76rem', fontWeight: 800, transition: 'all 0.15s ease',
                      bgcolor: comecaFraca === v ? DS.accent : 'transparent', color: comecaFraca === v ? DS.onAccent : DS.t2,
                      border: `1px solid ${comecaFraca === v ? DS.accent : DS.border}`,
                    }}>{r}</Box>
                  ))}
                  <Typography sx={{ fontSize: '0.66rem', color: DS.t3 }}>e alterna sozinho: {comecaFraca ? 'fraca, forte, fraca…' : 'forte, fraca, forte…'}</Typography>
                </Box>
              </Box>
            )}

            {linhas.map(t => (
              <Box key={t}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
                  <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: COR_TIPO[t] }} />
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: DS.t1, flex: 1 }}>{ROTULO_TIPO[t]}</Typography>
                  <TextField size="small" type="number" label={modo === 'mes' ? 'Meta deste mês' : 'Meta mensal'} value={meta[t] ?? ''}
                    onChange={e => setMeta(m => ({ ...m, [t]: e.target.value }))}
                    placeholder={modo === 'mes' ? `padrão: ${doPlano[t]}` : String(doPlano[t])} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: 0 } }}
                    helperText={modo === 'mes' ? `vazio = padrão (${doPlano[t]})` : `vazio = plano (${doPlano[t]})`}
                    sx={{ width: 130, '& .MuiInputBase-root': { fontSize: '0.78rem', height: 32, bgcolor: DS.field } }} />
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                  {linhaDias('forte', t)}
                  {planoSel === '6+6' && linhaDias('fraca', t)}
                </Box>
              </Box>
            ))}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: DS.t2 }}>Cancelar</Button>
        <Button variant="contained" onClick={() => onSalvar(
          {
            dias,
            plano: planoSel,
            ...(planoSel === '6+6' ? { diasFraca, ...(comecaFraca ? { comecaFraca: true } : {}) } : {}),
            ...(modo === 'padrao' ? { segundo } : {}),
            meta: Object.fromEntries(TIPOS_PADRAO
              .filter(t => (meta[t] ?? '').trim() !== '' && Number.isFinite(Number(meta[t])))
              .map(t => [t, Math.max(0, Math.round(Number(meta[t])))])) as Partial<Record<TipoPadrao, number>>,
          },
          modo === 'padrao' ? { tipo: tipoCliente, ...(entrada ? { entrada } : {}), ...(saida ? { saida } : {}) } : undefined,
        )}>
          {modo === 'padrao' ? 'Salvar padrão' : `Salvar ${nomeMes}`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
