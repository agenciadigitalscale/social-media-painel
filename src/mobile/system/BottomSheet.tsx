import { type ReactNode, useEffect } from 'react'
import { Box } from '@mui/material'
import { motion, AnimatePresence, useDragControls, type PanInfo } from 'framer-motion'
import { spring, dur } from './motion'
import { DS } from '../../theme'
import { haptic } from './haptics'

interface Props {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: ReactNode
  maxHeight?: string
}

// Bottom sheet físico: sobe com spring, arrasta pra baixo (só pelo grabber, pra não
// conflitar com o scroll interno) e fecha com inércia. Backdrop com blur + fade.
export default function BottomSheet({ open, onClose, children, title, maxHeight = '92vh' }: Props) {
  const controls = useDragControls()

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 550) { haptic('light'); onClose() }
  }

  return (
    <AnimatePresence>
      {open && (
        <Box sx={{ position: 'fixed', inset: 0, zIndex: 1500 }}>
          <motion.div
            onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: dur.base }}
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
            }}
          />
          <motion.div
            drag="y"
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={handleDragEnd}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={spring.gentle}
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              maxHeight,
              background: DS.surface,
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              border: `1px solid ${DS.border}`, borderBottom: 'none',
              boxShadow: '0 -14px 55px rgba(0,0,0,0.65)',
              display: 'flex', flexDirection: 'column',
              paddingBottom: 'max(env(safe-area-inset-bottom), 14px)',
            }}
          >
            <Box
              onPointerDown={(e) => controls.start(e)}
              sx={{ pt: 1.3, pb: 0.6, display: 'flex', justifyContent: 'center', flexShrink: 0, cursor: 'grab', touchAction: 'none' }}
            >
              <Box sx={{ width: 40, height: 5, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.2)' }} />
            </Box>
            {title && <Box sx={{ px: 2.2, pb: 1.2, flexShrink: 0 }}>{title}</Box>}
            <Box sx={{ overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', flex: 1 }}>
              {children}
            </Box>
          </motion.div>
        </Box>
      )}
    </AnimatePresence>
  )
}
