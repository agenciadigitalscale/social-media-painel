import { useEffect, useState } from 'react'
import { Box, Dialog, IconButton, MenuItem } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { PESQ } from '../../lib/pesq/brand'
import { NAME_MAP, getDisplayName } from '../../lib/users'
import PesqLogo from './PesqLogo'
import { PesqBotao, PesqLabel } from './PesqUI'
import { PesqCampo, PesqSegmentado, PesqSwitch } from './PesqCampos'
import { FORMATO_ICONE } from './PesqThumb'
import {
  deInputLocal, paraInputLocal, PESQ_FORMATOS,
  type NovaPublicacao, type PesqConfig, type PesqFormato, type PesqPublicacao,
} from '../../lib/pesq/publicacoes'

/* Criar e editar são o mesmo formulário: os campos são idênticos e manter duas
   telas faria uma envelhecer sem a outra. O que muda é o título e o verbo do
   botão. */

interface Props {
  aberto: boolean
  /** Publicação em edição — ausente significa "nova" */
  editando: PesqPublicacao | null
  config: PesqConfig
  onFechar: () => void
  onSalvar: (dados: NovaPublicacao) => void
}

const HORA_PADRAO = 18

function proximoHorarioPadrao(): number {
  const d = new Date()
  d.setSeconds(0, 0)
  if (d.getHours() >= HORA_PADRAO) { d.setDate(d.getDate() + 1) }
  d.setHours(HORA_PADRAO, 0, 0, 0)
  return d.getTime()
}

