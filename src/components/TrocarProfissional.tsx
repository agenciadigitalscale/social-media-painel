/* TrocarProfissional — o "atribuir a outro profissional" das listas de produção.

   Pedido do dono (2026-09-29): na lista de vídeos e de artes, trocar de quem é a
   peça — inclusive para os sócios (Matheus Trindade e Matheus Prado), que também
   produzem. A troca é do CARD, então vale para a contagem, o board e a esteira. */
import { useState } from 'react'
import { IconButton, Menu, MenuItem, Tooltip, Typography } from '@mui/material'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import { membrosDoCargo } from '../lib/access'
import { NAME_MAP } from '../lib/users'
import { DS } from '../theme'

/** Quem pode receber a peça, por área: quem produz a área + os dois sócios. */
export function profissionaisDaArea(area: 'video' | 'design'): string[] {
  return [...membrosDoCargo(area === 'video' ? 'editor' : 'design'), ...membrosDoCargo('socio')]
}

export default function TrocarProfissional({ area, atual, titulo, onEscolher }: {
  area: 'video' | 'design'
  atual?: string
  titulo: string
  onEscolher: (membro: string) => void
}) {
  const [ancora, setAncora] = useState<HTMLElement | null>(null)
  return (
    <>
      <Tooltip title="Atribuir a outro profissional">
        <IconButton size="small" aria-label={`Atribuir ${titulo} a outro profissional`} onClick={e => setAncora(e.currentTarget)}
          sx={{ p: 0.3, flexShrink: 0, color: DS.t4, '&:hover': { color: DS.accent } }}>
          <SwapHorizIcon sx={{ fontSize: 15 }} />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={ancora} open={!!ancora} onClose={() => setAncora(null)}>
        <Typography sx={{ px: 2, pt: 0.5, pb: 0.8, fontSize: '0.62rem', fontWeight: 700, color: DS.t3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Atribuir a
        </Typography>
        {profissionaisDaArea(area).map(u => (
          <MenuItem key={u} selected={u === atual} disabled={u === atual}
            onClick={() => { setAncora(null); onEscolher(u) }}
            sx={{ fontSize: '0.78rem', gap: 1 }}>
            {NAME_MAP[u]?.fullName ?? u}
            <Typography component="span" sx={{ fontSize: '0.68rem', color: DS.t3 }}>{NAME_MAP[u]?.role}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
