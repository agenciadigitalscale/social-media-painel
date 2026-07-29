import { useState, useEffect } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { NAME_MAP, getDisplayName } from '../lib/users'
import { getAssignmentsForUser, dismissAssignment, type PendingAssignment } from '../lib/assignments'

interface Props {
  currentUser: string
  onViewItem?: (itemId: number) => void
  // re-check trigger: incrementa quando uma nova atribuição é criada
  checkTrigger?: number
}

export default function AssignmentNotification({ currentUser, onViewItem, checkTrigger }: Props) {
  const [queue, setQueue]         = useState<PendingAssignment[]>([])
  const [visible, setVisible]     = useState(false)
  const [exiting, setExiting]     = useState(false)
  const [current, setCurrent]     = useState<PendingAssignment | null>(null)

  // Carrega pendentes sempre que currentUser ou checkTrigger muda
  useEffect(() => {
    if (!currentUser) return
    const pending = getAssignmentsForUser(currentUser)
    if (pending.length > 0) {
      setQueue(pending)
      setCurrent(pending[0])
      setVisible(true)
      setExiting(false)
    }
  }, [currentUser, checkTrigger])

  function handleDismiss() {
    if (!current) return
    setExiting(true)
    setTimeout(() => {
      dismissAssignment(current.id)
      const rest = queue.filter(a => a.id !== current.id)
      setQueue(rest)
      if (rest.length > 0) {
        setCurrent(rest[0])
        setExiting(false)
      } else {
        setVisible(false)
        setCurrent(null)
      }
    }, 380)
  }

  function handleView() {
    if (!current) return
    onViewItem?.(current.itemId)
    handleDismiss()
  }

  if (!visible || !current) return null

  const fromInfo  = NAME_MAP[current.from.toLowerCase()]
  const userInfo  = NAME_MAP[current.for.toLowerCase()]
  const fromName  = getDisplayName(current.from)
  const remaining = queue.length - 1

  return (
    <Box sx={{
      position: 'fixed', inset: 0, zIndex: 9990,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      px: 2,
      background: 'rgba(0,0,0,0.72)',
      backdropFilter: 'blur(8px)',
      animation: exiting ? 'assignFadeOut 0.38s ease forwards' : 'assignFadeIn 0.35s ease both',
      '@keyframes assignFadeIn':  { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
      '@keyframes assignFadeOut': { '0%': { opacity: 1 }, '100%': { opacity: 0 } },
    }}>
      <Box sx={{
        maxWidth: 420, width: '100%',
        background: 'rgba(10,8,8,0.97)',
        backdropFilter: 'blur(40px)',
        border: `1.5px solid ${userInfo?.color ?? DS.accent}40`,
        borderRadius: 4,
        boxShadow: `0 0 0 1px ${userInfo?.color ?? DS.accent}10, 0 32px 80px rgba(0,0,0,0.9), 0 0 60px ${userInfo?.color ?? DS.accent}18`,
        overflow: 'hidden',
        animation: exiting ? 'notifSlideOut 0.38s cubic-bezier(0.7,0,1,1) forwards' : 'notifSlideIn 0.45s cubic-bezier(0.16,1,0.3,1) both',
        '@keyframes notifSlideIn':  { '0%': { opacity: 0, transform: 'translateY(-28px) scale(0.94)' }, '100%': { opacity: 1, transform: 'translateY(0) scale(1)' } },
        '@keyframes notifSlideOut': { '0%': { opacity: 1, transform: 'scale(1)' }, '100%': { opacity: 0, transform: 'scale(0.92)' } },
      }}>

        {/* Barra de acento superior na cor do usuário */}
        <Box sx={{
          height: 3,
          background: userInfo
            ? `linear-gradient(90deg, ${userInfo.color}, ${userInfo.color}55)`
            : 'linear-gradient(90deg, DS.accent, DS.cyan)',
        }} />

        <Box sx={{ px: 3, pt: 2.5, pb: 3 }}>

          {/* Chip "Nova atribuição" */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0.7,
              px: 1.2, py: 0.45, borderRadius: 10,
              bgcolor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
            }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: DS.accent, boxShadow: '0 0 6px DS.accent', animation: 'assignPulse 2s ease-in-out infinite',
                '@keyframes assignPulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
              }} />
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: DS.accent, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Nova atribuição
              </Typography>
            </Box>
            {remaining > 0 && (
              <Typography sx={{ fontSize: '0.6rem', color: 'rgba(244,247,255,0.3)', fontWeight: 700 }}>
                +{remaining} mais
              </Typography>
            )}
          </Box>

          {/* Avatar do usuário atribuído */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
            <Box sx={{
              width: 64, height: 64, borderRadius: '18px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: userInfo ? `radial-gradient(135deg at 35% 35%, ${userInfo.color}35, ${userInfo.color}08)` : 'rgba(59,130,246,0.12)',
              border: `2px solid ${userInfo?.color ?? DS.accent}`,
              boxShadow: `0 0 24px ${userInfo?.glow ?? 'rgba(59,130,246,0.4)'}`,
            }}>
              <Typography sx={{ fontSize: '2rem', lineHeight: 1 }}>{userInfo?.emoji ?? '👤'}</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.6rem', color: 'rgba(244,247,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.2 }}>
                Atenção,
              </Typography>
              <Typography sx={{
                fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.05,
                color: userInfo?.color ?? DS.accent,
                textShadow: `0 0 20px ${userInfo?.glow ?? 'rgba(59,130,246,0.5)'}`,
              }}>
                {getDisplayName(current.for)}
              </Typography>
              <Typography sx={{ fontSize: '0.68rem', color: 'rgba(244,247,255,0.4)', fontWeight: 600 }}>
                {userInfo?.role ?? 'Equipe'}
              </Typography>
            </Box>
          </Box>

          {/* Mensagem */}
          <Box sx={{
            p: 1.8, borderRadius: 2.5, mb: 2,
            bgcolor: 'rgba(244,247,255,0.03)',
            border: '1px solid rgba(244,247,255,0.07)',
          }}>
            <Typography sx={{ fontSize: '0.62rem', color: 'rgba(244,247,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, mb: 0.8 }}>
              📌 Te atribuíram uma tarefa
            </Typography>

            {/* Quem atribuiu */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.2 }}>
              <Box sx={{
                width: 26, height: 26, borderRadius: '8px', flexShrink: 0,
                bgcolor: `${fromInfo?.color ?? DS.accent}18`,
                border: `1px solid ${fromInfo?.color ?? DS.accent}35`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Typography sx={{ fontSize: '0.85rem', lineHeight: 1 }}>{fromInfo?.emoji ?? '👤'}</Typography>
              </Box>
              <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: fromInfo?.color ?? DS.accent }}>
                {fromName}
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: 'rgba(244,247,255,0.3)' }}>
                te atribuiu:
              </Typography>
            </Box>

            {/* Item */}
            <Box sx={{
              p: 1.2, borderRadius: 2,
              bgcolor: `${userInfo?.color ?? DS.accent}08`,
              border: `1px solid ${userInfo?.color ?? DS.accent}20`,
            }}>
              <Typography sx={{ fontSize: '0.58rem', color: 'rgba(244,247,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, mb: 0.3 }}>
                {current.clientName} · {current.itemType}
              </Typography>
              <Typography sx={{ fontSize: '0.92rem', fontWeight: 800, color: 'rgba(244,247,255,0.9)', lineHeight: 1.3 }}>
                {current.itemTitle}
              </Typography>
            </Box>

            <Typography sx={{ fontSize: '0.6rem', color: 'rgba(244,247,255,0.2)', mt: 1, textAlign: 'right' }}>
              {new Date(current.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </Box>

          {/* Botões */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              onClick={handleView}
              variant="outlined"
              fullWidth
              sx={{
                fontWeight: 700, fontSize: '0.78rem',
                borderColor: `${userInfo?.color ?? DS.accent}40`,
                color: userInfo?.color ?? DS.accent,
                borderRadius: 2,
                '&:hover': { bgcolor: `${userInfo?.color ?? DS.accent}10`, borderColor: `${userInfo?.color ?? DS.accent}80` },
              }}
            >
              Ver tarefa →
            </Button>
            <Button
              onClick={handleDismiss}
              variant="contained"
              fullWidth
              sx={{
                fontWeight: 800, fontSize: '0.78rem',
                background: userInfo
                  ? `linear-gradient(135deg, ${userInfo.color}, ${userInfo.color}bb)`
                  : 'linear-gradient(135deg, DS.accent, DS.cyan)',
                color: '#000',
                borderRadius: 2,
                boxShadow: `0 4px 16px ${userInfo?.glow ?? 'rgba(59,130,246,0.35)'}`,
                '&:hover': { filter: 'brightness(1.1)', transform: 'translateY(-1px)' },
              }}
            >
              ✓ Entendido!
            </Button>
          </Box>

        </Box>
      </Box>
    </Box>
  )
}
