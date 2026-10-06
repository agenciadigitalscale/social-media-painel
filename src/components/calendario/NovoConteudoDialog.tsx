/**
 * Novo conteúdo pelo Calendário — janela própria (não um formulário espremido
 * dentro da lista do dia). Cria o MESMO card da Produção: cliente, nome, tipo,
 * data de postagem (vem do dia clicado), horário, data de entrega, responsável e
 * etapa inicial — conteúdo cadastrado depois pode nascer já em Produção, Revisão…
 *
 * Entrega em branco = a fila inteligente decide (lib/datasEntrega).
 */
import { useEffect, useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from '@mui/material'
import type { ContentType, Status } from '../../types'
import { STATUS_CONFIG } from '../../types'
import { DS } from '../../theme'
import { clickable } from '../../shared/a11y'
import { TIPOS_CRIACAO, corDoConteudo } from '../../lib/padraoEditorial'
import { horaValida } from '../../lib/programacao'
import EscolherQuando, { dataInput } from './EscolherQuando'
import { ETAPAS_CONTEUDO, RESPONSAVEIS, nomeDe } from './equipe'

export interface NovoConteudo {
  cliente: string
  titulo: string
  tipo: ContentType
  data: Date
  hora?: string
  /** Ausente = a fila de entrega decide. */
  entrega?: Date
  responsavel?: string
  status: Status
}

/** Campos no mesmo tamanho do resto do painel (o padrão do MUI ficava maior). */
const CAMPO = { '& .MuiInputBase-root': { fontSize: '0.84rem' } } as const

const deInput = (v: string) => { const [a, m, d] = v.split('-').map(Number); return a && m && d ? new Date(a, m - 1, d, 12) : null }

export default function NovoConteudoDialog({ open, dia, clientes, clientePadrao, tipoPadrao, onClose, onCriar }: {
  open: boolean
  dia: Date | null
  clientes: string[]
  clientePadrao?: string | null
  tipoPadrao?: ContentType
  onClose: () => void
  onCriar: (n: NovoConteudo) => void
}) {
  const [cliente, setCliente] = useState('')
  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState<ContentType>('Reel')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [entrega, setEntrega] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [status, setStatus] = useState<Status>(0)
  useEffect(() => {
    if (!open) return
    setCliente(clientePadrao ?? ''); setTitulo(''); setTipo(tipoPadrao ?? 'Reel')
    setData(dia ? dataInput(dia) : dataInput(new Date())); setHora(''); setEntrega(''); setResponsavel(''); setStatus(0)
  }, [open, dia, clientePadrao, tipoPadrao])

  const postagem = deInput(data)
  const entregaDepois = entrega && postagem && entrega > data
  const pode = !!cliente && !!postagem

  const criar = () => {
    if (!pode || !postagem) return
    const rotulo = TIPOS_CRIACAO.find(t => t.tp === tipo)?.rotulo ?? tipo
    onCriar({
      cliente, tipo, status,
      titulo: titulo.trim() || `${rotulo} — pauta a definir`,
      data: postagem,
      ...(horaValida(hora) ? { hora } : {}),
      ...(deInput(entrega) ? { entrega: deInput(entrega)! } : {}),
      ...(responsavel ? { responsavel } : {}),
    })
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography sx={{ fontSize: '0.62rem', fontWeight: 900, letterSpacing: '0.14em', color: DS.accent }}>NOVO CONTEÚDO</Typography>
        <Typography sx={{ fontSize: { xs: '1.05rem', xl: '1.2rem' }, fontWeight: 800, color: DS.t1 }}>
          {dia ? dia.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) : 'Adicionar conteúdo'}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.2, pt: '14px !important' }}>
        <TextField select size="small" label="Cliente" value={cliente} onChange={e => setCliente(e.target.value)} fullWidth sx={CAMPO}
          slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
          <MenuItem value="" disabled sx={{ fontSize: '0.8rem' }}>Escolha o cliente</MenuItem>
          {clientes.map(c => <MenuItem key={c} value={c} sx={{ fontSize: '0.8rem' }}>{c}</MenuItem>)}
        </TextField>

        <TextField size="small" label="Nome do conteúdo" value={titulo} onChange={e => setTitulo(e.target.value)} fullWidth sx={CAMPO}
          placeholder="Ex.: Bastidores da cozinha — em branco: pauta a definir" slotProps={{ inputLabel: { shrink: true } }} />

        <Box>
          <Rotulo>TIPO</Rotulo>
          <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
            {TIPOS_CRIACAO.map(t => {
              const on = tipo === t.tp
              const cor = corDoConteudo(t.tp)
              return (
                <Box key={t.tp} {...clickable(() => setTipo(t.tp))} aria-pressed={on} sx={{
                  px: 1.8, height: 36, display: 'flex', alignItems: 'center', gap: 0.8, borderRadius: '9px', cursor: 'pointer',
                  fontSize: '0.8rem', fontWeight: 800, transition: 'all 0.15s ease',
                  bgcolor: on ? `${cor}1f` : 'transparent', color: on ? DS.t1 : DS.t2,
                  border: `1px solid ${on ? cor : DS.border}`, '&:hover': { borderColor: cor },
                }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: cor }} />{t.rotulo}
                </Box>
              )
            })}
          </Box>
        </Box>

        <Box>
          <Rotulo>POSTAGEM</Rotulo>
          <EscolherQuando data={data} hora={hora} onData={setData} onHora={setHora} direcao="livre" rotulo="Data de postagem" titulo="DATA DE POSTAGEM" />
        </Box>

        <Box>
          <Rotulo>ENTREGA</Rotulo>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
            <EscolherQuando data={entrega} hora="" onData={setEntrega} onHora={() => {}} semHora direcao="livre" rotulo="Data de entrega" titulo="DATA DE ENTREGA" />
            {entrega
              ? <Button size="small" onClick={() => setEntrega('')} sx={{ fontSize: '0.72rem', color: DS.t2, textTransform: 'none' }}>Deixar a fila decidir</Button>
              : <Typography sx={{ fontSize: '0.72rem', color: DS.t3 }}>Em branco: a fila de entrega decide pela data de postagem.</Typography>}
          </Box>
          {entregaDepois && <Typography sx={{ fontSize: '0.7rem', color: DS.amber, mt: 0.6 }}>A entrega está depois da postagem.</Typography>}
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.6 }}>
          <TextField select size="small" label="Responsável" value={responsavel} onChange={e => setResponsavel(e.target.value)} sx={CAMPO}
            slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
            <MenuItem value="" sx={{ fontSize: '0.8rem' }}>Sem responsável</MenuItem>
            {RESPONSAVEIS.map(u => <MenuItem key={u} value={u} sx={{ fontSize: '0.8rem' }}>{nomeDe(u)}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Status inicial" value={status} onChange={e => setStatus(Number(e.target.value) as Status)} sx={CAMPO}
            slotProps={{ inputLabel: { shrink: true } }}>
            {ETAPAS_CONTEUDO.map(s => (
              <MenuItem key={s} value={s} sx={{ fontSize: '0.8rem', gap: 1 }}>
                <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: STATUS_CONFIG[s].color, display: 'inline-block', mr: 1 }} />
                {STATUS_CONFIG[s].label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: DS.t2 }}>Cancelar</Button>
        <Button variant="contained" disabled={!pode} onClick={criar}>Criar conteúdo</Button>
      </DialogActions>
    </Dialog>
  )
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.1em', color: DS.t3, mb: 0.8 }}>{children}</Typography>
}
