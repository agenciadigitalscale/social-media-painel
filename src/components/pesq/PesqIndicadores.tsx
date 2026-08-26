import { Box } from '@mui/material'
import { useState } from 'react'
import type { ReactNode } from 'react'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest'
import { PESQ } from '../../lib/pesq/brand'
import { useCountUp } from '../../lib/useCountUp'
import { clickable } from '../../shared/a11y'
import { PesqDot, PesqSurface } from './PesqUI'
import PesqCountdown from './PesqCountdown'
import { conexaoWhatsapp, type PesqConfig, type PesqResumo } from '../../lib/pesq/publicacoes'

/* Os cinco indicadores do topo. Cada um responde uma pergunta que alguém faz
   em voz alta na agência — "o que falta subir?", "já publicamos hoje?",
   "quando cutuca de novo?", "quantas vezes já avisamos?", "o WhatsApp está
   de pé?". Número sem pergunta atrás vira enfeite. */

function Cartao({ children, cor, onClick, rotulo }: {
  children: ReactNode; cor: string; onClick?: () => void; rotulo?: string
}) {
  return (
    <PesqSurface
      interactive={!!onClick}
      sx={{
        p: { xs: 1.5, md: 1.8, xl: 2.1 }, minWidth: 0, overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        '&::after': {
          content: '""', position: 'absolute', left: 0, top: 14, bottom: 14, width: '2px',
          borderRadius: '0 2px 2px 0', background: cor, opacity: 0.85,
        },
      }}
    >
      <Box
        {...(onClick ? { ...clickable(onClick), 'aria-label': rotulo } : {})}
        sx={{ minWidth: 0, outline: 'none' }}
      >
        {children}
      </Box>
    </PesqSurface>
  )
}

function Titulo({ children }: { children: ReactNode }) {
  return (
    <Box sx={{
      fontSize: { xs: '0.58rem', xl: '0.64rem' }, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.1em', color: PESQ.t3, mb: 0.7, whiteSpace: 'nowrap',
      overflow: 'hidden', textOverflow: 'ellipsis',
    }}>
      {children}
    </Box>
  )
}

function Numero({ valor, cor, sufixo }: { valor: number; cor: string; sufixo?: string }) {
  // A subida do número vive de `requestAnimationFrame`, que **não roda em aba
  // oculta** — e o `useCountUp` começa do zero. Montado em segundo plano, o
  // indicador ficaria mostrando "0 aguardando" com quatro na fila até a pessoa
  // voltar para a aba. Número errado é pior que número sem graça: com a aba
  // escondida, entra o valor direto.
  const [animar] = useState(() => typeof document === 'undefined' || !document.hidden)
  const n = useCountUp(valor, 620, animar)
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.6 }}>
      <Box sx={{
        fontSize: { xs: '1.7rem', md: '1.9rem', xl: '2.3rem' }, fontWeight: 800,
        letterSpacing: '-0.035em', lineHeight: 1, color: cor, fontVariantNumeric: 'tabular-nums',
      }}>
        {n}
      </Box>
      {sufixo && <Box sx={{ fontSize: '0.68rem', color: PESQ.t3, fontWeight: 600 }}>{sufixo}</Box>}
    </Box>
  )
}

function Nota({ children, cor = PESQ.t3 }: { children: ReactNode; cor?: string }) {
  return <Box sx={{ mt: 0.6, fontSize: { xs: '0.63rem', xl: '0.7rem' }, color: cor, lineHeight: 1.4 }}>{children}</Box>
}

interface Props {
  resumo: PesqResumo
  config: PesqConfig
  agora: number
  onAbrirConfig: () => void
  onVerFila: () => void
}

