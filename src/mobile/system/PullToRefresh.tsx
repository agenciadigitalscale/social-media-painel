import { type ReactNode, useRef, useState } from 'react'
import { Box } from '@mui/material'
import { motion } from 'framer-motion'
import { DS } from '../../theme'
import { haptic } from './haptics'

interface Props {
  onRefresh: () => Promise<void> | void
  children: ReactNode
}

const THRESH = 72

// Puxar-para-atualizar estilo iOS: só arma quando o scroll está no topo, com resistência
// elástica e spinner que gira. Ao soltar acima do limiar, chama onRefresh (flush de sync).
export default function PullToRefresh({ onRefresh, children }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const pulling = useRef(false)
  const armed = useRef(false)
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const onTouchStart = (e: React.TouchEvent) => {
    if (refreshing) return
    const el = scrollRef.current
    if (el && el.scrollTop <= 0) { startY.current = e.touches[0].clientY; pulling.current = true }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!pulling.current || refreshing) return
    const dy = e.touches[0].clientY - startY.current
    if (dy <= 0) { setPull(0); return }
    const damped = Math.min(dy * 0.5, 120)
    setPull(damped)
    if (damped >= THRESH && !armed.current) { armed.current = true; haptic('light') }
    if (damped < THRESH) armed.current = false
  }
  const onTouchEnd = async () => {
    if (!pulling.current) return
    pulling.current = false
    if (pull >= THRESH) {
      setRefreshing(true); setPull(THRESH); armed.current = false
      try { await onRefresh() } finally { setRefreshing(false); setPull(0) }
    } else setPull(0)
  }

  return (
    <Box sx={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 2 }}>
        <motion.div
          animate={{ opacity: pull > 4 || refreshing ? 1 : 0, y: Math.max(pull - 28, 0) }}
          transition={{ duration: 0.1 }}
          style={{ marginTop: 8 }}
        >
          <motion.div
            animate={{ rotate: refreshing ? 360 : pull * 3 }}
            transition={refreshing ? { repeat: Infinity, duration: 0.7, ease: 'linear' } : { duration: 0 }}
            style={{ width: 22, height: 22, borderRadius: '50%', border: `2.5px solid ${DS.orange}`, borderTopColor: 'transparent' }}
          />
        </motion.div>
      </Box>
      <Box
        ref={scrollRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
      >
        <motion.div
          animate={{ y: pull }}
          transition={pulling.current ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 30 }}
        >
          {children}
        </motion.div>
      </Box>
    </Box>
  )
}
