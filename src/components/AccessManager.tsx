import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogTitle, Box, Typography, IconButton,
  TextField, Button, Chip, CircularProgress, Collapse, Divider,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import LockIcon from '@mui/icons-material/Lock'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import CheckIcon from '@mui/icons-material/Check'

const TEAM_MEMBERS = [
  { label: 'Sócio',                emoji: '👑', color: '#FFD700' },
  { label: 'Head/editor de vídeo', emoji: '🎬', color: '#ff9039' },
  { label: 'Gestor de tráfego',    emoji: '📈', color: '#00C47A' },
  { label: 'Social media',         emoji: '📱', color: '#3B8EFF' },
  { label: 'Design',               emoji: '🎨', color: '#C084FC' },
  { label: 'Atendimento',          emoji: '💬', color: '#FB7185' },
  { label: 'Outro',                emoji: '👤', color: '#94A3B8' },
]

interface Props {
  open: boolean
  onClose: () => void
}

type EditingRow = { role: string; password: string; confirm: string; error: string }

export default function AccessManager({ open, onClose }: Props) {
  const [configuredRoles, setConfiguredRoles]   = useState<string[]>([])
  const [adminPassword,   setAdminPassword]     = useState('')
  const [adminVerified,   setAdminVerified]     = useState(false)
  const [adminError,      setAdminError]        = useState('')
  const [adminLoading,    setAdminLoading]      = useState(false)
  const [editingRole,     setEditingRole]       = useState<string | null>(null)
  const [editRow,         setEditRow]           = useState<EditingRow>({ role: '', password: '', confirm: '', error: '' })
  const [saving,          setSaving]            = useState(false)
  const [savedRole,       setSavedRole]         = useState<string | null>(null)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setAdminPassword('')
      setAdminVerified(false)
      setAdminError('')
      setEditingRole(null)
      refreshConfigured()
    }
  }, [open])

  function refreshConfigured() {
    fetch('/api/role-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check' }),
    })
      .then(r => r.json())
      .then((d: { configured?: string[] }) => setConfiguredRoles(d.configured ?? []))
      .catch(() => {})
  }

  async function handleVerifyAdmin() {
    if (!adminPassword.trim()) return
    setAdminLoading(true)
    setAdminError('')
    try {
      const res  = await fetch('/api/role-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', role: 'Sócio', password: adminPassword }),
      })
      const data = await res.json() as { ok: boolean; noPassword?: boolean }
      if (data.ok) {
        setAdminVerified(true)
      } else {
        setAdminError('Senha do Sócio incorreta.')
      }
    } catch {
      // API down — grant access
      setAdminVerified(true)
    } finally {
      setAdminLoading(false)
    }
  }

  function startEditing(role: string) {
    setEditingRole(role)
    setEditRow({ role, password: '', confirm: '', error: '' })
  }

  function cancelEditing() {
    setEditingRole(null)
    setEditRow({ role: '', password: '', confirm: '', error: '' })
  }

  async function handleSavePassword() {
    const { password, confirm } = editRow
    if (!password) { setEditRow(r => ({ ...r, error: 'Digite uma senha.' })); return }
    if (password.length < 4) { setEditRow(r => ({ ...r, error: 'Mínimo 4 caracteres.' })); return }
    if (password !== confirm) { setEditRow(r => ({ ...r, error: 'As senhas não coincidem.' })); return }

    setSaving(true)
    setEditRow(r => ({ ...r, error: '' }))
    try {
      const res  = await fetch('/api/role-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set',
          role: editingRole,
          password,
          adminPassword,
        }),
      })
      const data = await res.json() as { ok: boolean; error?: string }
      if (data.ok) {
        refreshConfigured()
        setSavedRole(editingRole)
        setTimeout(() => setSavedRole(null), 2000)
        cancelEditing()
      } else {
        setEditRow(r => ({ ...r, error: data.error ?? 'Erro ao salvar.' }))
      }
    } catch {
      setEditRow(r => ({ ...r, error: 'Servidor indisponível.' }))
    } finally {
      setSaving(false)
    }
  }

  async function handleRemovePassword(role: string) {
    setSaving(true)
    try {
      const res  = await fetch('/api/role-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', role, adminPassword }),
      })
      const data = await res.json() as { ok: boolean; error?: string }
      if (data.ok) {
        refreshConfigured()
      }
    } catch {}
    finally { setSaving(false) }
  }

  const hasSocioPassword = configuredRoles.includes('Sócio')
  const needsAdminVerify = hasSocioPassword && !adminVerified

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: 'rgba(12,12,12,0.98)',
          backdropFilter: 'blur(24px)',
          border: '1.5px solid rgba(255,215,0,0.2)',
          borderRadius: 3,
          boxShadow: '0 8px 48px rgba(255,215,0,0.1)',
        },
      }}
    >
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 3, pt: 2.5, pb: 2 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LockIcon sx={{ fontSize: 18, color: '#FFD700' }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>Gerenciar Acesso</Typography>
            <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)' }}>
              Configure senhas por função · Apenas Sócio
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)' }} />
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>

        {/* ── Admin verification (only if Sócio password is set) ── */}
        {needsAdminVerify ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.15)' }}>
              <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                👑 Para gerenciar senhas, confirme a senha do <strong style={{ color: '#FFD700' }}>Sócio</strong>.
              </Typography>
            </Box>
            <TextField
              fullWidth size="small" type="password"
              label="Senha do Sócio"
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleVerifyAdmin() }}
              error={!!adminError}
              helperText={adminError}
              autoComplete="current-password"
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff', background: 'rgba(255,255,255,0.04)',
                  '& fieldset': { borderColor: 'rgba(255,215,0,0.25)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,215,0,0.45)' },
                  '&.Mui-focused fieldset': { borderColor: '#FFD700' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.45)' },
                '& .MuiFormHelperText-root': { color: '#FF4545' },
              }}
            />
            <Button
              variant="contained"
              onClick={handleVerifyAdmin}
              disabled={!adminPassword.trim() || adminLoading}
              sx={{ bgcolor: '#FFD700', color: '#000', fontWeight: 800, '&:hover': { bgcolor: '#FFE44D' } }}
            >
              {adminLoading ? <CircularProgress size={18} sx={{ color: '#000' }} /> : 'Verificar'}
            </Button>
          </Box>

        ) : (
          /* ── Role list ── */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {!hasSocioPassword && (
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,144,57,0.06)', border: '1px solid rgba(255,144,57,0.15)', mb: 1 }}>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                  💡 Defina a senha do <strong style={{ color: '#ff9039' }}>Sócio</strong> primeiro para proteger este painel.
                </Typography>
              </Box>
            )}

            {TEAM_MEMBERS.map(({ label, emoji, color }) => {
              const hasPassword = configuredRoles.includes(label)
              const isEditing   = editingRole === label
              const wasSaved    = savedRole === label

              return (
                <Box key={label} sx={{
                  borderRadius: 2,
                  border: `1px solid ${isEditing ? `${color}40` : 'rgba(255,255,255,0.07)'}`,
                  background: isEditing ? `${color}06` : 'rgba(255,255,255,0.02)',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease',
                }}>
                  {/* Row header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.3 }}>
                    <Typography sx={{ fontSize: '1.25rem', lineHeight: 1, flexShrink: 0 }}>{emoji}</Typography>
                    <Typography sx={{ flex: 1, fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>{label}</Typography>

                    {wasSaved && (
                      <Chip
                        icon={<CheckIcon sx={{ fontSize: 12 }} />}
                        label="Salvo"
                        size="small"
                        sx={{ bgcolor: 'rgba(0,196,122,0.15)', color: '#00C47A', borderColor: 'rgba(0,196,122,0.3)', border: '1px solid', fontSize: '0.62rem', height: 22 }}
                      />
                    )}

                    {hasPassword ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <LockIcon sx={{ fontSize: 13, color }} />
                        <Typography sx={{ fontSize: '0.65rem', color, fontWeight: 700 }}>Senha definida</Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <LockOpenIcon sx={{ fontSize: 13, color: 'rgba(255,255,255,0.2)' }} />
                        <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)' }}>Sem senha</Typography>
                      </Box>
                    )}

                    {!isEditing && (
                      <IconButton
                        size="small"
                        onClick={() => startEditing(label)}
                        sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color }, p: 0.5 }}
                      >
                        <EditIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    )}
                    {hasPassword && !isEditing && (
                      <IconButton
                        size="small"
                        onClick={() => handleRemovePassword(label)}
                        disabled={saving}
                        sx={{ color: 'rgba(255,255,255,0.2)', '&:hover': { color: '#FF4545' }, p: 0.5 }}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    )}
                  </Box>

                  {/* Inline edit form */}
                  <Collapse in={isEditing}>
                    <Box sx={{ px: 2, pb: 2, display: 'flex', flexDirection: 'column', gap: 1.5, borderTop: '1px solid rgba(255,255,255,0.06)', pt: 1.5 }}>
                      <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)' }}>
                        {hasPassword ? 'Alterar senha' : 'Definir senha'} para <strong style={{ color }}>{label}</strong>
                      </Typography>
                      <TextField
                        fullWidth size="small" type="password"
                        label="Nova senha"
                        value={editRow.password}
                        onChange={e => setEditRow(r => ({ ...r, password: e.target.value, error: '' }))}
                        sx={fieldSx(color)}
                      />
                      <TextField
                        fullWidth size="small" type="password"
                        label="Confirmar senha"
                        value={editRow.confirm}
                        onChange={e => setEditRow(r => ({ ...r, confirm: e.target.value, error: '' }))}
                        onKeyDown={e => { if (e.key === 'Enter') handleSavePassword() }}
                        error={!!editRow.error}
                        helperText={editRow.error}
                        sx={fieldSx(color)}
                      />
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          variant="contained" size="small"
                          onClick={handleSavePassword}
                          disabled={saving}
                          sx={{ bgcolor: color, color: '#000', fontWeight: 800, flex: 1, '&:hover': { filter: 'brightness(1.12)' }, '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.2)' } }}
                        >
                          {saving ? <CircularProgress size={16} sx={{ color: '#000' }} /> : 'Salvar'}
                        </Button>
                        <Button
                          variant="outlined" size="small"
                          onClick={cancelEditing}
                          sx={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', '&:hover': { borderColor: 'rgba(255,255,255,0.3)', color: '#fff' } }}
                        >
                          Cancelar
                        </Button>
                      </Box>
                    </Box>
                  </Collapse>
                </Box>
              )
            })}

            <Box sx={{ mt: 1, p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', lineHeight: 1.7 }}>
                🔐 Senhas são criptografadas com SHA-256 no banco de dados.<br />
                Sessões duram 8 horas — após isso, o login é solicitado novamente.
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  )
}

function fieldSx(color: string) {
  return {
    '& .MuiOutlinedInput-root': {
      color: '#fff', background: 'rgba(255,255,255,0.03)',
      '& fieldset': { borderColor: `${color}25` },
      '&:hover fieldset': { borderColor: `${color}50` },
      '&.Mui-focused fieldset': { borderColor: color },
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.4)' },
    '& .MuiInputLabel-root.Mui-focused': { color },
    '& .MuiFormHelperText-root.Mui-error': { color: '#FF4545' },
  }
}
