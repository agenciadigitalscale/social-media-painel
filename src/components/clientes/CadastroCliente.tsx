/**
 * Cadastro de clientes (2026-10-01): novo cliente, editar e remover da carteira.
 *
 * Dois níveis, e nunca misturados:
 * - PERMANENTE — nome de exibição, nicho, cidade, tipo, entrada/saída e o Padrão
 *   Editorial (plano + dias). Guardado na carteira (`sm_carteira`) e no padrão.
 * - MENSAL — as preferências e a meta de UM mês, no Calendário. Mudar o cadastro
 *   não reescreve meses já criados.
 *
 * Remover não apaga: marca o mês em que o cliente sai da carteira. Os meses
 * anteriores (e os conteúdos deles) ficam como estavam.
 */
import { useEffect, useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from '@mui/material'
import { DS } from '../../theme'
import { clickable } from '../../shared/a11y'
import { PLANOS, type PlanoEditorial } from '../../lib/padraoEditorial'
import { chaveMes, historicoDoCliente, rotuloMes, type CarteiraStore, type ClienteNaCarteira, type TipoCliente } from '../../lib/planejamentoMes'

/** Inicial do cliente num quadrado neutro — sem cor por cliente. */
export function InicialCliente({ nome, tamanho = 40 }: { nome: string; tamanho?: number }) {
  const letra = (nome.trim().match(/[\p{L}\p{N}]/u)?.[0] ?? '?').toUpperCase()
  return (
    <Box sx={{
      width: tamanho, height: tamanho, flexShrink: 0, borderRadius: `${Math.round(tamanho / 4)}px`,
      display: 'grid', placeItems: 'center', bgcolor: DS.surfaceAlt, border: `1px solid ${DS.border}`,
    }}>
      <Typography sx={{ fontSize: tamanho * 0.42, fontWeight: 800, color: DS.t1, lineHeight: 1 }}>{letra}</Typography>
    </Box>
  )
}

/** Meses para entrada/saída: de maio/2026 (primeiro mês do painel) até 12 meses à frente. */
export function mesesDaCarteira(hoje: Date): string[] {
  const out: string[] = []
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 12, 1)
  for (let d = new Date(2026, 4, 1); d <= fim; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) out.push(chaveMes(d.getFullYear(), d.getMonth()))
  return out
}

const NICHOS = [{ v: 'gastronomico', r: 'Gastronômico' }, { v: 'variados', r: 'Variados' }] as const

function Opcoes<T extends string>({ valor, opcoes, onChange }: { valor: T; opcoes: { v: T; r: string }[]; onChange: (v: T) => void }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
      {opcoes.map(o => (
        <Box key={o.v} {...clickable(() => onChange(o.v))} aria-pressed={valor === o.v} sx={{
          px: 1.4, height: 32, display: 'flex', alignItems: 'center', borderRadius: '8px', cursor: 'pointer',
          fontSize: '0.76rem', fontWeight: 800, transition: 'all 0.15s ease',
          bgcolor: valor === o.v ? DS.accent : 'transparent', color: valor === o.v ? DS.onAccent : DS.t2,
          border: `1px solid ${valor === o.v ? DS.accent : DS.border}`, '&:hover': { borderColor: DS.accent },
        }}>{o.r}</Box>
      ))}
    </Box>
  )
}

const Rotulo = ({ children }: { children: string }) => (
  <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.1em', color: DS.t3, mb: 0.8 }}>{children}</Typography>
)

export interface NovoCliente {
  nome: string
  nicho: 'gastronomico' | 'variados'
  segmento: string
  cidade: string
  tipo: TipoCliente
  entrada: string
  plano: PlanoEditorial
  reels: number
  posts: number
  social: boolean
}

