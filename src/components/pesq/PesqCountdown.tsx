import { Box } from '@mui/material'
import { PESQ } from '../../lib/pesq/brand'
import { contagem } from '../../lib/pesq/publicacoes'

/**
 * Contagem regressiva até o próximo lembrete, em aro.
 *
 * O aro esvazia conforme o tempo passa; ao vencer, ele fica cheio na cor de
 * alerta e o texto vira "agora" — nunca um número negativo, que só faria
 * alguém calcular de cabeça o que a tela já sabe.
 *
 * O texto no meio é a informação; o aro é o reforço. Por isso o valor também
 * vai no `aria-label`: leitor de tela não enxerga arco.
 */
export default function PesqCountdown({ restanteMs, totalMs, tamanho = 66, rotulo }: {
  restanteMs: number
  /** Janela cheia do ciclo (o intervalo entre lembretes, em ms) */
  totalMs: number
  tamanho?: number
  rotulo?: string
}) {
  const vencido = restanteMs <= 0
  const fracao  = vencido ? 1 : Math.max(0, Math.min(1, restanteMs / Math.max(1, totalMs)))
  const cor     = vencido ? PESQ.amber : PESQ.greenLum

  const raio = (tamanho - 7) / 2
  const perimetro = 2 * Math.PI * raio
  const texto = contagem(restanteMs)

  return (
    <Box
      role="timer"
      aria-label={`${rotulo ?? 'Próximo lembrete'}: ${vencido ? 'vencido, enviar agora' : `em ${texto}`}`}
      sx={{ position: 'relative', width: tamanho, height: tamanho, flexShrink: 0 }}
    >
      <Box component="svg" viewBox={`0 0 ${tamanho} ${tamanho}`} sx={{
        width: '100%', height: '100%', transform: 'rotate(-90deg)',
      }}>
        <circle
          cx={tamanho / 2} cy={tamanho / 2} r={raio}
          fill="none" stroke="rgba(234,247,241,0.09)" strokeWidth="3.5"
        />
        <circle
          cx={tamanho / 2} cy={tamanho / 2} r={raio}
          fill="none" stroke={cor} strokeWidth="3.5" strokeLinecap="round"
          strokeDasharray={perimetro}
          strokeDashoffset={perimetro * (1 - fracao)}
          style={{
            transition: `stroke-dashoffset 0.9s linear, stroke ${PESQ.slow} ease`,
            filter: `drop-shadow(0 0 5px ${cor}77)`,
          }}
        />
      </Box>

      <Box sx={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 0.1,
      }}>
        <Box sx={{
          fontSize: tamanho > 58 ? '0.82rem' : '0.7rem', fontWeight: 800,
          letterSpacing: '-0.02em', color: vencido ? PESQ.amber : PESQ.t1,
          fontVariantNumeric: 'tabular-nums',
          ...(vencido && { animation: 'pesqPulse 2.4s ease-in-out infinite' }),
        }}>
          {texto}
        </Box>
        {rotulo && tamanho > 58 && (
          <Box sx={{ fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: PESQ.t3 }}>
            {rotulo}
          </Box>
        )}
      </Box>
    </Box>
  )
}
