import { Box } from '@mui/material'
import { PESQ } from '../../lib/pesq/brand'

/**
 * O fundo do ambiente PESQ: água parada vista de cima.
 *
 * Três camadas, todas decorativas e sem captura de ponteiro: o gradiente
 * profundo, dois halos que respiram devagar (movimento) e um traçado de
 * curvas que repete o gesto da cauda da logo (conexão). Nada aqui usa
 * `filter: blur` em elemento grande e animado — em tela cheia isso custa GPU
 * e o painel tem board arrastável ao lado; o desfoque vem do próprio
 * gradiente radial, que é barato.
 */
export default function PesqBackdrop() {
  return (
    <Box aria-hidden sx={{
      position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none',
      background: PESQ.gradientDeep,
    }}>
      <Box sx={{
        position: 'absolute', top: '-22%', right: '-10%', width: '58%', height: '62%',
        background: `radial-gradient(circle at 50% 50%, ${PESQ.emerald}38 0%, ${PESQ.petrol}14 42%, transparent 68%)`,
        animation: 'pesqDrift 26s ease-in-out infinite',
      }} />
      <Box sx={{
        position: 'absolute', bottom: '-30%', left: '-14%', width: '64%', height: '68%',
        background: `radial-gradient(circle at 50% 50%, ${PESQ.greenMid}2e 0%, ${PESQ.deep}18 46%, transparent 70%)`,
        animation: 'pesqDriftAlt 34s ease-in-out infinite',
      }} />

      <Box
        component="svg"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.5 }}
      >
        <defs>
          <linearGradient id="pesqWave" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor={PESQ.greenLum} stopOpacity="0" />
            <stop offset="45%"  stopColor={PESQ.greenLum} stopOpacity="0.34" />
            <stop offset="100%" stopColor={PESQ.petrol}   stopOpacity="0" />
          </linearGradient>
          <linearGradient id="pesqWaveSoft" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor={PESQ.petrol}   stopOpacity="0" />
            <stop offset="55%"  stopColor={PESQ.greenComp} stopOpacity="0.2" />
            <stop offset="100%" stopColor={PESQ.greenLum} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M-40 210 C 240 120, 520 300, 780 210 S 1240 90, 1500 190"
          fill="none" stroke="url(#pesqWave)" strokeWidth="1.4" />
        <path d="M-40 300 C 260 220, 560 380, 840 296 S 1280 200, 1500 286"
          fill="none" stroke="url(#pesqWaveSoft)" strokeWidth="1" />
        <path d="M-40 690 C 300 610, 600 780, 900 690 S 1300 590, 1500 668"
          fill="none" stroke="url(#pesqWave)" strokeWidth="1.2" />
        <path d="M-40 770 C 280 700, 620 850, 940 764 S 1320 690, 1500 748"
          fill="none" stroke="url(#pesqWaveSoft)" strokeWidth="1" />
      </Box>
    </Box>
  )
}
