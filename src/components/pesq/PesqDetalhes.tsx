import { Box, Drawer, IconButton, useMediaQuery, useTheme } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import SendIcon from '@mui/icons-material/Send'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import EditIcon from '@mui/icons-material/Edit'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import ContentCutIcon from '@mui/icons-material/ContentCut'
import type { ReactNode } from 'react'
import { PESQ } from '../../lib/pesq/brand'
import { getDisplayName, getUserInfo } from '../../lib/users'
import { PesqBotao, PesqLabel, PesqPill, PesqSurface } from './PesqUI'
import PesqStatusBadge from './PesqStatusBadge'
import PesqThumb, { FORMATO_ICONE } from './PesqThumb'
import PesqWhatsAppPreview from './PesqWhatsAppPreview'
import PesqCountdown from './PesqCountdown'
import {
  desde, lembretesEnviados, proximoLembreteEm, quando, ultimoLembrete,
  PESQ_STATUS, type PesqConfig, type PesqPublicacao,
} from '../../lib/pesq/publicacoes'

/* Tudo sobre uma publicação, num painel que desliza. Três blocos, nesta ordem:
   o que é, o que o WhatsApp já recebeu, e o que aconteceu até aqui. */

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{
        fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.1em', color: PESQ.t3, mb: 0.3,
      }}>
        {rotulo}
      </Box>
      <Box sx={{ fontSize: '0.8rem', color: PESQ.t1, fontWeight: 600, lineHeight: 1.4, wordBreak: 'break-word' }}>
        {children}
      </Box>
    </Box>
  )
}

interface Props {
  pub: PesqPublicacao | null
  config: PesqConfig
  agora: number
  onFechar: () => void
  onConfirmar: (id: string) => void
  onLembrar: (id: string) => void
  onEditar: (id: string) => void
  onPausar: (id: string) => void
  onRetomar: (id: string) => void
  onCancelar: (id: string) => void
  onReabrir: (id: string) => void
}

