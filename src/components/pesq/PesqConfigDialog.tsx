import { useEffect, useState } from 'react'
import { Box, Dialog, IconButton, MenuItem } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import { BRAND } from '../../theme'
import { PESQ } from '../../lib/pesq/brand'
import { NAME_MAP, getDisplayName } from '../../lib/users'
import { PesqBotao } from './PesqUI'
import { PesqCampo } from './PesqCampos'
import { PESQ_CONFIG_PADRAO, type PesqConfig } from '../../lib/pesq/publicacoes'

/* Onde o lembrete cai. Um número ou um link de grupo — é a única coisa que o
   módulo precisa saber para trabalhar, e por isso ela também é a única que ele
   cobra quando falta. */

interface Props {
  aberto: boolean
  config: PesqConfig
  onFechar: () => void
  onSalvar: (c: PesqConfig) => void
}

export default function PesqConfigDialog({ aberto, config, onFechar, onSalvar }: Props) {
  const [destino, setDestino]         = useState(config.destino)
  const [nome, setNome]               = useState(config.nomeDestino)
  const [intervalo, setIntervalo]     = useState(String(config.intervaloMin))
  const [responsavel, setResponsavel] = useState(config.responsavelPadrao)

  useEffect(() => {
    if (!aberto) return
    setDestino(config.destino)
    setNome(config.nomeDestino)
    setIntervalo(String(config.intervaloMin))
    setResponsavel(config.responsavelPadrao)
  }, [aberto, config])

  const salvar = () => {
    const min = Number(intervalo)
    onSalvar({
      destino: destino.trim(),
      nomeDestino: nome.trim() || PESQ_CONFIG_PADRAO.nomeDestino,
      intervaloMin: Number.isFinite(min) && min >= 1 ? min : PESQ_CONFIG_PADRAO.intervaloMin,
      responsavelPadrao: responsavel,
    })
    onFechar()
  }

  return (
    <Dialog
      open={aberto}
      onClose={onFechar}
      fullWidth
      maxWidth="xs"
      slotProps={{ paper: { sx: {
        background: `linear-gradient(168deg, ${PESQ.surfaceAlt} 0%, ${PESQ.bg} 60%)`,
        backgroundImage: 'none',
        border: `1px solid ${PESQ.border}`,
        borderRadius: `${PESQ.r.sheet}px`,
        backdropFilter: 'blur(32px)',
        m: { xs: 1.5, md: 4 },
      } } }}
    >
      <Box sx={{ p: { xs: 2, md: 2.6 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 2 }}>
          <Box sx={{
            width: 38, height: 38, borderRadius: '12px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `linear-gradient(135deg, ${BRAND.whatsapp}, ${BRAND.whatsappDark})`,
          }}>
            <WhatsAppIcon sx={{ color: '#fff', fontSize: 21 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ fontSize: '1rem', fontWeight: 800, color: PESQ.t1, letterSpacing: '-0.02em' }}>
              Configurar envio
            </Box>
            <Box sx={{ fontSize: '0.68rem', color: PESQ.t3 }}>Para onde vão os lembretes</Box>
          </Box>
          <IconButton onClick={onFechar} aria-label="Fechar"
            sx={{ color: PESQ.t2, '&:hover': { color: PESQ.t1, background: 'rgba(234,247,241,0.07)' } }}>
            <CloseIcon sx={{ fontSize: 19 }} />
          </IconButton>
        </Box>

        <Box sx={{
          fontSize: '0.72rem', color: PESQ.t2, lineHeight: 1.6, mb: 2,
          p: 1.2, borderRadius: `${PESQ.r.field}px`,
          background: 'rgba(234,247,241,0.04)', border: `1px solid ${PESQ.borderSoft}`,
        }}>
          O envio é <strong style={{ color: PESQ.t1 }}>assistido</strong>: no horário certo o painel
          prepara a mensagem e abre a conversa — quem toca em enviar é você. Não existe disparo
          automático aqui, e dizer que existe faria alguém confiar num lembrete que nunca saiu.
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.8 }}>
          <PesqCampo
            label="Número ou link do grupo"
            value={destino}
            onChange={e => setDestino(e.target.value)}
            placeholder="11 91234-5678 ou https://chat.whatsapp.com/..."
            helperText="Em grupo, o texto vai para a área de transferência e você cola."
          />
          <PesqCampo
            label="Como chamar esse destino"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Arthur"
          />
          <PesqCampo
            label="Intervalo padrão dos lembretes"
            type="number"
            value={intervalo}
            onChange={e => setIntervalo(e.target.value)}
            inputProps={{ min: 1, max: 720 }}
            helperText="minutos — vale para as publicações novas"
          />
          <PesqCampo
            select
            label="Responsável padrão"
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
                {getDisplayName(k)}
              </MenuItem>
            ))}
          </PesqCampo>

          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <PesqBotao tom="ghost" onClick={onFechar}>Cancelar</PesqBotao>
            <PesqBotao tom="cta" onClick={salvar}>Salvar</PesqBotao>
          </Box>
        </Box>
      </Box>
    </Dialog>
  )
}