export default function PesqIndicadores({ resumo, config, agora, onAbrirConfig, onVerFila }: Props) {
  const conexao = conexaoWhatsapp(config)
  const proximo = resumo.proximo
  const restante = proximo ? proximo.em - agora : 0
  const ciclo = proximo ? Math.max(1, proximo.pub.intervaloMin) * 60_000 : 60_000

  return (
    <Box sx={{
      display: 'grid', gap: { xs: 1, md: 1.4 },
      gridTemplateColumns: {
        xs: 'repeat(2, minmax(0, 1fr))',
        md: 'repeat(3, minmax(0, 1fr))',
        lg: 'repeat(5, minmax(0, 1fr))',
      },
    }}>
      <Cartao cor={PESQ.amber} onClick={onVerFila} rotulo="Ver a fila de aguardando publicação">
        <Titulo>Aguardando</Titulo>
        <Numero valor={resumo.aguardando} cor={PESQ.t1} sufixo={resumo.aguardando === 1 ? 'publicação' : 'publicações'} />
        <Nota cor={resumo.vencidos > 0 ? PESQ.amber : PESQ.t3}>
          {resumo.vencidos > 0
            ? `${resumo.vencidos} ${resumo.vencidos === 1 ? 'pede lembrete' : 'pedem lembrete'} agora`
            : 'nenhum lembrete vencido'}
        </Nota>
      </Cartao>

      <Cartao cor={PESQ.greenLum}>
        <Titulo>Publicados hoje</Titulo>
        <Numero valor={resumo.publicadosHoje} cor={PESQ.greenLum} />
        <Nota>{resumo.publicadosHoje === 0 ? 'nada confirmado ainda' : 'confirmados no painel'}</Nota>
      </Cartao>

      <Cartao cor={proximo ? PESQ.teal : PESQ.mute} onClick={proximo ? onVerFila : undefined}
        rotulo={proximo ? 'Ver o próximo lembrete na fila' : undefined}>
        <Titulo>Próximo lembrete</Titulo>
        {proximo ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, minWidth: 0 }}>
            <PesqCountdown restanteMs={restante} totalMs={ciclo} tamanho={54} />
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{
                fontSize: '0.72rem', fontWeight: 700, color: PESQ.t1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {proximo.pub.titulo}
              </Box>
              <Box sx={{ fontSize: '0.6rem', color: PESQ.t3, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                {proximo.pub.codigo}
              </Box>
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, minHeight: 54 }}>
            <PesqDot cor={PESQ.mute} />
            <Box sx={{ fontSize: '0.74rem', color: PESQ.t2, fontWeight: 600 }}>fila vazia</Box>
          </Box>
        )}
      </Cartao>

      <Cartao cor={PESQ.emerald}>
        <Titulo>Lembretes enviados</Titulo>
        <Numero valor={resumo.lembretesEnviados} cor={PESQ.t1} sufixo="no total" />
        <Nota cor={resumo.falhas > 0 ? PESQ.danger : PESQ.t3}>
          {resumo.falhas > 0
            ? `${resumo.falhas} ${resumo.falhas === 1 ? 'falha' : 'falhas'} para reenviar`
            : 'nenhuma falha registrada'}
        </Nota>
      </Cartao>

      <Cartao
        cor={conexao === 'assistido' ? PESQ.greenComp : PESQ.amber}
        onClick={onAbrirConfig}
        rotulo="Configurar o envio pelo WhatsApp"
      >
        <Titulo>WhatsApp</Titulo>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.9 }}>
          <WhatsAppIcon sx={{ fontSize: 26, color: conexao === 'assistido' ? PESQ.greenComp : PESQ.amber }} />
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ fontSize: '0.86rem', fontWeight: 800, color: PESQ.t1, lineHeight: 1.2 }}>
              {conexao === 'assistido' ? 'Envio assistido' : 'Sem destino'}
            </Box>
            <Box sx={{
              fontSize: '0.62rem', color: PESQ.t3, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {conexao === 'assistido' ? config.nomeDestino || 'destino configurado' : 'toque para configurar'}
            </Box>
          </Box>
        </Box>
        <Nota>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
            <SettingsSuggestIcon sx={{ fontSize: 13 }} />
            {conexao === 'assistido' ? 'mensagem pronta, envio com um toque' : 'nenhum número ou grupo salvo'}
          </Box>
        </Nota>
      </Cartao>
    </Box>
  )
}
