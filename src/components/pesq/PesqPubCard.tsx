import { useState } from 'react'
import { Box, IconButton, Menu, MenuItem, Tooltip } from '@mui/material'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import SendIcon from '@mui/icons-material/Send'
import ContentCutIcon from '@mui/icons-material/ContentCut'
import ScheduleIcon from '@mui/icons-material/Schedule'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import { PESQ } from '../../lib/pesq/brand'
import { clickable, clickableStop } from '../../shared/a11y'
import { getDisplayName, getUserInfo } from '../../lib/users'
import { PesqBotao, PesqPill, PesqSurface } from './PesqUI'
import PesqStatusBadge from './PesqStatusBadge'
import PesqCountdown from './PesqCountdown'
import PesqThumb, { FORMATO_ICONE } from './PesqThumb'
import {
  desde, lembretesEnviados, proximoLembreteEm, quando, ultimoLembrete,
  PESQ_STATUS, type PesqPublicacao,
} from '../../lib/pesq/publicacoes'

/* O card é a unidade de trabalho: tudo que alguém precisa para decidir "subo
   agora ou cutuco de novo" cabe aqui, sem abrir nada. Os detalhes profundos
   (histórico completo, conversa do WhatsApp) ficam no painel lateral. */

interface Props {
  pub: PesqPublicacao
  agora: number
  indice: number
  onAbrir: (id: string) => void
  onConfirmar: (id: string) => void
  onLembrar: (id: string) => void
  onEditar: (id: string) => void
  onPreverMensagem: (id: string) => void
  onPausar: (id: string) => void
  onRetomar: (id: string) => void
  onCancelar: (id: string) => void
  onReabrir: (id: string) => void
  onRemover: (id: string) => void
}