export default function PesqPubDialog({ aberto, editando, config, onFechar, onSalvar }: Props) {
  const [titulo, setTitulo]         = useState('')
  const [formato, setFormato]       = useState<PesqFormato>('Reels')
  const [quando, setQuando]         = useState(() => paraInputLocal(proximoHorarioPadrao()))
  const [driveLink, setDriveLink]   = useState('')
  const [edits, setEdits]           = useState(true)
  const [responsavel, setResponsavel] = useState(config.responsavelPadrao)
  const [intervalo, setIntervalo]   = useState(String(config.intervaloMin))
  const [observacao, setObservacao] = useState('')
  const [erro, setErro]             = useState<string | null>(null)

  // Reabrir o diálogo tem que trazer o estado certo: com dados de quem está
  // sendo editado, ou limpo quando é nova. Sem isto o formulário guardaria o
  // rascunho anterior e alguém salvaria o título de outra publicação.
  useEffect(() => {
    if (!aberto) return
    setErro(null)
    if (editando) {
      setTitulo(editando.titulo)
      setFormato(editando.formato)
      setQuando(paraInputLocal(editando.agendadoPara))
      setDriveLink(editando.driveLink ?? '')
      setEdits(editando.finalizarNoEdits)
      setResponsavel(editando.responsavel)
      setIntervalo(String(editando.intervaloMin))
      setObservacao(editando.observacao ?? '')
    } else {
      setTitulo('')
      setFormato('Reels')
      setQuando(paraInputLocal(proximoHorarioPadrao()))
      setDriveLink('')
      setEdits(true)
      setResponsavel(config.responsavelPadrao)
      setIntervalo(String(config.intervaloMin))
      setObservacao('')
    }
  }, [aberto, editando, config])

  const salvar = () => {
    const t = titulo.trim()
    if (!t) { setErro('Dê um nome ao conteúdo — é por ele que a equipe vai reconhecer a publicação.'); return }
    const ts = deInputLocal(quando)
    if (ts === null) { setErro('Escolha a data e o horário da publicação.'); return }
    const min = Number(intervalo)
    if (!Number.isFinite(min) || min < 1) { setErro('O intervalo dos lembretes precisa ser de pelo menos 1 minuto.'); return }

    onSalvar({
      titulo: t,
      formato,
      agendadoPara: ts,
      driveLink: driveLink.trim() || undefined,
      finalizarNoEdits: edits,
      responsavel,
      intervaloMin: min,
      observacao: observacao.trim() || undefined,
    })
  }

  return (
    <Dialog
      open={aberto}
      onClose={onFechar}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: {
        background: `linear-gradient(168deg, ${PESQ.surfaceAlt} 0%, ${PESQ.bg} 60%)`,
        backgroundImage: 'none',
        border: `1px solid ${PESQ.border}`,
        borderRadius: `${PESQ.r.sheet}px`,
        backdropFilter: 'blur(32px)',
        boxShadow: PESQ.shadowUp,
        m: { xs: 1.5, md: 4 },
      } } }}
    >
      <Box sx={{ position: 'relative', p: { xs: 2, md: 2.6 } }}>
        <Box aria-hidden sx={{
          position: 'absolute', inset: 0, borderRadius: `${PESQ.r.sheet}px`, pointerEvents: 'none',
          background: `radial-gradient(ellipse at 0% 0%, ${PESQ.emerald}22 0%, transparent 55%)`,
        }} />

        <Box sx={{ position: 'relative' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.4, mb: 2.2 }}>
            <PesqLogo size={40} variant="glow" />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ fontSize: '1.05rem', fontWeight: 800, color: PESQ.t1, letterSpacing: '-0.02em' }}>
                {editando ? 'Editar publicação' : 'Nova publicação manual'}
              </Box>
              <Box sx={{ fontSize: '0.7rem', color: PESQ.t3 }}>
                {editando ? editando.codigo : 'O código é gerado no momento de salvar'}
              </Box>
            </Box>
            <IconButton onClick={onFechar} aria-label="Fechar"
              sx={{ color: PESQ.t2, '&:hover': { color: PESQ.t1, background: 'rgba(234,247,241,0.07)' } }}>
              <CloseIcon sx={{ fontSize: 19 }} />
            </IconButton>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <PesqCampo
              label="Nome do conteúdo"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              autoFocus
              placeholder="Ex.: Bastidores da pescaria de sábado"
            />

            <Box>
              <PesqLabel sx={{ mb: 0.8 }}>Formato</PesqLabel>
              <PesqSegmentado
                rotulo="Formato do conteúdo"
                valor={formato}
                onChange={(v: PesqFormato) => {
                  setFormato(v)
                  // Reels quase sempre passa pelo Edits; os outros, quase nunca.
                  // É sugestão, e o interruptor logo abaixo continua mandando.
                  setEdits(v === 'Reels')
                }}
                opcoes={PESQ_FORMATOS.map(f => ({
                  valor: f,
                  label: <><Box component="span" aria-hidden>{FORMATO_ICONE[f]}</Box>{f}</>,
                }))}
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1.4fr 1fr' }, gap: 1.4 }}>
              <PesqCampo
                label="Publicar em"
                type="datetime-local"
                value={quando}
                onChange={e => setQuando(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <PesqCampo
                label="Lembrar a cada"
                type="number"
                value={intervalo}
                onChange={e => setIntervalo(e.target.value)}
                inputProps={{ min: 1, max: 720, 'aria-label': 'Intervalo dos lembretes em minutos' }}
                helperText="minutos"
              />
            </Box>

            <PesqCampo
              label="Link do Google Drive"
              value={driveLink}
              onChange={e => setDriveLink(e.target.value)}
              placeholder="https://drive.google.com/file/d/..."
              helperText="A miniatura sai daqui quando o arquivo está na pasta do cliente."
            />

            <PesqCampo
              select
              label="Responsável pela publicação"
              value={responsavel}
              onChange={e => setResponsavel(e.target.value)}
              SelectProps={{ MenuProps: { slotProps: { paper: { sx: {
                background: PESQ.surfaceAlt, border: `1px solid ${PESQ.border}`,
                '& .MuiMenuItem-root': { fontSize: '0.82rem', color: PESQ.t1 },
              } } } } }}
            >
              {Object.keys(NAME_MAP).map(k => (
                <MenuItem key={k} value={k}>
                  <Box component="span" aria-hidden sx={{ mr: 1 }}>{NAME_MAP[k].emoji}</Box>
                  {getDisplayName(k)} — {NAME_MAP[k].role}
                </MenuItem>
              ))}
            </PesqCampo>

            <PesqSwitch
              ligado={edits}
              onChange={setEdits}
              titulo="Finalizar no Instagram Edits"
              descricao="Marca o card e entra na mensagem do WhatsApp, para não subir a versão crua."
            />

            <PesqCampo
              label="Observação (opcional)"
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              multiline
              minRows={2}
              placeholder="Legenda combinada, marcações, trilha…"
            />

            {erro && (
              <Box role="alert" sx={{
                fontSize: '0.76rem', color: PESQ.danger, background: 'rgba(229,84,75,0.1)',
                border: `1px solid rgba(229,84,75,0.3)`, borderRadius: `${PESQ.r.field}px`, p: 1.1,
              }}>
                {erro}
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 0.4 }}>
              <PesqBotao tom="ghost" onClick={onFechar}>Cancelar</PesqBotao>
              <PesqBotao tom="cta" onClick={salvar}>
                {editando ? 'Salvar alterações' : 'Criar publicação'}
              </PesqBotao>
            </Box>
          </Box>
        </Box>
      </Box>
    </Dialog>
  )
}
