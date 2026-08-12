import { useEffect, useState } from 'react'
import { Box, Typography } from '@mui/material'
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded'
import SyncProblemRoundedIcon from '@mui/icons-material/SyncProblemRounded'
import { DS } from '../../theme'
import { getSyncStatus, onSyncStatus } from '../../lib/storage'

/**
 * A faixa de estado do topo, no celular.
 *
 * Até 2026-08-12 este componente era um stub: uma barra cinza permanente
 * escrita "PWA status não disponível". Ela ocupava espaço no alto de toda tela
 * do app e não dizia nada — a primeira coisa que o time via ao abrir o painel
 * no telefone.
 *
 * Agora ela mostra o que de fato importa num aparelho móvel: **se o que você
 * acabou de mexer já saiu do celular.** O painel é offline-first e a fila de
 * sync é real; sem esse aviso, alguém edita no elevador, fecha o app e não sabe
 * se perdeu.
 *
 * E ela **some quando está tudo certo**. Barra de status que fica sempre na
 * tela vira moldura: ninguém lê. Aparecer é o sinal.
 */
export default function PwaStatusBar() {
  const [status, setStatus] = useState(getSyncStatus)
  const [pending, setPending] = useState(0)
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine)

  useEffect(() => onSyncStatus((s, p) => { setStatus(s); setPending(p) }), [])

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const semRede = offline || status === 'offline'
  const falhou = status === 'error'

  // Silêncio é o estado normal.
  if (!semRede && !falhou) return null

  const cor = semRede ? DS.amber : DS.red
  const texto = semRede
    ? pending > 0
      ? `Sem conexão · ${pending} ${pending === 1 ? 'alteração salva' : 'alterações salvas'} no aparelho`
      : 'Sem conexão · o painel continua funcionando'
    : `Não consegui salvar${pending > 0 ? ` ${pending} ${pending === 1 ? 'alteração' : 'alterações'}` : ''} · vai tentar de novo`

  return (
    <Box
      role="status"
      sx={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.9,
        px: 2, py: 0.9,
        bgcolor: `${cor}1a`, borderBottom: `1px solid ${cor}40`,
      }}
    >
      {semRede
        ? <CloudOffRoundedIcon sx={{ fontSize: 15, color: cor, flexShrink: 0 }} />
        : <SyncProblemRoundedIcon sx={{ fontSize: 15, color: cor, flexShrink: 0 }} />}
      <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: cor, lineHeight: 1.3 }}>
        {texto}
      </Typography>
    </Box>
  )
}