export default function PesqPubCard({
  pub, agora, indice, onAbrir, onConfirmar, onLembrar, onEditar, onPreverMensagem,
  onPausar, onRetomar, onCancelar, onReabrir, onRemover,
}: Props) {
  const [menu, setMenu] = useState<HTMLElement | null>(null)

  const cfg      = PESQ_STATUS[pub.status]
  const proximo  = proximoLembreteEm(pub, agora)
  const restante = proximo === null ? 0 : proximo - agora
  const vencido  = proximo !== null && restante <= 0
  const enviados = lembretesEnviados(pub)
  const ultimo   = ultimoLembrete(pub)
  const membro   = getUserInfo(pub.responsavel)
  const encerrada = pub.status === 'publicado' || pub.status === 'cancelado'

  const fechar = () => setMenu(null)
  const noMenu = (fn: () => void) => () => { fechar(); fn() }

  return (
    <PesqSurface
      interactive
      raised={vencido && cfg.ativo}
      sx={{
        p: { xs: 1.4, md: 1.8 },
        opacity: pub.status === 'cancelado' ? 0.62 : 1,
        animation: `pesqRise ${PESQ.slow} ${PESQ.ease} ${Math.min(indice, 12) * 45}ms both`,
        ...(vencido && cfg.ativo && {
          borderColor: `${PESQ.amber}55`,
          boxShadow: `${PESQ.shadowUp}, inset 0 0 0 1px ${PESQ.amber}12`,
        }),
        ...(pub.status === 'publicado' && { borderColor: `${PESQ.greenLum}30` }),
      }}
    >
      <Box sx={{ display: 'flex', gap: { xs: 1.2, md: 1.8 }, alignItems: 'flex-start' }}>
        {/* A miniatura abre o mesmo painel que o título logo ao lado. Ela fica
            fora da ordem de tabulação de propósito: no teclado seriam dois
            botões seguidos com o mesmo destino, e quem usa leitor de tela
            ouviria tudo duas vezes. O caminho acessível é o título. */}
        <Box
          onClick={() => onAbrir(pub.id)}
          aria-hidden
          sx={{ borderRadius: `${PESQ.r.field}px`, cursor: 'pointer' }}
        >
          <PesqThumb pub={pub} largura={72} />
        </Box>

        {/* Miolo */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.7 }}>
            <Box
              {...clickable(() => onAbrir(pub.id))}
              aria-label={`Abrir detalhes de ${pub.titulo}`}
              sx={{ flex: 1, minWidth: 0, cursor: 'pointer', borderRadius: '6px' }}
            >
              <Box sx={{
                fontSize: { xs: '0.86rem', md: '0.92rem', xl: '1rem' }, fontWeight: 700,
                color: PESQ.t1, lineHeight: 1.3, letterSpacing: '-0.015em',
                textDecoration: pub.status === 'cancelado' ? 'line-through' : 'none',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {pub.titulo}
              </Box>
              <Box sx={{
                mt: 0.4, display: 'flex', alignItems: 'center', gap: 0.9, flexWrap: 'wrap',
                fontSize: { xs: '0.65rem', xl: '0.72rem' }, color: PESQ.t2,
              }}>
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
                  <Box component="span" aria-hidden>{FORMATO_ICONE[pub.formato]}</Box>
                  {pub.formato}
                </Box>
                <Box component="span" aria-hidden sx={{ color: PESQ.t3 }}>·</Box>
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
                  <ScheduleIcon sx={{ fontSize: 13 }} />
                  {quando(pub.agendadoPara, agora)}
                </Box>
                <Box component="span" aria-hidden sx={{ color: PESQ.t3 }}>·</Box>
                <Box component="span" sx={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: '0.64rem', color: PESQ.t3, letterSpacing: '0.02em',
                }}>
                  {pub.codigo}
                </Box>
              </Box>
            </Box>

            <PesqStatusBadge status={pub.status} tamanho="sm" />

            <IconButton
              {...clickableStop(() => {})}
              onClick={e => { e.stopPropagation(); setMenu(e.currentTarget) }}
              size="small"
              aria-label={`Opções de ${pub.titulo}`}
              sx={{
                color: PESQ.t3, mt: -0.4, width: 36, height: 36, flexShrink: 0,
                '&:hover': { color: PESQ.t1, background: 'rgba(234,247,241,0.06)' },
              }}
            >
              <MoreVertIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Box>

          {/* Selos */}
          <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap', mb: 1 }}>
            {pub.finalizarNoEdits && (
              <PesqPill cor={PESQ.greenLum} forte>
                <ContentCutIcon sx={{ fontSize: 12 }} />
                Finalizar no Instagram Edits
              </PesqPill>
            )}
            {membro && (
              <PesqPill>
                <Box component="span" aria-hidden>{membro.emoji}</Box>
                {getDisplayName(pub.responsavel)}
              </PesqPill>
            )}
            <PesqPill cor={enviados > 0 ? PESQ.teal : PESQ.t3} forte={enviados > 0}>
              <NotificationsActiveIcon sx={{ fontSize: 12 }} />
              {enviados === 0 ? 'sem lembrete' : `${enviados} ${enviados === 1 ? 'lembrete' : 'lembretes'}`}
              {ultimo ? ` · ${desde(ultimo.ts, agora)}` : ''}
            </PesqPill>
            {pub.status === 'falha_whatsapp' && pub.lembretes.length > 0 && (
              <PesqPill cor={PESQ.danger} forte>
                {pub.lembretes[pub.lembretes.length - 1].erro ?? 'o último lembrete não saiu'}
              </PesqPill>
            )}
          </Box>

          {/* Ações */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
            <PesqBotao
              tamanho="sm"
              tom="ghost"
              startIcon={<OpenInNewIcon />}
              disabled={!pub.driveLink}
              title={pub.driveLink ? 'Abrir no Google Drive' : 'Sem link do Drive nesta publicação'}
              onClick={e => {
                e.stopPropagation()
                if (pub.driveLink) window.open(pub.driveLink, '_blank', 'noopener,noreferrer')
              }}
            >
              Abrir conteúdo
            </PesqBotao>

            {!encerrada && (
              <PesqBotao
                tamanho="sm"
                tom="cta"
                startIcon={<CheckCircleIcon />}
                onClick={e => { e.stopPropagation(); onConfirmar(pub.id) }}
              >
                Confirmar publicação
              </PesqBotao>
            )}

            {cfg.ativo && (
              <PesqBotao
                tamanho="sm"
                tom={vencido ? 'outline' : 'ghost'}
                startIcon={<SendIcon />}
                onClick={e => { e.stopPropagation(); onLembrar(pub.id) }}
                title="Abre o WhatsApp com a mensagem pronta"
              >
                {enviados === 0 ? 'Avisar no WhatsApp' : 'Lembrar de novo'}
              </PesqBotao>
            )}

            {pub.status === 'publicado' && pub.publicadoEm && (
              <Box sx={{ fontSize: '0.66rem', color: PESQ.greenLum, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <CheckCircleIcon sx={{ fontSize: 14 }} />
                publicado {desde(pub.publicadoEm, agora)}
              </Box>
            )}
          </Box>
        </Box>

        {/* Aro da contagem — só onde a fila anda; no desktop, para não empurrar
            o miolo no celular, onde o mesmo dado já aparece na pílula. */}
        {cfg.ativo && proximo !== null && (
          <Box sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', alignItems: 'center', gap: 0.5, pl: 0.5 }}>
            <Tooltip
              arrow
              title={vencido
                ? 'O lembrete venceu — envie pelo WhatsApp'
                : `Próximo lembrete ${quando(proximo, agora)} (a cada ${pub.intervaloMin} min)`}
            >
              <Box>
                <PesqCountdown
                  restanteMs={restante}
                  totalMs={Math.max(1, pub.intervaloMin) * 60_000}
                  tamanho={62}
                  rotulo="lembrete"
                />
              </Box>
            </Tooltip>
          </Box>
        )}
      </Box>

      <Menu
        anchorEl={menu}
        open={!!menu}
        onClose={fechar}
        slotProps={{ paper: { sx: {
          background: PESQ.surfaceAlt, border: `1px solid ${PESQ.border}`,
          borderRadius: `${PESQ.r.field}px`, backdropFilter: 'blur(24px)',
          '& .MuiMenuItem-root': { fontSize: '0.78rem', color: PESQ.t1, gap: 1 },
          '& .MuiMenuItem-root:hover': { background: 'rgba(82,220,96,0.1)' },
        } } }}
      >
        <MenuItem onClick={noMenu(() => onPreverMensagem(pub.id))}>👁️ Ver mensagem do WhatsApp</MenuItem>
        <MenuItem onClick={noMenu(() => onEditar(pub.id))}>✏️ Editar publicação</MenuItem>
        {pub.status === 'pausado'
          ? <MenuItem onClick={noMenu(() => onRetomar(pub.id))}>▶️ Retomar lembretes</MenuItem>
          : cfg.ativo && <MenuItem onClick={noMenu(() => onPausar(pub.id))}>⏸️ Pausar lembretes</MenuItem>}
        {encerrada
          ? <MenuItem onClick={noMenu(() => onReabrir(pub.id))}>↩️ Reabrir na fila</MenuItem>
          : <MenuItem onClick={noMenu(() => onCancelar(pub.id))}>✖️ Cancelar publicação</MenuItem>}
        <MenuItem onClick={noMenu(() => onRemover(pub.id))} sx={{ color: `${PESQ.danger} !important` }}>
          🗑️ Excluir do painel
        </MenuItem>
      </Menu>
    </PesqSurface>
  )
}