export default function PesqDetalhes({
  pub, config, agora, onFechar, onConfirmar, onLembrar, onEditar,
  onPausar, onRetomar, onCancelar, onReabrir,
}: Props) {
  const theme = useTheme()
  const mobile = useMediaQuery(theme.breakpoints.down('md'))

  const cfg      = pub ? PESQ_STATUS[pub.status] : null
  const proximo  = pub ? proximoLembreteEm(pub, agora) : null
  const enviados = pub ? lembretesEnviados(pub) : 0
  const ultimo   = pub ? ultimoLembrete(pub) : undefined
  const membro   = pub ? getUserInfo(pub.responsavel) : null
  const encerrada = pub?.status === 'publicado' || pub?.status === 'cancelado'

  return (
    <Drawer
      anchor={mobile ? 'bottom' : 'right'}
      open={!!pub}
      onClose={onFechar}
      slotProps={{ paper: { sx: {
        width: mobile ? '100%' : { md: 480, lg: 540, xl: 620 },
        maxHeight: mobile ? '92vh' : '100%',
        background: `linear-gradient(168deg, ${PESQ.surfaceAlt} 0%, ${PESQ.bg} 46%)`,
        backdropFilter: 'blur(28px)',
        borderLeft: mobile ? 'none' : `1px solid ${PESQ.border}`,
        borderTopLeftRadius: mobile ? PESQ.r.sheet : 0,
        borderTopRightRadius: mobile ? PESQ.r.sheet : 0,
        backgroundImage: 'none',
      } } }}
    >
      {pub && cfg && (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          {/* Puxador do sheet no celular */}
          {mobile && (
            <Box aria-hidden sx={{
              width: 42, height: 4, borderRadius: 2, bgcolor: 'rgba(234,247,241,0.2)',
              mx: 'auto', mt: 1.2, mb: 0.4, flexShrink: 0,
            }} />
          )}

          {/* Cabeçalho */}
          <Box sx={{
            display: 'flex', gap: 1.4, alignItems: 'flex-start', p: { xs: 1.8, md: 2.2 }, pb: 1.4,
            borderBottom: `1px solid ${PESQ.borderSoft}`, flexShrink: 0,
          }}>
            <PesqThumb pub={pub} largura={64} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <PesqStatusBadge status={pub.status} />
              <Box sx={{
                mt: 0.8, fontSize: { xs: '1rem', md: '1.1rem' }, fontWeight: 800,
                color: PESQ.t1, letterSpacing: '-0.02em', lineHeight: 1.25,
              }}>
                {pub.titulo}
              </Box>
              <Box sx={{
                mt: 0.3, fontSize: '0.66rem', color: PESQ.t3,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}>
                {pub.codigo}
              </Box>
            </Box>
            <IconButton onClick={onFechar} aria-label="Fechar detalhes"
              sx={{ color: PESQ.t2, '&:hover': { color: PESQ.t1, background: 'rgba(234,247,241,0.07)' } }}>
              <CloseIcon sx={{ fontSize: 19 }} />
            </IconButton>
          </Box>

          {/* Corpo */}
          <Box sx={{ flex: 1, overflowY: 'auto', p: { xs: 1.8, md: 2.2 }, display: 'flex', flexDirection: 'column', gap: 2.2 }}>
            {/* Bloco 1 — o que é */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 1.6 }}>
              <Campo rotulo="Formato">
                <Box component="span" aria-hidden sx={{ mr: 0.5 }}>{FORMATO_ICONE[pub.formato]}</Box>
                {pub.formato}
              </Campo>
              <Campo rotulo="Publicar em">{quando(pub.agendadoPara, agora)}</Campo>
              <Campo rotulo="Responsável">
                {membro
                  ? <>
                      <Box component="span" aria-hidden sx={{ mr: 0.5 }}>{membro.emoji}</Box>
                      {getDisplayName(pub.responsavel)}
                      <Box sx={{ fontSize: '0.64rem', color: PESQ.t3, fontWeight: 500 }}>{membro.role}</Box>
                    </>
                  : getDisplayName(pub.responsavel) || '—'}
              </Campo>
              <Campo rotulo="Intervalo dos lembretes">a cada {pub.intervaloMin} min</Campo>
            </Box>

            {pub.finalizarNoEdits && (
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1, p: 1.2,
                borderRadius: `${PESQ.r.field}px`,
                background: `${PESQ.greenLum}12`, border: `1px solid ${PESQ.greenLum}33`,
              }}>
                <ContentCutIcon sx={{ fontSize: 17, color: PESQ.greenLum }} />
                <Box sx={{ fontSize: '0.76rem', color: PESQ.t1, fontWeight: 600 }}>
                  Finalizar no Instagram Edits antes de subir
                </Box>
              </Box>
            )}

            {pub.observacao && (
              <Box>
                <PesqLabel sx={{ mb: 0.6 }}>Observação</PesqLabel>
                <Box sx={{
                  fontSize: '0.78rem', color: PESQ.t2, lineHeight: 1.6, p: 1.2,
                  borderRadius: `${PESQ.r.field}px`, background: 'rgba(234,247,241,0.04)',
                  border: `1px solid ${PESQ.borderSoft}`, whiteSpace: 'pre-wrap',
                }}>
                  {pub.observacao}
                </Box>
              </Box>
            )}

            {/* Ações principais */}
            <Box sx={{ display: 'flex', gap: 0.9, flexWrap: 'wrap' }}>
              <PesqBotao
                tom="ghost"
                startIcon={<OpenInNewIcon />}
                disabled={!pub.driveLink}
                onClick={() => pub.driveLink && window.open(pub.driveLink, '_blank', 'noopener,noreferrer')}
              >
                Abrir conteúdo
              </PesqBotao>
              {!encerrada && (
                <PesqBotao tom="cta" startIcon={<CheckCircleIcon />} onClick={() => onConfirmar(pub.id)}>
                  Confirmar publicação
                </PesqBotao>
              )}
            </Box>

            {/* Bloco 2 — o WhatsApp */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <PesqLabel>Mensagem no WhatsApp</PesqLabel>
                <Box sx={{ flex: 1 }} />
                {cfg.ativo && proximo !== null && (
                  <PesqCountdown restanteMs={proximo - agora} totalMs={Math.max(1, pub.intervaloMin) * 60_000} tamanho={40} />
                )}
              </Box>

              <PesqWhatsAppPreview pub={pub} config={config} agora={agora} mostrarProxima={cfg.ativo} />

              <Box sx={{ mt: 1.2, display: 'flex', gap: 0.9, flexWrap: 'wrap', alignItems: 'center' }}>
                {cfg.ativo && (
                  <PesqBotao tom="outline" startIcon={<SendIcon />} onClick={() => onLembrar(pub.id)}>
                    {enviados === 0 ? 'Enviar aviso agora' : 'Enviar lembrete agora'}
                  </PesqBotao>
                )}
                <PesqPill cor={enviados > 0 ? PESQ.teal : PESQ.t3} forte={enviados > 0}>
                  {enviados} {enviados === 1 ? 'lembrete enviado' : 'lembretes enviados'}
                  {ultimo ? ` · último ${desde(ultimo.ts, agora)}` : ''}
                </PesqPill>
              </Box>
            </Box>

            {/* Bloco 3 — histórico */}
            <Box>
              <PesqLabel sx={{ mb: 1 }}>Histórico</PesqLabel>
              <PesqSurface sx={{ p: 1.4 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  {[...pub.historico].reverse().map((ev, i, arr) => (
                    <Box key={`${ev.ts}_${i}`} sx={{ display: 'flex', gap: 1.2, position: 'relative', pb: i === arr.length - 1 ? 0 : 1.6 }}>
                      {i !== arr.length - 1 && (
                        <Box aria-hidden sx={{
                          position: 'absolute', left: 4.5, top: 12, bottom: 0, width: '1px',
                          background: `linear-gradient(180deg, ${PESQ.greenLum}44, transparent)`,
                        }} />
                      )}
                      <Box aria-hidden sx={{
                        width: 10, height: 10, borderRadius: '50%', mt: 0.5, flexShrink: 0,
                        background: i === 0 ? PESQ.greenLum : PESQ.deep,
                        border: `1.5px solid ${i === 0 ? PESQ.greenLum : PESQ.borderLive}`,
                        boxShadow: i === 0 ? `0 0 8px ${PESQ.greenLum}88` : 'none',
                      }} />
                      <Box sx={{ minWidth: 0 }}>
                        <Box sx={{ fontSize: '0.76rem', color: PESQ.t1, fontWeight: 600, lineHeight: 1.4 }}>{ev.acao}</Box>
                        <Box sx={{ fontSize: '0.63rem', color: PESQ.t3 }}>
                          {getDisplayName(ev.autor) || 'Sistema'} · {quando(ev.ts, agora)} · {desde(ev.ts, agora)}
                        </Box>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </PesqSurface>
            </Box>
          </Box>

          {/* Rodapé — ações administrativas */}
          <Box sx={{
            display: 'flex', gap: 0.9, flexWrap: 'wrap', p: { xs: 1.4, md: 1.8 },
            borderTop: `1px solid ${PESQ.borderSoft}`, background: 'rgba(6,31,29,0.5)', flexShrink: 0,
          }}>
            <PesqBotao tamanho="sm" tom="ghost" startIcon={<EditIcon />} onClick={() => onEditar(pub.id)}>
              Editar
            </PesqBotao>
            {pub.status === 'pausado' ? (
              <PesqBotao tamanho="sm" tom="ghost" startIcon={<PlayArrowIcon />} onClick={() => onRetomar(pub.id)}>
                Retomar lembretes
              </PesqBotao>
            ) : cfg.ativo && (
              <PesqBotao tamanho="sm" tom="ghost" startIcon={<PauseIcon />} onClick={() => onPausar(pub.id)}>
                Pausar lembretes
              </PesqBotao>
            )}
            <Box sx={{ flex: 1 }} />
            {encerrada
              ? <PesqBotao tamanho="sm" tom="ghost" onClick={() => onReabrir(pub.id)}>Reabrir na fila</PesqBotao>
              : <PesqBotao tamanho="sm" tom="danger" onClick={() => onCancelar(pub.id)}>Cancelar</PesqBotao>}
          </Box>
        </Box>
      )}
    </Drawer>
  )
}
