import { Box } from '@mui/material'
import type { ReactNode } from 'react'
import { PESQ } from '../../lib/pesq/brand'
import PesqLogo from './PesqLogo'
import { PesqBotao, PesqSurface } from './PesqUI'

/* Carregando, vazio e erro. Três telas que costumam ser deixadas para depois e
   são justamente as que aparecem no pior momento: no primeiro acesso, na queda
   de rede, no dia em que a fila zerou. */

// ── Esqueleto ─────────────────────────────────────────────────────────
function Barra({ w, h = 12, delay = 0, radius = 8 }: { w: string | number; h?: number; delay?: number; radius?: number }) {
  return (
    <Box aria-hidden sx={{
      width: w, height: h, borderRadius: `${radius}px`, flexShrink: 0,
      background: `linear-gradient(90deg, ${PESQ.surfaceAlt} 25%, rgba(82,220,96,0.13) 50%, ${PESQ.surfaceAlt} 75%)`,
      backgroundSize: '260px 100%',
      animation: `pesqShimmer 1.5s ease-in-out ${delay}ms infinite`,
    }} />
  )
}

/** O esqueleto tem a FORMA do card real — quando o dado chega, nada pula. */
export function PesqSkeleton({ linhas = 4 }: { linhas?: number }) {
  return (
    <Box role="status" aria-label="Carregando publicações" sx={{ display: 'flex', flexDirection: 'column', gap: 1.4 }}>
      {Array.from({ length: linhas }, (_, i) => (
        <PesqSurface key={i} sx={{ p: { xs: 1.4, md: 1.8 } }}>
          <Box sx={{ display: 'flex', gap: 1.8, alignItems: 'flex-start' }}>
            <Barra w={72} h={96} delay={i * 110} radius={12} />
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.9 }}>
              <Barra w="62%" h={14} delay={i * 110 + 60} />
              <Barra w="38%" h={10} delay={i * 110 + 120} />
              <Box sx={{ display: 'flex', gap: 0.8, mt: 0.4 }}>
                <Barra w={128} h={22} delay={i * 110 + 180} radius={999} />
                <Barra w={92} h={22} delay={i * 110 + 220} radius={999} />
              </Box>
              <Box sx={{ display: 'flex', gap: 0.8, mt: 0.4 }}>
                <Barra w={116} h={30} delay={i * 110 + 260} radius={999} />
                <Barra w={150} h={30} delay={i * 110 + 300} radius={999} />
              </Box>
            </Box>
            <Barra w={62} h={62} delay={i * 110 + 150} radius={999} />
          </Box>
        </PesqSurface>
      ))}
    </Box>
  )
}

// ── Vazio ─────────────────────────────────────────────────────────────
export function PesqVazio({ titulo, texto, acao, icone }: {
  titulo: string
  texto: ReactNode
  acao?: { label: string; onClick: () => void }
  icone?: ReactNode
}) {
  return (
    <PesqSurface sx={{
      py: { xs: 5, md: 7 }, px: 3, textAlign: 'center', overflow: 'hidden',
      animation: `pesqPop ${PESQ.slow} ${PESQ.ease} both`,
    }}>
      <Box aria-hidden sx={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at 50% 0%, ${PESQ.emerald}1f 0%, transparent 62%)`,
      }} />
      <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.6 }}>
        {icone ?? <PesqLogo size={64} variant="glow" />}
        <Box>
          <Box sx={{ fontSize: { xs: '1rem', md: '1.15rem' }, fontWeight: 800, color: PESQ.t1, letterSpacing: '-0.02em' }}>
            {titulo}
          </Box>
          <Box sx={{ mt: 0.7, fontSize: '0.8rem', color: PESQ.t2, maxWidth: 460, mx: 'auto', lineHeight: 1.6 }}>
            {texto}
          </Box>
        </Box>
        {acao && <PesqBotao tom="cta" onClick={acao.onClick}>{acao.label}</PesqBotao>}
      </Box>
    </PesqSurface>
  )
}

// ── Erro ──────────────────────────────────────────────────────────────
export function PesqErro({ texto, onTentar }: { texto: string; onTentar?: () => void }) {
  return (
    <PesqSurface sx={{
      p: 2.4, display: 'flex', gap: 1.4, alignItems: 'flex-start',
      borderColor: `${PESQ.dangerDeep}44`, background: `linear-gradient(160deg, rgba(229,84,75,0.08), ${PESQ.surface} 60%)`,
    }}>
      <Box aria-hidden sx={{ fontSize: '1.3rem', lineHeight: 1 }}>⚠️</Box>
      <Box sx={{ flex: 1 }}>
        <Box sx={{ fontSize: '0.86rem', fontWeight: 700, color: PESQ.t1 }}>Não deu para carregar</Box>
        <Box sx={{ mt: 0.4, fontSize: '0.76rem', color: PESQ.danger, lineHeight: 1.5 }}>{texto}</Box>
      </Box>
      {onTentar && <PesqBotao tom="outline" tamanho="sm" onClick={onTentar}>Tentar de novo</PesqBotao>}
    </PesqSurface>
  )
}
