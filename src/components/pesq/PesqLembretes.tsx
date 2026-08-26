import { Box } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import { PESQ } from '../../lib/pesq/brand'
import { clickable } from '../../shared/a11y'
import { PesqBotao, PesqLabel, PesqPill, PesqSurface } from './PesqUI'
import PesqCountdown from './PesqCountdown'
import { FORMATO_ICONE } from './PesqThumb'
import {
  contagem, lembretesEnviados, proximoLembreteEm, quando,
  type PesqConexao, type PesqPublicacao,
} from '../../lib/pesq/publicacoes'

/* O painel de lembretes é a fila do dia: quem está pedindo aviso AGORA e quem
   vem em seguida. Existe separado dos cards porque a pergunta é outra — o card
   responde "o que é este conteúdo", a fila responde "o que eu faço no próximo
   minuto".

   Ele é honesto sobre o envio: o painel prepara a mensagem no horário certo,
   quem manda é uma pessoa. Prometer disparo automático aqui seria o pior tipo
   de erro — alguém confiaria e a publicação não iria ao ar. */

interface Props {
  fila: PesqPublicacao[]
  agora: number
  conexao: PesqConexao
  onEnviar: (id: string) => void
  onAbrir: (id: string) => void
  onConfigurar: () => void
}

export default function PesqLembretes({ fila, agora, conexao, onEnviar, onAbrir, onConfigurar }: Props) {
  const vencidos = fila.filter(p => (proximoLembreteEm(p, agora) ?? Infinity) <= agora)
  const proximos = fila.filter(p => (proximoLembreteEm(p, agora) ?? Infinity) > agora).slice(0, 4)

  return (
    <PesqSurface raised crown sx={{ p: { xs: 1.6, md: 2 }, overflow: 'hidden' }}>
      <Box aria-hidden sx={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at 100% 0%, ${PESQ.emerald}1c 0%, transparent 55%)`,
      }} />

      <Box sx={{ position: 'relative' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.4, flexWrap: 'wrap' }}>
          <NotificationsActiveIcon sx={{ fontSize: 17, color: PESQ.greenLum }} />
          <PesqLabel sx={{ color: PESQ.t2 }}>Painel de lembretes</PesqLabel>
          {vencidos.length > 0 && (
            <PesqPill cor={PESQ.amber} forte>
              {vencidos.length} {vencidos.length === 1 ? 'vencido' : 'vencidos'}
            </PesqPill>
          )}
          <Box sx={{ flex: 1 }} />
          <PesqPill cor={conexao === 'assistido' ? PESQ.greenComp : PESQ.amber} forte={conexao !== 'assistido'}>
            {conexao === 'assistido' ? 'envio assistido' : 'sem destino'}
          </PesqPill>
        </Box>

        {fila.length === 0 ? (
          <Box sx={{ py: 2.4, textAlign: 'center', fontSize: '0.78rem', color: PESQ.t2 }}>
            Nenhuma publicação na fila. Tudo que estava pendente já foi ao ar. 💚
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.9 }}>
            {[...vencidos, ...proximos].map((pub, i) => {
              const em = proximoLembreteEm(pub, agora) ?? agora
              const restante = em - agora
              const vencido = restante <= 0
              const enviados = lembretesEnviados(pub)

              return (
                <Box
                  key={pub.id}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: { xs: 1, md: 1.4 },
                    p: { xs: 1, md: 1.2 }, borderRadius: `${PESQ.r.field}px`,
                    background: vencido ? `${PESQ.amber}12` : 'rgba(234,247,241,0.03)',
                    border: `1px solid ${vencido ? `${PESQ.amber}3a` : PESQ.borderSoft}`,
                    transition: `all ${PESQ.base} ${PESQ.soft}`,
                    animation: `pesqRise 0.4s ${PESQ.ease} ${i * 50}ms both`,
                    '@media (hover: hover)': { '&:hover': { borderColor: PESQ.borderLive } },
                  }}
                >
                  <PesqCountdown
                    restanteMs={restante}
                    totalMs={Math.max(1, pub.intervaloMin) * 60_000}
                    tamanho={46}
                  />

                  <Box
                    {...clickable(() => onAbrir(pub.id))}
                    aria-label={`Abrir ${pub.titulo}`}
                    sx={{ flex: 1, minWidth: 0, cursor: 'pointer', borderRadius: '6px' }}
                  >
                    <Box sx={{
                      fontSize: { xs: '0.78rem', md: '0.82rem' }, fontWeight: 700, color: PESQ.t1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      <Box component="span" aria-hidden sx={{ mr: 0.6 }}>{FORMATO_ICONE[pub.formato]}</Box>
                      {pub.titulo}
                    </Box>
                    <Box sx={{ fontSize: '0.63rem', color: PESQ.t3, mt: 0.2 }}>
                      {pub.codigo} · {quando(pub.agendadoPara, agora)} ·{' '}
                      {enviados === 0 ? 'primeiro aviso' : `${enviados}º enviado`}
                      {!vencido && ` · próximo em ${contagem(restante)}`}
                    </Box>
                  </Box>

                  <PesqBotao
                    tamanho="sm"
                    tom={vencido ? 'cta' : 'ghost'}
                    startIcon={<SendIcon />}
                    onClick={() => (conexao === 'assistido' ? onEnviar(pub.id) : onConfigurar())}
                    title={conexao === 'assistido'
                      ? 'Abre o WhatsApp com a mensagem pronta'
                      : 'Configure o destino do WhatsApp primeiro'}
                    sx={{ flexShrink: 0 }}
                  >
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                      {vencido ? 'Enviar agora' : 'Adiantar'}
                    </Box>
                  </PesqBotao>
                </Box>
              )
            })}
          </Box>
        )}
      </Box>
    </PesqSurface>
  )
}
