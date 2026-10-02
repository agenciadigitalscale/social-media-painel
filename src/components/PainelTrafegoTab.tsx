import { useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { DS } from '../theme'

/** Painel de Tráfego (projeto painel-facebook), hospedado à parte. */
export const PAINEL_TRAFEGO_URL = 'https://painel-facebook-nu.vercel.app/'
/** Gerador de propostas comerciais, hospedado à parte. */
export const PROPOSTA_URL = 'https://proposta-c1d.pages.dev/'

/**
 * Site da agência hospedado fora do DS HUB, embutido numa aba (2026-10-02).
 * Embutido porque os sites não proíbem moldura; o botão de nova aba fica sempre
 * à mão porque o navegador pode isolar o login dentro da moldura.
 */
export function SiteEmbutido({ titulo, subtitulo, url }: { titulo: string; subtitulo: string; url: string }) {
  const [carregou, setCarregou] = useState(false)
  return (
    <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.2, height: '100%', minHeight: 'calc(100vh - 110px)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography sx={{ fontSize: { xs: '1.3rem', xl: '1.6rem' }, fontWeight: 800, color: DS.t1, letterSpacing: '-0.02em' }}>{titulo}</Typography>
          <Typography sx={{ fontSize: { xs: '0.78rem', xl: '0.86rem' }, color: DS.t2 }}>{subtitulo}</Typography>
        </Box>
        <Button variant="contained" startIcon={<OpenInNewIcon />} href={url} target="_blank" rel="noopener noreferrer" sx={{ fontWeight: 800 }}>
          Abrir em nova aba
        </Button>
      </Box>
      <Box sx={{ position: 'relative', flex: 1, minHeight: { xs: 500, xl: 700 }, borderRadius: '12px', overflow: 'hidden', border: `1px solid ${DS.border}`, bgcolor: DS.surface }}>
        {!carregou && (
          <Typography sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: '0.8rem', color: DS.t3 }}>
            Carregando…
          </Typography>
        )}
        <Box component="iframe" key={url} src={url} title={titulo} onLoad={() => setCarregou(true)}
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, bgcolor: 'transparent' }} />
      </Box>
    </Box>
  )
}

/** Aba 34: sócios e gestor de tráfego. */
export default function PainelTrafegoTab() {
  return <SiteEmbutido titulo="Painel de Tráfego" subtitulo="Campanhas pagas dos clientes — visualização para sócios e gestor de tráfego." url={PAINEL_TRAFEGO_URL} />
}

/** Aba 35: só sócios. */
export function PropostaTab() {
  return <SiteEmbutido titulo="Proposta" subtitulo="Propostas comerciais da agência — só sócios." url={PROPOSTA_URL} />
}