export function NovoClienteDialog({ open, mesAtual, nomesExistentes, onClose, onCriar }: {
  open: boolean
  /** Mês mostrado na tela — vem pré-escolhido como mês de entrada. */
  mesAtual: string
  nomesExistentes: string[]
  onClose: () => void
  onCriar: (c: NovoCliente) => void
}) {
  const [nome, setNome] = useState('')
  const [nicho, setNicho] = useState<'gastronomico' | 'variados'>('gastronomico')
  const [segmento, setSegmento] = useState('')
  const [cidade, setCidade] = useState('')
  const [tipo, setTipo] = useState<TipoCliente>('mensal')
  const [entrada, setEntrada] = useState(mesAtual)
  const [plano, setPlano] = useState<PlanoEditorial>('4+4')
  const [reels, setReels] = useState('4')
  const [posts, setPosts] = useState('4')
  const [social, setSocial] = useState(true)
  useEffect(() => {
    if (!open) return
    setNome(''); setNicho('gastronomico'); setSegmento(''); setCidade(''); setTipo('mensal')
    setEntrada(mesAtual); setPlano('4+4'); setReels('4'); setPosts('4'); setSocial(true)
  }, [open, mesAtual])
  const escolherPlano = (p: PlanoEditorial) => {
    setPlano(p)
    if (p !== 'livre') { setReels(String(PLANOS[p].meta)); setPosts(String(PLANOS[p].meta)) }
  }
  const repetido = nomesExistentes.some(n => n.trim().toLowerCase() === nome.trim().toLowerCase())
  const meses = mesesDaCarteira(new Date())

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography sx={{ fontSize: '1rem', fontWeight: 800 }}>Novo cliente</Typography>
        <Typography sx={{ fontSize: '0.72rem', color: DS.t2, mt: 0.3 }}>
          Entra na carteira a partir do mês escolhido e já aparece no Calendário desse mês — não precisa adicionar de novo no planejamento.
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
        <TextField size="small" label="Nome do cliente" value={nome} onChange={e => setNome(e.target.value)} autoFocus
          error={repetido} helperText={repetido ? 'Já existe um cliente com esse nome.' : undefined} slotProps={{ inputLabel: { shrink: true } }} />
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <TextField select size="small" label="Nicho" value={nicho} onChange={e => setNicho(e.target.value as 'gastronomico' | 'variados')}
            sx={{ minWidth: 160 }} slotProps={{ inputLabel: { shrink: true } }}>
            {NICHOS.map(n => <MenuItem key={n.v} value={n.v} sx={{ fontSize: '0.8rem' }}>{n.r}</MenuItem>)}
          </TextField>
          <TextField size="small" label="Segmento" placeholder="Restaurante, pet shop…" value={segmento} onChange={e => setSegmento(e.target.value)}
            sx={{ flex: 1, minWidth: 160 }} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField size="small" label="Cidade" value={cidade} onChange={e => setCidade(e.target.value)}
            sx={{ flex: 1, minWidth: 140 }} slotProps={{ inputLabel: { shrink: true } }} />
        </Box>

        <Box>
          <Rotulo>TIPO DE CLIENTE</Rotulo>
          <Opcoes valor={tipo} onChange={setTipo} opcoes={[{ v: 'mensal', r: 'Mensal' }, { v: 'freelancer', r: 'Freelancer' }]} />
          <Typography sx={{ fontSize: '0.66rem', color: DS.t3, mt: 0.6 }}>
            {tipo === 'mensal' ? 'Planejamento recorrente: padrão editorial, meta e distribuição no Calendário.' : 'Demanda pontual: sem padrão, meta ou distribuição automática.'}
          </Typography>
        </Box>

        <TextField select size="small" label="A partir de qual mês esse cliente entra?" value={entrada} onChange={e => setEntrada(e.target.value)}
          sx={{ maxWidth: 300 }} slotProps={{ inputLabel: { shrink: true } }}>
          {meses.map(m => <MenuItem key={m} value={m} sx={{ fontSize: '0.8rem' }}>{rotuloMes(m)}</MenuItem>)}
        </TextField>

        {tipo === 'mensal' && (
          <Box>
            <Rotulo>PADRÃO DE CONTEÚDO</Rotulo>
            <Opcoes valor={plano} onChange={escolherPlano} opcoes={[
              { v: '4+4', r: '4+4' }, { v: '6+6', r: '6+6' }, { v: '8+8', r: '8+8' }, { v: 'livre', r: 'Personalizado' },
            ]} />
            <Box sx={{ display: 'flex', gap: 1, mt: 1.2 }}>
              <TextField size="small" type="number" label="Reels / mês" value={reels} onChange={e => { setReels(e.target.value); setPlano('livre') }}
                sx={{ width: 130 }} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: 0 } }} />
              <TextField size="small" type="number" label="Design / mês" value={posts} onChange={e => { setPosts(e.target.value); setPlano('livre') }}
                sx={{ width: 130 }} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: 0 } }} />
            </Box>
            <Typography sx={{ fontSize: '0.66rem', color: DS.t3, mt: 0.6 }}>
              Depois de criar, você escolhe os dias da semana de cada tipo{plano === '6+6' ? ' (semana forte e semana fraca)' : ''}.
            </Typography>
          </Box>
        )}

        <Box>
          <Rotulo>SOCIAL MEDIA</Rotulo>
          <Opcoes valor={social ? 'sim' : 'nao'} onChange={v => setSocial(v === 'sim')} opcoes={[{ v: 'sim', r: 'Com Social Media' }, { v: 'nao', r: 'Sem Social Media' }]} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: DS.t2 }}>Cancelar</Button>
        <Button variant="contained" disabled={!nome.trim() || repetido} onClick={() => onCriar({
          nome: nome.trim(), nicho, segmento: segmento.trim(), cidade: cidade.trim(), tipo, entrada, plano, social,
          reels: Math.max(0, Math.round(Number(reels)) || 0), posts: Math.max(0, Math.round(Number(posts)) || 0),
        })}>
          {tipo === 'mensal' ? 'Criar e escolher os dias' : 'Criar cliente'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function EditarClienteDialog({ open, cliente, nichoOriginal, segmentoOriginal, carteira, onClose, onSalvar, onAbrirPadrao }: {
  open: boolean
  /** Nome original — a chave dos conteúdos, que não muda. */
  cliente: string
  nichoOriginal?: 'gastronomico' | 'variados'
  segmentoOriginal?: string
  carteira: CarteiraStore
  onClose: () => void
  onSalvar: (c: ClienteNaCarteira) => void
  onAbrirPadrao: () => void
}) {
  const atual = carteira[cliente] ?? { tipo: 'mensal' as const }
  const [nome, setNome] = useState('')
  const [nicho, setNicho] = useState<'gastronomico' | 'variados'>('gastronomico')
  const [segmento, setSegmento] = useState('')
  const [cidade, setCidade] = useState('')
  const [tipo, setTipo] = useState<TipoCliente>('mensal')
  const [entrada, setEntrada] = useState('')
  const [saida, setSaida] = useState('')
  useEffect(() => {
    if (!open) return
    setNome(atual.nome ?? cliente); setNicho(atual.nicho ?? nichoOriginal ?? 'gastronomico')
    setSegmento(atual.segmento ?? segmentoOriginal ?? ''); setCidade(atual.cidade ?? '')
    setTipo(atual.tipo); setEntrada(atual.entrada ?? ''); setSaida(atual.saida ?? '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cliente])
  const meses = mesesDaCarteira(new Date())
  const novo: ClienteNaCarteira = {
    tipo,
    ...(entrada ? { entrada } : {}), ...(saida ? { saida } : {}),
    ...(nome.trim() && nome.trim() !== cliente ? { nome: nome.trim() } : {}),
    nicho, ...(segmento.trim() ? { segmento: segmento.trim() } : {}), ...(cidade.trim() ? { cidade: cidade.trim() } : {}),
  }
  const historico = historicoDoCliente({ ...carteira, [cliente]: novo }, cliente, new Date(new Date().getFullYear(), new Date().getMonth() + 3, 1), 12)

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography sx={{ fontSize: '1rem', fontWeight: 800 }}>Editar cliente</Typography>
        <Typography sx={{ fontSize: '0.72rem', color: DS.t2, mt: 0.3 }}>
          Cadastro permanente. Meses já criados no Calendário guardam as próprias preferências — mudar aqui não reescreve o histórico.
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
        <TextField size="small" label="Nome" value={nome} onChange={e => setNome(e.target.value)} slotProps={{ inputLabel: { shrink: true } }}
          helperText={nome.trim() !== cliente ? `Nome de exibição. Os conteúdos continuam ligados a "${cliente}".` : undefined} />
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <TextField select size="small" label="Nicho" value={nicho} onChange={e => setNicho(e.target.value as 'gastronomico' | 'variados')}
            sx={{ minWidth: 160 }} slotProps={{ inputLabel: { shrink: true } }}>
            {NICHOS.map(n => <MenuItem key={n.v} value={n.v} sx={{ fontSize: '0.8rem' }}>{n.r}</MenuItem>)}
          </TextField>
          <TextField size="small" label="Segmento" value={segmento} onChange={e => setSegmento(e.target.value)} sx={{ flex: 1, minWidth: 150 }} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField size="small" label="Cidade" value={cidade} onChange={e => setCidade(e.target.value)} sx={{ flex: 1, minWidth: 130 }} slotProps={{ inputLabel: { shrink: true } }} />
        </Box>
        <Box>
          <Rotulo>TIPO DE CLIENTE</Rotulo>
          <Opcoes valor={tipo} onChange={setTipo} opcoes={[{ v: 'mensal', r: 'Mensal' }, { v: 'freelancer', r: 'Freelancer' }]} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <TextField select size="small" label="Entrou em" value={entrada} onChange={e => setEntrada(e.target.value)} sx={{ minWidth: 160 }}
            slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
            <MenuItem value="" sx={{ fontSize: '0.8rem' }}>Desde sempre</MenuItem>
            {meses.map(m => <MenuItem key={m} value={m} sx={{ fontSize: '0.8rem' }}>{rotuloMes(m)}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Removido a partir de" value={saida} onChange={e => setSaida(e.target.value)} sx={{ minWidth: 190 }}
            slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
            <MenuItem value="" sx={{ fontSize: '0.8rem' }}>Continua na carteira</MenuItem>
            {meses.map(m => <MenuItem key={m} value={m} sx={{ fontSize: '0.8rem' }}>{rotuloMes(m)}</MenuItem>)}
          </TextField>
        </Box>
        {tipo === 'mensal' && (
          <Button variant="outlined" onClick={onAbrirPadrao} sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700 }}>
            Padrão editorial e preferências →
          </Button>
        )}
        <Box>
          <Rotulo>HISTÓRICO NA CARTEIRA</Rotulo>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {historico.slice().reverse().map(h => (
              <Box key={h.ym} sx={{
                px: 0.9, py: 0.4, borderRadius: '7px', fontSize: '0.68rem', fontWeight: 700,
                border: `1px solid ${h.ativo ? `${DS.green}55` : DS.border}`,
                color: h.ativo ? DS.green : DS.t4, bgcolor: h.ativo ? `${DS.green}12` : 'transparent',
              }}>{h.rotulo}</Box>
            ))}
          </Box>
          <Typography sx={{ fontSize: '0.64rem', color: DS.t3, mt: 0.6 }}>Verde = estava na carteira. Os conteúdos de cada mês continuam onde estão.</Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: DS.t2 }}>Cancelar</Button>
        <Button variant="contained" onClick={() => onSalvar(novo)}>Salvar</Button>
      </DialogActions>
    </Dialog>
  )
}

export function RemoverClienteDialog({ open, cliente, nomeExibido, mesAtual, onClose, onConfirmar }: {
  open: boolean
  cliente: string
  nomeExibido: string
  mesAtual: string
  onClose: () => void
  onConfirmar: (ym: string) => void
}) {
  const [mes, setMes] = useState(mesAtual)
  useEffect(() => { if (open) setMes(mesAtual) }, [open, mesAtual])
  const meses = mesesDaCarteira(new Date())
  const [a, m] = mes.split('-').map(Number)
  const dAnterior = new Date(a, m - 2, 1)
  const anterior = chaveMes(dAnterior.getFullYear(), dAnterior.getMonth())
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, fontSize: '1rem' }}>Remover {nomeExibido} da carteira</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.6 }}>
        <TextField select size="small" label="A partir de qual mês esse cliente deve ser removido?" value={mes} onChange={e => setMes(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }} sx={{ mt: 1 }}>
          {meses.map(x => <MenuItem key={x} value={x} sx={{ fontSize: '0.8rem' }}>{rotuloMes(x)}</MenuItem>)}
        </TextField>
        <Typography sx={{ fontSize: '0.8rem', color: DS.t2, lineHeight: 1.6 }}>
          Até <b style={{ color: DS.t1 }}>{rotuloMes(anterior)}</b> continua aparecendo. De <b style={{ color: DS.t1 }}>{rotuloMes(mes)}</b> em diante
          some da carteira, do Calendário e do planejamento. Nada é apagado: o histórico e os conteúdos ficam, e dá para trazer de volta em "Editar cliente".
        </Typography>
        {cliente !== nomeExibido && <Typography sx={{ fontSize: '0.7rem', color: DS.t3 }}>Cadastro: {cliente}</Typography>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: DS.t2 }}>Cancelar</Button>
        <Button variant="contained" color="error" onClick={() => onConfirmar(mes)}>Remover a partir de {rotuloMes(mes)}</Button>
      </DialogActions>
    </Dialog>
  )
}
